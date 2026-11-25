// The host owns one soundtrack while the content document changes.
import { createSoundtrack } from './site-audio.js?v=mati-1.0.1';
import { createEntryGate } from './site-entry.js?v=home-programme-1';

const root = new URL('./', import.meta.url);
// History navigation changes the document base even though the shell stays mounted.
const icon = document.querySelector('link[rel="icon"]');
if (icon) icon.href = new URL(icon.getAttribute('href'), document.baseURI).href;
const contentVersion = new URL(import.meta.url).searchParams.get('v');
const frame = document.querySelector('#site-content');
const recovery = document.querySelector('#site-recovery');
const loadMessage = document.querySelector('#site-load-message');
const retry = document.querySelector('#site-retry');
const direct = document.querySelector('#site-direct');
const soundtrack = createSoundtrack(root);
const musicSettings = document.querySelector('#music-settings');
musicSettings?.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !musicSettings.open) return;
  musicSettings.open = false;
  musicSettings.querySelector('summary')?.focus();
});
const homePath = new URL('raven/', root).pathname;
const episodesPath = new URL('raven/episodes/', root).pathname;
const routes = [homePath, episodesPath, ...['raven/deleted-name/', 'raven/deleted-name/play/', 'raven/investigation-lab/', 'raven/after-show/'].map(path => new URL(path, root).pathname)];
const pageMetadata = [
  'meta[name="description"]', 'meta[property^="og:"]', 'meta[name^="twitter:"]',
  'link[rel="canonical"]', 'link[rel="alternate"][hreflang]',
  'script[type="application/ld+json"]'
].join(',');
let destination;
let loadedDocument = null;
let departingDocument = null;
let pendingPath = null;
let restoring = false;
let reconciling = false;
let loadTimer;
let loadFailed = false;
let entryGate = null;
let pendingFilm = null;

function route(value) {
  let url;
  try { url = new URL(value, location.href); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== location.origin) return null;
  const path = url.pathname.replace(/(?:index|content)\.html$/, '').replace(/\/?$/, '/');
  if (!routes.includes(path)) return null;
  url.pathname = path;
  const oldFilmsAnchor = ['#films', '#episodeModal'].includes(url.hash);
  if (path === homePath && (oldFilmsAnchor || url.searchParams.has('episode'))) url.pathname = episodesPath;
  if (url.pathname === episodesPath) {
    if (oldFilmsAnchor) url.hash = '';
    const episode = Number(url.searchParams.get('episode'));
    if (![1, 2, 3].includes(episode)) url.searchParams.delete('episode');
  }
  return url;
}

function currentChild() {
  try {
    return !pendingPath && loadedDocument && frame.contentDocument === loadedDocument;
  } catch { return false; }
}

function syncLoading() {
  const english = document.documentElement.lang === 'en';
  loadMessage.textContent = loadFailed
    ? (english ? 'The page could not finish loading.' : 'تعذّر إكمال تحميل الصفحة.')
    : (english ? 'Opening the page…' : 'جارٍ فتح الصفحة…');
  retry.textContent = english ? 'Try again' : 'أعد المحاولة';
  direct.textContent = english ? 'Open the page directly' : 'افتح الصفحة مباشرة';
}

function rememberView(child, view) {
  if (restoring || !currentChild() || child !== frame.contentWindow || !view) return;
  const x = Number.isFinite(view.x) ? view.x : 0;
  const y = Number.isFinite(view.y) ? view.y : 0;
  const focusId = typeof view.focusId === 'string' ? view.focusId : '';
  history.replaceState({ ...history.state, view: { x, y, focusId } }, '', location.href);
}

function saveView() {
  if (currentChild()) rememberView(frame.contentWindow, frame.contentWindow.RavenPage?.snapshot());
}

function updateHistory(url, push, childState = null, view = null) {
  history[push ? 'pushState' : 'replaceState']({ ravenShell: true, childState, view }, '', url);
}

function restoreChild() {
  restoring = true;
  frame.contentWindow.RavenPage.restore(
    destination.url.href, destination.childState, destination.view
  );
  // Let the child restore its scroll/focus before saving its next position.
  requestAnimationFrame(() => requestAnimationFrame(() => { restoring = false; }));
}

function show(url, childState = null, view = null, force = false, focus = false) {
  destination = { url, childState, view, focus };
  const content = new URL(url);
  content.pathname += 'content.html';
  if (contentVersion) content.searchParams.set('v', contentVersion);
  direct.href = content.href;
  if (!force && currentChild() && route(frame.contentWindow.location.href)?.pathname === url.pathname) {
    restoreChild();
    return;
  }
  // While a document is loading, retain the latest requested hash and query.
  if (!force && pendingPath === url.pathname) return;
  document.body.classList.remove('is-watching');
  departingDocument = frame.contentDocument;
  soundtrack.setDepth?.(0, null);
  loadedDocument = null;
  pendingPath = url.pathname;
  departingDocument?.querySelectorAll('audio, video').forEach(media => media.pause());
  soundtrack.setMediaActive(false);
  frame.title = 'RAVEN — الرئيسية';
  loadFailed = false;
  retry.hidden = true;
  recovery.hidden = false;
  recovery.classList.add('is-loading');
  syncLoading();
  clearTimeout(loadTimer);
  const started = Date.now();
  const expire = () => {
    // On a slow connection the page can be parsed and readable long before its
    // deferred scripts finish. Keep the small loading note over such a page
    // instead of covering it with a failure; fail only if it never gets there.
    let parsed = false;
    try {
      const doc = frame.contentDocument;
      parsed = Boolean(doc) && doc !== departingDocument && doc.readyState !== 'loading' &&
        route(frame.contentWindow.location.href)?.pathname === url.pathname;
    } catch { parsed = false; }
    if (parsed && Date.now() - started < 60000) {
      loadTimer = setTimeout(expire, 4000);
      return;
    }
    loadFailed = true;
    retry.hidden = false;
    recovery.classList.remove('is-loading');
    syncLoading();
  };
  loadTimer = setTimeout(expire, 12000);
  frame.contentWindow.location.replace(content.href);
}

// First let the gallery own the child document in the browser's joint history.
// Once it is ready, opening the selected film adds the playable entry above it.
function arriveViaGallery(url, pushGallery) {
  pendingFilm = url;
  const gallery = new URL(url);
  gallery.searchParams.delete('episode');
  updateHistory(gallery, pushGallery);
  show(gallery);
}

function navigate(value) {
  const url = route(value);
  if (!url) return false;
  pendingFilm = null;
  if (url.href === location.href) return true;
  saveView();
  let state = null;
  if (url.pathname === episodesPath && url.searchParams.has('episode')) {
    if (destination.url.pathname !== episodesPath) {
      arriveViaGallery(url, true);
      return true;
    }
    state = {rvnTheaterEntry:true};
    updateHistory(url, !destination.url.searchParams.has('episode'), state);
  } else updateHistory(url, true);
  show(url, state, null, false, true);
  return true;
}

window.RavenSite = {
  navigate,
  gesture: soundtrack.gesture,
  toggleMusic: soundtrack.toggleMusic,
  state: soundtrack.state,
  setMediaActive(child, source, active) {
    if (currentChild() && child === frame.contentWindow && source === loadedDocument) {
      soundtrack.setMediaActive(active);
    }
  },
  setWatching(child, open) {
    if (currentChild() && child === frame.contentWindow) {
      document.body.classList.toggle('is-watching', Boolean(open));
    }
  },
  setDepth(child, value) {
    if (currentChild() && child === frame.contentWindow) soundtrack.setDepth?.(value, frame.contentDocument);
  },
  pulse(child) {
    if (currentChild() && child === frame.contentWindow) soundtrack.pulse?.();
  },
  rememberView,
  childRoute(value, state, push = false) {
    const url = route(value);
    if (!currentChild() || url?.pathname !== destination.url.pathname) return;
    if (push) saveView();
    updateHistory(url, push, state, push ? null : history.state?.view);
    destination.url = url;
    destination.childState = state;
  },
  ready(child) {
    if (reconciling || child !== frame.contentWindow) return;
    const source = child.document;
    if (source === departingDocument || source.readyState === 'loading' ||
        route(child.location.href)?.pathname !== destination.url.pathname || !child.RavenPage) return;
    reconciling = true;
    const arrived = source !== loadedDocument;
    loadedDocument = source;
    pendingPath = null;
    departingDocument = null;
    if (arrived && (child.location.href !== destination.url.href || destination.view)) restoreChild();
    document.title = source.title;
    document.documentElement.lang = source.documentElement.lang;
    document.documentElement.dir = source.documentElement.dir;
    frame.title = source.title;
    document.head.querySelectorAll(pageMetadata).forEach(node => node.remove());
    source.head.querySelectorAll(pageMetadata).forEach(node => document.head.appendChild(node.cloneNode(true)));
    clearTimeout(loadTimer);
    recovery.hidden = true;
    loadFailed = false;
    syncLoading();
    soundtrack.sync();
    document.body.classList.toggle('is-watching', source.body.classList.contains('rvnViewing'));
    entryGate?.sync();
    if (arrived && destination.focus && !destination.view &&
        !source.body.classList.contains('rvnViewing') && !entryGate?.open && !document.activeElement?.closest('.site-player')) {
      const main = source.querySelector('main');
      if (main) {
        if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
        main.focus({ preventScroll: true });
      }
    }
    reconciling = false;
    if (pendingFilm && destination.url.pathname === episodesPath) navigate(pendingFilm.href);
  }
};

retry.addEventListener('click', () => show(destination.url, destination.childState, destination.view, true));
history.scrollRestoration = 'manual';
window.addEventListener('popstate', event => {
  pendingFilm = null;
  const url = route(location.href);
  if (url) show(url, event.state?.childState, event.state?.view, false, true);
});
const initial = route(location.href) || new URL('raven/', root);
if (initial.pathname === episodesPath && initial.searchParams.has('episode') && !history.state?.ravenShell) arriveViaGallery(initial, false);
else {
  updateHistory(initial, false, history.state?.childState, history.state?.view);
  show(initial, history.state?.childState, history.state?.view);
}
entryGate = createEntryGate({
  root,
  navigate,
  show: initial.pathname === homePath && !initial.hash,
  onEnter: soundtrack.enter,
  onClose() {
    destination.focus = true;
    if (!currentChild()) return;
    const main = frame.contentDocument.querySelector('main');
    if (main) {
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }
  }
});
