// This document owns the audio. Only the content frame changes between pages.
const root = new URL('./', import.meta.url);
const audio = document.querySelector('#site-soundtrack');
const frame = document.querySelector('#site-content');
const toggle = document.querySelector('#music-toggle');
const status = document.querySelector('#music-status');
const volume = document.querySelector('#music-volume');
const preferenceKey = 'raven_music_enabled_v2';
const routes = ['raven/', 'fourth-signature/'].map(path => new URL(path, root).pathname);
const pageMetadata = [
  'meta[name="description"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]',
  'link[rel="canonical"]', 'link[rel="alternate"][hreflang]',
  'script[type="application/ld+json"]'
].join(',');
let enabled = true;
let failure = '';
let attempt = 0;
let activePath = '';
try { enabled = sessionStorage.getItem(preferenceKey) !== 'off'; } catch {}

function route(value) {
  const url = new URL(value, location.href);
  if (url.origin !== location.origin) return null;
  const path = url.pathname.replace(/(?:index|content)\.html$/, '').replace(/\/?$/, '/');
  if (!routes.includes(path)) return null;
  url.pathname = path;
  return url;
}

function sync() {
  const english = document.documentElement.lang === 'en';
  const playing = !audio.paused;
  toggle.textContent = playing ? (english ? 'Pause music' : 'إيقاف الأغنية') :
    (english ? 'Play music' : 'تشغيل الأغنية');
  toggle.setAttribute('aria-pressed', String(playing));
  status.textContent = failure === 'blocked' ?
    (english ? 'Tap to start the music' : 'اضغط لتبدأ الأغنية') :
    failure === 'error' ? (english ? 'Could not load. Tap to retry.' : 'تعذّر التحميل. اضغط للمحاولة.') :
    playing ? (english ? 'RAVEN · Now playing' : 'RAVEN · الأغنية شغّالة') :
    (english ? 'RAVEN · Music paused' : 'RAVEN · الأغنية متوقفة');
}

function play() {
  if (!enabled || (!audio.paused && !audio.error)) return;
  const id = ++attempt;
  if (audio.error) audio.load();
  failure = '';
  const result = audio.play();
  result?.then(() => {
    if (id !== attempt) return;
    if (!enabled) audio.pause();
    sync();
  }).catch(error => {
    if (id !== attempt || error.name === 'AbortError') return;
    failure = error.name === 'NotAllowedError' ? 'blocked' : 'error';
    sync();
  });
}

function gesture(event) {
  if (!event.isTrusted || event.repeat || event.isComposing) return;
  if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
  if (event.target.closest?.('#music-toggle, #music-volume, [data-music-toggle], audio, video')) return;
  if (enabled && audio.paused) play();
}

function toggleMusic() {
  enabled = audio.paused;
  try { sessionStorage.setItem(preferenceKey, enabled ? 'on' : 'off'); } catch {}
  if (enabled) play();
  else { ++attempt; failure = ''; audio.pause(); sync(); }
}

function updateHistory(url, push, childState = null) {
  const state = { ravenShell: true, childState };
  history[push ? 'pushState' : 'replaceState'](state, '', url);
}

function show(url, childState = null) {
  if (activePath === url.pathname && frame.contentWindow.RavenPage) {
    frame.contentWindow.RavenPage.restore(url.href, childState);
    return;
  }
  activePath = url.pathname;
  const content = new URL(url);
  content.pathname += 'content.html';
  frame.title = url.pathname === routes[0] ? 'RAVEN — الرئيسية' : 'التوقيع الرابع — ملف التحقيق';
  frame.contentWindow.location.replace(content.href);
}

function navigate(value) {
  const url = route(value);
  if (!url) return false;
  if (url.href === location.href) return true;
  updateHistory(url, true);
  show(url);
  return true;
}

window.RavenSite = {
  navigate, gesture, toggleMusic,
  state: () => ({ playing: !audio.paused, enabled }),
  childRoute(value, state, push = false) {
    const url = route(value);
    if (url?.pathname === activePath) updateHistory(url, push, state);
  },
  ready(child) {
    if (child !== frame.contentWindow || route(child.location.href)?.pathname !== activePath) return;
    const source = child.document;
    document.title = source.title;
    document.documentElement.lang = source.documentElement.lang;
    document.documentElement.dir = source.documentElement.dir;
    frame.title = source.title;
    // Public entry HTML has its own crawler metadata; keep it aligned with the
    // displayed page when client-side navigation retains this audio document.
    document.head.querySelectorAll(pageMetadata).forEach(node => node.remove());
    source.head.querySelectorAll(pageMetadata).forEach(node => {
      document.head.appendChild(node.cloneNode(true));
    });
    sync();
  }
};

toggle.addEventListener('click', toggleMusic);
volume.addEventListener('input', () => { audio.volume = Number(volume.value); });
audio.addEventListener('playing', () => { failure = ''; sync(); });
audio.addEventListener('pause', sync);
audio.addEventListener('error', () => { failure = 'error'; sync(); });
document.addEventListener('click', gesture);
document.addEventListener('keydown', gesture);
window.addEventListener('popstate', event => {
  const url = route(location.href);
  if (url) show(url, event.state?.childState);
});
audio.volume = Number(volume.value);
audio.src = new URL('fourth-signature/assets/audio/raven-dark-pop-intimate-revised.mp3', root).href;
audio.loop = true;
audio.muted = false;
const initial = route(location.href) || new URL('raven/', root);
updateHistory(initial, false);
show(initial);
sync();
play();
