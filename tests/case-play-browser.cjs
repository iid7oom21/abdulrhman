const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

// These fixtures describe an invented browser test, never the private case pack.
const ROOT = path.resolve(__dirname, '..');
const PLAY_PATH = '/raven/deleted-name/play/content.html';
const PENDING_KEY = 'raven_case_pending_operation_v1';
const OPENING_KEY = 'raven.case.opening.v1';
const FORBIDDEN = 'FORBIDDEN_PRIVATE_FIXTURE_SENTINEL';
const VERSION = 'fictional-browser-fixture-v1';
const OPENING = { version: 'paper-opening-2026-11-05-r2', choice: 'precise', recipient: 'jonas' };
const localized = (en, ar) => ({ en, ar });
const clone = value => JSON.parse(JSON.stringify(value));
const materialOptions = [
  { value: 'fixture-letter', label: localized('Fixture letter', 'خطاب الاختبار') },
  { value: 'fixture-map', label: localized('Fixture map', 'خريطة الاختبار') },
];

function projection({ notes = true, revision = 4, receiptPreview = false } = {}) {
  const state = {
    caseId: 'fictional-browser-fixture', contentVersion: VERSION, revision,
    saveStatus: 'confirmed', persistence: 'disk-file',
    scene: {
      id: 'fixture-desk', title: localized('Fixture reading desk', 'مكتب قراءة الاختبار'),
      body: localized('This invented page is a browser fixture. <img src=x onerror="window.fixtureInjected=true">', 'هذه صفحة خيالية لاختبار المتصفح. <img src=x onerror="window.fixtureInjected=true">'),
      lines: [{ speaker: localized('Fixture narrator', 'راوي الاختبار'), text: localized('Only the supplied reading is visible.', 'تظهر القراءة المعروضة فقط.') }],
    },
    materials: [
      { id: 'fixture-letter', title: materialOptions[0].label, body: localized('Invented letter for this test. ' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(8), 'خطاب خيالي لهذا الاختبار. ' + 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.repeat(8)), type: 'document', source: localized('Fictional desk', 'مكتب خيالي') },
      { id: 'fixture-map', title: materialOptions[1].label, body: localized('An invented map of two empty rooms.', 'خريطة خيالية لغرفتين فارغتين.'), type: 'map', source: localized('Fictional folder', 'مجلد خيالي') },
    ],
    actions: [
      {
        id: 'fixture-report', label: localized('Review fixture report', 'مراجعة تقرير الاختبار'),
        fields: [
          { id: 'subject', type: 'text', label: localized('Report subject', 'موضوع التقرير'), required: true, maxLength: 80 },
          { id: 'summary', type: 'textarea', label: localized('Report summary', 'ملخص التقرير'), required: true, maxLength: 800 },
          { id: 'channel', type: 'select', label: localized('Report destination', 'وجهة التقرير'), required: true, options: [{ value: 'fixture-archive', label: localized('Fictional archive', 'الأرشيف الخيالي') }, { value: 'fixture-draft', label: localized('Private draft', 'مسودة خاصة') }] },
          { id: 'sources', type: 'materialRefs', label: localized('Report sources', 'مصادر التقرير'), required: true, options: materialOptions },
        ],
        // Poisoned extras test defensive rendering and request allowlisting.
        target: FORBIDDEN, flags: { forbidden: FORBIDDEN }, effects: { forbidden: FORBIDDEN },
      },
      { id: 'fixture-advance', label: localized('Turn the fixture page', 'اقلب صفحة الاختبار') },
      ...(notes ? [{ id: 'case.note', label: localized('Add a private note', 'إضافة ملاحظة خاصة'), fields: [
        { id: 'text', type: 'textarea', label: localized('Private note text', 'نص الملاحظة الخاصة'), required: true, maxLength: 2000 },
        { id: 'sourceId', type: 'select', label: localized('Private note source', 'مصدر الملاحظة الخاصة'), required: true, options: materialOptions },
      ] }] : []),
    ],
    notes: [], captures: {}, shares: [], receipts: [], opening: null,
    forbiddenSentinel: FORBIDDEN,
  };
  if (receiptPreview) {
    const capture = {
      actionId: 'fixture-earlier-capture', revision: 2,
      label: localized('Captured fixture correction', 'تصحيح الاختبار المسجل'),
      fields: [
        { id: 'text', type: 'textarea', label: localized('Recorded correction', 'التصحيح المسجل') },
        { id: 'sources', type: 'materialRefs', label: localized('Recorded sources', 'المصادر المسجلة') },
      ],
      values: { text: 'The exact earlier captured text.\nIt remains a player statement.', sources: ['fixture-letter'] },
    };
    state.materials.push({ id: 'fixture-unattached', title: localized('Unattached earned sheet', 'ورقة مكتسبة غير مرفقة'), body: localized('An earned sheet that is not part of this filing.', 'ورقة مكتسبة ليست ضمن هذا الإيداع.'), type: 'document', source: localized('Other fixture desk', 'مكتب اختبار آخر') });
    state.captures = {
      fixture_delivery_report: { ...clone(capture), revision: 4, values: { text: 'LATEST_ALIAS_MUST_NOT_REPLACE_REVIEW', sources: ['fixture-unattached'] } },
      'fixture_delivery_report.revision.2': clone(capture),
    };
    state.receipts = [{ id: 'fixture-receipt-original', title: localized('Earlier fixture receipt', 'إيصال اختبار سابق'), kind: 'fixture', scope: 'story-only', revision: 1 }];
    state.shares = [{ materialId: 'fixture-unattached', recipient: 'fixture-unrelated-recipient', revision: 3 }];
    state.actions.unshift({
      id: 'fixture-file-correction', label: localized('File fixture correction', 'إيداع تصحيح الاختبار'),
      receiptPreview: {
        kind: 'fixture-correction', title: localized('Fixture correction receipt', 'إيصال تصحيح الاختبار'), scope: 'story-only',
        fromCapture: 'fixture_delivery_report.revision.2', capture,
        materials: materialOptions.map(option => ({ id: option.value, title: option.label })),
        shares: [
          { materialId: 'fixture-letter', recipient: 'assessment_review' },
          { materialId: 'fixture-map', recipient: 'assessment_review' },
          { materialId: 'fixture-map', recipient: 'incident_followup' },
        ],
        relatesTo: 'fixture-receipt-original',
        target: FORBIDDEN, hiddenFutureReceipt: FORBIDDEN,
      },
      target: FORBIDDEN,
    });
  }
  return state;
}

function fixture(options = {}) {
  const api = {
    state: projection(options), requests: [], mutations: 0, seen: new Map(),
    failures: [...(options.failures || [])], started: !options.requireStart,
    holdState: null, heldState: null, holdAction: false, heldAction: null,
  };
  const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  function apply(body) {
    if (api.seen.has(body.id)) return clone(api.seen.get(body.id));
    api.mutations += 1;
    api.state.revision += 1;
    const preview = api.state.actions.find(action => action.id === body.actionId)?.receiptPreview;
    if (preview) {
      api.state.captures[preview.fromCapture] = clone(preview.capture);
      api.state.shares.push(...preview.shares.map(share => ({ ...share, revision: api.state.revision })));
      api.state.receipts.push({ id: 'fixture-receipt-' + api.state.revision, kind: preview.kind, title: preview.title, scope: 'story-only', fromCapture: preview.fromCapture, relatesTo: preview.relatesTo, revision: api.state.revision });
    } else if (body.actionId === 'case.note') {
      api.state.notes.push({ id: 'fixture-note-' + api.state.revision, text: body.values.text, sourceId: body.values.sourceId });
    } else {
      api.state.scene.title = localized('Fixture report recorded', 'تم تسجيل تقرير الاختبار');
      api.state.captures.fixture_report = { values: clone(body.values), actionId: body.actionId, revision: api.state.revision };
      api.state.receipts.push({ id: 'fixture-receipt-' + api.state.revision, kind: 'fixture', title: localized('Fictional receipt', 'إيصال خيالي'), scope: 'story-only', fromCapture: 'fixture_report', revision: api.state.revision });
    }
    const saved = clone(api.state);
    api.seen.set(body.id, saved);
    return saved;
  }
  api.server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://fixture.local').pathname;
    if (pathname.startsWith('/api/')) {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      let body = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { return json(res, 400, { error: 'invalid_json' }); }
      api.requests.push({ method: req.method, pathname, body });
      if (pathname === '/api/case/config') {
        if (options.unavailable === '404') { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end('<!doctype html><title>Static Pages</title>'); return; }
        return json(res, 200, { enabled: options.unavailable !== 'disabled', caseId: 'fictional-browser-fixture', contentVersion: VERSION, locales: ['ar', 'en'], defaultLocale: 'ar', scope: 'written-story', persistence: 'disk-file' });
      }
      if (pathname === '/api/case/state') {
        if (!api.started) return json(res, 401, { error: 'no_session' });
        if (api.holdState) {
          const held = api.holdState;
          api.holdState = null;
          api.heldState = { release: () => json(res, 200, held) };
          return;
        }
        return json(res, 200, api.state);
      }
      if (pathname === '/api/case/start' && req.method === 'POST') {
        api.started = true;
        return json(res, 200, api.state);
      }
      if (pathname === '/api/case/actions' && req.method === 'POST') {
        const failure = api.failures.shift();
        if (failure === '503') return json(res, 503, { error: 'storage_unavailable' });
        if (failure === '409') return json(res, 409, { error: 'stale_revision' });
        if (!api.seen.has(body.id) && body.revision !== api.state.revision) return json(res, 409, { error: 'revision_conflict' });
        const result = apply(body);
        if (api.holdAction) {
          api.holdAction = false;
          api.heldAction = { result, release: () => json(res, 200, result) };
          return;
        }
        if (failure === 'network') {
          // Deliver headers before dropping the body. A socket closed before
          // headers may be transparently retried by Chromium itself.
          res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '100000' });
          res.write('{"incomplete":');
          setTimeout(() => res.destroy(), 20);
          return;
        }
        return json(res, 200, result);
      }
      if (pathname === '/api/case/export') {
        const { forbiddenSentinel, actions, ...earned } = api.state;
        return json(res, 200, { schemaVersion: 1, ...earned });
      }
      return json(res, 404, { error: 'unknown_fixture_endpoint' });
    }
    let file;
    try { file = path.resolve(ROOT, '.' + decodeURIComponent(pathname.endsWith('/') ? pathname + 'index.html' : pathname)); }
    catch { res.writeHead(400); res.end(); return; }
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return api;
}

async function eventually(predicate, message) {
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail(message);
}

const actionRequests = api => api.requests.filter(item => item.pathname === '/api/case/actions');
const startRequests = api => api.requests.filter(item => item.pathname === '/api/case/start');

async function textIncludes(page, selector, text) {
  await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text });
}

async function noOverflow(page, width = 320) {
  const result = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.equal(result.width, width, `the actual browser viewport is ${width} CSS pixels`);
  assert.ok(result.document <= width + 1 && result.body <= width + 1, 'no horizontal overflow: ' + JSON.stringify(result));
}

async function english(page) {
  await page.locator('#language-en').click();
  await page.waitForFunction(() => document.documentElement.lang === 'en' && document.documentElement.dir === 'ltr');
}

async function ready(page) {
  await page.locator('#case-app').waitFor({ state: 'visible' });
  await textIncludes(page, '#scene-title', 'مكتب قراءة الاختبار');
}

async function reportReview(page) {
  await english(page);
  const form = page.locator('form[data-action-id="fixture-report"]');
  await form.getByLabel('Report subject', { exact: true }).fill('An invented browser report');
  await form.getByLabel('Report summary', { exact: true }).fill('My statement is a test, not an established fact.');
  await form.getByLabel('Report destination', { exact: true }).selectOption('fixture-archive');
  const sources = form.locator('input[type="checkbox"][value="fixture-letter"]');
  if (await sources.count()) await sources.check();
  else await form.getByLabel('Report sources', { exact: true }).selectOption(['fixture-letter']);
  await form.locator('button[type="submit"]').click();
  await page.locator('#review-panel').waitFor({ state: 'visible' });
}

function assertActionRequest(request, actionId, revision) {
  assert.deepEqual(Object.keys(request.body).sort(), ['actionId', 'contentVersion', 'id', 'revision', 'values']);
  assert.equal(request.method, 'POST');
  assert.equal(request.body.actionId, actionId);
  assert.equal(request.body.contentVersion, VERSION);
  assert.equal(request.body.revision, revision);
  assert.equal(typeof request.body.id, 'string');
  assert.ok(request.body.id.length >= 8, 'an operation has a stable nonempty identifier');
  assert.doesNotMatch(JSON.stringify(request.body), new RegExp(FORBIDDEN));
}

test('case play browser: fictional API, bilingual mobile reading, explicit actions and reliable retries', { timeout: 120000 }, async t => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  t.after(() => browser.close());

  async function check(options, run) {
    const api = fixture(options);
    await new Promise(resolve => api.server.listen(0, '127.0.0.1', resolve));
    const context = await browser.newContext({ viewport: { width: 320, height: 720 }, acceptDownloads: true });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(({ opening, openingRaw }) => {
      if (localStorage.getItem('fixture_unrelated_preference') === null) localStorage.setItem('fixture_unrelated_preference', 'keep-local');
      if (sessionStorage.getItem('fixture_unrelated_session') === null) sessionStorage.setItem('fixture_unrelated_session', 'keep-session');
      if (localStorage.getItem('raven_music_cinematic_v1') === null) localStorage.setItem('raven_music_cinematic_v1', 'off');
      if (opening !== undefined) sessionStorage.setItem('raven.case.opening.v1', JSON.stringify(opening));
      if (openingRaw !== undefined) sessionStorage.setItem('raven.case.opening.v1', openingRaw);
    }, { opening: options.opening, openingRaw: options.openingRaw });
    try {
      await page.goto(`http://127.0.0.1:${api.server.address().port}${PLAY_PATH}`);
      await run(page, api);
      assert.deepEqual(pageErrors, [], 'the production UI raises no uncaught browser errors');
      assert.deepEqual(await page.evaluate(() => [localStorage.getItem('fixture_unrelated_preference'), sessionStorage.getItem('fixture_unrelated_session'), localStorage.getItem('raven_music_cinematic_v1')]), ['keep-local', 'keep-session', 'off']);
      assert.equal(await page.locator('audio').count(), 0, 'play does not add another audio player');
      assert.doesNotMatch(await page.locator('body').innerText(), new RegExp(FORBIDDEN));
    } finally {
      await context.close();
      api.server.closeAllConnections();
      await new Promise(resolve => api.server.close(resolve));
    }
  }

  for (const unavailable of ['404', 'disabled']) {
    await t.test(`static availability ${unavailable} has no simulated start or completion`, () => check({ unavailable }, async (page, api) => {
      await eventually(() => api.requests.some(item => item.pathname === '/api/case/config'), 'config was not requested');
      await page.waitForFunction(() => !/جارٍ التحقق/.test(document.querySelector('#connection-title').textContent));
      assert.equal(await page.locator('#case-app').isVisible(), false);
      assert.equal(await page.locator('#case-start').count(), 0);
      assert.equal(await page.locator('#case-link').isVisible(), true, 'unavailable service still offers a reading/back link');
      await english(page);
      assert.match(await page.locator('#connection').innerText(), /unavailable|not available|server|written opening/i);
      assert.equal(startRequests(api).length, 0);
      assert.equal(actionRequests(api).length, 0);
      await noOverflow(page);
    }));
  }

  await t.test('enabled config and 401 offer explicit start; reload resumes without another start', () => check({ requireStart: true }, async (page, api) => {
    await page.locator('#case-start').waitFor({ state: 'visible' });
    assert.equal(startRequests(api).length, 0);
    await page.locator('#case-start').focus();
    await page.keyboard.press('Enter');
    await ready(page);
    assert.equal(startRequests(api).length, 1);
    assert.deepEqual(startRequests(api)[0].body, { contentVersion: VERSION });
    await page.reload();
    await ready(page);
    assert.equal(startRequests(api).length, 1, 'existing progress is read rather than restarted');
    await noOverflow(page);
  }));

  for (const importOpening of [true, false]) {
    await t.test(`the declared local opening is reviewed and ${importOpening ? 'imported only by explicit start' : 'can be omitted explicitly'}`, () => check({ requireStart: true, opening: OPENING }, async (page, api) => {
      await page.locator('#opening-summary').waitFor({ state: 'visible' });
      assert.equal(startRequests(api).length, 0);
      await noOverflow(page);
      await english(page);
      await textIncludes(page, '#opening-summary', 'Precise clarification');
      await textIncludes(page, '#opening-summary', 'Jonas');
      assert.match(await page.locator('#opening-summary').innerText(), /local opening choice, not proof of earlier delivery/i);
      assert.equal(startRequests(api).length, 0);
      await page.locator(importOpening ? '#case-start' : '#case-start-without-opening').click();
      await textIncludes(page, '#scene-title', 'Fixture reading desk');
      assert.equal(startRequests(api).length, 1);
      assert.deepEqual(startRequests(api)[0].body, { contentVersion: VERSION, ...(importOpening ? { opening: OPENING } : {}) });
      assert.deepEqual(JSON.parse(await page.evaluate(key => sessionStorage.getItem(key), OPENING_KEY)), OPENING);
      await noOverflow(page);
    }));
  }

  const invalidOpenings = [
    ['unknown fields', { opening: { ...OPENING, materials: [FORBIDDEN] } }],
    ['invalid version', { opening: { ...OPENING, version: 'fictional-obsolete-opening' } }],
    ['invalid choice', { opening: { ...OPENING, choice: 'fictional-unknown-choice' } }],
    ['invalid recipient combination', { opening: { ...OPENING, choice: 'wait', recipient: 'jonas' } }],
    ['malformed saved JSON', { openingRaw: '{fictional broken opening' }],
  ];
  for (const [reason, storage] of invalidOpenings) {
    await t.test(`opening ${reason} is not imported and its original local value is preserved`, () => check({ requireStart: true, ...storage }, async (page, api) => {
      await page.locator('#opening-warning').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#opening-summary').count(), 0);
      assert.equal(startRequests(api).length, 0);
      await page.locator('#case-start').click();
      await ready(page);
      assert.deepEqual(startRequests(api)[0].body, { contentVersion: VERSION });
      assert.equal(await page.evaluate(key => sessionStorage.getItem(key), OPENING_KEY), storage.openingRaw ?? JSON.stringify(storage.opening));
    }));
  }

  await t.test('an existing server session resumes without importing local opening knowledge', () => check({ opening: { ...OPENING, materials: [FORBIDDEN] } }, async (page, api) => {
    await ready(page);
    assert.equal(await page.locator('#opening-summary').count(), 0);
    assert.equal(await page.locator('#opening-warning').count(), 0);
    assert.equal(startRequests(api).length, 0);
    assert.equal(actionRequests(api).length, 0);
    assert.deepEqual(JSON.parse(await page.evaluate(key => sessionStorage.getItem(key), OPENING_KEY)), { ...OPENING, materials: [FORBIDDEN] });
  }));

  await t.test('320px Arabic and English render earned reading, comparison, safe text, focus and live status', () => check({}, async (page, api) => {
    await ready(page);
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    await textIncludes(page, '#scene-body', 'راوي الاختبار');
    assert.match(await page.locator('#scene-body').textContent(), /<img src=x/);
    assert.equal(await page.evaluate(() => window.fixtureInjected), undefined);
    assert.equal(await page.locator('#scene-body img').count(), 0);
    await page.locator('#comparison > summary').click();
    await page.locator('#compare-a').selectOption('fixture-letter');
    await page.locator('#compare-b').selectOption('fixture-map');
    await textIncludes(page, '#comparison-body', 'خريطة الاختبار');
    await noOverflow(page);
    await english(page);
    await textIncludes(page, '#scene-title', 'Fixture reading desk');
    await textIncludes(page, '#materials-list', 'Fixture letter');
    await textIncludes(page, '#comparison-body', 'Fixture map');
    assert.equal(await page.locator('#announcement').getAttribute('role'), 'status');
    assert.equal(await page.locator('#announcement').getAttribute('aria-live'), 'polite');
    await noOverflow(page);
    assert.equal(actionRequests(api).length, 0, 'changing the display language is not a story action');
  }));

  await t.test('generic field values are reviewed before POST; only projected action input is sent', () => check({}, async (page, api) => {
    await ready(page);
    await reportReview(page);
    assert.equal(actionRequests(api).length, 0);
    await textIncludes(page, '#review-panel', 'An invented browser report');
    await textIncludes(page, '#review-panel', 'My statement is a test');
    await textIncludes(page, '#review-panel', 'Fictional archive');
    await textIncludes(page, '#review-panel', 'Fixture letter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'review-title');
    await noOverflow(page);
    await page.locator('#review-confirm').focus();
    await page.keyboard.press('Enter');
    await textIncludes(page, '#scene-title', 'Fixture report recorded');
    assert.equal(actionRequests(api).length, 1);
    assertActionRequest(actionRequests(api)[0], 'fixture-report', 4);
    assert.deepEqual(actionRequests(api)[0].body.values, { subject: 'An invented browser report', summary: 'My statement is a test, not an established fact.', channel: 'fixture-archive', sources: ['fixture-letter'] });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scene-title');
    assert.ok((await page.locator('#announcement').textContent()).trim(), 'completed transitions announce their result');
    await textIncludes(page, '#receipts-body', 'Fictional receipt');
    assert.match(await page.locator('#receipts-panel').innerText(), /story|fictional/i);
    await page.locator('#language-ar').click();
    await textIncludes(page, '#scene-title', 'تم تسجيل تقرير الاختبار');
    await english(page);
    assert.equal(actionRequests(api).length, 1);
    await noOverflow(page);
  }));

  await t.test('receipt review shows the exact captured correction, recipients and earned attachments before confirmation in both languages', () => check({ receiptPreview: true }, async (page, api) => {
    await ready(page);
    const before = clone(api.state), preview = clone(api.state.actions[0].receiptPreview);
    const action = page.locator('form[data-action-id="fixture-file-correction"] button');
    await action.focus();await page.keyboard.press('Enter');
    await page.locator('#review-panel').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'review-title');
    assert.equal(actionRequests(api).length, 0);
    await textIncludes(page, '.receipt-preview', 'التصحيح المسجل');
    await textIncludes(page, '.receipt-preview', 'نسخة الجلسة: 2');
    await textIncludes(page, '.receipt-preview', 'الجهة التي أصدرت التقييم');
    await textIncludes(page, '.receipt-preview', 'الجهة المتابعة لواقعة المكتبة');
    await noOverflow(page);
    await english(page);
    await textIncludes(page, '.receipt-capture', preview.capture.values.text);
    await textIncludes(page, '.receipt-capture', 'Session revision: 2');
    await textIncludes(page, '.receipt-preview', 'The organization that issued the assessment');
    await textIncludes(page, '.receipt-preview', 'The organization following up the library incident');
    assert.doesNotMatch(await page.locator('.receipt-preview').innerText(), /LATEST_ALIAS_MUST_NOT_REPLACE_REVIEW|Unattached earned sheet|fixture-unrelated-recipient|fixture-receipt-5/);
    assert.deepEqual(await page.locator('.receipt-attachments>li>a').evaluateAll(links => links.map(link => [link.textContent, link.getAttribute('href')])), [['Fixture letter', '#material-fixture-letter'], ['Fixture map', '#material-fixture-map']]);
    await textIncludes(page, '.receipt-attachments', 'Source: Fictional desk');
    await textIncludes(page, '.receipt-attachments', 'Source: Fictional folder');
    assert.equal(await page.locator('.receipt-attachments>li').nth(0).innerText().then(text => text.includes('The organization following up the library incident')), false, 'each attachment shows only its actual recipients');
    await page.locator('.receipt-attachments a[href="#material-fixture-map"]').focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'material-fixture-map');
    assert.equal(await page.locator('#material-fixture-map').evaluate(node => node.open), true);
    await page.locator('.receipt-preview a[href="#receipt-fixture-receipt-original"]').focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'receipt-fixture-receipt-original');
    assert.deepEqual(api.state, before, 'reading the capture and source or related receipt links cannot mutate the case');
    await page.setViewportSize({ width: 390, height: 844 });await noOverflow(page, 390);
    await page.locator('#language-ar').click();await noOverflow(page, 390);
    await english(page);
    await page.locator('#review-confirm').focus();await page.keyboard.press('Enter');
    await page.locator('#review-panel').waitFor({ state: 'hidden' });
    await eventually(() => api.mutations === 1, 'confirmation did not file the reviewed receipt');
    assert.equal(actionRequests(api).length, 1);
    assertActionRequest(actionRequests(api)[0], 'fixture-file-correction', before.revision);
    assert.deepEqual(actionRequests(api)[0].body.values, {}, 'preview metadata and captured text are never sent back as action authority');
    const receipt = api.state.receipts.at(-1);
    assert.equal(receipt.fromCapture, preview.fromCapture);
    assert.equal(receipt.relatesTo, preview.relatesTo);
    assert.deepEqual(api.state.captures[receipt.fromCapture], preview.capture, 'the confirmed receipt uses exactly the reviewed capture');
    assert.deepEqual(api.state.shares.slice(before.shares.length).map(({ revision, ...share }) => share), preview.shares, 'the receipt shares exactly the reviewed materials with the reviewed recipients');
    await page.locator('#receipt-' + receipt.id + ' a').click();
    const focused = await page.evaluate(() => document.activeElement.textContent);
    assert.match(focused, /The exact earlier captured text/);
    assert.doesNotMatch(focused, /LATEST_ALIAS_MUST_NOT_REPLACE_REVIEW/);
  }));

  await t.test('cancelling receipt review preserves local drafts and does not create a pending operation or receipt', () => check({ receiptPreview: true }, async (page, api) => {
    await ready(page);await english(page);
    const draft = page.locator('form[data-action-id="fixture-report"]').getByLabel('Report summary', { exact: true });
    await draft.fill('Unsubmitted local draft survives receipt review.');
    const before = clone(api.state);
    await page.locator('form[data-action-id="fixture-file-correction"] button').click();
    await page.locator('#language-ar').click();
    await page.locator('#review-edit').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#review-panel').isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'action-fixture-file-correction');
    await english(page);
    assert.equal(await draft.inputValue(), 'Unsubmitted local draft survives receipt review.');
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY), null);
    assert.equal(actionRequests(api).length, 0);
    assert.deepEqual(api.state, before);
    await page.locator('form[data-action-id="fixture-advance"] button').click();
    await eventually(() => actionRequests(api).length === 1, 'ordinary no-field actions should still submit directly');
    assert.equal(await page.locator('#review-panel').isVisible(), false);
    assertActionRequest(actionRequests(api)[0], 'fixture-advance', before.revision);
  }));

  await t.test('changed case state rejects an old receipt review and refresh requires reviewing the new snapshot', () => check({ receiptPreview: true }, async (page, api) => {
    await ready(page);await english(page);
    await page.locator('form[data-action-id="fixture-file-correction"] button').click();
    api.state.revision += 1;
    const next = api.state.actions[0].receiptPreview;
    next.capture.revision = api.state.revision;
    next.capture.values.text = 'Changed correction that needs a fresh review.';
    next.fromCapture = 'fixture_delivery_report.revision.' + api.state.revision;
    await page.locator('#review-confirm').click();
    await textIncludes(page, '#connection-message', 'case state changed');
    assert.equal(api.mutations, 0);
    assert.equal(api.state.receipts.length, 1);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY), null, 'a rejected stale review is not retried as an uncertain operation');
    assert.equal(actionRequests(api)[0].body.revision, 4);
    await page.locator('#state-refresh').click();
    await page.waitForFunction(() => document.body.getAttribute('aria-busy') === 'false');
    assert.equal(await page.locator('#review-panel').isVisible(), false);
    await page.locator('form[data-action-id="fixture-file-correction"] button').click();
    await textIncludes(page, '.receipt-capture', next.capture.values.text);
    assert.doesNotMatch(await page.locator('.receipt-capture').innerText(), /exact earlier captured text/);
    await page.locator('#state-refresh').click();
    await page.locator('#review-panel').waitFor({ state: 'hidden' });
    assert.equal(actionRequests(api).length, 1, 'refresh invalidates the displayed review without submitting another action');
  }));

  await t.test('editing reviewed inputs requires a fresh review and preserves the new draft', () => check({}, async (page, api) => {
    await ready(page);await reportReview(page);
    const form = page.locator('form[data-action-id="fixture-report"]');
    await form.getByLabel('Report summary', { exact: true }).fill('A revised statement that has not been confirmed.');
    assert.equal(await page.locator('#review-panel').isVisible(), false);
    assert.equal(actionRequests(api).length, 0);
    await page.locator('#language-ar').click();await english(page);
    await form.locator('button[type="submit"]').click();
    await textIncludes(page, '#review-panel', 'A revised statement that has not been confirmed.');
    await page.locator('#review-edit').click();
    assert.equal(await form.getByLabel('Report summary', { exact: true }).inputValue(), 'A revised statement that has not been confirmed.');
    assert.equal(actionRequests(api).length, 0);
  }));

  await t.test('a receipt confirmed before a lost response retries the same operation without a second receipt', () => check({ receiptPreview: true, failures: ['network'] }, async (page, api) => {
    await ready(page);await english(page);
    await page.locator('form[data-action-id="fixture-file-correction"] button').click();
    await page.locator('#review-confirm').click();
    await page.locator('#operation-retry').waitFor({ state: 'visible' });
    const original = clone(actionRequests(api)[0].body);
    await page.locator('#language-ar').click();
    assert.equal(actionRequests(api).length, 1);
    await page.locator('#operation-retry').click();
    await eventually(async () => await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY) === null, 'receipt retry did not clear its pending operation');
    assert.deepEqual(actionRequests(api)[1].body, original);
    assert.equal(api.mutations, 1);
    assert.equal(api.state.receipts.length, 2, 'the earlier receipt and one new correction receipt remain');
  }));

  await t.test('case.note is offered only when projected and sends only the selected earned source', () => check({}, async (page, api) => {
    await ready(page);
    await english(page);
    await page.locator('#notebook > summary').click();
    const form = page.locator('#notebook-actions form[data-action-id="case.note"]');
    await form.getByLabel('Private note text', { exact: true }).fill('An explicitly private test observation.');
    await form.getByLabel('Private note source', { exact: true }).selectOption('fixture-map');
    assert.deepEqual(await form.locator('select option').evaluateAll(options => options.map(item => item.value).filter(Boolean)), ['fixture-letter', 'fixture-map']);
    await form.locator('button[type="submit"]').click();
    await page.locator('#review-confirm').click();
    await textIncludes(page, '#notes-list', 'An explicitly private test observation.');
    assert.equal(actionRequests(api).length, 1);
    assertActionRequest(actionRequests(api)[0], 'case.note', 4);
    assert.deepEqual(actionRequests(api)[0].body.values, { text: 'An explicitly private test observation.', sourceId: 'fixture-map' });
    assert.deepEqual(api.state.shares, [], 'a note does not become an implicit share');
  }));

  await t.test('the client does not invent a case.note action absent from projection', () => check({ notes: false }, async (page, api) => {
    await ready(page);
    assert.equal(await page.locator('[data-action-id="case.note"]').count(), 0);
    await english(page);
    assert.equal(await page.locator('[data-action-id="case.note"]').count(), 0);
    assert.equal(actionRequests(api).length, 0);
  }));

  await t.test('unknown network result and 503 retain one operation ID and input through explicit retries', () => check({ failures: ['network', '503'] }, async (page, api) => {
    await ready(page);
    await reportReview(page);
    await page.locator('#review-confirm').click();
    await page.locator('#operation-retry').waitFor({ state: 'visible' });
    assert.equal(actionRequests(api).length, 1);
    const original = clone(actionRequests(api)[0].body);
    let pending = await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY);
    assert.ok(pending && pending.includes(original.id), 'an uncertain operation remains recoverable');
    await page.locator('#language-ar').click();
    assert.equal(actionRequests(api).length, 1, 'language changes cannot retry an uncertain write');
    await page.reload();
    await page.locator('#operation-retry').waitFor({ state: 'visible' });
    await textIncludes(page, '#scene-title', 'تم تسجيل تقرير الاختبار');
    assert.equal(actionRequests(api).length, 1, 'reload restores the operation without submitting it automatically');
    assert.deepEqual(JSON.parse(await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY)), original);
    await page.locator('#operation-retry').click();
    await eventually(() => actionRequests(api).length === 2, 'first explicit retry was not sent');
    await page.locator('#operation-retry').waitFor({ state: 'visible' });
    assert.deepEqual(actionRequests(api)[1].body, original, '503 retry preserves the entire original request');
    pending = await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY);
    assert.ok(pending && pending.includes(original.id));
    await page.locator('#operation-retry').click();
    await eventually(async () => await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY) === null, 'successful retry did not clear its pending operation');
    assert.equal(actionRequests(api).length, 3);
    assert.deepEqual(actionRequests(api)[2].body, original);
    assert.equal(api.mutations, 1, 'the first write committed once even though its response was lost');
    assert.equal(api.state.receipts.length, 1);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY), null);
  }));

  await t.test('language change during a write keeps the same operation and ignores its late original response', () => check({}, async (page, api) => {
    await ready(page);
    await reportReview(page);
    api.holdAction = true;
    await page.locator('#review-confirm').click();
    await eventually(() => api.heldAction !== null, 'the first action response was not held');
    const original = clone(actionRequests(api)[0].body);
    await page.locator('#language-ar').click();
    assert.equal(actionRequests(api).length, 1);
    await page.locator('#operation-retry').click();
    await eventually(async () => await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY) === null, 'explicit retry did not complete');
    assert.equal(actionRequests(api).length, 2);
    assert.deepEqual(actionRequests(api)[1].body, original);
    assert.equal(api.mutations, 1);
    api.heldAction.result.scene.title = localized('Obsolete action response', 'استجابة إجراء قديمة');
    const response = page.waitForResponse(item => item.url().endsWith('/api/case/actions'));
    api.heldAction.release();
    await response;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await textIncludes(page, '#scene-title', 'تم تسجيل تقرير الاختبار');
    assert.doesNotMatch(await page.locator('#scene-title').textContent(), /استجابة إجراء قديمة/);
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY), null);
  }));

  await t.test('a pending read arriving after a language switch cannot replace the current projection', () => check({}, async (page, api) => {
    await ready(page);
    api.holdState = clone(api.state);
    api.holdState.scene.title = localized('Obsolete fixture response', 'استجابة اختبار قديمة');
    await page.locator('#state-refresh').click();
    await eventually(() => api.heldState !== null, 'refresh read was not held');
    await english(page);
    const response = page.waitForResponse(item => item.url().endsWith('/api/case/state'));
    api.heldState.release();
    await response;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await textIncludes(page, '#scene-title', 'Fixture reading desk');
    assert.doesNotMatch(await page.locator('#scene-title').textContent(), /Obsolete/);
    assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
    assert.equal(actionRequests(api).length, 0);
    await noOverflow(page);
  }));

  await t.test('opening=none ignores an older valid import without deleting it', () => check({ requireStart: true, opening: { version: 'paper-opening-2026-11-05-r2', choice: 'precise', recipient: 'jonas' } }, async (page, api) => {
    await page.locator('#opening-summary').waitFor();
    const original = await page.evaluate(key => sessionStorage.getItem(key), OPENING_KEY);
    await page.goto(page.url() + '?opening=none');
    await page.locator('#case-start').waitFor();
    assert.equal(await page.locator('#opening-summary').count(), 0);
    await page.locator('#case-start').click();await ready(page);
    assert.deepEqual(startRequests(api)[0].body, { contentVersion: VERSION });
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), OPENING_KEY), original);
    await page.reload();await ready(page);
    assert.equal(startRequests(api).length, 1, 'existing sessions still resume');
  }));

  await t.test('material disclosures retain their state and source links reveal the requested document', () => check({}, async (page, api) => {
    await ready(page);
    assert.equal(await page.locator('#materials-list details[open]').count(), 0);
    await page.locator('#material-fixture-letter summary').click();
    await page.evaluate(() => document.getElementById('language-en').click());
    assert.equal(await page.locator('#material-fixture-letter').evaluate(node => node.open), true);
    await page.locator('#state-refresh').click();
    await textIncludes(page, '#scene-title', 'Fixture reading desk');
    assert.equal(await page.locator('#material-fixture-letter').evaluate(node => node.open), true);
    api.state.notes.push({ id: 'fixture-existing-note', text: 'Fixture note referring to an earned map.', sourceId: 'fixture-map' });
    await page.locator('#state-refresh').click();
    await page.locator('#notebook summary').click();
    await page.locator('#notes-list a[href="#material-fixture-map"]').click();
    assert.equal(await page.locator('#material-fixture-map').evaluate(node => node.open), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'material-fixture-map');
    api.state.materials.push({ id: 'fixture-new-sheet', title: localized('Newly requested sheet', 'ورقة طُلبت الآن'), body: localized('An earned fixture sheet.', 'ورقة اختبار مكتسبة.'), source: localized('Fixture source', 'مصدر الاختبار'), type: 'document' });
    await page.locator('#state-refresh').click();
    await page.locator('#material-fixture-new-sheet').waitFor();
    assert.equal(await page.locator('#material-fixture-new-sheet').evaluate(node => node.open), true, 'a newly acquired requested material is not hidden');
    assert.equal(actionRequests(api).length, 0);
  }));

  await t.test('storage uncertainty pauses changes without losing the pending operation', () => check({ failures: ['503'] }, async (page, api) => {
    await ready(page);await reportReview(page);await page.locator('#review-confirm').click();
    await page.locator('#operation-retry').waitFor({ state: 'visible' });
    const original = clone(actionRequests(api)[0].body), actions = clone(api.state.actions);
    Object.assign(api.state, { saveStatus: 'unconfirmed', readOnly: true, storageUnavailable: true, actions: [] });
    await page.locator('#state-refresh').click();
    await textIncludes(page, '#save-status', 'Saving is unconfirmed');
    assert.equal(await page.locator('#operation-retry').count(), 0);
    assert.equal(await page.locator('#actions form').count(), 0);
    assert.equal(await page.locator('#notebook-actions form').count(), 0);
    assert.doesNotMatch(await page.locator('#save-status').innerText(), /was saved|server memory only/);
    assert.deepEqual(JSON.parse(await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY)), original);
    assert.equal(actionRequests(api).length, 1);
    Object.assign(api.state, { saveStatus: 'confirmed', readOnly: false, storageUnavailable: false, actions });
    await page.locator('#storage-refresh').click();
    await page.locator('#operation-retry').click();
    await eventually(async () => await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY) === null, 'recovered storage did not settle the original operation');
    assert.deepEqual(actionRequests(api)[1].body, original);
    assert.equal(api.mutations, 1);
  }));

  await t.test('an older confirmed disk session remains readable and exportable with a version notice', () => check({}, async (page, api) => {
    await ready(page);
    Object.assign(api.state, { contentVersion: VERSION + '-earlier', readOnly: true, contentVersionMismatch: true, actions: [] });
    const previous = clone(api.state);
    const operation = JSON.stringify({ id: 'fixture-old-version-operation', revision: previous.revision, contentVersion: previous.contentVersion, actionId: 'fixture-advance', values: {} });
    await page.evaluate(({key,operation}) => sessionStorage.setItem(key,operation), {key:PENDING_KEY,operation});
    await page.reload();await ready(page);
    await textIncludes(page, '#connection-title', 'اختلاف إصدار المحتوى');
    await textIncludes(page, '#save-status', 'حُفظت هذه الخطوة');
    await english(page);
    await textIncludes(page, '#connection-title', 'read-only');
    await textIncludes(page, '#connection-message', 'different content version');
    await textIncludes(page, '#save-status', 'This step was saved');
    assert.doesNotMatch(await page.locator('#connection').innerText(), /not confirmed|storage.*restored/);
    assert.equal(await page.locator('#actions form,#notebook-actions form,#operation-retry,#case-start').count(), 0);
    assert.equal(await page.locator('#pending-download').count(), 1);
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY), operation);
    await textIncludes(page, '#materials-list', 'Fixture letter');
    const downloadPromise = page.waitForEvent('download');await page.locator('#case-export').click();
    const exported = JSON.parse(fs.readFileSync(await (await downloadPromise).path(), 'utf8'));
    assert.equal(exported.contentVersion, previous.contentVersion);assert.equal(exported.revision, previous.revision);
    assert.equal(exported.readOnly, true);assert.deepEqual(exported.materials, previous.materials);
    Object.assign(api.state, { storageUnavailable: true, saveStatus: 'unconfirmed' });
    await page.locator('#state-refresh').click();
    await textIncludes(page, '#connection-title', 'saving could not be confirmed');
    await textIncludes(page, '#save-status', 'Saving is unconfirmed');
    assert.doesNotMatch(await page.locator('#save-status').innerText(), /was saved/);
    Object.assign(api.state, { storageUnavailable: false, saveStatus: 'confirmed' });
    await page.locator('#storage-refresh').click();
    await textIncludes(page, '#connection-title', 'read-only');await textIncludes(page, '#save-status', 'This step was saved');
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY), operation);
    assert.equal(actionRequests(api).length, 0);assert.equal(startRequests(api).length, 0);
  }));

  await t.test('an unexplained read-only state remains paused without claiming confirmed saving', () => check({}, async (page, api) => {
    await ready(page);await english(page);
    Object.assign(api.state, { readOnly: true, actions: [] });
    await page.locator('#state-refresh').click();
    await textIncludes(page, '#save-status', 'Saving is unconfirmed');
    assert.equal(await page.locator('#actions form,#notebook-actions form,#operation-retry').count(), 0);
    assert.doesNotMatch(await page.locator('#save-status').innerText(), /was saved/);
    assert.equal(actionRequests(api).length, 0);
  }));

  await t.test('recording range review uses earned materials and keeps its selection across language changes', () => check({}, async (page, api) => {
    await ready(page);
    api.state.materials.push(
      { id: 'fixture-range-a', type: 'recording', title: localized('00:00–00:04', '00:00–00:04'), body: localized('Fixture doorway only. No event inside is visible.', 'عتبة اختبار فقط. لا تظهر الواقعة في الداخل.'), source: localized('Fixture excerpt A', 'مقتطف الاختبار أ') },
      { id: 'fixture-range-b', type: 'recording', title: localized('00:04–00:08', '00:04–00:08'), body: localized('An unidentified fixture sound; no attribution.', 'صوت اختبار مجهول المصدر؛ دون إسناد.'), source: localized('Fixture excerpt B', 'مقتطف الاختبار ب') }
    );
    await page.locator('#state-refresh').click();
    await page.locator('#timeline-range').selectOption('fixture-range-b');
    await textIncludes(page, '#timeline-inspection', 'صوت اختبار مجهول المصدر');
    await english(page);
    assert.equal(await page.locator('#timeline-range').inputValue(), 'fixture-range-b');
    await textIncludes(page, '#timeline-inspection', 'no attribution');
    assert.deepEqual(await page.locator('#timeline-range option').evaluateAll(options => options.map(option => option.value)), ['', 'fixture-range-a', 'fixture-range-b']);
    assert.equal(actionRequests(api).length, 0, 'reading an earned range cannot invent an author action');
    await noOverflow(page);
  }));

  await t.test('captured field metadata preserves readable report choices after refresh', () => check({}, async (page, api) => {
    await ready(page);
    api.state.captures.fixture_saved_report = {
      actionId: 'completed-fixture-action', revision: 3,
      label: localized('Earlier fixture report', 'تقرير اختبار سابق'),
      fields: [
        { id: 'destination', type: 'select', label: localized('Destination', 'الوجهة'), options: [{ value: 'fixture-only-code', label: localized('Fictional receiving desk', 'مكتب الاستلام الخيالي') }] },
        { id: 'sources', type: 'materialRefs', label: localized('Chosen sources', 'المصادر المختارة') }
      ],
      values: { destination: 'fixture-only-code', sources: ['fixture-letter'] }
    };
    await page.locator('#state-refresh').click();await english(page);
    await textIncludes(page, '#reports-body', 'Fictional receiving desk');
    assert.doesNotMatch(await page.locator('#reports-body').innerText(), /fixture-only-code/);
    assert.equal(await page.locator('#reports-body a[href="#material-fixture-letter"]').count(), 1);
    assert.equal(actionRequests(api).length, 0);
  }));

  await t.test('RTL times, grouped shares and receipt snapshot aliases remain readable without changing data', () => check({}, async (page, api) => {
    await ready(page);
    api.state.materials.push({ id: 'fixture-clock', title: localized('Review 00:00–00:23', 'فحص 00:00–00:23'), body: localized('At 01:12 a fictional sound occurs.', 'عند 01:12 يصدر صوت خيالي.'), type: 'recording', source: localized('Fixture recording', 'تسجيل اختبار') });
    api.state.shares = [
      { materialId: 'fixture-letter', recipient: 'assessment_review', revision: 2 },
      { materialId: 'fixture-map', recipient: 'assessment_review', revision: 3 },
      { materialId: 'fixture-clock', recipient: 'incident_followup', revision: 4 }
    ];
    const latest = { actionId: 'fixture-capture', revision: 4, label: localized('Saved fixture report', 'تقرير اختبار محفوظ'), values: { text: 'Current fictional report' } };
    api.state.captures = { report: clone(latest), 'report.revision.4': clone(latest), 'report.revision.2': { ...clone(latest), revision: 2, values: { text: 'Earlier fictional report' } } };
    api.state.receipts = [{ id: 'fixture-immutable-receipt', kind: 'fixture', title: localized('Fixture delivery', 'تسليم اختبار'), scope: 'story-only', fromCapture: 'report.revision.4', revision: 4 }];
    await page.locator('#state-refresh').click();
    assert.equal(await page.locator('#material-fixture-clock summary').textContent(), 'فحص 00:00–00:23');
    assert.equal(await page.locator('#material-fixture-clock summary bdi').getAttribute('dir'), 'ltr');
    assert.equal(await page.locator('#material-fixture-clock summary bdi').innerText(), '00:00–00:23');
    assert.equal(await page.locator('#permissions-body>details').count(), 2);
    assert.equal(await page.locator('#permissions-body>details[open]').count(), 0);
    assert.doesNotMatch(await page.locator('#permissions-body').innerText(), /assessment_review|incident_followup/);
    await page.locator('#shares-summary-assessment_review').click();
    assert.equal(await page.locator('#permissions-body details[data-recipient="assessment_review"] li').count(), 2);
    await english(page);
    assert.equal(await page.locator('#permissions-body details[data-recipient="assessment_review"]').evaluate(node => node.open), true);
    assert.equal(await page.locator('#reports-body article').count(), 2, 'an identical current capture/snapshot pair is displayed once, while a distinct older revision remains');
    await page.locator('#receipts-body a').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'capture-report');
    assert.match(await page.locator('#capture-report').innerText(), /Current fictional report/);
    assert.equal(Object.keys(api.state.captures).length, 3, 'presentation does not rewrite the stored snapshots');
    assert.equal(actionRequests(api).length, 0);
    await noOverflow(page);
  }));

  await t.test('a corrupt pending operation with extra authority is preserved and not sent', () => check({}, async (page, api) => {
    await ready(page);
    const raw = JSON.stringify({ id: 'fixture-pending-id', revision: 4, contentVersion: VERSION, actionId: 'fixture-advance', values: {}, target: FORBIDDEN });
    await page.evaluate(({ key, raw }) => sessionStorage.setItem(key, raw), { key: PENDING_KEY, raw });
    await page.reload();await page.locator('#pending-download').waitFor();await english(page);
    await textIncludes(page, '#connection', 'original local record was left unchanged');
    assert.equal(await page.evaluate(key => sessionStorage.getItem(key), PENDING_KEY), raw);
    assert.equal(await page.locator('#operation-retry').count(), 0);
    assert.equal(actionRequests(api).length, 0);
  }));

  await t.test('export downloads the current earned session artifact', () => check({}, async (page, api) => {
    await ready(page);
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#case-export').click();
    const download = await downloadPromise;
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(exported.caseId, 'fictional-browser-fixture');
    assert.deepEqual(exported.materials.map(item => item.id), ['fixture-letter', 'fixture-map']);
    assert.equal(exported.contentVersion, VERSION);
    assert.doesNotMatch(JSON.stringify(exported), new RegExp(FORBIDDEN));
    assert.equal(api.requests.filter(item => item.pathname === '/api/case/export').length, 1);
    assert.equal(actionRequests(api).length, 0);
  }));
});
