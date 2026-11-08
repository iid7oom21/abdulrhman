import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createPreviewServer} from '../src/server.js';
import {loadCaseContent} from '../src/case-service.js';
import {openCaseStore} from '../src/case-store.js';
import {fixturePack,action} from './fixtures/case.js';

function directory(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'raven-case-http-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true})); return root;
}
async function start(t, options = {}) {
  const server = createPreviewServer({generate:() => { throw new Error('Written case must not call a provider'); },...options});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let closed = false;
  const close = async () => { if (!closed) { closed = true; await new Promise(resolve => server.close(resolve)); } };
  t.after(close); return {root:'http://127.0.0.1:' + server.address().port,close};
}
async function request(s, target, {body,cookie,headers = {},method = body === undefined ? 'GET' : 'POST'} = {}) {
  const response = await fetch(s.root + target,{method,headers:{...(body === undefined ? {} : {'content-type':'application/json'}),...(cookie ? {cookie} : {}),...headers},...(body === undefined ? {} : {body:JSON.stringify(body)})});
  return {status:response.status,headers:response.headers,data:await response.json()};
}
async function begin(s, opening) {
  const response = await request(s,'/api/case/start',{body:{contentVersion:'fixture-v1',...(opening ? {opening} : {})}});
  assert.equal(response.status,200);
  return {...response,cookie:response.headers.get('set-cookie').split(';')[0]};
}
const act = (s,cookie,body) => request(s,'/api/case/actions',{cookie,body});

test('case config is opt-in and read-only; its durable anonymous cookie is independent of evicted preview sessions', async t => {
  const disabled = await start(t);
  const config = await request(disabled,'/api/case/config');
  assert.deepEqual(config.data,{enabled:false,scope:'written-story',persistence:'process-memory'});
  assert.equal(config.headers.get('set-cookie'),null);
  assert.equal((await request(disabled,'/api/case/start',{body:{contentVersion:'fixture-v1'}})).status,503);
  const s = await start(t,{casePack:fixturePack(),maxSessions:1,sessionIdleMs:1});
  assert.equal((await request(s,'/api/case/config')).headers.get('set-cookie'),null);
  const player = await begin(s);
  assert.match(player.headers.get('set-cookie'),/^raven_case_session=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=\/; Max-Age=31536000/);
  assert.equal(player.headers.get('cache-control'),'no-store'); assert.equal(player.headers.get('x-frame-options'),'DENY');
  assert.match(player.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal(player.data.saveStatus,'memory');
  for (let n=0;n<4;n++) await (await fetch(s.root)).text();
  assert.equal((await request(s,'/api/case/state',{cookie:player.cookie})).status,200);
  const previewCookie = (await fetch(s.root)).headers.get('set-cookie').split(';')[0];
  assert.equal((await request(s,'/api/case/state',{cookie:previewCookie})).status,401);
  assert.equal((await request(s,'/api/history',{cookie:player.cookie})).status,401);
});

test('same-origin JSON enforcement, body size, forged fields and other sessions cannot mutate case state', async t => {
  const s = await start(t,{casePack:fixturePack()}), one = await begin(s), two = await begin(s);
  const extra = {...action(0,'read'),flags:{read:true},target:'end'};
  assert.equal((await act(s,one.cookie,extra)).status,400);
  assert.equal((await request(s,'/api/case/actions',{cookie:one.cookie,body:action(0,'read'),headers:{origin:'https://elsewhere.invalid'}})).status,403);
  assert.equal((await request(s,'/api/case/actions',{cookie:one.cookie,body:action(0,'read'),headers:{'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal((await request(s,'/api/case/actions',{cookie:one.cookie,body:action(0,'read'),headers:{'content-type':'text/plain'}})).status,415);
  assert.equal((await act(s,one.cookie,action(0,'read',{unused:'x'.repeat(70000)}))).status,413);
  const read = await act(s,one.cookie,action(0,'read')); assert.equal(read.status,200);
  assert.equal(read.data.revision,1);
  const other = await request(s,'/api/case/state',{cookie:two.cookie});
  assert.equal(other.data.revision,0); assert.deepEqual(other.data.materials,[]);
  assert.equal((await request(s,'/api/case/export')).status,401);
  const exportOne = await request(s,'/api/case/export',{cookie:one.cookie});
  assert.equal(exportOne.data.scope,'reading-copy-not-an-import');
  assert.equal(exportOne.data.format,'raven-case-reading-export-v1');
  assert.doesNotMatch(JSON.stringify(exportOne.data),/UNSEEN_MATERIAL|FUTURE_SCENE|operations|fingerprint|raven_case_session|"flags"|"effects"|"target"|"actions"/);
});

// Delay completion of body B until request A has committed. This exercises the
// session reference captured before await, not just Promise scheduling luck.
async function delayedAction(s,cookie,body) {
  let finish;
  const response = new Promise((resolve,reject) => {
    const bytes = JSON.stringify(body);
    const req = http.request(s.root + '/api/case/actions',{method:'POST',headers:{cookie,'content-type':'application/json','content-length':Buffer.byteLength(bytes)}},res => {
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks))}));
    });
    req.on('error',reject); req.write(bytes.slice(0,1)); finish=()=>req.end(bytes.slice(1));
  });
  await new Promise(resolve => setImmediate(resolve));
  return {finish,response};
}

test('actions serialize after body reads; same ID replays current view and changed/stale operations never overwrite', async t => {
  const s = await start(t,{casePack:fixturePack()}), p = await begin(s);
  const waiting = await delayedAction(s,p.cookie,action(0,'read',{},'different-id'));
  assert.equal((await act(s,p.cookie,action(0,'read'))).status,200);
  waiting.finish(); assert.equal((await waiting.response).status,409);
  const duplicate = await delayedAction(s,p.cookie,action(1,'share'));
  assert.equal((await act(s,p.cookie,action(1,'share'))).data.replayed,false);
  duplicate.finish(); const replay = await duplicate.response;
  assert.equal(replay.status,200); assert.equal(replay.data.replayed,true); assert.equal(replay.data.shares.length,1);
  assert.equal((await act(s,p.cookie,action(0,'finish'))).data.error,'request_id_conflict');
  assert.equal((await act(s,p.cookie,action(1,'share',{},'stale-new-id'))).data.error,'revision_conflict');
  const olderReplay = await act(s,p.cookie,action(0,'read'));
  assert.equal(olderReplay.data.revision,2); assert.equal(olderReplay.data.replayed,true);
  const resume = await request(s,'/api/case/start',{cookie:p.cookie,body:{contentVersion:'fixture-v1',opening:{version:'paper-opening-2026-11-05-r2',choice:'refuse',recipient:null}}});
  assert.equal(resume.data.revision,2); assert.equal(resume.data.opening,null); assert.equal(resume.headers.get('set-cookie'),null);
});

test('file-backed session and receipt replay survive restart; wrong-version state stays readable without new story projection', async t => {
  const dir = directory(t), store = path.join(dir,'case-store.json');
  const a = await start(t,{casePack:fixturePack(),caseStoragePath:store}), p = await begin(a);
  const send = body => act(a,p.cookie,body);
  assert.equal((await send(action(0,'read'))).status,200);
  const draft = {text:'First draft',position:'unknown',sources:['card']};
  assert.equal((await send(action(1,'draft',draft))).status,200);
  const deposited = await send(action(2,'deposit'));
  assert.equal(deposited.data.saveStatus,'confirmed'); assert.equal(deposited.data.receipts.length,1);
  await a.close();
  const b = await start(t,{casePack:fixturePack(),caseStoragePath:store});
  const replay = await act(b,p.cookie,action(2,'deposit'));
  assert.equal(replay.status,200); assert.equal(replay.data.replayed,true); assert.deepEqual(replay.data.receipts,deposited.data.receipts);
  assert.equal(replay.data.captures.summary.fields[1].options[0].label.en,'Not known');
  await b.close();
  const pack2 = fixturePack('fixture-v2');pack2.scenes.desk.body.en='NEW_VERSION_PRIVATE_SENTINEL';
  const c = await start(t,{casePack:pack2,caseStoragePath:store});
  const state = await request(c,'/api/case/state',{cookie:p.cookie});
  assert.equal(state.status,200);assert.equal(state.data.readOnly,true);assert.equal(state.data.contentVersionMismatch,true);assert.deepEqual(state.data.actions,[]);
  assert.equal(state.data.contentVersion,'fixture-v1');assert.doesNotMatch(JSON.stringify(state.data),/NEW_VERSION_PRIVATE_SENTINEL/);
  assert.equal((await act(c,p.cookie,{...action(3,'share'),contentVersion:'fixture-v2'})).data.error,'content_version_mismatch');
  assert.equal((await request(c,'/api/case/export',{cookie:p.cookie})).data.captures.summary.values.text,'First draft');
  await c.close();
  const disabled = await start(t,{caseStoragePath:store});
  assert.equal((await request(disabled,'/api/case/config')).data.enabled,false);
  assert.equal((await request(disabled,'/api/case/export',{cookie:p.cookie})).data.receipts.length,1);
});

test('storage failure never acknowledges an action; ambiguous post-rename failure freezes writes until restart and replays once', async t => {
  const dir = directory(t), store = path.join(dir,'case-store.json'); let failAfterCommit = false;
  const hook = (file,options) => {
    const disk = openCaseStore(file,options);
    return {load:disk.load,save(payload) { disk.save(payload); if(failAfterCommit) throw new Error('PRIVATE_PATH_MUST_NOT_LEAK'); }};
  };
  const a = await start(t,{casePack:fixturePack(),caseStoragePath:store,openCaseStore:hook}), p=await begin(a);
  failAfterCommit=true;
  const failed = await act(a,p.cookie,action(0,'read'));
  assert.equal(failed.status,503); assert.deepEqual(failed.data,{error:'storage_unavailable'});
  const uncertain = await request(a,'/api/case/state',{cookie:p.cookie});
  assert.equal(uncertain.data.revision,0); assert.equal(uncertain.data.saveStatus,'unconfirmed');
  assert.equal(uncertain.data.readOnly,true); assert.equal(uncertain.data.storageUnavailable,true); assert.deepEqual(uncertain.data.actions,[]);
  assert.equal((await act(a,p.cookie,action(0,'read'))).status,503);
  await a.close();
  const b = await start(t,{casePack:fixturePack(),caseStoragePath:store});
  const recovered = await act(b,p.cookie,action(0,'read'));
  assert.equal(recovered.status,200);assert.equal(recovered.data.replayed,true);assert.equal(recovered.data.revision,1);assert.equal(recovered.data.saveStatus,'confirmed');
  await b.close();
  const beforeFailure = fs.readFileSync(store);
  const c=await start(t,{casePack:fixturePack(),caseStoragePath:store,openCaseStore:(file,options)=>({load:openCaseStore(file,options).load,save(){throw new Error('disk unavailable');}})});
  assert.equal((await act(c,p.cookie,action(1,'share'))).status,503);
  assert.deepEqual(fs.readFileSync(store),beforeFailure);
  assert.equal((await request(c,'/api/case/export',{cookie:p.cookie})).data.revision,1);
});

test('corrupt or forged current-version snapshots fail closed and preserve exact bytes', async t => {
  const dir=directory(t),store=path.join(dir,'case-store.json');
  const a=await start(t,{casePack:fixturePack(),caseStoragePath:store}), p=await begin(a);
  await act(a,p.cookie,action(0,'read'));await a.close();
  const valid=fs.readFileSync(store),snapshot=JSON.parse(valid);
  snapshot.payload.sessions[0].state.flags.forged=true;
  for(const bytes of [Buffer.from('{damaged'),Buffer.from(JSON.stringify(snapshot))]) {
    fs.writeFileSync(store,bytes);
    assert.throws(()=>createPreviewServer({casePack:fixturePack(),caseStoragePath:store}),error=>error.code==='case_store_invalid');
    assert.deepEqual(fs.readFileSync(store),bytes);
  }
});

test('a second service cannot overwrite progress committed since its initial load', async t => {
  const dir=directory(t),store=path.join(dir,'case-store.json');
  const one=await start(t,{casePack:fixturePack(),caseStoragePath:store});
  const two=await start(t,{casePack:fixturePack(),caseStoragePath:store});
  const p=await begin(one),bytes=fs.readFileSync(store);
  const conflicting=await request(two,'/api/case/start',{body:{contentVersion:'fixture-v1'}});
  assert.equal(conflicting.status,503);assert.equal(conflicting.data.error,'storage_unavailable');
  assert.equal(conflicting.headers.get('set-cookie'),null);assert.deepEqual(fs.readFileSync(store),bytes);
  await one.close();await two.close();
  const reopened=await start(t,{casePack:fixturePack(),caseStoragePath:store});
  assert.equal((await request(reopened,'/api/case/state',{cookie:p.cookie})).status,200);
});

test('private content loads outside Git/public roots only and public responses reveal no private path', async t => {
  const dir=directory(t),file=path.join(dir,'private-pack.json');fs.writeFileSync(file,JSON.stringify(fixturePack()));
  assert.equal(loadCaseContent(file).caseId,'fixture');
  assert.throws(()=>loadCaseContent(file,{siteRoot:dir}),error=>error.code==='case_content_invalid');
  const link=path.join(dir,'linked.json');fs.symlinkSync(file,link);
  assert.throws(()=>loadCaseContent(link),error=>error.code==='case_content_invalid');
  fs.mkdirSync(path.join(dir,'.git'));
  assert.throws(()=>loadCaseContent(file),error=>error.code==='case_content_invalid');
  fs.rmSync(path.join(dir,'.git'),{recursive:true});
  const s=await start(t,{caseContentPath:file});
  const p=await begin(s);assert.doesNotMatch(JSON.stringify(p.data),new RegExp(dir));
  const invalid=await request(s,'/api/case/start',{body:{contentVersion:'fixture-v1',opening:{version:'paper-opening-2026-11-05-r2',choice:'wait',recipient:'both'}}});
  assert.equal(invalid.status,400);
});
