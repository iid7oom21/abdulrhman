// CHROMIUM_PATH=/usr/bin/chromium node --test tests/after-show-flow.cjs
// Optional: AFTER_SHOW_QA_DIR=/tmp/screenshots to capture the played result on mobile.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('playwright/test');

const project = path.resolve(__dirname, '..');
const mount = '/abdulrhman/';
const shots = ['exterior', 'hand', 'envelope'];
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg'
};

async function localSite(t) {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://fixture').pathname;
    if (!pathname.startsWith(mount)) {
      res.writeHead(404).end();
      return;
    }
    const relative = pathname.slice(mount.length) + (pathname.endsWith('/') ? 'index.html' : '');
    const file = path.resolve(project, relative);
    if (!file.startsWith(project + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return 'http://127.0.0.1:' + server.address().port;
}

async function activityFrame(page, selector) {
  let frame;
  await expect.poll(() => {
    frame = page.frames().find(candidate => candidate.parentFrame() === page.mainFrame() && candidate.url().includes('/raven/after-show/'));
    return Boolean(frame);
  }).toBe(true);
  await expect(frame.locator(selector).first()).toBeVisible();
  return frame;
}

async function place(frame, shot, slot) {
  await frame.locator('[data-shot="' + shot + '"]').click();
  await frame.locator('[data-slot="' + slot + '"]').click();
}

async function screen(frame, order, matchesBrief) {
  await frame.locator('[data-edit-action="play"]').click();
  for (const id of order) {
    await expect(frame.locator('[data-current-shot="' + id + '"]')).toBeVisible({ timeout: 9000 });
  }
  const result = frame.locator('[data-edit-result]');
  await expect(result).toBeVisible({ timeout: 9000 });
  await expect(result).toHaveAttribute('data-time', 'true');
  await expect(result).toHaveAttribute('data-order', String(matchesBrief));
}

test('a first-time visitor can play Last Transmission directly from the mobile entrance', async t => {
  const origin = await localSite(t);
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  t.after(() => browser.close());
  for (const [lang, width, reducedMotion] of [['ar', 320, 'reduce'], ['en', 390, 'no-preference']]) {
    await t.test(lang + ' ' + width + 'px', async t => {
      const context = await browser.newContext({viewport: {width, height: 800}, hasTouch: true, reducedMotion});
      t.after(() => context.close());
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      await page.goto(origin + mount + 'raven/?lang=' + lang, {waitUntil: 'domcontentloaded'});
      const play = page.locator('dialog[open] #archive-play-edit');
      await expect(play).toHaveText(lang === 'ar' ? 'العب آخر إرسال' : 'Play Last Transmission');
      await expect(play).toHaveAttribute('href', origin + mount + 'raven/after-show/?activity=edit&lang=' + lang);
      const box = await play.boundingBox();
      assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= 800);
      assert.equal(await page.evaluate(() => sessionStorage.getItem('raven_studio_ident_v1')), null);
      if (process.env.AFTER_SHOW_QA_DIR) {
        fs.mkdirSync(process.env.AFTER_SHOW_QA_DIR, {recursive:true});
        await page.screenshot({path:path.join(process.env.AFTER_SHOW_QA_DIR, 'welcome-edit-' + lang + '-' + width + '.png')});
      }
      await play.tap();
      await expect(page).toHaveURL(origin + mount + 'raven/after-show/?activity=edit&lang=' + lang);
      await expect(page.locator('dialog[open]')).toHaveCount(0);
      const frame = await activityFrame(page, '[data-shot="exterior"]');
      await expect(frame.locator('html')).toHaveAttribute('lang', lang);
      await frame.locator('[data-shot="exterior"]').tap();
      await frame.locator('[data-slot="0"]').tap();
      await expect(frame.locator('[data-slot="0"]')).toContainText(lang === 'ar' ? 'واجهة المبنى' : 'The exterior');
      await page.goBack();
      await expect(page.frameLocator('#site-content').locator('[data-after-show-play]')).toBeVisible();
      await expect(page.locator('dialog[open]')).toHaveCount(0);
    });
  }
});

test('a visitor edits and screens a timed cut through the real Pages project mount', { timeout: 210000, concurrency: 2 }, async t => {
  const origin = await localSite(t);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'], headless: true
  });
  t.after(() => browser.close());
  const out = process.env.AFTER_SHOW_QA_DIR;
  if (out) fs.mkdirSync(out, { recursive: true });

  const scenarios = [['ar',320,false], ['en',390,true], ['en',320,false], ['ar',390,true]];
  await Promise.all(scenarios.map(([lang,width,block]) =>
    t.test(lang + ' ' + width + 'px ' + (block ? 'without the middle still' : 'with local stills'), async t => {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion:'reduce', hasTouch: true });
      t.after(() => context.close());
      const localRequests = [];
      const networkWrites = [];
      const appErrors = [];
      const denied = [];
      await context.route('**/*', route => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.origin !== origin) return route.abort();
        localRequests.push(url.pathname);
        if (!['GET','HEAD'].includes(req.method())) networkWrites.push(req.method() + ' ' + url.pathname);
        if (block && url.pathname.endsWith('/after-show/assets/hand.webp')) {
          denied.push(url.pathname);
          return route.abort();
        }
        return route.continue();
      });
      await context.addInitScript(() => {
        if (!location.protocol.startsWith('http')) return;
        sessionStorage.setItem('raven_studio_ident_v1', '1');
        sessionStorage.setItem('raven_music_enabled_v2', 'off');
        if (localStorage.getItem('unchanged-test-case-value') === null) {
          localStorage.setItem('unchanged-test-case-value', 'existing case state');
        }
      });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      page.on('pageerror', err => appErrors.push(err.message));
      await page.goto(origin + mount + 'raven/?lang=' + lang);
      const home = page.frameLocator('#site-content');
      const launch = home.locator('[data-after-show-play]');
      await expect(launch).toBeVisible();
      // The home may preload one promotional still, never an activity implementation.
      assert.deepEqual(localRequests.filter(p => /\/after-show\/[^/]+\.js$/.test(p)), []);
      await launch.click();
      let frame = await activityFrame(page, '[data-shot="exterior"]');
      await expect(frame.locator('html')).toHaveAttribute('lang', lang);
      for (let i = 0; i < shots.length; i++) await place(frame, shots[i], i);
      await expect(frame.locator('[data-edit-result]')).toHaveCount(0);
      assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await screen(frame, shots, true);
      if (out) {
        await frame.locator('[data-edit-result]').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(out,'edit-' + lang + '-' + width + '.png')});
      }
      if (block) assert.ok(denied.length > 0, 'middle still actually failed');
      else assert.ok(localRequests.includes(mount + 'raven/after-show/assets/hand.webp'));

      // The selected 12-second cut must still exist in the other language and after a reload.
      await frame.locator('#as-language').click();
      frame = await activityFrame(page, '[data-slot="2"]');
      await expect(frame.locator('html')).toHaveAttribute('lang', lang === 'ar' ? 'en' : 'ar');
      await page.reload();
      frame = await activityFrame(page, '[data-slot="2"]');
      await expect(frame.locator('[data-edit-action="play"]')).toBeEnabled();
      await place(frame, 'envelope', 0);
      await screen(frame, ['envelope', 'hand', 'exterior'], false);
      if (lang === 'ar' && width === 320) {
        // The explicit preview transfers only the chosen shots to the normal English studio.
        await frame.locator('[data-edit-action="studio"]').click();
        const transfer = frame.locator('[data-edit-studio-confirm]');
        await expect(transfer).toBeVisible();
        const handoff = new URL(await transfer.getAttribute('href'));
        assert.equal(handoff.searchParams.get('afterShow'), 'envelope,hand,exterior');
        await transfer.click();
        await page.waitForURL(url => url.pathname === mount + 'studio/');
        await page.getByRole('button', {name:'Use shots in storyboard'}).click();
        const direction = page.getByRole('textbox', {name:'Shot direction 1'});
        await direction.fill('A new direction, written in the studio.');
        const downloadEvent = page.waitForEvent('download');
        await page.getByRole('button', {name:'Export JSON'}).click();
        const artifact = await downloadEvent;
        const storyboard = JSON.parse(fs.readFileSync(await artifact.path(), 'utf8'));
        assert.match(JSON.stringify(storyboard), /A new direction, written in the studio/);
        await page.getByRole('link', {name:'Return to my round'}).click();
        frame = await activityFrame(page, '[data-slot="0"]');
        await expect(frame.locator('[data-edit-result]')).toHaveAttribute('data-order', 'false');
      }
      assert.deepEqual(networkWrites, [], 'editing and viewing have no network side effects');
      assert.deepEqual(appErrors, []);
      assert.equal(await page.evaluate(() => localStorage.getItem('unchanged-test-case-value')), 'existing case state');
    })
  ));
});
