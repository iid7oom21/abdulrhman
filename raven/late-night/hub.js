import {mount, element, link} from './night-shell.js';
import {activities, sections, extras, featured} from './catalog.js';

const tonight = featured();

function still(id, loading) {
  const image = element('img');
  image.alt = '';
  image.width = 520;
  image.height = 293;
  image.loading = loading;
  image.decoding = 'async';
  image.addEventListener('error', () => { image.hidden = true; }, {once: true});
  image.src = './thumbs/' + id + '.webp?v=cinema';
  return image;
}

mount({
  id: 'hub',
  title: ['آخر الليل', 'Late Night'],
  intro: ['مدينة ساحلية وسينما قديمة. اختر كيف تقضي ليلتك.', 'A coastal town and an old cinema. Choose how to spend the night.'],
  render({root, t, url, lang}) {
    const number = new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-arab' : 'en');
    const duration = value => number.format(value) + ' ' + t('د', 'min');
    const [id, ar, en, minutes, , actionAr, actionEn] = tonight;
    const feature = element('section', null, 'night-feature');
    const lead = element('div');
    const meta = element('p', t('اختيار الليلة', 'Tonight’s pick') + ' · ' + duration(minutes), 'night-feature-meta');
    const title = element('h2', t(ar, en));
    const actions = element('div', null, 'night-feature-actions');
    actions.append(
      link(t(actionAr, actionEn), url(id + '.html'), 'night-cta'),
      link(t('كل التجارب', 'All experiences'), '#catalog', 'night-more')
    );
    lead.append(meta, title, actions);
    feature.append(still(id, 'eager'), lead);
    root.append(feature);

    const nav = element('nav', null, 'night-filters');
    nav.id = 'catalog';
    nav.setAttribute('aria-label', t('أقسام التجارب', 'Experience categories'));
    sections.forEach((name, i) => nav.append(link(t(...name), '#room-' + i)));
    root.append(nav);

    const ink = link('', url('ink-studio.html'), 'night-ink-entry');
    ink.dataset.inkProgram = '';
    const print = element('img');
    print.alt = '';
    print.width = 520;
    print.height = 293;
    print.loading = 'lazy';
    print.addEventListener('error', () => { print.hidden = true; }, {once:true});
    print.src = './ink/art/ferry-pier-print.webp';
    const inkCopy = element('div');
    inkCopy.append(
      element('h2', t('ليالي الحبر', 'Ink Nights')),
      element('span', t('ادخل المرفأ المرسوم', 'Enter the ink-drawn harbour'))
    );
    ink.append(print, inkCopy);
    root.append(ink);

    sections.forEach((name, i) => {
      const section = element('section', null, 'night-room');
      section.id = 'room-' + i;
      const grid = element('div', null, 'night-grid');
      for (const [id, ar, en, minutes, , aa, ae] of activities.filter(item => item[4] === i)) {
        const card = link('', url(id + '.html'), 'night-card');
        const caption = element('div');
        caption.append(element('h3', t(ar, en)), element('small', t(aa, ae) + ' · ' + duration(minutes)));
        card.append(still(id, 'lazy'), caption);
        grid.append(card);
      }
      section.append(element('h2', t(...name)), grid);
      root.append(section);
    });

    const more = element('section', null, 'night-room');
    more.append(element('h2', t('أكمل أمسيتك', 'Continue your evening')));
    const links = element('nav', null, 'night-links');
    for (const [id, ar, en] of extras) links.append(link(t(ar, en), url(id + '.html')));
    links.append(link(t('بعد العرض', 'After the Show'), url('../after-show/')));
    more.append(links);
    root.append(more);
    if (location.hash) requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
  }
});
