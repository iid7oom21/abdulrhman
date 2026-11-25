// A session welcome, independent of the persistent soundtrack and page routing.
// The silent ident and its still share one entrance. Every destination is
// available immediately, including when motion or data use is reduced.
export function createEntryGate({ root, show = false, onEnter, onClose, navigate } = {}) {
  if (!show || typeof HTMLDialogElement === 'undefined') return null;
  let seen = false;
  try { seen = sessionStorage.getItem('raven_studio_ident_v1') === '1'; } catch {}
  if (seen) return null;
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = !!(navigator.connection && (navigator.connection.saveData || /(^|-)2g$/.test(navigator.connection.effectiveType || '')));
  let intro = !reduceMotion && !saveData;
  const dialog = document.createElement('dialog');
  dialog.id = 'archive-entry-gate';
  dialog.className = intro ? 'archive-entry is-intro' : 'archive-entry is-fallback';
  dialog.setAttribute('aria-labelledby', 'archive-entry-title');
  dialog.setAttribute('aria-describedby', 'archive-entry-copy');
  // Only static editorial content is inserted; visitor input never enters HTML.
  dialog.innerHTML = `
    <header class="archive-entry-bar">
      <span class="archive-wordmark" dir="ltr" translate="no">RAVEN</span>
      <button id="archive-skip" type="button">إلى الرئيسية</button>
    </header>
    <div class="archive-entry-media">
      <img class="archive-entry-art" alt="">
      <video class="archive-intro" playsinline muted preload="metadata" aria-label="مقدمة رايفن"></video>
      <button id="archive-sound" class="archive-sound" type="button">تشغيل صوت المقدمة</button>
    </div>
    <div class="archive-entry-content">
      <div class="archive-feature">
        <p id="archive-entry-copy">سينما وألعاب وورش</p>
        <h1 id="archive-entry-title">أين تبدأ الليلة؟</h1>
      </div>
      <nav class="archive-night-shortcuts">
        <a id="archive-episodes">حلقات RAVEN 17</a>
        <a id="archive-case">الاسم المحذوف</a>
        <a id="archive-after-show">بعد العرض</a>
        <a id="archive-night-hub">آخر الليل</a>
        <a id="archive-ink">ليالي الحبر</a>
        <a id="archive-studio">الاستوديو</a>
        <a id="archive-behind">خلف الكادر</a>
        <a id="archive-play-edit">العب آخر إرسال</a>
      </nav>
      <nav class="archive-time-shortcuts">
        <a id="archive-night-short">عندي دقيقتين</a>
        <a id="archive-night-evening">أبي أمسية كاملة</a>
      </nav>
      <button id="archive-enter" type="button">ادخل الرئيسية مع الموسيقى</button>
    </div>`;
  const video = dialog.querySelector('.archive-intro');
  const soundButton = dialog.querySelector('#archive-sound');
  const skipButton = dialog.querySelector('#archive-skip');
  const enterButton = dialog.querySelector('#archive-enter');
  dialog.querySelector('img').src = new URL('assets/intro/raven-intro.jpg', root).href;
  const sync = (language = document.documentElement.lang) => {
    const en = language === 'en';
    dialog.lang = en ? 'en' : 'ar';
    const shortcuts = [
      ['archive-episodes','raven/episodes/','حلقات RAVEN 17','RAVEN 17 episodes'],
      ['archive-case','raven/deleted-name/','الاسم المحذوف','The Deleted Name'],
      ['archive-after-show','raven/after-show/','بعد العرض','After the Show'],
      ['archive-ink','raven/late-night/ink-studio.html','ليالي الحبر','Ink Nights'],
      ['archive-studio','studio/','الاستوديو','Studio'],
      ['archive-behind','raven/#behind-paper-phone','خلف الكادر','Behind the scenes'],
      ['archive-play-edit','raven/after-show/?activity=edit','العب آخر إرسال','Play Last Transmission'],
      ['archive-night-hub','raven/late-night/','آخر الليل','Late Night'],
      ['archive-night-short','raven/late-night/station-shadow.html','عندي دقيقتين','I have two minutes'],
      ['archive-night-evening','raven/late-night/festival-chair.html','أبي أمسية كاملة','Plan a full evening']
    ];
    for (const [id, path, ar, english] of shortcuts) {
      const item = dialog.querySelector('#' + id);
      const target = new URL(path, root);
      target.searchParams.set('lang', en ? 'en' : 'ar');
      item.href = target.href;
      item.textContent = en ? english : ar;
    }
    dialog.dir = en ? 'ltr' : 'rtl';
    dialog.querySelector('#archive-entry-title').textContent = en ? 'Where to tonight?' : 'أين تبدأ الليلة؟';
    dialog.querySelector('#archive-entry-copy').textContent = en ? 'Cinema, games and workshops' : 'سينما وألعاب وورش';
    dialog.querySelector('.archive-night-shortcuts').setAttribute('aria-label',en?'RAVEN destinations':'وجهات رايفن');
    dialog.querySelector('.archive-time-shortcuts').setAttribute('aria-label',en?'Choose by time':'اختر بحسب وقتك');
    enterButton.textContent = en ? 'Enter home with music' : 'ادخل الرئيسية مع الموسيقى';
    skipButton.textContent = en ? 'Home' : 'الرئيسية';
    video.setAttribute('aria-label',en?'RAVEN introduction':'مقدمة رايفن');
    soundButton.textContent = en
      ? (video.muted ? 'Unmute intro' : 'Mute intro') : (video.muted ? 'تشغيل صوت المقدمة' : 'كتم المقدمة');
    soundButton.setAttribute('aria-pressed',String(!video.muted));
  };
  let stall = 0;
  // A film that cannot play is replaced by the welcome text, so the visitor is never stuck.
  const showFallback = () => {
    if (!intro) return;
    intro = false;
    clearTimeout(stall);
    try { video.pause(); } catch {}
    video.removeAttribute('src');
    video.load();
    dialog.classList.replace('is-intro', 'is-fallback');
    if(document.activeElement===soundButton)dialog.querySelector('#archive-episodes').focus();
  };
  enterButton.addEventListener('click', event => {
    onEnter?.(event);
    dialog.close();
  });
  dialog.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (navigate?.(link.href)) event.preventDefault();
    dialog.close();
  });
  skipButton.addEventListener('click', () => dialog.close());
  soundButton.addEventListener('click', () => {
    video.muted = !video.muted;
    if (!video.muted && video.paused) video.play().catch(() => {});
    sync(dialog.lang);
  });
  video.addEventListener('ended', showFallback);
  video.addEventListener('error', showFallback);
  dialog.addEventListener('close', () => {
    try { sessionStorage.setItem('raven_studio_ident_v1', '1'); } catch {}
    clearTimeout(stall);
    intro = false;
    if (video.hasAttribute('src')) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    onClose?.();
    dialog.remove();
  }, { once: true });
  document.body.append(dialog);
  sync(new URL(location.href).searchParams.get('lang') === 'en' ? 'en' : document.documentElement.lang);
  try { dialog.showModal(); } catch { dialog.remove(); return null; }
  if (intro) {
    const mediaBox = dialog.querySelector('.archive-entry-media').getBoundingClientRect();
    const wide = mediaBox.width > mediaBox.height * 1.8;
    video.src = new URL(wide ? 'assets/intro/raven-intro-wide.mp4' : 'assets/intro/raven-intro.mp4', root).href;
    video.poster = new URL(wide ? 'assets/intro/raven-intro-wide.jpg' : 'assets/intro/raven-intro.jpg', root).href;
    stall = setTimeout(() => { if (video.readyState < 2) showFallback(); }, 12000);
    video.addEventListener('canplay', () => clearTimeout(stall), { once: true });
    const started = video.play();
    if (started?.catch) started.catch(showFallback);
  }
  dialog.querySelector('#archive-episodes').focus({preventScroll:true});
  return { sync, get open() { return dialog.open; } };
}
