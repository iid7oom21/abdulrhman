import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { createCaseDialogueAdapter, ADAPTER_SCOPE } from '../src/case-dialogue-adapter.js';
import { createCaseService } from '../src/case-service.js';
import { createPreviewServer } from '../src/server.js';
import { applyCaseAction, createCaseState } from '../src/case-engine.js';
import { fixturePack, L, action } from './fixtures/case.js';

// Synthetic mechanics only: no actor, statement or policy here is RAVEN canon.
const SESSION = 'a'.repeat(64), OTHER = 'b'.repeat(64);
function setup({policy:withPolicy = true} = {}) {
  const pack = fixturePack();
  pack.initialFlags.allowReceived = true;
  pack.initialFlags.revealSealed = false;
  const policy = {schemaVersion:1, caseId:pack.caseId, contentVersion:pack.contentVersion, policyVersion:'adapter-fixture-v1', actors:{
    guide:{name:L('Fixture guide'), voiceStyle:L('Fixture plain style'), knowledge:[{materialId:'sealed', requires:{flag:'revealSealed', equals:true}}], receivedRequires:{flag:'allowReceived', equals:true}},
    witness:{name:L('Fixture witness'), voiceStyle:L('Fixture brief style'), knowledge:[]},
  }};
  const sessions = new Map([[SESSION, {state:createCaseState(pack)}]]);
  const calls = [];
  let provider = input => { calls.push(input); return {action:'quote_materials', materialIds:input.sources.map(item => item.id)}; };
  const adapter = createCaseDialogueAdapter({pack, policy:withPolicy ? policy : null, timeoutMs:200,
    readCaseSession:id => sessions.get(id) ? {state:structuredClone(sessions.get(id).state)} : null,
    selectSources:(input, options) => provider(input, options)});
  const advance = (...ids) => { let state = sessions.get(SESSION).state; ids.forEach(id => { state = applyCaseAction(pack, state, action(state.revision, id)); }); sessions.get(SESSION).state = state; return state; };
  return {pack, policy, sessions, calls, adapter, advance, setProvider:fn => { provider = fn; }};
}
const ask = (adapter, extra = {}) => adapter.ask({sessionId:SESSION, requestId:'q-1', actorId:'guide', message:'What do you know about the card?', revision:0, contentVersion:'fixture-v1', ...extra});

test('the adapter is local only: the production server neither imports it nor exposes a route', async t => {
  assert.equal(ADAPTER_SCOPE, 'local-only-not-wired');
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /case-dialogue-adapter/);
  const server = createPreviewServer({casePack:fixturePack(), generate:() => { throw new Error('no provider'); }});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/case/dialogue`, {method:'POST', headers:{'content-type':'application/json'}, body:'{}'});
  assert.equal(response.status, 401); // case routes require a case session; no dialogue handler exists
  assert.deepEqual(await response.json(), {error:'session_unavailable'});
});

test('the engine decides sources before context: nothing earned or delivered means no provider call', async () => {
  const {adapter, calls} = setup();
  const result = await ask(adapter);
  assert.equal(result.status, 'unavailable'); assert.equal(result.reason, 'no_disclosable_sources');
  assert.deepEqual(result.quotes, []); assert.equal(calls.length, 0);
});

test('only delivered sources and disclosed own knowledge reach the provider; never the session, flags or withheld text', async () => {
  const {adapter, calls, advance} = setup();
  advance('read', 'share');
  const result = await ask(adapter, {revision:2});
  assert.equal(result.status, 'answered');
  assert.deepEqual(result.quotes.map(item => [item.materialId, item.origin, item.epistemicStatus]), [['card', 'received', 'attributed-source']]);
  const input = JSON.stringify(calls[0]);
  assert.doesNotMatch(input, new RegExp(SESSION)); assert.doesNotMatch(input, /UNSEEN_MATERIAL_SENTINEL|GATED_LINE_SENTINEL|"flags"|"captures"|"receipts"|"notes"|cacheKey|revealSealed/);
  assert.deepEqual(calls[0].sources.map(item => item.id), ['card']);
});

test('knowledge is not disclosure: a gated personal source is a count, then becomes a quotable source once disclosed', async () => {
  const {adapter, calls, advance, sessions, pack} = setup();
  advance('read', 'share');
  await ask(adapter, {revision:2});
  assert.deepEqual(calls[0].disclosure, {withheldCount:1, rule:'withheld-knowledge-is-not-ignorance'});
  sessions.get(SESSION).state = {...sessions.get(SESSION).state, flags:{...sessions.get(SESSION).state.flags, revealSealed:true}};
  const disclosed = await ask(adapter, {requestId:'q-2', revision:2});
  assert.equal(calls[1].disclosure.withheldCount, 0);
  assert.deepEqual(disclosed.quotes.map(item => [item.materialId, item.origin]), [['sealed', 'own'], ['card', 'received']]);
  assert.equal(disclosed.quotes[0].body, pack.materials.sealed.body.ar);
});

test('a missing policy or actor entry is an explicit system reason, never a character denying their life', async () => {
  const missing = setup({policy:false});
  missing.advance('read', 'share');
  assert.deepEqual(await ask(missing.adapter, {revision:2}), {requestId:'q-1', actorId:'guide', contentVersion:'fixture-v1', revision:2, status:'unavailable', reason:'author_policy_missing', quotes:[], replayed:false});
  const {adapter, calls, advance} = setup();
  advance('read', 'share');
  assert.equal((await ask(adapter, {revision:2, actorId:'nobody'})).reason, 'actor_policy_missing');
  const witness = await ask(adapter, {revision:2, actorId:'witness', requestId:'q-3'});
  assert.equal(witness.reason, 'actor_has_no_authored_knowledge');
  for (const result of [witness]) assert.equal(Object.hasOwn(result, 'text'), false);
  assert.equal(missing.calls.length + calls.length, 0);
});

test('model output can only select engine-owned IDs; text, grants, receipts or unseen IDs are invalid and change nothing', async () => {
  const {adapter, setProvider, advance, sessions} = setup();
  advance('read', 'share');
  const before = structuredClone(sessions.get(SESSION).state);
  const attempts = [
    {action:'quote_materials', materialIds:['card'], text:'I confess.'},
    {action:'quote_materials', materialIds:['card'], grant:['sealed']},
    {action:'file_report', materialIds:[]},
    {action:'quote_materials', materialIds:['sealed']},
    {action:'quote_materials', materialIds:['card', 'card']},
    'plain text reply',
  ];
  for (const [index, reply] of attempts.entries()) {
    setProvider(() => reply);
    const result = await ask(adapter, {revision:2, requestId:'bad-' + index});
    assert.deepEqual([result.status, result.error], ['error', 'provider_invalid_output']);
  }
  assert.deepEqual(sessions.get(SESSION).state, before);
});

test('provider failure leaves state intact with a closed error, and the same request is never generated twice', async () => {
  const {adapter, setProvider, advance, sessions} = setup();
  advance('read', 'share');
  const before = structuredClone(sessions.get(SESSION).state);
  let attempts = 0;
  setProvider(() => { attempts++; const error = new Error('HTTP 429 secret-key-ABC'); error.code = 'provider_rejected'; throw error; });
  assert.deepEqual(await ask(adapter, {revision:2}), {requestId:'q-1', actorId:'guide', contentVersion:'fixture-v1', revision:2, status:'error', error:'provider_rejected', replayed:false});
  setProvider(() => { attempts++; throw new Error('socket reset after send'); });
  const unknown = await ask(adapter, {revision:2, requestId:'q-2'});
  assert.deepEqual([unknown.error, unknown.outcomeUnknown], ['provider_unavailable', true]);
  setProvider(() => { attempts++; return new Promise(() => {}); });
  const timedOut = await ask(adapter, {revision:2, requestId:'q-3'});
  assert.deepEqual([timedOut.error, timedOut.outcomeUnknown], ['provider_unavailable', true]);
  const replay = await ask(adapter, {revision:2, requestId:'q-2'});
  assert.deepEqual([replay.error, replay.replayed], ['provider_unavailable', true]);
  assert.equal(attempts, 3);
  assert.doesNotMatch(JSON.stringify([unknown, timedOut]), /secret-key|socket/);
  assert.deepEqual(sessions.get(SESSION).state, before);
});

test('duplicate request IDs replay without a second call; changed content conflicts; one question per character at a time', async () => {
  const {adapter, calls, setProvider, advance} = setup();
  advance('read', 'share');
  const first = await ask(adapter, {revision:2});
  const again = await ask(adapter, {revision:2});
  assert.equal(calls.length, 1); assert.equal(again.replayed, true); assert.deepEqual({...again, replayed:false}, first);
  assert.equal((await ask(adapter, {revision:2, message:'Different question'})).error, 'request_id_conflict');
  let release;
  setProvider(input => new Promise(resolve => { release = () => resolve({action:'clarify', materialIds:[input.sources[0].id]}); }));
  const pending = ask(adapter, {revision:2, requestId:'slow'});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await ask(adapter, {revision:2, requestId:'other'})).error, 'character_busy');
  release();
  assert.equal((await pending).status, 'clarify');
});

test('stale revision, wrong content version, unknown session and unearned presented material fail before any call', async () => {
  const {adapter, calls, advance} = setup();
  advance('read', 'share');
  assert.deepEqual([(await ask(adapter, {revision:1})).error, (await ask(adapter, {revision:1, requestId:'q-x'})).revision], ['revision_conflict', 2]);
  assert.equal((await ask(adapter, {revision:2, requestId:'v', contentVersion:'fixture-v0'})).error, 'content_version_mismatch');
  assert.equal((await adapter.ask({sessionId:OTHER, requestId:'s', actorId:'guide', message:'Hi', revision:0, contentVersion:'fixture-v1'})).error, 'session_unavailable');
  assert.equal((await adapter.ask({sessionId:'not-a-session', requestId:'s', actorId:'guide', message:'Hi', revision:0, contentVersion:'fixture-v1'})).error, 'invalid_request');
  assert.equal((await ask(adapter, {revision:2, requestId:'p', presentedMaterialIds:['sealed']})).error, 'material_unavailable');
  assert.equal((await ask(adapter, {revision:2, requestId:'extra', facts:['client says guilty']})).error, 'invalid_request');
  assert.equal(calls.length, 0);
});

test('real case service: the adapter reads a copy of trusted session state and never advances it', async t => {
  const pack = fixturePack();
  pack.initialFlags.allowReceived = true; pack.initialFlags.revealSealed = false;
  const service = createCaseService({pack});
  const server = http.createServer(async (req, res) => {
    const json = (status, body) => { res.writeHead(status, {'content-type':'application/json'}); res.end(JSON.stringify(body)); };
    if (!await service.handle(req, res, new URL(req.url, 'http://local'), json)) json(404, {error:'not_found'});
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const root = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, body, cookie) => {
    const response = await fetch(root + path, {method:body ? 'POST' : 'GET', headers:{...(body ? {'content-type':'application/json'} : {}), ...(cookie ? {cookie} : {})}, ...(body ? {body:JSON.stringify(body)} : {})});
    return {cookie:response.headers.get('set-cookie')?.split(';')[0], data:await response.json()};
  };
  const started = await call('/api/case/start', {contentVersion:'fixture-v1'});
  const cookie = started.cookie, sessionId = cookie.split('=')[1];
  await call('/api/case/actions', action(0, 'read'), cookie);
  await call('/api/case/actions', action(1, 'share'), cookie);
  const copy = service.readSessionState(sessionId);
  assert.equal(copy.state.revision, 2);
  copy.state.materialIds.push('sealed'); copy.state.revision = 99;
  assert.equal(service.readSessionState(sessionId).state.revision, 2);
  assert.deepEqual(service.readSessionState(sessionId).state.materialIds, ['card']);
  for (const id of ['', 'c'.repeat(64), sessionId.toUpperCase(), undefined]) assert.equal(service.readSessionState(id), null);
  const policy = {schemaVersion:1, caseId:pack.caseId, contentVersion:pack.contentVersion, policyVersion:'adapter-fixture-v1', actors:{
    guide:{name:L('Fixture guide'), voiceStyle:L('Fixture plain style'), knowledge:[], receivedRequires:{flag:'allowReceived', equals:true}}}};
  const adapter = createCaseDialogueAdapter({pack, policy, readCaseSession:id => service.readSessionState(id),
    selectSources:input => ({action:'quote_materials', materialIds:input.sources.map(item => item.id)})});
  const result = await adapter.ask({sessionId, requestId:'live-1', actorId:'guide', message:'Which card did I give you?', revision:2, contentVersion:'fixture-v1'});
  assert.deepEqual(result.quotes.map(item => item.materialId), ['card']);
  const after = await call('/api/case/state', undefined, cookie);
  assert.equal(after.data.revision, 2); assert.deepEqual(after.data.receipts, []); assert.deepEqual(after.data.shares.map(share => share.materialId), ['card']);
});
