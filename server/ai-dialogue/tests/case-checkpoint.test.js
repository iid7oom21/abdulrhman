import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createCipheriv, randomBytes} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {createPreviewServer} from '../src/server.js';
import {createCaseService} from '../src/case-service.js';
import {createCaseCheckpoint, MAX_CHECKPOINT_BYTES, MAX_CHECKPOINT_LENGTH, MAX_CHECKPOINT_BODY_BYTES} from '../src/case-checkpoint.js';
import {fixturePack, action} from './fixtures/case.js';

const KEY = 'ab'.repeat(32);
async function start(t, {pack = fixturePack(), key = KEY, limits} = {}) {
  let server;
  if (limits) {
    const service = createCaseService({pack,checkpointKey:key,...limits});
    server = http.createServer((req,res) => service.handle(req,res,new URL(req.url,'http://local'),(status,data) => {
      res.writeHead(status,{'content-type':'application/json'}); res.end(JSON.stringify(data));
    }));
  } else server = createPreviewServer({casePack:pack,caseCheckpointKey:key,generate() { throw new Error('No provider calls'); }});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let closed = false;
  const close = async () => { if (!closed) { closed = true; await new Promise(resolve => server.close(resolve)); } };
  t.after(close); return {root:'http://127.0.0.1:' + server.address().port,close};
}
async function request(s, target, {body,cookie,headers = {}} = {}) {
  const response = await fetch(s.root + '/api/case/' + target,{method:body === undefined ? 'GET' : 'POST',
    headers:{...(body === undefined ? {} : {'content-type':'application/json'}),...(cookie ? {cookie} : {}),...headers},
    ...(body === undefined ? {} : {body:JSON.stringify(body)})});
  return {status:response.status,headers:response.headers,data:await response.json()};
}
async function begin(s) {
  const response = await request(s,'start',{body:{contentVersion:'fixture-v1'}});
  assert.equal(response.status,200);
  return {...response,cookie:response.headers.get('set-cookie').split(';')[0]};
}
const act = (s,cookie,body) => request(s,'actions',{cookie,body});
const restore = (s,checkpoint,cookie,headers) => request(s,'restore',{body:{checkpoint},cookie,headers});

async function startProcess(t) {
  const script = `import {createPreviewServer} from ${JSON.stringify(new URL('../src/server.js',import.meta.url).href)};
    import {fixturePack} from ${JSON.stringify(new URL('./fixtures/case.js',import.meta.url).href)};
    const server = createPreviewServer({casePack:fixturePack(),caseCheckpointKey:process.env.CASE_FIXTURE_KEY});
    server.listen(0,'127.0.0.1',() => process.send({port:server.address().port}));`;
  const child = spawn(process.execPath,['--input-type=module','-e',script],{
    env:{...process.env,CASE_FIXTURE_KEY:KEY},stdio:['ignore','ignore','ignore','ipc'],
  });
  const close = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child,'exit'); child.kill('SIGTERM'); await exited;
  };
  t.after(close);
  const [message] = await Promise.race([once(child,'message'),once(child,'exit').then(() => { throw new Error('Fixture child exited before listening'); })]);
  return {root:'http://127.0.0.1:' + message.port,close};
}

test('checkpoint mode requires an exact key and cannot share a disk store', () => {
  for (const key of ['', 'ab', 'a'.repeat(63), 'g'.repeat(64), ' ' + KEY, KEY + '\n', Buffer.alloc(31), Buffer.alloc(33), new Uint8Array(32), 123]) {
    assert.throws(() => createCaseService({checkpointKey:key}), error => error.code === 'case_checkpoint_configuration_invalid');
  }
  for (const key of [KEY,KEY.toUpperCase(),Buffer.alloc(32)]) assert.doesNotThrow(() => createCaseService({checkpointKey:key}));
  assert.throws(() => createCaseService({checkpointKey:KEY,storagePath:'/unused'}), error => error.code === 'case_checkpoint_configuration_invalid');
  for (const limits of [{maxSessions:0},{maxSessions:Infinity},{maxOperations:0},{maxOperations:1.5}]) assert.throws(() => createCaseService({checkpointKey:KEY,...limits}), error => error.code === 'case_checkpoint_configuration_invalid');
});

test('AES-GCM tokens use fresh IVs and reject tampering, versions, key changes and decompression bombs', () => {
  const codec = createCaseCheckpoint(KEY), payload = {fixture:'earned-only'}, one = codec.seal(payload), two = codec.seal(payload);
  assert.notEqual(one,two); assert.deepEqual(codec.open(one),payload);
  for (const token of [one.replace('raven1.','raven2.'), one + '=', one.slice(0,-2), one.slice(0,20) + (one[20] === 'A' ? 'B' : 'A') + one.slice(21), '']) assert.throws(() => codec.open(token), error => error.code === 'checkpoint_invalid');
  assert.throws(() => createCaseCheckpoint('cd'.repeat(32)).open(one), error => error.code === 'checkpoint_invalid');
  assert.throws(() => codec.seal({text:'x'.repeat(MAX_CHECKPOINT_BYTES)}), error => error.code === 'checkpoint_too_large');
  assert.throws(() => codec.open('x'.repeat(MAX_CHECKPOINT_LENGTH + 1)), error => error.code === 'checkpoint_too_large');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm',Buffer.from(KEY,'hex'),iv);
  cipher.setAAD(Buffer.from('raven-case-checkpoint:v1'));
  const encrypted = Buffer.concat([cipher.update(deflateRawSync(Buffer.alloc(MAX_CHECKPOINT_BYTES + 1,32))),cipher.final()]);
  const bomb = 'raven1.' + Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
  assert.throws(() => codec.open(bomb), error => error.code === 'checkpoint_invalid');
});

test('checkpoint responses are unconfirmed browser recovery copies containing only current state and earned projection', async t => {
  const s = await start(t), config = await request(s,'config'), p = await begin(s);
  assert.equal(config.data.persistence,'browser-checkpoint');
  assert.equal(p.data.saveStatus,'browser-required'); assert.equal(p.data.persistence,'browser-checkpoint');
  assert.deepEqual(Object.keys(p.data.checkpointInfo).sort(),['caseId','contentVersion','historyTag','revision','sessionTag']);
  assert.match(p.data.checkpointInfo.sessionTag,/^[a-f0-9]{64}$/);
  assert.match(p.data.checkpointInfo.historyTag,/^[a-f0-9]{64}$/);
  assert.notEqual(p.data.checkpointInfo.sessionTag,p.cookie.split('=')[1]);
  assert.doesNotMatch(JSON.stringify(p.data),/UNSEEN_MATERIAL|FUTURE_SCENE|GATED_LINE|"flags"|"effects"|"target"|raven_case_session/);
  assert.equal(JSON.stringify(p.data).includes(p.cookie.split('=')[1]),false);
  assert.equal(JSON.stringify(p.data).includes(KEY),false);
  const payload = createCaseCheckpoint(KEY).open(p.data.checkpoint);
  assert.deepEqual(Object.keys(payload).sort(),['packFingerprint','schemaVersion','session']);
  assert.deepEqual(Object.keys(payload.session).sort(),['id','operations','state','view']);
  assert.doesNotMatch(JSON.stringify(payload),/UNSEEN_MATERIAL|FUTURE_SCENE|GATED_LINE|"scenes"|"effects"|"target"/);
  const reading = await request(s,'export',{cookie:p.cookie});
  assert.equal(reading.data.format,'raven-case-reading-export-v1');
  for (const key of ['checkpoint','checkpointInfo','actions','flags','operations','packFingerprint']) assert.equal(Object.hasOwn(reading.data,key),false);
  assert.equal((await request(s,'state',{cookie:'raven_case_session=' + p.data.checkpointInfo.sessionTag})).status,401);
});

test('a real restart restores earned receipts and exactly-once operation identity without rolling back live progress', async t => {
  const a = await start(t), p = await begin(a);
  await act(a,p.cookie,action(0,'read'));
  await act(a,p.cookie,action(1,'draft',{text:'Fixture draft',position:'unknown',sources:['card']}));
  const deposited = await act(a,p.cookie,action(2,'deposit'));
  assert.equal(deposited.data.revision,3); await a.close();
  const b = await start(t);
  assert.equal((await request(b,'state',{cookie:p.cookie})).status,401);
  const resumed = await restore(b,deposited.data.checkpoint,p.cookie);
  assert.equal(resumed.status,200); assert.equal(resumed.headers.get('set-cookie').split(';')[0],p.cookie);
  assert.deepEqual(resumed.data.checkpointInfo,deposited.data.checkpointInfo);
  assert.deepEqual(resumed.data.receipts,deposited.data.receipts);
  const replay = await act(b,p.cookie,action(2,'deposit'));
  assert.equal(replay.status,200); assert.equal(replay.data.replayed,true); assert.equal(replay.data.receipts.length,1);
  assert.deepEqual(replay.data.checkpointInfo,deposited.data.checkpointInfo);
  const sameState = await request(b,'state',{cookie:p.cookie});
  assert.deepEqual(sameState.data.checkpointInfo,replay.data.checkpointInfo);
  assert.notEqual(sameState.data.checkpoint,replay.data.checkpoint,'Fresh encryption must preserve the history tag');
  assert.equal((await act(b,p.cookie,action(2,'share'))).data.error,'request_id_conflict');
  assert.equal((await restore(b,p.data.checkpoint,p.cookie)).data.error,'checkpoint_stale');
  assert.equal((await act(b,p.cookie,action(3,'share'))).data.revision,4);
  assert.equal((await restore(b,deposited.data.checkpoint)).data.error,'checkpoint_stale');
  assert.equal((await request(b,'state',{cookie:p.cookie})).data.revision,4);
  const latest = await request(b,'state',{cookie:p.cookie});
  assert.equal((await restore(b,latest.data.checkpoint)).status,200);
  await b.close();
  const c = await start(t), noCookie = await restore(c,latest.data.checkpoint);
  assert.equal(noCookie.status,200); assert.equal(noCookie.headers.get('set-cookie').split(';')[0],p.cookie);
});

test('same-revision authenticated forks have distinct history tags even when their resulting state is identical', async t => {
  const first = await start(t), p = await begin(first);
  const acceptedA = await act(first,p.cookie,action(0,'read',{},'branch-a'));
  assert.equal(acceptedA.status,200);
  assert.notEqual(acceptedA.data.checkpointInfo.historyTag,p.data.checkpointInfo.historyTag);
  await first.close();
  // A lost browser save can leave another tab holding the preceding checkpoint.
  // A fresh service can legitimately resume that checkpoint and form a fork.
  const second = await start(t);
  assert.equal((await restore(second,p.data.checkpoint,p.cookie)).status,200);
  const acceptedB = await act(second,p.cookie,action(0,'read',{},'branch-b'));
  assert.equal(acceptedB.status,200);
  const infoA = acceptedA.data.checkpointInfo, infoB = acceptedB.data.checkpointInfo;
  assert.equal(infoA.sessionTag,infoB.sessionTag);
  assert.equal(infoA.caseId,infoB.caseId); assert.equal(infoA.contentVersion,infoB.contentVersion); assert.equal(infoA.revision,infoB.revision);
  assert.notEqual(infoA.historyTag,infoB.historyTag);
  const codec = createCaseCheckpoint(KEY);
  assert.deepEqual(codec.open(acceptedA.data.checkpoint).session.state,codec.open(acceptedB.data.checkpoint).session.state);
  assert.equal((await restore(second,acceptedA.data.checkpoint,p.cookie)).data.error,'checkpoint_session_conflict');
  const replayB = await act(second,p.cookie,action(0,'read',{},'branch-b'));
  assert.equal(replayB.data.replayed,true); assert.deepEqual(replayB.data.checkpointInfo,infoB);
  const stateB = await request(second,'state',{cookie:p.cookie});
  assert.deepEqual(stateB.data.checkpointInfo,infoB);
  const third = await start(t), restoredA = await restore(third,acceptedA.data.checkpoint,p.cookie);
  assert.equal(restoredA.status,200); assert.deepEqual(restoredA.data.checkpointInfo,infoA);
});

test('recovery survives replacement of the actual server process with no server-side files', async t => {
  const first = await startProcess(t), p = await begin(first), accepted = await act(first,p.cookie,action(0,'read'));
  await first.close();
  const second = await startProcess(t);
  assert.equal((await request(second,'state',{cookie:p.cookie})).status,401);
  const restored = await restore(second,accepted.data.checkpoint,p.cookie);
  assert.equal(restored.status,200); assert.equal(restored.data.revision,1);
  assert.deepEqual(restored.data.checkpointInfo,accepted.data.checkpointInfo);
  const replay = await act(second,p.cookie,action(0,'read'));
  assert.equal(replay.data.replayed,true); assert.equal(replay.data.materials.length,1);
  assert.equal((await act(second,p.cookie,action(0,'finish'))).data.error,'request_id_conflict');
});

test('restoration never mixes sessions, even when the other cookie is missing from server memory', async t => {
  const a = await start(t), one = await begin(a), two = await begin(a);
  assert.equal((await restore(a,one.data.checkpoint,two.cookie)).data.error,'checkpoint_session_conflict');
  assert.equal((await restore(a,one.data.checkpoint,'raven_case_session=malformed')).data.error,'checkpoint_session_conflict');
  assert.equal((await restore(a,one.data.checkpoint,one.cookie + '; ' + two.cookie)).data.error,'checkpoint_session_conflict');
  await a.close();
  const b = await start(t);
  assert.equal((await restore(b,one.data.checkpoint,two.cookie)).status,409);
  assert.equal((await request(b,'state',{cookie:one.cookie})).status,401);
});

test('same-version content edits reject restore; older versions expose only their stored earned reading copy', async t => {
  const a = await start(t), p = await begin(a), read = await act(a,p.cookie,action(0,'read'));
  await a.close();
  const changed = fixturePack(); changed.scenes.end.body.en = 'CHANGED_PRIVATE_FUTURE';
  const b = await start(t,{pack:changed});
  const mismatch = await restore(b,read.data.checkpoint,p.cookie);
  assert.equal(mismatch.status,409); assert.equal(mismatch.data.error,'content_version_mismatch');
  assert.equal((await request(b,'state',{cookie:p.cookie})).status,401);
  const newer = fixturePack('fixture-v2'); newer.scenes.desk.body.en = 'NEW_VERSION_PRIVATE';
  const c = await start(t,{pack:newer}), older = await restore(c,read.data.checkpoint,p.cookie);
  assert.equal(older.status,200); assert.equal(older.data.readOnly,true); assert.equal(older.data.contentVersionMismatch,true); assert.deepEqual(older.data.actions,[]);
  assert.equal(older.data.contentVersion,'fixture-v1'); assert.equal(older.data.materials[0].body.en,'PUBLIC_CARD_BODY');
  assert.doesNotMatch(JSON.stringify(older.data),/NEW_VERSION_PRIVATE|UNSEEN_MATERIAL|FUTURE_SCENE/);
  assert.equal((await act(c,p.cookie,{...action(1,'share'),contentVersion:'fixture-v2'})).data.error,'content_version_mismatch');
  const reading = await request(c,'export',{cookie:p.cookie});
  assert.equal(reading.data.revision,1); assert.equal(Object.hasOwn(reading.data,'checkpoint'),false);
  const d = await start(t,{pack:null});
  assert.equal((await restore(d,older.data.checkpoint,p.cookie)).data.readOnly,true);
  assert.equal((await request(d,'export',{cookie:p.cookie})).data.materials.length,1);
});

test('wrong keys and authenticated but malformed, forged or incomplete sessions fail closed', async t => {
  const a = await start(t), p = await begin(a), read = await act(a,p.cookie,action(0,'read'));
  const wrongKey = await start(t,{key:'cd'.repeat(32)});
  assert.deepEqual((await restore(wrongKey,read.data.checkpoint,p.cookie)).data,{error:'checkpoint_invalid'});
  assert.equal((await request(wrongKey,'state',{cookie:p.cookie})).status,401);
  const b = await start(t), codec = createCaseCheckpoint(KEY), original = codec.open(read.data.checkpoint);
  for (const mutate of [
    value => { value.pack = fixturePack(); },
    value => { value.schemaVersion = 2; },
    value => { value.session.state.flags.forged = true; },
    value => { value.session.operations = []; },
    value => { value.session.operations[0].fingerprint = '0'.repeat(64); },
    value => { value.session.view.materials[0].body.en = 'FORGED'; },
    value => { value.session.view.hidden = 'PRIVATE'; },
  ]) {
    const invalid = structuredClone(original); mutate(invalid);
    const result = await restore(b,codec.seal(invalid),p.cookie);
    assert.equal(result.status,400); assert.deepEqual(result.data,{error:'checkpoint_invalid'});
  }
  assert.equal((await request(b,'state',{cookie:p.cookie})).status,401);
});

test('restore alone permits a large bounded JSON body and retains same-origin enforcement', async t => {
  const pack = fixturePack(); pack.initialMaterials = ['card'];
  pack.materials.card.body = {ar:randomBytes(30000).toString('base64'),en:randomBytes(30000).toString('base64')};
  const a = await start(t,{pack}), p = await begin(a);
  assert.ok(p.data.checkpoint.length > 65536); await a.close();
  const b = await start(t,{pack});
  assert.equal((await restore(b,p.data.checkpoint,p.cookie,{'content-type':'text/plain'})).status,415);
  assert.equal((await restore(b,p.data.checkpoint,p.cookie,{origin:'https://elsewhere.invalid'})).status,403);
  assert.equal((await restore(b,p.data.checkpoint,p.cookie,{'sec-fetch-site':'cross-site'})).status,403);
  assert.equal((await restore(b,p.data.checkpoint,p.cookie,{origin:b.root})).status,200);
  assert.equal((await act(b,p.cookie,action(0,'read',{text:'x'.repeat(65536)}))).status,413);
  assert.equal((await restore(b,'x'.repeat(MAX_CHECKPOINT_LENGTH + 1),p.cookie)).data.error,'checkpoint_too_large');
  assert.equal((await restore(b,'x'.repeat(MAX_CHECKPOINT_BODY_BYTES),p.cookie)).data.error,'body_too_large');
});

test('browser sessions evict recoverably at 128 and operation limits retain exact replay', async t => {
  const s = await start(t,{limits:{maxSessions:1000,maxOperations:2}}), first = await begin(s);
  for (let index = 0; index < 128; index++) await begin(s);
  assert.equal((await request(s,'state',{cookie:first.cookie})).status,401);
  assert.equal((await restore(s,first.data.checkpoint,first.cookie)).status,200);
  assert.equal((await act(s,first.cookie,action(0,'read'))).status,200);
  assert.equal((await act(s,first.cookie,action(1,'share'))).status,200);
  const full = await act(s,first.cookie,action(2,'share'));
  assert.equal(full.status,409); assert.equal(full.data.error,'operations_limit');
  assert.equal((await act(s,first.cookie,action(1,'share'))).data.replayed,true);
  assert.equal((await request(s,'state',{cookie:first.cookie})).data.revision,2);
});

test('an action that cannot fit its recovery token is never acknowledged or committed', async t => {
  const pack = fixturePack(), locales = ['ar','en','fr','de','es','it','pt','nl'];
  pack.locales = locales;
  const text = Object.fromEntries(locales.map(locale => [locale,'x'.repeat(40000)]));
  for (let index = 0; index < 5; index++) pack.materials['large' + index] = {title:text,body:text,source:text,type:'document'};
  pack.scenes.desk.actions[0].effects.grant = Array.from({length:5},(_,index) => 'large' + index);
  const s = await start(t,{pack}), p = await begin(s), failed = await act(s,p.cookie,action(0,'read'));
  assert.equal(failed.status,413); assert.equal(failed.data.error,'checkpoint_too_large');
  const state = await request(s,'state',{cookie:p.cookie});
  assert.equal(state.data.revision,0); assert.deepEqual(state.data.materials,[]);
  assert.equal((await act(s,p.cookie,action(0,'read'))).status,413);
});
