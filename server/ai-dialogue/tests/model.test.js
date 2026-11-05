import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGroundedReply } from '../src/model.js';
import { simulateReply } from '../src/dialogue.js';

const received = {
  actor: 'jonas',
  materials: [{ id: 'm1', type: 'statement', text: 'قلت إن الباب كان مغلقاً.', author: 'player' }],
};

test('empty knowledge never calls the model', async () => {
  let called = false;
  const generate = createGroundedReply({
    apiKey: 'test',
    fetchImpl: async () => { called = true; throw new Error('must not be called'); },
    fallback: simulateReply,
  });
  const reply = await generate('claire', 'من ضرب فيكتور؟');
  assert.equal(called, false);
  assert.equal(reply.refused, true);
  assert.equal(reply.source, 'deterministic-fallback');
  assert.match(reply.text, /غير متاح/);
});

test('shared material is the only context sent, and invention is not required', async () => {
  let payload, auth;
  const generate = createGroundedReply({
    apiKey: 'secret-key',
    fetchImpl: async (_url, options) => {
      payload = JSON.parse(options.body);
      auth = options.headers.authorization;
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"text":"وصلني قولك عن الباب المغلق، وهذا تسجيل لا يثبت الواقعة.","refused":false}' } }] }) };
    },
  });
  const reply = await generate('jonas', 'وش وصلك؟', received);
  assert.equal(reply.source, 'grounded-model');
  assert.equal(reply.refused, false);
  assert.match(reply.text, /الباب/);
  assert.equal(payload.messages[1].content.includes('قلت إن الباب كان مغلقاً'), true);
  assert.equal(payload.messages[1].content.includes('"allowedKnowledge":[]'), true);
  assert.equal(auth, 'Bearer secret-key');
  assert.equal(JSON.stringify(payload).includes('secret-key'), false);
});

test('model failure falls back to the refusal', async () => {
  const generate = createGroundedReply({
    apiKey: 'test',
    fetchImpl: async () => { throw new Error('down'); },
  });
  const reply = await generate('jonas', 'وش وصلك؟', received);
  assert.equal(reply.source, 'deterministic-fallback');
  assert.equal(reply.refused, true);
});
