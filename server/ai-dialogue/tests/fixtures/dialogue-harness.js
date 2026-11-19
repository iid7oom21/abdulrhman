// Local-only end-to-end harness for the case-dialogue adapter. Test code, not a production route:
// server.js never imports this file. Synthetic pack, synthetic policy and a deterministic mock
// provider only — nothing here is RAVEN canon, and it refuses to run on the real case.
//
//   node server/ai-dialogue/tests/fixtures/dialogue-harness.js [--port 8799]
//
// Path exercised: case session cookie (raven_case_session) -> server-side session state ->
// engine-decided character context -> adapter -> mock provider selection -> closed output
// validation -> attributed quotes rendered with textContent in the browser.
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { createCaseService } from '../../src/case-service.js';
import { createCaseDialogueAdapter } from '../../src/case-dialogue-adapter.js';
import { fixturePack, L } from './case.js';

export const HARNESS_SCOPE = 'local-harness-synthetic-only';
const BODY_KEYS = new Set(['requestId', 'actorId', 'message', 'locale', 'revision', 'contentVersion', 'presentedMaterialIds']);
const MAX_BODY = 16384;

export function syntheticPack() {
  const pack = fixturePack();
  pack.initialFlags.allowReceived = true;
  pack.initialFlags.revealSealed = false;
  // Hostile markup inside authored text proves the display never parses it.
  pack.materials.card.body = L('PUBLIC_CARD_BODY <img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>');
  return pack;
}

export function syntheticPolicy(pack) {
  return { schemaVersion: 1, caseId: pack.caseId, contentVersion: pack.contentVersion, policyVersion: 'harness-synthetic-v1', actors: {
    guide: { name: L('Fixture guide'), voiceStyle: L('Fixture plain style'), knowledge: [{ materialId: 'sealed', requires: { flag: 'revealSealed', equals: true } }], receivedRequires: { flag: 'allowReceived', equals: true } },
    witness: { name: L('Fixture witness'), voiceStyle: L('Fixture brief style'), knowledge: [] },
  } };
}

// Deterministic stand-in for a model: it may only pick source IDs it was offered.
export function mockProvider(calls = []) {
  let mode = 'quote';
  const provider = input => {
    calls.push(structuredClone(input));
    if (mode === 'invalid') return { action: 'quote_materials', materialIds: ['sealed'], text: 'I invented this.' };
    if (mode === 'fail') throw new Error('mock_provider_down');
    if (mode === 'unseen') return { action: 'quote_materials', materialIds: ['sealed'] };
    return { action: 'quote_materials', materialIds: input.sources.map(item => item.id) };
  };
  provider.setMode = value => { mode = value; };
  return provider;
}

const cookieSession = header => {
  const match = /(?:^|;\s*)raven_case_session=([a-f0-9]{64})(?:;|$)/.exec(header || '');
  return match ? match[1] : null;
};

async function readJson(req) {
  if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') return { error: 'json_required' };
  if (req.headers['sec-fetch-site'] === 'cross-site') return { error: 'cross_site' };
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY) return { error: 'body_too_large' }; chunks.push(chunk); }
  try { return { body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }; } catch { return { error: 'invalid_json' }; }
}

const PAGE = `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Local dialogue harness (synthetic)</title><link rel="stylesheet" href="./app.css"></head><body>
<main><h1>Local dialogue harness</h1><p class="scope">Synthetic fixture only. Not RAVEN canon. Not a production route.</p>
<p><button id="start" type="button">Start a synthetic case session</button></p>
<form id="ask"><label for="question">Question for the fixture guide</label>
<input id="question" name="question" maxlength="500" autocomplete="off" value="Which card did I give you?">
<button type="submit">Ask</button></form>
<p id="status" role="status" aria-live="polite"></p><section id="log" aria-label="Attributed answers"></section></main>
<script src="./app.js"></script></body></html>`;

const APP_CSS = 'body{font:16px/1.6 system-ui,sans-serif;margin:0;background:#101214;color:#eee}main{max-width:40rem;margin:0 auto;padding:16px}button,input{font:inherit;min-height:44px}input{width:100%;box-sizing:border-box}.quote{border:1px solid #6b5a3c;padding:12px;margin:12px 0}.quote small{display:block;color:#c9b48a}.scope{color:#c9b48a}';

const APP_JS = `'use strict';
const status=document.getElementById('status'),log=document.getElementById('log');let revision=0,turn=0;
const post=(path,body)=>fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'}).then(r=>r.json());
const text=(tag,value,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=value;return el;};
const pick=value=>value&&typeof value==='object'?(value.en??value.ar??''):String(value??'');
async function start(){const s=await post('/api/case/start',{contentVersion:'fixture-v1'});revision=s.revision;
  let r=await post('/api/case/actions',{id:'h-read',revision,contentVersion:'fixture-v1',actionId:'read',values:{}});revision=r.revision;
  r=await post('/api/case/actions',{id:'h-share',revision,contentVersion:'fixture-v1',actionId:'share',values:{}});revision=r.revision;
  status.textContent='Session ready at revision '+revision+'.';document.body.dataset.ready='1';}
async function ask(event){event.preventDefault();turn+=1;const message=document.getElementById('question').value;
  const result=await post('./dialogue',{requestId:'turn-'+turn,actorId:'guide',message,locale:'en',revision,contentVersion:'fixture-v1'});
  const box=document.createElement('article');box.className='turn';box.dataset.status=result.status||'error';
  if(result.status==='answered'||result.status==='clarify'){for(const q of result.quotes){const item=document.createElement('div');item.className='quote';
    item.append(text('small','Attributed source · '+pick(q.source)),text('strong',pick(q.title)),text('p',pick(q.body)));box.append(item);}
    status.textContent=result.quotes.length+' attributed source(s).';}
  else{box.append(text('p',result.status==='unavailable'?'Unavailable: '+result.reason:'The answer could not be produced ('+(result.error||'error')+'). The case did not change.','notice'));status.textContent='No answer.';}
  log.append(box);document.body.dataset.turns=String(turn);}
document.getElementById('start').addEventListener('click',()=>start().catch(()=>{status.textContent='Could not start.';}));
document.getElementById('ask').addEventListener('submit',e=>ask(e).catch(()=>{status.textContent='Request failed.';}));
`;

export async function startDialogueHarness({ port = 0, host = '127.0.0.1', pack = syntheticPack(), policy = null, provider = mockProvider() } = {}) {
  if (pack.caseId === 'deleted-name') throw new Error('harness_refuses_the_real_case');
  const service = createCaseService({ pack });
  const adapter = createCaseDialogueAdapter({ pack, policy: policy ?? syntheticPolicy(pack), timeoutMs: 2000,
    readCaseSession: id => service.readSessionState(id), selectSources: input => provider(input) });
  const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://harness.local');
    const send = (status, type, body) => { res.writeHead(status, { ...headers, 'content-type': type }); res.end(body); };
    const json = (status, body) => send(status, 'application/json; charset=utf-8', JSON.stringify(body));
    try {
      if (url.pathname.startsWith('/api/case/')) { if (!await service.handle(req, res, url, json)) json(404, { error: 'not_found' }); return; }
      if (req.method === 'GET' && url.pathname === '/') return send(200, 'text/html; charset=utf-8', PAGE);
      if (req.method === 'GET' && url.pathname === '/app.js') return send(200, 'text/javascript; charset=utf-8', APP_JS);
      if (req.method === 'GET' && url.pathname === '/app.css') return send(200, 'text/css; charset=utf-8', APP_CSS);
      if (req.method === 'POST' && url.pathname === '/dialogue') {
        const parsed = await readJson(req);
        if (parsed.error) return json(parsed.error === 'cross_site' ? 403 : 400, { error: parsed.error });
        const body = parsed.body;
        // The session comes only from the cookie; a browser cannot name one in the body.
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !BODY_KEYS.has(key))) return json(400, { error: 'invalid_request' });
        const sessionId = cookieSession(req.headers.cookie);
        if (!sessionId) return json(401, { error: 'session_unavailable' });
        const result = await adapter.ask({ ...body, sessionId });
        return json(200, result);
      }
      json(404, { error: 'not_found' });
    } catch { json(503, { error: 'harness_unavailable' }); }
  });
  await new Promise(resolve => server.listen(port, host, resolve));
  const root = `http://${host}:${server.address().port}`;
  return { root, server, service, adapter, provider, close: () => new Promise(resolve => server.close(resolve)) };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const index = process.argv.indexOf('--port');
  const port = index > 0 ? Number(process.argv[index + 1]) : 8799;
  const harness = await startDialogueHarness({ port });
  console.log(`Local dialogue harness (synthetic, ${HARNESS_SCOPE}): ${harness.root}/`);
}
