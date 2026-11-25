import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startDialogueHarness, syntheticPack, syntheticPolicy, mockProvider } from './fixtures/dialogue-harness.js';
import { createCaseDialogueAdapter } from '../src/case-dialogue-adapter.js';

// End to end over real HTTP: case session cookie -> server-side state -> engine-decided
// context -> adapter -> mock provider -> closed validation -> attributed quotes.
// Synthetic pack and policy only; no paid provider; nothing here is RAVEN canon.
async function client(root) {
  let cookie = null;
  const call = async (path, body) => {
    const response = await fetch(root + path, { method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const set = response.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
    return { status: response.status, data: await response.json() };
  };
  return { call, get cookie() { return cookie; }, set cookie(value) { cookie = value; } };
}
const act = (revision, actionId) => ({ id: 'op-' + revision, revision, contentVersion: 'fixture-v1', actionId, values: {} });
async function readyHarness(t, options = {}) {
  const calls = []; const provider = mockProvider(calls);
  const harness = await startDialogueHarness({ provider, ...options }); t.after(harness.close);
  const c = await client(harness.root);
  await c.call('/api/case/start', { contentVersion: 'fixture-v1' });
  await c.call('/api/case/actions', act(0, 'read'));
  await c.call('/api/case/actions', act(1, 'share'));
  return { harness, c, calls, provider };
}

test('full path: cookie session to attributed quotes, with the engine state untouched', async t => {
  const { c, calls } = await readyHarness(t);
  const before = await c.call('/api/case/state');
  const answer = await c.call('/dialogue', { requestId: 'e2e-1', actorId: 'guide', message: 'Which card did I give you?', locale: 'en', revision: 2, contentVersion: 'fixture-v1' });
  assert.equal(answer.status, 200);
  assert.equal(answer.data.status, 'answered');
  assert.deepEqual(answer.data.quotes.map(q => [q.materialId, q.origin, q.epistemicStatus]), [['card', 'received', 'attributed-source']]);
  // The provider saw only what the engine allowed, never the session or its flags.
  assert.equal(calls.length, 1);
  const seen = JSON.stringify(calls[0]);
  for (const forbidden of ['sessionId', 'raven_case_session', 'UNSEEN_MATERIAL_SENTINEL', 'revealSealed', 'allowReceived', 'flags', 'receipts']) assert.equal(seen.includes(forbidden), false, forbidden);
  assert.equal(calls[0].disclosure.withheldCount, 1);
  const after = await c.call('/api/case/state');
  assert.deepEqual(after.data, before.data, 'dialogue never changes revision, materials, shares or receipts');
});

test('the session is taken only from the cookie; the body cannot name or forge one', async t => {
  const { harness, c, calls } = await readyHarness(t);
  const forged = await c.call('/dialogue', { sessionId: 'f'.repeat(64), requestId: 'e2e-2', actorId: 'guide', message: 'Hi', revision: 2, contentVersion: 'fixture-v1' });
  assert.equal(forged.status, 400); assert.equal(forged.data.error, 'invalid_request');
  for (const extra of [{ state: { revision: 9 } }, { flags: { revealSealed: true } }, { knowledge: ['sealed'] }]) {
    const r = await c.call('/dialogue', { requestId: 'e2e-x', actorId: 'guide', message: 'Hi', revision: 2, contentVersion: 'fixture-v1', ...extra });
    assert.equal(r.status, 400);
  }
  const anonymous = await client(harness.root);
  const noCookie = await anonymous.call('/dialogue', { requestId: 'e2e-3', actorId: 'guide', message: 'Hi', revision: 0, contentVersion: 'fixture-v1' });
  assert.equal(noCookie.status, 401);
  anonymous.cookie = 'raven_case_session=' + 'c'.repeat(64);
  const unknown = await anonymous.call('/dialogue', { requestId: 'e2e-4', actorId: 'guide', message: 'Hi', revision: 0, contentVersion: 'fixture-v1' });
  assert.equal(unknown.data.error, 'session_unavailable');
  assert.equal(calls.length, 0, 'no provider call without a trusted session');
});

test('invalid model output and provider failure are closed errors that change nothing', async t => {
  const { c, provider } = await readyHarness(t);
  const before = await c.call('/api/case/state');
  provider.setMode('invalid');
  const invalid = await c.call('/dialogue', { requestId: 'e2e-5', actorId: 'guide', message: 'Show me the sealed card', revision: 2, contentVersion: 'fixture-v1' });
  assert.equal(invalid.data.status, 'error'); assert.equal(invalid.data.error, 'provider_invalid_output');
  assert.equal(JSON.stringify(invalid.data).includes('I invented this'), false);
  provider.setMode('unseen');
  const unseen = await c.call('/dialogue', { requestId: 'e2e-5b', actorId: 'guide', message: 'Quote the sealed card', revision: 2, contentVersion: 'fixture-v1' });
  assert.equal(unseen.data.error, 'provider_invalid_output', 'a well-formed pick of a source the engine did not offer is refused');
  assert.equal(JSON.stringify(unseen.data).includes('UNSEEN_MATERIAL_SENTINEL'), false);
  provider.setMode('fail');
  const failed = await c.call('/dialogue', { requestId: 'e2e-6', actorId: 'guide', message: 'Anything?', revision: 2, contentVersion: 'fixture-v1' });
  assert.equal(failed.data.status, 'error');
  assert.deepEqual((await c.call('/api/case/state')).data, before.data);
});

test('the synthetic policy is bound to the synthetic pack and the harness refuses the real case', async () => {
  const pack = syntheticPack(), policy = syntheticPolicy(pack);
  const other = structuredClone(pack); other.contentVersion = 'another-version';
  assert.throws(() => createCaseDialogueAdapter({ pack: other, policy, readCaseSession: () => null, selectSources: () => null }), error => error.code === 'content_version_mismatch');
  const real = structuredClone(pack); real.caseId = 'deleted-name';
  const started = await startDialogueHarness({ pack: real }).catch(error => error);
  if (!(started instanceof Error)) { await started.close(); assert.fail('the harness started on the real case id'); }
  assert.match(started.message, /harness_refuses_the_real_case/);
});

test('the harness and adapter stay out of production: server.js imports neither', () => {
  const server = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/case-service.js', import.meta.url), 'utf8');
  for (const source of [server, service]) { assert.equal(/case-dialogue-adapter|dialogue-harness/.test(source), false); }
});
