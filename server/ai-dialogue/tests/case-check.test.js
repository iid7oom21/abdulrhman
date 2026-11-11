import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {checkCasePack, summarizeCheck, OPENINGS} from '../src/case-check.js';
import {validateCasePack, validateOpening, createCaseState, applyCaseAction, gateAllows, CaseError} from '../src/case-engine.js';
import {fixturePack, L} from './fixtures/case.js';

const script = fileURLToPath(new URL('../scripts/check-case.mjs', import.meta.url));
const is = (flag, equals) => ({flag, equals});
const act = (id, extra = {}) => ({id, label: L('LABEL_' + id), ...extra});
const line = (text, requires) => ({speaker: L('Guide'), text: L(text), ...(requires ? {requires} : {})});

// Entirely fictional mechanics pack. Independent choices, a loop between two scenes, values
// that stay untouched across scenes, forms, captures and receipts: everything the check has
// to treat exactly. Options add one known fault each.
function mazePack({trap = false, deadEnd = false, refuse = false} = {}) {
  return {
    schemaVersion: 1, caseId: 'maze', contentVersion: 'maze-v1', locales: ['ar', 'en'], defaultLocale: 'ar',
    initialSceneId: 'a', initialFlags: {color: 'none', noted: false, side: 'x', marked: false, drafted: false, filed: false, ready: false}, initialMaterials: [],
    materials: {
      m1: {title: L('TITLE_M1'), body: L('BODY_M1'), type: 'document', source: L('SOURCE_M1')},
      m2: {title: L('TITLE_M2'), body: L('BODY_M2'), type: 'note', source: L('SOURCE_M2')},
    },
    scenes: {
      a: {title: L('TITLE_A'), body: L('BODY_A'),
        lines: [line('RED_LINE', is('color', 'red')), line('BLUE_LINE', is('color', 'blue')), line('WAITED_LINE', is('opening_choice', 'wait'))],
        actions: [
          act('red', {requires: is('color', 'none'), effects: {set: {color: 'red'}}}),
          act('blue', {requires: is('color', 'none'), effects: {set: {color: 'blue'}}}),
          act('note', {requires: is('noted', false), effects: {set: {noted: true}}}),
          act('take', {requires: {not: {hasMaterial: 'm1'}}, effects: {grant: ['m1']}}),
          act('go_b', {requires: {all: [{not: is('color', 'none')}, {hasMaterial: 'm1'}]}, target: 'b'}),
        ]},
      b: {title: L('TITLE_B'), body: L('BODY_B'), lines: [line('SIDE_Y_LINE', is('side', 'y'))],
        actions: [
          act('flip_y', {requires: is('side', 'x'), effects: {set: {side: 'y'}}}),
          act('flip_x', {requires: is('side', 'y'), effects: {set: {side: 'x'}}}),
          act('to_c', {target: 'c'}),
          act('draft', {requires: {hasMaterial: 'm1'}, fields: [
            {id: 'text', type: 'textarea', label: L('FIELD_TEXT'), required: true, maxLength: 40},
            {id: 'sources', type: 'materialRefs', label: L('FIELD_SOURCES'), required: true},
          ], effects: {capture: 'summary', set: {drafted: true}}}),
          act('go_d', {requires: {hasMaterial: 'm1'}, target: 'd'}),
          act('go_e', {requires: is('noted', true), target: 'e'}),
        ]},
      c: {title: L('TITLE_C'), body: L('BODY_C'), lines: [],
        actions: [act('mark', {requires: is('marked', false), effects: {set: {marked: true}, grant: ['m2']}}), act('back_b', {target: 'b'})]},
      d: {title: L('TITLE_D'), body: L('BODY_D'), lines: [line('MARKED_LINE', is('marked', true)), line('FILED_LINE', is('filed', true))],
        actions: [
          act('deposit', {requires: refuse ? is('filed', false) : {all: [is('drafted', true), is('filed', false)]},
            effects: {set: {filed: true}, receipt: {kind: 'submission', title: L('RECEIPT_TITLE'), fromCapture: 'summary'}}}),
          act('correct', {requires: is('filed', true), effects: {receipt: {kind: 'correction', title: L('CORRECTION_TITLE'), fromCapture: 'summary', relatesTo: 'submission'}}}),
          act('finish_red', {requires: is('color', 'red'), target: 'end_red'}),
          act('finish_other', {requires: {not: is('color', 'red')}, target: deadEnd ? 'g' : 'end_other'}),
        ]},
      e: {title: L('TITLE_E'), body: L('BODY_E'), lines: [],
        actions: [act('loop', {target: 'f'}), ...(trap ? [] : [act('out', {target: 'end_other'})])]},
      f: {title: L('TITLE_F'), body: L('BODY_F'), lines: [], actions: [act('loop_back', {target: 'e'})]},
      ...(deadEnd ? {g: {title: L('TITLE_G'), body: L('BODY_G'), lines: [], actions: [act('never', {requires: is('ready', true), target: 'end_other'})]}} : {}),
      end_red: {title: L('TITLE_END_RED'), body: L('BODY_END_RED'), lines: [line('MARKED_END', is('marked', true))], actions: []},
      end_other: {title: L('TITLE_END_OTHER'), body: L('BODY_END_OTHER'), lines: [], actions: []},
    },
  };
}

// Reference search with no shortcuts: every distinct full state is visited.
function everyState(input, openings = OPENINGS) {
  const pack = validateCasePack(input), nodes = new Map(), queue = [];
  const found = {scenes: new Set(), actions: new Set(), lines: new Set(), materials: new Set(), endings: new Set(), deadEnds: new Set(), refused: new Set(), trapped: new Set()};
  const keyOf = state => JSON.stringify([state.sceneId, Object.keys(state.flags).sort().map(flag => [flag, state.flags[flag]]), [...state.materialIds].sort(),
    Object.keys(state.captures).filter(key => !/\.revision\.\d+$/.test(key)).sort(), [...new Set(state.receipts.map(receipt => receipt.kind))].sort()]);
  const visit = state => { const key = keyOf(state); if (!nodes.has(key)) { nodes.set(key, {scene: state.sceneId, next: new Set(), ending: false, stuck: false}); queue.push([key, state]); } return key; };
  for (const opening of openings) visit(createCaseState(pack, validateOpening(opening)));
  for (let index = 0, operation = 0; index < queue.length; index++) {
    const [key, state] = queue[index], node = nodes.get(key), scene = pack.scenes[state.sceneId];
    found.scenes.add(state.sceneId); state.materialIds.forEach(id => found.materials.add(id));
    (scene.lines || []).forEach((item, position) => { if (gateAllows(item.requires, state)) found.lines.add(state.sceneId + '#' + position); });
    let moved = false;
    for (const action of scene.actions.filter(item => gateAllows(item.requires, state))) {
      const values = {};
      for (const field of action.fields || []) values[field.id] = field.type === 'materialRefs' ? state.materialIds.slice(0, 1) : field.type === 'select' ? field.options[0].value : 'x';
      // A required source list with nothing to tick cannot be submitted from the page at all.
      if ((action.fields || []).some(field => field.type === 'materialRefs' && field.required) && !state.materialIds.length) {
        found.refused.add(state.sceneId + '/' + action.id + ':no_material_for_required_sources'); continue;
      }
      try {
        const next = applyCaseAction(pack, state, {id: 'reference-' + operation++, revision: state.revision, contentVersion: pack.contentVersion, actionId: action.id, values});
        found.actions.add(state.sceneId + '/' + action.id); moved = true; node.next.add(visit(next));
      } catch (error) {
        if (!(error instanceof CaseError)) throw error;
        found.refused.add(state.sceneId + '/' + action.id + ':' + error.code);
      }
    }
    if (scene.actions.length === 0) { node.ending = true; found.endings.add(state.sceneId); }
    else if (!moved) { node.stuck = true; found.deadEnds.add(state.sceneId); }
  }
  const before = new Map();
  for (const [key, node] of nodes) for (const next of node.next) { if (!before.has(next)) before.set(next, []); before.get(next).push(key); }
  const alive = new Set([...nodes].filter(([, node]) => node.ending).map(([key]) => key));
  for (const pending = [...alive]; pending.length;) for (const previous of before.get(pending.pop()) || []) if (!alive.has(previous)) { alive.add(previous); pending.push(previous); }
  for (const [key, node] of nodes) if (!alive.has(key) && !node.stuck) found.trapped.add(node.scene);
  return {...found, states: nodes.size};
}
function agrees(pack) {
  const report = checkCasePack(pack), reference = everyState(pack), sorted = values => [...values].sort();
  assert.equal(report.exhaustive, true);
  // Values no later scene reads are not counted twice, so the covered count never exceeds the full one.
  assert.ok(report.statesExplored <= report.statesCovered && report.statesCovered <= reference.states);
  assert.deepEqual(sorted(Object.keys(pack.scenes).filter(id => !report.scenes.neverReached.includes(id))), sorted(reference.scenes));
  assert.deepEqual(report.actions.run, reference.actions.size);
  assert.deepEqual(sorted(report.actions.neverRun.map(item => item.scene + '/' + item.action)),
    sorted(Object.entries(pack.scenes).flatMap(([scene, value]) => value.actions.map(action => scene + '/' + action.id)).filter(label => !reference.actions.has(label))));
  assert.equal(report.lines.shown, reference.lines.size);
  assert.deepEqual(sorted(Object.keys(pack.materials).filter(id => !report.materials.neverHeld.includes(id))), sorted(reference.materials));
  assert.deepEqual(sorted(report.endings.map(item => item.scene)), sorted(reference.endings));
  assert.deepEqual(sorted(report.deadEnds.map(item => item.scene)), sorted(reference.deadEnds));
  assert.deepEqual(sorted(report.trapped.map(item => item.scene)), sorted(reference.trapped));
  assert.deepEqual(sorted(report.refusedActions.map(item => item.scene + '/' + item.action + ':' + item.code)), sorted(reference.refused));
  return report;
}

test('a sound pack is fully covered, and the shortened search finds exactly what a full search finds', () => {
  const report = agrees(mazePack());
  assert.equal(report.ok, true); assert.equal(report.problems, 0);
  assert.deepEqual(report.endings.map(item => item.scene).sort(), ['end_other', 'end_red']);
  assert.ok(report.statesExplored < report.statesCovered, 'untouched values must not multiply the explored states');
  assert.equal(report.openingsChecked, OPENINGS.length);
});

test('each known fault is found where a full search finds it, with a path a writer can follow', () => {
  const trap = agrees(mazePack({trap: true}));
  assert.equal(trap.ok, false); assert.deepEqual(trap.trapped.map(item => item.scene).sort(), ['e', 'f']);
  const stuck = agrees(mazePack({deadEnd: true}));
  assert.equal(stuck.ok, false); assert.deepEqual(stuck.deadEnds.map(item => item.scene), ['g']);
  assert.deepEqual(stuck.deadEnds[0].path.slice(-2), ['go_d', 'finish_other']);
  assert.deepEqual(stuck.actions.neverRun, [{scene: 'g', action: 'never'}]);
  const refused = agrees(mazePack({refuse: true}));
  assert.equal(refused.ok, false);
  assert.deepEqual(refused.refusedActions, [{scene: 'd', action: 'deposit', code: 'capture_unavailable'}]);
});

test('the engine fixture: authored faults are reported as structure, refusals and unreachable choices', () => {
  const report = agrees(fixturePack());
  assert.equal(report.ok, false);
  assert.deepEqual(report.structure.undefinedFlags, ['not_initialized']);
  assert.deepEqual(report.structure.materialsNeverGranted, ['sealed']);
  assert.deepEqual(report.actions.neverRun, [{scene: 'desk', action: 'missing-false'}, {scene: 'desk', action: 'bad-share'}]);
  assert.ok(report.refusedActions.some(item => item.action === 'bad-share' && item.code === 'material_unavailable'));
  assert.ok(report.refusedActions.some(item => item.action === 'deposit' && item.code === 'capture_unavailable'));
});

test('structure faults that no play-through shows: impossible values, receipts without a source or an earlier kind', () => {
  const pack = mazePack();
  pack.scenes.a.lines.push(line('NEVER_LINE', is('color', 'green')));
  pack.scenes.d.actions.push(act('orphan', {requires: is('filed', true), effects: {receipt: {kind: 'loose', title: L('LOOSE'), fromCapture: 'missing', relatesTo: 'absent'}}}));
  const report = checkCasePack(pack);
  assert.deepEqual(report.structure.impossibleValues, [{scene: 'a', line: 3, flag: 'color'}]);
  assert.deepEqual(report.structure.receiptsWithoutCapture, [{scene: 'd', action: 'orphan'}]);
  assert.deepEqual(report.structure.receiptsWithoutEarlierKind, [{scene: 'd', action: 'orphan'}]);
  assert.deepEqual(report.lines.neverShown, [{scene: 'a', line: 3}]);
  assert.equal(report.ok, false);
});

test('a search cut short is never reported as a clean result', () => {
  const report = checkCasePack(mazePack(), {maxStates: 5});
  assert.equal(report.exhaustive, false); assert.equal(report.ok, false);
  assert.deepEqual(report.trapped, []);
  assert.equal(summarizeCheck(report).exhaustive, false);
});

test('reports carry identifiers and counts, never titles, bodies, lines, labels or field text', () => {
  for (const pack of [mazePack(), mazePack({trap: true, deadEnd: true, refuse: true}), fixturePack()]) {
    const report = checkCasePack(pack);
    for (const text of [JSON.stringify(report), JSON.stringify(summarizeCheck(report))]) {
      assert.doesNotMatch(text, /TITLE_|BODY_|SOURCE_|LABEL_|FIELD_|_LINE|RECEIPT_TITLE|PUBLIC_CARD_BODY|SENTINEL|Read card|Compare a card|Fixture/);
    }
    assert.doesNotMatch(JSON.stringify(summarizeCheck(report)), /"(?:a|b|c|d|e|f|g|desk|end)"|go_|finish|deposit/);
  }
});

test('the command reads a private pack only, prints counts, and keeps the detailed report out of Git', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'raven-case-check-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], {encoding: 'utf8'});
  const sound = path.join(directory, 'raven-case-content.json'), faulty = path.join(directory, 'faulty.json'), report = path.join(directory, 'PRIVATE-QA-maze.json');
  fs.writeFileSync(sound, JSON.stringify(mazePack()));
  fs.writeFileSync(faulty, JSON.stringify(mazePack({deadEnd: true})));

  const clean = run('--content', sound, '--report', report);
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /"ok": true/); assert.doesNotMatch(clean.stdout, /end_red|go_b|TITLE_|LABEL_/);
  assert.equal(fs.statSync(report).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(fs.readFileSync(report, 'utf8')).endings.map(item => item.scene).sort(), ['end_other', 'end_red']);

  const broken = run('--content', faulty);
  assert.equal(broken.status, 1); assert.match(broken.stdout, /"deadEnds": 1/); assert.doesNotMatch(broken.stdout, /"g"|finish_other/);
  assert.equal(run('--content', sound, '--max-states', '5').status, 1);

  const checkout = path.dirname(script), inside = path.join(checkout, 'PRIVATE-QA-refused.json');
  const refusedReport = run('--content', sound, '--report', inside);
  assert.equal(refusedReport.status, 2); assert.equal(fs.existsSync(inside), false);
  const copied = path.join(checkout, 'raven-case-content.json');
  t.after(() => fs.rmSync(copied, {force: true}));
  fs.writeFileSync(copied, JSON.stringify(mazePack()));
  assert.equal(run('--content', copied).status, 2);
  assert.equal(run().status, 2);
  assert.equal(run('--content', sound, '--max-states', 'many').status, 2);
  assert.equal(run('--content', path.join(directory, 'absent.json')).status, 2);
});
