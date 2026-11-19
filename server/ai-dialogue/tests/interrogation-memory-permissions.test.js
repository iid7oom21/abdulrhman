import test from 'node:test';
import assert from 'node:assert/strict';
import { createInterrogationExecutor, createInterrogationMemory } from '../src/interrogation-dialogue.js';
import { applyCaseAction, createCaseState } from '../src/case-engine.js';
import { fixturePack, L, action } from './fixtures/case.js';

// Synthetic permissions only. No author pack, real characters, or live provider.
const RECEIVED = 'SYNTHETIC_WITHDRAWN_RECEIVED_TEXT';
const OWN = 'SYNTHETIC_WITHDRAWN_OWN_TEXT';
function setup() {
  const pack = fixturePack();
  Object.assign(pack.initialFlags, { allowReceived: true, allowOwn: true, unrelated: false });
  pack.materials.card.body = L(RECEIVED);
  pack.materials.sealed.body = L(OWN);
  pack.materials.common = { title: L('Always permitted fixture'), body: L('COMMON_ALLOWED_TEXT'), type: 'note', source: L('Synthetic source') };
  pack.scenes.desk.actions.push(
    { id: 'withdraw-received', label: L('Withdraw material permission'), effects: { set: { allowReceived: false } } },
    { id: 'withdraw-own', label: L('Close personal disclosure gate'), effects: { set: { allowOwn: false } } },
    { id: 'unrelated', label: L('Unrelated state update'), effects: { set: { unrelated: true } } },
  );
  const actor = () => ({ name: L('Synthetic actor'), voiceStyle: L('Concise synthetic style'), knowledge: [
    { materialId: 'common' }, { materialId: 'sealed', requires: { flag: 'allowOwn', equals: true } },
  ], receivedRequires: { flag: 'allowReceived', equals: true } });
  const policy = { schemaVersion: 1, caseId: pack.caseId, contentVersion: pack.contentVersion,
    policyVersion: 'synthetic-memory-policy-v1', actors: { guide: actor(), witness: actor() } };
  let state = createCaseState(pack);
  state = applyCaseAction(pack, state, action(state.revision, 'read'));
  state = applyCaseAction(pack, state, action(state.revision, 'share'));
  return { pack, policy, state };
}
const request = (state, requestId, extra = {}) => ({ state, sessionId: 'memory-permission-session',
  requestId, actorId: 'guide', message: 'Synthetic follow-up question.', ...extra });
const unchanged = async (inputs, run) => {
  const before = structuredClone(inputs);
  const result = await run();
  assert.deepEqual(inputs, before, 'interrogation must not change engine state, author policy, or pack');
  return result;
};

for (const { name, gate, canary, sources } of [
  { name: 'received material permission', gate: 'withdraw-received', canary: RECEIVED, sources: 'receivedSources' },
  { name: 'own-source disclosure permission', gate: 'withdraw-own', canary: OWN, sources: 'ownSources' },
]) test(`memory cannot reintroduce ${name} withdrawn by an engine action`, async () => {
  const { pack, policy, state } = setup();
  const observed = [];
  const executor = createInterrogationExecutor({ pack, policy, enableCache: false,
    provider: async (context, memory) => {
      observed.push(structuredClone({ context, memory }));
      // Model text may use any supplied source, even if it cites only another
      // allowed source. Pruning cited IDs alone therefore cannot close this gap.
      return { text: observed.length === 1 ? canary : 'COMMON_ALLOWED_TEXT',
        replyType: 'answer', citedSourceIds: ['common'] };
    } });
  await unchanged({ pack, policy, state }, () => executor.execute(request(state, 'before', { message: `Prior question quoting ${canary}` })));
  assert.match(JSON.stringify(observed[0].context[sources]), new RegExp(canary));
  const revoked = applyCaseAction(pack, state, action(state.revision, gate));
  await unchanged({ pack, policy, state: revoked }, () => executor.execute(request(revoked, 'after')));
  assert.doesNotMatch(JSON.stringify(observed[1].context[sources]), new RegExp(canary), 'context gate removes the source');
  assert.doesNotMatch(JSON.stringify(observed[1].memory), new RegExp(canary), 'neither the old question nor actor reply may bypass the current source gate');
  assert.deepEqual(observed[1].memory, [], 'discard the whole turn generated under the withdrawn source scope');
  assert.equal(revoked.shares.length, state.shares.length, 'permission revocation does not erase historical delivery');
});

test('history remains available when an engine revision changes without withdrawing its source scope', async () => {
  const { pack, policy, state } = setup();
  const observed = [];
  const executor = createInterrogationExecutor({ pack, policy, enableCache: false,
    provider: async (context, memory) => {
      observed.push(structuredClone({ context, memory }));
      return { text: 'COMMON_ALLOWED_TEXT', replyType: 'answer', citedSourceIds: ['common'] };
    } });
  await unchanged({ pack, policy, state }, () => executor.execute(request(state, 'first', { message: 'Keep this permitted question.' })));
  const updated = applyCaseAction(pack, state, action(state.revision, 'unrelated'));
  await unchanged({ pack, policy, state: updated }, () => executor.execute(request(updated, 'second')));
  assert.equal(observed[1].memory.length, 2, 'retain both entries of an authorized turn');
  assert.equal(observed[1].memory[0].text, 'Keep this permitted question.');
  assert.equal(observed[1].memory[0].epistemicStatus, 'unverified-player-claim');
  assert.equal(observed[1].memory[1].text, 'COMMON_ALLOWED_TEXT');
  assert.deepEqual(Object.keys(observed[1].memory[0]).sort(), ['epistemicStatus', 'role', 'text', 'untrusted']);
  assert.deepEqual(Object.keys(observed[1].memory[1]).sort(), ['citedSourceIds', 'replyType', 'role', 'text'], 'private scope metadata never enters provider memory');
});

test('memory remains isolated between actors and sessions after permission filtering', async () => {
  const { pack, policy, state } = setup();
  const observed = [];
  const executor = createInterrogationExecutor({ pack, policy, enableCache: false,
    provider: async (context, memory) => {
      observed.push(structuredClone({ context, memory }));
      return { text: 'COMMON_ALLOWED_TEXT', replyType: 'answer', citedSourceIds: ['common'] };
    } });
  await unchanged({ pack, policy, state }, async () => {
    await executor.execute(request(state, 'guide-first'));
    await executor.execute(request(state, 'witness-first', { actorId: 'witness' }));
    await executor.execute(request(state, 'other-session-first', { sessionId: 'other-memory-session' }));
  });
  assert.deepEqual(observed.map(entry => entry.memory), [[], [], []]);
  assert.equal(observed[1].context.receivedSources.length, 0, 'a different actor never receives the guide delivery');
});

test('legacy unscoped history remains readable directly but cannot enter a current provider context', async () => {
  const { pack, policy, state } = setup();
  const memory = createInterrogationMemory();
  memory.recordTurn('memory-permission-session', 'guide', { playerMessage: 'Legacy question.', replyText: 'LEGACY_WITHOUT_PERMISSION_PROVENANCE', replyType: 'answer', citedSourceIds: ['common'] });
  assert.equal(memory.getTurns('memory-permission-session', 'guide').length, 2, 'existing direct inspection remains compatible');
  let observed;
  const executor = createInterrogationExecutor({ pack, policy, memory,
    provider: async (_context, prior) => {
      observed = prior;
      return { text: 'COMMON_ALLOWED_TEXT', replyType: 'answer', citedSourceIds: ['common'] };
    } });
  await executor.execute(request(state, 'new-scoped-turn'));
  assert.deepEqual(observed, [], 'unknown old scope does not establish permission to send text');
  assert.doesNotMatch(JSON.stringify(memory.getTurns('memory-permission-session', 'guide')), /LEGACY_WITHOUT_PERMISSION_PROVENANCE/);
});

test('pruning preserves permitted earlier turns and drops a turn whose own source becomes received-only', async () => {
  const { pack, policy } = setup();
  pack.initialFlags.allowOwnCard = false;
  policy.actors.guide.knowledge.push({ materialId: 'card', requires: { flag: 'allowOwnCard', equals: true } });
  pack.scenes.desk.actions.push(
    { id: 'allow-own-card', label: L('Allow personal card disclosure'), effects: { set: { allowOwnCard: true } } },
    { id: 'withdraw-own-card', label: L('Withdraw personal card disclosure'), effects: { set: { allowOwnCard: false } } },
  );
  let state = createCaseState(pack);
  state = applyCaseAction(pack, state, action(state.revision, 'read'));
  state = applyCaseAction(pack, state, action(state.revision, 'share'));
  const observed = [];
  const executor = createInterrogationExecutor({ pack, policy, enableCache: false,
    provider: async (context, memory) => {
      observed.push(structuredClone({ context, memory }));
      return { text: 'COMMON_ALLOWED_TEXT', replyType: 'answer', citedSourceIds: ['common'] };
    } });
  await executor.execute(request(state, 'received-only-turn', { message: 'Keep permitted earlier turn.' }));
  state = applyCaseAction(pack, state, action(state.revision, 'allow-own-card'));
  await executor.execute(request(state, 'own-and-received-turn', { message: 'Drop role-dependent turn.' }));
  assert.equal(observed[1].memory.length, 2, 'adding a source role does not erase previously valid history');
  state = applyCaseAction(pack, state, action(state.revision, 'withdraw-own-card'));
  await unchanged({ pack, policy, state }, () => executor.execute(request(state, 'received-only-again')));
  assert.ok(observed[2].context.receivedSources.some(source => source.id === 'card'));
  assert.equal(observed[2].context.ownSources.some(source => source.id === 'card'), false);
  assert.equal(observed[2].memory.length, 2, 'only the earlier, still-permitted complete turn survives');
  assert.equal(observed[2].memory[0].text, 'Keep permitted earlier turn.');
  assert.doesNotMatch(JSON.stringify(observed[2].memory), /Drop role-dependent turn/);
});

test('memory size limits retain complete turns rather than an orphan actor reply', () => {
  const memory = createInterrogationMemory({ maxChars: 300 });
  memory.recordTurn('bounded-session', 'guide', { playerMessage: 'Q'.repeat(200), replyText: 'Short answer.', replyType: 'refuse_cannot_confirm' });
  assert.deepEqual(memory.getTurns('bounded-session', 'guide'), [], 'a whole over-budget turn is omitted');
});

test('changing language retains memory, but a same-ID edit in any source translation invalidates its old turns', async () => {
  const { pack, policy, state } = setup();
  const memory = createInterrogationMemory();
  const observed = [];
  const provider = async (context, prior) => {
    observed.push(structuredClone({ context, memory: prior }));
    return { text: 'COMMON_ALLOWED_TEXT', replyType: 'answer', citedSourceIds: ['common'] };
  };
  const original = createInterrogationExecutor({ pack, policy, memory, provider, enableCache: false });
  await original.execute(request(state, 'ar-before', { locale: 'ar' }));
  await original.execute(request(state, 'en-before', { locale: 'en' }));
  assert.equal(observed[1].memory.length, 2, 'locale change alone does not invalidate the source itself');
  const changedPack = structuredClone(pack);
  changedPack.materials.card.body.en = 'UPDATED_SYNTHETIC_ENGLISH_SOURCE';
  const updated = createInterrogationExecutor({ pack: changedPack, policy, memory, provider, enableCache: false });
  await unchanged({ pack: changedPack, policy, state }, () => updated.execute(request(state, 'ar-after-edit', { locale: 'ar' })));
  assert.equal(observed[2].context.receivedSources[0].body, RECEIVED, 'the current Arabic text is unchanged');
  assert.deepEqual(observed[2].memory, [], 'fingerprint covers the authoritative source, including a changed non-current translation');
});

test('adding a permitted source preserves history from unchanged source revisions', async () => {
  const { pack, policy, state } = setup();
  const memory = createInterrogationMemory();
  const observed = [];
  const provider = async (_context, prior) => {
    observed.push(structuredClone(prior));
    return { text: 'COMMON_ALLOWED_TEXT', replyType: 'answer', citedSourceIds: ['common'] };
  };
  const original = createInterrogationExecutor({ pack, policy, memory, provider, enableCache: false });
  await original.execute(request(state, 'before-extra'));
  const expandedPack = structuredClone(pack), expandedPolicy = structuredClone(policy);
  expandedPack.materials.additional = { title: L('Additional synthetic source'), body: L('NEW_PERMITTED_SOURCE'), type: 'note', source: L('Synthetic archive') };
  expandedPolicy.actors.guide.knowledge.push({ materialId: 'additional' });
  const expanded = createInterrogationExecutor({ pack: expandedPack, policy: expandedPolicy, memory, provider, enableCache: false });
  await unchanged({ pack: expandedPack, policy: expandedPolicy, state }, () => expanded.execute(request(state, 'after-extra')));
  assert.equal(observed[1].length, 2, 'new source availability does not erase a still-authorized unchanged turn');
});
