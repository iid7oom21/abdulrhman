import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createLog, errorFields} from '../src/log.js';
import {createPreviewServer} from '../src/server.js';
import {createCaseService} from '../src/case-service.js';
import {fixturePack} from './fixtures/case.js';

function capture() {
  const lines = [];
  const errors = [];
  const log = createLog({level:'info', now:() => '2026-01-01T00:00:00.000Z',
    stdout:{write:line => lines.push(JSON.parse(line))},
    stderr:{write:line => errors.push(JSON.parse(line))}});
  return {log, lines, errors, all:() => [...lines, ...errors]};
}
const settle = async predicate => {
  for (let attempt = 0; attempt < 100; attempt += 1) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  throw new Error('log_line_missing');
};
async function start(t, options = {}) {
  const server = createPreviewServer({generate:() => { throw new Error('provider_disabled'); },...options});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  let closed = false;
  const close = async () => { if (!closed) { closed = true; await new Promise(resolve => server.close(resolve)); } };
  t.after(close); return {root:'http://127.0.0.1:' + server.address().port,close};
}
function directory(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'raven-logging-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true})); return root;
}

test('a log line keeps primitives, clips text, and never serializes a structure', () => {
  const {log, lines} = capture();
  log.info('http_request', {requestId:'req-1', status:200, ok:true, material:{secret:'player text'},
    long:'x'.repeat(400), level:'spoofed'});
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0], {level:'info', time:'2026-01-01T00:00:00.000Z', event:'http_request',
    requestId:'req-1', status:200, ok:true, long:'x'.repeat(300) + '...'});
  const silent = capture();
  createLog({level:'silent', stdout:{write:line => silent.lines.push(line)}}).info('http_request', {});
  assert.deepEqual(silent.lines, []);
});

test('errorFields carries the closed code, the message and the head of the stack', () => {
  const error = new TypeError('boom');
  error.code = 'ENOSPC';
  const fields = errorFields(error);
  assert.equal(fields.errorName, 'TypeError'); assert.equal(fields.errorCode, 'ENOSPC');
  assert.equal(fields.errorMessage, 'boom'); assert.match(fields.errorStack, /^TypeError: boom\n {4}at /);
});

test('each request writes one wide event with the request id, status, duration and route', async t => {
  const {log, lines, errors} = capture();
  const s = await start(t, {log});
  const response = await fetch(s.root + '/', {headers:{'x-request-id':'support-case-42'}});
  const cookie = response.headers.get('set-cookie').split(';')[0].split('=')[1];
  await response.text();
  await settle(() => lines.length === 1);
  assert.equal(response.headers.get('x-request-id'), 'support-case-42');
  assert.equal(lines.length, 1); assert.deepEqual(errors, []);
  assert.equal(lines[0].event, 'http_request'); assert.equal(lines[0].requestId, 'support-case-42');
  assert.equal(lines[0].method, 'GET'); assert.equal(lines[0].path, '/'); assert.equal(lines[0].route, '/');
  assert.equal(lines[0].status, 200); assert.equal(lines[0].outcome, 'ok'); assert.equal(lines[0].session, 'new');
  assert.equal(typeof lines[0].durationMs, 'number'); assert.ok(lines[0].durationMs >= 0);
  assert.equal(JSON.stringify(lines).includes(cookie), false, 'the session capability never reaches a log line');

  const generated = await fetch(s.root + '/api/materials');
  await generated.text();
  await settle(() => generated.headers.get('x-request-id') !== null && lines.length === 2);
  assert.match(generated.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  assert.equal(lines[1].requestId, generated.headers.get('x-request-id'));
  assert.equal(lines[1].route, '/api/materials');
});

test('an unexpected request failure names its cause and its request', async t => {
  const {log, lines, errors} = capture();
  const s = await start(t, {log, createMaterials:() => { throw new Error('materials_fixture_failure'); }});
  const response = await fetch(s.root + '/', {headers:{'x-request-id':'req-500'}});
  assert.equal(response.status, 500); assert.deepEqual(await response.json(), {error:'server_error'});
  await settle(() => errors.length === 1 && lines.length === 1);
  assert.equal(errors[0].event, 'http_request_failed'); assert.equal(errors[0].level, 'error');
  assert.equal(errors[0].requestId, 'req-500'); assert.equal(errors[0].path, '/');
  assert.equal(errors[0].errorMessage, 'materials_fixture_failure');
  assert.match(errors[0].errorStack, /^Error: materials_fixture_failure\n/);
  assert.equal(lines[0].status, 500); assert.equal(lines[0].outcome, 'server_error');
});

test('a provider failure logs its closed code and never the provider message', async t => {
  const {log, errors} = capture();
  const failure = new Error('upstream said: sk_live_provider_secret');
  failure.code = 'provider_busy'; failure.httpStatus = 429;
  const s = await start(t, {log, generate:() => { throw failure; }});
  const opened = await fetch(s.root + '/');
  const cookie = opened.headers.get('set-cookie').split(';')[0];
  await opened.text();
  const asked = await fetch(s.root + '/api/dialogue', {method:'POST', headers:{'content-type':'application/json', cookie},
    body:JSON.stringify({requestId:'req-provider-1', characterId:'jonas', message:'من أنت؟'})});
  await asked.text();
  await settle(() => errors.length === 1);
  assert.equal(errors[0].event, 'dialogue_generation_failed');
  assert.equal(errors[0].requestId, 'req-provider-1'); assert.equal(errors[0].characterId, 'jonas');
  assert.equal(errors[0].errorCode, 'provider_busy'); assert.equal(errors[0].errorHttpStatus, 429);
  assert.equal(errors[0].outcomeUnknown, false);
  assert.equal(JSON.stringify(errors).includes('sk_live_provider_secret'), false, 'upstream text stays out of the log');
});

test('a case store that cannot write is logged once, with the disk error, and then refused', async t => {
  const {log, errors} = capture();
  const root = directory(t);
  const failing = {load:() => null, save() { const error = new Error('ENOSPC: no space left on device'); error.code = 'ENOSPC'; throw error; }};
  const s = await start(t, {log, casePack:fixturePack(), caseStoragePath:path.join(root,'case-store.json'), openCaseStore:() => failing});
  const first = await fetch(s.root + '/api/case/start', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({contentVersion:'fixture-v1'})});
  assert.equal(first.status, 503); assert.deepEqual(await first.json(), {error:'storage_unavailable'});
  const second = await fetch(s.root + '/api/case/start', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({contentVersion:'fixture-v1'})});
  assert.equal(second.status, 503); await second.text();
  assert.equal(errors.length, 1, 'the outage is reported once, not once per refused write');
  assert.equal(errors[0].event, 'case_store_write_failed'); assert.equal(errors[0].errorCode, 'ENOSPC');
  assert.equal(errors[0].persistence, 'disk-file');
  assert.match(errors[0].errorMessage, /ENOSPC/);
});

test('an unexpected case service error is logged with the request id that reached it', async () => {
  const {log, errors} = capture();
  const service = createCaseService({pack:fixturePack(), log});
  const req = {method:'POST', headers:{'content-type':'application/json'}, socket:{},
    [Symbol.asyncIterator]() { throw new Error('socket closed mid-body'); }};
  let status = null;
  const handled = await service.handle(req, {setHeader(){}, getHeader(){}, writeHead(){}, end(){}},
    new URL('http://127.0.0.1/api/case/start'), code => { status = code; }, {requestId:'req-case-1'});
  assert.equal(handled, true); assert.equal(status, 503);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].event, 'case_request_failed'); assert.equal(errors[0].requestId, 'req-case-1');
  assert.equal(errors[0].path, '/api/case/start'); assert.equal(errors[0].method, 'POST');
  assert.equal(errors[0].errorMessage, 'socket closed mid-body');
});
