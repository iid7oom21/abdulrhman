import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createInvestigationLab} from '../scripts/start-investigation-lab.mjs';
import {fixturePack} from './fixtures/case.js';

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'raven-lab-test-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  const site = path.join(root, 'public'), data = path.join(root, 'private-data'), content = path.join(root, 'private-pack.json');
  for (const file of ['raven/investigation-lab/index.html','raven/investigation-lab/style.css','raven/investigation-lab/workbench.js','raven/deleted-name/play/app.js']) {
    const target = path.join(site, file); fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target, file.endsWith('.html') ? '<!doctype html><title>Review fixture</title>' : '/* public fixture */');
  }
  fs.writeFileSync(path.join(site,'raven/investigation-lab/private-policy.json'),'UNLISTED_SENTINEL');
  fs.writeFileSync(content,JSON.stringify(fixturePack()),{mode:0o600});
  return {root,site,data,content,options:{contentPath:content,siteRoot:site,dataDirectory:data}};
}
async function listen(t, options) {
  const server = createInvestigationLab(options);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let closed = false;
  const close = async () => {if (!closed) {closed=true;await new Promise(resolve => server.close(resolve));}};
  t.after(close);
  return {url:'http://127.0.0.1:'+server.address().port,close};
}
test('lab serves only reviewed public files, disables provider calls, and withholds future content', async t => {
  const f=setup(t),s=await listen(t,f.options);
  for (const file of ['', 'style.css','workbench.js']) assert.equal((await fetch(s.url+'/raven/investigation-lab/'+file)).status,200);
  assert.equal((await fetch(s.url+'/raven/investigation-lab/private-policy.json')).status,404);
  assert.equal((await fetch(s.url+'/private-pack.json')).status,404);
  const config=await (await fetch(s.url+'/api/config')).json();
  assert.equal(config.controls.providerCallsEnabled,false);
  assert.equal(config.provider,'simulation');
  const caseConfig=await (await fetch(s.url+'/api/case/config')).json();
  assert.equal(caseConfig.persistence,'browser-checkpoint');
  const response=await fetch(s.url+'/api/case/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contentVersion:'fixture-v1'})});
  assert.equal(response.status,200);
  const view=await response.json();
  assert.match(view.checkpointInfo.sessionTag,/^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(view),/UNSEEN_MATERIAL_SENTINEL|FUTURE_SCENE_SENTINEL/);
});
test('a restart keeps the local key and restores a checkpoint without model generation', async t => {
  const f=setup(t),a=await listen(t,f.options);
  const reply=await fetch(a.url+'/api/case/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contentVersion:'fixture-v1'})});
  const saved=await reply.json(), keyFile=path.join(f.data,'review-checkpoint.key'), key=fs.readFileSync(keyFile);
  await a.close(); const b=await listen(t,f.options);
  assert.deepEqual(fs.readFileSync(keyFile),key);
  const restored=await fetch(b.url+'/api/case/restore',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({checkpoint:saved.checkpoint})});
  assert.equal(restored.status,200);
  assert.equal((await restored.json()).checkpointInfo.sessionTag,saved.checkpointInfo.sessionTag);
  assert.equal(fs.statSync(keyFile).mode & 0o777,0o600);
});
test('private inputs cannot be under a checkout/site or pass through a symlink; malformed keys are retained', t => {
  const f=setup(t),checkout=path.join(f.root,'checkout');fs.mkdirSync(checkout);fs.mkdirSync(path.join(checkout,'.git'));
  assert.throws(()=>createInvestigationLab({...f.options,dataDirectory:path.join(f.site,'saves')}),/lab_data_must_be_private/);
  assert.throws(()=>createInvestigationLab({...f.options,dataDirectory:path.join(checkout,'saves')}),/lab_data_must_be_outside_git/);
  fs.symlinkSync(f.site,path.join(f.root,'site-link'));
  assert.throws(()=>createInvestigationLab({...f.options,siteRoot:path.join(f.root,'site-link')}),/lab_site_invalid/);
  fs.mkdirSync(f.data,{mode:0o700});
  const keyFile=path.join(f.data,'review-checkpoint.key');fs.writeFileSync(keyFile,'invalid-fixture-key',{mode:0o600});
  assert.throws(()=>createInvestigationLab(f.options),/lab_key_invalid/);
  assert.equal(fs.readFileSync(keyFile,'utf8'),'invalid-fixture-key');
});
