import { el } from './core.js?v=bd8a32b4db729ff9';
import { loadMediaManifest, mediaURL } from './expansion-media.js?v=bd8a32b4db729ff9';

export const CALL_TRANSCRIPT = Object.freeze([
  { speaker: 'إلياس', text: 'أدريان… عندي طلب مخرج الأرشيف. المزلاج يعلق إذا حاولنا نفتحه من الداخل. يحتاج استبدال.' },
  { speaker: 'أدريان', text: 'الاستبدال يتأجل لدورة الميزانية الجاية.' },
  { speaker: 'إلياس', text: 'وبالنسبة لقفل قفص المعدات، الإجراء يسمح بإزالته. لوسيان مكلّف يشيله ويسلّم قطعه.' },
  { speaker: 'أدريان', text: 'تقصد قفص المعدات الخارجي؟' },
  { speaker: 'إلياس', text: 'نعم. هذا الإجراء يخص قفص المعدات… ما يخص باب المخرج.' },
]);
const deliveries = new Set(['unseen', 'pending', 'deferred', 'read', 'listened']);
const seconds = value => Number.isFinite(Number(value)) ? Math.min(3600, Math.max(0, Number(value))) : 0;
const timestamp = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
export function normalizeCall(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { delivery: deliveries.has(input.delivery) ? input.delivery : 'unseen', position: seconds(input.position), eligibleAt: timestamp(input.eligibleAt), readAt: timestamp(input.readAt), listenedAt: timestamp(input.listenedAt) };
}
const formatTime = value => { const rounded = Math.floor(seconds(value)); return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`; };
const button = (text, action, attrs = {}) => el('button', { type: 'button', class: 'case-button', text, onClick: action, ...attrs });

/** Optional dramatized scene. This widget never completes a deduction or a required activity. */
export function mountIncomingCall(root, services) {
  const lifetime = new AbortController();
  const token = `ma22-call-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  const titleId = `${token}-title`;
  let destroyed = false;
  let refreshTimer = null;
  let playingRequest = 0;
  let requested = false;
  let held = false;
  let previousFocus;
  let actualSource = null;
  let sourceResolved = false;
  let sourceLoading = false;
  let lastPersistedSecond = -1;
  const callState = () => normalizeCall(services.caseStore.get().call);
  function eligible() {
    const state = services.caseStore.get();
    const solved = services.investigation?.getSnapshot?.().solvedIds || state.solvedIds || [];
    return solved.includes('Q02') && (state.viewedIds || []).includes('E03') && (services.investigation?.getAccess?.('E03').allowed ?? true);
  }
  function write(patch) {
    if (destroyed || !eligible()) return;
    services.caseStore.update(state => { state.call = normalizeCall({ ...normalizeCall(state.call), ...patch }); });
  }
  function release() { if (held) services.audio?.release?.(token); held = false; }
  const bannerTitle = el('h3', { text: 'اتصال من ملف الصيانة' });
  const bannerCopy = el('p', { text: 'إلياس وأدريان · مشهد اختياري مستند إلى طلب MA-22.' });
  const bannerStatus = el('p', { class: 'call-availability', text: '' });
  const openButton = button('الرد وفتح المشهد', openCall, { 'data-call-open': '' });
  const laterButton = button('لاحقًا', () => {
    write({ delivery: 'deferred' });
    services.notify?.('حُفظ المشهد؛ يمكنك الرجوع إليه هنا متى شئت.');
    refresh();
  }, { 'data-call-defer': '' });
  const banner = el('section', { class: 'incoming-call', hidden: true, 'aria-label': 'مشهد اتصال اختياري', 'data-incoming-call': '' }, [
    el('div', { class: 'call-card-copy' }, [el('span', { class: 'call-kicker', text: 'MA—22 / المشهد المحفوظ', dir: 'auto' }), bannerTitle, bannerCopy, bannerStatus]),
    el('div', { class: 'call-card-actions' }, [openButton, laterButton]),
  ]);
  const title = el('h2', { id: titleId, tabindex: '-1', text: 'طلب الصيانة · إلياس وأدريان' });
  const status = el('p', { class: 'call-status', role: 'status', 'aria-live': 'polite', text: 'النص متاح للقراءة. التسجيل الصوتي لم يُضف بعد.' });
  const audio = el('audio', { preload: 'none', 'data-call-audio': '' });
  const playButton = button('شغّل التسجيل', playOrPause, { 'data-call-play': '', 'data-media-start': '', hidden: true });
  const restartButton = button('من البداية', () => { stopPlayback(); audio.currentTime = 0; write({ position: 0 }); updatePlayer(); }, { 'data-call-restart': '', hidden: true });
  const elapsed = el('output', { class: 'call-time', dir: 'ltr', 'aria-label': 'موضع تشغيل التسجيل', hidden: true });
  const transcript = el('ol', { class: 'call-transcript', 'aria-label': 'نص المشهد', 'data-call-transcript': '' }, CALL_TRANSCRIPT.map(line => el('li', {}, [el('strong', { text: line.speaker }), el('p', { text: line.text })])));
  const dialog = el('dialog', { class: 'incoming-call-dialog', dir: 'rtl', 'aria-labelledby': titleId, 'data-call-dialog': '' }, [
    el('header', { class: 'call-dialog-head' }, [title, button('إغلاق', () => dialog.close(), { 'aria-label': 'إغلاق مشهد الاتصال' })]),
    el('div', { class: 'call-dialog-body' }, [
      el('p', { class: 'call-source-note', text: 'مشهد تمثيلي مستند إلى MA-22. ليس تسجيلًا أصليًا مكتشفًا، ولا يضيف دليلًا مستقلًا إلى القضية.' }),
      status,
      el('div', { class: 'call-player' }, [playButton, restartButton, elapsed]),
      audio,
      el('h3', { text: 'النص المكتوب' }), transcript,
      el('p', { class: 'call-limits', text: 'المكالمة اختيارية. فتح النص لا يعني الاستماع إلى تسجيل، ولا يغيّر تقدم التحقيق.' }),
      button('عودة إلى التحقيق', () => dialog.close()),
    ]),
  ]);
  root.append(banner, dialog);

  function idle() {
    if (document.hidden || !root.isConnected) return false;
    if ([...document.querySelectorAll('dialog[open]')].some(item => item !== dialog)) return false;
    return ![...document.querySelectorAll('video, audio')].some(item => item !== audio && item.id !== 'preview-soundtrack' && !item.hasAttribute('data-ambient-video') && !item.paused && !item.ended);
  }
  function queueRefresh() {
    if (destroyed || refreshTimer !== null) return;
    refreshTimer = setTimeout(() => { refreshTimer = null; refresh(); }, 0);
  }
  function refresh() {
    if (destroyed) return;
    if (!eligible()) {
      banner.hidden = true;
      stopPlayback(false);
      if (dialog.open) dialog.close();
      audio.currentTime = 0;
      lastPersistedSecond = -1;
      return;
    }
    let state = callState();
    if (state.delivery === 'unseen') {
      if (!idle()) { banner.hidden = true; return; }
      write({ delivery: 'pending', eligibleAt: Date.now() });
      state = callState();
      services.notify?.('وصل مشهد اتصال اختياري من ملف الصيانة. يمكنك فتحه أو تأجيله.');
    }
    banner.hidden = false;
    banner.dataset.delivery = state.delivery;
    bannerTitle.textContent = state.delivery === 'pending' ? 'اتصال من ملف الصيانة' : 'مشهد الصيانة محفوظ';
    openButton.textContent = state.delivery === 'pending' ? 'الرد وفتح المشهد' : 'افتح المشهد المحفوظ';
    laterButton.hidden = state.delivery !== 'pending';
    bannerStatus.textContent = state.delivery === 'listened' ? 'استمعت إلى التسجيل · النص وإعادة الاستماع متاحان.'
      : state.delivery === 'read' ? 'فُتح النص · المشهد متاح للرجوع إليه.'
      : state.delivery === 'deferred' ? 'مؤجّل بطلبك · لن يظهر تنبيه جديد.'
      : 'يمكنك المتابعة دون فتحه؛ ليس شرطًا لحل القضية.';
  }
  function persistPosition() {
    if (Number.isFinite(audio.currentTime) && eligible()) write({ position: seconds(audio.currentTime) });
  }
  function stopPlayback(persist = true) {
    playingRequest += 1; requested = false;
    audio.pause(); release();
    if (persist) persistPosition();
    updatePlayer();
  }
  function updatePlayer() {
    const playing = !audio.paused && !audio.ended;
    playButton.textContent = playing || requested ? 'أوقف التسجيل' : audio.ended ? 'أعد الاستماع' : callState().position > 0 ? 'واصل الاستماع' : 'شغّل التسجيل';
    playButton.setAttribute('aria-pressed', String(playing || requested));
    elapsed.textContent = `${formatTime(audio.currentTime)} / ${Number.isFinite(audio.duration) ? formatTime(audio.duration) : '—:—'}`;
  }
  async function resolveSource() {
    if (sourceResolved || sourceLoading) return;
    sourceLoading = true;
    const manifest = services.expansionMedia || await loadMediaManifest();
    if (destroyed) return;
    sourceLoading = false; sourceResolved = true;
    actualSource = mediaURL(manifest.call);
    playButton.hidden = restartButton.hidden = elapsed.hidden = !actualSource;
    status.textContent = actualSource ? 'التسجيل متاح عند التشغيل، والنص مكتوب أدناه.' : 'وضع القراءة: التسجيل الصوتي لم يُضف بعد. النص الكامل متاح أدناه.';
  }
  function openCall() {
    if (!eligible() || destroyed) return;
    previousFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    title.focus();
    const state = callState();
    if (state.delivery !== 'listened') write({ delivery: 'read', readAt: state.readAt || Date.now() });
    void resolveSource();
  }
  async function playOrPause() {
    if (!actualSource || destroyed || !dialog.open || !eligible()) return;
    if (!audio.paused || requested) { stopPlayback(); status.textContent = 'توقف التسجيل؛ موضعك محفوظ.'; return; }
    const attempt = ++playingRequest;
    requested = true; held = true;
    services.audio?.hold?.(token);
    if (audio.ended || callState().delivery === 'listened') { audio.currentTime = 0; write({ position: 0 }); }
    if (audio.getAttribute('src') !== actualSource) audio.src = actualSource;
    else if (audio.error) audio.load();
    updatePlayer();
    status.textContent = 'جارٍ تحميل التسجيل…';
    try {
      await audio.play();
      if (destroyed || attempt !== playingRequest || !dialog.open || !eligible()) {
        if (attempt === playingRequest || destroyed || !dialog.open || !eligible()) { audio.pause(); release(); }
        return;
      }
      requested = false;
      status.textContent = 'التسجيل يعمل. يمكنك إيقافه أو متابعة النص.';
      updatePlayer();
    } catch (error) {
      if (destroyed || attempt !== playingRequest) return;
      requested = false; release(); updatePlayer();
      status.textContent = error?.name === 'NotAllowedError' ? 'لم يسمح المتصفح بالتشغيل. اضغط تشغيل مجددًا، أو اقرأ النص.' : 'تعذّر تشغيل التسجيل. يمكنك إعادة المحاولة أو قراءة النص كاملًا.';
    }
  }
  const events = { signal: lifetime.signal };
  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(callState().position, Math.max(0, audio.duration - .05));
    updatePlayer();
  }, events);
  audio.addEventListener('timeupdate', () => {
    updatePlayer();
    const position = Math.floor(audio.currentTime);
    if (!audio.paused && position >= 0 && Math.abs(position - lastPersistedSecond) >= 2) { lastPersistedSecond = position; persistPosition(); }
  }, events);
  audio.addEventListener('pause', () => { requested = false; release(); updatePlayer(); }, events);
  audio.addEventListener('ended', () => {
    requested = false; release();
    write({ delivery: 'listened', listenedAt: Date.now(), position: seconds(audio.duration) });
    status.textContent = 'انتهى التسجيل. يمكنك إعادة الاستماع أو العودة إلى التحقيق.'; updatePlayer();
  }, events);
  audio.addEventListener('error', () => {
    playingRequest += 1; requested = false; release();
    status.textContent = 'التسجيل غير متاح الآن. النص المكتوب متاح ولا يمنعك من متابعة التحقيق.'; updatePlayer();
  }, events);
  dialog.addEventListener('close', () => {
    stopPlayback();
    if (!destroyed && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    queueRefresh();
  }, events);
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }, events);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlayback(); queueRefresh(); }, events);
  for (const event of ['pause', 'ended', 'error']) document.addEventListener(event, queueRefresh, { capture: true, signal: lifetime.signal });
  const observer = new MutationObserver(records => {
    if (records.some(record => record.type === 'attributes' || [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && (node.matches?.('dialog') || node.querySelector?.('dialog'))))) queueRefresh();
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
  const unsubscribe = services.caseStore.subscribe?.(queueRefresh);
  queueRefresh();
  return () => {
    if (destroyed) return;
    persistPosition(); destroyed = true; clearTimeout(refreshTimer); observer.disconnect(); unsubscribe?.(); lifetime.abort();
    stopPlayback(false);
    if (dialog.open) dialog.close();
    audio.removeAttribute('src'); audio.load(); banner.remove(); dialog.remove();
  };
}
