// Pure HTTP boundary tests: Auth/PostgREST responses are mocked; SQL runs in database.test.mjs.
import { freshRunState } from '../functions/_shared/run-commands.js';
const assert = (condition: unknown, message = 'assertion failed') => { if (!condition) throw new Error(message); };
const equal = (actual: unknown, expected: unknown) => assert(JSON.stringify(actual) === JSON.stringify(expected), `${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const runId = '33333333-3333-4333-8333-333333333333';
const requestId = '44444444-4444-4444-8444-444444444444';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
let handler: (request: Request) => Promise<Response>;
Deno.env.set('SUPABASE_URL', 'https://database.invalid');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'server-test-placeholder');
Deno.env.set('SUPABASE_ANON_KEY', 'public-test-placeholder');
const originalServe = Deno.serve;
// Capture the real edge entrypoint without opening sockets or deploying anything.
(Deno as any).serve = (next: typeof handler) => { handler = next; return {}; };
await import('../functions/raven-api/index.ts');
Deno.serve = originalServe;

const input = (body: Record<string, unknown>, authorization = 'Bearer test-user-token', origin = 'https://iid7oom21.github.io') => new Request('https://edge.invalid/functions/v1/raven-api', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(authorization ? { Authorization: authorization } : {}) }, body: JSON.stringify(body),
});
const active = () => ({ ...freshRunState(), status: 'active', progress: { ...freshRunState().progress, runId, seq: 0, startedAt: Date.now() } });
async function withFetch(fn: typeof fetch, test: () => Promise<void>) { const old = globalThis.fetch; globalThis.fetch = fn; try { await test(); } finally { globalThis.fetch = old; } }

Deno.test('private RPC owner is verified Auth user, never body userId', async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  await withFetch(async (url, options) => {
    const path = String(url);
    if (path.endsWith('/auth/v1/user')) return json({ id: A });
    const body = JSON.parse(String(options?.body)); calls.push({ path, body }); return json(active());
  }, async () => {
    equal((await handler(input({ action: 'start-run', userId: B, state: { completed: true } }))).status, 200);
    equal(calls[0].body.p_user_id, A);
    equal((calls[0].body.p_state as any).progress.accepted, []);
  });
});

Deno.test('missing or invalid JWT never reaches a private RPC', async () => {
  let rpc = 0;
  await withFetch(async url => { if (String(url).includes('/rest/')) rpc++; return json({ message: 'invalid' }, 401); }, async () => {
    equal((await handler(input({ action: 'start-run' }, ''))).status, 401);
    equal((await handler(input({ action: 'start-run' }))).status, 401);
    equal(rpc, 0);
  });
});

Deno.test('leaderboard anonymous request reads only sanitized view with maximum50', async () => {
  let path = '';
  await withFetch(async url => { path = String(url); return json([{ rank: 1, alias: 'محقق', elapsed_ms: 50000 }]); }, async () => {
    const response = await handler(input({ action: 'leaderboard' }, ''));
    equal(response.status, 200); assert(path.includes('/raven_leaderboard?')); assert(path.includes('limit=50')); assert(!path.includes('auth/'));
  });
});

Deno.test('cached event returns before snapshot checks even if request payload is now malformed', async () => {
  const cached = { progress: { runId, seq: 4 }, result: { accepted: true } };
  const calls: string[] = [];
  await withFetch(async url => { const path = String(url); calls.push(path); return path.endsWith('/user') ? json({ id: A }) : json(cached); }, async () => {
    const response = await handler(input({ action: 'submit-stage', runId, requestId, expectedSeq: -99, payload: [] }));
    equal(response.status, 200); equal(await response.json(), cached);
    assert(!calls.some(path => path.endsWith('raven_get_run')));
  });
});

for (const completed of [false, true]) Deno.test(`duplicate racing after initial cache lookup returns original result (${completed ? 'closed' : 'stale'} snapshot)`, async () => {
  let lookups = 0; let commits = 0;
  const cached = { progress: { runId, seq: 1 }, result: { accepted: false, message: 'original' } };
  const s = active(); s.progress.seq = 1; s.status = completed ? 'completed' : 'active';
  await withFetch(async url => {
    const path = String(url);
    if (path.endsWith('/user')) return json({ id: A });
    if (path.endsWith('raven_event_result')) return json(++lookups === 1 ? null : cached);
    if (path.endsWith('raven_get_run')) return json(s);
    commits++; return json({});
  }, async () => {
    const response = await handler(input({ action: 'submit-stage', runId, requestId, expectedSeq: 0, activityId: 'A01', payload: {} }));
    equal(response.status, 200); equal(await response.json(), cached); equal(lookups, 2); equal(commits, 0);
  });
});

Deno.test('different request with stale sequence fails without committing', async () => {
  let commits = 0; const s = active(); s.progress.seq = 2;
  await withFetch(async url => {
    const path = String(url);
    if (path.endsWith('/user')) return json({ id: A });
    if (path.endsWith('raven_event_result')) return json(null);
    if (path.endsWith('raven_get_run')) return json(s);
    commits++; return json({});
  }, async () => {
    const response = await handler(input({ action: 'submit-stage', runId, requestId, expectedSeq: 0, activityId: 'A01', payload: {} }));
    equal(response.status, 409); equal((await response.json()).code, 'STALE_SEQUENCE'); equal(commits, 0);
  });
});

Deno.test('skip or invalid source cannot invoke database score mutation', async () => {
  let commits = 0;
  await withFetch(async url => {
    const path = String(url);
    if (path.endsWith('/user')) return json({ id: A });
    if (path.endsWith('raven_event_result')) return json(null);
    if (path.endsWith('raven_get_run')) return json(active());
    commits++; return json({});
  }, async () => {
    equal((await handler(input({ action: 'submit-stage', runId, requestId, expectedSeq: 0, activityId: 'A32', payload: { answer: 'c' } }))).status, 409);
    equal((await handler(input({ action: 'mark-viewed', runId, requestId, expectedSeq: 0, evidenceId: 'E07' }))).status, 403);
    equal(commits, 0);
  });
});

Deno.test('origin, JSON, revision and request size restrictions are enforced before mutation', async () => {
  let calls = 0;
  await withFetch(async () => { calls++; return json({}); }, async () => {
    equal((await handler(input({ action: 'start-run' }, 'Bearer valid', 'https://foreign.invalid'))).status, 403);
    equal((await handler(input({ action: 'start-run', revision: 'old' }))).status, 409);
    equal((await handler(input({ action: 'start-run', payload: 'x'.repeat(300001) }))).status, 413);
    equal(calls, 0);
  });
});
