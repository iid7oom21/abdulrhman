// Same-origin content pages delegate navigation and sound to their persistent host.
(() => {
  const host = window.parent !== window && window.parent.RavenSite;
  if (!host) return;
  const replace = history.replaceState.bind(history);
  const publicUrl = new URL(location.href);
  publicUrl.pathname = publicUrl.pathname.replace(/content\.html$/, '');
  replace(history.state, '', publicUrl);
  history.pushState = (state, unused, value) => {
    const url = new URL(value || location.href, location.href);
    replace(state, '', url);
    host.childRoute(url.href, state, true);
  };
  history.replaceState = (state, unused, value) => {
    const url = new URL(value || location.href, location.href);
    replace(state, '', url);
    host.childRoute(url.href, state);
  };
  window.RavenPage = {
    restore(value, state) {
      const previous = location.href;
      replace(state, '', value);
      dispatchEvent(new PopStateEvent('popstate', { state }));
      if (new URL(previous).hash !== location.hash) {
        dispatchEvent(new HashChangeEvent('hashchange', { oldURL: previous, newURL: location.href }));
        const id = decodeURIComponent(location.hash.slice(1));
        if (id) document.getElementById(id)?.scrollIntoView();
        else window.scrollTo(0, 0);
      }
    }
  };
  window.ravenNavigate = value => host.navigate(new URL(value, location.href).href);
  document.addEventListener('click', event => {
    host.gesture(event);
    const link = event.target.closest?.('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        link.hasAttribute('download') || (link.target && link.target !== '_self') ||
        link.matches('[data-raven-language], [data-rvn-lang]')) return;
    const target = new URL(link.href);
    // Local anchors keep the page's own drawer, focus and scroll behavior.
    if (target.pathname === location.pathname && target.search === location.search) return;
    if (host.navigate(target.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (!link.target) link.target = '_top';
  }, true);
  document.addEventListener('keydown', event => host.gesture(event));
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-music-toggle]')) host.toggleMusic();
  });
  const syncRoute = () => host.childRoute(location.href, history.state);
  addEventListener('hashchange', syncRoute);
  addEventListener('popstate', syncRoute);
  document.addEventListener('DOMContentLoaded', () => host.ready(window), { once: true });
  document.addEventListener('raven:language', () => host.ready(window));
})();
