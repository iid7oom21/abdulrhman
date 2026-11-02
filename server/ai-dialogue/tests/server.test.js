import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createDialogueServer } from '../src/server.js';

let server;
let base;
before(async () => {
  server = createDialogueServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
const post = (body, cookie = '') =>
  fetch(`${base}/api/dialogue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
async function session() {
  const response = await fetch(base);
  const header = response.headers.get('set-cookie');
  assert.match(header, /HttpOnly; SameSite=Strict/);
  await response.text();
  return header.split(';')[0];
}

test('malformed fields are rejected and the server stays available', async () => {
  for (const payload of [
    null,
    [],
    { characterId: 'missing', message: 'hello' },
    { characterId: 'toString', message: 'hello' },
    { characterId: 'jonas', message: 42 },
    { characterId: 'jonas', message: 'hello', sharedFacts: 'bad' },
    { characterId: 'jonas', message: 'hello', sharedFacts: [null] },
  ]) {
    const response = await post(payload);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'invalid_fields');
  }
  const response = await post({ characterId: 'jonas', message: 'hello' });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).response);
});

test('invalid JSON, unsupported media, and oversized requests are rejected', async () => {
  const invalid = await fetch(`${base}/api/dialogue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(invalid.status, 400);
  await invalid.text();
  const wrongType = await fetch(`${base}/api/dialogue`, {
    method: 'POST',
    body: 'hello',
  });
  assert.equal(wrongType.status, 415);
  await wrongType.text();
  const huge = await post({
    characterId: 'jonas',
    message: 'x'.repeat(20 * 1024),
  });
  assert.equal(huge.status, 413);
  await huge.text();
});

test('a session cannot impersonate another owner through query, body, or cookie', async () => {
  const firstCookie = await session();
  const first = await post(
    {
      characterId: 'jonas',
      message: 'private question',
      requestId: 'private-id',
      ownerId: 'chosen-owner',
    },
    firstCookie,
  );
  const firstData = await first.json();
  assert.equal(first.status, 200);
  assert.notEqual(firstData.owner, 'chosen-owner');
  const secondCookie = await session();
  const history = await fetch(`${base}/api/history?owner=${firstData.owner}`, {
    headers: { Cookie: secondCookie },
  });
  assert.deepEqual((await history.json()).items, []);
  const replay = await post(
    {
      characterId: 'jonas',
      message: 'private question',
      requestId: 'private-id',
      ownerId: firstData.owner,
    },
    secondCookie,
  );
  assert.equal(replay.status, 403);
  await replay.text();
  const forged = await fetch(`${base}/api/history`, {
    headers: { Cookie: `raven_session=${firstData.owner}.${'0'.repeat(64)}` },
  });
  assert.deepEqual((await forged.json()).items, []);
  const own = await fetch(`${base}/api/history`, {
    headers: { Cookie: firstCookie },
  });
  assert.equal((await own.json()).items.length, 1);
});

test('replay is idempotent and modified content conflicts over HTTP', async () => {
  const cookie = await session();
  const body = {
    characterId: 'claire',
    message: 'مين رتب دعوتي',
    requestId: 'repeat-id',
  };
  await (await post(body, cookie)).json();
  const replay = await post(body, cookie);
  assert.equal((await replay.json()).replayed, true);
  const conflict = await post(
    { ...body, message: 'different question' },
    cookie,
  );
  assert.equal(conflict.status, 409);
  await conflict.text();
});
