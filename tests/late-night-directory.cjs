// Run from a Pages checkout: node --test tests/late-night-directory.cjs
// To check an already mounted site, set RAVEN_LATE_NIGHT_URL to its directory URL.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

const site = path.resolve(__dirname, '..');
const prefix = '/abdulrhman/';
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp',
  '.png':'image/png', '.woff2':'font/woff2', '.svg':'image/svg+xml', '.json':'application/json'};
const activities = [
  'station-shadow', 'reel-run', 'last-minute-auction', 'lost-and-found', 'dome-sky', 'echo-two',
  'echo-last-seat', 'darkroom-minute', 'weightless-cam', 'tide-harbor', 'fabric-wind', 'director-sentence',
  'reading-actor', 'city-radio', 'puzzle-owner', 'replay-caller', 'memory-lift', 'seven-windows', 'curtain-party', 'sound-museum',
];
const extras = ['time-door', 'three-evening', 'my-notebook', 'festival-chair', 'idea-to-studio',
  'dialogue-preview', 'episode-ends', 'behind-frame', 'weekend', 'screening-room'];

async function serve(t) {
  if (process.env.RAVEN_LATE_NIGHT_URL) return new URL(process.env.RAVEN_LATE_NIGHT_URL);
  const server = http.createServer(async (req, res) => {
    const {pathname} = new URL(req.url, 'http://localhost');
    if (!pathname.startsWith(prefix)) return res.writeHead(404).end();
    const relative = decodeURIComponent(pathname.slice(prefix.length));
    const file = path.resolve(site, relative, pathname.endsWith('/') ? 'index.html' : '');
    if (!file.startsWith(site + path.sep)) return res.writeHead(404).end();
    try {
      const bytes = await fs.readFile(file);
      res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'}).end(bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return new URL('http://127.0.0.1:' + server.address().port + prefix + 'raven/late-night/');
}

function routes(page, selector) {
  return page.locator(selector).evaluateAll(links => links.map(a => new URL(a.href).pathname.split('/').pop().replace(/\.html$/, '')));
}

async function ready(page) {
  await page.locator('.night-bench :is(button:enabled, a[href], select:enabled, input:enabled, textarea:enabled, summary):visible').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function inspect(page, lang, where) {
  const labels = await page.evaluate(() => ({
    lang:document.documentElement.lang, dir:document.documentElement.dir,
    width:innerWidth, documentWidth:document.documentElement.scrollWidth,
    title:document.querySelector('h1')?.innerText.trim(), headingCount:document.querySelectorAll('h1').length,
  }));
  assert.equal(labels.lang, lang, where);
  assert.equal(labels.dir, lang === 'ar' ? 'rtl' : 'ltr', where);
  assert.equal(labels.headingCount, 1, where);
  assert.ok(labels.title, where + ' has a title');
  assert.ok(labels.documentWidth <= labels.width, where + ' overflows ' + labels.documentWidth + '/' + labels.width);
}

function entry(page, id) {
  return page.locator(':is(.night-grid, .night-links) a[href*="/' + id + '.html?"]');
}

test('Late Night public directory, both languages, real paths, recovery and navigation', {concurrency:2}, async t => {
  const base = await serve(t);
  assert.equal(base.pathname, prefix + 'raven/late-night/', 'Use the actual Pages mount');
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
  t.after(() => browser.close());

  async function context(st, width, lang) {
    const ctx = await browser.newContext({viewport:{width, height:width < 600 ? 844 : 900}, hasTouch:width < 600,
      locale:lang, reducedMotion:'reduce', acceptDownloads:true});
    st.after(() => ctx.close());
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', e => errors.push(page.url() + ': ' + e.message));
    return {ctx, page, errors};
  }

  const matrix = [];
  for (const width of [320, 390, 1280]) for (const lang of ['ar', 'en']) {
    matrix.push(t.test(lang + ' ' + width + 'px | 30 entrances, imagery, return links', async st => {
      const {page, errors} = await context(st, width, lang);
      const failed = [];
      page.on('response', r => {if(r.status() >= 400 && new URL(r.url()).origin === base.origin) failed.push(r.status() + ' ' + r.url());});
      await page.goto(base + '?lang=' + lang);
      await ready(page);
      await inspect(page, lang, 'directory');
      const featureRatio = await page.locator('.night-feature img').evaluate(async image => {
        await image.decode();
        const box = image.getBoundingClientRect();
        return Math.abs(box.width / box.height - image.naturalWidth / image.naturalHeight);
      });
      assert.ok(featureRatio < 0.02, 'the featured still keeps its full frame');
      assert.deepEqual(await routes(page,'.night-grid a'), activities);
      assert.deepEqual(await routes(page,'.night-links a[href*=".html?"]'), extras);
      const previews = await page.locator('.night-card img').evaluateAll(async images =>
        Promise.all(images.map(async img => {
          img.loading = 'eager'; await img.decode();
          return {name:new URL(img.currentSrc).pathname.split('/').pop(), width:img.naturalWidth, height:img.naturalHeight,
            title:img.closest('a').querySelector('h3')?.innerText.trim()};
        })));
      assert.deepEqual(previews.map(p=>p.name), activities.map(id=>id+'.webp'));
      for(const preview of previews) assert.ok(preview.width > 0 && preview.height > 0 && preview.title, preview.name);
      for (const id of [...activities, ...extras]) {
        const link = entry(page, id);
        const expected = await link.getAttribute('href');
        await link.click();
        await page.waitForURL(expected);
        await ready(page);
        await inspect(page, lang, id);
        const footer = page.locator('.night-foot a');
        assert.equal(await footer.count(), 2, id + ' footer');
        const home = new URL(await footer.last().getAttribute('href'));
        assert.equal(home.pathname, prefix+'raven/');
        assert.equal(home.searchParams.get('lang'), lang);
        assert.equal(new URL(await footer.first().getAttribute('href')).hash, '#catalog');
        await footer.first().click();
        await page.waitForURL(base + '?lang=' + lang + '#catalog');
        await page.locator('.night-grid').first().waitFor();
      }
      assert.deepEqual(errors, [], 'script exceptions');
      assert.deepEqual(failed, [], 'unsuccessful project requests');
    }));
  }
  await Promise.all(matrix);

  await t.test('mobile keyboard entry with missing artwork and reduced motion', async st => {
    const {page, ctx, errors} = await context(st, 390, 'ar');
    await ctx.route('**/thumbs/*.webp', route => route.abort());
    await page.goto(base + '?lang=ar');
    const feature = page.locator('.night-feature');
    await feature.locator('img[hidden]').waitFor({state:'attached'});
    assert.equal(await feature.locator('img').isVisible(), false);
    const box = await feature.boundingBox();
    const copy = await feature.locator(':scope > div').boundingBox();
    assert.ok(copy.width >= box.width - 3, 'without a preview, the feature text fills the card');
    const station = entry(page, 'station-shadow');
    const image = station.locator('img');
    await station.scrollIntoViewIfNeeded();
    await image.evaluate(img => img.decode().catch(() => {}));
    assert.equal(await image.evaluate(img => img.naturalWidth), 0);
    assert.equal(await image.isVisible(), false, 'a failed preview does not leave a broken image in the card');
    assert.match(await station.innerText(), /المحط/);
    assert.ok(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
    await page.keyboard.press('Tab'); await station.focus();
    assert.ok(await station.evaluate(a => a.matches(':focus-visible') && getComputedStyle(a).outlineStyle !== 'none'));
    await page.keyboard.press('Enter'); await ready(page);
    const first = page.locator('.night-bench button:enabled:visible').first();
    await first.focus(); await page.keyboard.press('Enter');
    const board = page.locator('canvas[data-phase="record"]');
    await board.waitFor();
    const start = await board.getAttribute('data-player'); await page.keyboard.press('ArrowUp');
    await page.waitForFunction(previous => document.querySelector('canvas[data-phase="record"]').dataset.player !== previous, start);
    const home = page.locator('.night-foot a').last();
    await home.click(); await page.waitForURL(new URL('../?lang=ar',base).href);
    assert.deepEqual(errors, []);
  });

  await t.test('390px | failed entry module displays localized retry and then opens the original activity', async st => {
    const {page, ctx} = await context(st, 390, 'en');
    await page.goto(base + '?lang=en'); await ready(page);
    const script = '**/sims/main.js';
    await ctx.route(script, route => route.abort('failed'));
    await entry(page,'fabric-wind').click();
    await page.getByRole('button', {name:'Retry loading'}).waitFor();
    assert.match(await page.getByRole('status').innerText(), /could not be loaded/);
    assert.equal(new URL(await page.getByRole('link', {name:'All experiences'}).getAttribute('href'),base).pathname,base.pathname);
    await ctx.unroute(script);
    await page.getByRole('button', {name:'Retry loading'}).press('Enter');
    await page.locator('[data-sim="run"]').waitFor(); await ready(page);
    assert.equal(new URL(page.url()).pathname, base.pathname+'fabric-wind.html');
    await inspect(page, 'en', 'successful retry');
  });

  await t.test('station movement buttons follow the recording and crossing phases', async st => {
    const {page} = await context(st, 390, 'ar');
    await page.goto(new URL('station-shadow.html', base).href);
    const button = name => page.locator('[data-game="' + name + '"]');
    const padKey = button('right');
    await button('record').waitFor();
    assert.equal(await padKey.isVisible(), false, 'movement is hidden before recording');
    await page.clock.install();
    await button('record').press('Enter');
    assert.equal(await padKey.isVisible(), true);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.clock.fastForward(10001);
    assert.equal(await padKey.isVisible(), false, 'the recording is ready for review');
    await button('cross').press('Enter');
    await page.clock.fastForward(1500);
    assert.equal(await padKey.isVisible(), true);
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    assert.equal(await button('station-view').getAttribute('data-phase'), 'won');
    assert.match(await page.locator('.game-clock output').innerText(), /^\d+\.\d \/ 10 ث$/, 'the Arabic clock uses the Arabic seconds unit');
    assert.equal(await padKey.isVisible(), false, 'movement is hidden after the crossing');
  });

  await t.test('390px | rejected portfolio save recovers the exact editable still as a JSON download', async st => {
    const {page, ctx, errors} = await context(st, 390, 'en');
    await ctx.addInitScript(() => {
      Storage.prototype.setItem = function () {throw new DOMException('Storage denied by user', 'QuotaExceededError');};
    });
    await page.goto(base + '?lang=en');
    await entry(page, 'fabric-wind').click();
    await page.locator('[data-sim="frame"]').fill('4.2');
    await page.locator('[data-sim="save"]').click();
    const notice = page.getByRole('status').filter({has:page.getByRole('button', {name:'Download JSON'})});
    assert.match(await notice.innerText(), /Saving could not be confirmed/);
    assert.equal(await page.locator('.sim-confirm').count(), 0);
    const pending = page.waitForEvent('download');
    await notice.getByRole('button').click();
    const download = await pending;
    assert.equal(download.suggestedFilename(), 'late-night-copy.json');
    const piece = JSON.parse(await fs.readFile(await download.path(),'utf8'));
    assert.equal(piece.activity,'fabric-wind'); assert.equal(piece.type,'fabric');
    assert.equal(piece.data.moment,4.2); assert.ok(piece.thumbnail.startsWith('data:image/webp;base64,'));
    assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(k=>k.includes('.piece.')).length),0);
    assert.deepEqual(errors, []);
  });
});
