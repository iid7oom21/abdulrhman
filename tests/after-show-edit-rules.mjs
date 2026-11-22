import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUNDS, SHOT_IDS, SHOTS, FORMAT, score, dailyRound, solutions, duration, challengeFile, validateFile, generateBrief } from '../raven/after-show/edit-rules.js';
test('the transmission separates clock and sequence using all three whole shots', () => {
  assert.deepEqual(score(ROUNDS[0], ['exterior', 'hand', 'envelope']), { seconds: 12, time: true, order: true, structure: true, pass: true });
  assert.deepEqual(score(ROUNDS[0], ['envelope', 'exterior', 'hand']), { seconds: 12, time: true, order: false, structure: true, pass: false });
  const over = score(ROUNDS[0], ['lamp', 'hand', 'envelope']);
  assert.equal(over.seconds, 13);
  assert.equal(over.time, false);
  assert.equal(over.pass, false);
  assert.equal(score(ROUNDS[0], ['envelope', 'envelope', 'hand']).structure, false);
  assert.equal(duration(['hand', 'exterior', 'hand']), 13);
});
test('all published and generated briefs are playable, and equivalent short timelines qualify', () => {
  assert.deepEqual(ROUNDS.map(r => solutions(r).length), [1, 6, 4, 4]);
  for (const ids of [['envelope', 'exterior'], ['hand', 'envelope']])
    assert.equal(score(ROUNDS[2], ids).pass, true);
  for (const title of ['brisk', 'linger'])
    for (const limit of [8, 12, 16])
      for (const rule of ['establish', 'effect', 'continuity']) {
        const spec = generateBrief(title, limit, rule);
        assert.ok(solutions(spec).length);
        assert.equal(spec.limit, limit);
      }
});
test('daily rounds use a repeatable UTC calendar day and a versioned library', () => {
  const d1 = new Date('2026-11-20T23:59:59Z').toISOString().slice(0, 10);
  const d2 = new Date('2026-11-21T00:00:00Z').toISOString().slice(0, 10);
  assert.equal(dailyRound(d1), dailyRound('2026-11-20'));
  assert.notEqual(dailyRound(d1), dailyRound(d2));
  assert.equal(FORMAT, 'raven-edit-challenge-1');
});
test('challenge files reject impossible constraints and foreign media, and preserve valid order', () => {
  const base = challengeFile('Evening', 3, 12, 'opening', [...SHOT_IDS]);
  assert.equal(validateFile(base), null);
  assert.equal(validateFile({ ...base, slots: 0 }), 'slots');
  assert.equal(validateFile({ ...base, limit: 3 }), 'unsolvable');
  assert.equal(validateFile({ ...base, constraint: 'toString' }), 'rule');
  assert.equal(validateFile({ ...base, constraint: { toString: 0, valueOf: 0 } }), 'rule');
  assert.equal(validateFile({ ...base, library: ['hand', 'https://example.invalid/p.jpg'] }), 'library');
  assert.equal(validateFile({ ...base, library: ['hand', 'hand', 'exterior'] }), 'library');
  assert.equal(validateFile({ ...base, format: 'old' }), 'format');
  assert.equal(validateFile({ ...base, title: ' ' }), 'title');
  for (const id of SHOT_IDS)
    assert.equal(SHOTS[id].image, './assets/' + id + '.webp');
});
