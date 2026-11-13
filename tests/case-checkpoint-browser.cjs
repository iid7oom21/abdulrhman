const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

// Real HTTP + encrypted checkpoint integration, using only the service's
// invented mechanics fixture. No private case pack is loaded by these tests.
// RAVEN_CASE_SERVICE_ROOT=/path/to/server/ai-dialogue node --test tests/case-checkpoint-browser.cjs
const ROOT = path.resolve(__dirname, '..');
const SERVICE = process.env.RAVEN_CASE_SERVICE_ROOT || path.resolve(ROOT, '../abdulrhman/server/ai-dialogue');
const ENTRY = path.join(SERVICE, 'src/server.js');
const PAGE = '/raven/deleted-name/play/content.html?lang=en';
const KEY = 'raven_case_checkpoint_v1.fixture';
const PENDING = 'raven_case_pending_operation_v1';
const SECRET = 'ab'.repeat(32);
const clone = value => JSON.parse(JSON.stringify(value));

async function eventually(predicate, message) {
  const end = Date.now() + 8000;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail(message);
}
const textIncludes = (page, selector, text) => page.waitForFunction(({selector,text}) => document.querySelector(selector)?.textContent.includes(text), {selector,text});
const rawSave = page => page.evaluate(key => localStorage.getItem(key), KEY);
const saved = async page => JSON.parse(await rawSave(page));
const pending = page => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)), PENDING);
const idle = page => page.waitForFunction(() => document.body.getAttribute('aria-busy') === 'false');
const ready = async page => {await idle(page);await textIncludes(page, '#save-status', 'Progress is saved in this browser.');};

async function harness(createPreviewServer, fixturePack) {
  const api = {requests:[],dropAction:false,holdState:false,heldState:null,invalidCheckpoint:false,invalidActionCheckpoint:false,server:null,port:0};
  api.start = async (key = SECRET) => {
    api.server = createPreviewServer({siteRoot:ROOT,casePack:fixturePack(),caseCheckpointKey:key,generate:() => {throw new Error('Written case cannot call a provider');}});
    const original = api.server.listeners('request')[0];
    api.server.removeListener('request', original);
    api.server.on('request', (req,res) => {
      const route = new URL(req.url, 'http://fixture.local').pathname;
      let request;
      if (route.startsWith('/api/case/')) {
        request = {route,method:req.method,body:null};api.requests.push(request);
        let raw = '';req.on('data', chunk => raw += chunk);req.on('end', () => {if (raw) request.body = JSON.parse(raw);});
      }
      const end = res.end.bind(res);
      if (route === '/api/case/actions' && api.dropAction) {
        api.dropAction = false;
        res.end = body => {
          api.dropped = JSON.parse(body);
          // The real action commits; only the response body is interrupted.
          res.write('{"incomplete":');setImmediate(() => res.destroy());return res;
        };
      } else if (route === '/api/case/state' && api.holdState) {
        api.holdState = false;res.end = body => {api.heldState = {body:JSON.parse(body),release:() => end(body)};return res;};
      } else if ((route === '/api/case/state' && api.invalidCheckpoint) || (route === '/api/case/actions' && api.invalidActionCheckpoint)) {
        res.end = body => {const value = JSON.parse(body);value.checkpoint = 'invalid-server-value';return end(JSON.stringify(value));};
      }
      original(req,res);
    });
    await new Promise(resolve => api.server.listen(api.port,'127.0.0.1',resolve));
    api.port = api.server.address().port;api.origin = 'http://127.0.0.1:' + api.port;
  };
  api.close = async () => {if (api.server) {api.server.closeAllConnections();await new Promise(resolve => api.server.close(resolve));api.server = null;}};
  api.restart = async key => {await api.close();await api.start(key);};
  api.actions = () => api.requests.filter(item => item.route === '/api/case/actions');
  api.starts = () => api.requests.filter(item => item.route === '/api/case/start');
  api.restores = () => api.requests.filter(item => item.route === '/api/case/restore');
  await api.start();return api;
}

test('browser-held progress with the real case HTTP service', {timeout:120000,skip:!fs.existsSync(ENTRY) && 'Set RAVEN_CASE_SERVICE_ROOT to the case service source'}, async t => {
  const {createPreviewServer} = await import(pathToFileURL(ENTRY).href);
  const {fixturePack} = await import(pathToFileURL(path.join(SERVICE,'tests/fixtures/case.js')).href);
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  t.after(() => browser.close());
  async function check(run) {
    const api = await harness(createPreviewServer,fixturePack);
    const context = await browser.newContext({viewport:{width:320,height:720},acceptDownloads:true});
    const page = await context.newPage();page.setDefaultTimeout(8000);
    const errors = [];page.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(() => {
      window.fixtureQuota = false;
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key,value) {
        if (this === localStorage && key.startsWith('raven_case_checkpoint_v1.') && (window.fixtureQuota || (window.fixtureQuotaLimit && value.length > window.fixtureQuotaLimit))) throw new DOMException('Fixture quota','QuotaExceededError');
        return original.call(this,key,value);
      };
      localStorage.setItem('fixture-unrelated','keep');
    });
    try {
      await page.goto(api.origin + PAGE);await page.locator('#case-start').click();await ready(page);
      await run(page,api,context);
      assert.deepEqual(errors,[],'no uncaught player error');
      assert.equal(await page.evaluate(() => localStorage.getItem('fixture-unrelated')),'keep');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),'mobile reading does not overflow');
    } finally {await context.close();await api.close();}
  }
  const read = async page => {await page.locator('form[data-action-id="read"] button').click();await textIncludes(page,'#materials-list','Card A');};

  await t.test('restart restores automatically before any start, with bilingual browser-only save truth', () => check(async (page,api) => {
    await read(page);await ready(page);const before = await saved(page);
    assert.equal(before.checkpointInfo.revision,1);assert.match(before.checkpoint,/^raven1\./);
    await api.restart();await page.reload();await ready(page);
    assert.equal(api.starts().length,1);assert.equal(api.restores().length,1);
    assert.equal((await saved(page)).checkpointInfo.sessionTag,before.checkpointInfo.sessionTag);
    await textIncludes(page,'#materials-list','Card A');
    await page.locator('#language-ar').click();await textIncludes(page,'#save-status','حذف بيانات المتصفح');
    await page.locator('#language-en').click();await textIncludes(page,'#save-status','not cloud saving');
    const downloadPromise = page.waitForEvent('download');await page.locator('#case-export').click();
    const record = JSON.parse(fs.readFileSync(await (await downloadPromise).path(),'utf8'));
    assert.equal(record.revision,1);assert.doesNotMatch(JSON.stringify(record),/raven1\.|checkpoint|sessionTag/);
  }));

  await t.test('quota failure preserves the last token and pending operation until retry-save succeeds', () => check(async (page,api) => {
    const previous = await rawSave(page);await page.evaluate(() => window.fixtureQuota = true);
    await read(page);await textIncludes(page,'#connection-title','could not be saved');
    assert.equal(await rawSave(page),previous);const operation = await pending(page);
    assert.equal(operation.sessionTag,(await saved(page)).checkpointInfo.sessionTag);
    assert.equal(await page.locator('form[data-action-id="share"] button').isDisabled(),true);
    assert.match(await page.locator('#save-status').innerText(),/not saved/);
    const downloadPromise = page.waitForEvent('download');await page.locator('#checkpoint-export').click();
    const record = JSON.parse(fs.readFileSync(await (await downloadPromise).path(),'utf8'));
    assert.equal(record.revision,1);assert.doesNotMatch(JSON.stringify(record),/raven1\.|checkpoint|sessionTag/);
    await page.locator('#language-ar').click();assert.deepEqual(await pending(page),operation);
    await page.locator('#language-en').click();await page.evaluate(() => window.fixtureQuota = false);
    await page.locator('#checkpoint-retry').click();await ready(page);
    assert.equal(await pending(page),null);assert.equal((await saved(page)).checkpointInfo.revision,1);assert.equal(api.actions().length,1,'retry-save must not resend the action');
  }));

  await t.test('a delayed state read holds the case lock through saving, then newer progress pauses that tab', () => check(async (page,api,context) => {
    api.holdState = true;const stale = await context.newPage();stale.setDefaultTimeout(8000);
    await stale.goto(api.origin + PAGE);await eventually(() => api.heldState,'state was not held');
    assert.equal(api.heldState.body.revision,0);await page.locator('form[data-action-id="read"] button').click();
    const locks = await page.evaluate(() => navigator.locks.query());
    assert.equal(locks.held.length,1);assert.equal(locks.pending.length,1);assert.equal(api.actions().length,0,'action waits until state read and save finish');
    api.heldState.release();await ready(page);await textIncludes(page,'#materials-list','Card A');
    await textIncludes(stale,'#connection-title','newer progress');
    assert.equal((await saved(stale)).checkpointInfo.revision,1);assert.equal(await stale.locator('form[data-action-id="read"] button').isDisabled(),true);
    await stale.locator('#state-refresh').click();await ready(stale);await textIncludes(stale,'#materials-list','Card A');
    assert.equal(api.actions().length,1);
  }));

  await t.test('a delayed acknowledged action spans restart without permitting an equal-revision fork in another tab', () => check(async (page,api,context) => {
    const second = await context.newPage();await second.goto(api.origin + PAGE);await ready(second);
    let release,received = false;const gate = new Promise(resolve => release = resolve);
    await page.route('**/api/case/actions',async route => {const response = await route.fetch();received = true;await gate;await route.fulfill({response});});
    await page.locator('form[data-action-id="read"] button').click();await eventually(() => received,'first action response not held');
    await api.restart();await second.locator('form[data-action-id="read"] button').click();
    const locks = await second.evaluate(() => navigator.locks.query());assert.equal(locks.pending.length,1);assert.equal(api.actions().length,1);
    release();await ready(page);await textIncludes(page,'#materials-list','Card A');await textIncludes(second,'#connection-title','newer progress');
    assert.equal(api.actions().length,1,'second tab never creates a different branch at the same revision');
    await second.locator('#state-refresh').click();await ready(second);assert.equal((await saved(second)).checkpointInfo.revision,1);
  }));

  await t.test('language changes preserve an acknowledged action and its case lock through server restart', () => check(async (page,api,context) => {
    await read(page);await ready(page);
    const second = await context.newPage();await second.goto(api.origin + PAGE);await ready(second);
    let release,received = false;const gate = new Promise(resolve => release = resolve);
    await page.route('**/api/case/actions',async route => {const response = await route.fetch();received = true;await gate;await route.fulfill({response});});
    await page.locator('form[data-action-id="share"] button').click();await eventually(() => received,'share response was not held');
    const operation = await pending(page);
    try {
      await page.locator('#language-ar').click();
      assert.equal(await page.locator('body').getAttribute('aria-busy'),'true','changing language must not abandon the saving action');
      assert.deepEqual(await pending(page),operation);assert.equal(await page.locator('#operation-retry').isDisabled(),true);
      await page.locator('#language-en').click();
      await api.restart();await second.locator('form[data-action-id="finish"] button').click();
      const locks = await second.evaluate(() => navigator.locks.query());assert.equal(locks.pending.length,1);
    } finally {release();}
    await ready(page);await eventually(async () => await pending(page) === null,'acknowledged operation was not saved');
    await textIncludes(second,'#connection-title','newer progress');
    assert.equal((await saved(page)).checkpointInfo.revision,2);assert.equal(api.actions().length,2,'the other tab cannot create a divergent revision');
    await second.locator('#state-refresh').click();await ready(second);
    const downloadPromise = second.waitForEvent('download');await second.locator('#case-export').click();
    const record = JSON.parse(fs.readFileSync(await (await downloadPromise).path(),'utf8'));
    assert.equal(record.revision,2);assert.equal(record.shares.length,1,'the acknowledged share survives restart and locale changes');
    assert.equal(api.starts().length,1);
  }));

  await t.test('quota-failed acknowledged progress survives restart and refresh even when the old smaller save would fit', () => check(async (page,api) => {
    const previous = await rawSave(page);await page.evaluate(limit => window.fixtureQuotaLimit = limit,previous.length);
    await read(page);await textIncludes(page,'#connection-title','could not be saved');const operation = await pending(page);
    await api.restart();await page.locator('#state-refresh').click();await idle(page);await textIncludes(page,'#connection-title','could not be saved');
    await textIncludes(page,'#materials-list','Card A');assert.equal(await rawSave(page),previous);assert.deepEqual(await pending(page),operation);
    assert.equal(api.restores().length,1,'the newer in-memory checkpoint is restored');
    await page.evaluate(() => window.fixtureQuotaLimit = 0);await page.locator('#checkpoint-retry').click();await ready(page);
    assert.equal((await saved(page)).checkpointInfo.revision,1);assert.equal((await pending(page)).id,operation.id,'a resealed read does not alone acknowledge the pending operation');
    await page.locator('#operation-retry').click();await eventually(async () => await pending(page) === null,'idempotent confirmation did not clear pending');
    assert.equal((await saved(page)).checkpointInfo.revision,1);assert.equal(api.actions()[1].body.id,operation.id);
  }));

  await t.test('an unsaved acknowledged step cannot replace a divergent equal-revision history created after restart', () => check(async (page,api,context) => {
    await read(page);await ready(page);const second = await context.newPage();await second.goto(api.origin + PAGE);await ready(second);
    await page.evaluate(() => window.fixtureQuota = true);await page.locator('form[data-action-id="share"] button').click();
    await textIncludes(page,'#connection-title','could not be saved');const operation = await pending(page);
    assert.equal((await saved(page)).checkpointInfo.revision,1);
    await api.restart();await second.locator('#state-refresh').click();await ready(second);
    await second.locator('form[data-action-id="finish"] button').click();await textIncludes(second,'#scene-title','Fixture end');await ready(second);
    const foreign = await rawSave(second);assert.equal(JSON.parse(foreign).checkpointInfo.revision,2);
    await page.evaluate(() => window.fixtureQuota = false);
    await page.locator('#checkpoint-retry').click();await textIncludes(page,'#connection-title','differs from this page');
    assert.equal(await rawSave(page),foreign,'the other history is preserved byte-for-byte');assert.deepEqual(await pending(page),operation);
    await textIncludes(page,'#scene-title','Desk');assert.equal(await page.locator('form[data-action-id="share"] button').isDisabled(),true);
    const downloadPromise = page.waitForEvent('download');await page.locator('#checkpoint-export').click();
    const record = JSON.parse(fs.readFileSync(await (await downloadPromise).path(),'utf8'));
    assert.equal(record.revision,2);assert.equal(record.shares.length,1,'the unsaved reading remains exportable');assert.doesNotMatch(JSON.stringify(record),/raven1\.|checkpoint|sessionTag|historyTag/);
    await page.locator('#state-refresh').click();await idle(page);await textIncludes(page,'#connection-title','differs from this page');assert.equal(await rawSave(page),foreign);assert.deepEqual(await pending(page),operation);
  }));

  await t.test('resealing an unsaved acknowledged step cannot let a later divergent higher revision discard its reading', () => check(async (page,api,context) => {
    await read(page);await ready(page);const second = await context.newPage();await second.goto(api.origin + PAGE);await ready(second);
    await page.evaluate(() => window.fixtureQuota = true);await page.locator('form[data-action-id="share"] button').click();
    await textIncludes(page,'#connection-title','could not be saved');const operation = await pending(page);
    await api.restart();await page.locator('#state-refresh').click();await idle(page);await textIncludes(page,'#connection-title','could not be saved');
    await api.restart();await second.locator('#state-refresh').click();await ready(second);
    await second.locator('form[data-action-id="finish"] button').click();await textIncludes(second,'#scene-title','Fixture end');await ready(second);
    await second.locator('#notebook summary').click();const note = second.locator('form[data-action-id="case.note"]');
    await note.locator('textarea').fill('A separate branch note.');await note.locator('select').selectOption('card');await note.locator('button[type="submit"]').click();await second.locator('#review-confirm').click();await ready(second);
    await eventually(async () => (await saved(second)).checkpointInfo.revision === 3,'second branch did not advance');const foreign = await rawSave(second);
    await page.evaluate(() => window.fixtureQuota = false);await page.locator('#state-refresh').click();await idle(page);
    await textIncludes(page,'#connection-title','newer progress');assert.equal(await rawSave(page),foreign);assert.deepEqual(await pending(page),operation);
    await textIncludes(page,'#scene-title','Desk');const downloadPromise = page.waitForEvent('download');await page.locator('#checkpoint-export').click();
    const record = JSON.parse(fs.readFileSync(await (await downloadPromise).path(),'utf8'));assert.equal(record.revision,2);assert.equal(record.shares.length,1);assert.equal(record.notes.length,0);
  }));

  await t.test('a second live tab pauses when another tab saves newer progress', () => check(async (page,api,context) => {
    const second = await context.newPage();await second.goto(api.origin + PAGE);await ready(second);
    await read(page);await ready(page);await textIncludes(second,'#connection-title','newer progress');
    assert.equal(await second.locator('form[data-action-id="read"] button').isDisabled(),true);
    assert.equal(api.actions().length,1);await second.close();
  }));

  await t.test('unknown action outcome survives reload and restart, then reuses the original operation exactly once', () => check(async (page,api) => {
    api.dropAction = true;await page.locator('form[data-action-id="read"] button').click();
    await page.locator('#operation-retry').waitFor();await page.waitForFunction(() => document.body.getAttribute('aria-busy') === 'false');const original = clone(api.actions()[0].body);
    assert.equal((await pending(page)).id,original.id);assert.equal((await saved(page)).checkpointInfo.revision,0);
    await page.reload();await page.locator('#operation-retry').waitFor();await ready(page);
    assert.equal(api.actions().length,1,'reload must not replay an unknown operation');
    assert.equal((await saved(page)).checkpointInfo.revision,1);
    await api.restart();await page.reload();await ready(page);await page.locator('#operation-retry').waitFor();
    assert.equal(api.actions().length,1,'restore must not replay an unknown operation');
    assert.equal((await pending(page)).id,original.id);
    await page.locator('#operation-retry').click();await eventually(async () => await pending(page) === null,'confirmed retry did not clear pending');
    assert.deepEqual(api.actions()[1].body,original);assert.equal((await saved(page)).checkpointInfo.revision,1,'same operation cannot apply twice');
    assert.equal(api.starts().length,1);
  }));

  await t.test('an action encountering an expired server session restores before explicit same-operation retry', () => check(async (page,api) => {
    await api.restart();await page.locator('form[data-action-id="read"] button').click();
    await eventually(() => api.restores().length === 1,'action 401 did not restore');await page.locator('#operation-retry').waitFor();
    const original = clone(api.actions()[0].body);assert.equal(api.actions().length,1);assert.equal(api.starts().length,1);
    await page.locator('#operation-retry').click();await ready(page);await eventually(async () => await pending(page) === null,'retry did not finish');
    assert.deepEqual(api.actions()[1].body,original);assert.equal((await saved(page)).checkpointInfo.revision,1);
  }));

  await t.test('wrong server key rejects restore without overwriting the token or starting over', () => check(async (page,api) => {
    await read(page);await ready(page);const previous = await rawSave(page);
    await api.restart('cd'.repeat(32));await page.reload();await textIncludes(page,'#connection-title','could not be restored');
    assert.equal(await rawSave(page),previous);assert.equal(api.starts().length,1);assert.equal(await page.locator('#case-start').count(),0);
    await api.restart();await page.locator('#checkpoint-retry').click();await ready(page);
    assert.equal((await saved(page)).checkpointInfo.revision,1);assert.equal(api.starts().length,1);
  }));

  await t.test('malformed server checkpoint leaves the previous browser token untouched and reading available', () => check(async (page,api) => {
    const previous = await rawSave(page);api.invalidCheckpoint = true;
    await page.locator('#state-refresh').click();await idle(page);await textIncludes(page,'#connection-title','could not be saved');
    assert.equal(await rawSave(page),previous);assert.equal(await page.locator('form[data-action-id="read"] button').isDisabled(),true);
    api.invalidCheckpoint = false;await page.locator('#state-refresh').click();await ready(page);
  }));

  await t.test('retry after a malformed action checkpoint saves the displayed step instead of an older candidate', () => check(async (page,api) => {
    const previous = await rawSave(page);api.invalidActionCheckpoint = true;
    await read(page);await textIncludes(page,'#connection-title','could not be saved');
    const operation = await pending(page);
    assert.equal(await rawSave(page),previous);assert.equal(operation.revision,0);
    api.invalidActionCheckpoint = false;
    await page.locator('#checkpoint-retry').click();await ready(page);
    assert.equal((await saved(page)).checkpointInfo.revision,1,'the save notice must refer to the displayed reading');
    assert.equal(api.actions().length,1,'recovering the checkpoint does not resend a choice');
    assert.deepEqual(await pending(page),operation,'checkpoint recovery alone does not confirm the operation');
    await page.locator('#operation-retry').click();await eventually(async () => await pending(page) === null,'the original operation was not confirmed');
    assert.equal(api.actions()[1].body.id,operation.id);assert.equal((await saved(page)).checkpointInfo.revision,1);
    await api.restart();await page.reload();await ready(page);await textIncludes(page,'#materials-list','Card A');
    assert.equal(api.starts().length,1);
  }));

  await t.test('clearing browser storage in another tab pauses changes until the displayed step is saved again', () => check(async (page,api,context) => {
    await read(page);await ready(page);const previous = await saved(page);
    const other = await context.newPage();await other.goto(api.origin + '/404.html');
    await other.evaluate(() => {localStorage.clear();localStorage.setItem('fixture-unrelated','keep');});
    await textIncludes(page,'#connection-title','could not be saved');
    assert.equal(await rawSave(page),null);assert.match(await page.locator('#save-status').innerText(),/not saved/);
    assert.equal(await page.locator('form[data-action-id="share"] button').isDisabled(),true);
    await page.locator('#checkpoint-retry').click();await ready(page);
    assert.deepEqual((await saved(page)).checkpointInfo,previous.checkpointInfo);
    assert.equal(api.actions().length,1);assert.equal(api.starts().length,1);
    await other.close();
  }));

  await t.test('corrupt local data is preserved and cannot cause a new session', () => check(async (page,api) => {
    await page.evaluate(key => localStorage.setItem(key,'{damaged'),KEY);
    await api.restart();await page.reload();await textIncludes(page,'#connection-title','could not be read');
    assert.equal(await rawSave(page),'{damaged');assert.equal(api.starts().length,1);assert.equal(api.restores().length,0);assert.equal(await page.locator('#case-start').count(),0);
  }));

  await t.test('a token for a different session is never overwritten or used for a pending action', () => check(async (page,api) => {
    api.dropAction = true;await page.locator('form[data-action-id="read"] button').click();await page.locator('#operation-retry').waitFor();await page.waitForFunction(() => document.body.getAttribute('aria-busy') === 'false');
    const operation = await pending(page);const other = await browser.newContext();const otherPage = await other.newPage();
    try {
      await otherPage.goto(api.origin + PAGE);await otherPage.locator('#case-start').click();await ready(otherPage);
      const foreign = await rawSave(otherPage);await page.evaluate(({key,foreign}) => localStorage.setItem(key,foreign),{key:KEY,foreign});
      await page.locator('#state-refresh').click();await idle(page);await textIncludes(page,'#connection-title','differs from this page');
      assert.equal(await rawSave(page),foreign);assert.deepEqual(await pending(page),operation);assert.equal(api.actions().length,1);
      await api.restart();await page.reload();await textIncludes(page,'#connection-title','differs from this page');
      assert.equal(api.restores().length,0,'pending session mismatch must not attempt restore');assert.equal(api.actions().length,1);
    } finally {await other.close();}
  }));

  await t.test('blocked browser storage keeps the existing reading available and never mutates the case', () => check(async (page,api) => {
    const previous = await rawSave(page);
    await page.addInitScript(() => {
      window.fixtureReadBlocked = true;const get = Storage.prototype.getItem;
      Storage.prototype.getItem = function(key) {
        if (this === localStorage && key.startsWith('raven_case_checkpoint_v1.') && window.fixtureReadBlocked) throw new DOMException('Fixture blocked storage','SecurityError');
        return get.call(this,key);
      };
    });
    await page.reload();await textIncludes(page,'#connection-title','could not be saved');
    await page.locator('#case-app').waitFor({state:'visible'});assert.equal(await page.locator('form[data-action-id="read"] button').isDisabled(),true);
    assert.equal(api.actions().length,0);assert.equal(api.starts().length,1);
    await page.evaluate(() => window.fixtureReadBlocked = false);assert.equal(await rawSave(page),previous);
    await page.locator('#checkpoint-retry').click();await ready(page);
  }));

  await t.test('missing cross-tab locks pauses changes and preserves existing progress', () => check(async (page,api) => {
    const previous = await rawSave(page);
    await page.addInitScript(() => Object.defineProperty(navigator,'locks',{value:undefined,configurable:true}));
    await page.reload();await textIncludes(page,'#connection-title','could not be saved');
    assert.equal(await rawSave(page),previous);assert.equal(await page.locator('form[data-action-id="read"] button').isDisabled(),true);assert.equal(api.actions().length,0);
  }));
});
