// Native opening navigation must never play a scene or share a private note.
// NODE_PATH=<existing Playwright installation> CHROMIUM_PATH=/usr/bin/chromium node --test tests/opening-navigation-browser.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS = process.env.RAVEN_NAV_ARTIFACTS;

test('opening navigation preserves the scene while making the paper reachable', async t => {
  const server = http.createServer((req, res) => {
    let pathname = new URL(req.url, 'http://local').pathname;
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(ROOT, '.' + pathname);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    const mime = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.mp3':'audio/mpeg'};
    try { res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
  const results = [];
  if (ARTIFACTS) fs.mkdirSync(ARTIFACTS, {recursive:true, mode:0o700});
  t.after(async () => {
    if (ARTIFACTS) fs.writeFileSync(path.join(ARTIFACTS, 'navigation-results.json'), JSON.stringify({browser:browser.version(), results}, null, 2), {mode:0o600});
    await browser.close(); await new Promise(resolve => server.close(resolve));
  });

  async function check(options, run) {
    const context = await browser.newContext({viewport:{width:options.width || 390, height:844}, reducedMotion:'reduce', javaScriptEnabled:options.javascript !== false});
    await context.addInitScript(() => {
      sessionStorage.setItem('raven_studio_ident_v1', '1');
      sessionStorage.setItem('raven_music_enabled_v2', 'off');
      window.__navigationStorage = [];
      for (const method of ['setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args) { window.__navigationStorage.push({method, args}); return original.apply(this, args); };
      }
    });
    const page = await context.newPage(), requests = [], errors = [];
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.startsWith('/api/') || !['GET','HEAD'].includes(request.method())) requests.push({method:request.method(), path:url.pathname});
      return request.url().startsWith(base + '/') ? route.continue() : route.abort();
    });
    const url = base + '/raven/deleted-name/' + (options.shell ? '' : 'content.html') + '?lang=' + (options.language || 'ar');
    try {
      await page.goto(url, {waitUntil:'load'});
      const scope = options.shell ? page.frameLocator('#site-content') : page;
      await scope.locator('.opening-navigation').waitFor();
      const result = await run({page, scope, requests});
      assert.deepEqual(requests, [], 'navigation and reading do not create sessions, read availability early, or send data');
      assert.deepEqual(errors, [], 'no page errors');
      return result;
    } finally { await context.close(); }
  }
  const scene = scope => scope.locator('#hook').evaluate(el => JSON.stringify({...el.dataset}));
  const activeId = scope => scope.locator('html').evaluate(() => document.activeElement.id);
  async function assertFits(scope, width) {
    assert.equal(await scope.locator('html').evaluate(el => el.scrollWidth <= innerWidth + 1), true, 'document does not overflow');
    const boxes = await scope.locator('.opening-navigation a').evaluateAll(links => links.map(a => {const b=a.getBoundingClientRect();return {left:b.left,right:b.right,height:b.height};}));
    for (const box of boxes) { assert.ok(box.left >= 0 && box.right <= width + 1); assert.ok(box.height >= 44, 'each navigation link has a 44px touch target'); }
  }
  async function keyboardJump(page, scope, target) {
    const link = scope.locator('.opening-navigation a[href="#' + target + '"]');
    await link.focus(); await page.keyboard.press('Enter');
    assert.equal(await activeId(scope), target, 'native anchor transfers keyboard focus');
    const visible = await scope.locator('#' + target).evaluate(el => {const r=el.getBoundingClientRect();return r.top >= -1 && r.bottom <= innerHeight + 1;});
    assert.equal(visible, true, 'destination heading is visible');
  }
  async function screenshotArrival(page, scope, name) {
    if (!ARTIFACTS) return;
    await scope.locator('[data-k="a3"]').evaluate(el => window.scrollTo({top:el.getBoundingClientRect().top+scrollY-70, behavior:'instant'}));
    await scope.locator('html').evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await scope.locator('html').evaluate(async () => {
      const images=[...document.images].filter(image => {const b=(image.closest('.cast-portrait') || image).getBoundingClientRect();return b.bottom>0&&b.top<innerHeight;});
      await Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise(resolve => {image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});})));
    });
    const file = path.join(ARTIFACTS, name + '.png'); await page.screenshot({path:file}); fs.chmodSync(file,0o600);
  }

  const cases = [320,390,768,1440].flatMap(width => ['ar','en'].map(language => ({width,language,shell:false})));
  cases.push(...[320,390].flatMap(width => ['ar','en'].map(language => ({width,language,shell:true}))));
  for (const options of cases) {
    const name = `${options.language} ${options.width} ${options.shell ? 'shell' : 'direct'}`;
    await t.test(name, async () => {
      const evidence = await check(options, async ({page, scope}) => {
        const before = await scene(scope);
        const label = await scope.locator('.opening-navigation-primary').innerText();
        assert.equal(label, options.language === 'ar' ? 'انتقل إلى الورقة' : 'Go to the paper');
        assert.equal(await scope.locator('.opening-navigation').evaluate(el => Boolean(el.compareDocumentPosition(document.querySelector('#t-cast')) & Node.DOCUMENT_POSITION_FOLLOWING)), true, 'navigation appears before the cast cards');
        await assertFits(scope, options.width);
        await scope.locator('html').evaluate(() => { window.__navigationStorage = []; });
        for (const target of ['t-hook','t-cast','t-rules','t-hook']) {
          await keyboardJump(page, scope, target);
          assert.equal(await scene(scope), before, 'navigation never advances the story');
        }
        assert.deepEqual(await scope.locator('html').evaluate(() => window.__navigationStorage), [], 'anchors do not write opening state to storage');
        assert.equal(await scope.locator('#hook-document').count(), 0, 'no document is revealed by following navigation');
        if (options.width <= 390 && options.language === 'ar') await screenshotArrival(page,scope,`after-arrival-${options.width}-${options.shell?'shell':'direct'}-ar`);
        return {phase:'start', targets:['t-hook','t-cast','t-rules'], width:options.width, language:options.language, shell:options.shell};
      });
      results.push({name, result:'PASS', evidence});
    });
  }

  for (const language of ['ar','en']) await t.test(`${language}: returning to the paper and changing language retains notes and comparison`, async () => {
    await check({language,shell:true}, async ({page,scope}) => {
      await scope.locator('[data-hook-action="open"]').click();
      await scope.locator('[data-hook-action="enter"]').click();
      await scope.locator('[data-hook-action="compare-toggle"]').click();
      await scope.locator('[data-hook-action="source-original"]').click();
      await scope.locator('#reading-note').fill('Synthetic saved observation');
      await scope.locator('#reading-add').click();
      await scope.locator('#reading-note').fill('Synthetic unfinished thought');
      const before = await scene(scope);
      const notes = await scope.locator('#reading-tools').getAttribute('data-notes');
      for (const target of ['t-cast','t-rules','t-hook']) await keyboardJump(page,scope,target);
      assert.equal(await scene(scope), before);
      assert.equal(await scope.locator('#reading-tools').getAttribute('data-notes'), notes);
      assert.equal(await scope.locator('#reading-note').inputValue(), 'Synthetic unfinished thought');
      await scope.locator('#lang-switch').click();
      assert.equal(await scope.locator('#hook').getAttribute('data-phase'), 'compare');
      assert.equal(await scope.locator('#reading-note').inputValue(), 'Synthetic unfinished thought');
      assert.deepEqual(JSON.parse(await scope.locator('#reading-tools').getAttribute('data-notes')).entries.map(n=>n.text), ['Synthetic saved observation']);
      assert.equal(await scope.locator('.opening-navigation-primary').innerText(), language === 'ar' ? 'Go to the paper' : 'انتقل إلى الورقة');
      assert.equal(await scope.locator('#hook-comparison').isVisible(), true);
    });
    results.push({name:`${language} retained notes`,result:'PASS'});
  });
  await t.test('native paper link works without JavaScript', async () => {
    await check({javascript:false}, async ({page,scope}) => {
      await keyboardJump(page,scope,'t-hook');
      assert.equal(new URL(page.url()).hash,'#t-hook');
      assert.equal(await scope.locator('#hook-actions button').count(),0, 'navigation does not pretend the disabled script played a scene');
    });
    results.push({name:'no JavaScript native anchor',result:'PASS'});
  });
  await t.test('navigation wraps at doubled text size on a narrow viewport', async () => {
    await check({width:320}, async ({page,scope}) => {
      await page.addStyleTag({content:'body{font-size:32px!important}'});
      await assertFits(scope,320); await keyboardJump(page,scope,'t-hook');
    });
    results.push({name:'doubled text320',result:'PASS'});
  });
});
