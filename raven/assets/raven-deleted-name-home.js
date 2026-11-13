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
      enter: 'ادخل القضية',
      jonasName: 'يوناس',
      jonasRole: 'طالب مراجعة الوثيقة',
      claireName: 'كلير',
      claireRole: 'منسقة الدعوات والمقاعد',
      elenaName: 'إيلينا',
      mateoName: 'ماتيو',
      mateoRole: 'أول الواصلين للمكتبة',
      noahName: 'نوح',
      dinnerGuest: 'ضيف على العشاء',
      dinnerGuestFemale: 'ضيفة على العشاء',
      tableName: 'طاولة الصالة',
      tableAlt: 'تصور فني لطاولة الأوراق',
      tableRole: 'تصور فني — ليس دليلًا',
      illustrationNote: 'الصور تصورات فنية للشخصيات والأماكن؛ أدلة القضية تأتي من المواد المكتوبة.'
    },
    en: {
      menu: 'The Deleted Name',
      hero: 'Discover The Deleted Name',
      label: 'RAVEN — The Deleted Name, interactive case',
      eyebrow: 'Interactive case · In development',
      title: 'RAVEN — The Deleted Name',
      blurb: 'An erased field, an invitation after dinner, and a library its owner never came back from. Read the opening and try its choices.',
      enter: 'Enter the case',
      jonasName: 'Jonas',
      jonasRole: 'Requested a document review',
      claireName: 'Claire',
      claireRole: 'Invitation and seating coordinator',
      elenaName: 'Elena',
      mateoName: 'Mateo',
      mateoRole: 'First to reach the library',
      noahName: 'Noah',
      dinnerGuest: 'Dinner guest',
      dinnerGuestFemale: 'Dinner guest',
      tableName: 'Lounge table',
      tableAlt: 'Artist’s impression of the table of papers',
      tableRole: 'Artist’s impression — not evidence',
      illustrationNote: 'Images are artistic depictions of the characters and places; the case evidence comes from written materials.'
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
    section.querySelectorAll('[data-dn-alt]').forEach(el => {
      if (t[el.dataset.dnAlt] !== undefined) el.setAttribute('alt', t[el.dataset.dnAlt]);
    });
    // Every entry link carries the language, even without browser storage.
    const href = lang === 'en' ? './deleted-name/?lang=en' : './deleted-name/';
    document.querySelectorAll('[data-dn-link="hero"], [data-dn-k="enter"], [data-dn-entry]').forEach(el => {
      el.setAttribute('href', href);
      // The homepage enhancement also rebinds these links from this attribute.
      if (el.hasAttribute('data-raven-route')) el.dataset.ravenRoute = href;
    });
  }
  apply();
  if (window.RavenI18n && typeof window.RavenI18n.subscribe === 'function') window.RavenI18n.subscribe(apply);
  document.addEventListener('raven:language', apply);
})();
