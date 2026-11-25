const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const http = require('node:http');
const {chromium, expect} = require('playwright/test');

test('the dome projects both target solutions and the phone handoff hides the sender’s map', async t => {
  const prefix = '/abdulrhman/raven/late-night/';
  const root = path.resolve(__dirname, '../raven/late-night');
  const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css'};
  const server = http.createServer(async (req, res) => {
    const {pathname} = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, pathname.slice(prefix.length));
    if (!pathname.startsWith(prefix) || !file.startsWith(root + path.sep)) return res.writeHead(404).end();
    try {
      const data = await fs.readFile(file);
      res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'}).end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(ok => server.listen(0, '127.0.0.1', ok));
  t.after(() => server.close());
  const base = 'http://127.0.0.1:' + server.address().port + prefix;
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium'});
  t.after(() => browser.close());

  for (const [lang, width] of [['ar',320], ['en',390]]) {
    await t.test(lang + ' at ' + width, async () => {
      const context = await browser.newContext({viewport:{width,height:844}, reducedMotion:'reduce'});
      const page = await context.newPage();
      const field = key => page.locator('[data-game="' + key + '"]');
      const tap = key => field(key).click();
      try {
        await page.goto(base + 'dome-sky.html?lang=' + lang);
        await expect.poll(() => field('sky').evaluate(async view => {
          const backdrop = new Image();
          backdrop.src = new URL('assets/photo/dome-sky.webp', location.href);
          await backdrop.decode();
          const expected = document.createElement('canvas');
          expected.width=view.width; expected.height=view.height;
          const c=expected.getContext('2d');
          c.drawImage(backdrop,0,0,view.width,view.height);
          const source=c.getImageData(68,112,8,8).data;
          const scene=view.getContext('2d').getImageData(68,112,8,8).data;
          return source.every((v,i)=>v===scene[i]);
        })).toBe(true);
        await field('A-plus').focus();
        await page.keyboard.press('Enter');
        await expect(field('A-plus')).toBeFocused();
        await tap('reset');
        await tap('check');
        await expect(page.locator('[data-result=different]')).toBeVisible();
        await tap('A-plus'); await tap('B-plus'); await tap('B-plus');
        await tap('check');
        await expect(page.locator('[data-result=match]')).toBeVisible();
        for (let step=0; step<4; step++) { await tap('A-plus'); await tap('B-plus'); }
        await tap('check');
        await expect(page.locator('[data-result=match]')).toBeVisible();
        await expect(field('sky')).toHaveAttribute('data-lit','A2,A3,A6,A7');
        await tap('mode');
        const downloaded = page.waitForEvent('download');
        await tap('png');
        const bytes = await fs.readFile(await (await downloaded).path());
        assert.deepEqual(bytes.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
        assert.equal(bytes.readUInt32BE(16),640);
        assert.equal(bytes.readUInt32BE(20),320);
        if (lang==='ar') {
          await page.route('**/assets/photo/*.webp', route=>route.abort());
          await page.reload();
          await tap('A-plus'); await tap('B-plus'); await tap('B-plus');
          await tap('check');
          await expect(page.locator('[data-result=match]')).toBeVisible();
          await page.unroute('**/assets/photo/*.webp');
        }

        await page.goto(base + 'echo-two.html?lang=' + lang);
        const senderMarker = await page.locator('.game-art').evaluate(view => {
          const ctx=view.getContext('2d');
          return [...ctx.getImageData(312,204,10,20).data];
        });
        for (const signal of ['signal-1','signal-4','signal-5']) await tap(signal);
        await expect(field('signal-0')).toBeDisabled();
        await tap('pass');
        await expect(field('private-map')).toHaveCount(0);
        await page.setViewportSize({width:844,height:width});
        await tap('receive');
        await expect.poll(() => page.locator('.game-art').evaluate(async view => {
          const plate = new Image();
          plate.src = new URL('assets/photo/echo-chart.webp', location.href);
          await plate.decode();
          const expected = document.createElement('canvas');
          expected.width=view.width; expected.height=view.height;
          const c=expected.getContext('2d');
          c.drawImage(plate,0,0,view.width,view.height);
          const original=c.getImageData(312,204,10,20).data;
          const receiver=view.getContext('2d').getImageData(312,204,10,20).data;
          return original.every((v,i)=>v===receiver[i]);
        })).toBe(true);
        const receiverMarker=await page.locator('.game-art').evaluate(view=>[...view.getContext('2d').getImageData(312,204,10,20).data]);
        assert.notDeepEqual(senderMarker,receiverMarker);
        await page.setViewportSize({width,height:844});
        await page.locator('[data-night-language]').click();
        await expect(field('private-map')).toHaveCount(0);
        await tap('pier-1'); await tap('time-2050');
        await field('meaning').fill('Glass pier after second bell');
        await tap('reveal');
        await expect(page.locator('[data-result=met]')).toBeVisible();
        await expect(page.locator('.night-bench')).toContainText('Glass pier after second bell');
        await tap('keep');
        await expect(field('keep')).toBeDisabled();
        assert.equal(await page.locator('html').evaluate(el => el.scrollWidth<=innerWidth),true);
      } finally { await context.close(); }
    });
  }
});
