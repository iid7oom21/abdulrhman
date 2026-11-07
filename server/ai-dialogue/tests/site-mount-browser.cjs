// Optional Chromium integration: CHROMIUM_PATH=/usr/bin/chromium node --test tests/site-mount-browser.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {chromium} = require('playwright');

test('hosted iframe uses network API, valid CSP and separate journals without changing old browser data', async t => {
  const {createPreviewServer} = await import('../src/server.js');
  const siteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'raven-site-browser-'));
  fs.mkdirSync(path.join(siteRoot, 'raven'));
  fs.writeFileSync(path.join(siteRoot, 'raven/index.html'), '<!doctype html><iframe id="dialogue" src="./dialogue/?lang=en&amp;mode=local"></iframe>');
  const server = createPreviewServer({siteRoot});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const root = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || undefined, args:['--no-sandbox']});
  t.after(async () => { await browser.close(); await new Promise(resolve => server.close(resolve)); fs.rmSync(siteRoot, {recursive:true, force:true}); });
  const context = await browser.newContext(), page = await context.newPage();
  const errors = [], violations = [], api = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(root + '/api/')) api.push(new URL(response.url()).pathname); });
  await page.exposeFunction('reportCSP', directive => violations.push(directive));
  const originals = {
    raven_deleted_name_preview_v2:JSON.stringify({jonas:{draft:'BROWSER_ONLY_DRAFT',records:[{id:'old-simulation',characterId:'jonas',message:'BROWSER_ONLY_MESSAGE',status:'pending',confirmed:false}]}}),
    raven_deleted_name_material_actions_v1:JSON.stringify({draft:{type:'statement',text:'BROWSER_ONLY_MATERIAL',originalId:'',attachments:[]},pending:{id:'old-action',path:'/api/materials',body:{id:'old-action',type:'statement',text:'BROWSER_ONLY_MATERIAL'}}}),
    raven_music_volume_v1:'0.37', unrelated_app:'KEEP',
  };
  await page.addInitScript(values => {
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
    document.addEventListener('securitypolicyviolation', event => window.reportCSP(event.violatedDirective));
  }, originals);
  await page.goto(root + '/raven/');
  const frame = page.frameLocator('#dialogue');
  await frame.locator('#status').filter({hasText:'دُمج'}).waitFor();
  assert.equal(await frame.locator('meta[name="raven-dialogue-transport"]').getAttribute('content'), 'same-origin-server');
  assert.equal(await frame.locator('script[src*="local-api"]').count(), 0);
  assert.match(await frame.locator('[role="note"][lang="en"]').innerText(), /currently available in Arabic/);
  assert.equal(await frame.locator('a[href="/raven/deleted-name/?lang=en"]').count(), 1);
  assert.equal(await frame.locator('#input').inputValue(), '');
  assert.equal(await frame.locator('#material-text').inputValue(), '');
  assert.doesNotMatch(await frame.locator('#log').innerText(), /BROWSER_ONLY/);
  await frame.locator('#input').fill('HOSTED_NETWORK_QUESTION'); await frame.locator('#send').click();
  await frame.locator('#status').filter({hasText:'وصل الرد'}).waitFor();
  assert.ok(api.includes('/api/dialogue')); assert.ok(api.includes('/api/config'));
  const stored = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(originals));
  assert.deepEqual(stored, originals);
  const hosted = await page.evaluate(() => ({
    journal:localStorage.getItem('raven_deleted_name_hosted_server_preview_v2'),
    materials:localStorage.getItem('raven_deleted_name_hosted_server_material_actions_v1'),
  }));
  assert.match(hosted.journal, /HOSTED_NETWORK_QUESTION/); assert.doesNotMatch(hosted.journal, /BROWSER_ONLY/);
  assert.doesNotMatch(hosted.materials || '', /BROWSER_ONLY/);
  await page.reload(); await frame.locator('#status').filter({hasText:'دُمج'}).waitFor();
  assert.match(await frame.locator('#log').innerText(), /HOSTED_NETWORK_QUESTION/);
  assert.doesNotMatch(await frame.locator('#log').innerText(), /BROWSER_ONLY/);
  assert.deepEqual(errors, []); assert.deepEqual(violations, []);
});
