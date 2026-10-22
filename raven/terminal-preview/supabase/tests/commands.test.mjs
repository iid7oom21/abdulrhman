import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { evaluateCommand, freshRunState } from '../functions/_shared/run-commands.js';
import { ACTIVITIES, FILE_MANIFEST, REVISION } from '../../modules/expansion-data.js';
import { availableEvidenceIds } from '../../modules/investigation.js';
import { solutionPayload } from '../../tests/expansion-fixtures.mjs';

const snapshot = () => ({ ...freshRunState(), status: 'active', progress: {
  ...freshRunState().progress, runId: randomUUID(), startedAt: Date.now(), seq: 0,
} });
const command = (s, body) => ({ requestId: randomUUID(), expectedSeq: s.progress.seq, ...body });
const check = (s, body) => evaluateCommand(s, command(s, body));
const throws = (s, body, code) => assert.throws(() => check(s, body), e => e.code === code);
// This harness models commit outputs. Atomicity/RLS/idempotency are tested on real PostgreSQL separately.
function commit(s, body) {
  const event = check(s, body);
  return { ...s, ...event.state, status: event.complete ? 'completed' : event.kind === 'abandon' ? 'abandoned' : 'active',
    progress: { ...event.state.progress, seq: s.progress.seq + 1, wrongSubmissions: s.progress.wrongSubmissions + event.wrongDelta,
      ...(event.complete ? { completedAt: Date.now() } : {}) }, last: event };
}

test('fresh competitive run contains no imported practice progress', () => {
  const s = freshRunState();
  assert.equal(s.progress.revision, REVISION);
  assert.equal(s.progress.mode, 'ranked');
  assert.deepEqual(s.progress.accepted, []);
  assert.deepEqual(s.viewedIds, []);
});

test('full 32-activity server journey: sources, every forward skip, final-only completion', async () => {
  let s = snapshot();
  const computedHashes = Object.fromEntries(await Promise.all(FILE_MANIFEST.map(async file => [file.id,
    createHash('sha256').update(await readFile(new URL(file.url))).digest('hex')])));
  for (let i = 0; i < 32; i++) {
    const activity = ACTIVITIES[i];
    if (i < 31) throws(s, { action: 'submit-stage', activityId: ACTIVITIES[i + 1].id, payload: solutionPayload(ACTIVITIES[i + 1].id) }, 'ACTIVITY_LOCKED');
    for (const evidenceId of activity.requiredEvidenceIds) s = commit(s, { action: 'mark-viewed', evidenceId });
    const payload = solutionPayload(activity.id);
    if (activity.id === 'A23') payload.computedHashes = computedHashes;
    s = commit(s, { action: 'submit-stage', activityId: activity.id, payload });
    assert.equal(s.last.outcome.accepted, true, activity.id);
    assert.equal(s.last.outcome.ok, true, activity.id);
    assert.equal(s.last.outcome.seq, s.progress.seq);
    assert.equal(s.progress.accepted.length, i + 1);
    assert.equal(s.last.complete, i === 31);
  }
  assert.equal(s.status, 'completed');
  throws(s, { action: 'reveal-hint', activityId: 'A32', level: 1 }, 'RUN_CLOSED');
});

test('unknown/closed evidence cannot unlock required source or leak hints', () => {
  const s = snapshot();
  throws(s, { action: 'mark-viewed', evidenceId: 'E07' }, 'EVIDENCE_LOCKED');
  throws(s, { action: 'submit-stage', activityId: 'A01', payload: solutionPayload('A01') }, 'INVALID_PAYLOAD');
  throws(s, { action: 'reveal-hint', activityId: 'A32', level: 1 }, 'ACTIVITY_LOCKED');
  assert.deepEqual(s.viewedIds, []);
});

test('malformed payloads do not create score errors; a valid wrong answer does', () => {
  const s = commit(snapshot(), { action: 'mark-viewed', evidenceId: 'E09' });
  throws(s, { action: 'submit-stage', activityId: 'A01', payload: {} }, 'INVALID_PAYLOAD');
  throws(s, { action: 'submit-stage', activityId: 'A01', payload: [] }, 'INVALID_PAYLOAD');
  const wrong = check(s, { action: 'submit-stage', activityId: 'A01', payload: { ...solutionPayload('A01'), code: 'WRONG' } });
  assert.equal(wrong.wrongDelta, 1);
  assert.equal(wrong.outcome.accepted, false);
  assert.equal(wrong.outcome.ok, false);
  assert.equal(wrong.state.progress.accepted.length, 0);
  assert.equal(wrong.complete, false);
});

test('accepted payload strips arbitrary data and score fields', () => {
  const s = commit(snapshot(), { action: 'mark-viewed', evidenceId: 'E09' });
  const event = check(s, { action: 'submit-stage', activityId: 'A01', payload: { ...solutionPayload('A01'), admin: true, elapsedMs: 0, html: '<script>' } });
  assert.deepEqual(event.state.progress.accepted[0].payload, solutionPayload('A01'));
});

test('hints are sequential, charged exactly once per level, and do not accept activity', () => {
  let s = snapshot();
  throws(s, { action: 'reveal-hint', activityId: 'A01', level: 2 }, 'INVALID_HINT');
  s = commit(s, { action: 'reveal-hint', activityId: 'A01', level: 1 });
  assert.equal(s.last.hintDelta, 1);
  assert.equal(s.last.outcome.hint, ACTIVITIES[0].hints[0]);
  assert.equal(s.last.outcome.accepted, false);
  s = commit(s, { action: 'reveal-hint', activityId: 'A01', level: 1 });
  assert.equal(s.last.hintDelta, 0);
  assert.deepEqual(s.progress.hintsByActivity.A01, [1]);
  s = commit(s, { action: 'reveal-hint', activityId: 'A01', level: 2 });
  assert.equal(s.last.hintDelta, 1);
  assert.deepEqual(s.progress.hintsByActivity.A01, [1, 2]);
});

test('revision, closed status, malformed request IDs and stale sequence rejected', () => {
  const s = snapshot();
  for (const requestId of ['', '<script>', 'someone-else']) throws(s, { action: 'mark-viewed', evidenceId: 'E09', requestId }, 'INVALID_REQUEST');
  throws(s, { action: 'mark-viewed', evidenceId: 'E09', expectedSeq: 1 }, 'STALE_SEQUENCE');
  throws(s, { action: 'mark-viewed', evidenceId: 'E09', expectedSeq: -1 }, 'INVALID_REQUEST');
  throws({ ...s, status: 'abandoned' }, { action: 'mark-viewed', evidenceId: 'E09' }, 'RUN_CLOSED');
  throws({ ...s, progress: { ...s.progress, revision: 'old' } }, { action: 'mark-viewed', evidenceId: 'E09' }, 'RULESET_MISMATCH');
});

test('forged counts or accepted gaps cannot open future evidence', () => {
  const s = snapshot();
  s.progress.completedActivityIds = ACTIVITIES.map(a => a.id);
  s.progress.accepted = [{ activityId: 'A32', payload: solutionPayload('A32') }];
  s.viewedIds = ['E07', 'E16'];
  throws(s, { action: 'mark-viewed', evidenceId: 'E07' }, 'EVIDENCE_LOCKED');
  const event = check(s, { action: 'mark-viewed', evidenceId: 'E09' });
  assert.equal(event.state.progress.accepted.length, 0);
  assert.deepEqual(event.state.viewedIds, ['E09']);
  assert.deepEqual(availableEvidenceIds(event.state.progress), ['E01', 'E06', 'E09']);
});

test('abandon has no completion or score penalty', () => {
  const event = check(snapshot(), { action: 'abandon-run' });
  assert.equal(event.kind, 'abandon');
  assert.equal(event.complete, false);
  assert.equal(event.hintDelta, 0);
  assert.equal(event.wrongDelta, 0);
});
