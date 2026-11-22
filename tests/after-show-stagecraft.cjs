const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const origin = 'http://raven.test';
const prefix = '/abdulrhman/';
const pagePath = origin + prefix + 'raven/after-show/content.html';
const mimes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'
};

test('Four live stagecraft workshops at the public project prefix', async t => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  t.after(() => browser.close());
  for (const [lang, width] of [['ar', 320], ['en', 390]]) {
    await t.test(lang + ' at ' + width, async suite => {
      const ctx = await browser.newContext({viewport: {width, height: 820}, reducedMotion: 'reduce'});
      const external = [], errors = [];
      await ctx.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== origin || !url.pathname.startsWith(prefix)) {
          external.push(url.href);
          return route.abort();
        }
        const file = path.resolve(root, url.pathname.slice(prefix.length));
        if (!file.startsWith(root + path.sep)) return route.abort();
        try { return await route.fulfill({body: await fs.readFile(file), contentType: mimes[path.extname(file)] || 'application/octet-stream'}); }
        catch { return route.fulfill({status: 404, body: ''}); }
      });
      const page = await ctx.newPage();
      page.setDefaultTimeout(5000);
      page.on('pageerror', e => errors.push(e.message));
      const field = id => page.locator('[data-sc="' + id + '"]');
      const active = route => page.goto(pagePath + '?activity=' + route + '&lang=' + lang);
      const pixels = () => page.locator('canvas.sc-view').evaluate(el => el.toDataURL());
      const reading = () => page.locator('.sc-read').innerText();
      const result = () => page.locator('.sc-result').innerText();
      const fit = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
      try {
        await suite.test('rain capture restores its frame and optics; transport is keyboard-operable', async () => {
          await active('rainbox');
          await field('seek').fill('40');
          await field('count').fill('8');
          await field('capture').click();
          assert.match(await result(), /Shot approved|اللقطة جاهزة/);
          const image = await pixels();
          await field('count').fill('90');
          await field('slant').fill('40');
          await field('seek').fill('20');
          assert.notEqual(await pixels(), image);
          await field('revisit-capture').click();
          assert.equal(await pixels(), image);
          assert.equal(await field('count').inputValue(), '8');
          assert.equal(await field('slant').inputValue(), '0');
          await field('next').focus();
          await page.keyboard.press('Enter');
          assert.equal(await field('seek').inputValue(), '41');
          await field('speed').selectOption('0.35');
          await field('play').click();
          await page.waitForFunction(() => document.querySelector('[data-sc=seek]').valueAsNumber > 41);
          await field('play').click();
          await page.reload();
          assert.match(await result(), /Shot approved|اللقطة جاهزة/);
          assert.ok(await fit());
        });
        await suite.test('chair contacts, twelve-frame holds, A/B playback and saved key pose', async () => {
          await active('stopmotion');
          await field('hold').fill('6');
          assert.equal(await page.locator('.sc-dist').innerText(), '6 + 4 + 2 = 12');
          await field('pose').selectOption({value:'1'});
          await field('hold').fill('3');
          await field('lift').fill('0');
          await field('stride').fill('20');
          assert.match(await reading(), /slips [1-9]|مثبتة [1-9]/);
          assert.equal(await page.locator('.sc-dist').innerText(), '6 + 3 + 3 = 12');
          await field('keep-take').click();
          const fixed = await pixels();
          await field('stride').fill('37');
          assert.notEqual(await pixels(), fixed);
          await field('frame-8').click();
          assert.equal(await field('frame-8').getAttribute('aria-pressed'), 'true');
          await page.reload();
          assert.equal(await field('stride').inputValue(), '37');
          assert.equal(await field('frame-8').getAttribute('aria-pressed'), 'true');
          await page.locator('#as-language').click();
          await field('frame-8').waitFor();
          assert.equal(await field('pose').inputValue(), '1');
          assert.equal(await field('stride').inputValue(), '37');
          assert.ok(await fit());
        });
        await suite.test('description review distinguishes timing, silence and visible events', async () => {
          await active('description');
          await field('check-description').click();
          assert.match(await result(), /missing|بلا وصف/);
          await field('line-0').selectOption('short');
          await field('line-1').selectOption('short');
          await field('seek').fill('6');
          const text = page.locator('.sc-transcript li[data-active=true]');
          assert.equal(await text.count(), 1);
          assert.match(await text.innerText(), /folds the scarf|تطوي ندى الشال/);
          const before = await pixels();
          await field('seek').fill('16');
          assert.notEqual(await pixels(), before);
          await field('check-description').click();
          assert.match(await result(), /overlap 0 s|الحوار 0 ث/);
          assert.match(await result(), /Both actions|وُصف الفعلان/);
          await field('line-0').selectOption('long');
          await field('start-0').fill('4');
          await field('start-1').fill('5');
          await field('check-description').click();
          assert.match(await result(), /overlap 4 s|الحوار 4 ث/);
          assert.match(await result(), /between descriptions 2 s|الوصفين 2 ث/);
          assert.match(await result(), /missing|بلا وصف/);
          await page.reload();
          assert.equal(await field('start-0').inputValue(), '4');
          assert.equal(await field('line-0').inputValue(), 'long');
          assert.ok(await fit());
        });
        await suite.test('wayfinding obeys four signs, wheelchair geometry, replays and repeat detection', async () => {
          await active('wayfinding');
          const sign = async (position, destination) => {
            await field('junction').selectOption(position);
            await field('direction').selectOption(destination);
            await field('place-sign').click();
          };
          for (const [from, to] of [['F','V'],['V','R'],['R','U'],['U','H']]) await sign(from, to);
          await sign('T','U');
          assert.match(await result(), /Remove one first|ارفع إحداها/);
          await field('visitor').selectOption('access');
          const before = await pixels();
          for (let i = 0; i < 4; i++) await field('advance').click();
          assert.notEqual(await pixels(), before);
          const pathRows = page.locator('.sc-itinerary li');
          assert.deepEqual(await pathRows.allTextContents(), lang === 'en' ? ['Lobby','Crossing','Ramp','Vestibule','Auditorium'] : ['البهو','ملتقى الممرات','المنحدر','ردهة القاعة','قاعة العرض']);
          assert.match(await result(), /has arrived|وصل الزائر/);
          await page.reload();
          assert.equal(await pathRows.count(), 5);
          assert.equal(await page.locator('.sc-installed li').count(), 4);
          await sign('V','T');
          await field('advance').click();
          assert.match(await result(), /unavailable|لا يستطيع الزائر/);
          await field('advance').click();
          assert.match(await reading(), /Ramp|المنحدر/);
          await field('visitor').selectOption('standard');
          await field('walk').click();
          await page.waitForFunction(() => document.querySelectorAll('.sc-itinerary li').length >= 3);
          await field('pause-route').click();
          assert.match(await pathRows.nth(2).innerText(), /Stairs|السلالم/);
          await sign('V','F');
          for (let i = 0; i < 2; i++) await field('advance').click();
          assert.match(await result(), /repeats an earlier path|إلى مسار مكرّر/);
          assert.ok(await fit());
        });
        assert.deepEqual(external, []);
        assert.deepEqual(errors, []);
      } finally { await ctx.close(); }
    });
  }
});
