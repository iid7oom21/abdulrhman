import http from 'node:http';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createMaterialStore, MaterialError } from './materials.js';
import { submitRequest, listRequests, getRequest } from './dialogue.js';

// Session capability issued by the server, not an ownerId supplied in JSON/query strings.
// Anonymous browser session, NOT an authenticated account or durable storage.
export function createPreviewServer({ createMaterials = createMaterialStore } = {}) {
  const sessions = new Map();
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
          sessions.set(owner, createMaterials());
          res.setHeader('Set-Cookie', `raven_preview_session=${owner}; HttpOnly; SameSite=Strict; Path=/${req.socket.encrypted ? '; Secure' : ''}`);
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }
      if (!owner) return json(401, { error: 'session_unavailable' });
      const materials = sessions.get(owner);
      if (req.method === 'GET' && url.pathname === '/api/materials') {
        return json(200, { items:materials.listMaterials(), events:materials.listShareEvents(), storage:'server-memory' });
      }
      if (req.method === 'GET' && url.pathname === '/api/knowledge') {
        const characterId = url.searchParams.get('characterId');
        if (!['jonas','claire','matteo','elena'].includes(characterId)) return json(400, { error:'unknown_character' });
        return json(200, materials.contextFor(characterId, {visibleTo:'player'}));
      }
      if (req.method === 'GET' && url.pathname === '/api/history') {
        return json(200, { items: listRequests(owner), storage: 'server-memory' });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/api/operations/')) {
        const record = getRequest(decodeURIComponent(url.pathname.slice('/api/operations/'.length)), owner);
        return record ? json(200, record) : json(404, { error: 'operation_unavailable' });
      }
      if (req.method === 'POST' && ['/api/dialogue','/api/materials','/api/shares'].includes(url.pathname)) {
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'json_required' });
        if (req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: 'cross_site' });
        const bodyChunks = [];
        let bodyBytes = 0;
        for await (const chunk of req) {
          bodyBytes += chunk.length;
          if (bodyBytes > 40000) return json(413, { error: 'body_too_large' });
          bodyChunks.push(chunk);
        }
        let data;
        // Decode once: a multi-byte Arabic character can span incoming HTTP chunks.
        try { data = JSON.parse(Buffer.concat(bodyChunks, bodyBytes).toString('utf8')); }
        catch { return json(400, { error: 'invalid_json' }); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return json(400, { error: 'invalid_request' });
        if (url.pathname === '/api/materials') {
          if (!['statement','correction','motive','private_note','report'].includes(data.type) ||
              typeof data.id !== 'string' || Object.hasOwn(data, 'author')) return json(400, { error:'player_material_required' });
          const item = materials.createMaterial({ ...data, author:'player' });
          return json(200, { item:materials.listMaterials().find(record => record.id === item.id), storage:'server-memory' });
        }
        if (url.pathname === '/api/shares') {
          if (Object.keys(data).some(key => !['eventId','materialId','recipients'].includes(key)) || !Array.isArray(data.recipients) || data.recipients.includes('player')) {
            return json(400, { error:'invalid_share' });
          }
          return json(200, { event:materials.share({ ...data, sender:'player' }), storage:'server-memory' });
        }
        if (!['jonas','claire'].includes(data.characterId)) return json(400, { error:'invalid_request' });
        const result = submitRequest(data.requestId, data.characterId, data.message, data.sharedFacts, data.contentVersion, owner, materials.contextFor(data.characterId));
        const status = result.error ? (result.status === 'conflict' ? 409 : result.error === 'forbidden' ? 403 : 400) : 200;
        return json(status, result);
      }
      json(404, { error: 'not_found' });
    } catch (error) {
      if (error instanceof MaterialError) return json(error.code.endsWith('_conflict') ? 409 : 400, { error:error.code });
      if (!res.headersSent) json(500, { error: 'server_error' });
      else res.end();
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createPreviewServer().listen(process.env.PORT || 10000, '0.0.0.0', () => console.log('RAVEN preview: simulation, server-memory storage'));
}
