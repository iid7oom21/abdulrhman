// node --test tests/character-portraits.cjs
// Optional: CHROMIUM_PATH, RAVEN_PORTRAIT_SCREENSHOT_DIR (keep screenshots outside the site tree).
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const characters = ['victor', 'claire', 'jonas', 'mateo', 'elena', 'noah'];
const names = {
  ar: ['فيكتور', 'كلير', 'يوناس', 'ماتيو', 'إيلينا', 'نوح'],
  en: ['Victor', 'Claire', 'Jonas', 'Mateo', 'Elena', 'Noah']
};
const descriptions = {
  ar: ['صاحب التكليف. ما رجع للقهوة.', 'رتّبت الدعوات والمقاعد.', 'يطلب مساعدتك.', 'أول من وصل للمكتبة.', 'ضيفة على العشاء.', 'ضيف على العشاء.'],
  en: ['Gave you the assignment. Never came back for coffee.', 'Arranged the invitations and the seating.', 'Asks for your help.', 'First to reach the library.', 'A guest at dinner.', 'A guest at dinner.']
};

test('character portraits stay paired with approved names across language and screen sizes', async t => {
  const server = http.createServer((request, response) => {
    let pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403); return response.end(); }
    const mime = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.webp':'image/webp'};
    try { response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); response.end(fs.readFileSync(file)); }
    catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
  t.after(async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); });

  for (const width of [1280, 390, 320]) await t.test(width + 'px: six loaded portraits survive AR → EN → AR inside the single player', async () => {
    const context = await browser.newContext({viewport:{width, height:900}, reducedMotion:'reduce'});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    try {
      await page.goto(base + '/raven/deleted-name/?lang=ar');
      const frame = page.frameLocator('#site-content');
      let initialSources;
      for (const [step, language] of ['ar', 'en', 'ar'].entries()) {
        await frame.locator('html[lang="' + language + '"]').waitFor();
        await frame.locator('.cast').scrollIntoViewIfNeeded();
        await frame.locator('.cast img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        const state = await frame.locator('.cast').evaluate(cast => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          columns: getComputedStyle(cast).gridTemplateColumns.split(' ').length,
          cards: [...cast.children].map(card => {
            const portrait = card.querySelector('.cast-portrait'), image = portrait.querySelector('img');
            const crop = portrait.getBoundingClientRect(), full = image.getBoundingClientRect();
            return {id:card.dataset.character, name:card.querySelector('dt').innerText, description:card.querySelector('dd').innerText,
              source:image.currentSrc, loaded:image.complete && image.naturalWidth > 0, square:image.naturalWidth === image.naturalHeight,
              alt:image.getAttribute('alt'), hidden:portrait.getAttribute('aria-hidden'), lazy:image.loading, async:image.decoding,
              ratio:crop.width / crop.height, column:(crop.x - full.x) / crop.width, row:(crop.y - full.y) / crop.height,
              fullWidth:full.width / crop.width, fullHeight:full.height / crop.height};
          })
        }));
        assert.equal(state.overflow, false, 'the case must fit the viewport');
        assert.equal(state.columns, width > 560 ? 3 : 2);
        assert.deepEqual(state.cards.map(card => card.id), characters);
        assert.deepEqual(state.cards.map(card => card.name), names[language]);
        assert.deepEqual(state.cards.map(card => card.description), descriptions[language]);
        state.cards.forEach((card, index) => {
          assert.equal(card.loaded, true); assert.equal(card.square, true);
          assert.equal(card.alt, ''); assert.equal(card.hidden, 'true');
          assert.equal(card.lazy, 'lazy'); assert.equal(card.async, 'async');
          assert.ok(Math.abs(card.ratio - 2 / 3) < 0.001, 'each face keeps the portrait crop');
          assert.ok(Math.abs(card.column - index % 3) < 0.001, 'RTL must not reverse atlas columns');
          assert.ok(Math.abs(card.row - Math.floor(index / 3)) < 0.001, 'each face uses the intended atlas row');
          assert.ok(Math.abs(card.fullWidth - 3) < 0.001 && Math.abs(card.fullHeight - 2) < 0.001, 'the crop must exclude neighboring faces');
        });
        const sources = state.cards.map(card => card.source);
        if (initialSources) assert.deepEqual(sources, initialSources, 'changing language must retain the same portraits');
        else initialSources = sources;
        assert.equal(new Set(sources).size, 1, 'all faces share the single local atlas');
        assert.match(sources[0], /\/raven\/deleted-name\/assets\/characters\/cast-portraits-v1\.webp$/);
        assert.equal(await page.locator('audio').count(), 1);
        assert.equal(await frame.locator('audio').count(), 0);
        assert.equal(await page.locator('#music-track-picker option').count(), 13);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (process.env.RAVEN_PORTRAIT_SCREENSHOT_DIR && step < 2) {
          fs.mkdirSync(process.env.RAVEN_PORTRAIT_SCREENSHOT_DIR, {recursive:true});
          // Capture the same content directly: a tall element screenshot inside the
          // fixed-height player iframe would be clipped to the iframe viewport.
          const preview = await context.newPage();
          try {
            await preview.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
            await preview.goto(base + '/raven/deleted-name/content.html?lang=' + language);
            await preview.locator('.cast').scrollIntoViewIfNeeded();
            await preview.locator('.cast img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
            await preview.locator('.cast').screenshot({path:path.join(process.env.RAVEN_PORTRAIT_SCREENSHOT_DIR, 'cast-' + language + '-' + width + '.png')});
          } finally { await preview.close(); }
        }
        if (step < 2) await frame.locator('#lang-switch').click();
      }
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
});
