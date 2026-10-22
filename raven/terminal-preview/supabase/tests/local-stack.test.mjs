import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ACTIVITIES, FILE_MANIFEST, REVISION } from '../../modules/expansion-data.js';
import { solutionPayload } from '../../tests/expansion-fixtures.mjs';

const enabled = process.env.RAVEN_LOCAL_STACK_TEST === '1';

/** Reads local CLI output privately. Never log this object: it contains generated credentials. */
function localCredentials() {
  let data;
  if (process.env.RAVEN_LOCAL_API_URL) {
    data = { API_URL: process.env.RAVEN_LOCAL_API_URL, ANON_KEY: process.env.RAVEN_LOCAL_ANON_KEY, SERVICE_ROLE_KEY: process.env.RAVEN_LOCAL_SERVICE_ROLE_KEY };
  } else {
    const workdir = process.env.RAVEN_LOCAL_STACK_WORKDIR;
    if (!workdir) throw new Error('Set RAVEN_LOCAL_STACK_WORKDIR for the running stack, or provide explicit local fixture connection variables.');
    const cli = process.env.RAVEN_SUPABASE_CLI || 'supabase';
    const result = spawnSync(cli, ['status', '--workdir', workdir, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
    if (result.error || result.status !== 0) throw new Error('Local Supabase status failed. Start the intended local stack manually; this test will not start one.');
    try { data = JSON.parse(result.stdout); } catch { throw new Error('Could not parse local Supabase status JSON; credential output is withheld.'); }
  }
  const address = data.API_URL || data.api_url;
  let parsed;
  try { parsed = new URL(address); } catch { throw new Error('Local status did not provide a valid API URL.'); }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) || !['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('This test accepts loopback local Supabase URLs only; hosted project testing is forbidden.');
  }
  const anon = data.ANON_KEY || data.anon_key || data.PUBLISHABLE_KEY;
  const service = data.SERVICE_ROLE_KEY || data.service_role_key || data.SECRET_KEY;
  if (!anon || !service) throw new Error('Local status is missing public/admin test credentials; values are withheld.');
  return { base: parsed.origin, anon, service };
}

// Explicit opt-in: local fixtures only, no Google flow and no email delivery.
test('real local Supabase: Auth, Edge32 journey, RLS, CAS, retries and public leaderboard', { skip: !enabled, timeout: 240000 }, async t => {
  const credentials = localCredentials();
  const createdUsers = [];
  const suffix = randomUUID().slice(0, 8);
  const aliases = [`RAVEN-A-${suffix}`, `RAVEN-B-${suffix}`];
  const origin = 'https://iid7oom21.github.io';
  async function request(path, { token = '', admin = false, body, method = 'POST', expected = 200, headers = {} } = {}) {
    let response;
    try {
      response = await fetch(`${credentials.base}${path}`, { method,
        headers: { apikey: admin ? credentials.service : credentials.anon, 'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
    } catch { throw new Error(`Local request failed before a response: ${path.split('?')[0]}. Private request details are withheld.`); }
    const data = await response.json().catch(() => null);
    const statuses = Array.isArray(expected) ? expected : [expected];
    if (!statuses.includes(response.status)) throw new Error(`Local ${path.split('?')[0]} returned HTTP${response.status}; expected ${statuses.join('/')}. Private response details are withheld.`);
    return { data, response };
  }
  async function api(action, payload = {}, token = '', expected = 200) {
    return (await request('/functions/v1/raven-api', { token, expected, headers: { Origin: origin }, body: { ...payload, action, revision: REVISION } })).data;
  }
  async function createUser(label) {
    const email = `raven-${label}-${randomUUID()}@example.invalid`;
    const password = `${randomUUID()}!Aa7`;
    const { data } = await request('/auth/v1/admin/users', { token: credentials.service, admin: true,
      body: { email, password, email_confirm: true, user_metadata: { raven_local_integration_fixture: true } }, expected: [200, 201] });
    assert.equal(typeof data?.id, 'string', 'Admin-created fixture has an ID');
    createdUsers.push(data.id);
    const signedIn = await request('/auth/v1/token?grant_type=password', { body: { email, password } });
    assert.equal(typeof signedIn.data?.access_token, 'string', 'Local password sign-in returns an access token');
    return { id: data.id, token: signedIn.data.access_token };
  }
  const command = (snapshot, payload) => ({ runId: snapshot.progress.runId, requestId: randomUUID(), expectedSeq: snapshot.progress.seq, ...payload });
  const fileHashes = Object.fromEntries(await Promise.all(FILE_MANIFEST.map(async file => [file.id, createHash('sha256').update(await readFile(new URL(file.url))).digest('hex')])));
  async function finishRun(snapshot, token) {
    let current = snapshot;
    for (const activity of ACTIVITIES.slice(current.progress.accepted.length)) {
      for (const evidenceId of activity.requiredEvidenceIds) if (!current.viewedIds.includes(evidenceId)) {
        current = await api('mark-viewed', command(current, { evidenceId }), token);
      }
      const payload = solutionPayload(activity.id);
      if (activity.id === 'A23') payload.computedHashes = fileHashes;
      current = await api('submit-stage', command(current, { activityId: activity.id, payload }), token);
      assert.equal(current.result?.accepted, true, `${activity.id} accepted by actual Edge evaluator`);
      assert.equal(current.status === 'completed', activity.id === 'A32', 'Only final activity completes the run');
    }
    return current;
  }
  try {
    await t.test('anonymous boundary and local confirmed users', async () => {
      await api('start-run', {}, '', 401);
      const board = await api('leaderboard');
      assert.ok(Array.isArray(board.entries));
      assert.ok(board.entries.length <= 50);
    });
    const a = await createUser('a');
    const b = await createUser('b');
    let runA = await api('start-run', { userId: b.id, progress: { completedActivityIds: ACTIVITIES.map(activity => activity.id), elapsedMs: 0 } }, a.token);
    let runB = await api('start-run', { userId: a.id }, b.token);
    const runIdA = runA.progress.runId;
    const runIdB = runB.progress.runId;
    let wrongRequest; let originalWrongResult;

    await t.test('fresh owner-bound starts, cross-account isolation and forbidden direct score writes', async () => {
      assert.equal(runA.progress.accepted.length, 0);
      assert.equal(runA.progress.seq, 0);
      assert.equal(runA.progress.mode, 'ranked');
      assert.ok(runA.progress.startedAt > Date.now() - 60000);
      assert.equal((await api('start-run', {}, a.token)).progress.runId, runIdA, 'Exactly one active run per account/revision');
      assert.notEqual(runIdA, runIdB);
      await api('get-run', { runId: runIdA }, b.token, 404);
      const otherRows = await request(`/rest/v1/runs?id=eq.${runIdA}&select=id`, { method: 'GET', token: b.token });
      assert.equal(otherRows.data.length, 0, 'RLS hides another account run');
      const ownRows = await request(`/rest/v1/runs?id=eq.${runIdA}&select=id`, { method: 'GET', token: a.token });
      assert.equal(ownRows.data.length, 1);
      await request(`/rest/v1/runs?id=eq.${runIdA}`, { method: 'PATCH', token: a.token, body: { wrong_count: 0, status: 'completed' }, expected: [401, 403] });
      await request('/rest/v1/rpc/raven_start_run', { token: a.token, body: { p_user_id: a.id, p_ruleset: REVISION, p_state: {} }, expected: [401, 403, 404] });
      assert.equal((await api('get-run', { runId: runIdA }, a.token)).status, 'active');
    });

    await t.test('practice CAS and per-account save ownership', async () => {
      const payload = { progress: { mode: 'practice' }, notes: [{ text: `local-${suffix}` }] };
      const saved = await api('save-save', { payload, expectedRevision: 0 }, a.token);
      assert.equal(saved.revision, 1);
      await api('save-save', { payload, expectedRevision: 0 }, a.token, 409);
      assert.equal((await api('load-save', {}, a.token)).payload.notes[0].text, `local-${suffix}`);
      assert.equal(await api('load-save', {}, b.token), null);
      assert.equal((await api('save-save', { payload, expectedRevision: 1 }, a.token)).revision, 2);
      await api('save-save', { payload: { progress: { mode: 'ranked' } }, expectedRevision: 2 }, a.token, 400);
      const hiddenSave = await request(`/rest/v1/case_saves?user_id=eq.${a.id}&select=revision`, { method: 'GET', token: b.token });
      assert.equal(hiddenSave.data.length, 0);
    });

    await t.test('server source gates, invalid vs wrong submissions and idempotent scoring', async () => {
      await api('publish-run', { runId: runIdA, alias: aliases[0] }, a.token, 400);
      await api('submit-stage', command(runA, { activityId: 'A32', payload: solutionPayload('A32') }), a.token, 409);
      await api('mark-viewed', command(runA, { evidenceId: 'E07' }), a.token, 403);
      await api('submit-stage', command(runA, { activityId: 'A01', payload: solutionPayload('A01') }), a.token, 400);
      runA = await api('mark-viewed', command(runA, { evidenceId: 'E09' }), a.token);
      const beforeBlank = runA.progress.seq;
      await api('submit-stage', command(runA, { activityId: 'A01', payload: {} }), a.token, 400);
      const afterBlank = await api('get-run', { runId: runIdA }, a.token);
      assert.equal(afterBlank.progress.seq, beforeBlank); assert.equal(afterBlank.progress.wrongSubmissions, 0);
      wrongRequest = command(runA, { activityId: 'A01', payload: { ...solutionPayload('A01'), code: 'WRONG' }, wrongCount: -999, elapsedMs: 1 });
      originalWrongResult = await api('submit-stage', wrongRequest, a.token);
      const replay = await api('submit-stage', wrongRequest, a.token);
      assert.equal(replay.progress.seq, originalWrongResult.progress.seq);
      assert.equal(replay.progress.wrongSubmissions, 1);
      assert.equal(replay.result.accepted, false);
      runA = originalWrongResult;
      await api('submit-stage', { ...wrongRequest, requestId: randomUUID() }, a.token, 409);
      const hintRequest = command(runA, { activityId: 'A01', level: 1 });
      runA = await api('reveal-hint', hintRequest, a.token);
      assert.equal(runA.progress.hintCount, 1);
      assert.equal((await api('reveal-hint', hintRequest, a.token)).progress.hintCount, 1);
      runA = await api('reveal-hint', command(runA, { activityId: 'A01', level: 1 }), a.token);
      assert.equal(runA.progress.hintCount, 1, 'Reopening a hint does not add another hint');
    });

    await t.test('complete actual32 activities, server clock freeze and retries after finish', async () => {
      runA = await finishRun(runA, a.token);
      assert.equal(runA.progress.accepted.length, 32);
      assert.equal(runA.progress.wrongSubmissions, 1);
      assert.equal(runA.progress.hintCount, 1);
      assert.ok(runA.progress.completedAt >= runA.progress.startedAt);
      assert.ok(runA.progress.elapsedMs >= 0);
      const later = await api('get-run', { runId: runIdA }, a.token);
      assert.equal(later.progress.elapsedMs, runA.progress.elapsedMs);
      const historical = await api('submit-stage', wrongRequest, a.token);
      assert.equal(historical.progress.seq, originalWrongResult.progress.seq, 'Original immutable event remains available after completion');
      await api('reveal-hint', command(runA, { activityId: 'A32', level: 1 }), a.token, 409);
      assert.equal((await api('get-run', { runId: runIdA }, a.token)).progress.wrongSubmissions, 1);
      runB = await finishRun(runB, b.token);
      assert.equal(runB.progress.accepted.length, 32);
      assert.equal(runB.progress.wrongSubmissions, 0); assert.equal(runB.progress.hintCount, 0);
    });

    await t.test('opt-in aliases, public privacy, leaderboard ordering and hiding', async () => {
      let board = await api('leaderboard');
      assert.equal(board.entries.some(entry => aliases.includes(entry.alias)), false);
      await api('publish-run', { runId: runIdA, alias: aliases[0] }, b.token, 404);
      await api('publish-run', { runId: runIdA, alias: aliases[0] }, a.token);
      await api('publish-run', { runId: runIdB, alias: aliases[1] }, b.token);
      board = await api('leaderboard');
      const first = board.entries.find(entry => entry.alias === aliases[0]);
      const second = board.entries.find(entry => entry.alias === aliases[1]);
      assert.ok(first && second, 'Both fixture aliases appear in local top50');
      assert.ok(Number(second.rank) < Number(first.rank), 'Fewer hints outranks the first fixture regardless of its earlier completion');
      assert.equal(first.hint_count, 1); assert.equal(first.wrong_count, 1);
      assert.equal(second.hint_count, 0); assert.equal(second.wrong_count, 0);
      for (const entry of board.entries) for (const field of ['user_id', 'email', 'run_id', 'access_token']) assert.equal(field in entry, false, 'Public leaderboard omits private fields');
      await api('publish-run', { runId: runIdA, alias: aliases[0], published: false }, a.token);
      assert.equal((await api('leaderboard')).entries.some(entry => entry.alias === aliases[0]), false);
      await api('publish-run', { runId: runIdA, alias: aliases[0], published: true }, a.token);
      assert.equal((await api('leaderboard')).entries.some(entry => entry.alias === aliases[0]), true);
    });

    await t.test('new attempt, explicit abandon and retry', async () => {
      const fresh = await api('start-run', {}, a.token);
      assert.notEqual(fresh.progress.runId, runIdA);
      const abandon = command(fresh, {});
      const closed = await api('abandon-run', abandon, a.token);
      assert.equal(closed.status, 'abandoned');
      assert.equal((await api('abandon-run', abandon, a.token)).progress.seq, closed.progress.seq);
    });
  } finally {
    // Only random fixture users created by this invocation are removed; FK cascades clear their rows.
    const cleanup = await Promise.allSettled(createdUsers.map(id => request(`/auth/v1/admin/users/${id}`, { method: 'DELETE', token: credentials.service, admin: true, expected: [200, 204] })));
    if (cleanup.some(result => result.status === 'rejected')) throw new Error('Local fixture cleanup failed. Inspect only users marked raven_local_integration_fixture; credential responses remain withheld.');
  }
});
