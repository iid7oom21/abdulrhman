import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createPreviewServer} from '../src/server.js';
import {openCaseStore} from '../src/case-store.js';
import {fixturePack, action} from './fixtures/case.js';

const SUMMARY = '/api/case/resume-summary';
const expected = (persistence, saveStatus, resumable = true, contentVersion = 'fixture-v1') =>
  ({schemaVersion:1,caseId:'fixture',contentVersion,resumable,persistence,saveStatus});
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'raven-resume-summary-'));
  t.after(() => fs.rmSync(directory,{recursive:true,force:true}));
  return path.join(directory,'case-store.json');
}
async function start(t, options = {}) {
  const server = createPreviewServer({casePack:fixturePack(),generate() {throw new Error('No provider calls');},...options});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let closed = false;
  const close = async () => {if (!closed) {closed = true;await new Promise(resolve => server.close(resolve));}};
  t.after(close);
  return {root:'http://127.0.0.1:' + server.address().port,close};
}
async function request(server, route = SUMMARY, {cookie,body,method = body === undefined ? 'GET' : 'POST'} = {}) {
  const response = await fetch(server.root + route,{method,headers:{...(cookie ? {cookie} : {}),...(body === undefined ? {} : {'content-type':'application/json'})},...(body === undefined ? {} : {body:JSON.stringify(body)})});
  return {status:response.status,headers:response.headers,data:await response.json()};
}
async function begin(server) {
  const response = await request(server,'/api/case/start',{body:{contentVersion:'fixture-v1'}});
  assert.equal(response.status,200);
  return {...response,cookie:response.headers.get('set-cookie').split(';')[0]};
}
const act = (server,cookie,value) => request(server,'/api/case/actions',{cookie,body:value});
function assertMetadataOnly(response, value) {
  assert.equal(response.status,200);
  assert.deepEqual(response.data,value);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('set-cookie'),null);
  assert.equal(response.headers.get('access-control-allow-origin'),null);
  assert.doesNotMatch(JSON.stringify(response.data),/PUBLIC_CARD_BODY|UNSEEN_MATERIAL|FUTURE_SCENE|PRIVATE_NOTE|PRIVATE_DRAFT|PRIVATE_NEW_CONTENT|PRIVATE_STORE_PATH/);
}

test('missing, forged and stale cookies do not create a case, preview session or save file', async t => {
  const storage = temporary(t), server = await start(t,{caseStoragePath:storage});
  for (const cookie of [undefined,'raven_case_session=invalid','raven_case_session=' + 'a'.repeat(64),'raven_preview_session=' + 'b'.repeat(64)]) {
    const result = await request(server,SUMMARY + '?resumable=true&checkpoint=fake',{cookie});
    assert.equal(result.status,401);assert.deepEqual(result.data,{error:'session_unavailable'});
    assert.equal(result.headers.get('set-cookie'),null);assert.equal(result.headers.get('cache-control'),'no-store');
    assert.equal(fs.existsSync(storage),false);
  }
  const disabled = await start(t,{casePack:null});
  assert.equal((await request(disabled)).status,401);
});

test('an active temporary session returns only availability metadata before and after private activity', async t => {
  const server = await start(t), player = await begin(server);
  assertMetadataOnly(await request(server,SUMMARY,{cookie:player.cookie}),expected('process-memory','memory'));
  assert.equal((await act(server,player.cookie,action(0,'read'))).status,200);
  assert.equal((await act(server,player.cookie,action(1,'draft',{text:'PRIVATE_DRAFT',position:'unknown',sources:['card']}))).status,200);
  const before = await request(server,'/api/case/state',{cookie:player.cookie});
  assertMetadataOnly(await request(server,SUMMARY,{cookie:player.cookie}),expected('process-memory','memory'));
  const after = await request(server,'/api/case/state',{cookie:player.cookie});
  assert.deepEqual(after.data,before.data);
});

test('confirmed disk availability survives restart and repeated reads never rewrite storage', async t => {
  const storage = temporary(t), first = await start(t,{caseStoragePath:storage}), player = await begin(first);
  await act(first,player.cookie,action(0,'read'));
  const bytes = fs.readFileSync(storage);
  assertMetadataOnly(await request(first,SUMMARY,{cookie:player.cookie}),expected('disk-file','confirmed'));
  await first.close();
  const second = await start(t,{caseStoragePath:storage});
  for (let i = 0; i < 3; i++) assertMetadataOnly(await request(second,SUMMARY,{cookie:player.cookie}),expected('disk-file','confirmed'));
  assert.deepEqual(fs.readFileSync(storage),bytes);
});

test('an older content version remains read-only and never exposes the replacement story', async t => {
  const storage = temporary(t), first = await start(t,{caseStoragePath:storage}), player = await begin(first);
  await first.close();
  const pack = fixturePack('fixture-v2');pack.scenes.desk.body.en = 'PRIVATE_NEW_CONTENT';
  const second = await start(t,{caseStoragePath:storage,casePack:pack});
  assertMetadataOnly(await request(second,SUMMARY,{cookie:player.cookie}),expected('disk-file','confirmed',false));
  assert.equal((await request(second,'/api/case/state',{cookie:player.cookie})).data.readOnly,true);
});

test('an unconfirmed storage write cannot produce a resumable or confirmed homepage badge', async t => {
  const storage = temporary(t);let failSave = false;
  const server = await start(t,{caseStoragePath:storage,openCaseStore(file,options) {
    const disk = openCaseStore(file,options);
    return {load:disk.load,save(value) {if (failSave) throw new Error('PRIVATE_STORE_PATH');disk.save(value);}};
  }}), player = await begin(server);
  const bytes = fs.readFileSync(storage);failSave = true;
  assert.equal((await act(server,player.cookie,action(0,'read'))).status,503);
  assertMetadataOnly(await request(server,SUMMARY,{cookie:player.cookie}),expected('disk-file','unconfirmed',false));
  assert.deepEqual(fs.readFileSync(storage),bytes);
});

test('browser recovery is never confirmed by the homepage and a token alone never restores a session', async t => {
  const options = {caseCheckpointKey:'ab'.repeat(32)}, first = await start(t,options), player = await begin(first);
  assertMetadataOnly(await request(first,SUMMARY,{cookie:player.cookie}),expected('browser-checkpoint','browser-required'));
  await first.close();
  const second = await start(t,options);
  assert.equal((await request(second,SUMMARY,{cookie:player.cookie})).status,401);
  assert.equal((await request(second,SUMMARY + '?checkpoint=' + encodeURIComponent(player.data.checkpoint))).status,401);
  assert.equal((await request(second,'/api/case/state',{cookie:player.cookie})).status,401);
  const restored = await request(second,'/api/case/restore',{cookie:player.cookie,body:{checkpoint:player.data.checkpoint}});
  assert.equal(restored.status,200);
  assertMetadataOnly(await request(second,SUMMARY,{cookie:player.cookie}),expected('browser-checkpoint','browser-required'));
});

test('summary is read-only and never accepts client claims about state or completion', async t => {
  const server = await start(t), player = await begin(server);
  const before = await request(server,'/api/case/state',{cookie:player.cookie});
  const result = await request(server,SUMMARY,{cookie:player.cookie,body:{resumable:true,saveStatus:'confirmed',revision:999}});
  assert.equal(result.status,404);
  assertMetadataOnly(await request(server,SUMMARY + '?saveStatus=confirmed',{cookie:player.cookie}),expected('process-memory','memory'));
  assert.deepEqual((await request(server,'/api/case/state',{cookie:player.cookie})).data,before.data);
});
