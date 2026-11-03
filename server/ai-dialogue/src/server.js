import http from 'node:http';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { submitRequest, listRequests, getRequest } from './dialogue.js';

// Session capability issued by the server, not an ownerId supplied in JSON/query strings.
// Anonymous browser session, NOT an authenticated account or durable storage.
export function createPreviewServer() {
  const sessions = new Set();
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url));
  return http.createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data, (key, value) => ['owner', 'fingerprint'].includes(key) ? undefined : value));
    };
    try {
      const url = new URL(req.url, 'http://preview.local');
      const cookie = /(?:^|;\s*)raven_preview_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      let owner = sessions.has(cookie) ? cookie : null;
      if (req.method === 'GET' && ['/', '/index.html'].includes(url.pathname)) {
        if (!owner) {
          owner = randomBytes(32).toString('hex');
          sessions.add(owner);
          res.setHeader('Set-Cookie', `raven_preview_session=${owner}; HttpOnly; SameSite=Strict; Path=/${req.socket.encrypted ? '; Secure' : ''}`);
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }
      if (!owner) return json(401, { error: 'session_unavailable' });
      if (req.method === 'GET' && url.pathname === '/api/history') {
        return json(200, { items: listRequests(owner), storage: 'server-memory' });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/api/operations/')) {
        const record = getRequest(decodeURIComponent(url.pathname.slice('/api/operations/'.length)), owner);
        return record ? json(200, record) : json(404, { error: 'operation_unavailable' });
      }
      if (req.method === 'POST' && url.pathname === '/api/dialogue') {
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'json_required' });
        if (req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: 'cross_site' });
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 40000) return json(413, { error: 'body_too_large' });
        }
        let data;
        try { data = JSON.parse(body); } catch { return json(400, { error: 'invalid_json' }); }
        if (!data || typeof data !== 'object') return json(400, { error: 'invalid_request' });
        const result = submitRequest(data.requestId, data.characterId, data.message, data.sharedFacts, data.contentVersion, owner);
        const status = result.error ? (result.status === 'conflict' ? 409 : result.error === 'forbidden' ? 403 : 400) : 200;
        return json(status, result);
      }
      json(404, { error: 'not_found' });
    } catch {
      if (!res.headersSent) json(500, { error: 'server_error' });
      else res.end();
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createPreviewServer().listen(process.env.PORT || 10000, '0.0.0.0', () => console.log('RAVEN preview: simulation, server-memory storage'));
}
