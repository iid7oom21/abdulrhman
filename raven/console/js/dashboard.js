import { getSettings, getKey, LS } from './config.js';
import { loadPrompts, savePrompts, exportJSON, esc } from './prompts.js';
import { mountSettings } from './settings.js';
const $ = (id) => document.getElementById(id);

function status() {
  const s = getSettings(), k = getKey();
  $('keyBadge').textContent = '';
  $('kStat').innerHTML = s.proxyBase ? '<span class="ok">بروكسي</span>' : k ? '<span class="ok">موجود</span>' : '<span class="bad">غير موجود</span>';
  $('kMode').textContent = s.proxyBase ? s.proxyBase : k ? `محفوظ في ${s.storage === 'session' ? 'الجلسة' : 'المتصفح'} · ••••${k.slice(-4)}` : 'أدخله من الإعدادات';
  const log = LS.get('calls', []), l = log[log.length - 1];
  $('lastStat').innerHTML = !l ? '—' : l.ok ? '<span class="ok">نجح</span>' : `<span class="bad">فشل (${esc(l.code)})</span>`;
  $('lastMeta').textContent = l ? `${new Date(l.at).toLocaleString('ar-SA')} · ${l.model} · ${l.latencyMs}ms` : '';
  const ok = log.filter(x => x.ok);
  $('count').textContent = log.length; $('avg').textContent = `نجاح ${ok.length} · متوسط ${ok.length ? Math.round(ok.reduce((a, b) => a + b.latencyMs, 0) / ok.length) : 0}ms`;
  $('errLog').innerHTML = log.filter(x => !x.ok).reverse().map(x => `<li><span class="meta">${new Date(x.at).toLocaleString('ar-SA')}</span> — <b class="bad">${esc(x.code)}</b> ${esc(x.msg)}</li>`).join('') || '<li class="meta">لا توجد أخطاء</li>';
  chart(log.slice(-40));
}
function chart(d) {
  const W = 800, H = 200, P = 24, svg = $('chart');
  if (!d.length) { svg.innerHTML = `<text x="400" y="100" fill="#8b8f98" text-anchor="middle">No data</text>`; return; }
  const mL = Math.max(...d.map(x => x.latencyMs), 1), mT = Math.max(...d.map(x => x.tokens || 0), 1);
  const x = (i) => P + (i * (W - 2 * P)) / Math.max(d.length - 1, 1);
  const line = (f, m) => d.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${(H - P - (f(v) / m) * (H - 2 * P)).toFixed(1)}`).join('');
  svg.innerHTML = `<line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" stroke="#1f232b"/>
  <path d="${line(v => v.latencyMs, mL)}" fill="none" stroke="#c9a45c" stroke-width="2"/>
  <path d="${line(v => v.tokens || 0, mT)}" fill="none" stroke="#6c8cff" stroke-width="1.5" stroke-dasharray="4 3"/>
  ${d.map((v, i) => v.ok ? '' : `<circle cx="${x(i)}" cy="${H - P}" r="4" fill="#e0605a"/>`).join('')}
  <text x="${P}" y="14" fill="#8b8f98" font-size="11">max ${mL}ms / ${mT} tok</text>`;
}
$('clearLog').onclick = () => { LS.set('calls', []); status(); };
$('openSettings').onclick = mountSettings(status); status();

let prompts = await loadPrompts(), cur = -1;
const f = $('pForm');
function list() { $('pList').innerHTML = prompts.map((p, i) => `<li data-i="${i}" ${i === cur ? 'style="color:var(--accent)"' : ''}>${esc(p.title)}<div class="meta ltr">${esc(p.id)}</div></li>`).join(''); $('pList').querySelectorAll('li').forEach(li => li.onclick = () => edit(+li.dataset.i)); }
function edit(i) {
  cur = i; const p = prompts[i] || { params: {} }; const pr = p.params || {};
  for (const [k, v] of Object.entries({ id: p.id, title: p.title, systemInstruction: p.systemInstruction, userTemplate: p.userTemplate, model: p.model, temperature: pr.temperature, topP: pr.topP, topK: pr.topK, maxOutputTokens: pr.maxOutputTokens, tags: (p.tags || []).join(', ') })) f.elements[k].value = v ?? '';
  $('pMsg').textContent = ''; list();
}
const num = (v) => v === '' ? undefined : Number(v);
f.onsubmit = (e) => {
  e.preventDefault(); const g = (k) => f.elements[k].value;
  const p = { id: g('id').trim(), title: g('title').trim(), systemInstruction: g('systemInstruction'), userTemplate: g('userTemplate'), model: g('model').trim() || getSettings().model,
    params: { temperature: num(g('temperature')), topP: num(g('topP')), topK: num(g('topK')), maxOutputTokens: num(g('maxOutputTokens')) }, tags: g('tags').split(',').map(s => s.trim()).filter(Boolean) };
  const dup = prompts.findIndex((x, i) => x.id === p.id && i !== cur);
  if (dup >= 0) { $('pMsg').innerHTML = '<span class="bad">المعرف مستخدم.</span>'; return; }
  if (cur >= 0 && prompts[cur]) prompts[cur] = { ...prompts[cur], ...p }; else { prompts.push(p); cur = prompts.length - 1; }
  savePrompts(prompts); list(); $('pMsg').innerHTML = '<span class="ok">تم الحفظ.</span>';
};
$('pNew').onclick = () => { cur = -1; f.reset(); list(); };
$('pDel').onclick = () => { if (cur < 0 || !confirm('حذف البرومبت؟')) return; prompts.splice(cur, 1); savePrompts(prompts); cur = -1; f.reset(); list(); };
$('pExport').onclick = () => exportJSON({ version: 1, prompts }, 'prompts.json');
$('pReset').onclick = async () => { if (!confirm('استرجاع البرومبتات الأصلية؟ تضيع تعديلاتك.')) return; localStorage.removeItem('raven.ai.prompts'); prompts = await loadPrompts(); cur = -1; list(); };
$('pImport').onchange = async (e) => {
  try {
    const j = JSON.parse(await e.target.files[0].text()); const arr = Array.isArray(j) ? j : j.prompts;
    if (!Array.isArray(arr) || !arr.every(p => p.id && p.title)) throw new Error();
    const byId = new Map(prompts.map(p => [p.id, p])); arr.forEach(p => byId.set(p.id, p)); prompts = [...byId.values()];
    savePrompts(prompts); list(); $('pMsg').innerHTML = `<span class="ok">تم استيراد ${arr.length}.</span>`;
  } catch { $('pMsg').innerHTML = '<span class="bad">ملف JSON غير صالح (لازم كل برومبت فيه id و title).</span>'; }
  e.target.value = '';
};
list();
