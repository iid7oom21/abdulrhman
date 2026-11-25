import {mount, element, link} from '../night-shell.js';

import {items} from './catalog.js';

mount({
  id: 'ink-studio',
  title: ['ليالي الحبر', 'Ink Nights'],
  intro: ['اختر كيف تقضي الليلة في مرفأ مرسوم بالحبر.', 'Choose how to spend a night in an ink-drawn harbour.'],
  render({root, t, url}) {
    const programme = element('div', null, 'ink-programme');
    for (const [index, item] of items.entries()) {
      const card = link('', url(item.page + '.html'), 'ink-listing');
      card.dataset.inkRoute = item.page.slice(4);
      const image = element('img');
      image.alt = '';
      image.width = 960;
      image.height = 540;
      image.loading = index === 0 ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => { image.hidden = true; }, {once:true});
      image.src = './ink/art/' + item.cover + '.webp';
      const copy = element('div', null, 'ink-listing-copy');
      copy.append(element('h2', t(...item.title)), element('span', t(...item.action), 'ink-entry-action'));
      card.append(image, copy);
      programme.append(card);
    }
    root.append(programme);
  }
});
