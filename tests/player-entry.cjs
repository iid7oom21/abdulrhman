// Run: CHROMIUM_PATH=/usr/bin/chromium node --test tests/player-entry.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const mount = '/abdulrhman';
const homePath = mount + '/raven/';

// Valid preview data, with deliberate whitespace to catch even harmless rewrites.
const stored = {
  raven_dialogue_static_backend_v1: '[\n  \n]\n',
  raven_dialogue_static_backend_v2: JSON.stringify({version:2, log:[
    {path:'/api/materials', data:{id:'entry-existing-material', type:'statement', text:'Existing statement before homepage visit'}},
    {path:'/api/shares', data:{eventId:'entry-existing-share', materialId:'entry-existing-material', recipients:['jonas']}}
  ]}, null, 2) + '\n',
  raven_deleted_name_preview_v2: JSON.stringify({
    jonas:{draft:'Existing unsent question', records:[]},
    claire:{draft:'Another unsent question', records:[]}
  }, null, 2) + '\n',
  raven_deleted_name_material_actions_v1: JSON.stringify({
    draft:{type:'private_note', text:'Existing unsaved note', originalId:'', attachments:[]}, pending:null
  }, null, 2) + '\n',
  other_app_preferences: '  keep this byte-for-byte  '
};

test('homepage offers the case directly without starting the dialogue preview', async t => {
  const server = http.createServer((req, res) => {
    let pathname = new URL(req.url, 'http://local').pathname;
    if (!pathname.startsWith(mount + '/')) { res.writeHead(404); return res.end(); }
    pathname = pathname.slice(mount.length);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const mime = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml'};
    try {
      if (!fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
      if (req.method === 'HEAD') res.end();
      else res.end(fs.readFileSync(file));
    }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
  t.after(() => browser.close());

  for (const [language, width] of [['ar',390], ['en',1366]]) {
    await t.test(language + ': hero and case card enter the case, preserving the player and saved preview', async t => {
      const context = await browser.newContext({viewport:{width,height:844}, reducedMotion:'reduce'});
      t.after(() => context.close());
      const requests = [], writes = [], errors = [];
      context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
      await context.route('**/*', route => {
        const request = route.request();
        requests.push({url:request.url(), method:request.method()});
        if (!['GET','HEAD'].includes(request.method())) writes.push(request.method() + ' ' + request.url());
        // Offline external resources: no real API, contact, or payment service is contacted.
        return request.url().startsWith(base + '/') ? route.continue() : route.abort();
      });
      await context.addInitScript(({values,origin}) => {
        if (location.origin !== origin) return;
        if (localStorage.getItem('entry-test-seeded') !== '1') {
          for (const [key,value] of Object.entries(values)) localStorage.setItem(key,value);
          localStorage.setItem('entry-test-seeded','1');
        }
      }, {values:stored,origin:base});
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const frame = page.frameLocator('#site-content');
      const suffix = language === 'en' ? '?lang=en' : '';
      const caseHref = './deleted-name/' + suffix;
      const assertStored = async () => {
        assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key,localStorage.getItem(key)])), Object.keys(stored)), stored,
          'visiting the homepage and opening scene must preserve every saved preview byte');
      };
      const assertNoPreview = () => {
        assert.deepEqual(requests.filter(request => {
          const url = new URL(request.url);
          const resumeSummary = request.method === 'GET' && url.origin === base && url.pathname === '/api/case/resume-summary';
          return !resumeSummary && /\/raven\/dialogue(?:\/|$)|\/local-api\.js(?:\?|$)|\/api(?:\/|$)/.test(url.pathname);
        }), [], 'only the same-origin read-only resume summary is allowed; no dialogue page, local API adapter, or other API');
        assert.deepEqual(writes, [], 'navigation must never send an automatic network action');
      };
      const assertCase = async () => {
        await page.waitForURL(url => url.pathname === homePath + 'deleted-name/' && (url.searchParams.get('lang') === 'en') === (language === 'en'));
        await frame.locator('#hook').waitFor();
        assert.equal(await frame.locator('html').getAttribute('lang'), language);
        assert.equal(await page.locator('audio').count(), 1);
        assert.equal(await page.locator('#site-soundtrack').getAttribute('data-entry-marker'), 'retained');
        assert.equal(await frame.locator('audio').count(), 0);
        await assertStored();
        assertNoPreview();
      };

      await page.goto(base + homePath + '?lang=' + language);
      await page.locator('#archive-skip').click();
      await frame.locator('html[lang="' + language + '"]').waitFor();
      const hero = frame.locator('[data-dn-link="hero"]');
      assert.equal(await hero.count(), 1);
      assert.equal(await hero.innerText(), language === 'en' ? 'Discover The Deleted Name' : 'اكتشف قضية الاسم المحذوف');
      assert.equal(await hero.getAttribute('href'), caseHref);
      assert.equal(await page.locator('#music-track-picker option').count(), 13);
      assert.equal(await frame.locator('[data-rvn-episode]').count(), 3);
      assert.equal(await frame.locator('#rvnDialogueFrame').count(), 0);
      assert.equal(await frame.locator('[data-dn-k="previewLabel"], [data-dn-k="openPreview"]').count(), 0);
      assert.deepEqual(await frame.locator('[data-rvn-v2="deletedName"]').allTextContents(),
        Array(2).fill(language === 'en' ? 'The Deleted Name' : 'الاسم المحذوف'));
      for (const link of await frame.locator('[data-rvn-v2="deletedName"]').all()) assert.equal(await link.getAttribute('href'), '#deleted-name-experience');
      const contact = frame.locator('[data-rvn-i18n="contactOriginal"]');
      assert.equal(await contact.getAttribute('href'), 'https://wa.me/966565365000');
      assert.equal(await contact.getAttribute('target'), '_blank');
      assert.match(await contact.innerText(), language === 'en' ? /WhatsApp/ : /واتساب/);
      await assertStored();
      assertNoPreview();

      await page.locator('#site-soundtrack').evaluate(audio => { audio.dataset.entryMarker = 'retained'; });
      await hero.focus();
      assert.equal(await hero.evaluate(link => link === document.activeElement && link.tabIndex === 0), true);
      await page.keyboard.press('Enter');
      await assertCase();

      await frame.locator('a.brand').click();
      await frame.locator('[data-dn-link="hero"]').waitFor();
      await page.waitForURL(url => url.pathname === homePath && (url.searchParams.get('lang') === 'en') === (language === 'en'));
      assert.equal(await frame.locator('html').getAttribute('lang'), language);
      if (width < 800) await frame.locator('#ravenMenuToggle').click();
      const menu = frame.locator('[data-rvn-v2="deletedName"]:visible');
      await menu.click();
      await page.waitForURL(url => url.hash === '#deleted-name-experience');
      const card = frame.locator('#dialogue-preview');
      assert.equal(await card.isVisible(), true);
      assert.match(await card.locator('[data-dn-k="eyebrow"]').innerText(), language === 'en' ? /In development/i : /قيد التطوير/);
      const castReference = card.locator('.rvnVisualCastReference');
      assert.equal(await castReference.evaluate(details => details.open), false, 'the visual reference stays optional at entry');
      await castReference.locator('summary').click();
      assert.equal(await castReference.evaluate(details => details.open), true, 'the reader opens the reference using its native summary');
      const portraits = card.locator('[data-dn-entry]');
      assert.equal(await portraits.count(), 6);
      for (const link of await portraits.all()) assert.equal(await link.getAttribute('href'), caseHref);
      assert.deepEqual(await portraits.locator('strong').allTextContents(), language === 'en'
        ? ['Jonas', 'Claire', 'Elena', 'Mateo', 'Noah', 'Lounge table']
        : ['يوناس', 'كلير', 'إيلينا', 'ماتيو', 'نوح', 'طاولة الصالة']);
      if (language === 'en') assert.doesNotMatch(await card.innerText(), /[\u0600-\u06ff]/, 'the English card has no untranslated Arabic roles or disclaimer');
      assert.match(await card.locator('[data-dn-k="illustrationNote"]').innerText(), language === 'en' ? /written materials/ : /المواد المكتوبة/);
      const images = portraits.locator('img');
      assert.equal(await images.count(), 6, 'the case card retains all five portraits and the evidence-table illustration');
      assert.equal(await card.locator('.rvnVisualCaseArt img').count(), 1, 'the new case-entry art is separate from the six original reference cards');
      assert.deepEqual(await images.evaluateAll(nodes => nodes.map(img => img.alt)), language === 'en'
        ? ['Jonas', 'Claire', 'Elena', 'Mateo', 'Noah', 'Artist’s impression of the table of papers']
        : ['يوناس', 'كلير', 'إيلينا', 'ماتيو', 'نوح', 'تصور فني لطاولة الأوراق']);
      for (const image of await images.all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(img => img.complete && img.naturalWidth > 0 ? undefined : new Promise((resolve,reject) => {
          img.addEventListener('load',resolve,{once:true}); img.addEventListener('error',() => reject(new Error('case image failed to load')),{once:true});
        }));
        assert.ok(await image.evaluate(img => img.naturalWidth > 0), 'every case card image loads');
      }
      assert.equal(await card.locator('[data-dn-k="enter"]').getAttribute('href'), caseHref);
      assert.equal(await card.locator('iframe').count(), 0);
      await assertStored();
      assertNoPreview();

      await portraits.first().click();
      await assertCase();
      await frame.locator('a.brand').click();
      await frame.locator('[data-dn-link="hero"]').waitFor();
      await page.reload();
      await frame.locator('html[lang="' + language + '"]').waitFor();
      assert.equal(await frame.locator('[data-dn-link="hero"]').getAttribute('href'), caseHref);
      await assertStored();
      assertNoPreview();
      await page.locator('#site-soundtrack').evaluate(audio => { audio.dataset.entryMarker = 'retained'; });
      await frame.locator('#dialogue-preview [data-dn-k="enter"]').click();
      await assertCase();

      // The technical preview is still available when the reader explicitly opens it.
      const previewLink = frame.locator('[data-k="nowBtn"]');
      assert.equal(await previewLink.getAttribute('href'), '../dialogue/' + suffix);
      assert.equal(await previewLink.getAttribute('target'), '_blank');
      assert.match(await previewLink.innerText(), language === 'en' ? /Technical dialogue preview/ : /معاينة الحوار التقنية/);
      const popupPromise = context.waitForEvent('page');
      await previewLink.click();
      const preview = await popupPromise;
      await preview.waitForURL(base + homePath + 'dialogue/' + suffix);
      await preview.locator('#status').filter({hasText:/دُمج|merged/}).waitFor();
      assert.equal(await preview.locator('html').getAttribute('lang'), language);
      assert.equal(await preview.locator('#input').inputValue(), 'Existing unsent question');
      const material = preview.locator('#materials-list [data-material-id="entry-existing-material"]');
      await material.waitFor({state:'attached'});
      assert.equal(await material.count(), 1);
      assert.deepEqual(writes, [], 'opening the preview must not automatically submit the saved question or material draft');
      assert.deepEqual(errors, []);
    });
  }

  await t.test('project-path reloads, homepage destinations and direct entries without a case server', async t => {
    const context = await browser.newContext({viewport:{width:1280,height:900}, reducedMotion:'reduce'});
    t.after(() => context.close());
    await context.addInitScript(() => { sessionStorage.setItem('raven_studio_ident_v1','1'); });
    const missing = [], lookups = [], resumeLookups = [], writes = [], errors = [];
    await context.route('**/*', route => {
      const request = route.request();
      if (!['GET','HEAD'].includes(request.method())) writes.push(request.method() + ' ' + request.url());
      return new URL(request.url()).origin === base ? route.continue() : route.abort();
    });
    context.on('response', response => {
      const url = new URL(response.url());
      if (url.origin !== base) return;
      if (url.pathname === '/api/case/config') lookups.push(response.status());
      else if (url.pathname === '/api/case/resume-summary' && response.request().method() === 'GET') resumeLookups.push(response.status());
      else if (response.status() >= 400) missing.push(response.status() + ' ' + url.pathname);
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    const frame = page.frameLocator('#site-content');

    for (const [path, ready] of [['', '#rvnHeroEnterDeletedName'], ['deleted-name/', '#hook']]) {
      const url = base + homePath + path + '?lang=en';
      await page.goto(url);
      await frame.locator(ready).waitFor();
      await page.reload();
      await frame.locator(ready).waitFor();
      assert.equal(page.url(), url);
      assert.equal(await frame.locator('html').getAttribute('lang'), 'en');
      // Lazy pictures and idle player sources may never issue a GET during a direct visit.
      const assets = await frame.locator('img[src],script[src],source[src],video[src],video[poster],link[rel="stylesheet"],link[rel="icon"]').evaluateAll(nodes =>
        [...new Set(nodes.flatMap(node => [node.src, node.poster, node.href]).filter(url => url && new URL(url).origin === location.origin))]);
      for (const asset of assets) assert.equal((await context.request.head(asset)).status(), 200, asset);
    }
    await frame.locator('a.brand').click();
    await frame.locator('.rvnHeroWatch').waitFor();
    assert.equal(await page.locator('link[rel="icon"]').evaluate(icon => new URL(icon.href).pathname), homePath + 'assets/favicon.svg');
    await frame.locator('.rvnHeroWatch').click();
    await frame.locator('#episodeModal[aria-hidden="false"]').waitFor();
    assert.deepEqual(await frame.locator('[data-rvn-episode]').evaluateAll(nodes => nodes.map(node => node.dataset.rvnEpisode)), ['1','2','3']);
    await frame.locator('.episodeClose').click();
    await frame.locator('[data-rvn-v2="studio"]:visible').click();
    await page.waitForURL(url => url.pathname === homePath && url.hash === '#studio');
    assert.equal(await frame.locator('#studio .rvnStudioCard:visible').count(), 3);
    assert.equal(await frame.locator('a[href*="investigation-lab"],a[href*="localhost"],a[href*="127.0.0.1"]').count(), 0);

    for (const path of ['deleted-name/play/','investigation-lab/']) {
      await page.goto(base + homePath + path + '?lang=en');
      await frame.locator('#connection-title').filter({hasText:'The connected case is unavailable here'}).waitFor();
      assert.match(await frame.locator('#connection-message').innerText(), /without its server/);
      assert.equal(await frame.locator('#case-app').isVisible(), false);
      await frame.locator('#home-link').click();
      await page.waitForURL(url => url.pathname === homePath && url.searchParams.get('lang') === 'en');
      await frame.locator('#rvnHeroEnterDeletedName').waitFor();
    }
    assert.deepEqual(lookups, [404,404]);
    assert.ok(resumeLookups.length > 0 && resumeLookups.every(status => status === 404));
    assert.equal(await frame.locator('#rvnCaseResume').isHidden(), true);
    assert.deepEqual(missing, [], 'all requested static assets resolve under the project mount');
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
  });

  await t.test('English portrait and illustration entries retain language when browser storage is unavailable', async t => {
    const context = await browser.newContext({viewport:{width:390,height:844}, reducedMotion:'reduce'});
    t.after(() => context.close());
    const errors = [], writes = [], api = [];
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    await context.route('**/*', route => {
      const request = route.request();
      if (!['GET','HEAD'].includes(request.method())) writes.push(request.method() + ' ' + request.url());
      const url = new URL(request.url());
      const resumeSummary = request.method() === 'GET' && url.origin === base && url.pathname === '/api/case/resume-summary';
      if (!resumeSummary && /\/api(?:\/|$)|\/raven\/dialogue(?:\/|$)|\/local-api\.js(?:\?|$)/.test(url.pathname)) api.push(request.url());
      return request.url().startsWith(base + '/') ? route.continue() : route.abort();
    });
    await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() { throw new DOMException('Browser storage unavailable in this fixture', 'SecurityError'); }
      });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const frame = page.frameLocator('#site-content');
    for (const index of [0, 5]) {
      await page.goto(base + homePath + '?lang=en');
      if (await page.locator('#archive-skip').isVisible()) await page.locator('#archive-skip').click();
      await frame.locator('html[lang="en"]').waitFor();
      if (index === 0) {
        for (const language of ['ar', 'en']) {
          await frame.locator('[data-raven-language="' + language + '"]').click();
          await frame.locator('html[lang="' + language + '"]').waitFor();
          const expected = './deleted-name/' + (language === 'en' ? '?lang=en' : '');
          for (const link of await frame.locator('[data-dn-entry]').all()) assert.equal(await link.getAttribute('href'), expected);
          assert.equal(await frame.locator('[data-dn-entry] img').first().getAttribute('alt'), language === 'en' ? 'Jonas' : 'يوناس');
        }
      }
      await page.evaluate(() => { window.__entryAudio = document.querySelector('#site-soundtrack'); });
      const castReference = frame.locator('#dialogue-preview .rvnVisualCastReference');
      assert.equal(await castReference.evaluate(details => details.open), false);
      await castReference.locator('summary').click();
      assert.equal(await castReference.evaluate(details => details.open), true);
      await frame.locator('#dialogue-preview [data-dn-entry]').nth(index).click();
      await page.waitForURL(url => url.pathname === homePath + 'deleted-name/' && url.searchParams.get('lang') === 'en');
      await frame.locator('#hook').waitFor();
      assert.equal(await frame.locator('html').getAttribute('lang'), 'en', 'entry must not depend on a saved language preference');
      assert.equal(await page.evaluate(() => window.__entryAudio === document.querySelector('#site-soundtrack')), true);
      assert.equal(await page.locator('audio').count(), 1);
      assert.equal(await frame.locator('audio').count(), 0);
      assert.equal(await page.locator('#music-track-picker option').count(), 13);
    }
    assert.deepEqual(writes, [], 'entering a case never submits an action');
    assert.deepEqual(api, [], 'entry permits only the same-origin read-only resume summary, never the technical preview, local adapter, or other API');
    assert.deepEqual(errors, []);
  });
});
