import { CASE_DATA } from '../../../fourth-signature/case-data.js';

export const BASE = new URL('../', import.meta.url);
export const CASE_BASE = new URL('../../../fourth-signature/', import.meta.url);
export const caseAsset = path => new URL(path, CASE_BASE).href;
export const routeURL = path => new URL(String(path).replace(/^\//, ''), BASE).href;
export const CASE = {
  ...CASE_DATA,
  people: CASE_DATA.people.map(person => ({ ...person, image: caseAsset(person.image) })),
  evidence: CASE_DATA.evidence.map(item => ({ ...item, image: caseAsset(item.image), body: [...item.body] })),
};

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

export function emptyCase() {
  return { version: 1, viewedIds: [], solvedIds: [], answers: {}, supportByQuestion: {}, activeIndex: 0,
    notes: [], highlights: [], pins: [], links: [], timeline: [], hypotheses: [], training: {} };
}

function normalizeCase(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = { ...emptyCase(), ...input };
  const evidenceIds = new Set(CASE.evidence.map(e => e.id));
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

export function importLegacy(store) {
  if (store.get('initialized', false)) return;
  function legacy(key, area = 'local') {
    try { return (area === 'session' ? sessionStorage : localStorage).getItem(key); } catch { return null; }
  }
  let oldCase;
  try { oldCase = JSON.parse(legacy('raven-case:fourth-signature-reconstruction')); } catch { /* no valid source */ }
  if (store.get('case', null) === null) store.set('case', normalizeCase(oldCase));
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
  let state = normalizeCase(store.get('case', emptyCase()));
  const listeners = new Set();
  return {
    get: () => structuredClone(state),
    update(mutator) {
      const draft = structuredClone(state);
      const returned = mutator(draft);
      state = normalizeCase(returned && typeof returned === 'object' ? returned : draft);
      store.set('case', state);
      for (const listener of listeners) listener(structuredClone(state));
      return structuredClone(state);
    },
    reset() {
      state = emptyCase(); store.set('case', state);
      for (const listener of listeners) listener(structuredClone(state));
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
