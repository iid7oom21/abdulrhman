import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCasePack,validateOpening,createCaseState,applyCaseAction,projectCaseState,validateCaseRequest} from '../src/case-engine.js';
import {fixturePack,action,L} from './fixtures/case.js';
const error = code => value => value.code === code;

test('projection exposes only current earned content and executable labels, never authority or future scenes', () => {
  const pack = validateCasePack(fixturePack()), state = createCaseState(pack), view = projectCaseState(pack,state);
  assert.deepEqual(view.materials,[]); assert.deepEqual(view.scene.lines,[]);
  assert.equal(view.actions.some(item => item.id === 'missing-false'),false);
  assert.equal(view.actions.some(item => item.id === 'share'),false);
  assert.doesNotMatch(JSON.stringify(view),/UNSEEN_MATERIAL_SENTINEL|FUTURE_SCENE_SENTINEL|GATED_LINE_SENTINEL|"effects"|"requires"|"target"|"flags"/);
  const next = applyCaseAction(pack,state,action(0,'read'));
  const shown = projectCaseState(pack,next);
  assert.deepEqual(shown.materials.map(item => item.id),['card']);
  assert.equal(shown.scene.lines[0].text.en,'GATED_LINE_SENTINEL');
  assert.deepEqual(shown.actions.find(item => item.id === 'draft').fields[2].options,[{value:'card',label:L('Card A')}]);
  assert.equal(state.revision,0); assert.deepEqual(state.materialIds,[]);
});

test('client cannot grant material, share unseen text, invent actions, or attach notes to an unknown source', () => {
  const pack = fixturePack(), initial = createCaseState(pack);
  assert.throws(() => validateCaseRequest({...action(0,'read'),effects:{grant:['sealed']}}),error('invalid_request'));
  assert.throws(() => applyCaseAction(pack,initial,action(0,'bad-share')),error('material_unavailable'));
  assert.throws(() => applyCaseAction(pack,initial,action(0,'finish')),error('action_unavailable'));
  const state = applyCaseAction(pack,initial,action(0,'read'));
  assert.throws(() => applyCaseAction(pack,state,action(1,'case.note',{text:'private',sourceId:'sealed'})),error('invalid_request'));
  const noted = applyCaseAction(pack,state,action(1,'case.note',{text:'PRIVATE_NOTE',sourceId:'card'}));
  assert.deepEqual(noted.shares,[]); assert.deepEqual(noted.notes,[{id:'note.operation-1',text:'PRIVATE_NOTE',sourceId:'card'}]);
  const shared = applyCaseAction(pack,noted,action(2,'share'));
  assert.deepEqual(shared.shares,[{materialId:'card',recipient:'guide',revision:3}]);
  assert.throws(() => applyCaseAction(pack,shared,action(2,'share')),error('revision_conflict'));
});

test('capture validation and immutable receipt copies preserve the original when a correction follows', () => {
  const pack = fixturePack(); let state = applyCaseAction(pack,createCaseState(pack),action(0,'read'));
  assert.throws(() => applyCaseAction(pack,state,action(1,'deposit')),error('capture_unavailable'));
  const values = {text:'First draft',position:'unknown',sources:['card']};
  for (const bad of [{...values,sources:['sealed']},{...values,position:'certain'},{...values,text:'x'.repeat(51)},{...values,recipient:'other'}, {...values,sources:['card','card']}]) {
    assert.throws(() => applyCaseAction(pack,state,action(1,'draft',bad)),error('invalid_request'));
  }
  state = applyCaseAction(pack,state,action(1,'draft',values));
  assert.deepEqual(state.captures.summary.fields[2].options,[{value:'card',label:L('Card A')}]);
  assert.doesNotMatch(JSON.stringify(state.captures),/"effects"|"requires"|"target"|sealed/);
  const before = structuredClone(state);
  assert.throws(() => applyCaseAction(pack,state,action(2,'correct')),error('receipt_unavailable'));
  assert.deepEqual(state,before);
  state = applyCaseAction(pack,state,action(2,'deposit'));
  const original = structuredClone(state.receipts[0]);
  assert.equal(original.fromCapture,'summary.revision.2');
  state = applyCaseAction(pack,state,action(3,'draft',{...values,text:'Corrected draft'}));
  state = applyCaseAction(pack,state,action(4,'correct'));
  assert.deepEqual(state.receipts[0],original);
  assert.equal(state.captures[original.fromCapture].values.text,'First draft');
  assert.equal(state.captures[state.receipts[1].fromCapture].values.text,'Corrected draft');
  assert.equal(state.receipts[1].relatesTo,original.id);
  assert.equal(state.receipts[1].scope,'story-only');
});

test('strict pack validation refuses active URLs, malformed options, authority extensions and reserved capture keys', () => {
  const mutations = [
    pack => { pack.scenes.desk.image = 'https://external.invalid/private.png'; },
    pack => { pack.scenes.desk.image = '/raven/deleted-name/assets/../secret.png'; },
    pack => { pack.scenes.desk.actions[4].fields[1].options = [null]; },
    pack => { pack.scenes.desk.actions[4].effects.capture = 'summary.revision.2'; },
    pack => { pack.scenes.desk.actions[0].effects.eval = 'anything'; },
    pack => { pack.scenes.desk.actions[0].target = ['end']; },
    pack => { pack.initialMaterials = [['card']]; },
    pack => { pack.authorTruth = 'FORBIDDEN'; },
  ];
  for (const mutate of mutations) { const pack = fixturePack(); mutate(pack); assert.throws(() => validateCasePack(pack),error('case_pack_invalid')); }
});

test('opening import is a declared local choice only, with no implied materials or delivered correction', () => {
  for (const choice of ['precise','lie']) for (const recipient of ['jonas','both','draft']) {
    const opening = validateOpening({version:'paper-opening-2026-11-05-r2',choice,recipient});
    const state = createCaseState(fixturePack(),opening);
    assert.equal(state.opening.scope,'imported-local-choice'); assert.equal(state.flags.opening_choice,choice);
    assert.deepEqual(state.materialIds,[]); assert.deepEqual(state.shares,[]);
  }
  for (const choice of ['wait','refuse']) assert.equal(validateOpening({version:'paper-opening-2026-11-05-r2',choice,recipient:null}).choice,choice);
  for (const opening of [
    {version:'old',choice:'wait',recipient:null},
    {version:'paper-opening-2026-11-05-r2',choice:'wait',recipient:'both'},
    {version:'paper-opening-2026-11-05-r2',choice:'precise',recipient:null},
    {version:'paper-opening-2026-11-05-r2',choice:'lie',recipient:'draft',materials:['sealed']},
  ]) assert.throws(() => validateOpening(opening),error('invalid_request'));
});
