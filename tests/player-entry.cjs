// Run: CHROMIUM_PATH=/usr/bin/chromium node --test tests/player-entry.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');

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
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const mime = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml'};
    try { res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
  t.after(() => browser.close());

  for (const [language, width] of [['ar',390], ['en',1366]]) {
    await t.test(language + ': hero and legacy card enter the case, preserving the player and saved preview', async t => {
      const context = await browser.newContext({viewport:{width,height:844}, reducedMotion:'reduce'});
      t.after(() => context.close());
      const requests = [], writes = [], errors = [];
      context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
      await context.route('**/*', route => {
        const request = route.request();
        requests.push(request.url());
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
        assert.deepEqual(requests.filter(url => /\/raven\/dialogue(?:\/|$)|\/local-api\.js(?:\?|$)|\/api(?:\/|$)/.test(new URL(url).pathname)), [],
          'the homepage and case entry must not request the dialogue page, local API adapter, or any API');
        assert.deepEqual(writes, [], 'navigation must never send an automatic network action');
      };
      const assertCase = async () => {
        await page.waitForURL(url => url.pathname === '/raven/deleted-name/' && (url.searchParams.get('lang') === 'en') === (language === 'en'));
        await frame.locator('#hook').waitFor();
        assert.equal(await frame.locator('html').getAttribute('lang'), language);
        assert.equal(await page.locator('audio').count(), 1);
        assert.equal(await page.locator('#site-soundtrack').getAttribute('data-entry-marker'), 'retained');
        assert.equal(await frame.locator('audio').count(), 0);
        await assertStored();
        assertNoPreview();
      };

      await page.goto(base + '/raven/?lang=' + language);
      await page.locator('#archive-skip').click();
      await frame.locator('html[lang="' + language + '"]').waitFor();
      const hero = frame.locator('.rvnHeroDialogue');
      assert.equal(await hero.innerText(), language === 'en' ? 'Discover The Deleted Name' : 'اكتشف قضية الاسم المحذوف');
      assert.equal(await hero.getAttribute('href'), caseHref);
      assert.equal(await page.locator('#music-track-picker option').count(), 13);
      assert.equal(await frame.locator('[data-rvn-episode]').count(), 3);
      assert.equal(await frame.locator('#rvnDialogueFrame').count(), 0);
      assert.equal(await frame.locator('[data-dn-k="previewLabel"], [data-dn-k="openPreview"]').count(), 0);
      assert.deepEqual(await frame.locator('[data-dn-link="menu"]').allTextContents(),
        Array(2).fill(language === 'en' ? 'The Deleted Name' : 'الاسم المحذوف'));
      for (const link of await frame.locator('[data-dn-link="menu"]').all()) assert.equal(await link.getAttribute('href'), '#dialogue-preview');
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
      await frame.locator('.rvnHeroDialogue').waitFor();
      await page.waitForURL(url => url.pathname === '/raven/' && (url.searchParams.get('lang') === 'en') === (language === 'en'));
      assert.equal(await frame.locator('html').getAttribute('lang'), language);
      if (width < 800) await frame.locator('#ravenMenuToggle').click();
      const menu = frame.locator('[data-dn-link="menu"]:visible');
      await menu.click();
      await page.waitForURL(url => url.hash === '#dialogue-preview');
      const card = frame.locator('#dialogue-preview');
      assert.equal(await card.isVisible(), true);
      assert.match(await card.locator('[data-dn-k="eyebrow"]').innerText(), language === 'en' ? /In development/i : /قيد التطوير/);
      const image = card.locator('img');
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(img => img.complete && img.naturalWidth > 0 ? undefined : new Promise((resolve,reject) => {
        img.addEventListener('load',resolve,{once:true}); img.addEventListener('error',() => reject(new Error('case image failed to load')),{once:true});
      }));
      assert.ok(await image.evaluate(img => img.naturalWidth > 0), 'the case card retains its image');
      assert.equal(await card.locator('[data-dn-k="enter"]').getAttribute('href'), caseHref);
      assert.equal(await card.locator('iframe').count(), 0);
      await assertStored();
      assertNoPreview();

      await page.reload();
      await frame.locator('html[lang="' + language + '"]').waitFor();
      assert.equal(await frame.locator('.rvnHeroDialogue').getAttribute('href'), caseHref);
      await assertStored();
      assertNoPreview();
      await page.locator('#site-soundtrack').evaluate(audio => { audio.dataset.entryMarker = 'retained'; });
      await frame.locator('#dialogue-preview [data-dn-k="enter"]').click();
      await assertCase();

      // The technical preview is still available when the reader explicitly opens it.
      const previewLink = frame.locator('[data-k="nowBtn"]');
      assert.equal(await previewLink.getAttribute('href'), '../dialogue/' + suffix);
      assert.equal(await previewLink.getAttribute('target'), '_blank');
      const popupPromise = context.waitForEvent('page');
      await previewLink.click();
      const preview = await popupPromise;
      await preview.waitForURL(base + '/raven/dialogue/' + suffix);
      await preview.locator('#status').filter({hasText:/دُمج|merged/}).waitFor();
      assert.equal(await preview.locator('html').getAttribute('lang'), language);
      assert.equal(await preview.locator('#input').inputValue(), 'Existing unsent question');
      assert.equal(await preview.locator('#materials-list [data-material-id="entry-existing-material"]').count(), 1);
      assert.deepEqual(writes, [], 'opening the preview must not automatically submit the saved question or material draft');
      assert.deepEqual(errors, []);
    });
  }
});
