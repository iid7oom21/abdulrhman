(() => {
  'use strict';
  const root = document.getElementById('raven-visual-scenes');
  if (!root) return;
  const video = root.querySelector('video');
  const stage = root.querySelector('.rvnVisualStage');
  const formats = [...root.querySelectorAll('[data-visual-format]')];
  const frames = [...root.querySelectorAll('[data-visual-seek]')];
  const sound = root.querySelector('[data-visual-sound]');
  const status = root.querySelector('[data-visual-status]');
  const base = new URL('../studio/visual-lab/', location.href);
  const texts = {
    ar: {title:'مشاهد من عالم RAVEN',description:'أربع دراسات بصرية وفيلم قصير، بحركة كاميرا هادئة وأجواء صوتية أصلية.',studio:'افتح استوديو المشاهد',landscape:'أفقي 16:9',portrait:'عمودي 9:16',choose:'اختر صورة للانتقال إلى مشهدها في الفيلم.',enable:'تفعيل الصوت',mute:'كتم الصوت',ready:'النسخة جاهزة. اضغط تشغيل للمتابعة.',error:'تعذّر تحميل الفيلم. جرّب النسخة الأخرى أو أعد فتح الاستوديو.',note:'صور مولّدة بالذكاء الاصطناعي، ومونتاج متحرك من الصور. هذه دراسات فنية مستقلة عن أحداث القصة.',manor:'القصر تحت المطر',archive:'قاعة الأرشيف',desk:'على ضوء المصباح',corridor:'الممر الحجري'},
    en: {title:'Scenes from RAVEN',description:'Four visual studies and a short film with slow camera movement and original ambience.',studio:'Open the scene studio',landscape:'Landscape 16:9',portrait:'Portrait 9:16',choose:'Select an image to jump to its scene in the film.',enable:'Enable sound',mute:'Mute sound',ready:'This version is ready. Press play to continue.',error:'The film could not load. Try the other format or reopen the studio.',note:'AI-generated images and an animated still-image montage. These visual studies are independent of story events.',manor:'The Manor',archive:'The Archive',desk:'The Desk',corridor:'The Corridor'}
  };
  let format = 'landscape';
  let pending = null;
  let statusKey = 'choose';
  const locale = () => document.documentElement.lang === 'en' ? 'en' : 'ar';
  const words = () => texts[locale()];
  function syncSound() {
    const audible = !video.muted && video.volume > 0;
    sound.textContent = words()[audible ? 'mute' : 'enable'];
    sound.setAttribute('aria-pressed', String(audible));
  }
  function translate() {
    for (const node of root.querySelectorAll('[data-visual-text]')) node.textContent = words()[node.dataset.visualText];
    for (const frame of frames) frame.querySelector('img').alt = words()[frame.dataset.visualName];
    video.setAttribute('aria-label', locale() === 'ar' ? 'فيلم RAVEN — دراسة بصرية' : 'RAVEN film — visual study');
    status.textContent = words()[statusKey];
    const studio = root.querySelector('.rvnVisualStudioLink');
    studio.href = new URL(`../studio/${locale() === 'en' ? '?lang=en' : ''}`, location.href).href;
    syncSound();
  }
  function highlight() {
    let selected = frames[0];
    for (const frame of frames) if (video.currentTime >= Number(frame.dataset.visualStart)) selected = frame;
    for (const frame of frames) frame.setAttribute('aria-pressed', String(frame === selected));
  }
  function applyPending() {
    if (!pending || video.readyState < 1) return;
    const intent = pending;
    pending = null;
    video.currentTime = Math.min(intent.time, video.duration);
    highlight();
    if (intent.play) void video.play().catch(() => { statusKey = 'ready'; status.textContent = words()[statusKey]; });
  }
  for (const button of formats) button.addEventListener('click', () => {
    const next = button.dataset.visualFormat;
    if (next === format) return;
    const time = pending?.time ?? video.currentTime;
    const play = pending?.play ?? !video.paused;
    video.pause();
    pending = {time, play};
    format = next;
    stage.dataset.format = next;
    video.src = new URL(`media/raven-${next}.mp4`, base).href;
    video.poster = new URL(`media/poster-${next}.webp`, base).href;
    video.preload = 'auto';
    for (const item of formats) item.setAttribute('aria-pressed', String(item === button));
    video.load();
    statusKey = 'ready'; status.textContent = words()[statusKey];
  });
  for (const frame of frames) frame.addEventListener('click', () => {
    pending = {time:Number(frame.dataset.visualSeek), play:!video.paused};
    if (video.readyState >= 1) applyPending();
    else { video.preload = 'auto'; video.load(); }
  });
  sound.addEventListener('click', () => {
    if (video.volume === 0) { video.volume = 0.65; video.muted = false; }
    else video.muted = !video.muted;
    syncSound();
  });
  video.addEventListener('loadedmetadata', applyPending);
  video.addEventListener('timeupdate', highlight);
  video.addEventListener('volumechange', syncSound);
  video.addEventListener('error', () => { pending = null; statusKey = 'error'; status.textContent = words()[statusKey]; });
  document.addEventListener('raven:language', translate);
  document.addEventListener('DOMContentLoaded', translate, {once:true});
  document.addEventListener('raven:theater', event => { if (event.detail?.open) video.pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
  translate();
})();
