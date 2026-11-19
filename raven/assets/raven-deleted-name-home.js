/* Homepage case entry and silent atmosphere clips follow the existing page language.
   Static strings only, written with textContent. Loaded after raven-i18n.js. */
(function () {
  'use strict';
  const section = document.getElementById('dialogue-preview');
  if (!section) return;
  const TEXT = {
    ar: {
      menu: 'الاسم المحذوف',
      hero: 'اكتشف قضية الاسم المحذوف',
      afterEpisode: 'افتح قضية الاسم المحذوف',
      heroCopy: 'دعوة بعد العشاء، وسجل ناقص، ومسودة تنتظر مراجعتك. افحص الأوراق واختر ردك.',
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
      afterEpisode: 'Open The Deleted Name',
      heroCopy: 'An invitation after dinner, an incomplete record, and a draft awaiting your review. Examine the papers and choose your reply.',
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
  const ATMOSPHERE = {
    ar: {
      title:'أجواء RAVEN', note:'تصورات فنية صامتة للأجواء؛ ليست أدلة ولا إعادة تمثيل للواقعة.',
      archive:'اللقطة الواسعة', paper:'الورق والهاتف', shoulder:'خلف الكتف',
      play:'شغّل المقطع', pause:'أوقف المقطع مؤقتًا', replay:'شغّل المقطع مجددًا', retry:'أعد تحميل المقطع',
      ready:'يبدأ المقطع عندما تختار تشغيله.', loading:'جارٍ تحميل المقطع…', playing:'المقطع يعمل دون صوت.',
      paused:'المقطع متوقف مؤقتًا.', ended:'انتهى المقطع. يمكنك تشغيله مجددًا.',
      error:'تعذّر تشغيل المقطع. يمكنك إعادة المحاولة أو متابعة التصفح.'
    },
    en: {
      title:'RAVEN atmosphere', note:'Silent artistic impressions of the atmosphere; not evidence or a reconstruction of the incident.',
      archive:'Archive wide shot', paper:'Paper and phone', shoulder:'Over the shoulder',
      play:'Play clip', pause:'Pause clip', replay:'Replay clip', retry:'Reload clip',
      ready:'The clip starts when you choose to play it.', loading:'Loading the clip…', playing:'The clip is playing without sound.',
      paused:'The clip is paused.', ended:'The clip has ended. You can play it again.',
      error:'The clip could not play. You can retry or continue browsing.'
    }
  };
  const language = () => (window.RavenI18n ? window.RavenI18n.language() : document.documentElement.lang) === 'en' ? 'en' : 'ar';
  const atmosphere = document.getElementById('raven-atmosphere');
  const clips = [...(atmosphere?.querySelectorAll('[data-atmosphere-card]') || [])].map(card => ({
    card, video:card.querySelector('[data-atmosphere-video]'), play:card.querySelector('[data-atmosphere-play]'),
    retry:card.querySelector('[data-atmosphere-retry]'), status:card.querySelector('[data-atmosphere-status]'), phase:'ready', attempt:0
  })).filter(clip => clip.video && clip.play && clip.retry && clip.status);
  function updateClip(clip) {
    const t = ATMOSPHERE[language()];
    const title = clip.card.querySelector('h3').textContent;
    const action = ['loading','playing'].includes(clip.phase) ? t.pause : clip.phase === 'ended' ? t.replay : t.play;
    const active = document.activeElement;
    clip.play.textContent = action;clip.play.setAttribute('aria-label',action + ': ' + title);
    clip.retry.textContent = t.retry;clip.retry.setAttribute('aria-label',t.retry + ': ' + title);
    clip.play.hidden = clip.phase === 'error';clip.retry.hidden = clip.phase !== 'error';
    clip.status.textContent = t[clip.phase];
    if (active === clip.play && clip.play.hidden) clip.retry.focus({preventScroll:true});
    else if (active === clip.retry && clip.retry.hidden) clip.play.focus({preventScroll:true});
  }
  function pauseClips(except) {
    for (const clip of clips) if (clip !== except && (!clip.video.paused || ['loading','playing'].includes(clip.phase))) {
      ++clip.attempt;clip.video.pause();
      if (!['error','ended'].includes(clip.phase)) clip.phase = 'paused';
      updateClip(clip);
    }
  }
  function playClip(clip, retry = false) {
    pauseClips(clip);
    const attempt = ++clip.attempt;
    if (retry) clip.video.load();
    clip.video.muted = true;clip.phase = 'loading';updateClip(clip);
    const failed = error => {
      // A later pause, navigation, or another clip supersedes an earlier play.
      if (attempt !== clip.attempt) return;
      clip.phase = error?.name === 'AbortError' ? 'paused' : 'error';updateClip(clip);
    };
    try { Promise.resolve(clip.video.play()).catch(failed); } catch (error) { failed(error); }
  }
  for (const clip of clips) {
    clip.play.addEventListener('click',() => {
      if (!clip.video.paused || clip.phase === 'loading') {
        ++clip.attempt;clip.video.pause();clip.phase = 'paused';updateClip(clip);
      } else playClip(clip);
    });
    clip.retry.addEventListener('click',() => playClip(clip,true));
    clip.video.addEventListener('play',() => {
      if (clip.video.paused) return; // Ignore an event queued before another clip paused this one.
      if (document.hidden) { pauseClips();return; }
      pauseClips(clip);clip.phase = 'loading';updateClip(clip);
    });
    clip.video.addEventListener('playing',() => {
      if (clip.video.paused) return;
      if (document.hidden) { pauseClips();return; }
      pauseClips(clip);clip.phase = 'playing';updateClip(clip);
    });
    clip.video.addEventListener('waiting',() => {
      if (!clip.video.paused) { clip.phase = 'loading';updateClip(clip); }
    });
    clip.video.addEventListener('pause',() => {
      if (!clip.video.paused) return;
      ++clip.attempt;
      if (!['error','ended'].includes(clip.phase)) clip.phase = 'paused';
      updateClip(clip);
    });
    clip.video.addEventListener('ended',() => { clip.phase = 'ended';updateClip(clip); });
    clip.video.addEventListener('error',() => { ++clip.attempt;clip.phase = 'error';updateClip(clip); });
  }
  document.addEventListener('visibilitychange',() => { if (document.hidden) pauseClips(); });
  window.addEventListener('pagehide',() => pauseClips());
  window.addEventListener('hashchange',() => pauseClips());
  document.addEventListener('raven:theater',event => { if (event.detail?.open) pauseClips(); });
  function apply() {
    const lang = language();
    const t = TEXT[lang];
    document.querySelectorAll('[data-dn-link]').forEach(el => {
      if (t[el.dataset.dnLink] !== undefined) el.textContent = t[el.dataset.dnLink];
    });
    document.querySelectorAll('[data-dn-hero-copy]').forEach(el => { el.textContent = t.heroCopy; });
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
    atmosphere?.querySelectorAll('[data-atmosphere-text]').forEach(el => {
      const text = ATMOSPHERE[lang][el.dataset.atmosphereText];if (text !== undefined) el.textContent = text;
    });
    clips.forEach(updateClip);
  }
  apply();
  if (window.RavenI18n && typeof window.RavenI18n.subscribe === 'function') window.RavenI18n.subscribe(apply);
  document.addEventListener('raven:language', apply);
})();
