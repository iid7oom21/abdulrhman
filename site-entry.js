// A session welcome, independent of the persistent soundtrack and page routing.
export function createEntryGate({ root, show = false, onEnter, onClose } = {}) {
  if (!show || typeof HTMLDialogElement === 'undefined') return null;
  let seen = false;
  try { seen = sessionStorage.getItem('raven_studio_ident_v1') === '1'; } catch {}
  if (seen) return null;
  const dialog = document.createElement('dialog');
  dialog.id = 'archive-entry-gate';
  dialog.className = 'archive-entry';
  dialog.setAttribute('aria-labelledby', 'archive-entry-title');
  dialog.setAttribute('aria-describedby', 'archive-entry-copy');
  // Only static editorial content is inserted; visitor input never enters HTML.
  dialog.innerHTML = `
    <img class="archive-entry-art" alt="" aria-hidden="true">
    <div class="archive-entry-content">
      <p class="archive-entry-kicker">RAVEN · THE ARCHIVE</p>
      <div class="archive-entry-mark" aria-hidden="true">R</div>
      <h1 id="archive-entry-title">بعض الأدلة تنتظر ضوءًا آخر.</h1>
      <p id="archive-entry-copy">قصص تُشاهد. وأثر تفحصه بنفسك.</p>
      <button id="archive-enter" type="button" autofocus>ادخل عالم رايفن</button>
      <button id="archive-skip" type="button">تخطَّ المقدمة</button>
      <p id="archive-entry-note">يمكنك التحكم بالأغنية من شريط الصوت.</p>
    </div>`;
  dialog.querySelector('img').src = new URL('assets/raven-home-share.jpg', root).href;
  const sync = (language = document.documentElement.lang) => {
    const en = language === 'en';
    dialog.lang = en ? 'en' : 'ar';
    dialog.dir = en ? 'ltr' : 'rtl';
    dialog.querySelector('#archive-entry-title').textContent = en
      ? 'Some clues await a different light.' : 'بعض الأدلة تنتظر ضوءًا آخر.';
    dialog.querySelector('#archive-entry-copy').textContent = en
      ? 'Stories to watch. A trace to examine yourself.' : 'قصص تُشاهد. وأثر تفحصه بنفسك.';
    dialog.querySelector('#archive-enter').textContent = en ? 'Enter the world of RAVEN' : 'ادخل عالم رايفن';
    dialog.querySelector('#archive-skip').textContent = en ? 'Skip introduction' : 'تخطَّ المقدمة';
    dialog.querySelector('#archive-entry-note').textContent = en
      ? 'Control the soundtrack from the sound bar.' : 'يمكنك التحكم بالأغنية من شريط الصوت.';
  };
  dialog.querySelector('#archive-enter').addEventListener('click', event => {
    onEnter?.(event);
    dialog.close();
  });
  dialog.querySelector('#archive-skip').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    try { sessionStorage.setItem('raven_studio_ident_v1', '1'); } catch {}
    onClose?.();
    dialog.remove();
  }, { once: true });
  document.body.append(dialog);
  sync(new URL(location.href).searchParams.get('lang') === 'en' ? 'en' : document.documentElement.lang);
  try { dialog.showModal(); } catch { dialog.remove(); return null; }
  return { sync, get open() { return dialog.open; } };
}
