import { CASE, el, caseCompletionKey } from './core.js?v=0e63bd470374096b';
import { loadVerifiedMedia, mediaURL } from './expansion-media.js?v=0e63bd470374096b';

const manifestURL = new URL('../assets/case-ending.json', import.meta.url);
const DURATION = 14000;
const runKey = state => caseCompletionKey(state.progress || {});
const button = (text, action, attributes = {}) => el('button', { type: 'button', class: 'case-button', text, onClick: action, ...attributes });
const sourcePairs = [['E02', 'lucian', 'توقيع المسلّم'], ['E03', 'elias', 'الفني المسؤول عن الفحص والإجراء'], ['E04', 'elena', 'أعدّ الجرد'], ['E05', 'nora', 'توقيع المستلم']];
const captions = [
  'محضر واحد حمل أربعة توقيعات… لكنه جمعها تحت رواية لم توقّع عليها الأصول.',
  'التوقيعات الأربعة صحيحة. لكل توقيع ورقته وغرضه؛ نُقلت إلى محضر الاتهام.',
  'وفي مراجعة 2026: دخل الوجه B17-R قائمة المراجعة، ولم يدخل الحزمة المنشورة.',
  'انكشفت الرواية… وبقي الأثر.',
];

/** Optional presentation after the engine has accepted all 32 activities. */
export function createCaseEnding(root, services, { onReport = () => {} } = {}) {
  const lifetime = new AbortController();
  const token = `case-ending-${crypto.randomUUID()}`;
  let destroyed = false, openedRun = '', previousFocus, presentation = 0;
  let elapsed = 0, lastFrame = null, frame = null, done = false, scene = -1, mode = 'dom';
  let videoReady = false, videoRecord = null, objectURL = null, loadJob = null, resolvedManifest;
  let ducked = false, videoPlaying = false, playAttempt = 0, resumeVideo = false;
  const titleId = `${token}-title`, captionId = `${token}-caption`;
  const dialog = el('dialog', { class: 'case-ending', dir: 'rtl', 'aria-labelledby': titleId, 'aria-describedby': captionId, 'data-case-ending': '' });
  const title = el('h2', { id: titleId, class: 'ending-heading', tabindex: '-1', text: 'التوقيع الرابع · خاتمة الملف' });
  const stage = el('div', { class: 'ending-stage', 'data-ending-stage': '', 'data-scene': '0', 'aria-hidden': 'true' });
  const video = el('video', { class: 'ending-video', muted: true, playsinline: true, preload: 'none', hidden: true, 'data-ending-video': '', 'data-ending-managed': '' });
  video.muted = true; video.playsInline = true;
  const accusation = CASE.evidence.find(item => item.id === 'E01');
  const accusationPaper = el('div', { class: 'ending-accusation' }, [
    el('span', { class: 'ending-document-code', text: 'ADM-04', dir: 'ltr' }),
    el('strong', { text: accusation.title }),
    el('div', { class: 'ending-paper-lines' }),
    el('span', { class: 'ending-signature-line', text: sourcePairs.map(([, person]) => CASE.people.find(item => item.id === person).name).join(' · ') }),
  ]);
  const sourcePapers = el('div', { class: 'ending-sources' }, sourcePairs.map(([id, person, purpose], index) => {
    const item = CASE.evidence.find(evidence => evidence.id === id);
    return el('div', { class: 'ending-source-paper', style: `--paper-index:${index}`, 'data-ending-source': id }, [
      el('span', { class: 'ending-document-code', dir: 'ltr', text: item.reference.split(' · ')[0] }),
      el('strong', { text: item.title }), el('div', { class: 'ending-paper-lines' }),
      el('span', { class: 'ending-person', text: CASE.people.find(entry => entry.id === person).name }),
      el('small', { text: purpose }),
    ]);
  }));
  const reviewCard = el('div', { class: 'ending-review-card' }, [
    el('span', { class: 'ending-review-year', text: 'مراجعة 2026' }),
    el('strong', { dir: 'ltr', text: 'B17-R' }),
    el('p', { text: 'دخل المراجعة' }), el('span', { class: 'ending-review-limit', text: 'لم يدخل الحزمة المنشورة' }),
  ]);
  const closing = el('div', { class: 'ending-closing' }, [el('span', { text: 'RAVEN', class: 'ending-brand' }), el('strong', { text: 'انكشفت الرواية…' }), el('strong', { text: 'وبقي الأثر.', class: 'ending-gold' })]);
  const visual = el('div', { class: 'ending-dom', 'data-ending-dom': '' }, [accusationPaper, sourcePapers, reviewCard]);
  stage.append(video, visual, closing, el('div', { class: 'ending-vignette' }));
  const caption = el('p', { id: captionId, class: 'ending-caption', 'data-ending-caption': '', role: 'status', 'aria-live': 'polite' });
  const limit = el('p', { class: 'ending-limit', 'data-ending-limit': '', hidden: true, text: 'حدود الإثبات: منشأ الحريق غير محسوم. عدم نشر B17-R لا يثبت وحده تعمّد الإخفاء.' });
  const status = el('p', { class: 'ending-status', 'data-ending-status': '', text: 'خاتمة بصرية مبنية على وثائق القضية.' });
  const play = button('شغّل المشهد', () => { if (!video.paused) { stopVideo(); play.textContent = 'واصل المشهد'; } else void playVideo(); }, { 'data-ending-play': '', 'data-media-start': '', hidden: true });
  const sound = button('تشغيل صوت المشهد', () => { video.muted = !video.muted; updateSound(); if (!video.muted && video.paused) void playVideo(); }, { 'data-ending-sound': '', 'data-media-start': '', hidden: true, 'aria-pressed': 'false' });
  const skip = button('تجاوز إلى الخلاصة', () => finish('skip'), { 'data-ending-skip': '' });
  const closeButton = button('إغلاق', close, { 'data-ending-close': '', 'aria-label': 'إغلاق خاتمة الملف' });
  const report = button('اقرأ التقرير النهائي', () => { if (!eligible()) return; close(); onReport(); }, { 'data-ending-report': '', class: 'case-button case-primary' });
  const replay = button('أعد المشهد', () => begin(), { 'data-ending-replay': '', 'data-media-start': '' });
  const finalActions = el('div', { class: 'ending-final-actions', hidden: true }, [report, replay]);
  dialog.append(title, stage, el('div', { class: 'ending-controls' }, [play, sound, skip, closeButton]), caption, limit, finalActions, status);
  root.append(dialog);

  function eligible() { return !destroyed && services.investigation?.canReport?.() === true; }
  function stillCurrent() { return eligible() && runKey(services.caseStore.get()) === openedRun; }
  function remember(patch) {
    if (!stillCurrent()) return;
    services.caseStore.update(state => {
      if (runKey(state) !== openedRun) return;
      const prior = state.ending?.runKey === openedRun ? state.ending : {};
      state.ending = { version: 1, presentedAt: 0, completedAt: 0, skippedAt: 0, ...prior, ...patch, runKey: openedRun };
    });
  }
  function quiet() {
    return services.motionAllowed?.() === false || matchMedia('(prefers-reduced-motion: reduce)').matches
      || Boolean(navigator.connection?.saveData) || services.store?.get?.('caseQuiet', false) === true
      || Boolean(root.closest('.case-quiet'));
  }
  function unduck() { if (ducked) { ducked = false; services.audio?.unduck?.(token); } }
  function syncDuck() {
    if (dialog.open && !destroyed && !document.hidden && mode === 'video' && videoPlaying && videoRecord?.hasAudio === true && !video.paused && !video.ended && !video.muted && video.volume > 0) {
      if (!ducked) { ducked = true; services.audio?.duck?.(token, .18); }
    } else unduck();
  }
  function updateSound() { sound.textContent = video.muted ? 'تشغيل صوت المشهد' : 'كتم صوت المشهد'; sound.setAttribute('aria-pressed', String(!video.muted)); syncDuck(); }
  function setScene(next) {
    if (scene === next) return;
    scene = next; stage.dataset.scene = String(next); caption.textContent = captions[next]; limit.hidden = next !== 3;
  }
  function renderTime() { setScene(elapsed < 3000 ? 0 : elapsed < 7000 ? 1 : elapsed < 10500 ? 2 : 3); }
  function cancelTimeline() { cancelAnimationFrame(frame); frame = null; lastFrame = null; }
  function tick(now) {
    if (destroyed || !dialog.open || done || mode !== 'dom' || document.hidden) { lastFrame = null; return; }
    if (lastFrame !== null) elapsed += now - lastFrame;
    lastFrame = now; renderTime();
    if (elapsed >= DURATION) finish('complete');
    else frame = requestAnimationFrame(tick);
  }
  function stopVideo() { playAttempt++; resumeVideo = false; videoPlaying = false; video.pause(); unduck(); }
  function startDOM({ from = 0 } = {}) {
    stopVideo(); mode = 'dom'; stage.dataset.mode = mode; video.hidden = true; visual.hidden = false;
    play.hidden = sound.hidden = true; elapsed = from; renderTime(); cancelTimeline();
    if (!document.hidden && !done) frame = requestAnimationFrame(tick);
  }
  function finish(reason) {
    if (!dialog.open || done || !stillCurrent()) return;
    done = true; cancelTimeline(); stopVideo();
    if (reason === 'skip') { remember({ skippedAt: Date.now() }); mode = 'dom'; video.hidden = true; visual.hidden = false; stage.dataset.mode = mode; }
    else remember({ completedAt: Date.now() });
    elapsed = DURATION; setScene(3); finalActions.hidden = false; skip.disabled = true; play.hidden = sound.hidden = true;
    status.textContent = reason === 'skip' ? 'الخلاصة متاحة. يمكنك قراءة التقرير أو إعادة المشهد.' : 'اكتملت الخاتمة البصرية. التقرير يبيّن الأدلة وحدودها.';
    if (reason === 'skip' || [play, sound, skip].includes(document.activeElement)) report.focus({ preventScroll: true });
  }
  function begin() {
    if (!dialog.open || !stillCurrent()) return;
    presentation++; done = false; elapsed = 0; scene = -1; finalActions.hidden = true; skip.disabled = false;
    cancelTimeline(); stopVideo(); video.muted = true; updateSound();
    dialog.dataset.static = String(quiet());
    if (quiet()) { startDOM(); finish('static'); return; }
    startDOM(); status.textContent = 'خاتمة بصرية مبنية على وثائق القضية.';
    if (videoReady) useVideo(); else void resolveVideo(presentation);
  }
  async function playVideo() {
    if (!videoReady || !dialog.open || done || !stillCurrent()) return;
    const attempt = ++playAttempt;
    play.textContent = 'جارٍ التشغيل…';
    try {
      await video.play();
      if (destroyed || attempt !== playAttempt || !dialog.open || done) return;
      play.textContent = 'إيقاف المشهد'; syncDuck();
    } catch (error) {
      if (destroyed || attempt !== playAttempt || !dialog.open || done) return;
      unduck(); play.textContent = 'شغّل المشهد';
      if (error?.name === 'NotAllowedError') status.textContent = 'اضغط تشغيل لمشاهدة الخاتمة، أو تجاوز مباشرة إلى الخلاصة.';
      else fallback('تعذّر تشغيل الفيديو؛ تتابع الخاتمة البصرية من الوثائق.');
    }
  }
  function useVideo() {
    if (!videoReady || !dialog.open || done || !stillCurrent()) return;
    cancelTimeline(); stopVideo(); mode = 'video'; stage.dataset.mode = mode; video.hidden = false; visual.hidden = true;
    video.currentTime = 0; elapsed = 0; renderTime(); play.hidden = false; sound.hidden = videoRecord?.hasAudio !== true;
    status.textContent = videoRecord?.hasAudio === true ? 'خاتمة الملف · يمكنك تشغيل صوت المشهد باختيارك.' : 'خاتمة الملف · مشهد صامت؛ تبقى الموسيقى على اختيارك.';
    if (!document.hidden) void playVideo(); else resumeVideo = true;
  }
  function fallback(message) {
    if (destroyed || !dialog.open || done) return;
    videoReady = false; startDOM({ from: elapsed }); status.textContent = message;
  }
  async function resolveVideo(request) {
    if (loadJob || destroyed || quiet()) return;
    const controller = new AbortController(); loadJob = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      if (!resolvedManifest) {
        if (services.caseEndingMedia) resolvedManifest = services.caseEndingMedia;
        else {
          const response = await fetch(manifestURL, { signal: controller.signal });
          if (!response.ok) throw new Error('Manifest unavailable');
          resolvedManifest = await response.json();
        }
      }
      const record = resolvedManifest?.version === 1 ? resolvedManifest.video : null;
      if (!mediaURL(record) || !Number.isFinite(record.durationSeconds) || record.durationSeconds < 12 || record.durationSeconds > 15) return;
      const verified = await loadVerifiedMedia(record, { kind: 'video', signal: controller.signal });
      if (destroyed || controller.signal.aborted || !dialog.open || request !== presentation) return;
      if (objectURL) URL.revokeObjectURL(objectURL);
      objectURL = URL.createObjectURL(verified.blob); videoRecord = record;
      await new Promise((resolve, reject) => {
        const cleanup = () => { video.removeEventListener('loadedmetadata', ready); video.removeEventListener('error', failed); controller.signal.removeEventListener('abort', abort); };
        const ready = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('Video unavailable')); };
        const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
        video.addEventListener('loadedmetadata', ready); video.addEventListener('error', failed); controller.signal.addEventListener('abort', abort, { once: true });
        video.src = objectURL; video.preload = 'metadata'; video.load();
      });
      if (destroyed || controller.signal.aborted || request !== presentation || !dialog.open) return;
      if (!Number.isFinite(video.duration) || Math.abs(video.duration - record.durationSeconds) > .25) throw new Error('Video duration mismatch');
      videoReady = true;
      // A slow download must not restart an ending the visitor is already reading.
      if (!done && elapsed < 2000) useVideo();
    } catch {
      if (!destroyed && dialog.open && request === presentation && !done && !controller.signal.aborted) fallback('الفيديو غير متاح؛ الخاتمة البصرية والتقرير متاحان.');
    } finally { clearTimeout(timeout); if (loadJob === controller) loadJob = null; }
  }
  function open({ automatic = false } = {}) {
    if (!eligible() || dialog.open) return false;
    const state = services.caseStore.get(), key = runKey(state);
    if (automatic && state.ending?.runKey === key && state.ending.presentedAt > 0) return false;
    openedRun = key; previousFocus = document.activeElement;
    dialog.showModal(); title.focus();
    remember({ presentedAt: state.ending?.runKey === key && state.ending.presentedAt > 0 ? state.ending.presentedAt : Date.now() });
    begin(); return true;
  }
  function close() {
    if (!dialog.open) return;
    if (!done) remember({ skippedAt: Date.now() });
    presentation++; cancelTimeline(); stopVideo(); loadJob?.abort(); loadJob = null; dialog.close();
    if (!destroyed && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  const events = { signal: lifetime.signal };
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }, events);
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); }, events);
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')]
      .filter(control => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length && getComputedStyle(control).visibility !== 'hidden');
    if (!controls.length) { event.preventDefault(); title.focus(); return; }
    const first = controls[0], last = controls.at(-1), active = document.activeElement;
    if (!controls.includes(active) || event.shiftKey && active === first || !event.shiftKey && active === last) {
      event.preventDefault(); (event.shiftKey ? last : first).focus();
    }
  }, events);
  video.addEventListener('playing', () => { if (done || !dialog.open) { stopVideo(); return; } videoPlaying = true; play.textContent = 'إيقاف المشهد'; syncDuck(); }, events);
  video.addEventListener('pause', () => { videoPlaying = false; unduck(); if (!done) play.textContent = 'واصل المشهد'; }, events);
  video.addEventListener('waiting', () => { videoPlaying = false; unduck(); }, events);
  video.addEventListener('volumechange', updateSound, events);
  video.addEventListener('ended', () => { videoPlaying = false; unduck(); if (mode === 'video') finish('complete'); }, events);
  video.addEventListener('error', () => { videoPlaying = false; unduck(); if (videoReady && mode === 'video') fallback('تعذّر متابعة الفيديو؛ تتابع الخاتمة البصرية من الوثائق.'); }, events);
  video.addEventListener('timeupdate', () => {
    if (mode !== 'video' || done || !Number.isFinite(video.duration) || !video.duration) return;
    elapsed = Math.min(DURATION, video.currentTime / video.duration * DURATION); renderTime();
  }, events);
  document.addEventListener('visibilitychange', () => {
    if (!dialog.open || done) return;
    dialog.dataset.suspended = String(document.hidden);
    if (document.hidden) { resumeVideo = mode === 'video' && !video.paused; cancelTimeline(); video.pause(); unduck(); }
    else if (mode === 'dom') { lastFrame = null; frame = requestAnimationFrame(tick); }
    else if (resumeVideo) { resumeVideo = false; void playVideo(); }
  }, events);
  const unsubscribe = services.caseStore.subscribe?.(() => { if (dialog.open && !stillCurrent()) close(); });
  return { open, close, destroy() {
    if (destroyed) return;
    close(); destroyed = true; lifetime.abort(); unsubscribe?.(); cancelTimeline(); stopVideo(); loadJob?.abort();
    video.removeAttribute('src'); video.load(); if (objectURL) URL.revokeObjectURL(objectURL); dialog.remove();
  } };
}
