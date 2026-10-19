// Scenes are silent, opt-in in dialogs, and downloaded only when needed.
const scenes = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const sources = {
  hero: () => matchMedia('(max-width: 767px)').matches ? './assets/video/hero-mobile.mp4' : './assets/video/hero.mp4',
  archive: './assets/video/archive.mp4',
  padlock: './assets/video/padlock.mp4',
  documents: './assets/video/documents.mp4',
  adrian: './assets/video/adrian.mp4',
  lucian: './assets/video/lucian.mp4',
  elias: './assets/video/elias.mp4',
  nora: './assets/video/nora.mp4',
  elena: './assets/video/elena.mp4',
};
let initialized = false;

const automaticAllowed = () => !reducedMotion.matches && !connection?.saveData;
const dialogOpen = () => document.querySelector('dialog[open]');
const visibleOnScreen = (element) => {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
};
const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const scene = scenes.get(entry.target);
    if (!scene) continue;
    scene.visible = entry.isIntersecting && entry.intersectionRatio >= .15;
    if (scene.visible) scene.considerAutoplay();
    else scene.pause();
  }
}, { threshold: [0, .15] }) : null;

function element(tag, className, text) {
  const result = document.createElement(tag);
  result.className = className;
  if (text) result.textContent = text;
  return result;
}

/** Create a silent scene without assigning a video source or starting a download. */
export function createScene({ id, poster, alt, label, className = '', autoplay = false, originalImage = true, imageClass = '' }) {
  if (!sources[id]) throw new Error(`Unknown scene: ${id}`);
  const root = element('div', `scene-player ${className}`.trim());
  root.dataset.scene = id;
  const frame = element('div', 'scene-frame');
  const still = element('img', `scene-poster ${imageClass}`.trim());
  still.src = poster;
  still.alt = alt;
  still.loading = autoplay && id === 'hero' ? 'eager' : 'lazy';
  const video = element('video', 'scene-video');
  video.preload = 'none';
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.poster = poster;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.tabIndex = -1;
  const controls = element('div', 'scene-controls');
  const toggle = element('button', 'scene-toggle');
  toggle.type = 'button';
  const icon = element('span', 'scene-button-icon');
  icon.setAttribute('aria-hidden', 'true');
  const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  symbol.setAttribute('viewBox', '0 0 24 24');
  symbol.setAttribute('focusable', 'false');
  const symbolPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  symbolPath.setAttribute('fill', 'currentColor');
  symbol.append(symbolPath);
  icon.append(symbol);
  const buttonText = element('span', 'scene-button-text', 'شغّل المشهد');
  toggle.append(icon, buttonText);
  const stillToggle = element('button', 'scene-still-toggle', 'اعرض الصورة الأصلية');
  stillToggle.type = 'button';
  stillToggle.hidden = true;
  const status = element('p', 'scene-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  frame.append(still, video);
  controls.append(toggle);
  if (originalImage) controls.append(stillToggle);
  root.append(frame, controls, status);

  const abort = new AbortController();
  const listen = (target, name, handler) => target.addEventListener(name, handler, { signal: abort.signal });
  let loaded = false;
  let busy = false;
  let ended = false;
  let failed = false;
  let manualPause = false;
  let showStill = true;
  let request = 0;
  let disposed = false;
  let autoRejected = false;

  function update() {
    const playing = !video.paused && !ended && !showStill;
    const action = busy ? 'أوقف المشهد' : playing ? 'أوقف المشهد' : ended ? 'أعد المشهد' : 'شغّل المشهد';
    buttonText.textContent = action;
    symbolPath.setAttribute('d', busy || playing ? 'M6 5h4v14H6zm8 0h4v14h-4z' : ended ? 'M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-1.76-4.24L13 11h8V3l-3.34 3.34A7.96 7.96 0 0 0 12 4z' : 'M7 4v16l13-8z');
    toggle.setAttribute('aria-label', `${action} — ${label}`);
    toggle.setAttribute('aria-pressed', String(playing || busy));
    root.classList.toggle('scene-show-video', !showStill && !failed);
    root.classList.toggle('scene-original', showStill);
    root.classList.toggle('scene-loading', busy);
    root.dataset.state = failed ? 'error' : ended ? 'ended' : playing ? 'playing' : busy ? 'loading' : 'paused';
    stillToggle.textContent = showStill ? 'اعرض المشهد' : 'اعرض الصورة الأصلية';
    stillToggle.setAttribute('aria-label', `${stillToggle.textContent} — ${label}`);
    stillToggle.hidden = !loaded || failed;
  }

  function allowedNow() {
    const open = dialogOpen();
    return !disposed && root.isConnected && !document.hidden && (!open || open.contains(root));
  }

  function pause() {
    request += 1;
    busy = false;
    video.pause();
    update();
  }

  function load() {
    if (loaded) return;
    // Select exactly one file. Resizing never downloads a second hero variant.
    video.src = typeof sources[id] === 'function' ? sources[id]() : sources[id];
    loaded = true;
  }

  async function play(explicit = false) {
    if (!allowedNow()) return;
    if (!explicit && (!automaticAllowed() || manualPause || ended || autoRejected || failed)) return;
    if (explicit) {
      manualPause = false;
      autoRejected = false;
      if (failed) {
        video.removeAttribute('src');
        video.load();
        loaded = false;
        failed = false;
      }
    }
    status.textContent = '';
    const currentRequest = ++request;
    load();
    if (ended) {
      video.currentTime = 0;
      ended = false;
    }
    busy = true;
    update();
    try {
      await video.play();
      if (disposed || currentRequest !== request) return;
      if (!allowedNow() || !visibleOnScreen(root)) {
        pause();
        return;
      }
      busy = false;
      showStill = false;
      update();
    } catch (error) {
      if (disposed || currentRequest !== request || error.name === 'AbortError') return;
      busy = false;
      if (!explicit) autoRejected = true;
      else if (!failed) status.textContent = 'لم يبدأ المشهد. اضغط تشغيل للمحاولة مجددًا.';
      update();
    }
  }

  const scene = {
    visible: false,
    pause,
    considerAutoplay() {
      if (autoplay && scene.visible && video.paused && !busy && allowedNow()) void play();
    },
    dispose() {
      if (disposed) return;
      pause();
      disposed = true;
      observer?.unobserve(root);
      abort.abort();
      video.removeAttribute('src');
      video.load();
      scenes.delete(root);
    },
  };
  scenes.set(root, scene);
  observer?.observe(root);
  listen(toggle, 'click', () => {
    if (!video.paused || busy) {
      manualPause = true;
      pause();
    } else void play(true);
  });
  listen(stillToggle, 'click', () => {
    if (!showStill) {
      manualPause = true;
      pause();
      showStill = true;
    } else showStill = false;
    update();
  });
  listen(video, 'playing', () => {
    if (!allowedNow() || !visibleOnScreen(root)) {
      pause();
      return;
    }
    busy = false;
    showStill = false;
    update();
  });
  listen(video, 'pause', update);
  listen(video, 'ended', () => {
    busy = false;
    ended = true;
    update();
  });
  listen(video, 'error', () => {
    request += 1;
    busy = false;
    failed = true;
    showStill = true;
    video.pause();
    status.textContent = 'تعذّر تشغيل المشهد. الصورة الأصلية متاحة؛ حاول مجددًا.';
    update();
  });
  update();
  return root;
}

export function pauseScenes() {
  for (const scene of scenes.values()) scene.pause();
}

export function disposeScenes(container) {
  for (const [root, scene] of scenes) if (container.contains(root)) scene.dispose();
}

export function refreshScenes() {
  for (const [root, scene] of scenes) {
    scene.visible = visibleOnScreen(root);
    scene.considerAutoplay();
  }
}

export function initializeScenes() {
  if (initialized) return;
  initialized = true;
  const heroImage = document.querySelector('.hero-image');
  if (heroImage) heroImage.replaceWith(createScene({
    id: 'hero', poster: heroImage.getAttribute('src'), alt: heroImage.alt,
    label: 'ليلة الحريق', className: 'hero-scene', autoplay: true, originalImage: false,
  }));
  const archiveImage = document.querySelector('.archive-photo > img');
  if (archiveImage) archiveImage.replaceWith(createScene({
    id: 'archive', poster: archiveImage.getAttribute('src'), alt: archiveImage.alt,
    label: 'داخل الأرشيف', className: 'archive-scene', autoplay: true, originalImage: false,
  }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseScenes();
    else refreshScenes();
  });
  const preferenceChanged = () => {
    pauseScenes();
    if (automaticAllowed()) refreshScenes();
  };
  reducedMotion.addEventListener?.('change', preferenceChanged);
  connection?.addEventListener?.('change', preferenceChanged);
  // Browsers without IntersectionObserver retain explicit play controls.
}
