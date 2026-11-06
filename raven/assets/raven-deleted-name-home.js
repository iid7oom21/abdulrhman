/* «الاسم المحذوف» section on the homepage: follows the page language and keeps it on the way into the case.
   Static strings only, written with textContent. Loaded after raven-i18n.js. */
(function () {
  'use strict';
  const section = document.getElementById('dialogue-preview');
  if (!section) return;
  const TEXT = {
    ar: {
      menu: 'محاكاة الحوار',
      hero: 'محاكاة الحوار — الاسم المحذوف',
      label: 'معاينة محادثة RAVEN — الاسم المحذوف',
      eyebrow: 'قضية تفاعلية · قيد التطوير',
      title: 'RAVEN — الاسم المحذوف',
      blurb: 'خانة ممسوحة، ودعوة بعد العشاء، ومكتبة ما رجع منها صاحبها. ادخل القضية واقرأ بدايتها. وتحت تقدر تجرّب معاينة الحوار التقنية: تسجّل أقوالك وتصحيحاتك، والشخصيات ما ترد بعد بنص القصة.',
      enter: 'ادخل القضية',
      previewLabel: 'معاينة الحوار التقنية',
      openPreview: 'فتح المعاينة في نافذة مستقلة ↗',
      frame: 'RAVEN — الاسم المحذوف (معاينة محادثة)'
    },
    en: {
      menu: 'Dialogue simulation',
      hero: 'Dialogue simulation — The Deleted Name',
      label: 'RAVEN — The Deleted Name, dialogue preview',
      eyebrow: 'Interactive case · In development',
      title: 'RAVEN — The Deleted Name',
      blurb: "An erased field, an invitation after dinner, and a library its owner never came back from. Enter the case and read how it begins. Below, you can try the technical dialogue preview: record your statements and corrections. The characters don't answer from the story yet.",
      enter: 'Enter the case',
      previewLabel: 'Technical dialogue preview',
      openPreview: 'Open the preview in a new window ↗',
      frame: 'RAVEN — The Deleted Name (dialogue preview)'
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
    section.querySelector('#rvnDialogueFrame')?.setAttribute('title', t.frame);
    const frame = section.querySelector('#rvnDialogueFrame');
    if (frame) {
      const next = './dialogue/' + (lang === 'en' ? '?lang=en' : '');
      if (frame.getAttribute('src') !== next) frame.setAttribute('src', next);
    }
    const openPreview = section.querySelector('[data-dn-k="openPreview"]');
    if (openPreview) openPreview.setAttribute('href', lang === 'en' ? './dialogue/?lang=en' : './dialogue/');
    // The case page reads ?lang=en, so the reader stays in the language they chose.
    const enter = section.querySelector('[data-dn-k="enter"]');
    if (enter) enter.setAttribute('href', lang === 'en' ? './deleted-name/?lang=en' : './deleted-name/');
  }
  apply();
  if (window.RavenI18n && typeof window.RavenI18n.subscribe === 'function') window.RavenI18n.subscribe(apply);
  document.addEventListener('raven:language', apply);
})();
