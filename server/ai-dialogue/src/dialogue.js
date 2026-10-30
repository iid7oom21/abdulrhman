import { buildContext } from './knowledge.js';

const requests = new Map(); // requestId -> { fingerprint, response, status }
const shares = new Map();   // shareKey -> true

export function makeRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function fingerprint(content) {
  return Buffer.from(JSON.stringify(content)).toString('base64').slice(0, 16);
}

/**
 * محاكاة رد AI مع عزل معرفة.
 * لا يكشف معلومة ممنوعة ولا يخترع دليلًا.
 */
export function simulateReply(characterId, playerMessage, sharedFacts = []) {
  const ctx = buildContext(characterId, sharedFacts);
  const lower = playerMessage.toLowerCase();

  // منع كشف المعرفة الممنوعة
  if (ctx.forbidden.some(f => lower.includes(f.replace(/_/g, ' ')) || lower.includes('ظرف') && characterId === 'jonas' && !sharedFacts.includes('envelope_shared'))) {
    return { text: 'ما أعرف عن هالشي. ما شفته.', refused: true };
  }

  if (characterId === 'jonas') {
    if (lower.includes('كنت معي') || lower.includes('شهادة')) {
      return { text: 'إيه. كنا نتكلم في الصالة لما سمعنا الصرخة. اللي صار قبل ما تجلس، ما شفته.', refused: false };
    }
    return { text: 'اسأل. أعرف سوالفهم، مو كل شي.', refused: false };
  }

  if (characterId === 'claire') {
    if (lower.includes('دعوة') || lower.includes('رتبت')) {
      return { text: 'فيكتور أعطاني اسمك. قال إنك ضيفه. أقدر أوريك الرسائل إذا تبي.', refused: false };
    }
    if (lower.includes('ملاحظة') && !sharedFacts.includes('note_shared')) {
      return { text: 'ما شفت الملاحظة. إذا عندكها، ورّيني.', refused: true };
    }
    return { text: 'أعرف مين ما يأكل وش، ومين ما يجلس جنب مين. أما ليش جمعهم… تركني أخمّن مثل الباقين.', refused: false };
  }

  return { text: 'ما أقدر أجاوب خارج ما أعرفه.', refused: true };
}

export function submitRequest(requestId, characterId, message, sharedFacts = [], contentVersion = 'v1') {
  const fp = fingerprint({ characterId, message, sharedFacts, contentVersion });
  const existing = requests.get(requestId);
  if (existing) {
    if (existing.fingerprint === fp && existing.response) {
      return { ...existing, replayed: true };
    }
    return { error: 'request_id_conflict', status: 'conflict' };
  }

  const reply = simulateReply(characterId, message, sharedFacts);
  const record = { fingerprint: fp, response: reply, status: 'completed', contentVersion };
  requests.set(requestId, record);
  return { ...record, replayed: false };
}

export function recordShare(shareKey) {
  if (shares.has(shareKey)) return { duplicated: true };
  shares.set(shareKey, true);
  return { duplicated: false };
}

export function getRequest(requestId) {
  return requests.get(requestId) || null;
}

// للاختبار فقط
export function _reset() {
  requests.clear();
  shares.clear();
}
