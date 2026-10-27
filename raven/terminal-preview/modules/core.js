import { CASE_DATA } from '../../../fourth-signature/case-data.js?v=0e63bd470374096b';
import { EXPANSION_EVIDENCE, REVISION } from './expansion-data.js?v=0e63bd470374096b';
import { emptyProgress, normalizeProgress, availableEvidenceIds, solvedQuestionIds } from './investigation.js?v=0e63bd470374096b';

export const BASE = new URL('../', import.meta.url);
export const CASE_BASE = new URL('../../../fourth-signature/', import.meta.url);
export const caseAsset = path => new URL(path, CASE_BASE).href;
export const routeURL = path => new URL(String(path).replace(/^\//, ''), BASE).href;
export const CASE = {
  ...CASE_DATA,
  people: CASE_DATA.people.map(person => ({ ...person, image: caseAsset(person.image) })),
  evidence: [
    ...CASE_DATA.evidence.map(item => ({ ...item, image: caseAsset(item.image), body: [...item.body] })),
    ...EXPANSION_EVIDENCE.map(item => ({ ...item, image: item.image ? caseAsset(item.image) : null, body: [...item.body] })),
  ],
};
export const EXPANSION_KEY = 'case-017:expansion-v3';

export function el(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') element.className = value;
    else if (key === 'text') element.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) element.setAttribute(key, '');
    else element.setAttribute(key, String(value));
  }
  for (const child of [children].flat(Infinity)) {
    if (child !== null && child !== undefined && child !== false) element.append(child instanceof Node ? child : String(child));
  }
  return element;
}

export function createStore(onFailure = () => {}) {
  const prefix = 'raven-preview:v1:';
  const memory = new Map();
  let reported = false;
  function failed() { if (!reported) { reported = true; onFailure(); } }
  return {
    get(key, fallback = null) {
      if (memory.has(key)) return structuredClone(memory.get(key));
      try {
        const raw = localStorage.getItem(prefix + key);
        if (raw !== null) { const value = JSON.parse(raw); memory.set(key, value); return structuredClone(value); }
      } catch { failed(); }
      return structuredClone(fallback);
    },
    set(key, value) {
      memory.set(key, structuredClone(value));
      try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch { failed(); }
    },
    prefix,
  };
}

function emptyLegacyCase() {
  return { version: 1, viewedIds: [], solvedIds: [], answers: {}, supportByQuestion: {}, activeIndex: 0,
    notes: [], highlights: [], pins: [], links: [], timeline: [], hypotheses: [], training: {} };
}

function normalizeLegacyCase(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = { ...emptyLegacyCase(), ...input };
  const evidenceIds = new Set(CASE_DATA.evidence.map(e => e.id));
  result.viewedIds = [...new Set((Array.isArray(input.viewedIds) ? input.viewedIds : []).filter(id => evidenceIds.has(id)))];
  result.solvedIds = [];
  for (const q of CASE.questions) {
    if (!Array.isArray(input.solvedIds) || !input.solvedIds.includes(q.id)) break;
    result.solvedIds.push(q.id);
  }
  for (const key of ['notes', 'highlights', 'pins', 'links', 'timeline', 'hypotheses']) {
    result[key] = Array.isArray(input[key]) ? input[key].filter(item => item && typeof item === 'object').slice(0, 500) : [];
  }
  for (const key of ['answers', 'supportByQuestion', 'training']) {
    result[key] = input[key] && typeof input[key] === 'object' && !Array.isArray(input[key]) ? input[key] : {};
  }
  result.answers = Object.fromEntries(CASE.questions.filter(q => q.options.some(option => option.id === result.answers[q.id])).map(q => [q.id, result.answers[q.id]]));
  result.supportByQuestion = Object.fromEntries(CASE.questions.map(q => [q.id,
    [...new Set((Array.isArray(result.supportByQuestion[q.id]) ? result.supportByQuestion[q.id] : []).filter(id => evidenceIds.has(id)))].slice(0, q.id === 'Q04' ? 3 : 2),
  ]));
  result.activeIndex = Math.max(0, Math.min(3, Number(result.activeIndex) || 0));
  return result;
}

const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const textValue = (value, max = 4000) => typeof value === 'string' ? value.slice(0, max) : '';
const entries = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)).slice(0, 500) : [];
function boundedJSON(value, depth = 0) {
  if (depth > 5) return null;
  if (typeof value === 'string') return value.slice(0, 4000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => boundedJSON(item, depth + 1));
  return Object.fromEntries(Object.entries(record(value)).filter(([key]) => !['__proto__', 'constructor', 'prototype'].includes(key)).slice(0, 80).map(([key, item]) => [key.slice(0, 100), boundedJSON(item, depth + 1)]));
}

export function emptyCase() {
  return { ...emptyLegacyCase(), version: 3, revision: REVISION, progress: emptyProgress(), drafts: {}, photoRegions: [], call: {}, ending: emptyEnding() };
}

const emptyEnding = () => ({ version: 1, presentedAt: 0, completedAt: 0, skippedAt: 0, runKey: '' });
export const caseCompletionKey = progress => progress.runId || `practice:${progress.startedAt || 0}:${progress.completedAt || 0}`;

/** A revision-specific workspace; legacy completion never unlocks expanded stages. */
export function normalizeCase(value) {
  const input = record(value);
  const result = emptyCase();
  result.progress = normalizeProgress(input.progress);
  result.solvedIds = solvedQuestionIds(result.progress);
  const allowed = new Set(availableEvidenceIds(result.progress));
  const ids = new Set(CASE.evidence.map(item => item.id));
  result.viewedIds = [...new Set((Array.isArray(input.viewedIds) ? input.viewedIds : []).filter(id => ids.has(id) && allowed.has(id)))];
  const seen = new Set(result.viewedIds);
  const source = item => ({ evidenceId: item.evidenceId, paragraphIndex: Number.isInteger(item.paragraphIndex) && item.paragraphIndex >= 0 ? item.paragraphIndex : null, quote: textValue(item.quote) });
  const hasSource = item => ids.has(item.evidenceId) && seen.has(item.evidenceId);
  result.notes = entries(input.notes).filter(item => hasSource(item) && typeof item.text === 'string'
    && (!item.questionId || (entries(item.answerSources).length > 0 && entries(item.answerSources).every(hasSource)))).map(item => ({
    ...source(item), id: textValue(item.id, 120), type: ['ملاحظة', 'فرضية', 'سؤال'].includes(item.type) ? item.type : 'ملاحظة', text: textValue(item.text),
    createdAt: Number(item.createdAt) || 0, questionId: textValue(item.questionId, 120),
    answerSources: entries(item.answerSources).filter(hasSource).map(source),
  }));
  result.highlights = entries(input.highlights).filter(hasSource).map(source);
  result.pins = entries(input.pins).filter(hasSource).map(item => ({ id: item.evidenceId, evidenceId: item.evidenceId, x: Math.min(1, Math.max(0, Number(item.x) || 0)), y: Math.min(1, Math.max(0, Number(item.y) || 0)), autoLayout: item.autoLayout !== false }));
  result.links = entries(input.links).filter(item => seen.has(item.fromId) && seen.has(item.toId) && item.fromId !== item.toId).map(item => ({ id: textValue(item.id, 120), fromId: item.fromId, toId: item.toId, relation: textValue(item.relation, 80), reason: textValue(item.reason, 500) }));
  result.timeline = entries(input.timeline).filter(item => hasSource(item) && ['before', 'after', 'reopened', 'unknown'].includes(item.bucket)).map(item => ({ ...source(item), id: textValue(item.id, 120), bucket: item.bucket, text: textValue(item.text, 200) }));
  result.hypotheses = entries(input.hypotheses).filter(item => typeof item.text === 'string').map(item => ({ id: textValue(item.id, 120), text: textValue(item.text, 1600), sources: entries(item.sources).filter(hasSource).map(item => ({ evidenceId: item.evidenceId, stance: textValue(item.stance, 80), reason: textValue(item.reason, 400) })) }));
  result.photoRegions = entries(input.photoRegions).filter(item => hasSource(item) && ['lock', 'crop-edge', 'ext02'].includes(item.id)).map(item => ({ id: item.id, evidenceId: item.evidenceId, at: Number(item.at) || 0 }));
  result.training = boundedJSON(record(input.training));
  result.drafts = Object.fromEntries(Object.entries(record(input.drafts)).filter(([key]) => /^A(0[1-9]|[12]\d|3[0-2])$/.test(key)).map(([key, draft]) => [key, boundedJSON(draft)]));
  result.call = boundedJSON(record(input.call));
  const ending = record(input.ending);
  if (result.progress.accepted.length === 32 && ending.version === 1 && ending.runKey === caseCompletionKey(result.progress)) {
    result.ending.runKey = ending.runKey;
    for (const key of ['presentedAt', 'completedAt', 'skippedAt']) {
      result.ending[key] = Number.isFinite(ending[key]) && ending[key] > 0 ? ending[key] : 0;
    }
  }
  result.activeIndex = Math.min(3, result.solvedIds.length);
  result.answers = Object.fromEntries(CASE.questions.filter(q => q.options.some(o => o.id === record(input.answers)[q.id])).map(q => [q.id, input.answers[q.id]]));
  result.supportByQuestion = Object.fromEntries(CASE.questions.map(q => [q.id, [...new Set((Array.isArray(record(input.supportByQuestion)[q.id]) ? input.supportByQuestion[q.id] : []).filter(id => seen.has(id)))].slice(0, q.id === 'Q04' ? 3 : 2)]));
  return result;
}

export function importLegacy(store) {
  if (store.get('initialized', false)) return;
  function legacy(key, area = 'local') {
    try { return (area === 'session' ? sessionStorage : localStorage).getItem(key); } catch { return null; }
  }
  let oldCase;
  try { oldCase = JSON.parse(legacy('raven-case:fourth-signature-reconstruction')); } catch { /* no valid source */ }
  if (store.get('case', null) === null) store.set('case', normalizeLegacyCase(oldCase));
  if (store.get('language', null) === null) store.set('language', legacy('raven_language') === 'en' ? 'en' : 'ar');
  const oldVolume = Number(legacy('raven_music_volume_v1'));
  if (legacy('raven_music_volume_v1') !== null && Number.isFinite(oldVolume)) store.set('musicVolume', Math.min(1, Math.max(0, oldVolume)));
  const enabled = legacy('raven_music_enabled_v2', 'session');
  if (['false', '0', 'off'].includes(enabled)) store.set('musicEnabled', false);
  for (let id = 1; id <= 3; id++) {
    if (store.get('episode:' + id, null) !== null) continue;
    const time = Number(legacy(`raven17_episode_${id}_progress`));
    store.set('episode:' + id, { time: Number.isFinite(time) && time > 0 ? time : 0, watched: false });
  }
  store.set('initialized', true);
}

export function createCaseStore(store) {
  let state = normalizeCase(store.get(EXPANSION_KEY, emptyCase()));
  store.set(EXPANSION_KEY, state);
  const listeners = new Set();
  return {
    get: () => structuredClone(state),
    update(mutator) {
      const draft = structuredClone(state);
      const returned = mutator(draft);
      state = normalizeCase(returned && typeof returned === 'object' ? returned : draft);
      store.set(EXPANSION_KEY, state);
      for (const listener of listeners) listener(structuredClone(state));
      return structuredClone(state);
    },
    reset() {
      state = emptyCase(); store.set(EXPANSION_KEY, state);
      for (const listener of listeners) listener(structuredClone(state));
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
