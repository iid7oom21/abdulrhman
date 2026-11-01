import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitRequest, listRequests, makeRequestId } from './dialogue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

// Simple memory session store for demonstration. In production, use Redis or Postgres.
const sessions = new Map();

function getOrCreateSession(req, res) {
  const cookieStr = req.headers.cookie || '';
  const match = cookieStr.match(/sid=([^;]+)/);
  let sid = match ? match[1] : null;

  if (!sid || !sessions.has(sid)) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessions.set(sid, { createdAt: Date.now() });
    res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; Path=/; SameSite=Strict`);
  }
  return sid;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'));
    getOrCreateSession(req, res);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/history') {
    const sid = getOrCreateSession(req, res);
    const items = listRequests(sid);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ items }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/dialogue') {
    const sid = getOrCreateSession(req, res);
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 1e6) { // 1MB limit
            req.connection.destroy();
        }
    });

    req.on('end', async () => {
        let data;
        try { data = JSON.parse(body || '{}'); } catch { data = {}; }
        const characterId = data.characterId;
        const message = (data.message || '').trim();

        if (!characterId || !message) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'missing_fields' }));
          return;
        }

        // Use client requestId if provided, otherwise generate one. This enables idempotency handling on retry.
        const requestId = data.requestId || makeRequestId();

        // Pass sid instead of trusting client ownerId
        const result = await submitRequest(requestId, characterId, message, data.sharedFacts || [], data.contentVersion || 'v1', sid);

        const status = result.error ? (result.status === 'conflict' ? 409 : 403) : 200;
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
    });
    return;
  }

  if (req.method === 'GET') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`RAVEN dialogue preview listening on ${HOST}:${PORT}`);
});
