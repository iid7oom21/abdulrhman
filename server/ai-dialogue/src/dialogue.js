import { createHash, randomUUID } from 'node:crypto';
import { buildContext, CHARACTERS } from './knowledge.js';

const requests = new Map();
export const makeRequestId = () => randomUUID();
export const fingerprint = content => createHash('sha256').update(JSON.stringify(content)).digest('hex');

// This preview has no trusted story-event/share engine. Client facts are never knowledge.
export function simulateReply(characterId, playerMessage) {
  buildContext(characterId);
  return {
    text: 'النص الأصلي لهذه الإفادة غير متاح في هذه المعاينة. لا أستطيع تأكيد تفاصيل الواقعة أو إنشاء دليل من الحوار.',
    refused: true,
  };
}

export function submitRequest(requestId, characterId, message, sharedFacts = [], contentVersion = 'deleted-name-preview-v2', ownerId) {
  if (!ownerId || !Object.hasOwn(CHARACTERS, characterId) || typeof requestId !== 'string' ||
      !/^[\w-]{1,100}$/.test(requestId) || typeof message !== 'string' || !message.trim() || message.length > 8000) {
    return { error: 'invalid_request', status: 'error' };
  }
  if (!Array.isArray(sharedFacts) || sharedFacts.length) return { error: 'untrusted_facts', status: 'error' };
  const fp = fingerprint({ characterId, message, contentVersion });
  const existing = requests.get(requestId);
  if (existing) {
    if (existing.owner !== ownerId) return { error: 'forbidden', status: 'error' };
    if (existing.fingerprint !== fp) return { error: 'request_id_conflict', status: 'conflict' };
    return { ...existing, replayed: true };
  }
  // Synchronous simulation: register before generating; a failure remains an error on GET/replay.
  const record = {
    id: requestId, fingerprint: fp, status: 'pending', contentVersion, owner: ownerId,
    characterId, message, createdAt: new Date().toISOString(), storage: 'server-memory',
  };
  requests.set(requestId, record);
  try {
    record.response = simulateReply(characterId, message);
    record.status = 'completed';
  } catch {
    record.status = 'error';
    record.error = 'simulation_error';
  }
  return { ...record, replayed: false };
}

export function getRequest(requestId, ownerId) {
  const rec = requests.get(requestId);
  if (!rec || !ownerId || rec.owner !== ownerId) return null;
  return { ...rec };
}
export function listRequests(ownerId) {
  return [...requests.values()].filter(rec => ownerId && rec.owner === ownerId).map(rec => ({ ...rec }));
}
export function _reset() { requests.clear(); }
