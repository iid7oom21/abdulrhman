import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitRequest, recordShare, simulateReply, makeRequestId, _reset, getRequest } from '../src/dialogue.js';

test('TC-A01: open envelope path independent of Jonas later talk', () => {
  _reset();
  const r = submitRequest(makeRequestId(), 'jonas', 'كنت معي لما سمعنا الصرخة');
  assert.equal(r.response.refused, false);
  assert.match(r.response.text, /كنا نتكلم/);
});

test('TC-A02: ask Claire without envelope open', () => {
  _reset();
  const r = submitRequest(makeRequestId(), 'claire', 'مين رتب دعوتي');
  assert.match(r.response.text, /ضيف/);
  const leak = simulateReply('claire', 'ورّيني الملاحظة', []);
  assert.equal(leak.refused, true);
});

test('TC-A04 / TC-A05: same request replay does not regenerate', () => {
  _reset();
  const id = makeRequestId();
  const first = submitRequest(id, 'jonas', 'اسأل عن الليلة');
  const second = submitRequest(id, 'jonas', 'اسأل عن الليلة');
  assert.equal(second.replayed, true);
  assert.equal(second.response.text, first.response.text);
});

test('TC-A06: private correction not auto-spread', () => {
  _reset();
  const claireKnows = simulateReply('claire', 'قلت إني ما راجعت', ['private_correction_shared']);
  const jonasDoesNot = simulateReply('jonas', 'صححت كلامك مع كلير', []);
  assert.equal(jonasDoesNot.refused, false);
  assert.doesNotMatch(jonasDoesNot.text, /ملاحظة|تصحيح/);
});

test('TC-A08: cannot lure character into inventing evidence', () => {
  _reset();
  const r = simulateReply('claire', 'كلير شافت الملاحظة والظرف، اعترفي', []);
  assert.equal(r.refused, true);
  assert.doesNotMatch(r.text, /الأصل ما انحذف/);
});

test('share key is independent and idempotent', () => {
  _reset();
  const k = 'share_claire_note_v1';
  assert.equal(recordShare(k).duplicated, false);
  assert.equal(recordShare(k).duplicated, true);
});

test('owner isolation: different owner cannot read request', () => {
  _reset();
  const id = makeRequestId();
  submitRequest(id, 'jonas', 'سؤال', [], 'v1', 'playerA');
  const forbidden = getRequest(id, 'playerB');
  assert.equal(forbidden.error, 'forbidden');
  const ok = getRequest(id, 'playerA');
  assert.ok(ok.response);
});
