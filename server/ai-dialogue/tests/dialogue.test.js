import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { submitRequest, listRequests, getRequest, makeRequestId, _reset, fingerprint } from '../src/dialogue.js';

describe('Dialogue Core', () => {
  beforeEach(() => {
    _reset();
  });

  it('generates predictable fingerprints for same content', () => {
    const f1 = fingerprint({ characterId: 'jonas', message: 'test', sharedFacts: [] });
    const f2 = fingerprint({ characterId: 'jonas', message: 'test', sharedFacts: [] });
    assert.equal(f1, f2);

    const f3 = fingerprint({ characterId: 'jonas', message: 'different', sharedFacts: [] });
    assert.notEqual(f1, f3);
  });

  it('rejects access to another users request', async () => {
    const reqId = makeRequestId();
    await submitRequest(reqId, 'jonas', 'hello', [], 'v1', 'userA');
    const existing = await submitRequest(reqId, 'jonas', 'hello', [], 'v1', 'userB');
    assert.equal(existing.error, 'forbidden');
  });

  it('returns 409 conflict for same request ID but different content', async () => {
    const reqId = makeRequestId();
    await submitRequest(reqId, 'jonas', 'first message', [], 'v1', 'userA');
    const existing = await submitRequest(reqId, 'jonas', 'second message', [], 'v1', 'userA');
    assert.equal(existing.error, 'request_id_conflict');
    assert.equal(existing.status, 'conflict');
  });

  it('returns cached (replayed) response for same request ID and same content', async () => {
    const reqId = makeRequestId();
    await submitRequest(reqId, 'jonas', 'same message', [], 'v1', 'userA');
    const existing = await submitRequest(reqId, 'jonas', 'same message', [], 'v1', 'userA');
    assert.equal(existing.replayed, true);
  });

  it('prevents concurrent duplicate processing by utilizing pending state', async () => {
     const reqId = makeRequestId();
     const p1 = submitRequest(reqId, 'jonas', 'concurrent message', [], 'v1', 'userA');
     // Start second one immediately while first is in 'pending' delay
     const p2 = submitRequest(reqId, 'jonas', 'concurrent message', [], 'v1', 'userA');

     const [res1, res2] = await Promise.all([p1, p2]);

     assert.equal(res1.replayed, false);
     assert.equal(res1.status, 'completed');

     assert.equal(res2.error, 'generation_in_progress');
     assert.equal(res2.status, 'conflict');
  });

  it('simulates reply for jonas based on allowed context', async () => {
    const reqId = makeRequestId();
    const res = await submitRequest(reqId, 'jonas', 'وش تعرف عن الظرف؟', [], 'v1', 'u1');
    assert.equal(res.response.refused, true);
    assert.match(res.response.text, /ما أعرف/);
  });
});
