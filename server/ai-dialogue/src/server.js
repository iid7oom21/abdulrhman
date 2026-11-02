import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { submitRequest, listRequests, makeRequestId } from './dialogue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 16 * 1024;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        chunks.length = 0;
        reject(Object.assign(new Error('body_too_large'), { status: 413 }));
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function validRequest(data) {
  const boundedString = (value, max) =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  return (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    ['jonas', 'claire'].includes(data.characterId) &&
    boundedString(data.message, 4000) &&
    (data.requestId === undefined || boundedString(data.requestId, 128)) &&
    (data.contentVersion === undefined ||
      boundedString(data.contentVersion, 64)) &&
    (data.sharedFacts === undefined ||
      (Array.isArray(data.sharedFacts) &&
        data.sharedFacts.length <= 32 &&
        data.sharedFacts.every((fact) => boundedString(fact, 128))))
  );
}

export function createDialogueServer() {
  // Histories and sessions are intentionally ephemeral in this preview server.
  const sessionSecret = randomUUID();
  const sign = (id) =>
    createHmac('sha256', sessionSecret).update(id).digest('hex');

  function ownerFor(req, res) {
    const cookie = (req.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('raven_session='));
    const token = cookie?.slice('raven_session='.length) || '';
    const match = /^([a-f0-9-]{36})\.([a-f0-9]{64})$/.exec(token);
    if (
      match &&
      timingSafeEqual(
        Buffer.from(match[2], 'hex'),
        Buffer.from(sign(match[1]), 'hex'),
      )
    )
      return match[1];
    const id = randomUUID();
    const secure = req.socket.encrypted || process.env.COOKIE_SECURE === 'true';
    res.setHeader(
      'Set-Cookie',
      `raven_session=${id}.${sign(id)}; HttpOnly; SameSite=Strict; Path=/${secure ? '; Secure' : ''}`,
    );
    return id;
  }

  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const url = new URL(req.url, 'http://localhost');
      const ownerId = ownerFor(req, res);

      if (
        req.method === 'GET' &&
        (url.pathname === '/' || url.pathname === '/index.html')
      ) {
        const html = fs.readFileSync(
          path.join(__dirname, '../public/index.html'),
        );
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/history') {
        json(res, 200, { items: listRequests(ownerId) });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/dialogue') {
        if (
          req.headers['content-type']?.split(';')[0].trim().toLowerCase() !==
          'application/json'
        ) {
          json(res, 415, { error: 'unsupported_media_type' });
          return;
        }
        let data;
        try {
          data = JSON.parse(await readBody(req));
        } catch (error) {
          json(res, error.status || 400, {
            error: error.status === 413 ? 'body_too_large' : 'invalid_json',
          });
          return;
        }
        if (!validRequest(data)) {
          json(res, 400, { error: 'invalid_fields' });
          return;
        }
        const requestId = data.requestId || makeRequestId();
        const result = submitRequest(
          requestId,
          data.characterId,
          data.message.trim(),
          data.sharedFacts || [],
          data.contentVersion || 'v1',
          ownerId,
        );
        json(
          res,
          result.error ? (result.status === 'conflict' ? 409 : 403) : 200,
          result,
        );
        return;
      }

      json(res, 404, { error: 'not_found' });
    } catch {
      if (!res.headersSent) json(res, 500, { error: 'internal_error' });
      else res.end();
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const port = process.env.PORT || 10000;
  const host = '0.0.0.0';
  createDialogueServer().listen(port, host, () => {
    console.log(`RAVEN dialogue preview listening on ${host}:${port}`);
  });
}
