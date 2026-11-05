import { getSettings, getKey, LS } from './config.js';
import { generate, arMsg } from './gemini.js';
import { loadPrompts, exportJSON, esc } from './prompts.js';
import { mountSettings } from './settings.js';

const $ = (id) => document.getElementById(id);
let prompts = [], ctl = null, last = null;
const badge = () => { const s = getSettings(); $('keyBadge').innerHTML = s.proxyBase ? '<span class="ok">● بروكسي</span>' : getKey() ? '<span class="ok">● المفتاح موجود</span>' : '<span class="bad">● لا يوجد مفتاح</span>'; };
$('openSettings').onclick = mountSettings(badge); badge();

function applyPrompt(p) {
  if (!p) return;
  $('model').value = p.model || getSettings().model; $('system').value = p.systemInstruction || '';
  $('query').value = p.userTemplate || '';
  const pr = p.params || {};
  $('temperature').value = pr.temperature ?? 1; $('topP').value = pr.topP ?? 0.95; $('topK').value = pr.topK ?? 40; $('maxOutputTokens').value = pr.maxOutputTokens ?? 1024; sync();
}
function sync() { $('tV').textContent = $('temperature').value; $('pV').textContent = $('topP').value; }
$('temperature').oninput = $('topP').oninput = sync;

function showError(e) {
  $('error').innerHTML = `<div class="err"><b>${esc(e.message || arMsg(e.code))}</b>${e.detail ? `<div class="meta ltr">${esc(e.detail)}</div>` : ''}</div>`;
  if (e.request) $('reqJson').textContent = JSON.stringify(e.request, null, 2);
}

async function send() {
  const text = $('query').value.trim();
  if (!text) return showError({ message: 'اكتب سؤال أول.' });
  $('error').innerHTML = ''; $('out').textContent = ''; $('stats').textContent = '…';
  $('send').disabled = true; $('stop').disabled = false; ctl = new AbortController();
  const params = { temperature: $('temperature').value, topP: $('topP').value, topK: $('topK').value, maxOutputTokens: $('maxOutputTokens').value };
  try {
    const r = await generate({ model: $('model').value.trim() || getSettings().model, system: $('system').value, text, params,
      stream: $('stream').checked, signal: ctl.signal, onChunk: (_, all) => { $('out').textContent = all; } });
    last = r;
    $('stats').textContent = `${r.latencyMs}ms · ${r.usage?.promptTokenCount ?? '?'}→${r.usage?.candidatesTokenCount ?? '?'} توكن · محاولات ${r.attempts}`;
    $('reqJson').textContent = JSON.stringify(r.request, null, 2); $('resJson').textContent = JSON.stringify(r.raw, null, 2);
    const h = LS.get('history', []); h.unshift({ at: Date.now(), model: r.request.body && $('model').value, q: text, a: r.text, system: $('system').value, params });
    LS.set('history', h.slice(0, 50)); renderHist();
  } catch (e) { $('stats').textContent = ''; showError(e); }
  finally { $('send').disabled = false; $('stop').disabled = true; }
}
$('send').onclick = send;
$('query').onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); };
$('stop').onclick = () => ctl?.abort();
$('copy').onclick = () => navigator.clipboard?.writeText($('out').textContent);
$('export').onclick = () => last ? exportJSON({ request: last.request, response: last.raw, text: last.text }, `raven-gemini-${Date.now()}.json`) : showError({ message: 'ما فيه رد للتصدير.' });

function renderHist() {
  const h = LS.get('history', []);
  $('history').innerHTML = h.map((x, i) => `<li data-i="${i}"><span class="meta">${new Date(x.at).toLocaleString('ar-SA')}</span> — ${esc(x.q.slice(0, 80))}</li>`).join('') || '<li class="meta">لا يوجد</li>';
  $('history').querySelectorAll('li[data-i]').forEach(li => li.onclick = () => { const x = h[li.dataset.i]; $('query').value = x.q; $('out').textContent = x.a; $('system').value = x.system || ''; });
}
$('clearHist').onclick = () => { LS.set('history', []); renderHist(); };

prompts = await loadPrompts();
$('promptPick').innerHTML = prompts.map((p, i) => `<option value="${i}">${esc(p.title)}</option>`).join('');
$('promptPick').onchange = () => applyPrompt(prompts[$('promptPick').value]);
applyPrompt(prompts[0] || { model: getSettings().model }); renderHist();
