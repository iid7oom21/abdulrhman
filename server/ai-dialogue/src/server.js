import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitRequest, listRequests, makeRequestId } from './dialogue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/history') {
    const owner = url.searchParams.get('owner') || 'anon';
    const items = listRequests(owner);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ items }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/dialogue') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let data;
    try { data = JSON.parse(body || '{}'); } catch { data = {}; }
    const characterId = data.characterId;
    const message = (data.message || '').trim();
    const ownerId = data.ownerId || 'anon';
    if (!characterId || !message) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'missing_fields' }));
      return;
    }
    const requestId = data.requestId || makeRequestId();
    const result = submitRequest(requestId, characterId, message, data.sharedFacts || [], data.contentVersion || 'v1', ownerId);
    const status = result.error ? (result.status === 'conflict' ? 409 : 403) : 200;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  console.log(`RAVEN dialogue preview listening on ${HOST}:${PORT}`);
});
