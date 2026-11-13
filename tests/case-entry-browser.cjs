const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

// Public opening -> real public play UI, with only a fictional availability API.
// No private case pack, provider, account, external service or paid request is used.
const ROOT = path.resolve(__dirname, '..');
const OPENING_PATH = '/raven/deleted-name/';
const PLAY_PATH = '/raven/deleted-name/play/';
const KEY = 'raven.case.opening.v1';
const VERSION = 'paper-opening-2026-11-05-r2';
const PRIVATE_SENTINEL = 'PRIVATE-NOTE-DO-NOT-IMPORT';
const audioSnapshot = page => page.evaluate(() => ({
  sameDocument: window.__entryDocument === document,
  sameAudio: window.__entryAudio === document.querySelector('#site-soundtrack'),
  audioCount: document.querySelectorAll('audio').length,
  trackCount: document.querySelectorAll('#music-track-picker option').length,
  muted: document.querySelector('#site-soundtrack').muted,
  paused: document.querySelector('#site-soundtrack').paused,
}));

function fixture(mode = 'enabled') {
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://fixture.local');
    if (url.pathname.startsWith('/api/')) {
      requests.push({ method: req.method, pathname: url.pathname });
      if (url.pathname === '/api/case/config') {
        if (mode === 'missing' || mode === 'html') {
          res.writeHead(mode === 'missing' ? 404 : 200, { 'Content-Type': 'text/html' });
          return res.end('<!doctype html><title>Static site fixture</title>');
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ enabled: mode === 'enabled', contentVersion: 'entry-browser-fixture-v1', locales: ['ar', 'en'], scope: 'written-story' }));
      }
      // Reaching play must present a user-controlled start/import decision.
      // It must not create a case session merely by following the opening link.
      res.writeHead(url.pathname === '/api/case/state' ? 401 : 405, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: url.pathname === '/api/case/state' ? 'no_session' : 'unexpected_write' }));
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    let file;
    try {
      const pathname = decodeURIComponent(url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname);
      file = path.resolve(ROOT, '.' + pathname);
    } catch { res.writeHead(400); return res.end(); }
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
  return { server, requests };
}

test('opening continuation: explicit import, persistent shell and unavailable-server boundaries', async t => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  t.after(() => browser.close());

  async function check(options, run) {
    const api = fixture(options.mode);
    await new Promise(resolve => api.server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + api.server.address().port;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(({ key, privateNote, blockSession, previousOpening }) => {
      const originalSet = Storage.prototype.setItem;
      try {
        if (window === window.top) {
          window.__entryStorageCalls = [];
          originalSet.call(localStorage, 'other_app_preferences', 'keep');
          originalSet.call(localStorage, 'raven_music_muted_v1', 'on');
          originalSet.call(sessionStorage, 'other_session_preferences', 'keep-session');
          originalSet.call(sessionStorage, 'private-notebook-fixture', privateNote);
          if (previousOpening) originalSet.call(sessionStorage, key, JSON.stringify(previousOpening));
        }
      } catch { /* Initial about:blank has no storage origin. */ }
      for (const method of ['setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args) {
          const area = this === window.sessionStorage ? 'session' : 'local';
          try { window.top.__entryStorageCalls?.push({ method, area, args }); } catch { /* No cross-origin access is required. */ }
          if (blockSession && area === 'session' && method === 'setItem') throw new DOMException('Fixture: session storage blocked', 'SecurityError');
          return original.apply(this, args);
        };
      }
    }, { key: KEY, privateNote: PRIVATE_SENTINEL, blockSession: Boolean(options.blockSession), previousOpening: options.previousOpening || null });
    const page = await context.newPage(), errors = [], networkWrites = [];
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) networkWrites.push({ method: request.method(), url: request.url(), body: request.postData() });
      return request.url().startsWith(base + '/') ? route.continue() : route.abort();
    });
    try {
      await page.goto(base + OPENING_PATH + '?lang=' + (options.language || 'ar'), { waitUntil: 'domcontentloaded' });
      const frame = page.frameLocator('#site-content');
      await frame.locator('#hook').waitFor();
      await page.waitForFunction(() => window.RavenSite && document.querySelector('#site-recovery').hidden);
      await page.evaluate(() => { window.__entryDocument = document; window.__entryAudio = document.querySelector('#site-soundtrack'); });
      const before = await audioSnapshot(page);
      assert.equal(before.audioCount, 1); assert.equal(before.trackCount, 13);
      assert.equal(before.muted, true); assert.equal(before.paused, true);
      await run({ api, base, page, frame, networkWrites });
      assert.deepEqual(errors, [], 'no unhandled browser errors');
      assert.deepEqual(networkWrites, [], 'entry and review do not POST or start a session automatically');
      assert.ok(api.requests.every(request => request.method === 'GET'), 'the availability fixture received only read requests');
      const preserved = await page.evaluate(() => ({ other: localStorage.getItem('other_app_preferences'), session: sessionStorage.getItem('other_session_preferences'), privateNote: sessionStorage.getItem('private-notebook-fixture') }));
      assert.deepEqual(preserved, { other: 'keep', session: 'keep-session', privateNote: PRIVATE_SENTINEL });
    } finally {
      await context.close();
      await new Promise(resolve => api.server.close(resolve));
    }
  }

  async function finish({ api, frame }, choice, recipient) {
    const action = id => frame.locator('[data-hook-action="' + id + '"]');
    for (const id of ['open', 'enter', 'continue']) await action(id).click();
    await action(choice).click();
    if (['precise', 'lie'].includes(choice)) {
      await action('recipient-' + recipient).click();
      await action('confirm').click();
    } else {
      assert.equal(await frame.locator('[data-hook-action^="recipient-"]').count(), 0, 'wait/refuse creates no written recipient choice');
      assert.equal(await frame.locator('#hook-share-review').count(), 0, 'a spoken-only response skips the written preview');
      assert.equal(await action('confirm').count(), 0, 'a spoken-only response needs no written confirmation');
      const layers = await frame.locator('#hook').evaluate(el => JSON.parse(el.dataset.layers));
      assert.equal(layers.draftWritten, null);
      assert.equal(layers.sceneShared, null);
      assert.deepEqual(layers.recipientKnowledge, { jonas: [], claire: [], elena: [] });
    }
    assert.equal(await frame.locator('#hook').getAttribute('data-phase'), 'after');
    assert.equal(await frame.locator('#case-continue-link').count(), 0, 'continuation is not offered before the ending');
    assert.equal(api.requests.length, 0, 'availability is not checked before the player finishes the opening');
    await action('record').click();
    assert.equal(await frame.locator('#hook').getAttribute('data-phase'), 'done');
  }

  const cases = [
    { choice: 'precise', recipient: 'jonas' },
    { choice: 'precise', recipient: 'both' },
    { choice: 'lie', recipient: 'draft' },
    { choice: 'wait', recipient: null },
    { choice: 'refuse', recipient: null },
  ];
  for (const language of ['ar', 'en']) for (const scenario of cases) {
    await t.test(language + ': ' + scenario.choice + ' / ' + (scenario.recipient || 'no recipient') + ' transfers only the versioned summary in the same shell', async () => check({ language }, async ({ api, page, frame }) => {
      await finish({ api, frame }, scenario.choice, scenario.recipient);
      await frame.locator('#case-continue-link').waitFor();
      assert.equal(await frame.locator('#case-continue-link').innerText(), language === 'en' ? 'Continue from this opening' : 'أكمل من هذا الافتتاح');
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), KEY), null, 'finishing the opening alone does not import a choice');
      const expected = { version: VERSION, choice: scenario.choice, recipient: scenario.recipient };
      await frame.locator('#case-continue-link').click();
      await page.waitForURL(url => url.pathname === PLAY_PATH);
      await frame.locator('#opening-summary').waitFor();
      assert.equal(await frame.locator('html').getAttribute('lang'), language);
      if (language === 'en') assert.equal(new URL(page.url()).searchParams.get('lang'), 'en');
      assert.deepEqual(await audioSnapshot(page), { sameDocument: true, sameAudio: true, audioCount: 1, trackCount: 13, muted: true, paused: true });
      assert.equal(await frame.locator('audio').count(), 0, 'play does not create another soundtrack');
      const stored = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), KEY);
      assert.deepEqual(stored, expected);
      assert.deepEqual(Object.keys(stored).sort(), ['choice', 'recipient', 'version']);
      assert.doesNotMatch(JSON.stringify(stored), new RegExp(PRIVATE_SENTINEL));
      const writes = await page.evaluate(key => window.__entryStorageCalls.filter(call => call.area === 'session' && call.method === 'setItem' && call.args[0] === key), KEY);
      assert.equal(writes.length, 1, 'one explicit click stores one compact summary');
      assert.deepEqual(JSON.parse(writes[0].args[1]), expected);
      assert.equal(await frame.locator('#case-start').innerText(), language === 'en' ? 'Start with this choice' : 'ابدأ بهذا الاختيار');
      assert.equal(await frame.locator('#case-start-without-opening').isVisible(), true, 'the case lets the player decline the import');
      assert.match(await frame.locator('#opening-summary').innerText(), language === 'en' ? /not proof of earlier delivery to the server/ : /ليس إثباتًا لإرسال سابق إلى الخادم/);
      if (scenario.recipient === null) assert.match(await frame.locator('#opening-summary').innerText(), language === 'en' ? /No recipient/ : /لا مستلم/);
      assert.deepEqual(api.requests.map(request => request.pathname), ['/api/case/config', '/api/case/config', '/api/case/state']);
    }));
  }

  for (const mode of ['disabled', 'missing', 'html']) {
    await t.test(mode + ' availability leaves the opening complete without a continue button or writes', async () => check({ mode }, async ({ api, page, frame }) => {
      const response = page.waitForResponse(response => new URL(response.url()).pathname === '/api/case/config');
      await finish({ api, frame }, 'wait', null);
      await (await response).finished();
      await frame.locator('#hook').evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await frame.locator('#case-continuation').count(), 0);
      assert.equal(await frame.locator('#case-continue-link').count(), 0);
      assert.equal(await frame.locator('#hook-ending').isVisible(), true);
      assert.equal(await frame.locator('[data-hook-action="replay"]').isVisible(), true);
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), KEY), null);
      assert.deepEqual(api.requests, [{ method: 'GET', pathname: '/api/case/config' }]);
      assert.equal(new URL(page.url()).pathname, OPENING_PATH);
    }));
  }

  for (const language of ['ar', 'en']) {
    await t.test(language + ': blocked session storage offers a direct link without claiming choice transfer', async () => check({ language, blockSession: true }, async ({ api, page, frame }) => {
      await finish({ api, frame }, 'precise', 'both');
      await frame.locator('#case-continue-link').waitFor();
      await frame.locator('#case-continue-link').click();
      const direct = frame.locator('[data-case-without-import]');
      await direct.waitFor();
      assert.match(await frame.locator('#case-continuation p').innerText(), language === 'en' ? /could not keep the choice summary/ : /تعذّر الاحتفاظ بملخص الاختيار/);
      assert.equal(new URL(page.url()).pathname, OPENING_PATH, 'a failed save does not navigate as if import succeeded');
      assert.equal(await direct.evaluate(node => document.activeElement === node), true);
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), KEY), null);
      await direct.click();
      await page.waitForURL(url => url.pathname === PLAY_PATH);
      await frame.locator('#case-start').waitFor();
      assert.equal(await frame.locator('html').getAttribute('lang'), language);
      assert.equal(await frame.locator('#opening-summary').count(), 0);
      assert.equal(await frame.locator('#case-start-without-opening').count(), 0);
      assert.equal(await frame.locator('#case-start').innerText(), language === 'en' ? 'Start or resume my session' : 'ابدأ أو تابع جلستي');
      assert.deepEqual(await audioSnapshot(page), { sameDocument: true, sameAudio: true, audioCount: 1, trackCount: 13, muted: true, paused: true });
    }));
  }

  await t.test('changing language at the ending preserves the choice and does not duplicate availability reads', async () => check({}, async ({ api, page, frame }) => {
    await finish({ api, frame }, 'precise', 'both');
    await frame.locator('#case-continue-link').waitFor();
    await frame.locator('#lang-switch').click();
    assert.equal(await frame.locator('#case-continue-link').innerText(), 'Continue from this opening');
    assert.deepEqual(api.requests, [{ method: 'GET', pathname: '/api/case/config' }]);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), KEY), null);
    await frame.locator('#case-continue-link').click();
    await frame.locator('#opening-summary').waitFor();
    assert.equal(await frame.locator('html').getAttribute('lang'), 'en');
    assert.deepEqual(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), KEY), { version: VERSION, choice: 'precise', recipient: 'both' });
    assert.deepEqual(await audioSnapshot(page), { sameDocument: true, sameAudio: true, audioCount: 1, trackCount: 13, muted: true, paused: true });
  }));

  await t.test('storage failure cannot silently reuse an earlier opening through the fallback link', async () => {
    const previousOpening = { version: VERSION, choice: 'lie', recipient: 'jonas' };
    await check({ language: 'en', blockSession: true, previousOpening }, async ({ api, page, frame }) => {
      await finish({ api, frame }, 'wait', null);
      await frame.locator('#case-continue-link').waitFor();
      await frame.locator('#case-continue-link').click();
      const direct = frame.locator('[data-case-without-import]');
      await direct.waitFor();
      assert.match(await frame.locator('#case-continuation p').innerText(), /could not keep the choice summary/);
      await direct.click();
      await page.waitForURL(url => url.pathname === PLAY_PATH);
      await frame.locator('#case-start').waitFor();
      assert.equal(await frame.locator('#opening-summary').count(), 0, 'the fallback must not offer the earlier lie/recipient as if it were the current wait choice');
      assert.equal(await frame.locator('#case-start').innerText(), 'Start or resume my session');
    });
  });
});
