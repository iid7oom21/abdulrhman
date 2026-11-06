const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const backendKey = 'raven_dialogue_static_backend_v2';

test('player language survives navigation and simulation keeps each recorded reply stable', async t => {
  const server = http.createServer((req, res) => {
    let pathname = new URL(req.url, 'http://local').pathname;
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const mime = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json'};
    try { res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file)); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
  t.after(async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); });
  async function session() {
    const context = await browser.newContext({viewport:{width:390,height:844}, reducedMotion:'reduce'});
    const page = await context.newPage(), errors = [], writes = [];
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (!['GET','HEAD'].includes(route.request().method())) writes.push(route.request().url());
      return route.request().url().startsWith(base) ? route.continue() : route.abort();
    });
    return {context, page, errors, writes};
  }
  const ready = page => page.locator('#status').filter({hasText:/دُمج|merged/}).waitFor();
  const saved = page => page.locator('#status').filter({hasText:/وصل الرد|The reply arrived/}).waitFor();
  async function ask(page, text) {
    await page.fill('#input', text); await page.click('#send'); await saved(page);
  }

  await t.test('homepage EN survives refresh, reaches the opening, and returns in English', async () => {
    const {context,page,errors} = await session();
    await page.goto(base + '/raven/?ref=language-check');
    await page.click('#archive-skip');
    const frame = page.frameLocator('#site-content');
    await frame.locator('[data-raven-language="en"]').click();
    await page.waitForURL(url => url.searchParams.get('lang') === 'en');
    assert.equal(new URL(page.url()).searchParams.get('ref'), 'language-check');
    assert.match(await frame.locator('[data-raven-language="en"]').getAttribute('href'), /lang=en/);
    assert.equal(await frame.locator('.rvnHeroDialogue').innerText(), 'Dialogue simulation — The Deleted Name');
    await frame.locator('#ravenMenuToggle').click();
    const mobileLink = frame.locator('#ravenNavPanel a[href="#dialogue-preview"]');
    assert.equal(await mobileLink.isVisible(), true);
    assert.equal(await mobileLink.innerText(), 'Dialogue simulation');
    assert.deepEqual(await frame.locator('[data-dn-link="menu"]').allTextContents(), ['Dialogue simulation', 'Dialogue simulation']);
    await frame.locator('#ravenMenuToggle').click();
    await page.reload();
    await frame.locator('html[lang="en"]').waitFor();
    await frame.locator('[data-dn-k="enter"]').click();
    await frame.locator('#hook').waitFor();
    assert.equal(await frame.locator('html').getAttribute('lang'), 'en');
    assert.match(await frame.locator('[data-k="nowBtn"]').getAttribute('href'), /lang=en/);
    await frame.locator('.brand').click();
    await frame.locator('.rvnHeroWatch').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('lang'), 'en');
    assert.equal(await frame.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#music-track-picker option').count(), 13);
    assert.equal(await frame.locator('[data-rvn-episode]').count(), 3);
    await frame.locator('[data-raven-language="ar"]').click();
    await page.waitForURL(url => !url.searchParams.has('lang'));
    await page.reload();
    await frame.locator('html[lang="ar"]').waitFor();
    assert.deepEqual(errors, []); await context.close();
  });

  for (const language of ['ar','en']) await t.test(language + ': only shared materials appear, with localized receipt and stable history', async () => {
    const {context,page,errors,writes} = await session();
    await page.goto(base + '/raven/dialogue/?lang=' + language); await ready(page);
    await ask(page, language === 'en' ? 'What do you know about the draft?' : 'ماذا تعرف عن المسودة؟');
    assert.match(await page.locator('#log').innerText(), language === 'en' ? /The original text of this statement is not available/ : /النص الأصلي لهذه الإفادة غير متاح/);
    await page.click('#materials-panel summary');
    const create = async (type, text, originalId) => {
      const count = await page.locator('#materials-list .material').count();
      await page.selectOption('#material-type', type);
      if (originalId) await page.selectOption('#material-original', originalId);
      await page.fill('#material-text', text); await page.click('#material-save');
      await page.waitForFunction(count => document.querySelectorAll('#materials-list .material').length === count + 1, count);
      return page.locator('#materials-list .material').last().getAttribute('data-material-id');
    };
    const share = async id => {
      await page.selectOption('#share-material', id); await page.click('#material-share');
      await page.locator('#knowledge-list [data-material-id="' + id + '"]').waitFor();
    };
    const original = await create('statement', 'SHARED-STATEMENT'); await share(original);
    const correction = await create('correction', 'SHARED-CORRECTION', original); await share(correction);
    await create('private_note', 'PRIVATE-UNSHARED');
    await ask(page, language === 'en' ? 'What materials did I share?' : 'ما المواد التي شاركتها؟');
    const record = await page.locator('#log').innerText();
    assert.match(record, language === 'en' ? /These materials reached me; recording a statement does not prove it true/ : /هذه المواد وصلتني؛ تسجيل القول لا يثبت صحته/);
    assert.match(record, language === 'en' ? /Latest known correction: SHARED-CORRECTION/ : /تصحيح أحدث معروف: SHARED-CORRECTION/);
    assert.match(record, /SHARED-STATEMENT/); assert.doesNotMatch(record, /PRIVATE-UNSHARED/);
    await page.selectOption('#character', 'claire'); await ready(page);
    await ask(page, language === 'en' ? 'What materials did I share?' : 'ما المواد التي شاركتها؟');
    assert.doesNotMatch(await page.locator('#log').innerText(), /SHARED-STATEMENT|SHARED-CORRECTION/);
    const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), backendKey);
    const dialogue = before.log.filter(entry => entry.path === '/api/dialogue');
    assert.equal(dialogue.length, 3); assert.ok(dialogue.every(entry => entry.data.language === language));
    const conflict = await page.evaluate(async data => {
      const res = await fetch('/api/dialogue', {method:'POST', body:JSON.stringify(data)});
      return {status:res.status, body:await res.json()};
    }, {...dialogue[0].data,language:language === 'en' ? 'ar' : 'en'});
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error, 'request_id_conflict', 'an operation cannot be reused with a different reply language');
    const replies = await page.evaluate(async () => (await (await fetch('/api/history')).json()).items.map(item => ({id:item.id,response:item.response})));
    await page.goto(base + '/raven/dialogue/?lang=' + (language === 'en' ? 'ar' : 'en')); await ready(page);
    const restored = await page.evaluate(async () => (await (await fetch('/api/history')).json()).items.map(item => ({id:item.id,response:item.response})));
    assert.deepEqual(restored, replies, 'changing display language must not regenerate or translate recorded replies');
    await page.click('#check'); await saved(page);
    const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), backendKey);
    assert.deepEqual(after, before, 'following an existing operation must not add a new write');
    assert.deepEqual(writes, [], 'static preview must not send actions to a network server');
    assert.deepEqual(errors, []); await context.close();
  });

  await t.test('old saved requests keep their original Arabic behavior and unrelated browser preferences', async () => {
    const {context,page,errors} = await session();
    const log = [
      {path:'/api/materials',data:{id:'legacy-material',type:'statement',text:'LEGACY-SHARED'}},
      {path:'/api/shares',data:{eventId:'legacy-share',materialId:'legacy-material',recipients:['jonas']}},
      {path:'/api/dialogue',data:{requestId:'legacy-question',characterId:'jonas',message:'What materials did I share?'}}
    ];
    const original = JSON.stringify({version:2,log});
    await context.addInitScript(({key,original}) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key,original);
      localStorage.setItem('other_app_preferences','keep');
    }, {key:backendKey,original});
    await page.goto(base + '/raven/dialogue/?lang=en'); await ready(page);
    const reply = await page.locator('#log').innerText();
    assert.match(reply, /النص الأصلي لهذه الإفادة غير متاح/);
    assert.doesNotMatch(reply, /LEGACY-SHARED/);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), backendKey), original);
    assert.equal(await page.evaluate(() => localStorage.getItem('other_app_preferences')), 'keep');
    assert.deepEqual(errors, []); await context.close();
  });
});
