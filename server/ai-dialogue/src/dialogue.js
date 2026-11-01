import { buildContext } from './knowledge.js';
import crypto from 'node:crypto';
import { generateAIResponse } from './ai-provider.js';

const requests = new Map();
const shares = new Map();

export function makeRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function fingerprint(content) {
  const str = JSON.stringify(content);
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function simulateReply(characterId, playerMessage, allowedFacts = []) {
  const ctx = buildContext(characterId, allowedFacts);
  const lower = (playerMessage || '').toLowerCase();

  if (
    ctx.forbidden.some(
      (f) =>
        lower.includes(f.replace(/_/g, ' ')) ||
        (lower.includes('ظرف') && characterId === 'jonas' && !allowedFacts.includes('envelope_shared'))
    )
  ) {
    return { text: 'ما أعرف عن هالشي. ما شفته.', refused: true };
  }

  if (characterId === 'jonas') {
    if (lower.includes('كنت معي') || lower.includes('شهادة') || lower.includes('صرخة')) {
      return {
        text: 'إيه. كنا نتكلم في الصالة لما سمعنا الصرخة. اللي صار قبل ما تجلس، ما شفته.',
        refused: false,
      };
    }
    return { text: 'اسأل. أعرف سوالفهم، مو كل شي.', refused: false };
  }

  if (characterId === 'claire') {
    if (lower.includes('دعوة') || lower.includes('رتب') || lower.includes('ضيف')) {
      return {
        text: 'فيكتور أعطاني اسمك. قال إنك ضيفه. أقدر أوريك الرسائل إذا تبي.',
        refused: false,
      };
    }
    if (lower.includes('ملاحظة') && !allowedFacts.includes('note_shared')) {
      return { text: 'ما شفت الملاحظة. إذا عندكها، ورّيني.', refused: true };
    }
    return {
      text: 'أعرف مين ما يأكل وش، ومين ما يجلس جنب مين. أما ليش جمعهم… تركني أخمّن مثل الباقين.',
      refused: false,
    };
  }

  return { text: 'ما أقدر أجاوب خارج ما أعرفه.', refused: true };
}

/**
 * In a real environment with PostgreSQL and Gemini:
 * 1. Check DB for existing request by requestId and ownerId.
 * 2. If exists, compare fingerprint. If different -> 409 conflict. If same -> return cached response.
 * 3. If missing, save pending request to DB.
 * 4. Build context, call Gemini API.
 * 5. Update DB with Gemini response.
 * 6. Return response.
 */
export async function submitRequest(requestId, characterId, message, sharedFacts = [], contentVersion = 'v1', ownerId = 'anon') {
  const fp = fingerprint({ characterId, message, sharedFacts, contentVersion });
  const existing = requests.get(requestId);

  if (existing) {
    if (existing.owner !== ownerId) {
      return { error: 'forbidden', status: 'forbidden' };
    }
    if (existing.fingerprint === fp) {
      if (existing.status === 'pending') {
          // In a real system, you might wait or return a specific code telling client to wait/retry.
          // Returning conflict to avoid duplicate generation running concurrently.
          return { error: 'generation_in_progress', status: 'conflict' };
      }
      return { ...existing, replayed: true };
    }
    return { error: 'request_id_conflict', status: 'conflict' };
  }

  // Build context, filtering out any invalid client shared facts against real DB in production.
  const safeContext = buildContext(characterId, sharedFacts);

  let record = {
    fingerprint: fp,
    status: 'pending',
    contentVersion,
    owner: ownerId,
    characterId,
    message,
    createdAt: new Date().toISOString(),
  };

  requests.set(requestId, record);

  // Add artificial delay to allow concurrent tests to hit pending state
  await new Promise(r => setTimeout(r, 50));

  try {
      // In future: const reply = await generateAIResponse(characterId, message, safeContext);
      const reply = simulateReply(characterId, message, safeContext.allowed);
      record.response = reply;
      record.status = 'completed';
      requests.set(requestId, record);
      return { ...record, replayed: false };
  } catch (e) {
      requests.delete(requestId);
      return { error: 'generation_failed', status: 'failed' };
  }
}

export function recordShare(shareKey) {
  if (shares.has(shareKey)) return { duplicated: true };
  shares.set(shareKey, true);
  return { duplicated: false };
}

export function getRequest(requestId, ownerId) {
  const rec = requests.get(requestId);
  if (!rec) return null;
  if (ownerId && rec.owner !== ownerId) return { error: 'forbidden' };
  return rec;
}

export function listRequests(ownerId) {
  const out = [];
  for (const [id, rec] of requests) {
    if (rec.owner === ownerId && rec.status === 'completed') out.push({ id, ...rec });
  }
  return out;
}

export function _reset() {
  requests.clear();
  shares.clear();
}
