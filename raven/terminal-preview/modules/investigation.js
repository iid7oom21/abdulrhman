import { ACTIVITIES, ACTIVITY_BY_ID, REVISION, FILE_MANIFEST } from './expansion-data.js?v=70ffb86082c1ed7e';

const ALL_EVIDENCE = Array.from({ length: 16 }, (_, i) => `E${String(i + 1).padStart(2, '0')}`);
const DEDUCTIONS = { A08: 'Q01', A14: 'Q02', A26: 'Q03', A32: 'Q04' };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const bounded = (value, max = 1000000) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(max, Math.floor(Number(value)))) : 0;
const clean = value => String(value ?? '').normalize('NFKC').replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776)).replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').trim();
const token = value => clean(value).toUpperCase().replace(/[\s\-–—/:]+/g, '');
const same = (left, right) => Array.isArray(right) ? Array.isArray(left) && left.length === right.length && left.every((v, i) => v === right[i]) : token(left) === token(right);
const sameSet = (left, right) => Array.isArray(left) && left.length === right.length && new Set(left).size === left.length && right.every(v => left.includes(v));

// Kept separate from the public activity descriptors. Local practice is not a trusted score source.
const ANSWERS = {
  A01: { face:'back', lamp:'uv', code:'B17-R' },
  A02: { fragments:['header','site','receipt','signature'], template:'LC-14' },
  A03: { morse:'MA22', caesar:'OPEN' }, A04:{code:'4826'},
  A05:{examined:['crop','full'],detail:'EXT-02',exit:'outside'},
  A06:{lockSite:'EXT-02',latchSite:'AR-01'},
  A07:{region:'NORTH',document:'RC31',container:'BOX',cabinet:'7'}, A08:{answer:'b'},
  A09:{route:'9364',phrase:'افتح درج الوارد الثاني'}, A10:{acrostic:'درج ب',word:'استلام',code:'2479'}, A11:{code:'042'},
  A12:{request:'E05',reason:'attachments-and-recipient'},
  A13:{lucian:'delivery',elias:'inspection',elena:'inventory',nora:'receipt',attachments:['E02','E03','E04'],fourth:'E05'},
  A14:{answer:'d'}, A15:{sample:'elena',limit:'handling'}, A16:{events:['intake','scan','review']}, A17:{code:'5862'},
  A18:{clockOffset:7,alignment:36,position:'01:13'},
  A19:{direction:'reverse',location:'درج المراجعة الثالث',excerptSource:'E13',relation:'same-source'},
  A20:{strips:['intake','faces','sealed','review'],corner:'bottom-right',faces:'2'}, A21:{code:'3814',word:'SOURCE'},
  A22:{version:'V1',key:'3148'}, A23:{file:'back-v1'}, A24:{messages:['deposit','referral','copy','receipt','attach']},
  A25:{people:['elena','elias','nora','lucian'],code:'6284'}, A26:{operations:['signatures','statement','export'],answer:'a',support:['E01','E07']},
  A27:{maintenance:'before',inventory:'after',memo:'before',origin:'unknown'}, A28:{verdict:'rejected',support:['E10','E11','E14']},
  A29:{signatures:'authentic',production:'adrian',fire:'unknown',handling:'handling',omission:'unproven'},
  A30:{lockSource:'E03:1',auditSource:'E07:4',limitSource:'E08:4'}, A31:{key:'7314'}, A32:{answer:'c',support:['E07','E08'],attachment:'back-v1'},
};

/** Returns only whitelisted, bounded fields; never trusts saved DOM/HTML or unknown properties. */
export function sanitizePayload(activityId, input) {
  const activity = ACTIVITY_BY_ID.get(activityId);
  if (!activity || !plain(input)) return {};
  const result = {};
  for (const field of activity.fields) {
    const value = input[field.key];
    if (value === undefined || value === null) continue;
    if (field.type === 'order' || field.type === 'multi') {
      if (Array.isArray(value)) result[field.key] = value.filter(v => typeof v === 'string').map(v => v.slice(0, 80)).slice(0, 32);
    } else if (field.type === 'hashes') {
      if (plain(value)) result[field.key] = Object.fromEntries(FILE_MANIFEST.filter(f => typeof value[f.id] === 'string').map(f => [f.id, value[f.id].slice(0, 64).toLowerCase()]));
    } else if (field.type === 'number') {
      if ((typeof value === 'string' || typeof value === 'number') && clean(value) !== '') result[field.key] = Number(clean(value));
    } else if (typeof value === 'string' || typeof value === 'number') result[field.key] = clean(value).slice(0, field.optional ? 1200 : 500);
  }
  return result;
}

export function evaluateActivity(activityId, input, { viewedIds = [], ignoreSources = false } = {}) {
  const activity = ACTIVITY_BY_ID.get(activityId);
  if (!activity) return { valid: false, correct: false, message: 'المهمة غير معروفة لهذا الإصدار.' };
  if (!ignoreSources && !activity.requiredEvidenceIds.every(id => viewedIds.includes(id))) return { valid: false, correct: false, message: 'افتح مصادر المهمة المتاحة قبل تثبيت النتيجة.' };
  if (!plain(input)) return { valid: false, correct: false, message: 'أكمل مدخلات المهمة أولًا.' };
  const payload = sanitizePayload(activityId, input);
  for (const field of activity.fields) {
    const value = payload[field.key];
    if (field.optional && (value === undefined || value === '')) continue;
    if (field.type === 'multi' || field.type === 'order') {
      const allowed = (field.options || field.items.map(i => ({ value: i.id }))).map(o => o.value);
      if (!Array.isArray(value) || !value.length || new Set(value).size !== value.length || value.some(v => !allowed.includes(v)) || (field.type === 'order' && value.length !== allowed.length)) return { valid: false, correct: false, message: `أكمل «${field.label}» دون تكرار أو عناصر غير متاحة.` };
      if (field.key === 'support' && ['A26','A32'].includes(activityId) && (value.length < 2 || value.length > (activityId === 'A32' ? 3 : 2))) return { valid: false, correct: false, message: activityId === 'A32' ? 'اختر دليلين أو ثلاثة لإسناد الخلاصة.' : 'اختر دليلين لإسناد الحساب المنتج.' };
    } else if (field.type === 'hashes') {
      if (!plain(value) || !FILE_MANIFEST.every(f => /^[0-9a-f]{64}$/.test(value[f.id] || ''))) return { valid: false, correct: false, message: 'احسب بصمات الملفات الثلاثة قبل المطابقة.' };
    } else if (field.type === 'number') {
      if (!Number.isFinite(value) || !Number.isInteger(value) || value < field.min || value > field.max) return { valid: false, correct: false, message: `أدخل قيمة صالحة لـ«${field.label}».` };
    } else if (typeof value !== 'string' || !value || (field.type === 'select' && !field.options.some(o => o.value === value))) return { valid: false, correct: false, message: `أكمل «${field.label}» أولًا.` };
  }
  let correct = Object.entries(ANSWERS[activityId]).every(([key, expected]) => {
    if (key === 'support' && activityId === 'A32') return sameSet(payload[key], ['E07','E08']) || sameSet(payload[key], ['E01','E07','E08']);
    const field = activity.fields.find(f => f.key === key);
    return field?.type === 'multi' ? sameSet(payload[key], expected) : field?.type === 'number' ? payload[key] === expected : same(payload[key], expected);
  });
  if (activityId === 'A23') correct = correct && FILE_MANIFEST.every(f => payload.computedHashes[f.id] === f.sha256);
  return { valid: true, correct, message: correct ? 'ثُبتت النتيجة بمصادرها. يمكنك متابعة التحقيق.' : 'لم تتطابق النتيجة مع كل معطيات المهمة. راجع المصدر والعلاقات ثم أعد المحاولة.' };
}

export function emptyProgress() {
  return { revision: REVISION, mode: 'practice', runId: null, accepted: [], completedActivityIds: [], seq: 0,
    hintsByActivity: {}, wrongSubmissions: 0, requestResults: {}, startedAt: null, completedAt: null, elapsedMs: 0, paused: false };
}

/** Rebuild completion from a valid contiguous answer prefix, never from solvedIds or a count. */
export function normalizeProgress(value) {
  const result = emptyProgress();
  if (!plain(value) || (value.revision !== undefined && value.revision !== REVISION)) return result;
  const accepted = Array.isArray(value.accepted) ? value.accepted : [];
  for (let i = 0; i < Math.min(32, accepted.length); i++) {
    const record = accepted[i];
    const id = ACTIVITIES[i].id;
    if (!plain(record) || record.activityId !== id) break;
    const checked = evaluateActivity(id, record.payload, { ignoreSources: true });
    if (!checked.valid || !checked.correct) break;
    result.accepted.push({ activityId: id, payload: sanitizePayload(id, record.payload) });
    result.completedActivityIds.push(id);
  }
  result.seq = Math.max(result.accepted.length, bounded(value.seq));
  result.wrongSubmissions = bounded(value.wrongSubmissions);
  result.elapsedMs = bounded(value.elapsedMs, 365 * 86400000);
  result.paused = value.paused === true;
  result.mode = value.mode === 'ranked' ? 'ranked' : 'practice';
  result.runId = typeof value.runId === 'string' && value.runId.length <= 100 ? value.runId : null;
  result.startedAt = Number.isFinite(value.startedAt) && value.startedAt > 0 ? value.startedAt : null;
  result.completedAt = result.accepted.length === 32 && Number.isFinite(value.completedAt) && value.completedAt > 0 ? value.completedAt : null;
  if (plain(value.hintsByActivity)) for (const activity of ACTIVITIES.slice(0, Math.min(32, result.accepted.length + 1))) {
    const levels = value.hintsByActivity[activity.id];
    if (Array.isArray(levels)) result.hintsByActivity[activity.id] = [...new Set(levels.filter(v => Number.isInteger(v) && v >= 1 && v <= 3))].sort();
  }
  if (plain(value.requestResults)) for (const [id, response] of Object.entries(value.requestResults).slice(-100)) {
    if (/^[a-zA-Z0-9._:-]{1,100}$/.test(id) && plain(response)) result.requestResults[id] = {
      ok: response.ok === true, valid: response.valid === true, correct: response.correct === true, accepted: response.accepted === true,
      activityId: ACTIVITY_BY_ID.has(response.activityId) ? response.activityId : null, seq: bounded(response.seq),
      message: typeof response.message === 'string' ? response.message.slice(0, 600) : '',
      ...(typeof response.hint === 'string' ? { hint: response.hint.slice(0, 1000) } : {}),
    };
  }
  return result;
}

export function availableEvidenceIds(input) {
  // Only count the validated prefix supplied by normalizers/engine/server.
  const n = Array.isArray(input?.accepted) ? Math.min(32, input.accepted.length) : 0;
  const ids = ['E01','E06','E09'];
  if (n >= 4) ids.push('E02','E03');
  if (n >= 12) ids.push('E04','E05','E08');
  if (n >= 14) ids.push('E15');
  if (n >= 15) ids.push('E12');
  if (n >= 17) ids.push('E13');
  if (n >= 18) ids.push('E14');
  if (n >= 19) ids.push('E10');
  if (n >= 21) ids.push('E11');
  if (n >= 23) ids.push('E16');
  if (n >= 25) ids.push('E07');
  return ids.sort();
}

export function solvedQuestionIds(progress) {
  return (progress?.completedActivityIds || []).filter(id => DEDUCTIONS[id]).map(id => DEDUCTIONS[id]);
}

export async function calculateFileHashes(fetcher = globalThis.fetch) {
  if (!globalThis.crypto?.subtle) throw new Error('التحقق من البصمات يحتاج اتصال HTTPS أو بيئة محلية آمنة.');
  const entries = await Promise.all(FILE_MANIFEST.map(async file => {
    const response = await fetcher(file.url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`تعذر تحميل ${file.label} للتحقق.`);
    const bytes = await response.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return [file.id, Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('')];
  }));
  return Object.fromEntries(entries);
}

export function createInvestigation(services) {
  const store = services.caseStore;
  let active = false;
  let runningSince = null;
  let timer = null;
  let destroyed = false;
  let syncingClock = false;
  let runEpoch = 0;
  let observedProgress = normalizeProgress(store.get().progress);
  const now = () => Date.now();
  const progress = () => normalizeProgress(store.get().progress);
  const totalElapsed = p => p.mode === 'ranked' && p.startedAt ? Math.max(0, (p.completedAt || now()) - p.startedAt) : p.elapsedMs + (runningSince !== null ? Math.max(0, now() - runningSince) : 0);
  function persistClock() {
    if (runningSince === null || destroyed) return;
    const delta = Math.max(0, now() - runningSince);
    runningSince = now();
    if (delta) store.update(s => { const p = normalizeProgress(s.progress); if (p.mode === 'practice' && !p.completedAt) { p.elapsedMs += delta; s.progress = p; } });
  }
  function syncClock() {
    if (destroyed || syncingClock) return;
    syncingClock = true;
    try {
      const p = progress();
      const shouldRun = active && !p.paused && p.mode !== 'ranked' && p.accepted.length < 32 && !(globalThis.document?.hidden);
      if (shouldRun) {
        if (runningSince === null) runningSince = now();
        // Begin on entering the investigation, including time spent before the first answer.
        // A subsequent reset clears this timestamp and cannot inherit an unpersisted delta.
        if (!p.startedAt) store.update(s => { const current = normalizeProgress(s.progress); current.startedAt = now(); s.progress = current; });
      } else if (runningSince !== null) {
        const delta = Math.max(0, now() - runningSince);
        runningSince = null;
        if (delta && p.mode === 'practice' && p.accepted.length < 32) store.update(s => { const current = normalizeProgress(s.progress); current.elapsedMs += delta; s.progress = current; });
      }
    } finally { syncingClock = false; }
  }
  const saveResult = (p, id, result) => {
    p.requestResults[id] = result;
    const keys = Object.keys(p.requestResults);
    if (keys.length > 100) delete p.requestResults[keys[0]];
  };
  const requestID = value => typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,100}$/.test(value) ? value : globalThis.crypto?.randomUUID?.() || `request-${now()}-${Math.random().toString(36).slice(2)}`;
  const fail = message => ({ ok: false, valid: false, correct: false, accepted: false, message });
  const remoteContext = p => ({ runId: p.runId, epoch: runEpoch, accountId: services.cloud?.getSession?.()?.user?.id || null });
  function applyRemote(response, context) {
    const current = progress();
    if (destroyed || context.epoch !== runEpoch || current.mode !== 'ranked' || current.runId !== context.runId ||
        context.accountId !== (services.cloud?.getSession?.()?.user?.id || null)) {
      const error = new Error('تغير الحساب أو المحاولة قبل وصول النتيجة؛ لم يُستبدل التقدم الحالي.');
      error.code = 'RUN_CHANGED';
      throw error;
    }
    if (!plain(response?.progress)) throw new Error('استجابة الخادم لا تحتوي تقدمًا موثقًا.');
    const next = normalizeProgress(response.progress);
    if (next.mode !== 'ranked' || next.runId !== context.runId) throw new Error('استجابة الخادم لا تخص المحاولة الحالية.');
    // Idempotent retries return their original immutable snapshot. Keep the outcome,
    // but never let an older event roll back progress, viewed sources, or dependent notes.
    if (next.seq <= current.seq) return response.result || { ok: true, message: 'سبق تسجيل هذا الطلب؛ بقي تقدمك الأحدث محفوظًا.' };
    if (next.accepted.length < current.accepted.length) throw new Error('استجابة الخادم لا تحتوي تسلسل التقدم الحالي.');
    store.update(s => { s.progress = next; if (Array.isArray(response.viewedIds)) s.viewedIds = response.viewedIds.filter(id => availableEvidenceIds(next).includes(id)); });
    return response.result || { ok: true, message: 'تمت مزامنة حالة المحاولة.' };
  }
  const api = {
    getSnapshot() {
      const p = progress();
      return { ...p, elapsedMs: totalElapsed(p), currentActivityId: ACTIVITIES[p.accepted.length]?.id || null,
        currentActivity: ACTIVITIES[p.accepted.length] || null, accessibleEvidenceIds: availableEvidenceIds(p), solvedIds: solvedQuestionIds(p),
        hintCount: Object.values(p.hintsByActivity).reduce((sum, levels) => sum + levels.length, 0) };
    },
    subscribe(listener) { return store.subscribe(() => listener(api.getSnapshot())); },
    getAccess(evidenceId) {
      const allowed = ALL_EVIDENCE.includes(evidenceId) && availableEvidenceIds(progress()).includes(evidenceId);
      return { allowed, reason: allowed ? '' : 'يفتح هذا الدليل بعد إكمال المهمة السابقة المرتبطة به.' };
    },
    async markViewed(evidenceId) {
      const access = api.getAccess(evidenceId);
      if (!access.allowed) return false;
      if (store.get().viewedIds?.includes(evidenceId)) return true;
      const p = progress();
      if (p.mode === 'ranked') {
        if (!services.cloud?.markViewed || !p.runId) throw new Error('تسجيل فتح الدليل في المنافسة يحتاج الاتصال بالخادم.');
        const context = remoteContext(p);
        applyRemote(await services.cloud.markViewed(p.runId, evidenceId, requestID(), p.seq), context);
      } else store.update(s => { s.viewedIds ||= []; if (!s.viewedIds.includes(evidenceId)) s.viewedIds.push(evidenceId); });
      return true;
    },
    saveDraft(activityId, draft) {
      const p = progress();
      const i = ACTIVITIES.findIndex(a => a.id === activityId);
      if (i < 0 || i > p.accepted.length) return false;
      store.update(s => { s.drafts ||= {}; s.drafts[activityId] = sanitizePayload(activityId, draft); });
      return true;
    },
    async submit(activityId, payload, suppliedId, expectedSeq) {
      persistClock();
      const p = progress();
      const id = requestID(suppliedId);
      if (p.requestResults[id]) return structuredClone(p.requestResults[id]);
      if (expectedSeq !== undefined && expectedSeq !== p.seq) return fail('تغيّر تقدم المحاولة؛ أعد قراءة الحالة الحالية.');
      if (ACTIVITIES[p.accepted.length]?.id !== activityId) return fail('أكمل المهمة الحالية قبل الانتقال إلى مهمة أخرى.');
      if (p.mode === 'ranked') {
        if (!services.cloud?.submitStage || !p.runId) return fail('اعتماد نتيجة المنافسة يحتاج الاتصال بالخادم.');
        const context = remoteContext(p);
        return applyRemote(await services.cloud.submitStage(p.runId, activityId, sanitizePayload(activityId, payload), id, p.seq), context);
      }
      const checked = evaluateActivity(activityId, payload, { viewedIds: (store.get().viewedIds || []).filter(e => api.getAccess(e).allowed) });
      if (!checked.valid) return { ...checked, ok: false, accepted: false, activityId, seq: p.seq };
      const result = { ...checked, ok: checked.correct, accepted: checked.correct, activityId, seq: p.seq + 1 };
      p.seq++;
      if (!p.startedAt) p.startedAt = now();
      if (checked.correct) {
        p.accepted.push({ activityId, payload: sanitizePayload(activityId, payload) });
        p.completedActivityIds.push(activityId);
        if (p.accepted.length === 32) { p.completedAt = now(); runningSince = null; }
      } else p.wrongSubmissions++;
      saveResult(p, id, result);
      store.update(s => { s.progress = p; if (checked.correct && s.drafts) delete s.drafts[activityId]; });
      syncClock();
      return result;
    },
    async revealHint(activityId, level, suppliedId, expectedSeq) {
      const p = progress();
      const id = requestID(suppliedId);
      if (p.requestResults[id]) return structuredClone(p.requestResults[id]);
      if (expectedSeq !== undefined && expectedSeq !== p.seq) return fail('تغيّر تقدم المحاولة؛ أعد قراءة الحالة الحالية.');
      const index = ACTIVITIES.findIndex(a => a.id === activityId);
      if (index < 0 || index > p.accepted.length || !Number.isInteger(level) || level < 1 || level > 3) return fail('هذا التلميح غير متاح الآن.');
      const already = p.hintsByActivity[activityId] || [];
      if (already.includes(level)) return { ok: true, valid: true, hint: ACTIVITIES[index].hints[level - 1], message: 'تلميح سبق فتحه؛ لم يحتسب مرة أخرى.', seq: p.seq };
      if (p.accepted.length === 32) return fail('اكتملت المحاولة؛ يمكنك إعادة قراءة التلميحات المفتوحة فقط.');
      if (level > 1 && !already.includes(level - 1)) return fail('ابدأ بالتلميح السابق قبل فتح المستوى التالي.');
      if (p.mode === 'ranked') {
        if (!services.cloud?.revealHint || !p.runId) return fail('فتح تلميح تنافسي يحتاج الاتصال بالخادم.');
        const context = remoteContext(p);
        return applyRemote(await services.cloud.revealHint(p.runId, activityId, level, id, p.seq), context);
      }
      p.hintsByActivity[activityId] = [...already, level]; p.seq++;
      const result = { ok: true, valid: true, correct: false, accepted: false, activityId, hint: ACTIVITIES[index].hints[level - 1], message: 'فُتح تلميح جديد.', seq: p.seq };
      saveResult(p, id, result); store.update(s => { s.progress = p; });
      return result;
    },
    canReport() { return progress().accepted.length === 32; },
    setActive(value) { active = value === true; syncClock(); },
    setPaused(value) { persistClock(); store.update(s => { const p = normalizeProgress(s.progress); if (p.mode === 'practice') { p.paused = value === true; s.progress = p; } }); syncClock(); },
    destroy() { persistClock(); destroyed = true; runningSince = null; if (timer) clearInterval(timer); unsubscribeClock(); globalThis.document?.removeEventListener('visibilitychange', visibility); globalThis.window?.removeEventListener('pagehide', pagehide); },
  };
  // A reset/replaced run must not inherit the running delta from the old session.
  const unsubscribeClock = store.subscribe(s => {
    const next = normalizeProgress(s.progress);
    if (next.mode !== observedProgress.mode || next.runId !== observedProgress.runId ||
        next.accepted.length < observedProgress.accepted.length || next.elapsedMs < observedProgress.elapsedMs ||
        (observedProgress.startedAt && next.startedAt !== observedProgress.startedAt)) { runningSince = null; runEpoch++; }
    observedProgress = next;
    syncClock();
  });
  const visibility = () => syncClock();
  const pagehide = () => { persistClock(); runningSince = null; };
  globalThis.document?.addEventListener('visibilitychange', visibility);
  globalThis.window?.addEventListener('pagehide', pagehide);
  timer = setInterval(persistClock, 5000);
  timer.unref?.();
  return api;
}
