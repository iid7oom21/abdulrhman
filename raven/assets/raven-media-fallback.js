/* Keep original artwork when it loads; report only observed preview failures. */
(function () {
  'use strict';
  const gallery = document.querySelector('.rvnVaultGrid');
  const player = document.getElementById('ravenEpisodePlayer');
  const film = document.querySelector('.film.raven');
  const records = [];
  const words = {
    heading: ['معاينات الصور', 'Image previews'],
    preview: ['تعذر تحميل معاينة هذه الصورة.', 'This image preview could not load.'],
    poster: ['تعذر تحميل صورة الغلاف.', 'The cover image could not load.'],
    retry: ['أعد تحميل الصورة', 'Retry image'],
    loading: ['جارٍ تحميل الصورة…', 'Loading image…'],
    film: ['RAVEN 17 · صورة الغلاف', 'RAVEN 17 · cover image']
  };
  const text = key => words[key][document.documentElement.lang === 'en' ? 1 : 0];
  function remoteArtwork(value) {
    try {
      const url = new URL(value, location.href);
      return url.protocol === 'https:' && url.hostname === 'cdn.websitepublisher.ai' && url.pathname.startsWith('/custom/wid25762/');
    } catch (_) { return false; }
  }
  function element(tag, className) {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  }
  const panel = element('div', 'rvnMediaRetries');
  panel.hidden = true;
  const heading = element('p', 'rvnMediaRetriesHeading');
  panel.append(heading);
  gallery?.after(panel);

  function title(record) { return record.anchor?.querySelector('strong')?.textContent || text('film'); }
  function render() {
    heading.textContent = text('heading');
    panel.hidden = !records.some(record => record.state === 'failed' || record.state === 'retrying');
    records.forEach(record => {
      const unavailable = record.state === 'failed' || record.state === 'retrying';
      record.notices.forEach(note => {
        note.hidden = !unavailable;
        note.textContent = unavailable ? text(record.state === 'retrying' ? 'loading' : record.kind) : '';
      });
      record.controls.forEach(({row, label, button, result}) => {
        row.hidden = !unavailable;
        label.textContent = title(record);
        button.textContent = text(record.state === 'retrying' ? 'loading' : 'retry');
        button.setAttribute('aria-label', text('retry') + ': ' + title(record));
        button.setAttribute('aria-disabled', String(record.state === 'retrying'));
        result.textContent = record.attempt && unavailable ? text(record.state === 'retrying' ? 'loading' : record.kind) : '';
      });
    });
  }
  function controls(record, parent) {
    const row = element('div', 'rvnMediaRetryRow');
    const label = element('p', 'rvnMediaRetryLabel');
    const button = element('button', 'rvnMediaRetry');
    const result = element('span', 'rvnMediaRetryResult');
    result.setAttribute('role', 'status');
    result.setAttribute('aria-live', 'polite');
    result.setAttribute('aria-atomic', 'true');
    button.type = 'button';
    button.addEventListener('click', () => {
      if (record.state !== 'failed') return;
      record.state = 'retrying';
      render();
      const retry = new URL(record.original);
      retry.searchParams.set('raven-media-retry', String(++record.attempt));
      record.image.src = retry.href;
    });
    row.append(label, button, result);
    parent.append(row);
    record.controls.push({row, label, button, result});
  }
  function notice(parent) {
    const note = element('p', 'rvnMediaNotice');
    note.hidden = true;
    parent.append(note);
    return note;
  }
  function track(record) {
    record.state = 'pending';
    record.attempt = 0;
    record.controls = [];
    records.push(record);
    controls(record, panel);
    record.image.addEventListener('error', () => {
      record.state = 'failed';
      record.failed();
      render();
    });
    record.image.addEventListener('load', () => {
      if (!record.image.naturalWidth) return;
      const focusedRetry = record.controls.some(({button}) => button === document.activeElement);
      record.state = 'loaded';
      record.loaded();
      if (focusedRetry) {
        const target = record.anchor || (player?.closest('#episodeModal.open') ? player : film);
        target?.focus({preventScroll: true});
      }
      render();
    });
  }

  gallery?.querySelectorAll('a > img').forEach(image => {
    const original = image.getAttribute('src');
    if (!remoteArtwork(original)) return;
    const anchor = image.parentElement;
    const record = {
      image, original, anchor, kind: 'preview', notices: [notice(anchor)],
      failed: () => anchor.classList.add('rvnMediaUnavailable'),
      loaded: () => anchor.classList.remove('rvnMediaUnavailable')
    };
    track(record);
    // A cached error may have arrived before this deferred script ran.
    if (image.complete) {
      record.state = image.naturalWidth ? 'loaded' : 'failed';
      if (!image.naturalWidth) record.failed();
    }
  });

  const originalPoster = player?.getAttribute('poster');
  if (remoteArtwork(originalPoster)) {
    // Posters and CSS backgrounds expose no error event. Probe their shared
    // image once, then retry only after the visitor presses a retry button.
    const image = new Image();
    const screen = player.closest('.rvnScreen');
    player.addEventListener('loadedmetadata', () => screen?.classList.remove('rvnMediaPosterUnavailable'));
    const filmUsesPoster = film && getComputedStyle(film, '::before').backgroundImage.includes(originalPoster);
    const posterPanel = element('div', 'rvnMediaPosterStatus');
    screen?.after(posterPanel);
    const posterNote = notice(posterPanel);
    posterNote.id = 'rvnPosterLoadNotice';
    player.setAttribute('aria-describedby', [player.getAttribute('aria-describedby'), posterNote.id].filter(Boolean).join(' '));
    const notes = [posterNote];
    if (filmUsesPoster) {
      const filmNote = notice(film.querySelector('.filmContent') || film);
      filmNote.id = 'rvnFilmLoadNotice';
      film.setAttribute('aria-describedby', [film.getAttribute('aria-describedby'), filmNote.id].filter(Boolean).join(' '));
      notes.push(filmNote);
    }
    let removedPoster = false;
    const record = {
      image, original: originalPoster, kind: 'poster', notices: notes,
      failed() {
        if (player.getAttribute('poster') === originalPoster) {
          player.removeAttribute('poster');
          removedPoster = true;
          if (player.readyState < 1) screen?.classList.add('rvnMediaPosterUnavailable');
        }
        if (filmUsesPoster) film.classList.add('rvnMediaFilmUnavailable');
      },
      loaded() {
        if (removedPoster && !player.hasAttribute('poster')) {
          player.poster = image.src;
          removedPoster = false;
          screen?.classList.remove('rvnMediaPosterUnavailable');
        }
        if (filmUsesPoster) {
          if (record.attempt) film.style.setProperty('--rvn-recovered-film', 'url("' + image.src + '")');
          film.classList.remove('rvnMediaFilmUnavailable');
        }
      }
    };
    track(record);
    controls(record, posterPanel);
    image.src = originalPoster;
  }
  document.addEventListener('raven:language', render);
  render();
})();
