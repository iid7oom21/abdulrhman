import { createHash, randomUUID } from 'node:crypto';
import { buildContext, CHARACTERS } from './knowledge.js';

const requests = new Map();
// Keep accepted IDs for the whole session: evicting one would allow a second paid generation.
export const MAX_REQUESTS_PER_OWNER = 100;
const idsByOwner = new Map();
function remember(ownerId, requestId) {
  const ids = idsByOwner.get(ownerId) || [];
  ids.push(requestId);
  idsByOwner.set(ownerId, ids);
}
// Called when a session expires or is evicted: its operations go with it.
export function forgetOwner(ownerId) {
  for (const id of idsByOwner.get(ownerId) || []) requests.delete(id);
  idsByOwner.delete(ownerId);
}
export const makeRequestId = () => randomUUID();
export const fingerprint = content => createHash('sha256').update(JSON.stringify(content)).digest('hex');
export const SOURCE_REFUSAL = 'النص الأصلي لهذه الإفادة غير متاح في هذه المعاينة. لا أستطيع تأكيد تفاصيل الواقعة أو إنشاء دليل من الحوار.';
const clone = value => structuredClone(value);

// This preview has no trusted story-event/share engine. Client facts are never knowledge.
export function simulateReply(characterId, playerMessage, received) {
  const context = buildContext(characterId, received);
  // Describe received materials as attributed statements, never as proven story facts.
  const receivedFromPlayer = context.received?.materials.filter(item => item.author === 'player') || [];
  if (/المواد|شارك|تصحيح/.test(playerMessage) && receivedFromPlayer.length) {
    return { text:'هذه المواد وصلتني؛ تسجيل القول لا يثبت صحته:\n' + receivedFromPlayer.map(item =>
      (item.type === 'correction' ? (item.isLatestKnownCorrection ? 'تصحيح أحدث معروف' : 'تصحيح سابق') :
        item.type === 'report' ? 'مسودة تقرير' : item.type === 'receipt' ? 'إيصال' :
        item.type === 'motive' ? 'تفسير دافع' : item.type === 'evidence' ? 'مادة مصدر' : 'قول أو ملاحظة مسجلة') + ': ' + item.text).join('\n'), refused:false };
  }
  return {
    text: SOURCE_REFUSAL,
    refused: true,
  };
}

export function submitRequest(requestId, characterId, message, sharedFacts = [], contentVersion = 'deleted-name-preview-v2', ownerId, received, generate = simulateReply, lifecycle = {}) {
  if (!ownerId || !Object.hasOwn(CHARACTERS, characterId) || typeof requestId !== 'string' ||
      !/^[\w-]{1,100}$/.test(requestId) || typeof message !== 'string' || !message.trim() || message.length > 8000 ||
      typeof contentVersion !== 'string' || !/^[\w.-]{1,100}$/.test(contentVersion)) {
    return { error: 'invalid_request', status: 'error' };
  }
  if (!Array.isArray(sharedFacts) || sharedFacts.length) return { error: 'untrusted_facts', status: 'error' };
  const fp = fingerprint({ characterId, message, contentVersion });
  const existing = requests.get(requestId);
  if (existing) {
    if (existing.owner !== ownerId) return { error: 'forbidden', status: 'error' };
    if (existing.fingerprint !== fp) return { error: 'request_id_conflict', status: 'conflict' };
    return { ...clone(existing), replayed: true };
  }
  const unresolved = listRequests(ownerId).find(r => r.characterId === characterId && ['pending', 'unknown'].includes(r.status));
  if (unresolved) return { error:'character_busy', status:'conflict', activeRequestId:unresolved.id };
  if ((idsByOwner.get(ownerId)?.length || 0) >= MAX_REQUESTS_PER_OWNER) return { error:'requests_limit', status:'error' };
  // Reserve and checkpoint BEFORE any provider side effect. Polling never enters this code.
  const record = {
    id: requestId, fingerprint: fp, status: 'pending', contentVersion, owner: ownerId,
    characterId, message, createdAt: new Date().toISOString(), storage: 'server-memory',
  };
  requests.set(requestId, record);
  remember(ownerId, requestId);
  const settle = (response, failure) => {
    if (requests.get(requestId) !== record) return; // expired session / disposed test process
    if (failure) {
      record.status = failure.outcomeUnknown ? 'unknown' : 'error';
      // Provider messages may contain secrets or untrusted output. Only closed codes cross HTTP.
      record.error = ['provider_unavailable','provider_rejected','provider_invalid_output','provider_busy'].includes(failure.code)
        ? failure.code : 'simulation_error';
    } else if (!response || typeof response.text !== 'string' || !response.text.trim() || response.text.length > 40000 || typeof response.refused !== 'boolean') {
      record.status = 'error'; record.error = 'provider_invalid_output';
    } else {
      record.response = { text:response.text, refused:response.refused,
        ...(['grounded-model','deterministic-fallback'].includes(response.source) ? {source:response.source} : {}) };
      record.status = 'completed';
    }
    lifecycle.onSettled?.();
  };
  try {
    lifecycle.beforeGenerate?.();
  } catch {
    record.status = 'error';
    record.error = 'storage_unavailable';
    record.saveStatus = 'unconfirmed';
    return { ...clone(record), replayed:false };
  }
  try {
    const result = generate(characterId, message, clone(received));
    if (result && typeof result.then === 'function') result.then(value => settle(value), error => settle(null, error));
    else settle(result);
  } catch (error) { settle(null, error); }
  return { ...clone(record), replayed: false };
}

export function getRequest(requestId, ownerId) {
  const rec = requests.get(requestId);
  if (!rec || !ownerId || rec.owner !== ownerId) return null;
  return clone(rec);
}
export function listRequests(ownerId) {
  return [...requests.values()].filter(rec => ownerId && rec.owner === ownerId).map(clone);
}
// Disk snapshot support: records are plain JSON (owner/fingerprint stay server-side; the HTTP layer strips them).
export function exportRequests() {
  const out = [];
  for (const ids of idsByOwner.values()) for (const id of ids) if (requests.has(id)) out.push(clone(requests.get(id)));
  return out;
}
// An interrupted remote call has an unknown outcome. Restart never retries generation.
export function importRequest(record) {
  if (!record || typeof record.id !== 'string' || typeof record.owner !== 'string' || requests.has(record.id)) return false;
  requests.set(record.id, { ...clone(record), ...(record.status === 'pending' ? {status:'unknown', error:'provider_unavailable'} : {}) });
  remember(record.owner, record.id);
  return true;
}
export function _reset() { requests.clear(); idsByOwner.clear(); }
export function markSaveStatus(owners, status) {
  for (const record of requests.values()) if (owners.has(record.owner)) record.saveStatus = status;
}
