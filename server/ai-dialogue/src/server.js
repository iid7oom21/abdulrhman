import http from 'node:http';
import fs from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createMaterialStore, MaterialError } from './materials.js';
import { submitRequest, listRequests, getRequest, forgetOwner, simulateReply, exportRequests, importRequest, markSaveStatus, fingerprint, MAX_REQUESTS_PER_OWNER } from './dialogue.js';
import { openDiskStore } from './disk-store.js';
import { providerFromEnv } from './provider.js';

// Memory bounds for the in-memory preview. All can be overridden through createPreviewServer options.
export const SESSION_IDLE_MS = 6 * 60 * 60 * 1000;
export const MAX_SESSIONS = 100;
export const MAX_MATERIALS_PER_SESSION = 200;
export const MAX_SHARES_PER_SESSION = 500;
export const DEFAULT_STORAGE_PATH = fileURLToPath(new URL('../.data/preview-store.json', import.meta.url));
export function storagePathFromEnv(env = process.env) {
  return env.RAVEN_DIALOGUE_STORAGE_PATH || env.RAVEN_STORE_FILE || DEFAULT_STORAGE_PATH;
}

// Session capability issued by the server, not an ownerId supplied in JSON/query strings.
// Anonymous browser session, not an authenticated account. CLI uses a local disk file.
export function createPreviewServer({
  createMaterials = createMaterialStore,
  sessionIdleMs = SESSION_IDLE_MS,
  maxSessions = MAX_SESSIONS,
  maxMaterials = MAX_MATERIALS_PER_SESSION,
  maxShares = MAX_SHARES_PER_SESSION,
  // Behind a TLS-terminating proxy the socket is plain HTTP, so Secure must be requested explicitly.
  secureCookie = process.env.RAVEN_COOKIE_SECURE === '1',
  now = Date.now,
  // Optional JSON file on this machine's disk. Unset = process memory only (previous behaviour).
  storeFile = null, // embedded tests explicitly choose storage; CLI uses storagePathFromEnv()
  generate = simulateReply,
  providerInfo = {provider:'simulation',model:null},
  openStore = openDiskStore,
} = {}) {
  // owner -> { materials, touchedAt }. Map order is least-recently-used first (re-inserted on each use).
  const sessions = new Map();
  const dropSession = owner => { sessions.delete(owner); forgetOwner(owner); };
  const expired = session => now() - session.touchedAt > sessionIdleMs;
  const liveSession = cookie => {
    const session = sessions.get(cookie);
    if (!session) return null;
    if (expired(session)) { dropSession(cookie); return null; }
    session.touchedAt = now();
    sessions.delete(cookie); sessions.set(cookie, session);
    return session;
  };
  const openSession = () => {
    for (const [owner, session] of sessions) { if (!expired(session)) break; dropSession(owner); }
    while (sessions.size >= maxSessions) dropSession(sessions.keys().next().value);
    const owner = randomBytes(32).toString('hex');
    sessions.set(owner, { materials: createMaterials(), touchedAt: now(), actions: [] });
    return owner;
  };
  // Each session keeps the accepted player actions in order; reopening replays them through the same engine.
  const disk = storeFile ? openStore(storeFile) : null;
  let saveStatus = disk ? 'confirmed' : 'memory';
  const persist = () => {
    markSaveStatus(sessions, disk ? 'confirmed' : 'memory');
    try {
      disk?.save({
        sessions: [...sessions].map(([owner, session]) => ({ owner, touchedAt: session.touchedAt, actions: session.actions })),
        requests: exportRequests().filter(record => sessions.has(record.owner)),
      });
      saveStatus = disk ? 'confirmed' : 'memory';
    } catch (error) {
      saveStatus = 'unconfirmed'; markSaveStatus(sessions, 'unconfirmed'); throw error;
    }
  };
  const persistSafely = () => { try { persist(); } catch { /* Keep the known result in memory. */ } };
  if (disk) {
    const snapshot = disk.load();
    // Validate/replay the ENTIRE snapshot before touching live operation maps or writing.
    // A valid JSON header with corrupt nested content is still a damaged backup.
    try {
      if ((snapshot?.sessions.length || 0) > maxSessions) throw new Error();
      for (const saved of snapshot?.sessions || []) {
        if (!saved || !/^[a-f0-9]{64}$/.test(saved.owner) || sessions.has(saved.owner) ||
            !Number.isFinite(saved.touchedAt) || !Array.isArray(saved.actions) || saved.actions.length > maxMaterials + maxShares) throw new Error();
        const materials = createMaterials();
        for (const action of saved.actions) {
          if (action?.kind === 'material' && action.input?.author === 'player' &&
              ['statement','correction','motive','private_note','report'].includes(action.input.type)) materials.createMaterial(action.input);
          else if (action?.kind === 'share' && action.input?.sender === 'player' &&
              Array.isArray(action.input.recipients) && !action.input.recipients.includes('player')) materials.share(action.input);
          else throw new Error();
        }
        if (materials.listMaterials().length > maxMaterials || materials.listShareEvents().length > maxShares) throw new Error();
        sessions.set(saved.owner, { materials, touchedAt:saved.touchedAt, actions:structuredClone(saved.actions) });
      }
      const seen = new Set(), counts = new Map();
      for (const record of snapshot?.requests || []) {
        if (!record || !sessions.has(record.owner) || typeof record.id !== 'string' || !/^[\w-]{1,100}$/.test(record.id) || seen.has(record.id) ||
            !['jonas','claire'].includes(record.characterId) || typeof record.message !== 'string' || !record.message.trim() || record.message.length > 8000 ||
            typeof record.contentVersion !== 'string' || !/^[\w.-]{1,100}$/.test(record.contentVersion) ||
            record.fingerprint !== fingerprint({characterId:record.characterId,message:record.message,contentVersion:record.contentVersion}) ||
            !['pending','unknown','completed','error'].includes(record.status) || record.storage !== 'server-memory' ||
            typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt)) ||
            (record.response !== undefined && (typeof record.response?.text !== 'string' || !record.response.text.trim() || record.response.text.length > 40000 || typeof record.response.refused !== 'boolean')) ||
            (record.status === 'completed' && !record.response)) throw new Error();
        seen.add(record.id); counts.set(record.owner, (counts.get(record.owner) || 0) + 1);
        if (counts.get(record.owner) > MAX_REQUESTS_PER_OWNER) throw new Error();
      }
    } catch { throw new Error('incompatible_store_file: snapshot was left untouched'); }
    for (const record of snapshot?.requests || []) importRequest(record);
    for (const [owner, session] of [...sessions]) if (expired(session)) dropSession(owner);
    // Do not rewrite on boot: valid but stale snapshots and damaged backups stay inspectable.
  }
  const persistence = disk ? 'disk-file' : 'process-memory';
  const storageInfo = () => ({storage:'server-memory',persistence,saveStatus});
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url));
  const scriptHashes = [...html.toString().matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`).join(' ');
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self' ${scriptHashes}; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`);
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data, (key, value) => ['owner', 'fingerprint'].includes(key) ? undefined : value));
    };
    try {
      const url = new URL(req.url, 'http://preview.local');
      if (req.method === 'GET' && url.pathname === '/texts/raven-texts.js') {
        res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache'});
        return res.end(fs.readFileSync(new URL('../public/texts/raven-texts.js',import.meta.url)));
      }
      // Readiness checks never create/evict sessions, generate, or write storage.
      if (req.method === 'GET' && url.pathname === '/healthz') return json(200,{status:'ok'});
      if (req.method === 'GET' && url.pathname === '/api/config') return json(200,{
        ...storageInfo(), ...providerInfo, mode:providerInfo.provider !== 'simulation' ? 'received-material-assistance' : 'simulation',
        sourceKnowledgeAvailable:false,
      });
      // Keep the existing status route for callers from the earlier model integration.
      if (req.method === 'GET' && url.pathname === '/api/status') return json(200,{
        mode:providerInfo.provider === 'simulation' ? 'simulation' : 'grounded-model',
        persistence, characters:['jonas','claire'], ...providerInfo,
      });
      const cookie = /(?:^|;\s*)raven_preview_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      const session = cookie ? liveSession(cookie) : null;
      let owner = session ? cookie : null;
      if (req.method === 'GET' && ['/', '/index.html'].includes(url.pathname)) {
        if (!owner) {
          owner = openSession();
          persist();
          res.setHeader('Set-Cookie', `raven_preview_session=${owner}; HttpOnly; SameSite=Strict; Path=/${req.socket.encrypted || secureCookie ? '; Secure' : ''}`);
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }
      if (!owner) return json(401, { error: 'session_unavailable' });
      const materials = session.materials;
      if (req.method === 'GET' && url.pathname === '/api/materials') {
        return json(200, { items:materials.listMaterials(), events:materials.listShareEvents(), ...storageInfo() });
      }
      if (req.method === 'GET' && url.pathname === '/api/knowledge') {
        const characterId = url.searchParams.get('characterId');
        if (!['jonas','claire','matteo','elena'].includes(characterId)) return json(400, { error:'unknown_character' });
        return json(200, materials.contextFor(characterId, {visibleTo:'player'}));
      }
      if (req.method === 'GET' && url.pathname === '/api/history') {
        return json(200, { items: listRequests(owner), ...storageInfo() });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/api/operations/')) {
        const record = getRequest(decodeURIComponent(url.pathname.slice('/api/operations/'.length)), owner);
        return record ? json(200, record) : json(404, { error: 'operation_unavailable' });
      }
      if (req.method === 'POST' && ['/api/dialogue','/api/materials','/api/shares'].includes(url.pathname)) {
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') return json(415, { error: 'json_required' });
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
          // A resend of an already-registered id is idempotent and must not hit the cap.
          if (materials.listMaterials().length >= maxMaterials &&
              !materials.listMaterials().some(record => record.id === data.id)) return json(400, { error:'materials_limit' });
          const isNew = !materials.listMaterials().some(record => record.id === data.id);
          const item = materials.createMaterial({ ...data, author:'player' });
          if (isNew) session.actions.push({ kind:'material', input:{ ...data, author:'player' } });
          persistSafely();
          return json(200, { item:materials.listMaterials().find(record => record.id === item.id), ...storageInfo() });
        }
        if (url.pathname === '/api/shares') {
          if (Object.keys(data).some(key => !['eventId','materialId','recipients'].includes(key)) || !Array.isArray(data.recipients) || data.recipients.includes('player')) {
            return json(400, { error:'invalid_share' });
          }
          if (materials.listShareEvents().length >= maxShares &&
              !materials.listShareEvents().some(event => event.eventId === data.eventId)) return json(400, { error:'shares_limit' });
          const event = materials.share({ ...data, sender:'player' });
          if (!event.duplicated) session.actions.push({ kind:'share', input:{ ...data, sender:'player' } });
          persistSafely();
          return json(200, { event, ...storageInfo() });
        }
        if (!['jonas','claire'].includes(data.characterId) || Object.keys(data).some(k => !['requestId','characterId','message','sharedFacts','contentVersion'].includes(k))) return json(400, { error:'invalid_request' });
        const result = submitRequest(data.requestId, data.characterId, data.message, data.sharedFacts, data.contentVersion, owner, materials.contextFor(data.characterId), generate,
          {beforeGenerate:persist,onSettled:persistSafely});
        const status = result.id ? (result.status === 'pending' ? 202 : 200) :
          result.status === 'conflict' ? 409 : result.error === 'forbidden' ? 403 : result.error === 'requests_limit' ? 429 : 400;
        return json(status, result);
      }
      json(404, { error: 'not_found' });
    } catch (error) {
      if (error instanceof MaterialError) return json(error.code.endsWith('_conflict') ? 409 : 400, { error:error.code });
      if (!res.headersSent) json(500, { error: 'server_error' });
      else res.end();
    }
  });
  // Session activity is checkpointed independently; GET/poll never mutates operation outcomes.
  const checkpoint = disk ? setInterval(persistSafely, 60000) : null;
  checkpoint?.unref();
  server.on('close', () => clearInterval(checkpoint));
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {generate,info} = providerFromEnv();
  createPreviewServer({storeFile:storagePathFromEnv(),generate,providerInfo:info})
    .listen(process.env.PORT || 10000, process.env.HOST || '127.0.0.1', () => console.log(`RAVEN preview: ${info.provider}, local disk file`));
}
