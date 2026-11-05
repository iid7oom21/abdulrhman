import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createPreviewServer } from '../src/server.js';
import { _reset, simulateReply } from '../src/dialogue.js';

const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'raven-disk-')), 'store.json');
const start = async (t, options) => {
  const server = createPreviewServer(options);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const close = () => new Promise(r => server.close(r));
  return { root: `http://127.0.0.1:${server.address().port}`, close };
};
const post = (root, cookie, p, body) => fetch(root + p, { method:'POST', headers:{ cookie, 'content-type':'application/json' }, body:JSON.stringify(body) });
const get = (root, cookie, p) => fetch(root + p, { headers:{ cookie } });

test('reopening after the store is closed restores session, materials, shares and operations', async t => {
  const storeFile = tmpFile();
  _reset();
  const a = await start(t, { storeFile });
  const cookie = (await fetch(a.root)).headers.get('set-cookie').split(';')[0];
  assert.equal((await post(a.root, cookie, '/api/materials', { id:'s1', type:'statement', text:'قول' })).status, 200);
  assert.equal((await post(a.root, cookie, '/api/materials', { id:'c1', type:'correction', text:'تصحيح', originalId:'s1' })).status, 200);
  assert.equal((await post(a.root, cookie, '/api/shares', { eventId:'e1', materialId:'c1', recipients:['jonas'] })).status, 200);
  const first = await (await post(a.root, cookie, '/api/dialogue', { requestId:'op1', characterId:'jonas', message:'سؤال' })).json();
  await a.close();
  _reset(); // the dialogue module's process memory is gone, as after a restart

  const b = await start(t, { storeFile });
  t.after(b.close);
  const op = await (await get(b.root, cookie, '/api/operations/op1')).json();
  assert.equal(op.status, 'completed');
  assert.equal(op.createdAt, first.createdAt);
  assert.equal(op.contentVersion, first.contentVersion);
  assert.deepEqual(op.response, first.response);
  assert.equal(op.owner, undefined); assert.equal(op.fingerprint, undefined);
  const mats = await (await get(b.root, cookie, '/api/materials')).json();
  assert.deepEqual(mats.items.map(i => i.id).sort(), ['c1', 's1']);
  assert.equal(mats.events.length, 1);
  assert.equal(mats.persistence, 'disk-file');
  const known = await (await get(b.root, cookie, '/api/knowledge?characterId=jonas')).json();
  assert.deepEqual(known.materials.map(i => i.id), ['c1']); // the correction did not carry the original
  const hist = await (await get(b.root, cookie, '/api/history')).json();
  assert.equal(hist.items.length, 1);
  // another fresh session cannot read it
  const other = (await fetch(b.root)).headers.get('set-cookie').split(';')[0];
  assert.equal((await get(b.root, other, '/api/operations/op1')).status, 404);
});

test('409 request_id_conflict after reopening keeps the original; other owner is forbidden', async t => {
  const storeFile = tmpFile();
  _reset();
  const a = await start(t, { storeFile });
  const cookie = (await fetch(a.root)).headers.get('set-cookie').split(';')[0];
  await post(a.root, cookie, '/api/dialogue', { requestId:'op-c', characterId:'claire', message:'أصل' });
  await a.close(); _reset();
  const b = await start(t, { storeFile });
  t.after(b.close);
  const res = await post(b.root, cookie, '/api/dialogue', { requestId:'op-c', characterId:'claire', message:'مختلف' });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'request_id_conflict');
  assert.equal((await (await get(b.root, cookie, '/api/operations/op-c')).json()).message, 'أصل');
  const other = (await fetch(b.root)).headers.get('set-cookie').split(';')[0];
  assert.equal((await post(b.root, other, '/api/dialogue', { requestId:'op-c', characterId:'claire', message:'أصل' })).status, 403);
});

test('same id and fingerprint after reopening replays the stored reply without a second generation', async t => {
  const storeFile = tmpFile();
  let calls = 0;
  const generate = (...args) => { calls++; return simulateReply(...args); };
  _reset();
  const a = await start(t, { storeFile, generate });
  const cookie = (await fetch(a.root)).headers.get('set-cookie').split(';')[0];
  const body = { requestId:'op-r', characterId:'jonas', message:'سؤال' };
  assert.equal((await (await post(a.root, cookie, '/api/dialogue', body)).json()).replayed, false);
  assert.equal((await (await post(a.root, cookie, '/api/dialogue', body)).json()).replayed, true);
  await a.close(); _reset();
  const b = await start(t, { storeFile, generate });
  t.after(b.close);
  const again = await (await post(b.root, cookie, '/api/dialogue', body)).json();
  assert.equal(again.replayed, true);
  assert.equal(again.response.refused, true);
  assert.equal(again.response.text, 'النص الأصلي لهذه الإفادة غير متاح في هذه المعاينة. لا أستطيع تأكيد تفاصيل الواقعة أو إنشاء دليل من الحوار.');
  assert.equal(calls, 1);
});

test('an unreadable store file is left untouched and the server refuses to start', () => {
  const storeFile = tmpFile();
  fs.writeFileSync(storeFile, '{broken');
  assert.throws(() => createPreviewServer({ storeFile }), /incompatible_store_file/);
  assert.equal(fs.readFileSync(storeFile, 'utf8'), '{broken');
});

test('a real process restart with RAVEN_STORE_FILE keeps the operation', async () => {
  const storeFile = tmpFile();
  const entry = new URL('../src/server.js', import.meta.url).pathname;
  const port = 20000 + Math.floor(Math.random() * 20000);
  const boot = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry], { env:{ ...process.env, PORT:String(port), RAVEN_STORE_FILE:storeFile }, stdio:['ignore','pipe','inherit'] });
    child.stdout.on('data', d => { if (String(d).includes('RAVEN preview')) resolve(child); });
    child.on('error', reject);
  });
  const stop = child => new Promise(r => { child.on('exit', r); child.kill('SIGTERM'); });
  const root = `http://127.0.0.1:${port}`;
  let child = await boot();
  const cookie = (await fetch(root)).headers.get('set-cookie').split(';')[0];
  const first = await (await post(root, cookie, '/api/dialogue', { requestId:'proc', characterId:'jonas', message:'سؤال' })).json();
  await stop(child);
  child = await boot();
  try {
    const op = await (await get(root, cookie, '/api/operations/proc')).json();
    assert.equal(op.createdAt, first.createdAt);
    assert.equal((await post(root, cookie, '/api/dialogue', { requestId:'proc', characterId:'elena', message:'x' })).status, 400);
  } finally { await stop(child); }
});
