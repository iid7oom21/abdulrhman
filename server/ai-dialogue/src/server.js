import http from 'node:http';
import fs from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createMaterialStore, MaterialError } from './materials.js';
import { submitRequest, listRequests, getRequest, forgetOwner, simulateReply, exportRequests, importRequest, markSaveStatus } from './dialogue.js';
import { openDiskStore } from './disk-store.js';
import { providerFromEnv } from './provider.js';
import { validateSnapshot } from './snapshot.js';
import {runtimeControls} from './runtime-controls.js';
import {createSiteMount, HOSTED_DIALOGUE_PATHS, siteRequestPath, serveSiteFile} from './site-mount.js';

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
  readControls = runtimeControls(),
  // Explicit reviewed static export; unset preserves the standalone server exactly.
  siteRoot = null,
} = {}) {
  const site = siteRoot ? createSiteMount(siteRoot) : null;
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
    const restored = validateSnapshot(snapshot,{maxSessions,maxMaterials,maxShares,createMaterials});
    for(const [owner,session] of restored)sessions.set(owner,session);
    for (const record of snapshot?.requests || []) importRequest(record);
    for (const [owner, session] of [...sessions]) if (expired(session)) dropSession(owner);
    // Do not rewrite on boot: valid but stale snapshots and damaged backups stay inspectable.
  }
  const controlledGenerate = (...args) => readControls().providerCallsEnabled
    ? generate(...args) : {...simulateReply(...args),source:'deterministic-fallback'};
  const persistence = disk ? 'disk-file' : 'process-memory';
  const storageInfo = () => ({storage:'server-memory',persistence,saveStatus});
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url));
  // Use the server UI, which understands disk saveStatus and provider configuration.
  // Never transplant the static browser simulator or its local operation history.
  const hostedHtml = english => Buffer.from(html.toString()
    .replace("'raven_deleted_name_preview_v2'", "'raven_deleted_name_hosted_server_preview_v2'")
    .replace("'raven_deleted_name_material_actions_v1'", "'raven_deleted_name_hosted_server_material_actions_v1'")
    .replace('</head>', '<meta name="raven-dialogue-transport" content="same-origin-server">\n</head>')
    .replace('</header>', '<a href="/raven/deleted-name/' + (english ? '?lang=en' : '') + '">الرجوع إلى القضية · Return to case</a></header>')
    .replace('<main>', '<main>' + (english ? '<p role="note" lang="en" dir="ltr">This technical server preview is currently available in Arabic. Your opening choices are not transferred here.</p>' : '')));
  const scriptHashesFor = page => [...page.toString().matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`).join(' ');
  const scriptHashes = scriptHashesFor(html), hostedScriptHashes = scriptHashesFor(hostedHtml(false));
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
      // The URL parser normalizes dot segments; reject unsafe raw targets first.
      if (site && siteRequestPath(req.url) === null) return json(404, {error:'not_found'});
      const url = new URL(req.url, 'http://preview.local');
      if (req.method === 'GET' && url.pathname === '/texts/raven-texts.js') {
        res.writeHead(200, {'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-cache'});
        return res.end(fs.readFileSync(new URL('../public/texts/raven-texts.js',import.meta.url)));
      }
      // Readiness checks never create/evict sessions, generate, or write storage.
      if (req.method === 'GET' && url.pathname === '/healthz') return json(200,{status:'ok'});
      if (req.method === 'GET' && ['/api/config','/api/status'].includes(url.pathname)) {
        const controls=readControls(),enabled=controls.providerCallsEnabled&&providerInfo.provider!=='simulation';
        return json(200,{
          ...storageInfo(),...providerInfo,controls,
          mode:enabled ? (url.pathname==='/api/status'?'grounded-model':'received-material-assistance') : 'simulation',
          characters:['jonas','claire'],sourceKnowledgeAvailable:false,contentVersion:'deleted-name-preview-v2',
        });
      }
      const hostedDialogue = site && HOSTED_DIALOGUE_PATHS.has(url.pathname);
      if (site && ['GET','HEAD'].includes(req.method) && !hostedDialogue) {
        const redirect = site.redirect(url.pathname);
        if (redirect) {
          res.writeHead(308, {'Location':redirect + url.search,'Cache-Control':'no-store'});
          return res.end();
        }
        const asset = site.open(url.pathname);
        if (asset) return serveSiteFile(req, res, asset);
      }
      if (site && !hostedDialogue && !['/','/index.html'].includes(url.pathname) && !url.pathname.startsWith('/api/')) {
        return json(404, {error:'not_found'});
      }
      const cookie = /(?:^|;\s*)raven_preview_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      const session = cookie ? liveSession(cookie) : null;
      let owner = session ? cookie : null;
      if (req.method === 'GET' && (['/', '/index.html'].includes(url.pathname) || hostedDialogue)) {
        if (!owner) {
          owner = openSession();
          persist();
          res.setHeader('Set-Cookie', `raven_preview_session=${owner}; HttpOnly; SameSite=Strict; Path=/${req.socket.encrypted || secureCookie ? '; Secure' : ''}`);
        }
        if (hostedDialogue) {
          res.setHeader('X-Frame-Options', 'SAMEORIGIN');
          res.setHeader('Content-Security-Policy', res.getHeader('Content-Security-Policy')
            .replace(scriptHashes, hostedScriptHashes).replace("frame-ancestors 'none'", "frame-ancestors 'self'"));
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(hostedDialogue ? hostedHtml(url.searchParams.get('lang') === 'en') : html);
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
        const result = submitRequest(data.requestId, data.characterId, data.message, data.sharedFacts, data.contentVersion, owner, materials.contextFor(data.characterId), controlledGenerate,
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
  createPreviewServer({storeFile:storagePathFromEnv(),generate,providerInfo:info,siteRoot:process.env.RAVEN_SITE_ROOT || null})
    .listen(process.env.PORT || 10000, process.env.HOST || '127.0.0.1', () => console.log(`RAVEN preview: ${info.provider}, local disk file`));
}
