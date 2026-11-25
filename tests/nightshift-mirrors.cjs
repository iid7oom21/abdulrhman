// RAVEN_QA_HOME may point to a production-shaped static or CSP-mounted /raven/.
// INK_QA_DIR optionally retains real viewport captures and the observed ray outcomes.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {chromium, expect} = require('playwright/test');

const filename = 'nightshift-mirrors.html';
const fixtures = [
  {angles:[0,0,0], clear:1, blocked:0},
  {angles:[1,0,0], clear:0, blocked:1},
  {angles:[1,1,1], clear:1, blocked:2},
];
const reportPath = process.env.INK_QA_DIR;
const browserOptions = {executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium'};

async function baseUrl(t) {
  if (process.env.RAVEN_QA_HOME) return process.env.RAVEN_QA_HOME;
  const root = path.resolve(__dirname,'..');
  const prefix = '/abdulrhman/';
  const contentType = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp',
    '.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2','.jpg':'image/jpeg','.png':'image/png'};
  const server = http.createServer(async (req,res) => {
    const {pathname} = new URL(req.url,'http://localhost');
    const file = path.resolve(root,pathname.slice(prefix.length),pathname.endsWith('/') ? 'index.html' : '');
    if (!pathname.startsWith(prefix) || !file.startsWith(root + path.sep)) return res.writeHead(404).end();
    try {
      const bytes = await fs.readFile(file);
      res.writeHead(200,{'Content-Type':contentType[path.extname(file)] || 'application/octet-stream'}).end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0,'127.0.0.1',done));
  t.after(() => server.close());
  return 'http://127.0.0.1:' + server.address().port + prefix + 'raven/';
}

async function launchFor(t) {
  const browser = await chromium.launch(browserOptions);
  t.after(() => browser.close());
  return browser;
}

async function configure(page, activate, angles, phase) {
  for (const [i,angle] of angles.entries()) {
    const mirror = page.locator('[data-mirror="' + i + '"]');
    if (await mirror.getAttribute('data-angle') !== String(angle)) {
      await activate(mirror);
      await activate(page.locator('[data-turn="1"]'));
      await expect(mirror).toHaveAttribute('data-angle',String(angle));
    }
  }
  await activate(page.locator('[data-release="' + phase + '"]'));
}

async function shoot(page,activate,won) {
  await activate(page.locator('[data-fire]'));
  const result = page.locator('[data-result]');
  await expect(result).toHaveAttribute('data-won',String(won));
  await expect(result).toBeVisible();
  const rows = result.locator('[data-beam]');
  await expect(rows).toHaveCount(2);
  const endpoints = await rows.evaluateAll(nodes => nodes.map(row => ({
    beam:row.dataset.beam, hit:row.dataset.hit, reached:row.dataset.reached, reading:row.innerText.trim()
  })));
  for (const endpoint of endpoints) {
    assert.ok(endpoint.hit && endpoint.reading, 'Every beam has a terminal surface and a textual reading');
  }
  assert.notEqual(endpoints[0].reading,endpoints[1].reading);
  assert.equal(endpoints.every(ray => ray.hit === 'window' && ray.reached === 'true'),won);
  return endpoints;
}

async function capture(page,name,anchor) {
  if (!reportPath) return;
  await fs.mkdir(reportPath,{recursive:true});
  await anchor.scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(reportPath,name + '.png'),animations:'disabled'});
}

test('play all three lighthouse routes, change one decision, and repeat the shift',async t => {
  const home = await baseUrl(t);
  const browser = await launchFor(t);
  const reports = [];
  for (const [width,lang] of [[320,'ar'],[390,'en'],[1280,'en']]) {
    await t.test(lang + ' at ' + width + ' pixels',async () => {
      const mobile = width < 500;
      const page = await browser.newPage({viewport:{width,height:844},hasTouch:mobile,isMobile:mobile,
        locale:lang,reducedMotion:width === 390 ? 'no-preference' : 'reduce'});
      const errors = [];
      page.on('pageerror',error => errors.push(error.message));
      const activate = locator => mobile ? locator.tap() : locator.press('Enter');
      const report = {width,lang,input:mobile ? 'touch' : 'keyboard',results:[]};
      try {
        await page.goto(new URL('late-night/' + filename + '?lang=' + lang,home).href);
        await expect(page.locator('html')).toHaveAttribute('lang',lang);
        await expect(page.locator('[data-fire]')).toBeEnabled();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        report.url = page.url();
        if (mobile) await capture(page,'lighthouse-entry-' + lang + '-' + width,page.locator('h1'));
        if (!mobile) {
          let visitedMirror = false;
          for (let step=0; step<30 && !visitedMirror; step++) {
            await page.keyboard.press('Tab');
            visitedMirror = await page.evaluate(() => document.activeElement.matches('button[data-mirror]'));
          }
          assert.ok(visitedMirror, 'Mirror controls must be reachable in normal tab order');
        }
        await activate(page.locator('[data-release="' + fixtures[0].clear + '"]'));
        report.initial = await shoot(page,activate,false);
        assert.ok(report.initial.some(ray => ray.hit === 'edge'), 'A wrongly oriented mirror sends a beam out of the harbour');
        for (const [i,stage] of fixtures.entries()) {
          await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage',String(i));
          await configure(page,activate,stage.angles,stage.blocked);
          const blocked = await shoot(page,activate,false);
          assert.ok(blocked.some(ray => ray.hit === 'shutter'), 'The gate is the first blocking surface for one beam');
          await configure(page,activate,stage.angles,stage.clear);
          if (i === 0) {
            const toggles = width === 320 ? 10 : 2;
            for (let toggle=0; toggle<toggles; toggle++) {
              await activate(page.locator('.night-lang'));
              const expected = toggle % 2 ? lang : (lang === 'ar' ? 'en' : 'ar');
              await expect(page.locator('html')).toHaveAttribute('lang',expected);
              for (const [index,angle] of stage.angles.entries()) {
                await expect(page.locator('[data-mirror="' + index + '"]')).toHaveAttribute('data-angle',String(angle));
              }
            }
          }
          if (i === 1) {
            await page.reload();
            await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage','1');
            await expect(page.locator('[data-release="' + stage.clear + '"]')).toHaveAttribute('aria-pressed','true');
            for (const [index,angle] of stage.angles.entries()) {
              await expect(page.locator('[data-mirror="' + index + '"]')).toHaveAttribute('data-angle',String(angle));
            }
          }
          const lit = await shoot(page,activate,true);
          report.results.push({stage:i+1,angles:stage.angles,blockedPhase:stage.blocked,blocked,clearPhase:stage.clear,lit});
          if (i === 0) {
            await capture(page,'lighthouse-playing-' + lang + '-' + width,page.locator('.mirror-chart'));
          }
          if (i < fixtures.length-1) await activate(page.locator('[data-next]'));
        }
        await capture(page,'lighthouse-ending-' + lang + '-' + width,page.locator('[data-result]'));
        await activate(page.locator('[data-again]'));
        await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage','0');
        await expect(page.locator('[data-mirror="0"]')).toHaveAttribute('data-angle','1');
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('audio,video')].some(media => !media.paused)),false);
        assert.deepEqual(errors,[]);
        reports.push(report);
      } finally { await page.close(); }
    });
  }
  if (reportPath) {
    await fs.mkdir(reportPath,{recursive:true});
    await fs.writeFile(path.join(reportPath,'lighthouse-rounds.json'),JSON.stringify({browser:browser.version(),home,reports},null,2)+'\n');
  }
});

test('a module retry and denied storage keep the puzzle playable in memory',async t => {
  const home = await baseUrl(t), browser = await launchFor(t);
  const page = await browser.newPage({viewport:{width:320,height:844},hasTouch:true,reducedMotion:'reduce'});
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage unavailable','SecurityError'); };
  });
  let blockedImage = false;
  await page.route('**/ink/art/beacon-night.webp',route => { blockedImage = true;return route.abort(); });
  await page.route('**/nightshift/mirrors.js',route => route.abort());
  await page.goto(new URL('late-night/' + filename + '?lang=en',home).href);
  await expect(page.getByRole('status')).toContainText('could not be loaded');
  await page.unroute('**/nightshift/mirrors.js');
  await page.getByRole('button',{name:'Retry loading'}).tap();
  const tap = locator => locator.tap();
  await configure(page,tap,fixtures[0].angles,fixtures[0].clear);
  await shoot(page,tap,true);
  await expect(page.locator('.night-notice')).toContainText('Saving could not be confirmed');
  assert.ok(blockedImage, 'The night photograph failed while rays and decisions remained available');
  assert.equal(await page.evaluate(() => localStorage.length),0);
});

test('the homepage opens the real Games card and a visitor can return to the harbour',async t => {
  const home = await baseUrl(t), browser = await launchFor(t);
  const journeys = [];
  for (const [width,lang] of [[320,'ar'],[390,'en']]) {
    const page = await browser.newPage({viewport:{width,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
    try {
      await page.goto(new URL('?lang=' + lang,home).href,{waitUntil:'domcontentloaded'});
      await page.locator('#archive-skip').tap();
      await page.frameLocator('#site-content').locator('#late-night-title a').tap();
      const card = page.locator('.night-grid .night-card[href*="' + filename + '"]');
      await expect(card).toHaveCount(1);
      await card.scrollIntoViewIfNeeded();
      const hub = page.url();
      const size = await card.locator('img').evaluate(async img => { await img.decode();return [img.naturalWidth,img.naturalHeight]; });
      assert.deepEqual(size,[520,293]);
      await capture(page,'lighthouse-catalog-' + lang + '-' + width,card);
      await card.tap();
      await expect(page.locator('h1')).toHaveText(lang === 'ar' ? 'ظلال المنارتين' : 'Twin Lighthouse Shadows');
      await expect(page.locator('[data-fire]')).toBeEnabled();
      const game = page.url();
      await page.locator('a.night-wing').tap();
      await expect(page.locator('#catalog')).toBeVisible();
      journeys.push({width,lang,home,hub,game,returnUrl:page.url(),coverPixels:size});
      for (const id of ['station-shadow','nightshift-seat','nightshift-paper','nightshift-window','nightshift-post']) {
        await expect(page.locator('.night-grid a[href*="' + id + '.html"]')).toHaveCount(1);
      }
    } finally { await page.close(); }
  }
  if (reportPath) {
    await fs.writeFile(path.join(reportPath,'lighthouse-home.json'),JSON.stringify(journeys,null,2)+'\n');
  }
});
