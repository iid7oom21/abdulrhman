// The retired title must not reappear through cached UI, search, commands or old bookmarks.
// Uses local Chromium only; episode media is a synthetic fixture, external requests are blocked.
// NODE_PATH=<existing Playwright installation> node --test tests/retired-project-browser.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS = process.env.RAVEN_RETIREMENT_ARTIFACTS;
const RETIRED = /zarqa|زرقاء|next-premiere/i;
const activeFiles = [
  'index.html', 'raven/index.html', 'raven/content.html',
  'raven/assets/raven-enhancements-v1.js', 'raven/assets/raven-refinement-v2.js',
  'raven/assets/raven-homepage-v6.css', 'raven/assets/raven-redesign-v1.css', 'raven/assets/raven-polish-v2.css',
  'raven/terminal-preview/assets/manifest.json',
  'docs/raven-music-review/asset-inventory.json', 'docs/raven-music-review/image-references.json'
];

test('retired title is removed from the current public surface and inventories', () => {
  for (const file of activeFiles) assert.doesNotMatch(fs.readFileSync(path.join(ROOT, file), 'utf8'), RETIRED, file);
  assert.equal(fs.existsSync(path.join(ROOT, 'raven/terminal-preview/assets/zarqa-poster.jpg')), false);
  for (const file of ['raven/terminal-preview/assets/manifest.json', 'docs/raven-music-review/asset-inventory.json', 'docs/raven-music-review/image-references.json']) {
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')), file);
  }
  const redirect = fs.readFileSync(path.join(ROOT, 'raven/terminal-preview/zarqa/index.html'), 'utf8');
  assert.doesNotMatch(redirect, RETIRED, 'legacy document is a neutral redirect without the old hash');
});

test('retirement preserves the film and case journeys and redirects saved links', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'raven-retirement-'));
  t.after(() => fs.rmSync(directory, {recursive:true, force:true}));
  const fixture = path.join(directory, 'film.mp4');
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=black:s=160x90:r=2','-t','4','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',fixture]);
  const video = fs.readFileSync(fixture);
  const server = http.createServer((req, res) => {
    let pathname = new URL(req.url, 'http://local').pathname;
    if (pathname.startsWith('/abdulrhman/')) pathname = pathname.slice('/abdulrhman'.length);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(ROOT, '.' + pathname);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.woff2':'font/woff2'};
    try { res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const home = base + '/abdulrhman/raven/';
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
  const results = [];
  if (ARTIFACTS) fs.mkdirSync(ARTIFACTS, {recursive:true, mode:0o700});
  t.after(async () => {
    if (ARTIFACTS) fs.writeFileSync(path.join(ARTIFACTS, 'browser-results.json'), JSON.stringify({browser:browser.version(), externalServices:'blocked', media:'synthetic', results}, null, 2), {mode:0o600});
    await browser.close(); await new Promise(resolve => server.close(resolve));
  });

  async function withPage(options, run) {
    const context = await browser.newContext({viewport:{width:options.width || 390, height:844}, reducedMotion:'reduce', javaScriptEnabled:options.javascript !== false});
    await context.addInitScript(() => {
      sessionStorage.setItem('raven_studio_ident_v1', '1');
      sessionStorage.setItem('raven_music_enabled_v2', 'off');
      localStorage.setItem('other_app_preferences', 'retirement-keep');
    });
    const page = await context.newPage(), errors = [], requests = [];
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const request = route.request(); requests.push({url:request.url(), method:request.method()});
      if (/\/episode-\d\.mp4(?:\?|$)/.test(request.url())) return route.fulfill({contentType:'video/mp4', body:video});
      return request.url().startsWith(base + '/') ? route.continue() : route.abort();
    });
    try {
      await run({page, requests});
      assert.deepEqual(errors, [], 'no runtime page errors');
      assert.deepEqual(requests.filter(r => {const pathname=new URL(r.url).pathname;return !['GET','HEAD'].includes(r.method)||(pathname.startsWith('/api/')&&!(pathname==='/api/case/resume-summary'&&r.method==='GET'));}), [], 'no service or story mutations; only the minimal read-only homepage summary is permitted');
    } finally { await context.close(); }
  }

  for (const width of [320,390,1440]) for (const language of ['ar','en']) await t.test(`${language} ${width}: available films, search and case remain usable`, async () => {
    await withPage({width}, async ({page, requests}) => {
      await page.goto(home + '?lang=' + language, {waitUntil:'load'});
      const frame = page.frameLocator('#site-content');
      await frame.locator('#rvnHeroEnterDeletedName').waitFor();
      assert.equal(await frame.locator('html').getAttribute('lang'), language);
      assert.doesNotMatch(await frame.locator('body').innerText(), RETIRED);
      assert.doesNotMatch(await page.locator('meta[name="description"]').getAttribute('content'), RETIRED);
      assert.doesNotMatch(await frame.locator('meta[name="description"]').getAttribute('content'), RETIRED);
      assert.equal(await frame.locator('#next-premiere,.film.zarqa,.premiereVideo,a[href*="#next-premiere"]').count(), 0, 'promotion is removed, not hidden');
      assert.equal(await frame.locator('html').evaluate(el => el.scrollWidth <= innerWidth + 1), true, 'content fits');
      assert.equal(await page.locator('html').evaluate(el => el.scrollWidth <= innerWidth + 1), true, 'shell fits');
      assert.equal(await page.locator('#music-track-picker option').count(), 13, 'shared soundtrack is preserved');

      if (ARTIFACTS && width !== 320) {
        await frame.locator('body').evaluate(() => scrollTo(0, 0));
        await frame.locator('html').evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const filename = path.join(ARTIFACTS, `homepage-${language}-${width}.png`);
        await page.screenshot({path:filename}); fs.chmodSync(filename, 0o600);
      }
      await frame.locator('.rvnFileTools > summary').click();
      const search = frame.locator('#rvnArchiveSearch');
      for (const query of ['Zarqa','زرقاء']) {
        await search.fill(query);
        assert.equal(await frame.locator('#rvnSearchResults a').count(), 0);
        assert.doesNotMatch(await frame.locator('#rvnSearchStatus').innerText(), RETIRED, 'empty search does not suggest the retired title');
      }
      await search.fill('RAVEN');
      await frame.locator('#rvnSearchResults a').filter({hasText:/RAVEN 17/}).first().click();
      await frame.locator('#episodeModal.open').waitFor();
      assert.equal(await frame.locator('[data-rvn-episode]').count(), 3);
      for (const number of [1,2,3]) {
        await frame.locator(`[data-rvn-episode="${number}"]`).click();
        await frame.locator(`#ravenEpisodePlayer[src$="episode-${number}.mp4"]`).waitFor();
      }
      await page.keyboard.press('Escape');
      await frame.locator('#episodeModal.open').waitFor({state:'hidden'});
      await frame.locator('#rvnHeroEnterDeletedName').click();
      await frame.locator('[data-hook-action="open"]').waitFor();
      assert.equal(await frame.locator('html').getAttribute('lang'), language);
      assert.equal(await frame.locator('#hook').getAttribute('data-phase'), 'start');
      await frame.locator('[data-hook-action="open"]').click();
      await frame.locator('[data-hook-action="enter"]').click();
      assert.equal(await frame.locator('#hook').getAttribute('data-phase'), 'compare');
      assert.equal(await page.evaluate(() => localStorage.getItem('other_app_preferences')), 'retirement-keep');
      assert.equal(await page.locator('#site-soundtrack').evaluate(media => media.paused), true);
      assert.deepEqual(requests.filter(r => RETIRED.test(r.url)), [], 'no retired page, poster or teaser requested');
    });
    results.push({name:`journey ${language} ${width}`, result:'PASS'});
  });

  for (const language of ['ar','en']) await t.test(`${language}: terminal no longer lists or opens the retired project`, async () => {
    await withPage({}, async ({page}) => {
      await page.goto(home + '?lang=' + language, {waitUntil:'load'});
      const frame = page.frameLocator('#site-content');
      await frame.locator('#rvnHeroEnterDeletedName').waitFor();
      await frame.locator('.rvnHeroWatch').press('Backquote');
      await frame.locator('#rvnTerminal').waitFor({state:'visible'});
      const before = page.url();
      for (const command of ['HELP','FILES','ZARQA']) {
        await frame.locator('#rvnTermInput').fill(command);
        await frame.locator('#rvnTermInput').press('Enter');
        assert.doesNotMatch(await frame.locator('#rvnTermOutput').innerText(), RETIRED);
      }
      assert.match(await frame.locator('#rvnTermOutput').innerText(), /UNKNOWN COMMAND|أمر غير معروف/);
      assert.equal(page.url(), before, 'removed command does not route to a missing section');
      await page.keyboard.press('Escape');
      await frame.locator('#rvnTerminal').waitFor({state:'hidden'});
    });
    results.push({name:`terminal ${language}`, result:'PASS'});
  });

  for (const language of ['ar','en']) await t.test(`${language}: old bookmark redirects to the homepage and retains language`, async () => {
    await withPage({}, async ({page}) => {
      await page.goto(home + 'terminal-preview/zarqa/?lang=' + language, {waitUntil:'load'});
      await page.waitForURL(home + '?lang=' + language);
      const frame = page.frameLocator('#site-content');
      await frame.locator('#rvnHeroEnterDeletedName').waitFor();
      assert.equal(await frame.locator('html').getAttribute('lang'), language);
      assert.equal(new URL(page.url()).hash, '');
      assert.doesNotMatch(await frame.locator('body').innerText(), RETIRED);
    });
    results.push({name:`bookmark ${language}`, result:'PASS'});
  });
  await t.test('old bookmark has a safe homepage fallback without JavaScript', async () => {
    await withPage({javascript:false}, async ({page}) => {
      await page.goto(home + 'terminal-preview/zarqa/', {waitUntil:'load'});
      await page.waitForURL(home);
      assert.equal(new URL(page.url()).hash, '');
    });
    results.push({name:'bookmark without JavaScript', result:'PASS'});
  });
});
