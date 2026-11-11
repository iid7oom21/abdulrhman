// RAVEN dialogue preview (raven/dialogue/): what the in-browser simulation keeps across a reload.
// Run: RAVEN_REDESIGN_URL=http://127.0.0.1:8080/ node tests/dialogue-local-save.mjs
// The page has no server: raven/dialogue/local-api.js answers /api/* inside the browser and keeps
// a log in localStorage. These checks pin what a player can rely on after reloading the page.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_TEST_MODULE || '@playwright/test');
const base = (process.env.RAVEN_REDESIGN_URL || 'http://127.0.0.1:8080/').replace(/\/?$/, '/');
const url = base + 'raven/dialogue/';
const STATE_KEY = 'raven_dialogue_static_backend_v2';

const browser = await chromium.launch({ headless: true });
const open = async (init) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (init) await context.addInitScript(init.fn, init.arg);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#materials-panel summary').click();
  return { context, page, errors };
};
// The page loads the list by itself; never press «تحديث المواد» in these checks.
const settled = page => page.waitForFunction(() => {
  const s = document.getElementById('material-status').textContent;
  return s && !s.includes('جارٍ');
}, null, { timeout: 8000 });
const listed = page => page.locator('#materials-list .material').count();
const post = (page, path, body) => page.evaluate(async ([p, b]) => {
  const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  return { status: r.status, data: await r.json() };
}, [path, body]);
const addMaterial = async (page, text) => {
  await page.fill('#material-text', text);
  await page.click('#material-save');
  await page.waitForFunction(t => [...document.querySelectorAll('#materials-list .material')].some(el => el.textContent.includes(t)), text, { timeout: 8000 });
  await settled(page);
};

try {
  // 1. A material and its share survive many questions and a reload; times do not change.
  {
    const { context, page, errors } = await open();
    await settled(page);
    await addMaterial(page, 'قول تجريبي أول');
    await page.selectOption('#share-recipient', 'jonas');
    await page.click('#material-share');
    await page.waitForFunction(() => document.getElementById('knowledge-list').textContent.includes('قول تجريبي أول'), null, { timeout: 8000 });
    const first = await post(page, '/api/dialogue', { requestId: 'first-question', characterId: 'jonas', message: 'سؤال أول' });
    assert.equal(first.status, 200);
    assert.equal(first.data.localPersist, 'saved');
    // More questions than the old 400-entry cut-off.
    const statuses = await page.evaluate(() => Promise.all(Array.from({ length: 401 }, (_, i) =>
      fetch('/api/dialogue', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: 'q-' + i, characterId: 'jonas', message: 'سؤال ' + i }) }).then(r => r.status))));
    assert.ok(statuses.every(s => s === 200));
    const kept = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).log, STATE_KEY);
    assert.equal(kept.filter(e => e.path === '/api/materials').length, 1, 'the material entry is kept');
    assert.equal(kept.filter(e => e.path === '/api/shares').length, 1, 'the share entry is kept');
    assert.equal(kept.filter(e => e.path === '/api/dialogue').length, 100, 'only the newest 100 questions are kept, as the engine remembers');
    // A repeated ID with the same content adds nothing.
    assert.equal((await post(page, '/api/dialogue', { requestId: 'q-400', characterId: 'jonas', message: 'سؤال 400' })).data.replayed, true);
    assert.equal(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).log.length, STATE_KEY), kept.length);
    const before = await page.evaluate(async () => (await (await fetch('/api/operations/q-400')).json()).createdAt);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#materials-panel summary').click();
    await settled(page);
    assert.equal(await listed(page), 1, 'the material is listed again without pressing refresh');
    await page.selectOption('#share-recipient', 'jonas');
    await page.waitForFunction(() => document.getElementById('knowledge-list').textContent.includes('قول تجريبي أول'), null, { timeout: 8000 });
    await page.selectOption('#share-recipient', 'claire');
    await page.waitForFunction(() => document.getElementById('knowledge-list').textContent.includes('لم تصله'), null, { timeout: 8000 });
    const after = await page.evaluate(async () => (await (await fetch('/api/operations/q-400')).json()).createdAt);
    assert.equal(after, before, 'a reload keeps the original time of a question');
    assert.ok(!(await page.locator('#material-status').textContent()).includes('تعذرت استعادة'));
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: material and share survive 401 questions and a reload; times unchanged; claire learns nothing');
  }

  // 2. When this browser refuses to save, the page says the material will be lost on reload.
  {
    const block = { fn: key => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === key) throw new DOMException('full', 'QuotaExceededError'); return original.call(this, k, v); };
    }, arg: STATE_KEY };
    const { context, page } = await open(block);
    await settled(page);
    await addMaterial(page, 'قول لن يُحفظ');
    assert.match(await page.locator('#material-status').textContent(), /فشل الحفظ المحلي/);
    const q = await post(page, '/api/dialogue', { requestId: 'unsaved-question', characterId: 'claire', message: 'سؤال' });
    assert.equal(q.data.localPersist, 'failed');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#materials-panel summary').click();
    await settled(page);
    assert.equal(await listed(page), 0, 'nothing was saved, and nothing claims otherwise');
    await context.close();
    console.log('PASS: a refused save is reported, not shown as kept');
  }

  // 3. An unreadable saved copy is left exactly as it was: nothing is written over it, and the
  //    page says so. Materials still show for the session.
  {
    const corrupt = { fn: key => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, '{broken'); sessionStorage.setItem('seeded', '1'); } }, arg: STATE_KEY };
    const { context, page } = await open(corrupt);
    await settled(page);
    assert.match(await page.locator('#material-status').textContent(), /بقيت دون تغيير/);
    await addMaterial(page, 'قول بعد نسخة تالفة');
    assert.equal(await page.evaluate(k => localStorage.getItem(k), STATE_KEY), '{broken', 'the unreadable copy is kept verbatim');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#materials-panel summary').click();
    await settled(page);
    assert.equal(await page.evaluate(k => localStorage.getItem(k), STATE_KEY), '{broken', 'still untouched after reload');
    await context.close();
    console.log('PASS: an unreadable copy is left untouched and the page says so');
  }

  // 4. The version 1 log is migrated once when it is consistent. An inconsistent one (a share whose
  //    material is missing) is kept exactly as it was and reported as incompatible; nothing is
  //    silently dropped.
  const LEGACY_KEY = 'raven_dialogue_static_backend_v1';
  {
    const consistent = { fn: ([key, value]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, value); sessionStorage.setItem('seeded', '1'); } },
      arg: [LEGACY_KEY, JSON.stringify([
        { path: '/api/materials', data: { id: 'kept-material', type: 'statement', text: 'قول من النسخة القديمة' } },
        { path: '/api/dialogue', data: { requestId: 'old-question', characterId: 'jonas', message: 'سؤال قديم' } },
      ])] };
    const { context, page } = await open(consistent);
    await settled(page);
    assert.equal(await listed(page), 1, 'the consistent old material is restored');
    assert.equal(await page.evaluate(async () => (await fetch('/api/operations/old-question')).status), 200);
    assert.ok(await page.evaluate(k => localStorage.getItem(k) !== null, STATE_KEY), 'migrated into the current copy');
    await context.close();
    console.log('PASS: a consistent version 1 log is migrated');
  }
  {
    const broken = { fn: ([key, value]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, value); sessionStorage.setItem('seeded', '1'); } },
      arg: [LEGACY_KEY, JSON.stringify([
        { path: '/api/shares', data: { eventId: 'lost-share', materialId: 'lost-material', recipients: ['jonas'] } },
      ])] };
    const { context, page } = await open(broken);
    await settled(page);
    assert.match(await page.locator('#material-status').textContent(), /غير متوافقة وبقيت دون تغيير/);
    assert.equal(await page.evaluate(k => localStorage.getItem(k), LEGACY_KEY), JSON.stringify([
      { path: '/api/shares', data: { eventId: 'lost-share', materialId: 'lost-material', recipients: ['jonas'] } },
    ]), 'the inconsistent old log is kept verbatim');
    await context.close();
    console.log('PASS: an inconsistent version 1 log is kept verbatim and reported');
  }

  // 5. Shares stop at 500, as on the real server; repeating a recorded share still succeeds.
  {
    const { context, page } = await open();
    await settled(page);
    const m = await post(page, '/api/materials', { id: 'shared-often', type: 'statement', text: 'قول' });
    assert.equal(m.status, 200);
    const ok = await page.evaluate(() => Promise.all(Array.from({ length: 500 }, (_, i) =>
      fetch('/api/shares', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: 's-' + i, materialId: 'shared-often', recipients: ['jonas'] }) }).then(r => r.status))));
    assert.ok(ok.every(s => s === 200));
    const over = await post(page, '/api/shares', { eventId: 's-500', materialId: 'shared-often', recipients: ['jonas'] });
    assert.deepEqual([over.status, over.data.error], [400, 'shares_limit']);
    assert.equal((await post(page, '/api/shares', { eventId: 's-3', materialId: 'shared-often', recipients: ['jonas'] })).status, 200);
    await context.close();
    console.log('PASS: shares stop at 500; a repeated share ID still succeeds');
  }
  console.log('\nALL CHECKS PASSED');
} finally {
  await browser.close();
}
