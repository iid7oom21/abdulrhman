import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {openCaseStore} from './case-store.js';
import {createCaseCheckpoint, checkpointSessionTag, MAX_CHECKPOINT_BODY_BYTES} from './case-checkpoint.js';
import {CaseError, canonical, caseFingerprint, validateCasePack, validateOpening, createCaseState,
  applyCaseAction, projectCaseState, validateCaseRequest, validateStoredCaseState} from './case-engine.js';

export const DEFAULT_CASE_STORAGE_PATH = fileURLToPath(new URL('../.data/case-store.json', import.meta.url));
const COOKIE = 'raven_case_session';
const clone = value => structuredClone(value);
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const only = (value, fields) => plain(value) && Object.keys(value).every(key => fields.includes(key));
const fail = (condition, code = 'case_store_invalid', status = 400) => { if (!condition) throw new CaseError(code, status); };
const inside = (file, directory) => file === directory || file.startsWith(directory + path.sep);

export function loadCaseContent(file, {siteRoot = null} = {}) {
  if (!path.isAbsolute(file)) throw new CaseError('case_content_invalid');
  try {
    const real = fs.realpathSync(file), info = fs.lstatSync(file);
    if (real !== path.resolve(file) || !info.isFile() || info.isSymbolicLink() || info.size > 8 * 1024 * 1024 || (siteRoot && inside(real, fs.realpathSync(siteRoot)))) throw new Error('private');
    // A private pack must never be loaded from any checkout, including a linked worktree.
    for (let directory = path.dirname(real); ; directory = path.dirname(directory)) {
      if (fs.existsSync(path.join(directory, '.git'))) throw new Error('private');
      if (path.dirname(directory) === directory) break;
    }
    return validateCasePack(JSON.parse(fs.readFileSync(real, 'utf8')));
  } catch { throw new CaseError('case_content_invalid'); }
}

// Stored projections are independently closed: an old content version remains exportable,
// but no arbitrary property from a damaged snapshot can become a public response.
function validateProjection(view, state) {
  const localized = value => plain(value) && Object.keys(value).length > 0 && Object.entries(value).every(([locale, item]) => /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) && typeof item === 'string' && item.length <= 40000);
  const art = item => (item.image === undefined || /^\/raven\/deleted-name\/assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:webp|png|jpg)$/.test(item.image)) && (item.imageRow === undefined || [0,1,2].includes(item.imageRow));
  fail(only(view, ['caseId','contentVersion','revision','saveStatus','persistence','scene','materials','actions','notes','captures','shares','receipts','opening']));
  fail(view.caseId === state.caseId && view.contentVersion === state.contentVersion && view.revision === state.revision && ['confirmed','memory','browser-required'].includes(view.saveStatus) && ['disk-file','process-memory','browser-checkpoint'].includes(view.persistence));
  fail(only(view.scene,['id','title','body','image','imageRow','lines']) && view.scene.id === state.sceneId && localized(view.scene.title) && localized(view.scene.body) && art(view.scene));
  fail(Array.isArray(view.scene.lines) && view.scene.lines.every(line => only(line,['speaker','text']) && localized(line.speaker) && localized(line.text)));
  fail(Array.isArray(view.materials) && canonical(view.materials.map(item => item.id)) === canonical(state.materialIds));
  for (const material of view.materials) fail(only(material,['id','title','body','type','source','image','imageRow']) && localized(material.title) && localized(material.body) && localized(material.source) && ['document','testimony','recording','map','note'].includes(material.type) && art(material));
  fail(Array.isArray(view.actions));
  for (const action of view.actions) {
    fail(only(action,['id','label','fields','receiptPreview']) && typeof action.id === 'string' && localized(action.label) && (action.fields === undefined || Array.isArray(action.fields)));
    for (const field of action.fields || []) {
      fail(only(field,['id','type','label','required','maxLength','options']) && typeof field.id === 'string' && localized(field.label) && ['text','textarea','select','materialRefs'].includes(field.type));
      if (field.options !== undefined) fail(Array.isArray(field.options) && field.options.every(option => only(option,['value','label']) && typeof option.value === 'string' && localized(option.label)));
    }
    if (action.receiptPreview !== undefined) {
      const preview = action.receiptPreview;
      const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(value) && !['constructor','prototype','__proto__'].includes(value);
      fail(only(preview,['kind','title','scope','fromCapture','capture','materials','shares','relatesTo']) && identifier(preview.kind) && localized(preview.title) && preview.scope === 'story-only');
      fail((preview.fromCapture === undefined) === (preview.capture === undefined));
      if (preview.capture !== undefined) fail(Object.entries(state.captures).some(([key,capture]) => preview.fromCapture === key + '.revision.' + capture.revision && canonical(preview.capture) === canonical(capture)));
      fail(preview.relatesTo === undefined || state.receipts.some(receipt => receipt.id === preview.relatesTo));
      fail(Array.isArray(preview.shares) && preview.shares.length <= 200 && preview.shares.every(share => only(share,['materialId','recipient']) && state.materialIds.includes(share.materialId) && identifier(share.recipient)));
      fail(Array.isArray(preview.materials) && canonical(preview.materials.map(material => material.id)) === canonical([...new Set(preview.shares.map(share => share.materialId))]));
      for (const material of preview.materials) fail(only(material,['id','title']) && view.materials.some(earned => earned.id === material.id && canonical(earned.title) === canonical(material.title)));
    }
  }
  for (const key of ['notes','captures','shares','receipts','opening']) fail(canonical(view[key]) === canonical(state[key]));
}

function projectionMatches(stored, current) {
  // Older saves predate receipt reviews. Missing optional previews may be
  // regenerated, while any stored preview must still match canonical replay.
  const expected = clone(current);
  expected.actions.forEach((action,index) => {
    if (stored.actions[index]?.receiptPreview === undefined) delete action.receiptPreview;
  });
  return canonical(stored) === canonical(expected);
}

export function createCaseService({contentPath = null, storagePath = null, pack:injectedPack = null,
  siteRoot = null, secureCookie = false, openStore = openCaseStore, maxSessions = 10000, maxOperations = 4096, checkpointKey = null} = {}) {
  const checkpoints = checkpointKey === null || checkpointKey === undefined ? null : createCaseCheckpoint(checkpointKey);
  if (checkpoints && storagePath) throw new CaseError('case_checkpoint_configuration_invalid');
  if (checkpoints) {
    fail(Number.isSafeInteger(maxSessions) && maxSessions > 0 && Number.isSafeInteger(maxOperations) && maxOperations > 0, 'case_checkpoint_configuration_invalid');
    maxSessions = Math.min(maxSessions,128); maxOperations = Math.min(maxOperations,4096);
  }
  const pack = injectedPack ? validateCasePack(injectedPack) : contentPath ? loadCaseContent(contentPath, {siteRoot}) : null;
  const packFingerprint = pack ? caseFingerprint(pack) : null;
  const persistence = checkpoints ? 'browser-checkpoint' : storagePath ? 'disk-file' : 'process-memory';
  let sessions = new Map(), writeBlocked = false;
  const validateSnapshot = snapshot => {
    fail(only(snapshot,['schemaVersion','sessions']) && snapshot.schemaVersion === 1 && Array.isArray(snapshot.sessions) && snapshot.sessions.length <= maxSessions);
    const ids = new Set();
    for (const session of snapshot.sessions) {
      fail(only(session,['id','state','operations','view']) && /^[a-f0-9]{64}$/.test(session.id) && !ids.has(session.id)); ids.add(session.id);
      validateStoredCaseState(session.state); validateProjection(session.view, session.state);
      fail(Array.isArray(session.operations) && session.operations.length <= maxOperations && session.operations.length === session.state.revision);
      const operationIds = new Set();
      let replay = pack && session.state.contentVersion === pack.contentVersion && session.state.caseId === pack.caseId ? createCaseState(pack, session.state.opening) : null;
      for (const [index, operation] of session.operations.entries()) {
        fail(only(operation,['request','fingerprint']) && !operationIds.has(operation.request?.id));
        const request = validateCaseRequest(operation.request); operationIds.add(request.id);
        fail(request.revision === index && request.contentVersion === session.state.contentVersion && operation.fingerprint === caseFingerprint(request));
        if (replay) replay = applyCaseAction(pack, replay, request);
      }
      if (replay) {
        fail(canonical(replay) === canonical(session.state));
        fail(projectionMatches(session.view,projectCaseState(pack,replay,session.view.persistence)));
      }
    }
    return true;
  };
  const disk = storagePath ? openStore(storagePath, {validate:validateSnapshot}) : null;
  if (disk) {
    const snapshot = disk.load();
    if (snapshot !== null) { validateSnapshot(snapshot); sessions = new Map(snapshot.sessions.map(session => [session.id, session])); }
  }
  const commit = candidate => {
    if (writeBlocked) throw new CaseError('storage_unavailable', 503);
    try { disk?.save({schemaVersion:1,sessions:[...candidate.values()]}); }
    catch { writeBlocked = true; throw new CaseError('storage_unavailable', 503); }
    sessions = candidate;
  };
  const compatible = session => pack && session.state.contentVersion === pack.contentVersion && session.state.caseId === pack.caseId;
  const viewOf = session => {
    const view = compatible(session) ? projectCaseState(pack, session.state, persistence)
      : {...clone(session.view),actions:[],readOnly:true,contentVersionMismatch:true};
    // A failed directory fsync can follow rename: retain the last acknowledged
    // reading view, but do not claim it matches disk or accept further writes.
    return writeBlocked ? {...view,saveStatus:'unconfirmed',actions:[],readOnly:true,storageUnavailable:true} : view;
  };
  const responseOf = session => {
    const view = viewOf(session);
    if (!checkpoints) return view;
    // Select the session fields explicitly: no pack, future scenes, or arbitrary
    // service metadata can be included in a browser's encrypted recovery copy.
    const checkpoint = checkpoints.seal({schemaVersion:1,packFingerprint:session.packFingerprint,
      session:{id:session.id,state:session.state,operations:session.operations,view:session.view}});
    return {...view,checkpoint,checkpointInfo:{sessionTag:checkpointSessionTag(session.id),
      historyTag:caseFingerprint({state:session.state,operations:session.operations}),
      caseId:session.state.caseId,contentVersion:session.state.contentVersion,revision:session.state.revision}};
  };
  const candidateWith = entry => {
    const candidate = new Map(sessions);
    candidate.delete(entry.id); candidate.set(entry.id,entry);
    if (checkpoints) while (candidate.size > maxSessions) candidate.delete(candidate.keys().next().value);
    return candidate;
  };
  const cookieFor = (req,res,id) => res.setHeader('Set-Cookie', `${COOKIE}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${req.socket.encrypted || secureCookie ? '; Secure' : ''}`);
  const restoredSession = token => {
    const payload = checkpoints.open(token);
    try {
      fail(only(payload,['schemaVersion','packFingerprint','session']) && payload.schemaVersion === 1 && typeof payload.packFingerprint === 'string' && /^[a-f0-9]{64}$/.test(payload.packFingerprint));
      const session = payload.session;
      fail(only(session,['id','state','operations','view']) && typeof session.id === 'string' && /^[a-f0-9]{64}$/.test(session.id));
      validateStoredCaseState(session.state); validateProjection(session.view,session.state);
      fail(session.view.persistence === 'browser-checkpoint' && session.view.saveStatus === 'browser-required');
      fail(Array.isArray(session.operations) && session.operations.length <= maxOperations && session.operations.length === session.state.revision);
      const ids = new Set();
      for (const [index,operation] of session.operations.entries()) {
        fail(only(operation,['request','fingerprint']));
        const request = validateCaseRequest(operation.request);
        fail(!ids.has(request.id) && request.revision === index && request.contentVersion === session.state.contentVersion && operation.fingerprint === caseFingerprint(request));
        ids.add(request.id);
      }
      if (pack && (session.state.caseId !== pack.caseId || (session.state.contentVersion === pack.contentVersion && payload.packFingerprint !== packFingerprint))) throw new CaseError('content_version_mismatch',409);
      if (compatible(session)) {
        let replay = createCaseState(pack,session.state.opening);
        for (const operation of session.operations) replay = applyCaseAction(pack,replay,operation.request);
        fail(canonical(replay) === canonical(session.state));
        fail(projectionMatches(session.view,projectCaseState(pack,replay,persistence)));
      }
      return {...session,packFingerprint:payload.packFingerprint};
    } catch (error) {
      if (error instanceof CaseError && error.code === 'content_version_mismatch') throw error;
      throw new CaseError('checkpoint_invalid');
    }
  };
  const config = () => ({enabled:!!pack, ...(pack ? {caseId:pack.caseId,contentVersion:pack.contentVersion,locales:[...pack.locales],defaultLocale:pack.defaultLocale} : {}),scope:'written-story',persistence});
  const readBody = async (req, limit = 65536) => {
    fail(req.headers['content-type']?.split(';')[0].trim().toLowerCase() === 'application/json', 'json_required', 415);
    if (req.headers['sec-fetch-site'] === 'cross-site') throw new CaseError('cross_site',403);
    if (req.headers.origin) {
      const protocol = req.socket.encrypted || secureCookie ? 'https:' : 'http:';
      let origin, expected;
      try { origin = new URL(req.headers.origin); expected = new URL(protocol + '//' + req.headers.host); }
      catch { throw new CaseError('cross_site',403); }
      fail(origin.origin === expected.origin, 'cross_site',403);
    }
    const chunks = []; let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > limit) throw new CaseError('body_too_large',413);
      chunks.push(chunk);
    }
    let body;
    try { body = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,length))); } catch { throw new CaseError('invalid_json'); }
    fail(plain(body),'invalid_request'); return body;
  };
  return {
    async handle(req, res, url, json) {
      if (!url.pathname.startsWith('/api/case/')) return false;
      try {
        if (req.method === 'GET' && url.pathname === '/api/case/config') { json(200, config()); return true; }
        const id = /(?:^|;\s*)raven_case_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
        let session = id ? sessions.get(id) : null;
        if (req.method === 'POST' && url.pathname === '/api/case/restore') {
          if (!checkpoints) throw new CaseError('checkpoint_unavailable',404);
          const body = await readBody(req,MAX_CHECKPOINT_BODY_BYTES);
          fail(only(body,['checkpoint']) && typeof body.checkpoint === 'string','invalid_request');
          const entry = restoredSession(body.checkpoint);
          const cookies = (req.headers.cookie || '').split(';').map(value => value.trim()).filter(value => value.startsWith(COOKIE + '='));
          if (cookies.some(value => value !== COOKIE + '=' + entry.id)) throw new CaseError('checkpoint_session_conflict',409);
          const existing = sessions.get(entry.id);
          if (existing) {
            if (entry.state.revision < existing.state.revision) throw new CaseError('checkpoint_stale',409);
            fail(entry.packFingerprint === existing.packFingerprint && entry.state.caseId === existing.state.caseId && entry.state.contentVersion === existing.state.contentVersion && canonical(entry.state.opening) === canonical(existing.state.opening) && canonical(entry.operations.slice(0,existing.operations.length)) === canonical(existing.operations), 'checkpoint_session_conflict',409);
            if (entry.state.revision === existing.state.revision) fail(canonical(entry) === canonical(existing),'checkpoint_session_conflict',409);
          }
          const response = responseOf(entry); // Seal successfully before accepting any progress.
          commit(candidateWith(entry));
          cookieFor(req,res,entry.id); json(200,response); return true;
        }
        if (req.method === 'POST' && url.pathname === '/api/case/start') {
          const body = await readBody(req);
          session = id ? sessions.get(id) : null;
          fail(only(body,['contentVersion','opening']) && typeof body.contentVersion === 'string','invalid_request');
          const opening = validateOpening(body.opening);
          if (!pack) throw new CaseError('case_unavailable',503);
          if (body.contentVersion !== pack.contentVersion || (session && !compatible(session))) throw new CaseError('content_version_mismatch',409);
          if (session) { json(200,responseOf(session)); return true; }
          if (id) throw new CaseError('session_unavailable',401);
          if (!checkpoints && sessions.size >= maxSessions) throw new CaseError('sessions_limit',503);
          const newId = randomBytes(32).toString('hex'), state = createCaseState(pack,opening);
          const entry = {id:newId,state,operations:[],view:projectCaseState(pack,state,persistence),...(checkpoints ? {packFingerprint} : {})};
          const response = responseOf(entry); commit(candidateWith(entry));
          cookieFor(req,res,newId);
          json(200, response); return true;
        }
        if (!session) throw new CaseError('session_unavailable',401);
        if (req.method === 'GET' && url.pathname === '/api/case/state') { json(200,responseOf(session)); return true; }
        if (req.method === 'GET' && url.pathname === '/api/case/export') {
          const view = viewOf(session); delete view.actions;
          json(200,{format:'raven-case-reading-export-v1',scope:'reading-copy-not-an-import',...view}); return true;
        }
        if (req.method === 'POST' && url.pathname === '/api/case/actions') {
          const request = validateCaseRequest(await readBody(req));
          // Body streaming yields to other requests. Read the latest committed
          // entry only now; synchronous validation/save below forms one turn.
          session = sessions.get(id);
          if (!session) throw new CaseError('session_unavailable',401);
          const fingerprint = caseFingerprint(request);
          const previous = session.operations.find(operation => operation.request.id === request.id);
          if (previous) {
            if (previous.fingerprint !== fingerprint) throw new CaseError('request_id_conflict',409);
            json(200,{...responseOf(session),replayed:true}); return true;
          }
          if (!pack) throw new CaseError('case_unavailable',503);
          if (!compatible(session) || request.contentVersion !== pack.contentVersion) throw new CaseError('content_version_mismatch',409);
          if (session.operations.length >= maxOperations) throw new CaseError('operations_limit',409);
          const state = applyCaseAction(pack, session.state, request);
          const entry = {id,state,operations:[...session.operations,{request,fingerprint}],view:projectCaseState(pack,state,persistence),...(checkpoints ? {packFingerprint} : {})};
          const response = responseOf(entry); commit(candidateWith(entry));
          json(200,{...response,replayed:false}); return true;
        }
        json(404,{error:'not_found'}); return true;
      } catch (error) {
        json(error instanceof CaseError ? error.status : 503, {error:error instanceof CaseError ? error.code : 'case_unavailable'}); return true;
      }
    },
  };
}
