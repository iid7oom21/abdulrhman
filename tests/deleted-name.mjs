// RAVEN «الاسم المحذوف» player page: checks against a served repository root.
// Run: RAVEN_REDESIGN_URL=http://127.0.0.1:8080/ node tests/deleted-name.mjs
// The page lives inside the persistent shell (one soundtrack), keeps the author's
// solution off the public page, reads in Arabic and English, and fits phone widths.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_TEST_MODULE || '@playwright/test');
const base = (process.env.RAVEN_REDESIGN_URL || 'http://127.0.0.1:8080/').replace(/\/?$/, '/');

// Words that would give away the solution or its clues. None may appear on the public page.
const SPOILERS = ['الفاعل', 'فاعلة', 'اسمي', 'الشال', 'شال', 'تسبق', 'يسبق', 'دقايق', 'دقائق', 'سجل الباب',
  'اعتداء', 'اعتدى', 'همزة', 'culprit', 'shawl', 'minutes', 'door log', 'attack', 'clock'];

const browser = await chromium.launch({ headless: true });
const newContext = async (width = 390, height = 844) => {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', locale: 'ar-SA' });
  await context.addInitScript(() => { try { sessionStorage.setItem('raven_studio_ident_v1', '1'); } catch (_) {} });
  return context;
};
const frameOf = page => page.frameLocator('#site-content');
const childFrame = async page => (await page.locator('#site-content').elementHandle()).contentFrame();
try {
  // 1. The route opens inside the shell, with one soundtrack and no entry gate.
  {
    const context = await newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(base + 'raven/deleted-name/', { waitUntil: 'domcontentloaded' });
    await frameOf(page).locator('h1').waitFor();
    await page.waitForFunction(() => document.title === 'RAVEN — الاسم المحذوف');
    assert.equal(await frameOf(page).locator('h1').textContent(), 'الاسم المحذوف');
    assert.match((await childFrame(page)).url(), /\/raven\/deleted-name\/(content\.html)?(\?|$)/);
    assert.equal(await page.locator('audio').count(), 1, 'the shell keeps exactly one audio element');
    assert.equal(await frameOf(page).locator('audio, video').count(), 0, 'the page adds no media element');
    assert.equal(await page.locator('#archive-entry-gate').count(), 0, 'the studio intro belongs to the homepage only');
    const text = (await frameOf(page).locator('body').innerText()) + await (await childFrame(page)).evaluate(() => document.head.innerHTML);
    for (const word of SPOILERS) assert.ok(!text.includes(word), `spoiler word on the public page: ${word}`);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: route opens in the shell with one soundtrack, no entry gate, no spoiler words');
  }

  // 2. From the homepage, «ادخل القضية» navigates inside the shell and keeps the same audio element.
  {
    const context = await newContext();
    const page = await context.newPage();
    await page.goto(base + 'raven/', { waitUntil: 'domcontentloaded' });
    await frameOf(page).locator('#dialogue-preview a[href="./deleted-name/"]').waitFor();
    await page.evaluate(() => { document.querySelector('audio').dataset.marker = 'kept'; });
    await frameOf(page).locator('#dialogue-preview a[href="./deleted-name/"]').click();
    await page.waitForURL(/\/raven\/deleted-name\/$/);
    await frameOf(page).locator('h1').waitFor();
    assert.equal(await page.evaluate(() => document.querySelector('audio').dataset.marker), 'kept');
    assert.equal(await page.locator('audio').count(), 1);
    // The brand link returns to the homepage, still inside the shell.
    await frameOf(page).locator('a.brand').click();
    await page.waitForURL(/\/raven\/$/);
    assert.equal(await page.evaluate(() => document.querySelector('audio').dataset.marker), 'kept');
    await context.close();
    console.log('PASS: homepage → case → homepage stays in the shell with the same soundtrack');
  }

  // 2b. An English reader stays in English: homepage section, into the case, and back.
  {
    const context = await newContext();
    const page = await context.newPage();
    await page.goto(base + 'raven/?lang=en', { waitUntil: 'domcontentloaded' });
    const enter = frameOf(page).locator('#dialogue-preview [data-dn-k="enter"]');
    await enter.waitFor();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await enter.textContent(), 'Enter the case');
    assert.equal(await frameOf(page).locator('#dialogue-preview h2').textContent(), 'RAVEN — The Deleted Name');
    assert.equal(await enter.getAttribute('href'), './deleted-name/?lang=en');
    await enter.click();
    await page.waitForURL(/\/raven\/deleted-name\/\?lang=en$/);
    await frameOf(page).locator('h1', { hasText: 'The Deleted Name' }).waitFor({ timeout: 8000 });
    await page.waitForFunction(() => document.documentElement.lang === 'en' && document.title === 'RAVEN — The Deleted Name');
    await frameOf(page).locator('a.brand').click();
    await page.waitForURL(/\/raven\/\?lang=en$/);
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await context.close();
    console.log('PASS: English homepage → case → homepage keeps English, section translated');
  }

  // 2c. Without ?lang, the case follows the language the site last stored.
  {
    const context = await newContext();
    await context.addInitScript(() => { try { if (!sessionStorage.getItem('dn-seeded')) { localStorage.setItem('raven_language', 'en'); sessionStorage.setItem('dn-seeded', '1'); } } catch (_) {} });
    const page = await context.newPage();
    await page.goto(base + 'raven/deleted-name/content.html', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('h1').textContent(), 'The Deleted Name');
    assert.match(page.url(), /lang=en/);
    await context.close();
    console.log('PASS: stored English is used when the URL has no language');
  }

  // 3. English, from the URL and from the in-page switch.
  {
    const context = await newContext();
    const page = await context.newPage();
    await page.goto(base + 'raven/deleted-name/?lang=en', { waitUntil: 'domcontentloaded' });
    await frameOf(page).locator('h1').waitFor();
    await page.waitForFunction(() => document.documentElement.lang === 'en' && document.dir === 'ltr');
    assert.equal(await frameOf(page).locator('h1').textContent(), 'The Deleted Name');
    assert.equal(await page.title(), 'RAVEN — The Deleted Name');
    await frameOf(page).locator('#lang-switch').click();
    await page.waitForFunction(() => document.documentElement.lang === 'ar' && !location.search.includes('lang=en'));
    assert.equal(await frameOf(page).locator('h1').textContent(), 'الاسم المحذوف');
    await frameOf(page).locator('#lang-switch').click();
    await page.waitForFunction(() => location.search.includes('lang=en'));
    const text = await frameOf(page).locator('body').innerText();
    for (const word of SPOILERS) assert.ok(!text.toLowerCase().includes(word), `spoiler word in English: ${word}`);
    await context.close();
    console.log('PASS: English from the URL and the switch; the shell follows the language');
  }

  // 4. Layout at phone and desktop widths, in both languages.
  for (const [width, height] of [[320, 640], [390, 844], [1366, 900]]) {
    for (const lang of ['', '?lang=en']) {
      const context = await newContext(width, height);
      const page = await context.newPage();
      await page.goto(base + 'raven/deleted-name/content.html' + lang, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const small = [];
        for (const el of document.querySelectorAll('body *')) {
          if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
          const cs = getComputedStyle(el), r = el.getBoundingClientRect();
          if (!r.width || !r.height || cs.visibility === 'hidden') continue;
          if (parseFloat(cs.fontSize) < 12) small.push(el.tagName);
        }
        const tap = [...document.querySelectorAll('a.btn, .top a')].filter(a => a.getBoundingClientRect().height < 44).length;
        return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, small, tap };
      });
      assert.equal(m.overflow, 0, `${width}px ${lang}: horizontal scroll`);
      assert.deepEqual(m.small, [], `${width}px ${lang}: text under 12px`);
      assert.equal(m.tap, 0, `${width}px ${lang}: tap target under 44px`);
      await context.close();
    }
  }
  console.log('PASS: 320/390/1366 in Arabic and English — no horizontal scroll, text ≥12px, tap targets ≥44px');

  // 4b. The two scene images load, keep their ratio, and carry no text of their own.
  {
    const context = await newContext(390, 844);
    const page = await context.newPage();
    await page.goto(base + 'raven/deleted-name/content.html', { waitUntil: 'domcontentloaded' });
    const imgs = page.locator('.dnVisual img');
    assert.equal(await imgs.count(), 2);
    for (let i = 0; i < 2; i++) {
      await imgs.nth(i).scrollIntoViewIfNeeded();
      await page.waitForFunction(el => el.complete && el.naturalWidth > 0, await imgs.nth(i).elementHandle());
      const r = await imgs.nth(i).evaluate(el => ({ w: el.naturalWidth, h: el.naturalHeight, alt: el.getAttribute('alt'), box: el.getBoundingClientRect().width }));
      assert.ok(Math.abs(r.w / r.h - 16 / 9) < 0.02, `image ${i} is not 16:9`);
      assert.equal(r.alt, '', 'scene images are decorative');
      assert.ok(r.box <= 390, 'image fits the screen');
    }
    await context.close();
    console.log('PASS: the record and arrival images load at 16:9 and fit the screen');
  }

  // 5. The site copy of the dialogue preview shows Mati's help box once.
  {
    const context = await newContext();
    const page = await context.newPage();
    await page.goto(base + 'raven/dialogue/', { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('#player-help').count(), 1);
    assert.equal(await page.locator('#player-help li').count(), 3);
    assert.equal(await page.locator('#player-help h2').textContent(), 'كيف تسأل في RAVEN');
    await context.close();
    console.log('PASS: dialogue preview shows the help box');
  }
  console.log('\nALL CHECKS PASSED');
} finally {
  await browser.close();
}
