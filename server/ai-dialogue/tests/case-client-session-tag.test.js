import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createPreviewServer} from '../src/server.js';
import {createCaseCheckpoint,checkpointSessionTag} from '../src/case-checkpoint.js';
import {fixturePack,action} from './fixtures/case.js';

const KEY = '0a'.repeat(32); // Fictional test key, never an environment secret.
const summaryKeys = ['schemaVersion','caseId','contentVersion','resumable','persistence','saveStatus'].sort();
function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'raven-client-tag-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  return path.join(root,'case-store.json');
}
async function start(t,options = {}) {
  let providerCalls = 0;
  const server = createPreviewServer({casePack:fixturePack(),readControls:()=>({providerCallsEnabled:false}),
    generate:() => {providerCalls++;throw new Error('No model calls in the written case');},...options});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let closed = false;
  const close = async () => {if (!closed) {closed=true;await new Promise(resolve=>server.close(resolve));}};
  t.after(close);
  return {root:'http://127.0.0.1:'+server.address().port,close,providerCalls:()=>providerCalls};
}
async function request(server,route,{cookie,body} = {}) {
  const response = await fetch(server.root+'/api/case/'+route,{method:body===undefined?'GET':'POST',
    headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,headers:response.headers,data:await response.json()};
}
async function begin(server) {
  const response = await request(server,'start',{body:{contentVersion:'fixture-v1'}});
  assert.equal(response.status,200);
  return {...response,cookie:response.headers.get('set-cookie').split(';')[0]};
}
function assertTag(response,cookie,expected) {
  assert.equal(response.status,200);
  const id = cookie.split('=')[1];
  assert.match(response.data.clientSessionTag,/^[a-f0-9]{64}$/);
  assert.equal(response.data.clientSessionTag,expected || checkpointSessionTag(id));
  assert.notEqual(response.data.clientSessionTag,id);
  assert.equal(JSON.stringify(response.data).includes(id),false,'response never contains the raw authentication cookie');
  assert.doesNotMatch(JSON.stringify(response.data),/UNSEEN_MATERIAL_SENTINEL|FUTURE_SCENE_SENTINEL/);
  assert.equal(response.headers.get('cache-control'),'no-store');
}

for (const mode of ['process-memory','disk-file','browser-checkpoint']) {
  test(`${mode}: stable isolated client tag is metadata, never authentication or engine input`,async t => {
    const file = mode==='disk-file'?temporary(t):null;
    const server = await start(t,{...(file?{caseStoragePath:file}:{}),...(mode==='browser-checkpoint'?{caseCheckpointKey:KEY}:{})});
    const missing = await request(server,'state');assert.equal(missing.status,401);
    assert.equal(Object.hasOwn(missing.data,'clientSessionTag'),false);
    const one = await begin(server),two = await begin(server);
    assertTag(one,one.cookie);assertTag(two,two.cookie);
    const tag = one.data.clientSessionTag;
    assert.notEqual(tag,two.data.clientSessionTag,'two case sessions cannot share a local board scope');
    if (mode==='browser-checkpoint') assert.equal(tag,one.data.checkpointInfo.sessionTag);
    else assert.equal(Object.hasOwn(one.data,'checkpointInfo'),false,'tag must not imply checkpoint availability');

    const savedBefore = file?fs.readFileSync(file,'utf8'):null;
    const state = await request(server,'state',{cookie:one.cookie});assertTag(state,one.cookie,tag);
    assert.equal(state.data.revision,0);assert.deepEqual(state.data.notes,[]);assert.deepEqual(state.data.materials,[]);
    assert.equal(state.headers.get('set-cookie'),null);
    if (file) assert.equal(fs.readFileSync(file,'utf8'),savedBefore,'reading tag does not write persistence');
    const resumed = await request(server,'start',{cookie:one.cookie,body:{contentVersion:'fixture-v1'}});assertTag(resumed,one.cookie,tag);
    assert.equal(resumed.headers.get('set-cookie'),null);

    const fakeCookie = 'raven_case_session='+tag;
    assert.equal((await request(server,'state',{cookie:fakeCookie})).status,401);
    assert.equal((await request(server,'resume-summary',{cookie:fakeCookie})).status,401);
    const forgedStart = await request(server,'start',{cookie:fakeCookie,body:{contentVersion:'fixture-v1'}});
    assert.equal(forgedStart.status,401);assert.equal(forgedStart.headers.get('set-cookie'),null);
    assert.equal((await request(server,'start',{cookie:one.cookie,body:{contentVersion:'fixture-v1',clientSessionTag:tag}})).status,400);
    assert.equal((await request(server,'actions',{cookie:one.cookie,body:{...action(0,'read'),clientSessionTag:tag}})).status,400);
    assert.equal((await request(server,'state',{cookie:one.cookie})).data.revision,0,'forged metadata never executes an action');

    const read = await request(server,'actions',{cookie:one.cookie,body:action(0,'read')});assertTag(read,one.cookie,tag);
    assert.equal(read.data.revision,1);assert.deepEqual(read.data.materials.map(item=>item.id),['card']);
    const replay = await request(server,'actions',{cookie:one.cookie,body:action(0,'read')});assertTag(replay,one.cookie,tag);
    assert.equal(replay.data.replayed,true);assert.equal(replay.data.revision,1);
    const other = await request(server,'state',{cookie:two.cookie});assert.equal(other.data.revision,0);assert.deepEqual(other.data.materials,[]);
    const summary = await request(server,'resume-summary',{cookie:one.cookie});
    assert.deepEqual(Object.keys(summary.data).sort(),summaryKeys,'homepage summary remains exactly six nonprivate fields');
    for (const route of ['config','export','hint']) {
      const response = await request(server,route,{cookie:one.cookie});assert.equal(response.status,200);
      assert.equal(Object.hasOwn(response.data,'clientSessionTag'),false,route+' does not expose local-tool session metadata');
    }
    if (file) {
      const persisted=fs.readFileSync(file,'utf8');
      assert.equal(persisted.includes('clientSessionTag'),false);assert.equal(persisted.includes(tag),false);
    }
    if (mode==='browser-checkpoint') {
      const payload=createCaseCheckpoint(KEY).open(read.data.checkpoint);
      assert.equal(JSON.stringify(payload).includes('clientSessionTag'),false);
      assert.equal(JSON.stringify(payload).includes(tag),false,'tag is not added to the sealed recovery schema');
      assert.equal((await request(server,'restore',{body:{checkpoint:tag}})).status,400,'a public identity tag cannot restore a session');
      assert.equal((await request(server,'restore',{cookie:fakeCookie,body:{checkpoint:read.data.checkpoint}})).status,409,'a tag cannot impersonate the recovery cookie');
    }
    assert.equal(server.providerCalls(),0);
  });
}

test('disk client tag survives restart without a stored projection change or extra write',async t => {
  const file=temporary(t),first=await start(t,{caseStoragePath:file}),player=await begin(first);
  await request(first,'actions',{cookie:player.cookie,body:action(0,'read')});
  const before=fs.readFileSync(file,'utf8');await first.close();
  const restarted=await start(t,{caseStoragePath:file});
  const state=await request(restarted,'state',{cookie:player.cookie});assertTag(state,player.cookie,player.data.clientSessionTag);
  assert.equal(state.data.revision,1);assert.equal(state.data.saveStatus,'confirmed');
  assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal(restarted.providerCalls(),0);
});

test('browser recovery derives the same tag after process restart without embedding it in the token payload',async t => {
  const first=await start(t,{caseCheckpointKey:KEY}),player=await begin(first);
  const read=await request(first,'actions',{cookie:player.cookie,body:action(0,'read')});await first.close();
  const restarted=await start(t,{caseCheckpointKey:KEY});
  const restored=await request(restarted,'restore',{body:{checkpoint:read.data.checkpoint}});
  const cookie=restored.headers.get('set-cookie').split(';')[0];
  assertTag(restored,cookie,player.data.clientSessionTag);assert.equal(cookie,player.cookie);
  assert.equal(restored.data.checkpointInfo.sessionTag,restored.data.clientSessionTag);
  assert.equal(restored.data.revision,1);assert.equal(restored.data.saveStatus,'browser-required');
  assert.equal(restarted.providerCalls(),0);
});
