import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_VERSION, PEOPLE, EVIDENCE, PUZZLES, ORDER, STORAGE_KEY, PHONE_EXPORT } from '../modules/last-call-data.js';
import { emptyState, normalizeState, availableEvidence, isUnlocked, solve, confront, accuse, nextPuzzle } from '../modules/last-call-engine.js';

const answers = {
  photo: { hotspots: ['drive', 'ledger', 'phone'] },
  message: { recorded: '21:47', delivered: '22:17', meaning: 'scheduled' },
  clock: { offset: 7, entry: '22:07', exit: '22:09' },
  receipt: { order: ['header', 'item', 'approval', 'footer'], changed: 'ledger' },
  custody: { order: ['sarah', 'yusuf', 'reem', 'raed', 'mazen', 'layan'] },
  confrontation: { confirmed: true },
};
const verdict = { culprit: 'raed', accomplice: 'reem', evidenceIds: ['message', 'access', 'ledger'] };
function advance(until = 'custody') {
  let state = emptyState();
  for (const id of ORDER) {
    if (id === 'confrontation') for (const person of PEOPLE) state = confront(state, person.id, person.confrontation.evidenceId).state;
    const result = solve(state, id, answers[id]);
    assert.equal(result.ok, true, `${id}: ${result.message}`);
    state = result.state;
    if (id === until) return state;
  }
  return state;
}
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

test('new six-person case has a distinct save key and sources available before every puzzle', () => {
  assert.equal(PEOPLE.length, 6);
  assert.equal(EVIDENCE.length, 14);
  assert.ok(EVIDENCE.find(item => item.id === 'message').body.some(line => line.includes(PHONE_EXPORT.text)));
  assert.ok(EVIDENCE.find(item => item.id === 'report').body.some(line => line.includes('قبل 22:10')));
  assert.equal(STORAGE_KEY, 'last-call:v1');
  assert.deepEqual(ORDER, PUZZLES.map(puzzle => puzzle.id));
  let state = emptyState();
  assert.deepEqual(availableEvidence(state).map(item => item.id), ['scene', 'report', 'threat', 'loan', 'maintenance', 'reference']);
  for (const puzzle of PUZZLES) {
    const sources = availableEvidence(state).map(item => item.id);
    assert.equal(isUnlocked(state, puzzle.id), true);
    assert.ok(puzzle.evidence.every(id => sources.includes(id)), `source unavailable for ${puzzle.id}`);
    if (puzzle.id === 'confrontation') for (const person of PEOPLE) state = confront(state, person.id, person.confrontation.evidenceId).state;
    state = solve(state, puzzle.id, answers[puzzle.id]).state;
  }
  assert.equal(availableEvidence(state).length, 14);
});

test('a complete free journey rejects forward skips and only enables verdict after all six confrontations', () => {
  let state = emptyState();
  for (const [index, id] of ORDER.entries()) {
    assert.equal(nextPuzzle(state), id);
    assert.equal(accuse(state, verdict).ok, false);
    if (index < ORDER.length - 1) assert.equal(solve(state, ORDER[index + 1], answers[ORDER[index + 1]]).ok, false);
    if (id === 'confrontation') {
      assert.equal(solve(state, id, answers[id]).ok, false);
      for (const [personIndex, person] of PEOPLE.entries()) {
        const result = confront(state, person.id, person.confrontation.evidenceId);
        assert.equal(result.ok, true);
        assert.equal(result.message, person.confrontation.response);
        state = result.state;
        if (personIndex < PEOPLE.length - 1) assert.equal(solve(state, id, answers[id]).ok, false);
      }
      assert.equal(solve(state, id, { confirmed: false }).ok, false);
    }
    const next = solve(state, id, answers[id]);
    assert.equal(next.ok, true, next.message);
    state = JSON.parse(JSON.stringify(next.state));
  }
  assert.equal(nextPuzzle(state), null);
  assert.equal(accuse(state, verdict).ok, true);
  assert.deepEqual(accuse(state, verdict).state.accusation, verdict);
});

test('wrong guesses preserve progress and cannot unlock evidence or impersonate a confrontation', () => {
  const first = emptyState();
  assert.equal(confront(first, 'raed', 'gate').ok, false);
  assert.equal(confront(first, 'raed', 'loan').ok, false);
  assert.equal(confront(first, 'unknown', 'loan').ok, false);
  assert.equal(solve(first, 'photo', { hotspots: ['drive', 'ledger', 'ledger'] }).ok, false);
  let state = solve(first, 'photo', answers.photo).state;
  for (const wrong of [null, [], {}, { recorded: '22:17', delivered: '21:47', meaning: 'scheduled' }, { ...answers.message, meaning: 'live' }]) {
    const result = solve(state, 'message', wrong);
    assert.equal(result.ok, false);
    assert.deepEqual(result.state, state);
    assert.ok(!availableEvidence(result.state).some(item => item.id === 'message'));
  }
  state = solve(state, 'message', answers.message).state;
  assert.equal(solve(state, 'clock', { offset: -7, entry: '22:07', exit: '22:09' }).ok, false);
  assert.equal(solve(state, 'clock', { offset: 7, entry: '22:21', exit: '22:23' }).ok, false);
  state = solve(state, 'clock', answers.clock).state;
  assert.equal(solve(state, 'receipt', { ...answers.receipt, changed: 'phone' }).ok, false);
  assert.equal(solve(state, 'receipt', { ...answers.receipt, order: [...answers.receipt.order].reverse() }).ok, false);
  state = solve(state, 'receipt', answers.receipt).state;
  assert.equal(solve(state, 'custody', { order: [...answers.custody.order].reverse() }).ok, false);
});

test('clock and message times support Arabic and Persian digits without weakening required meanings', () => {
  let state = advance('photo');
  const message = solve(state, 'message', { recorded: '٢١:٤٧', delivered: '۲۲:۱۷', meaning: 'scheduled' });
  assert.equal(message.ok, true);
  state = message.state;
  assert.equal(solve(state, 'clock', { offset: '٧', entry: '٢٢:٠٧', exit: '۲۲:۰۹' }).ok, true);
  assert.equal(solve(state, 'clock', { offset: null, entry: '٢٢:٠٧', exit: '۲۲:۰۹' }).ok, false);
});

test('normalization ignores malformed and old saves, filters locked records, and drops unsupported completed verdict', () => {
  for (const input of [null, undefined, [], true, 'state', {}, { version: 'case-017' }]) assert.deepEqual(normalizeState(input), emptyState());
  const dirty = normalizeState({
    version: CASE_VERSION, solved: ['photo', 'clock', 'confrontation', 'unknown'], inspected: ['scene', 'gate', 'fake', 'scene'],
    confronted: ['sarah', 'raed', 'unknown', 'sarah'], notes: 'x'.repeat(5000), hints: { photo: 90, clock: 2, message: -3, fake: 3 },
    accusation: verdict, started: false,
  });
  assert.deepEqual(dirty.solved, ['photo']);
  assert.deepEqual(dirty.inspected, ['scene']);
  assert.deepEqual(dirty.confronted, ['sarah']);
  assert.deepEqual(dirty.hints, { photo: 3 });
  assert.equal(dirty.notes.length, 4000);
  assert.equal(dirty.started, true);
  assert.equal(dirty.accusation, null);
  const noInterviews = normalizeState({ ...advance('custody'), solved: ORDER, accusation: verdict });
  assert.deepEqual(noInterviews.solved, ORDER.slice(0, -1));
  assert.equal(noInterviews.accusation, null);
});

test('final evidence must support three distinct pillars and identify separate assault and concealment roles', () => {
  const state = advance('confrontation');
  for (const wrong of [null, { ...verdict, culprit: 'layan' }, { ...verdict, accomplice: 'mazen' }, { ...verdict, accomplice: 'raed' },
    { ...verdict, evidenceIds: ['access', 'ledger'] }, { ...verdict, evidenceIds: ['access', 'ledger', 'ledger'] },
    { ...verdict, evidenceIds: ['access', 'ledger', 'message', 'gate'] }, { ...verdict, evidenceIds: ['gate', 'ledger', 'message'] }]) {
    const result = accuse(state, wrong);
    assert.equal(result.ok, false);
    assert.equal(result.state.accusation, null);
  }
  const result = accuse(state, { ...verdict, evidenceIds: [...verdict.evidenceIds].reverse() });
  assert.equal(result.ok, true);
  assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(result.state))), result.state);
  assert.deepEqual(normalizeState({ ...result.state, accusation: { ...verdict, culprit: 'mazen' } }).accusation, null);
});

test('engine is immutable and repeated completed actions are idempotent', () => {
  const fresh = freeze(emptyState());
  assert.equal(solve(fresh, 'photo', freeze(answers.photo)).ok, true);
  assert.deepEqual(fresh, emptyState());
  const state = advance('confrontation');
  const frozen = freeze(structuredClone(state));
  assert.deepEqual(solve(frozen, 'photo', answers.photo).state, state);
  for (const person of PEOPLE) assert.deepEqual(confront(frozen, person.id, person.confrontation.evidenceId).state, state);
  const final = accuse(frozen, verdict).state;
  assert.deepEqual(accuse(freeze(final), verdict).state, final);
  assert.equal(solve(frozen, 'not-a-puzzle', {}).ok, false);
  assert.equal(isUnlocked(frozen, 'not-a-puzzle'), false);
});
