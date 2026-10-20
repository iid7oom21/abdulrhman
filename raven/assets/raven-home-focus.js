(() => {
  const video = document.getElementById('rvnCasePreview');
  const button = document.getElementById('rvnCaseMotion');
  if (!video || !button) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let pausedByVisitor = false;
  let theater = false;
  let playingRequest = false;
  const english = () => document.documentElement.lang === 'en';
  const sync = () => {
    button.textContent = video.error ? (english() ? 'Retry scene' : 'أعد تشغيل المشهد') :
      video.paused ? (english() ? 'Play scene' : 'تشغيل المشهد') : (english() ? 'Pause scene' : 'إيقاف المشهد');
    video.setAttribute('aria-label', english() ? 'A scene from The Fourth Signature' : 'مشهد من التوقيع الرابع');
  };
  const play = async () => {
    if (playingRequest) return;
    playingRequest = true;
    try {
      if (!video.getAttribute('src')) video.src = video.dataset.src;
      if (video.error) video.load();
      await video.play();
    } catch { /* Poster and an explicit retry stay available. */ }
    finally { playingRequest = false; sync(); }
  };
  const update = () => {
    if (!visible || document.hidden || theater || reduced.matches || pausedByVisitor) video.pause();
    else void play();
  };
  button.hidden = false;
  button.addEventListener('click', () => {
    if (!video.paused) { pausedByVisitor = true; video.pause(); }
    else { pausedByVisitor = false; void play(); }
  });
  ['play','pause','ended','error'].forEach(name => video.addEventListener(name, sync));
  document.addEventListener('visibilitychange', update);
  document.addEventListener('raven:language', sync);
  document.addEventListener('raven:theater', event => { theater = !!event.detail.open; update(); });
  reduced.addEventListener('change', update);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting; update();
    }, { threshold: .3 });
    observer.observe(video);
    addEventListener('pagehide', () => observer.disconnect(), { once: true });
  }
  sync();
})();
