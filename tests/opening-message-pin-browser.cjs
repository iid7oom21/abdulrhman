const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const base = 'http://raven.test/abdulrhman/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

test('a player pin uses the earlier correspondence and remains private to one opening', async t => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  t.after(() => browser.close());
  for (const width of [320, 390, 1280]) for (const lang of ['ar', 'en']) {
    await t.test(`${lang} at ${width}px`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      try {
        const writes = [], errors = [];
        await context.route('**/*', async route => {
          const request = route.request(), url = new URL(request.url());
          if (!['GET','HEAD'].includes(request.method())) { writes.push(request.url()); return route.abort(); }
          if (url.origin !== new URL(base).origin || ['font','image','media'].includes(request.resourceType())) return route.abort();
          if (!url.pathname.startsWith('/abdulrhman/')) return route.fulfill({ status:404, body:'' });
          const relative = url.pathname.slice('/abdulrhman/'.length);
          const file = path.resolve(root, relative + (relative.endsWith('/') ? 'index.html' : ''));
          if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status:404, body:'' });
          return route.fulfill({ path:file, contentType:types[path.extname(file)] || 'application/octet-stream' });
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + 'raven/deleted-name/?lang=' + lang);
        const frame = page.frameLocator('#site-content');
        const q = sel => frame.locator(sel);
        const app = q('#hook');
        const preview = q('#task-message-preview');
        const pin = n => q('[data-pin-message="m' + n + '"]');
        const recall = q('[data-open-pinned]');
        const reference = q('#paper-pinned-message');
        const activate = async locator => { await locator.focus(); await page.keyboard.press('Enter'); };
        const marker = () => app.evaluate(el => ({ ...el.dataset }));
        const focused = locator => locator.evaluate(el => el === document.activeElement);
        await q('#task-message-preview[aria-haspopup="dialog"]').waitFor();
        await app.evaluate(() => { window.__pinStorageWrites = [];
          const setItem = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key,value) { window.__pinStorageWrites.push(key); return setItem.call(this,key,value); };
        });
        await activate(preview);
        const initial = await marker();
        assert.equal(await q('[data-pin-message][aria-pressed="true"]').count(), 0);
        for (const n of [1,2,3]) {
          await activate(pin(n));
          assert.ok(await focused(pin(n)));
          assert.equal(await q('[data-pin-message][aria-pressed="true"]').count(),1);
          assert.equal(await pin(n).getAttribute('aria-pressed'),'true');
        }
        assert.deepEqual(await marker(), initial);
        await page.keyboard.press('Escape');
        assert.ok(await focused(preview));
        await activate(q('[data-journey-paper]'));
        await activate(q('[data-hook-action="enter"]'));
        const checkSource = async n => {
          const row = q('#assignment-stage [data-k="m'+n+'"]');
          assert.equal(await reference.locator('blockquote').textContent(), await row.textContent());
          assert.ok((await reference.locator('figcaption').textContent()).endsWith(await row.locator('..').locator('.who').textContent()));
          assert.equal(await reference.count(),1);
        };
        await checkSource(3);
        const before = await marker();
        await activate(recall); assert.ok(await focused(pin(3)));
        await activate(pin(2)); await page.keyboard.press('Escape');
        assert.ok(await focused(recall)); await checkSource(2);
        await activate(q('#lang-switch')); await checkSource(2);
        await activate(recall); assert.ok(await focused(pin(2)));
        await activate(pin(2)); await page.keyboard.press('Escape');
        assert.equal(await reference.count(),0);
        assert.ok(await focused(q('[data-visual-source]')));
        assert.deepEqual(await marker(), before);
        await activate(preview); await activate(pin(1)); await page.keyboard.press('Escape');
        await checkSource(1);
        const widthData = await app.evaluate(() => ({ actual:document.documentElement.scrollWidth, expected:innerWidth }));
        assert.ok(widthData.actual<=widthData.expected+1);
        for (const id of ['continue','wait','record','replay','open','enter']) await activate(q('[data-hook-action="'+id+'"]'));
        assert.equal(await reference.count(),0);
        await activate(preview); await activate(pin(3)); await page.keyboard.press('Escape'); await checkSource(3);
        assert.ok((await app.evaluate(()=>window.__pinStorageWrites)).every(key => key==='raven_language'));
        await page.reload();await q('#task-message-preview[aria-haspopup="dialog"]').waitFor();
        await activate(preview);
        assert.equal(await q('[data-pin-message][aria-pressed="true"]').count(),0);
        assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
      } finally { await context.close(); }
    });
  }
});
