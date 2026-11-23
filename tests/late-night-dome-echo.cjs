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

        await page.goto(base + 'echo-two.html?lang=' + lang);
        for (const signal of ['signal-1','signal-4','signal-5']) await tap(signal);
        await expect(field('signal-0')).toBeDisabled();
        await tap('pass');
        await expect(field('private-map')).toHaveCount(0);
        await page.setViewportSize({width:844,height:width});
        await tap('receive');
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
