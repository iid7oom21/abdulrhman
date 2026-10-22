import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCloud } from '../../modules/cloud.js';
import { emptyProgress } from '../../modules/investigation.js';

const config = { supabaseUrl: 'https://raven-test.invalid', publishableKey: 'test-public-key', functionName: 'raven-api', redirectPath: 'case-017/' };
const response = (data, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const auth = expires => ({ access_token: 'test-access', refresh_token: 'test-refresh', expires_at: expires ?? Math.floor(Date.now() / 1000) + 3600, user: { id: '11111111-1111-4111-8111-111111111111', email: 'private@example.invalid' } });
function setup(t, { session = auth(), href = 'https://example.invalid/terminal-preview/case-017/', fetcher = async () => response({}) } = {}) {
  const previous = new Map();
  const override = (key, value) => { previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); };
  const sessionMap = new Map();
  const location = new URL(href); location.assign = value => { location.assigned = value; };
  override('window', new EventTarget()); override('location', location);
  override('history', { state: null, replaceState(_state, _title, value) { location.href = value; } });
  override('sessionStorage', { getItem: k => sessionMap.get(k) || null, setItem: (k, v) => sessionMap.set(k, v), removeItem: k => sessionMap.delete(k) });
  override('fetch', fetcher);
  const memory = new Map(session ? [['cloud:session', session]] : []);
  const listeners = new Set();
  let state = { progress: emptyProgress(), viewedIds: [], notes: [] };
  const services = { routeURL: path => `https://example.invalid/terminal-preview/${path}`,
    store: { get: (k, fallback = null) => structuredClone(memory.has(k) ? memory.get(k) : fallback), set: (k, v) => memory.set(k, structuredClone(v)) },
    caseStore: { get: () => structuredClone(state), update(fn) { const draft = structuredClone(state); state = fn(draft) || draft; for (const listener of listeners) listener(state); },
      subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, reset() { state = { progress: emptyProgress(), viewedIds: [], notes: [] }; } },
  };
  const clouds = [];
  const create = (cfg = config) => { const cloud = createCloud(services, cfg); clouds.push(cloud); return cloud; };
  t.after(() => { for (const cloud of clouds) cloud.destroy(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  return { create, services, memory, sessionMap, location };
}

test('disabled config leaves local play intact and never sends network requests', async t => {
  let requests = 0;
  const h = setup(t, { fetcher: async () => { requests++; return response({}); } });
  const cloud = h.create({ supabaseUrl: '', publishableKey: '' }); await cloud.ready;
  assert.equal(cloud.configured, false);
  await assert.rejects(cloud.startRun(), e => e.code === 'NOT_CONFIGURED');
  await assert.rejects(cloud.signIn(), e => e.code === 'NOT_CONFIGURED');
  assert.equal(requests, 0);
  assert.equal(h.services.caseStore.get().progress.mode, 'practice');
});

test('Google PKCE uses a fresh verifier/challenge and no identity leaks through public session', async t => {
  const h = setup(t); const cloud = h.create(); await cloud.ready; await cloud.signIn();
  const address = new URL(h.location.assigned);
  const pending = JSON.parse(h.sessionMap.get('raven:oauth-pkce'));
  assert.equal(address.searchParams.get('provider'), 'google');
  assert.equal(address.searchParams.get('redirect_to'), 'https://example.invalid/terminal-preview/case-017/');
  assert.equal(address.searchParams.get('code_challenge_method'), 's256');
  assert.equal(address.searchParams.get('code_challenge'), createHash('sha256').update(pending.verifier).digest('base64url'));
  assert.equal(cloud.getSession().access_token, undefined);
  assert.equal(cloud.getSession().refresh_token, undefined);
});

test('OAuth callback without matching verifier is discarded without token exchange', async t => {
  let requests = 0;
  const h = setup(t, { session: null, href: 'https://example.invalid/terminal-preview/case-017/?code=unexpected', fetcher: async () => { requests++; return response({}); } });
  const cloud = h.create(); await cloud.ready;
  assert.equal(requests, 0); assert.equal(cloud.getSession(), null);
  assert.equal(h.location.searchParams.has('code'), false);
  assert.match(cloud.getStatus().message, /انتهى طلب الدخول/);
});

test('pending token refresh cannot resurrect identity after logout', async t => {
  const refresh = deferred(); let refreshStarted;
  const started = new Promise(r => { refreshStarted = r; });
  const h = setup(t, { session: auth(1), fetcher: async url => {
    if (url.includes('refresh_token')) { refreshStarted(); return refresh.promise; }
    if (url.includes('/logout')) return response(null, 204);
    throw new Error('An authenticated API request must not survive logout');
  } });
  const cloud = h.create(); await cloud.ready;
  const loading = cloud.loadSave(); const caught = loading.catch(e => e);
  await started; await cloud.signOut(); refresh.resolve(response(auth()));
  assert.equal((await caught).code, 'ACCOUNT_CHANGED');
  assert.equal(cloud.getSession(), null); assert.equal(h.services.store.get('cloud:session'), null);
});

test('pending API response cannot restore an old-account save after logout', async t => {
  const remote = deferred(); const started = deferred();
  const h = setup(t, { fetcher: async url => { if (url.includes('/logout')) return response(null, 204); started.resolve(); return remote.promise; } });
  const cloud = h.create(); await cloud.ready;
  const loading = cloud.loadSave().catch(e => e);
  await started.promise; await cloud.signOut(); remote.resolve(response({ revision: 12, payload: { notes: ['remote'] } }));
  assert.equal((await loading).code, 'ACCOUNT_CHANGED');
  assert.deepEqual(h.services.caseStore.get().notes, []);
});

test('queued competitive requests keep stable request IDs and advance latest server sequence', async t => {
  const sent = [];
  const h = setup(t, { fetcher: async (_url, options) => {
    const body = JSON.parse(options.body); sent.push(body);
    return response({ progress: { runId: 'run-1', seq: sent.length }, result: { ok: true } });
  } });
  const cloud = h.create(); await cloud.ready;
  await Promise.all([cloud.markViewed('run-1', 'E09', 'id-view', 0), cloud.submitStage('run-1', 'A01', { code: 'x' }, 'id-submit', 0)]);
  assert.deepEqual(sent.map(b => b.expectedSeq), [0, 1]);
  assert.deepEqual(sent.map(b => b.requestId), ['id-view', 'id-submit']);
  assert.equal(sent[1].revision, 'case-017-expansion-v3');
});

test('cloud practice conflicts retain both copies and never overwrite local state automatically', async t => {
  const remote = { progress: emptyProgress(), notes: [{ text: 'remote' }] };
  const h = setup(t, { fetcher: async (_url, options) => {
    const { action } = JSON.parse(options.body);
    return action === 'save-save' ? response({ code: 'CONFLICT', message: 'newer' }, 409) : response({ revision: 5, payload: remote });
  } });
  h.services.caseStore.update(s => { s.notes = [{ text: 'local' }]; });
  const cloud = h.create(); await cloud.ready;
  await assert.rejects(cloud.enableSync(), e => e.status === 409);
  assert.equal(cloud.getStatus().syncEnabled, false);
  assert.equal(cloud.getStatus().conflict.local.notes[0].text, 'local');
  assert.equal(cloud.getStatus().conflict.remote.payload.notes[0].text, 'remote');
  assert.equal(h.services.caseStore.get().notes[0].text, 'local');
  await cloud.resolveConflict(true);
  assert.equal(h.services.caseStore.get().notes[0].text, 'remote');
  assert.equal(h.services.store.get('cloud:local-backup').notes[0].text, 'local');
});

test('concurrent practice saves serialize and use CAS revisions from prior successful save', async t => {
  const revisions = [];
  const h = setup(t, { fetcher: async (_url, options) => { const body = JSON.parse(options.body); revisions.push(body.expectedRevision); return response({ revision: body.expectedRevision + 1 }); } });
  const cloud = h.create(); await cloud.ready;
  await Promise.all([cloud.saveSave(), cloud.saveSave()]);
  assert.deepEqual(revisions, [0, 1]);
});

test('logout restores practice backup while preserving account run reference for server resume', async t => {
  const h = setup(t, { fetcher: async () => response(null, 204) });
  const backup = h.services.caseStore.get(); backup.notes = [{ text: 'practice' }];
  h.services.store.set('cloud:practice-backup', backup);
  h.services.caseStore.update(s => { s.progress.mode = 'ranked'; s.progress.runId = 'ranked-1'; });
  const cloud = h.create(); await cloud.ready; await cloud.signOut();
  assert.equal(h.services.caseStore.get().progress.mode, 'practice');
  assert.equal(h.services.caseStore.get().notes[0].text, 'practice');
  assert.equal(h.services.store.get(`cloud:ranked:${auth().user.id}`).runId, 'ranked-1');
  assert.match(cloud.getStatus().message, /وقتها يستمر/);
});

test('historical idempotency response cannot lower the next queued request sequence', async t => {
  const sent = []; const sequences = [10, 1, 11];
  const h = setup(t, { fetcher: async (_url, options) => { const body = JSON.parse(options.body); sent.push(body); return response({ progress: { runId: 'run-1', seq: sequences[sent.length - 1] } }); } });
  const cloud = h.create(); await cloud.ready;
  await cloud.getRun('run-1');
  const historical = await cloud.submitStage('run-1', 'A01', {}, 'old-request', 0);
  assert.equal(historical.progress.seq, 1, 'original result still returned for idempotency');
  await cloud.markViewed('run-1', 'E09', 'new-request', 0);
  assert.equal(sent[2].expectedSeq, 10);
});

test('destroy invalidates in-flight refresh without rewriting persisted session', async t => {
  const refresh = deferred(); const started = deferred();
  const h = setup(t, { session: auth(1), fetcher: async () => { started.resolve(); return refresh.promise; } });
  const cloud = h.create(); await cloud.ready;
  const loading = cloud.loadSave().catch(e => e);
  await started.promise; cloud.destroy(); refresh.resolve(response({ ...auth(), access_token: 'late-token' }));
  assert.equal((await loading).code, 'ACCOUNT_CHANGED');
  assert.equal(h.services.store.get('cloud:session').access_token, 'test-access');
});

test('lost ranked response reuses original UUID and sequence after reload even with new caller UUID', async t => {
  const sent = []; let committedWrongCount = 0;
  const originalId = '11111111-1111-4111-8111-111111111111';
  const eventCache = new Map();
  const h = setup(t, { fetcher: async (_url, options) => {
    const body = JSON.parse(options.body); sent.push(body);
    if (eventCache.has(body.requestId)) return response(eventCache.get(body.requestId));
    committedWrongCount++;
    const result = { progress: { runId: 'run-1', seq: 1, wrongSubmissions: committedWrongCount }, result: { correct: false, accepted: false } };
    eventCache.set(body.requestId, result);
    if (sent.length === 1) throw new TypeError('response lost after server commit');
    return response(result);
  } });
  const first = h.create(); await first.ready;
  await assert.rejects(first.submitStage('run-1', 'A01', { code: 'WRONG' }, originalId, 0), e => e.code === 'NETWORK');
  first.destroy();
  const resumed = h.create(); await resumed.ready;
  const result = await resumed.submitStage('run-1', 'A01', { code: 'WRONG' }, '22222222-2222-4222-8222-222222222222', 0);
  assert.equal(sent[1].requestId, originalId);
  assert.equal(sent[1].expectedSeq, 0);
  assert.equal(result.progress.wrongSubmissions, 1);
  assert.equal(committedWrongCount, 1);
  assert.deepEqual(h.services.store.get(`cloud:pending-events:${auth().user.id}`), []);
});

test('changed payload does not adopt ambiguous prior request identity', async t => {
  const sent = [];
  const h = setup(t, { fetcher: async (_url, options) => {
    const body = JSON.parse(options.body); sent.push(body);
    if (sent.length === 1) throw new TypeError('lost response');
    return response({ code: 'CONFLICT', message: 'reload' }, 409);
  } });
  const cloud = h.create(); await cloud.ready;
  await assert.rejects(cloud.submitStage('run-1', 'A01', { code: 'WRONG' }, 'original', 0));
  await assert.rejects(cloud.submitStage('run-1', 'A01', { code: 'CHANGED' }, 'changed', 0), e => e.status === 409);
  assert.equal(sent[1].requestId, 'changed');
  const remaining = h.services.store.get(`cloud:pending-events:${auth().user.id}`);
  assert.equal(remaining.length, 1); assert.equal(remaining[0].requestId, 'original');
});
