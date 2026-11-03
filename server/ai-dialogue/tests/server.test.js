import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createPreviewServer } from '../src/server.js';

test('HTTP sessions, concurrent idempotency, validation, private history and read-only polling', async t => {
  const server = createPreviewServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const root = `http://127.0.0.1:${server.address().port}`;
  const session = async () => (await fetch(root)).headers.get('set-cookie').split(';')[0];
  const a = await session(), b = await session();
  const post = (payload, cookie = a) => fetch(root + '/api/dialogue', {method:'POST', headers:{cookie,'content-type':'application/json'}, body:JSON.stringify(payload)});
  assert.equal((await fetch(root+'/api/history?owner=a')).status,401);
  const payload = {requestId:'http-test',characterId:'jonas',message:'سؤال'};
  const responses = await Promise.all(Array.from({length:8}, () => post(payload).then(r=>r.json())));
  assert.equal(responses.filter(r=>!r.replayed).length,1);
  assert.ok(responses.every(r=>r.id==='http-test' && r.status==='completed'));
  assert.equal((await post({...payload,message:'آخر'})).status,409);
  assert.equal((await post(payload,b)).status,403);
  assert.equal((await post({...payload,requestId:'bad',message:{}})).status,400);
  assert.equal((await post({...payload,requestId:'facts',sharedFacts:['secret']})).status,400);
  for (let i=0;i<3;i++) assert.equal((await fetch(root+'/api/operations/http-test',{headers:{cookie:a}})).status,200);
  assert.equal((await fetch(root+'/api/operations/http-test',{headers:{cookie:b}})).status,404);
  assert.equal((await fetch(root+'/api/operations/unknown',{headers:{cookie:a}})).status,404);
  const history = await (await fetch(root+'/api/history?owner=forged',{headers:{cookie:b}})).json();
  assert.deepEqual(history.items,[]);
  const own = await (await fetch(root+'/api/history',{headers:{cookie:a}})).json();
  assert.equal(own.items.length,1);
  assert.equal(own.storage,'server-memory');
});

test('chunked HTTP preserves Unicode across a split UTF-8 character and replays the same operation', async t => {
  const server = createPreviewServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const root = `http://127.0.0.1:${server.address().port}`;
  const cookie = (await fetch(root)).headers.get('set-cookie').split(';')[0];
  const payload = { requestId:'chunked-unicode', characterId:'jonas', message:'سؤال بالعربية 🪶' };
  const bytes = Buffer.from(JSON.stringify(payload));
  const split = bytes.indexOf(Buffer.from('س')) + 1;
  const first = await new Promise((resolve, reject) => {
    let timer;
    const request = http.request(root + '/api/dialogue', {
      method:'POST', headers:{ cookie, 'content-type':'application/json' },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({ status:response.statusCode, body:JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    request.on('error', error => { clearTimeout(timer); reject(error); });
    request.write(bytes.subarray(0, split));
    // Let the server consume the incomplete character before the next HTTP chunk.
    timer = setTimeout(() => request.end(bytes.subarray(split)), 100);
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.message, payload.message);
  assert.equal(first.body.replayed, false);
  const replay = await (await fetch(root + '/api/dialogue', {
    method:'POST', headers:{ cookie, 'content-type':'application/json' }, body:JSON.stringify(payload),
  })).json();
  assert.equal(replay.replayed, true);
  assert.equal(replay.message, payload.message);
  const saved = await (await fetch(root + '/api/operations/' + payload.requestId, { headers:{ cookie } })).json();
  assert.equal(saved.message, payload.message);
});
