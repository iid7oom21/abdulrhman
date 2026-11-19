/* Image-only recovery for the static opening. No game state, storage or API access. */
(() => {
  'use strict';
  const records = [], scenes = new Map(), TIMEOUT = 20000;
  const sceneIds = new Set(['doorway-threshold', 'unsigned-paper', 'quiet-ending', 'private-notebook']);
  const copy = {
    ar: { label:'صورة توضيحية', failed:'تعذّر تحميل الصورة التوضيحية. يمكنك متابعة قراءة النص.',
      timeout:'طال تحميل الصورة التوضيحية. يمكنك إعادة المحاولة أو متابعة القراءة.',
      retry:'أعد تحميل الصورة', loading:'جارٍ تحميل الصورة…' },
    en: { label:'Illustration', failed:'The illustration could not load. You can continue reading the text.',
      timeout:'The illustration is taking longer than expected. You can retry or continue reading.',
      retry:'Retry image', loading:'Loading image…' },
  };
  const words = () => copy[document.documentElement.lang === 'en' ? 'en' : 'ar'];
  const roots = [new URL('./assets/', location.href).pathname, new URL('../assets/images/deleted-name/', location.href).pathname];
  function source(value) {
    try {
      const url = new URL(value, location.href);
      return url.origin === location.origin && roots.some(root => url.pathname.startsWith(root)) &&
        /\.(?:webp|png|jpg)$/.test(url.pathname) ? url.href : null;
    } catch { return null; }
  }
  const element = (tag, className) => { const node = document.createElement(tag); node.className = className; return node; };
  function paint(record) {
    const c = words(), visible = ['failed', 'retrying'].includes(record.state);
    record.wrapper.dataset.artState = record.state;
    record.wrapper.setAttribute('aria-label', c.label);
    record.notice.hidden = !visible;
    record.status.textContent = visible ? c[record.state === 'retrying' ? 'loading' : record.timedOut ? 'timeout' : 'failed'] : '';
    record.button.textContent = c[record.state === 'retrying' ? 'loading' : 'retry'];
    record.button.setAttribute('aria-disabled', String(record.state === 'retrying'));
  }
  function deadline(record) {
    clearTimeout(record.timer);
    record.timer = setTimeout(() => {
      if (!['pending', 'retrying'].includes(record.state)) return;
      record.timer = null; record.state = 'failed'; record.timedOut = true; paint(record);
    }, TIMEOUT);
  }
  // Closed disclosures and off-screen lazy illustrations do not time out before
  // the reader reaches them. A retry always starts its own bounded deadline.
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      const record = records.find(item => item.wrapper === entry.target);
      if (record?.state === 'pending' && !record.timer) deadline(record);
    }
  }) : null;
  function listen(record, image) {
    image.addEventListener('error', () => {
      if (record.image !== image) return;
      clearTimeout(record.timer); record.timer = null;
      record.state = 'failed'; record.timedOut = false; paint(record);
    });
    image.addEventListener('load', () => {
      if (record.image !== image || !image.naturalWidth) return;
      clearTimeout(record.timer); record.timer = null; observer?.unobserve(record.wrapper);
      // Move focus before hiding the successfully used retry control.
      if (record.button === document.activeElement && record.wrapper.isConnected) record.wrapper.focus({preventScroll:true});
      record.state = 'loaded'; record.timedOut = false; paint(record);
    });
  }
  function retry(record) {
    if (record.state !== 'failed' || !record.wrapper.isConnected) return;
    record.state = 'retrying'; record.timedOut = false;
    record.status.setAttribute('aria-live', 'polite');
    const image = document.createElement('img');
    for (const name of ['alt', 'width', 'height', 'decoding']) {
      if (record.image.hasAttribute(name)) image.setAttribute(name, record.image.getAttribute(name));
    }
    image.loading = 'eager';
    const previous = record.image; record.image = image;
    listen(record, image); previous.replaceWith(image);
    const url = new URL(record.original);
    url.searchParams.set('rvn_art_retry', Date.now() + '-' + (++record.attempt));
    paint(record); deadline(record); image.src = url.href;
  }
  function manage(frame, id) {
    const image = frame.querySelector('img'), original = source(image?.getAttribute('src'));
    if (!image || !original) return frame;
    const wrapper = element('div', 'dn-artwork');
    wrapper.tabIndex = -1; wrapper.setAttribute('role', 'group');
    if (id) wrapper.dataset.artId = id;
    const notice = element('div', 'dn-art-notice'), status = element('p', 'dn-art-status');
    const button = element('button', 'dn-art-retry'); button.type = 'button';
    button.id = 'dn-art-retry-' + records.length;
    status.id = 'dn-art-status-' + records.length;
    button.setAttribute('aria-describedby', status.id);
    notice.append(status, button);
    frame.before(wrapper); wrapper.append(frame, notice);
    const record = {wrapper, image, original, notice, status, button, timer:null, attempt:0, timedOut:false,
      state:image.complete ? (image.naturalWidth ? 'loaded' : 'failed') : 'pending'};
    records.push(record); button.addEventListener('click', () => retry(record)); listen(record, image); paint(record);
    if (record.state === 'pending') observer?.observe(wrapper);
    return wrapper;
  }
  // These are decorative illustrations; controls are siblings of aria-hidden
  // frames, never descendants. Character names and written sources stay visible.
  document.querySelectorAll('.dnVisual, .raven-scene-art, .cast-portrait').forEach(frame => {
    const id = frame.dataset.sceneArt;
    // The optional script can arrive after the reader has already advanced.
    // Adopt those existing figures, including their current atlas row.
    const match = source(frame.querySelector('img')?.getAttribute('src'))?.match(/\/(case|investigation)-scenes-v1\.webp(?:\?|$)/);
    const row = -parseFloat(frame.style.getPropertyValue('--raven-scene-top') || '0') / 100;
    const wrapper = manage(frame, id);
    if (sceneIds.has(id) && match && Number.isInteger(row) && row >= 0 && row <= 2) scenes.set([id,match[1],row].join(':'), wrapper);
  });
  window.RavenOpeningArtwork = Object.freeze({
    scene(id, atlas, row) {
      if (!sceneIds.has(id) || !['case','investigation'].includes(atlas) || !Number.isInteger(row) || row < 0 || row > 2) return null;
      const key = [id, atlas, row].join(':');
      if (scenes.has(key)) return scenes.get(key);
      const frame = element('figure', 'raven-scene-art'); frame.dataset.sceneArt = id;
      frame.setAttribute('aria-hidden', 'true'); frame.style.setProperty('--raven-scene-top', -100 * row + '%');
      const image = document.createElement('img'); image.width = 1024; image.height = 1536;
      image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
      image.src = './assets/scenes/' + atlas + '-scenes-v1.webp'; frame.append(image);
      const wrapper = manage(frame, id); scenes.set(key, wrapper); return wrapper;
    },
  });
  // Reuse dynamic illustration nodes across language/choice/notebook renders.
  // Only their labels change; changing language is never a network retry.
  new MutationObserver(() => records.forEach(paint)).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
  window.addEventListener('pagehide', () => {
    for (const record of records) {
      clearTimeout(record.timer); record.timer = null;
      if (record.state === 'retrying') { record.state = 'failed'; record.timedOut = true; paint(record); }
    }
  });
  window.addEventListener('pageshow', () => {
    // A page restored from the browser's back/forward cache keeps its DOM and
    // pending images. Request fresh visibility checks, not new image requests.
    for (const record of records) if (record.state === 'pending') {
      observer?.unobserve(record.wrapper); observer?.observe(record.wrapper);
    }
  });
})();
