// إعدادات البيئة — لا يوجد أي مفتاح داخل الكود. المفتاح يُدخل من الإعدادات ويُخزن في المتصفح فقط.
const K = 'raven.ai.';
export const DEFAULTS = {
  apiBase: 'https://generativelanguage.googleapis.com/v1beta',
  proxyBase: '',            // مثال: https://your-proxy.example.com  (عند تعبئته لا يُرسل المفتاح من المتصفح)
  model: 'gemini-2.5-flash',
  timeoutMs: 60000,
  maxRetries: 3,
};
const store = () => (localStorage.getItem(K + 'storage') === 'session' ? sessionStorage : localStorage);
export function getSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(K + 'settings') || '{}'); } catch {}
  return { ...DEFAULTS, ...s, storage: localStorage.getItem(K + 'storage') || 'local' };
}
export function saveSettings(s) {
  const { apiKey, storage, ...rest } = s;
  localStorage.setItem(K + 'settings', JSON.stringify(rest));
  if (storage) { localStorage.setItem(K + 'storage', storage); }
  if (apiKey !== undefined) setKey(apiKey);
}
export function getKey() { return store().getItem(K + 'key') || ''; }
export function setKey(v) {
  localStorage.removeItem(K + 'key'); sessionStorage.removeItem(K + 'key');
  if (v) store().setItem(K + 'key', v);
}
export const LS = {
  get(n, d) { try { return JSON.parse(localStorage.getItem(K + n)) ?? d; } catch { return d; } },
  set(n, v) { localStorage.setItem(K + n, JSON.stringify(v)); },
};
