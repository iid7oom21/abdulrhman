// Same-origin content pages delegate navigation and sound to their persistent host.
(() => {
  let host;
  try {
    if (window.parent === window || window.parent.location.origin !== location.origin) return;
    host = window.parent.RavenSite;
  } catch {
    // A standalone page may also be embedded by an unrelated origin.
    return;
  }
  if (!host || !['navigate', 'childRoute', 'ready'].every(name => typeof host[name] === 'function')) return;
  const snapshot = () => ({
    x: scrollX,
    y: scrollY,
    focusId: document.activeElement?.id || null,
  });
  const remember = () => {
    if (!restoringView) host.rememberView?.(window, snapshot());
  };
  const sameOriginUrl = value => {
    try {
      const url = new URL(value, location.href);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === location.origin ? url : null;
    } catch { return null; }
  };
  let viewFrame = 0;
  let restoringView = false;
  let restoreId = 0;
  const scheduleRemember = () => {
    if (viewFrame || restoringView) return;
    viewFrame = requestAnimationFrame(() => {
      viewFrame = 0;
      if (!restoringView) remember();
    });
  };
  const replace = history.replaceState.bind(history);
  const publicUrl = new URL(location.href);
  publicUrl.pathname = publicUrl.pathname.replace(/content\.html$/, '');
  replace(history.state, '', publicUrl);
  history.pushState = (state, unused, value) => {
    const url = new URL(value || location.href, location.href);
    remember();
    replace(state, '', url);
    host.childRoute(url.href, state, true);
  };
  history.replaceState = (state, unused, value) => {
    const url = new URL(value || location.href, location.href);
    replace(state, '', url);
    host.childRoute(url.href, state);
  };
  window.RavenPage = {
    snapshot,
    restore(value, state, view) {
      const id = ++restoreId;
      const previous = location.href;
      restoringView = Boolean(view);
      replace(state, '', value);
      dispatchEvent(new PopStateEvent('popstate', { state }));
      if (new URL(previous).hash !== location.hash) {
        dispatchEvent(new HashChangeEvent('hashchange', { oldURL: previous, newURL: location.href }));
        let id = location.hash.slice(1);
        try { id = decodeURIComponent(id); } catch { /* Keep malformed fragments literal. */ }
        if (!view) {
          if (id) document.getElementById(id)?.scrollIntoView();
          else window.scrollTo(0, 0);
        }
      }
      if (view) {
        requestAnimationFrame(() => {
          if (id !== restoreId) return;
          const target = typeof view.focusId === 'string' && document.getElementById(view.focusId);
          if (target && target.getClientRects().length) target.focus?.({ preventScroll: true });
          window.scrollTo({
            left: Number.isFinite(view.x) ? view.x : 0,
            top: Number.isFinite(view.y) ? view.y : 0,
            behavior: 'instant',
          });
          restoringView = false;
          remember();
        });
      }
    }
  };
  window.ravenNavigate = value => {
    const target = sameOriginUrl(value);
    if (!target) return false;
    remember();
    return host.navigate(target.href);
  };
  document.addEventListener('click', event => {
    host.gesture?.(event);
    const link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        link.hasAttribute('download') || (link.target && link.target !== '_self') ||
        link.matches('[data-raven-language], [data-rvn-lang]')) return;
    const target = new URL(link.href);
    if (!['http:', 'https:'].includes(target.protocol)) {
      if (['javascript:', 'data:', 'vbscript:'].includes(target.protocol)) event.preventDefault();
      return;
    }
    if (target.origin !== location.origin) {
      if (!link.target) link.target = '_top';
      return;
    }
    // Local anchors keep the page's own drawer, focus and scroll behavior.
    if (target.pathname === location.pathname && target.search === location.search) return;
    remember();
    if (host.navigate(target.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (!link.target) link.target = '_top';
  }, true);
  document.addEventListener('keydown', event => host.gesture?.(event));
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-music-toggle]')) host.toggleMusic?.();
  });
  const syncRoute = () => host.childRoute(location.href, history.state);
  addEventListener('hashchange', syncRoute);
  addEventListener('popstate', syncRoute);
  addEventListener('scroll', scheduleRemember, { passive: true });
  document.addEventListener('focusin', scheduleRemember);
  document.addEventListener('DOMContentLoaded', () => host.ready(window), { once: true });
  document.addEventListener('raven:language', () => host.ready(window));
})();
