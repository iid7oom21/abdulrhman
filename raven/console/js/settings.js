import { getSettings, saveSettings, getKey } from './config.js';
export function mountSettings(onChange) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog"><h2>الإعدادات</h2>
  <label>مفتاح Gemini API (يُحفظ في متصفحك فقط)</label><input id="sKey" type="password" class="ltr" autocomplete="off">
  <label>مكان الحفظ</label><select id="sStore"><option value="local">دائم (localStorage)</option><option value="session">لهذه الجلسة فقط (sessionStorage)</option></select>
  <label>رابط البروكسي (اختياري — للإنتاج، يغني عن المفتاح)</label><input id="sProxy" class="ltr" placeholder="https://...">
  <div class="row"><div><label>المهلة (ms)</label><input id="sTimeout" type="number"></div><div><label>إعادة المحاولة</label><input id="sRetries" type="number" min="0" max="6"></div></div>
  <p class="meta">تنبيه: أي مفتاح يوضع في كود GitHub Pages يصير مكشوف للجميع. لا ترفعه في الريبو.</p>
  <div class="row"><button value="cancel">إلغاء</button><button class="primary" id="sSave" value="ok">حفظ</button></div></form>`;
  document.body.append(d);
  const $ = (id) => d.querySelector('#' + id);
  d.addEventListener('close', () => {
    if (d.returnValue !== 'ok') return;
    saveSettings({ apiKey: $('sKey').value.trim(), storage: $('sStore').value, proxyBase: $('sProxy').value.trim(),
      timeoutMs: Number($('sTimeout').value) || 60000, maxRetries: Math.max(0, Number($('sRetries').value) || 0) });
    onChange?.();
  });
  return () => { const s = getSettings(); $('sStore').value = s.storage; saveSettings({ storage: s.storage });
    $('sKey').value = getKey(); $('sProxy').value = s.proxyBase; $('sTimeout').value = s.timeoutMs; $('sRetries').value = s.maxRetries; d.showModal(); };
}
