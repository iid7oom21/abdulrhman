import { getSettings, getKey, LS } from './config.js';

export class GeminiError extends Error {
  constructor(code, msg, extra = {}) { super(msg); this.code = code; Object.assign(this, extra); }
}
const AR = {
  NO_KEY: 'ما فيه مفتاح API. افتح الإعدادات وأدخل المفتاح أو حدد رابط البروكسي.',
  400: 'الطلب غير صالح (400). راجع اسم الموديل أو الإعدادات.',
  401: 'المفتاح غير صحيح أو منتهي (401).',
  403: 'ما عندك صلاحية (403). تأكد أن المفتاح مفعّل لـ Gemini API.',
  404: 'الموديل غير موجود (404).',
  429: 'تجاوزت حد الطلبات (429). جرّب بعد شوي.',
  5: 'خطأ من خوادم Google (5xx). حاول مرة ثانية.',
  NETWORK: 'تعذر الاتصال بالشبكة. تأكد من الإنترنت أو رابط البروكسي.',
  TIMEOUT: 'انتهت مهلة الطلب.',
  ABORT: 'تم إلغاء الطلب.',
  BLOCKED: 'تم حجب الرد لأسباب أمان المحتوى.',
  EMPTY: 'وصل رد فاضي بدون نتائج.',
  PARSE: 'تعذر قراءة رد الخادم (JSON غير صالح).',
};
export const arMsg = (code) => AR[code] || (code >= 500 ? AR[5] : `خطأ غير متوقع (${code}).`);

export function buildBody({ system, text, params }) {
  const body = { contents: [{ role: 'user', parts: [{ text }] }], generationConfig: {} };
  if (system?.trim()) body.systemInstruction = { parts: [{ text: system }] };
  for (const k of ['temperature', 'topP', 'topK', 'maxOutputTokens'])
    if (params[k] !== '' && params[k] != null && !isNaN(params[k])) body.generationConfig[k] = Number(params[k]);
  return body;
}

function endpoint(model, stream) {
  const s = getSettings(); const key = getKey();
  const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  if (s.proxyBase) return { url: `${s.proxyBase.replace(/\/$/, '')}/v1beta/models/${model}:${method}`, headers: {} };
  if (!key) throw new GeminiError('NO_KEY', arMsg('NO_KEY'));
  return { url: `${s.apiBase}/models/${model}:${method}`, headers: { 'x-goog-api-key': key } };
}

function checkPayload(json) {
  if (json?.promptFeedback?.blockReason) throw new GeminiError('BLOCKED', arMsg('BLOCKED') + ` (${json.promptFeedback.blockReason})`, { json });
  const c = json?.candidates?.[0];
  if (!c) throw new GeminiError('EMPTY', arMsg('EMPTY'), { json });
  if (c.finishReason === 'SAFETY' && !c.content) throw new GeminiError('BLOCKED', arMsg('BLOCKED'), { json });
  return (c.content?.parts || []).map(p => p.text || '').join('');
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** يرسل الطلب مع إعادة المحاولة (429/5xx) ومهلة. onChunk للبث. */
export async function generate({ model, system, text, params, stream = false, onChunk, signal }) {
  const s = getSettings();
  const body = buildBody({ system, text, params });
  const { url, headers } = endpoint(model, stream);
  const t0 = performance.now();
  let attempt = 0, lastErr;
  while (attempt <= s.maxRetries) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort('timeout'), s.timeoutMs);
    signal?.addEventListener('abort', () => ctl.abort('user'), { once: true });
    try {
      let res;
      try {
        res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctl.signal });
      } catch (e) {
        if (ctl.signal.aborted) throw new GeminiError(ctl.signal.reason === 'user' ? 'ABORT' : 'TIMEOUT', arMsg(ctl.signal.reason === 'user' ? 'ABORT' : 'TIMEOUT'));
        throw new GeminiError('NETWORK', arMsg('NETWORK'), { retryable: true });
      }
      if (!res.ok) {
        let detail = ''; try { detail = (await res.json())?.error?.message || ''; } catch {}
        throw new GeminiError(res.status, arMsg(res.status), { detail, retryable: res.status === 429 || res.status >= 500, status: res.status });
      }
      let out = '', usage = null, raw;
      if (stream) {
        raw = [];
        const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let i; while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue;
            let j; try { j = JSON.parse(line.slice(5)); } catch { throw new GeminiError('PARSE', arMsg('PARSE')); }
            raw.push(j); if (j.usageMetadata) usage = j.usageMetadata;
            if (j.promptFeedback?.blockReason) checkPayload(j);
            const piece = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
            out += piece; onChunk?.(piece, out);
          }
        }
        if (!out) checkPayload(raw[raw.length - 1]);
      } else {
        try { raw = await res.json(); } catch { throw new GeminiError('PARSE', arMsg('PARSE')); }
        out = checkPayload(raw); usage = raw.usageMetadata; onChunk?.(out, out);
      }
      const r = { text: out, usage, raw, request: { url: url.replace(/key=[^&]+/, 'key=***'), body }, latencyMs: Math.round(performance.now() - t0), attempts: attempt + 1 };
      logCall({ ok: true, model, latencyMs: r.latencyMs, tokens: usage?.totalTokenCount || 0 });
      return r;
    } catch (e) {
      lastErr = e.code ? e : new GeminiError('UNKNOWN', String(e));
      if (!lastErr.retryable || attempt === s.maxRetries) break;
      await sleep(Math.min(8000, 500 * 2 ** attempt) + Math.random() * 300);
      attempt++;
    } finally { clearTimeout(timer); }
  }
  logCall({ ok: false, model, code: lastErr.code, msg: lastErr.message, latencyMs: Math.round(performance.now() - t0) });
  lastErr.request = { url, body };
  throw lastErr;
}

export function logCall(e) {
  const log = LS.get('calls', []); log.push({ ...e, at: Date.now() });
  LS.set('calls', log.slice(-200));
}
