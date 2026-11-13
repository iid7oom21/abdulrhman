const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const cdn = 'https://cdn.websitepublisher.ai/custom/wid25762/';
const poster = cdn + 'images/raven-film-card.jpg';
const thumbnails = ['raven-master-hero', 'raven-mobile-approved', 'raven-film-card'].map(name => cdn + 'releases/raven-20261011-r3/images/' + name + '-thumb.webp');
// Successful responses use an existing public image as a test-only fixture.
const fixture = fs.readFileSync(path.join(root, 'raven/terminal-preview/assets/hero-poster.jpg'));

test('artwork failures stay local to previews and recover only after an explicit retry', async t => {
  const server = http.createServer((req, res) => {
    let pathname = new URL(req.url, 'http://local').pathname;
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const mime = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.png':'image/png', '.webp':'image/webp'};
    try { res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
  t.after(async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); });

  async function session({width = 390, failed = [], delayScript = false, framed = false} = {}) {
    const context = await browser.newContext({viewport:{width,height:844}, reducedMotion:'reduce'});
    const page = await context.newPage(), requests = [], writes = [], errors = [];
    const failures = new Set(failed);
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url());
      if (request.url().startsWith(base + '/')) {
        if (delayScript && url.pathname.endsWith('/raven-media-fallback.js')) await new Promise(resolve => setTimeout(resolve, 180));
        return route.continue();
      }
      if (request.url().startsWith(cdn)) {
        requests.push(request.url());
        const original = url.origin + url.pathname;
        if (failures.has(original)) return route.fulfill({status:404, contentType:'text/plain', body:'test fixture: missing image'});
        return route.fulfill({status:200, contentType:'image/jpeg', body:fixture});
      }
      return route.abort();
    });
    await page.goto(base + (framed ? '/raven/' : '/raven/content.html'));
    if (framed) {
      await page.locator('#archive-skip').click();
      await page.frameLocator('#site-content').locator('.rvnVaultGrid').waitFor({state:'attached'});
    }
    const view = framed ? await (await page.locator('#site-content').elementHandle()).contentFrame() : page;
    await view.locator('#vault > details > summary').click();
    await view.locator('.rvnVaultGrid').scrollIntoViewIfNeeded();
    await view.waitForFunction(() => [...document.querySelectorAll('.rvnVaultGrid img')].every(img => img.complete));
    return {context,page,view,requests,writes,errors,failures};
  }
  const count = (requests, original) => requests.filter(value => value.split('?')[0] === original).length;
  const cards = page => page.locator('.rvnVaultGrid > a');
  const galleryRetry = page => page.locator('.rvnMediaRetries .rvnMediaRetryRow').filter({has:page.locator('button')});
  async function noOverflow(page) {
    const sizes = await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(sizes.scroll <= sizes.width + 1, JSON.stringify(sizes));
  }

  await t.test('healthy images keep their URLs and art; no fallback or retry requests', async () => {
    const {context,page,requests,writes,errors} = await session();
    await page.waitForFunction(() => document.querySelector('#ravenEpisodePlayer').hasAttribute('aria-describedby'));
    for (let i = 0; i < 3; i++) {
      assert.equal(await cards(page).nth(i).locator('img').getAttribute('src'), thumbnails[i]);
      assert.ok(await cards(page).nth(i).locator('img').evaluate(img => img.naturalWidth > 0));
    }
    assert.equal(await page.locator('#ravenEpisodePlayer').getAttribute('poster'), poster);
    assert.equal(await page.locator('.rvnMediaUnavailable').count(), 0);
    assert.equal(await page.locator('.rvnMediaRetries').isVisible(), false);
    assert.match(await page.locator('link[rel="icon"]').getAttribute('href'), /^\.\/assets\/favicon\.svg$/);
    assert.ok(requests.every(url => !url.includes('raven-media-retry')));
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    await context.close();
  });

  for (const width of [320,390]) await t.test(width + 'px: failed thumbnail, language switch, failed retry, then keyboard recovery', async () => {
    const {context,page,requests,writes,errors,failures} = await session({width, failed:[thumbnails[0]], delayScript:true});
    const first = cards(page).nth(0), good = cards(page).nth(1), retry = galleryRetry(page).nth(0).locator('button');
    const originalLink = await first.getAttribute('href');
    await first.locator('.rvnMediaNotice').waitFor({state:'visible'});
    assert.equal(await first.locator('img').evaluate(img => getComputedStyle(img).visibility), 'hidden');
    assert.equal(await first.getAttribute('href'), originalLink);
    assert.equal(await good.locator('img').getAttribute('src'), thumbnails[1]);
    assert.ok(await good.locator('img').evaluate(img => img.naturalWidth > 0));
    assert.equal(await page.locator('#ravenEpisodePlayer').getAttribute('poster'), poster);
    const requestsBefore = count(requests, thumbnails[0]);
    await page.waitForTimeout(180);
    assert.equal(count(requests, thumbnails[0]), requestsBefore, 'failure must not schedule a retry');
    for (const language of ['ar','en','ar']) {
      await page.evaluate(language => window.RavenI18n.setLanguage(language), language);
      assert.match(await first.locator('.rvnMediaNotice').innerText(), language === 'ar' ? /تعذر تحميل معاينة/ : /image preview could not load/);
      assert.match(await retry.getAttribute('aria-label'), language === 'ar' ? /أعد تحميل الصورة/ : /Retry image/);
      assert.match(await first.locator('small').innerText(), language === 'ar' ? /فتح الصورة الأصلية/ : /Open original artwork/);
      await noOverflow(page);
    }
    await retry.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.rvnMediaRetries button').getAttribute('aria-disabled') === 'false');
    assert.equal(count(requests, thumbnails[0]), requestsBefore + 1);
    assert.match(await first.locator('.rvnMediaNotice').innerText(), /تعذر/);
    assert.match(await galleryRetry(page).nth(0).locator('[role="status"]').innerText(), /تعذر تحميل معاينة/);
    await page.waitForTimeout(180);
    assert.equal(count(requests, thumbnails[0]), requestsBefore + 1, 'failed explicit retry must not loop');
    failures.delete(thumbnails[0]);
    await retry.focus();
    await page.keyboard.press('Space');
    await page.waitForFunction(() => !document.querySelector('.rvnVaultGrid > a').classList.contains('rvnMediaUnavailable'));
    assert.equal(count(requests, thumbnails[0]), requestsBefore + 2);
    assert.equal(await first.evaluate(node => node === document.activeElement), true, 'focus returns to the recovered artwork link');
    assert.equal(await first.getAttribute('href'), originalLink);
    assert.equal(await first.locator('img').evaluate(img => getComputedStyle(img).visibility), 'visible');
    assert.equal(await page.locator('.rvnMediaRetries').isVisible(), false);
    assert.equal(await good.locator('img').getAttribute('src'), thumbnails[1]);
    await noOverflow(page);
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    await context.close();
  });

  await t.test('failed film image leaves video and hero sources intact; poster retry never reloads video', async () => {
    const {context,page,requests,writes,errors,failures} = await session({failed:[poster]});
    const player = page.locator('#ravenEpisodePlayer');
    await page.locator('.film.raven.rvnMediaFilmUnavailable').waitFor();
    assert.equal(await player.getAttribute('poster'), null);
    assert.equal(await page.locator('.film.raven').evaluate(node => getComputedStyle(node, '::before').backgroundImage), 'none');
    assert.equal(await page.locator('#rvnVideoError').getAttribute('hidden'), '');
    assert.equal(await page.locator('#ravenHeroMotion').getAttribute('poster'), './terminal-preview/assets/hero-poster.jpg');
    assert.equal(await page.locator('.rvnVaultGrid .rvnMediaUnavailable').count(), 0);
    const src = await player.getAttribute('src');
    await page.route(src, route => route.fulfill({status:200, contentType:'video/mp4', body:fs.readFileSync(path.join(root, 'raven/terminal-preview/assets/hero-loop.mp4'))}));
    await player.evaluate(video => video.load());
    await page.waitForFunction(() => document.querySelector('#ravenEpisodePlayer').readyState >= 1);
    assert.equal(await page.locator('.rvnScreen').evaluate(node => node.classList.contains('rvnMediaPosterUnavailable')), false, 'loaded video uses its normal dimensions even when its poster failed');
    await page.evaluate(() => {
      const video = document.querySelector('#ravenEpisodePlayer');
      window.posterVideoCalls = [];
      for (const method of ['load','play','pause']) video[method] = () => { window.posterVideoCalls.push(method); return Promise.resolve(); };
    });
    const requestsBefore = count(requests, poster);
    failures.delete(poster);
    const retry = page.locator('.rvnMediaRetries button').last();
    await retry.click();
    await page.waitForFunction(() => document.querySelector('#ravenEpisodePlayer').hasAttribute('poster'));
    assert.equal(await player.getAttribute('src'), src);
    assert.equal(await page.locator('.film.raven').evaluate(node => node === document.activeElement), true, 'poster retry returns focus to the visible film link when the theater is closed');
    assert.match(await player.getAttribute('poster'), /raven-film-card\.jpg\?raven-media-retry=1$/);
    assert.deepEqual(await page.evaluate(() => window.posterVideoCalls), []);
    assert.equal(await page.locator('.film.raven').evaluate(node => getComputedStyle(node, '::before').backgroundImage.includes('raven-media-retry=1')), true);
    assert.equal(await page.locator('#rvnVideoError').getAttribute('hidden'), '');
    // Poster/CSS consumers can each load the recovered URL, but no second probe/attempt occurs.
    assert.ok(count(requests, poster) > requestsBefore);
    assert.ok(requests.filter(url => url.includes('raven-media-retry')).every(url => url.endsWith('raven-media-retry=1')));
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    await context.close();
  });

  await t.test('persistent homepage iframe keeps localized recovery and the original links at 320px', async () => {
    const {context,page,view,requests,writes,errors,failures} = await session({width:320, failed:[thumbnails[2]], framed:true});
    const card = cards(view).nth(2), retry = view.locator('.rvnMediaRetries .rvnMediaRetryRow').nth(2).locator('button');
    await card.locator('.rvnMediaNotice').waitFor({state:'visible'});
    assert.equal(await card.getAttribute('href'), poster);
    await view.locator('[data-raven-language="en"]').click();
    await page.waitForURL(url => url.searchParams.get('lang') === 'en');
    assert.match(await card.locator('.rvnMediaNotice').innerText(), /image preview could not load/);
    assert.match(await retry.getAttribute('aria-label'), /Retry image: RAVEN 17/);
    await noOverflow(view); await noOverflow(page);
    failures.delete(thumbnails[2]);
    await retry.focus();
    await page.keyboard.press('Enter');
    await view.waitForFunction(() => !document.querySelector('.rvnVaultGrid > a:nth-child(3)').classList.contains('rvnMediaUnavailable'));
    assert.equal(await card.evaluate(node => node === document.activeElement), true);
    assert.equal(await card.getAttribute('href'), poster);
    assert.ok(requests.some(url => url.startsWith(thumbnails[2] + '?raven-media-retry=1')));
    assert.equal(new URL(page.url()).searchParams.get('lang'), 'en');
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    await context.close();
  });
});
