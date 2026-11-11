/* «الاسم المحذوف» section on the homepage: follows the page language and keeps it on the way into the case.
   Static strings only, written with textContent. Loaded after raven-i18n.js. */
(function () {
  'use strict';
  const section = document.getElementById('dialogue-preview');
  if (!section) return;
  const TEXT = {
    ar: {
      menu: 'الاسم المحذوف',
      hero: 'اكتشف قضية الاسم المحذوف',
      label: 'قضية RAVEN — الاسم المحذوف',
      eyebrow: 'قضية تفاعلية · قيد التطوير',
      title: 'RAVEN — الاسم المحذوف',
      blurb: 'خانة ممسوحة، ودعوة بعد العشاء، ومكتبة ما رجع منها صاحبها. اقرأ الافتتاح وجرّب اختياراته.',
      enter: 'ادخل القضية'
    },
    en: {
      menu: 'The Deleted Name',
      hero: 'Discover The Deleted Name',
      label: 'RAVEN — The Deleted Name, interactive case',
      eyebrow: 'Interactive case · In development',
      title: 'RAVEN — The Deleted Name',
      blurb: 'An erased field, an invitation after dinner, and a library its owner never came back from. Read the opening and try its choices.',
      enter: 'Enter the case'
    }
  };
  const language = () => (window.RavenI18n ? window.RavenI18n.language() : document.documentElement.lang) === 'en' ? 'en' : 'ar';
  function apply() {
    const lang = language();
    const t = TEXT[lang];
    document.querySelectorAll('[data-dn-link]').forEach(el => {
      if (t[el.dataset.dnLink] !== undefined) el.textContent = t[el.dataset.dnLink];
    });
    section.setAttribute('aria-label', t.label);
    section.querySelectorAll('[data-dn-k]').forEach(el => {
      if (t[el.dataset.dnK] !== undefined) el.textContent = t[el.dataset.dnK];
    });
    // Both entry points open the case in the reader's selected language.
    const href = lang === 'en' ? './deleted-name/?lang=en' : './deleted-name/';
    document.querySelectorAll('[data-dn-link="hero"], [data-dn-k="enter"]').forEach(el => el.setAttribute('href', href));
  }
  apply();
  if (window.RavenI18n && typeof window.RavenI18n.subscribe === 'function') window.RavenI18n.subscribe(apply);
  document.addEventListener('raven:language', apply);
})();
