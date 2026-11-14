import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createPreviewServer, storagePathFromEnv, DEFAULT_STORAGE_PATH } from '../src/server.js';
import { openDiskStore } from '../src/disk-store.js';
import { _reset, simulateReply, getRequest } from '../src/dialogue.js';
import { ProviderError, createOpenAIReply, createCompatibleReply } from '../src/provider.js';

const deferred = () => { let resolve; const promise = new Promise(r => {resolve=r;}); return {promise,resolve}; };
const start = async (t, opts={}) => {
  const server=createPreviewServer(opts); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const close=()=>new Promise(r=>server.close(r)); t.after(close);
  const root=`http://127.0.0.1:${server.address().port}`;
  const cookie=(await fetch(root)).headers.get('set-cookie').split(';')[0];
  return {root,cookie,close,get:p=>fetch(root+p,{headers:{cookie}}),
    post:(p,b)=>fetch(root+p,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(b)})};
};
const payload = (id='one', message='ما المواد التي وصلتك؟') => ({requestId:id,characterId:'jonas',message});
const tmp = t => {const dir=fs.mkdtempSync(path.join(os.tmpdir(),'raven-reliable-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return path.join(dir,'store.json');};
async function until(s,id,status) {
  for(let i=0;i<60;i++) {const r=await (await s.get('/api/operations/'+id)).json();if(r.status===status)return r;await new Promise(r=>setTimeout(r,5));}
  assert.fail('operation did not reach '+status);
}

test('async duplicate joins the reserved operation, conflicting race is 409, poll never generates', async t=>{
  _reset(); const gate=deferred(); t.after(()=>gate.resolve()); let calls=0;
  const s=await start(t,{generate:async(...args)=>{calls++;await gate.promise;return simulateReply(...args);}});
  const first=await s.post('/api/dialogue',payload()); assert.equal(first.status,202);
  const concurrent=await Promise.all([s.post('/api/dialogue',payload()),s.post('/api/dialogue',payload('one','different'))]);
  assert.equal(concurrent[0].status,202);assert.equal((await concurrent[0].json()).replayed,true);
  assert.equal(concurrent[1].status,409);
  const second=await s.post('/api/dialogue',payload('second'));assert.equal(second.status,409);
  assert.equal((await second.json()).activeRequestId,'one');
  for(let i=0;i<3;i++)assert.equal((await(await s.get('/api/operations/one')).json()).status,'pending');
  assert.equal(calls,1);gate.resolve();
  const done=await until(s,'one','completed');
  const replay=await(await s.post('/api/dialogue',payload())).json();assert.deepEqual(replay.response,done.response);assert.equal(calls,1);
});

test('the initial operation is on disk before generation; context is a snapshot of that recipient',async t=>{
  _reset();const file=tmp(t), gate=deferred();t.after(()=>gate.resolve());let seen;
  const s=await start(t,{storeFile:file,generate:async (char,msg,context)=>{
    assert.equal(JSON.parse(fs.readFileSync(file)).requests[0].status,'pending');seen=context;
    await gate.promise;return simulateReply(char,msg,context);
  }});
  await s.post('/api/materials',{id:'original',type:'statement',text:'SECRET ORIGINAL'});
  await s.post('/api/materials',{id:'correction',type:'correction',originalId:'original',text:'CORRECTION ONLY'});
  await s.post('/api/materials',{id:'motive',type:'motive',text:'SECRET MOTIVE'});
  await s.post('/api/shares',{eventId:'correction-share',materialId:'correction',recipients:['jonas']});
  assert.equal((await s.post('/api/dialogue',payload())).status,202);
  await s.post('/api/shares',{eventId:'original-share-late',materialId:'original',recipients:['jonas']});
  assert.deepEqual(seen.materials.map(m=>m.id),['correction']);
  assert.doesNotMatch(JSON.stringify(seen),/SECRET/);gate.resolve();
  const reply=await until(s,'one','completed');assert.doesNotMatch(reply.response.text,/SECRET/);
});

test('unknown provider outcome survives reads/replay; no retry under the same ID',async t=>{
  _reset();let calls=0;
  const s=await start(t,{generate:async()=>{calls++;throw new ProviderError('provider_unavailable',true);}});
  await s.post('/api/dialogue',payload());await until(s,'one','unknown');
  for(let i=0;i<3;i++)assert.equal((await(await s.post('/api/dialogue',payload())).json()).status,'unknown');
  assert.equal((await s.post('/api/dialogue',payload('new'))).status,409);assert.equal(calls,1);
});

for (const [name, create] of [['openai', createOpenAIReply], ['compatible', createCompatibleReply]]) {
  test(name + ': body transport failure persists unknown, blocks another ID and replays after restart', async t => {
    _reset();
    const file = tmp(t);
    let calls = 0;
    const generate = create({apiKey: 'TEST_ONLY', model: 'fake-model', fetchImpl: async () => {
      calls++;
      return new Response(new ReadableStream({start(controller) { controller.error(new TypeError('PRIVATE_TRANSPORT_DETAIL')); }}));
    }});
    const s = await start(t, {storeFile: file, generate});
    await s.post('/api/materials', {id: 'received', type: 'statement', text: 'PLAYER_TEST_CLAIM'});
    await s.post('/api/shares', {eventId: 'received-share', materialId: 'received', recipients: ['jonas']});
    const first = await s.post('/api/dialogue', payload('body-failure'));
    assert.equal(first.status, 202);
    const result = await until(s, 'body-failure', 'unknown');
    assert.equal(result.error, 'provider_unavailable');
    assert.equal(result.response, undefined);
    const disk = JSON.parse(fs.readFileSync(file));
    assert.equal(disk.requests[0].status, 'unknown');
    for (let i = 0; i < 3; i++) {
      const replay = await (await s.post('/api/dialogue', payload('body-failure'))).json();
      assert.equal(replay.replayed, true);
      assert.equal(replay.status, 'unknown');
      assert.equal((await (await s.get('/api/operations/body-failure')).json()).status, 'unknown');
    }
    const blocked = await s.post('/api/dialogue', payload('new-body-failure'));
    assert.equal(blocked.status, 409);
    assert.equal((await blocked.json()).activeRequestId, 'body-failure');
    assert.equal(calls, 1);
    assert.doesNotMatch(JSON.stringify(result) + fs.readFileSync(file, 'utf8'), /PRIVATE_TRANSPORT_DETAIL/);
    await s.close();
    _reset();
    const restarted = await start(t, {storeFile: file, generate});
    const replay = await fetch(restarted.root + '/api/dialogue', {
      method: 'POST', headers: {cookie: s.cookie, 'content-type': 'application/json'}, body: JSON.stringify(payload('body-failure')),
    });
    const resumed = await replay.json();
    assert.equal(resumed.status, 'unknown');
    assert.equal(resumed.replayed, true);
    assert.equal(calls, 1);
  });
}

test('restart turns a persisted in-flight operation into unknown without a second generation',async t=>{
  _reset();const file=tmp(t),gate=deferred();let calls=0;t.after(()=>gate.resolve());
  const a=await start(t,{storeFile:file,generate:async()=>{calls++;await gate.promise;return {text:'late',refused:false};}});
  await a.post('/api/dialogue',payload());await a.close();_reset();
  const b=await start(t,{storeFile:file,generate:()=>{calls++;return simulateReply('jonas','x');}});
  const headers={cookie:a.cookie,'content-type':'application/json'};
  const r=await(await fetch(b.root+'/api/dialogue',{method:'POST',headers,body:JSON.stringify(payload())})).json();
  assert.equal(r.status,'unknown');assert.equal(r.replayed,true);assert.equal(calls,1);
  gate.resolve();await new Promise(r=>setTimeout(r,10));
  assert.equal((await(await fetch(b.root+'/api/operations/one',{headers})).json()).status,'unknown');
});

test('failed preflight disk write calls no generator; a known response survives a later failed save',async t=>{
  _reset();const file=tmp(t),gate=deferred();let fail=false,calls=0;
  t.after(()=>gate.resolve());
  const s=await start(t,{storeFile:file,openStore:f=>{const real=openDiskStore(f);return {...real,save:state=>{if(fail)throw new Error('disk full');real.save(state);}};},
    generate:async()=>{calls++;await gate.promise;return {text:'KNOWN REPLY',refused:false};}});
  fail=true;
  const blocked=await(await s.post('/api/dialogue',payload('blocked'))).json();assert.equal(blocked.error,'storage_unavailable');assert.equal(calls,0);
  fail=false;await s.post('/api/dialogue',payload('known'));assert.equal(calls,1);
  const before=fs.readFileSync(file,'utf8');fail=true;gate.resolve();
  const r=await until(s,'known','completed');assert.equal(r.response.text,'KNOWN REPLY');assert.equal(r.saveStatus,'unconfirmed');
  assert.equal(fs.readFileSync(file,'utf8'),before);
  const again=await(await s.post('/api/dialogue',payload('known'))).json();assert.equal(again.response.text,'KNOWN REPLY');assert.equal(again.replayed,true);assert.equal(calls,1);
  assert.equal(fs.readFileSync(file,'utf8'),before); // reads/replay didn't pretend to repair the disk
});

test('valid JSON with corrupt nested data refuses startup and stays byte-for-byte intact',async t=>{
  _reset();const file=tmp(t),s=await start(t,{storeFile:file});
  await s.post('/api/dialogue',payload());await s.close();
  const good=JSON.parse(fs.readFileSync(file));
  for(const corrupt of [
    d=>{d.sessions[0].actions.push({kind:'unknown',input:{}});},
    d=>{d.sessions[0].touchedAt=null;},d=>{d.requests[0].fingerprint='wrong';},
    d=>{d.requests.push({...d.requests[0]});},d=>{d.requests[0].response={};},
    d=>{d.sessions[0].actions.push({kind:'material',input:{id:'fake',type:'evidence',author:'player',text:'fake',sourceId:'x'}});}
  ]) {const bad=structuredClone(good);corrupt(bad);const raw=JSON.stringify(bad);fs.writeFileSync(file,raw);
    assert.throws(()=>createPreviewServer({storeFile:file}),/incompatible_store_file/);assert.equal(fs.readFileSync(file,'utf8'),raw);
  }
  // Failed loading never clears operations that were already in memory.
  assert.equal(getRequest('one',s.cookie.split('=')[1]).status,'completed');
});

test('health/config do not issue sessions or change the persisted file; no secrets in config',async t=>{
  _reset();const file=tmp(t),s=await start(t,{storeFile:file,maxSessions:1});const before=fs.readFileSync(file,'utf8');
  for(let i=0;i<3;i++){
    const health=await fetch(s.root+'/healthz');assert.equal(health.status,200);assert.equal(health.headers.get('set-cookie'),null);
    const config=await(await fetch(s.root+'/api/config')).json();assert.equal(config.persistence,'disk-file');assert.equal(config.provider,'simulation');
    assert.doesNotMatch(JSON.stringify(config),/apiKey|Bearer|owner|fingerprint/);
    const legacy=await fetch(s.root+'/api/status');assert.equal(legacy.status,200);assert.equal(legacy.headers.get('set-cookie'),null);
    const status=await legacy.json();assert.equal(status.mode,'simulation');assert.deepEqual(status.characters,['jonas','claire']);
  }
  assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal((await s.get('/api/history')).status,200);
});

test('HTTP contract rejects client authority, oversized body, bad MIME/JSON and cross-site posts',async t=>{
  _reset();const s=await start(t);let calls=0;
  for(const key of ['owner','author','allowedKnowledge','operationId','question','stage']) {
    const r=await s.post('/api/dialogue',{...payload(),[key]:'forged'});assert.equal(r.status,400);
  }
  assert.equal((await s.post('/api/materials',{id:'x',type:'statement',text:'x',author:'player'})).status,400);
  assert.equal((await s.post('/api/shares',{eventId:'x',materialId:'x',recipients:['player']})).status,400);
  const raw=(body,type='application/json',extra={})=>fetch(s.root+'/api/dialogue',{method:'POST',headers:{cookie:s.cookie,'content-type':type,...extra},body});
  assert.equal((await raw('x'.repeat(40001))).status,413);assert.equal((await raw('{broken')).status,400);
  assert.equal((await raw('{}','application/json-evil')).status,415);assert.equal((await raw('{}','text/plain')).status,415);
  assert.equal((await raw('{}','application/json',{'sec-fetch-site':'cross-site'})).status,403);
  assert.deepEqual((await(await s.get('/api/history')).json()).items,[]);
});

test('runtime storage defaults to the project, accepts new path and legacy alias without a temporary directory',()=>{
  assert.equal(storagePathFromEnv({}),DEFAULT_STORAGE_PATH);assert.match(DEFAULT_STORAGE_PATH,/ai-dialogue\/\.data\/preview-store.json$/);
  assert.equal(storagePathFromEnv({RAVEN_DIALOGUE_STORAGE_PATH:'/new',RAVEN_STORE_FILE:'/old'}),'/new');
  assert.equal(storagePathFromEnv({RAVEN_STORE_FILE:'/old'}),'/old');
});
