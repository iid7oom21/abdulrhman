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

test('receipt review projects the exact earned capture, shares and prior receipt without executing effects', () => {
  const pack = fixturePack(), deposit = pack.scenes.desk.actions.find(item => item.id === 'deposit');
  deposit.effects.share = [{materialId:'card',recipient:'guide'},{materialId:'card',recipient:'clerk'}];
  deposit.effects.set = {private_author_flag:'UNPROJECTED_EFFECT_SENTINEL'};
  deposit.effects.grant = ['sealed'];
  let state = applyCaseAction(pack,createCaseState(pack),action(0,'read'));
  assert.equal(projectCaseState(pack,state).actions.find(item => item.id === 'deposit').receiptPreview,undefined);
  state = applyCaseAction(pack,state,action(1,'draft',{text:'First draft',position:'unknown',sources:['card']}));
  const before = structuredClone(state), shown = projectCaseState(pack,state);
  const preview = shown.actions.find(item => item.id === 'deposit').receiptPreview;
  assert.deepEqual(state,before);
  assert.deepEqual(preview,{kind:'submission',title:L('Fictional acknowledgement'),scope:'story-only',
    fromCapture:'summary.revision.2',capture:state.captures.summary,shares:deposit.effects.share,materials:[{id:'card',title:L('Card A')}]});
  assert.equal(shown.actions.find(item => item.id === 'correct').receiptPreview,undefined);
  assert.doesNotMatch(JSON.stringify(preview),/UNPROJECTED_EFFECT_SENTINEL|sealed|"effects"|"target"|"flags"|"requires"|receipt\.operation/);
  assert.throws(() => validateCaseRequest({...action(2,'deposit'),receiptPreview:preview}),error('invalid_request'));
  const deposited = applyCaseAction(pack,state,action(2,'deposit'));
  assert.equal(deposited.receipts[0].fromCapture,preview.fromCapture);
  assert.deepEqual(deposited.captures[preview.fromCapture],preview.capture);
  assert.deepEqual(deposited.shares.map(({revision,...share}) => share),preview.shares);
  preview.capture.values.text = 'Client-only change'; preview.materials[0].title.en = 'Client-only title';
  assert.deepEqual(state,before);
  state = applyCaseAction(pack,deposited,action(3,'draft',{text:'Correction',position:'partial',sources:['card']}));
  const correction = projectCaseState(pack,state).actions.find(item => item.id === 'correct').receiptPreview;
  assert.equal(correction.relatesTo,deposited.receipts[0].id);
  assert.equal(correction.capture.values.text,'Correction');
  assert.equal(correction.fromCapture,'summary.revision.4');
  assert.throws(() => applyCaseAction(pack,state,action(3,'correct',{},'stale-review')),error('revision_conflict'));
  const corrected = applyCaseAction(pack,state,action(4,'correct'));
  assert.equal(corrected.receipts[1].relatesTo,correction.relatesTo);
  assert.deepEqual(corrected.captures[corrected.receipts[1].fromCapture],correction.capture);
  assert.equal(corrected.captures[deposited.receipts[0].fromCapture].values.text,'First draft');
});

test('receipt reviews omit unavailable or new data and never reveal a gated receipt action', () => {
  const pack = fixturePack();
  pack.scenes.desk.actions.push(
    {id:'receipt-only',label:L('Receipt only'),effects:{receipt:{kind:'notice',title:L('Notice')}}},
    {id:'grant-and-receipt',label:L('Receive a card'),effects:{grant:['sealed'],share:[{materialId:'sealed',recipient:'unknown-recipient'}],receipt:{kind:'notice',title:L('Notice')}}},
    {id:'new-capture-receipt',label:L('New capture'),effects:{capture:'new',receipt:{kind:'notice',title:L('Notice'),fromCapture:'new'}}},
    {id:'gated-receipt',label:L('HIDDEN_RECEIPT_LABEL'),requires:{flag:'not_initialized',equals:true},effects:{receipt:{kind:'hidden',title:L('HIDDEN_RECEIPT_TITLE')}}},
  );
  const state = createCaseState(validateCasePack(pack)), view = projectCaseState(pack,state);
  assert.deepEqual(view.actions.find(item => item.id === 'receipt-only').receiptPreview,{kind:'notice',title:L('Notice'),scope:'story-only',shares:[],materials:[]});
  for (const id of ['grant-and-receipt','new-capture-receipt','deposit','correct']) assert.equal(view.actions.find(item => item.id === id).receiptPreview,undefined);
  assert.doesNotMatch(JSON.stringify(view),/unknown-recipient|HIDDEN_RECEIPT|UNSEEN_MATERIAL_SENTINEL/);
  assert.equal(state.revision,0); assert.deepEqual(state.captures,{}); assert.deepEqual(state.receipts,[]); assert.deepEqual(state.shares,[]);
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
