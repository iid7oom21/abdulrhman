import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Real PostgreSQL/RLS tests. No hosted project or production credentials are used.
const image = process.env.RAVEN_POSTGRES_IMAGE || 'postgres:16-alpine';
const container = `raven-db-test-${process.pid}`;
const sqlText = readFileSync(fileURLToPath(new URL('../migrations/202610230001_investigation.sql', import.meta.url)), 'utf8');
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const json = value => `${quote(JSON.stringify(value))}::jsonb`;
const A = '10000000-0000-4000-8000-000000000001';
const B = '10000000-0000-4000-8000-000000000002';
let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions++; };
const same = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
function sql(statement) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-t', '-A'], { input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function result(statement) { return JSON.parse(sql(statement)); }
function rejects(statement, pattern) {
  let error;
  try { sql(statement); } catch (e) { error = String(e.stderr); }
  check(error && pattern.test(error), `Expected ${pattern}; received ${error || 'success'}`);
}
const fresh = () => ({ progress: { revision: 'case-017-expansion-v3', accepted: [], completedActivityIds: [], hintsByActivity: {}, wrongSubmissions: 0, mode: 'ranked' }, viewedIds: [] });
const get = id => result(`select raven_get_run('${A}','${id}');`);
let eventIndex = 0;
const requestId = () => `20000000-0000-4000-8000-${String(++eventIndex).padStart(12, '0')}`;
function apply(id, seq, state, { kind = 'submit', correct = true, hintDelta = 0, wrongDelta = 0, complete = false, request = requestId() } = {}) {
  const query = `select raven_apply_event('${A}','${id}','${request}',${seq},'${kind}',${json(state)},${json({ valid: true, correct })},${hintDelta},${wrongDelta},${complete});`;
  return { value: result(query), query, request };
}
function finish(id) {
  let snapshot = get(id);
  for (let number = snapshot.progress.accepted.length + 1; number <= 32; number++) {
    const next = structuredClone(snapshot);
    const activityId = `A${String(number).padStart(2, '0')}`;
    next.progress.accepted.push({ activityId, payload: { validatedByEdgeFixture: true } });
    next.progress.completedActivityIds.push(activityId);
    snapshot = apply(id, snapshot.progress.seq, next, { complete: number === 32 }).value;
  }
  return snapshot;
}
try {
  execFileSync('docker', ['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=raven-local-test-only', image], { stdio: 'pipe' });
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { execFileSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], { stdio: 'pipe' }); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 300)); }
  }
  check(ready, 'PostgreSQL starts');
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated;
    insert into auth.users values('${A}'),('${B}');`);
  sql(sqlText); assertions++;
  const start = result(`select raven_start_run('${A}','case-017-expansion-v3',${json(fresh())});`);
  const id = start.progress.runId;
  same(start.progress.seq, 0, 'fresh server sequence');
  check(start.progress.startedAt > Date.now() - 60_000, 'server clock sets start');
  same(result(`select raven_start_run('${A}','case-017-expansion-v3',${json(fresh())});`).progress.runId, id, 'one active run');
  rejects(`select raven_get_run('${B}','${id}');`, /RAVEN_NOT_FOUND/);
  rejects(`set role authenticated; select raven_start_run('${A}','case-017-expansion-v3',${json(fresh())});`, /permission denied/);
  rejects(`set role authenticated; update runs set wrong_count=0;`, /permission denied/);
  same(sql(`set role authenticated; set request.jwt.claim.sub='${B}'; select count(*) from runs;`).split('\n').at(-1), '0', 'RLS hides another account run');
  same(sql(`set role authenticated; set request.jwt.claim.sub='${A}'; select count(*) from runs;`).split('\n').at(-1), '1', 'RLS permits owner read');

  const first = fresh(); first.progress.accepted.push({ activityId: 'A01', payload: { face: 'back', lamp: 'uv', code: 'B17-R' } }); first.progress.completedActivityIds.push('A01');
  first.progress.startedAt = 0; first.progress.elapsedMs = 1; first.progress.completedAt = 1; first.progress.wrongSubmissions = -100;
  const accepted = apply(id, 0, first);
  same(accepted.value.progress.seq, 1, 'sequence advances once');
  same(result(accepted.query), accepted.value, 'retry returns exactly original outcome');
  check(accepted.value.progress.startedAt > 0, 'client start ignored');
  same(accepted.value.progress.completedAt, null, 'client finish ignored');
  same(accepted.value.progress.wrongSubmissions, 0, 'client counters ignored');
  rejects(`select raven_apply_event('${A}','${id}','${requestId()}',0,'submit',${json(first)},'{"valid":true,"correct":true}',0,0,false);`, /RAVEN_CONFLICT/);
  const skip = fresh(); skip.progress.accepted = Array.from({ length: 32 }, (_, i) => ({ activityId: `A${String(i + 1).padStart(2, '0')}`, payload: {} }));
  rejects(`select raven_apply_event('${A}','${id}','${requestId()}',1,'submit',${json(skip)},'{"valid":true,"correct":true}',0,0,true);`, /RAVEN_INVALID/);
  const wrong = apply(id, 1, first, { correct: false, wrongDelta: 1 });
  same(wrong.value.progress.wrongSubmissions, 1, 'wrong count belongs to server');
  same(result(wrong.query).progress.wrongSubmissions, 1, 'retry does not count mistake twice');
  const hinted = structuredClone(wrong.value); hinted.progress.hintsByActivity = { A02: [1] };
  const hint = apply(id, 2, hinted, { kind: 'hint', hintDelta: 1 });
  same(hint.value.progress.hintCount, 1, 'new hint counted');
  same(result(hint.query).progress.hintCount, 1, 'retry does not count hint twice');
  const repeatedHint = apply(id, 3, hinted, { kind: 'hint', hintDelta: 0 });
  same(repeatedHint.value.progress.hintCount, 1, 'reopened hint does not count');
  rejects(`select raven_publish_run('${A}','${id}','محقق',true);`, /RAVEN_INVALID/);

  const practice = { progress: { mode: 'practice' }, notes: [{ text: 'local draft' }] };
  same(result(`select raven_save_case('${A}','case-017-expansion-v3',0,${json(practice)});`).revision, 1, 'first CAS save');
  rejects(`select raven_save_case('${A}','case-017-expansion-v3',0,${json(practice)});`, /RAVEN_CONFLICT/);
  same(result(`select raven_save_case('${A}','case-017-expansion-v3',1,${json(practice)});`).revision, 2, 'next CAS save');
  rejects(`select raven_save_case('${A}','case-017-expansion-v3',2,'{"progress":{"mode":"ranked"}}');`, /RAVEN_INVALID/);
  same(sql(`set role authenticated; set request.jwt.claim.sub='${B}'; select count(*) from case_saves;`).split('\n').at(-1), '0', 'RLS hides another save');

  const completed = finish(id);
  same(completed.status, 'completed', '32 accepted activities complete run');
  check(completed.progress.completedAt >= completed.progress.startedAt, 'server finish follows start');
  const elapsed = completed.progress.elapsedMs;
  await new Promise(resolve => setTimeout(resolve, 30));
  same(get(id).progress.elapsedMs, elapsed, 'finished timer remains fixed');
  same(result(accepted.query), accepted.value, 'old retry still works after finish');
  rejects(`select raven_publish_run('${A}','${id}','<script>',true);`, /RAVEN_INVALID/);
  const published = result(`select raven_publish_run('${A}','${id}','محقق رايفن',true);`);
  same(published.published, true, 'explicit publish');
  const publicRows = sql(`set role anon; select row_to_json(t) from raven_leaderboard t;`).split('\n').find(line => line.startsWith('{'));
  const row = JSON.parse(publicRows);
  same(row.alias, 'محقق رايفن', 'chosen alias published');
  check(!('user_id' in row) && !('email' in row) && !('run_id' in row), 'public view omits private identifiers');
  rejects(`set role anon; select * from runs;`, /permission denied/);

  const nextRun = result(`select raven_start_run('${A}','case-017-expansion-v3',${json(fresh())});`);
  check(nextRun.progress.runId !== id, 'new attempt gets new run ID');
  finish(nextRun.progress.runId);
  same(result(`select raven_publish_run('${A}','${nextRun.progress.runId}','محقق جديد',true);`).bestRunId, nextRun.progress.runId, 'fewer hints/mistakes wins');
  same(result(`select raven_publish_run('${A}','${id}','أقدم نتيجة',true);`).bestRunId, nextRun.progress.runId, 'worse result cannot replace best');
  same(sql('select count(*) from leaderboard_entries;'), '1', 'one best row per account/ruleset');
  result(`select raven_publish_run('${A}','${id}','محقق رايفن',false);`);
  same(sql('set role anon; select count(*) from raven_leaderboard;').split('\n').at(-1), '0', 'unpublish removes public entry');

  const republished = result(`select raven_publish_run('${A}','${id}','اسم بعد الإخفاء',true);`);
  same(republished.published, true, 'publishing worse run unhides best result');
  same(republished.bestRunId, nextRun.progress.runId, 'republish keeps best score');
  same(republished.alias, 'اسم بعد الإخفاء', 'republish updates chosen alias independently');

  const abandonedRun = result(`select raven_start_run('${A}','case-017-expansion-v3',${json(fresh())});`);
  const abandoned = apply(abandonedRun.progress.runId, 0, fresh(), { kind: 'abandon' });
  same(abandoned.value.status, 'abandoned', 'abandon is explicit');
  same(result(abandoned.query), abandoned.value, 'abandon retry remains idempotent');
  console.log(`PASS: ${assertions} PostgreSQL assertions (schema, RLS, ownership, CAS, idempotency, sequence, scoring, finish, leaderboard).`);
} finally {
  try { execFileSync('docker', ['rm', '-f', container], { stdio: 'pipe' }); } catch { /* already cleaned */ }
}
