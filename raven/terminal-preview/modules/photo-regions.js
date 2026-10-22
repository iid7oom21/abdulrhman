import { node as el } from '../../../fourth-signature/dom.js?v=6d062d5989d21c42';

// Coordinates belong to the unchanged 1672 × 941 PH-06 reconstruction.
// The preservation card, not newly inferred visual detail, is the source.
const REGIONS = [
  { id: 'lock', label: 'القفل المحمول', x: .28, y: .63, w: .13, h: .12, paragraphIndex: 0,
    note: 'تصف بطاقة PH-06 لوسيان ممسكًا بنصفي قفل. هوية الموقع تُراجع مع وصف الإطار الكامل وأوراق الصيانة.' },
  { id: 'crop-edge', label: 'حدود القص والسياق', x: .52, y: .14, w: .07, h: .69, paragraphIndex: 1,
    note: 'يتضمن وصف الإطار الكامل سياج قفص المعدات وبطاقة EXT-02. مخرج AR-01 خارج الإطار؛ الصورة وحدها لا تبيّن حالته.' },
  { id: 'ext02', label: 'بطاقة الموقع EXT-02', x: .72, y: .30, w: .20, h: .35, paragraphIndex: 1,
    note: 'ينص بند «الأصل الكامل» في PH-06 على بطاقة موقع تحمل EXT-02. هذا هو المصدر المكتوب لتحديد الموقع.' },
];

function accessible(services, id) {
  try { return !services.investigation || services.investigation.getAccess(id).allowed === true; }
  catch { return false; }
}

/** Adds explicit, source-bounded inspection. No discovery is recorded on focus. */
export function attachPhotoRegions(scanElement, services, evidenceId = 'E06') {
  const view = scanElement?.querySelector('.case-magnifier-view');
  if (!view || evidenceId !== 'E06' || scanElement.querySelector('[data-photo-regions]')) return () => {};
  const abort = new AbortController();
  const layer = el('div', { class: 'photo-regions-layer', role: 'group', 'aria-label': 'مناطق فحص الصورة', 'data-photo-regions': '' });
  const status = el('p', { class: 'photo-region-status', role: 'status', 'aria-live': 'polite', text: 'افحص تفصيلة، ثم ارجع إلى نص بطاقة الحفظ للتحقق.' });
  const source = el('button', { type: 'button', class: 'evidence-helper-button', text: 'اقرأ سند الملاحظة في PH-06', hidden: true });
  let selected = null;
  let disposed = false;
  const controls = el('section', { class: 'photo-region-controls', 'aria-label': 'فحص التفاصيل بالنص والأزرار' }, [
    el('p', { class: 'evidence-helper-label', text: 'تفاصيل للفحص · الصورة إعادة بناء من بطاقة الحفظ' }),
  ]);
  const choices = el('div', { class: 'photo-region-choices' });
  const buttons = new Map();

  function state() { return services.caseStore?.get?.() || {}; }
  function mayInspect() {
    const viewed = state().viewedIds;
    return accessible(services, evidenceId) && Array.isArray(viewed) && viewed.includes(evidenceId);
  }
  function fullFrame() {
    const inspector = scanElement.closest('.case-photo-inspector');
    const full = inspector?.querySelector('[data-photo-mode="full"]');
    if (full && full.getAttribute('aria-pressed') !== 'true') full.click();
    const lens = scanElement.querySelector('[data-magnifier-toggle]');
    if (lens?.getAttribute('aria-pressed') === 'true') lens.click();
  }
  function sync() {
    if (disposed) return;
    layer.hidden = !mayInspect() || view.classList.contains('is-cropped') || view.classList.contains('is-active') || !view.querySelector('img');
    const found = Array.isArray(state().photoRegions) ? state().photoRegions : [];
    for (const region of REGIONS) {
      const known = found.some(entry => entry?.id === region.id && entry.evidenceId === evidenceId);
      for (const button of buttons.get(region.id) || []) {
        button.classList.toggle('is-found', known);
        button.setAttribute('aria-pressed', String(known));
      }
    }
  }
  function inspect(region, fromText = false) {
    if (!mayInspect()) { services.notify?.('افتح بطاقة الصورة المتاحة أولًا.'); return; }
    if (fromText) fullFrame();
    if (!fromText && layer.hidden) return;
    selected = region;
    services.caseStore.update(draft => {
      if (!Array.isArray(draft.photoRegions)) draft.photoRegions = [];
      if (!draft.photoRegions.some(entry => entry?.id === region.id && entry.evidenceId === evidenceId)) {
        draft.photoRegions.push({ id: region.id, evidenceId, at: Date.now() });
      }
    });
    status.textContent = region.note;
    source.hidden = typeof services.openEvidence !== 'function';
    sync();
  }

  REGIONS.forEach((region, index) => {
    const spot = el('button', {
      type: 'button', class: 'photo-region', 'data-region': region.id,
      'aria-label': `افحص ${region.label}`, 'aria-pressed': 'false', title: region.label,
    }, el('span', { class: 'photo-region-number', 'aria-hidden': 'true', text: index + 1 }));
    Object.assign(spot.style, { left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` });
    const text = el('button', { type: 'button', class: 'evidence-helper-button photo-region-choice', 'data-region-choice': region.id, 'aria-pressed': 'false', text: region.label });
    spot.addEventListener('click', () => inspect(region), { signal: abort.signal });
    text.addEventListener('click', () => inspect(region, true), { signal: abort.signal });
    buttons.set(region.id, [spot, text]);
    layer.append(spot); choices.append(text);
  });
  source.addEventListener('click', () => {
    if (selected && mayInspect()) services.openEvidence?.(evidenceId, { paragraphIndex: selected.paragraphIndex });
  }, { signal: abort.signal });
  controls.append(choices, status, source);
  view.append(layer);
  // Controls are outside the image and survive image-load failure.
  scanElement.append(controls);
  const observer = new MutationObserver(sync);
  observer.observe(view, { attributes: true, attributeFilter: ['class'], childList: true });
  const unsubscribe = services.caseStore?.subscribe?.(sync);
  sync();
  return () => { disposed = true; abort.abort(); observer.disconnect(); unsubscribe?.(); layer.remove(); controls.remove(); };
}
