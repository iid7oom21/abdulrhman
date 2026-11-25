(() => {
  const copy = {
    library: ['الحلقات', 'Episodes'], genre: ['غموض نفسي', 'Psychological mystery'],
    first: ['شاهد الحلقة الأولى', 'Watch episode one'],
    ep1: ['الحلقة الأولى', 'Episode one'], ep2: ['الحلقة الثانية', 'Episode two'],
    ep3: ['الحلقة الثالثة', 'Episode three'], behind: ['خلف الكادر', 'Behind the Frame'],
    return: ['العودة إلى رئيسية RAVEN', 'Back to RAVEN'], home: ['رئيسية RAVEN', 'RAVEN home'],
    afterEpisode: ['افتح قضية الاسم المحذوف', 'Open The Deleted Name'],
    nav: ['التنقل', 'Navigation'], language: ['اللغة', 'Language'], skip: ['انتقل إلى الحلقات', 'Skip to episodes']
  };
  function translate() {
    const en = document.documentElement.lang === 'en' ? 1 : 0;
    document.title = ['حلقات RAVEN 17 · RAVEN', 'RAVEN 17 Episodes · RAVEN'][en];
    document.querySelectorAll('[data-gallery-copy]').forEach(node => {
      node.textContent = copy[node.dataset.galleryCopy][en];
    });
    document.querySelectorAll('[data-gallery-label]').forEach(node => {
      node.setAttribute('aria-label', copy[node.dataset.galleryLabel][en]);
    });
    document.querySelectorAll('[data-raven-language]').forEach(node => {
      if (node.dataset.ravenLanguage === document.documentElement.lang) node.setAttribute('aria-current','page');
      else node.removeAttribute('aria-current');
    });
  }
  for (const card of document.querySelectorAll('[data-visual-episode], [data-gallery-play]')) {
    const id = Number(card.dataset.visualEpisode || card.dataset.galleryPlay);
    card.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (typeof window.openEpisodes === 'function') window.openEpisodes(event, id);
    });
  }
  document.addEventListener('raven:language', translate);
  translate();
})();
