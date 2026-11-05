import { LS } from './config.js';
export async function loadPrompts() {
  const saved = LS.get('prompts', null);
  if (saved) return saved;
  try { const r = await fetch('./prompts.json'); const j = await r.json(); return j.prompts || []; }
  catch { return []; }
}
export const savePrompts = (p) => LS.set('prompts', p);
export function exportJSON(obj, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
