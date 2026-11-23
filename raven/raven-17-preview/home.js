(() => {
  const root = document.documentElement;
  const languageButton = document.querySelector('[data-language]');
  const menuToggle = document.querySelector('#menu-toggle');
  const menu = document.querySelector('#mobile-menu');
  const dialog = document.querySelector('#clip-dialog');
  const openClip = document.querySelector('#backstage-open');
  const clip = document.querySelector('#clip');
  const retry = document.querySelector('#clip-retry');
  const pageTitle = document.title;

  // Keep Arabic in the HTML so the first render and ordinary player links work on their own.
  const translations = ['textContent', 'aria-label', 'alt'].flatMap((attribute, index) => {
    const key = ['en', 'enLabel', 'enAlt'][index];
    const selector = ['[data-en]', '[data-en-label]', '[data-en-alt]'][index];
    return [...document.querySelectorAll(selector)].map(element => ({
      element, attribute, en: element.dataset[key],
      ar: attribute === 'textContent' ? element.textContent : element.getAttribute(attribute)
    }));
  });

  function applyLanguage(lang) {
    root.lang = lang;
    root.dir = lang === 'en' ? 'ltr' : 'rtl';
    translations.forEach(entry => {
      if (entry.attribute === 'textContent') entry.element.textContent = entry[lang];
      else entry.element.setAttribute(entry.attribute, entry[lang]);
    });
    document.title = lang === 'en' ? 'RAVEN 17 | Home screen preview' : pageTitle;
    languageButton.lang = lang === 'ar' ? 'en' : 'ar';
    languageButton.querySelector('span').textContent = lang === 'ar' ? 'EN' : 'عربي';
    languageButton.setAttribute('aria-label', lang === 'ar' ? 'English' : 'العربية');
    document.querySelectorAll('[data-episode]').forEach(link => {
      const target = new URL(link.href);
      target.searchParams.set('lang', lang);
      link.href = target.href;
    });
  }

  function setMenu(open) {
    menu.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
  }

  languageButton.addEventListener('click', () => {
    const lang = root.lang === 'en' ? 'ar' : 'en';
    const url = new URL(location.href);
    url.searchParams.set('lang', lang);
    if (location.protocol !== 'file:') history.replaceState(history.state, '', url);
    applyLanguage(lang);
  });

  menuToggle.addEventListener('click', () => setMenu(menu.hidden));
  document.addEventListener('click', event => {
    if (!menu.contains(event.target) && !menuToggle.contains(event.target)) setMenu(false);
  });
  menu.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    setMenu(false);
    document.querySelector(link.hash)?.focus({preventScroll: true});
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) {
      setMenu(false);
      menuToggle.focus();
    }
  });
  matchMedia('(max-width:650px)').addEventListener('change', () => setMenu(false));

  function playClip() {
    retry.hidden = true;
    clip.play().catch(() => {
      if (clip.error) retry.hidden = false;
      // Native controls remain available if the browser requires another tap.
    });
  }
  openClip.addEventListener('click', event => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    dialog.showModal();
    if (!clip.hasAttribute('src')) clip.src = clip.dataset.clipSrc;
    playClip();
  });
  document.querySelector('#clip-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    clip.pause();
    openClip.focus({preventScroll:true});
  });
  clip.addEventListener('error', () => { retry.hidden = false; });
  retry.addEventListener('click', () => {
    clip.load();
    playClip();
  });

  applyLanguage(new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'ar');
})();
