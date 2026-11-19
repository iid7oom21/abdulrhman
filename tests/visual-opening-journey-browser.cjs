// Full local presentation journey, using the actual shell and unchanged scene engine.
// RAVEN_JOURNEY_QA_DIR=/path node --test tests/visual-opening-journey-browser.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.RAVEN_JOURNEY_QA_DIR;
const files = ['content.html', 'opening-visual.js', 'opening-visual.css', 'reading-continuity.js', 'reading-tools.js', 'opening-artwork.js'].map(file => 'raven/deleted-name/' + file);
const fingerprint = () => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
const state = frame => frame.evaluate(() => {
  const hook = document.querySelector('#hook');
  return { phase: hook.dataset.phase, choice: hook.dataset.choice, recipient: hook.dataset.recipient,
    layers: JSON.parse(hook.dataset.layers), comparison: document.querySelector('#hook-comparison')?.hidden,
    notes: JSON.parse(document.querySelector('#reading-tools').dataset.notes).entries.map(({ id, sourceId, kind, text }) => ({ id, sourceId, kind, text })),
    source: document.querySelector('#reading-source').value, draft: document.querySelector('#reading-note').value,
    kind: document.querySelector('#reading-kind').value,
    selected: document.querySelector('[data-reading-selected="true"]')?.dataset.hookAction || null };
});
const settle = frame => frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('message, gate, comparison and response remain usable with no images or audio', async t => {
  const inline = [...fs.readFileSync(path.join(root, files[0]), 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => crypto.createHash('sha256').update(match[1]).digest('hex'));
  assert.deepEqual(inline, ['dff24955e544e1bce81ae6d247afabe1e838875d54720bf5bfafbcc259454205', '4706a6c7a49e6f8432f2b7078addb1c0fd85453c977d2a68d06a8b5b78f4ed49'], 'approved inline copy and engine remain unchanged');
  const before = fingerprint(), results = [];
  const server = http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    let pathname; try { pathname = decodeURIComponent(new URL(req.url, 'http://fixture').pathname); } catch { res.writeHead(400); return res.end(); }
    if (pathname.startsWith('/api/')) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"local_static_preview"}'); }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) || pathname.split('/').some(part => part.startsWith('.')) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' })[path.extname(file)] || 'application/octet-stream');
    if (req.method === 'HEAD') return res.end(); fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  t.after(async () => {
    await browser.close(); await new Promise(resolve => server.close(resolve));
    if (output) { fs.mkdirSync(output, { recursive: true }); fs.writeFileSync(path.join(output, 'journey-results.json'), JSON.stringify({ mode: 'Actual local Chromium shell; images/media and external requests blocked', baseRevision: 'd557ac2145943c488cd71f2bb6470c439429f2d4', before, after: fingerprint(), filesStable: JSON.stringify(before) === JSON.stringify(fingerprint()), results }, null, 2) + '\n'); }
  });
  for (const width of [320, 390]) for (const language of ['ar', 'en']) for (const input of ['touch', 'keyboard']) await t.test(`${width}px ${language} ${input}`, async () => {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: input === 'touch', isMobile: input === 'touch', reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [], writes = [], blocked = [];
    const record = { width, language, input, status: 'RUNNING', errors, writes, blocked }; results.push(record);
    page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) writes.push({ method: request.method(), url: request.url() });
      if (new URL(request.url()).origin !== base || ['image', 'media'].includes(request.resourceType())) { blocked.push({ type: request.resourceType(), url: request.url() }); return route.abort(); }
      return route.continue();
    });
    try {
      await page.goto(base + '/raven/deleted-name/?lang=' + language, { waitUntil: 'domcontentloaded' });
      await page.frameLocator('#site-content').locator('#task-message-preview').waitFor();
      const frame = await (await page.locator('#site-content').elementHandle()).contentFrame();
      assert.ok(frame);
      await frame.waitForFunction(() => document.querySelector('#task-message-quote')?.textContent.trim() && document.querySelector('#opening-card-dialog'));
      const activate = async locator => {
        if (input === 'touch') await locator.tap(); else { await locator.focus(); await page.keyboard.press('Enter'); }
        // Finish the existing hash-navigation focus restoration before sending
        // the next keyboard action; otherwise its RAF can steal the next focus.
        await settle(frame);
      };
      const closeCard = async () => { if (input === 'touch') await activate(frame.locator('.card-dialog-close')); else await page.keyboard.press('Escape'); };
      await frame.evaluate(() => { window.__inspectCalls = 0; document.querySelector('#hook').addEventListener('raven:inspect-part', () => window.__inspectCalls++); });
      assert.equal(await frame.locator('html').getAttribute('dir'), language === 'ar' ? 'rtl' : 'ltr');
      assert.equal(await frame.locator('#main > section').first().getAttribute('aria-labelledby'), 'task-message-label', 'the first scene starts with Victor’s task');
      assert.equal(await frame.locator('#assignment-stage').evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector('#title')) & Node.DOCUMENT_POSITION_FOLLOWING)), true, 'the assignment precedes the case title');
      const firstMessage = await frame.locator('[data-k="m1"]').textContent();
      const taskQuote = await frame.locator('#task-message-quote').textContent();
      assert.equal(taskQuote, firstMessage.trim().split(/\.\s*/).filter(Boolean).at(-1) + '.', 'the opening quote is the final sentence of the existing first message');
      assert.ok((await frame.locator('#task-message-preview').boundingBox()).height >= 44);
      const initial = await state(frame);
      const sourceMessages = await frame.locator('#assignment-stage .thread .msg').evaluateAll(rows => rows.map(row => ({ speaker: row.querySelector('.who').textContent, text: row.querySelector('p').textContent })));
      assert.equal(sourceMessages.length, 3, 'the preview uses the three existing messages only');
      const messageButton = frame.locator('#task-message-preview'); await messageButton.scrollIntoViewIfNeeded(); const messageY = await frame.evaluate(() => scrollY);
      await activate(messageButton);
      assert.deepEqual(await frame.locator('.message-row').evaluateAll(rows => rows.map(row => ({ speaker: row.querySelector('strong').textContent, text: row.querySelector('p').textContent }))), sourceMessages);
      assert.deepEqual(await state(frame), initial, 'reading the letter grants no choice, recipient or draft');
      if (input === 'keyboard') {
        await page.keyboard.press('Tab');
        assert.equal(await frame.locator('#opening-card-dialog').evaluate(node => node.contains(document.activeElement)), true, 'Tab remains inside the reading dialog');
        // Chromium may first focus the scrollable dialog itself before its close button.
        if (!await frame.locator('.card-dialog-close').evaluate(node => document.activeElement === node)) await page.keyboard.press('Tab');
        assert.equal(await frame.locator('.card-dialog-close').evaluate(node => document.activeElement === node), true, 'the close button is reachable by Tab');
        await page.keyboard.press('Tab');
        assert.equal(await frame.locator('#opening-card-dialog').evaluate(node => node.contains(document.activeElement)), true, 'forward Tab from the close button does not leave the modal');
        await page.keyboard.press('Shift+Tab');
        assert.equal(await frame.locator('#opening-card-dialog').evaluate(node => node.contains(document.activeElement)), true, 'reverse Tab does not enter the background');
      }
      await closeCard(); assert.equal(await messageButton.evaluate(node => document.activeElement === node), true); assert.ok(Math.abs(await frame.evaluate(() => scrollY) - messageY) <= 2);
      await activate(frame.locator('#assignment-stage .journey-actions a[href="#t-arrive"]'));
      assert.equal(await frame.locator('#old-message-quote').textContent(), language === 'ar' ? 'الأصل عندي.' : 'I have the original.');
      assert.equal(await frame.locator('[data-k="a3"]').textContent(), language === 'ar' ? 'ما فيه مقارنة الليلة.' : "There's no comparison tonight.");
      const gateText = await frame.locator('#arrival-stage').innerText(); assert.ok(gateText.indexOf(language === 'ar' ? 'الأصل عندي.' : 'I have the original.') < gateText.indexOf(language === 'ar' ? 'أشوف الورقة' : 'See the paper'));
      await activate(frame.locator('[data-journey-paper]')); assert.equal((await state(frame)).phase, 'invite');
      await activate(frame.locator('#arrival-stage a[href="#t-assign"]')); await activate(frame.locator('[data-journey-paper]')); assert.equal((await state(frame)).phase, 'invite', 'returning to the scene must not advance it twice');
      await activate(frame.locator('[data-hook-action="enter"]')); assert.equal((await state(frame)).phase, 'compare');
      await activate(frame.locator('[data-hook-action="compare-toggle"]'));
      await activate(frame.locator('[data-hook-action="source-original"]'));
      await frame.locator('#reading-kind').selectOption('hypothesis'); await frame.locator('#reading-note').fill('PRIVATE-ADDED-NOTE'); await activate(frame.locator('#reading-add'));
      await frame.locator('#reading-note').fill('PRIVATE-PENDING-DRAFT-KEEP-MY-CARET');
      await frame.locator('#reading-note').evaluate(node => { node.focus(); node.setSelectionRange(4, 13, 'forward'); }); await settle(frame);
      await activate(frame.locator('[data-hook-action="source-conclusion"]'));
      const beforeRead = await state(frame); assert.equal(beforeRead.source, 'document-original'); assert.equal(beforeRead.selected, 'source-conclusion'); assert.equal(beforeRead.notes.length, 1);
      const inspectCalls = await frame.evaluate(() => window.__inspectCalls); assert.equal(inspectCalls, 2);
      const paperButton = frame.locator('[data-visual-open="paper"]'); await paperButton.scrollIntoViewIfNeeded(); const paperY = await frame.evaluate(() => scrollY);
      const paperText = await frame.locator('#hook-document > dl').innerText(); await activate(paperButton); assert.equal(await frame.locator('.card-dialog-body dl').innerText(), paperText); await closeCard();
      assert.deepEqual(await state(frame), beforeRead); assert.ok(Math.abs(await frame.evaluate(() => scrollY) - paperY) <= 2);
      const comparison = frame.locator('#hook-comparison > section:nth-of-type(2)');
      await comparison.evaluate(node => { window.scrollTo({ top: scrollY + node.getBoundingClientRect().top - 130, behavior: 'instant' }); }); await settle(frame);
      const comparisonTop = (await comparison.boundingBox()).y;
      await activate(frame.locator('#lang-switch')); await settle(frame);
      assert.deepEqual(await state(frame), beforeRead, 'language keeps chosen passage, private note, draft, source and game state');
      assert.equal(await frame.evaluate(() => window.__inspectCalls), inspectCalls, 'locale restoration must not replay inspection');
      const afterLanguageTop = (await comparison.boundingBox()).y; assert.ok(Math.abs(afterLanguageTop - comparisonTop) <= 2, `comparison anchor moved from ${comparisonTop} to ${afterLanguageTop}`);
      assert.deepEqual(await frame.locator('#reading-note').evaluate(node => [node.selectionStart, node.selectionEnd]), [4, 13], 'private draft caret survives translation');
      await activate(frame.locator('#lang-switch')); await settle(frame); assert.deepEqual(await state(frame), beforeRead);
      assert.ok(Math.abs((await comparison.boundingBox()).y - comparisonTop) <= 2);
      if (output) { fs.mkdirSync(output, { recursive: true }); await page.screenshot({ path: path.join(output, `journey-comparison-${language}-${width}-${input}.png`) }); }
      await activate(frame.locator('[data-hook-action="continue"]'));
      const expectedEffects = language === 'ar' ? {
        precise: 'يفتح مسودة، ثم معاينة للنص والمستلم قبل التأكيد.',
        wait: 'قول داخل المشهد فقط؛ لا ينشئ مسودة أو مستلمًا.',
        refuse: 'قول داخل المشهد فقط؛ لا ينشئ مسودة أو مستلمًا.'
      } : {
        precise: 'Opens a draft, then a preview of the text and recipient before confirmation.',
        wait: 'A spoken response only. No written draft or recipient is created.',
        refuse: 'A spoken response only. No written draft or recipient is created.'
      };
      assert.equal(await frame.locator('.decision-effect').count(), 3);
      for (const [action, text] of Object.entries(expectedEffects)) {
        assert.equal(await frame.locator('#opening-effect-' + action).textContent(), text, 'effect captions describe writing and delivery, not a character reaction');
        assert.equal(await frame.locator('[data-hook-action="' + action + '"]').getAttribute('aria-describedby'), 'opening-effect-' + action);
      }
      const beforeEffectLanguage = await state(frame);
      await activate(frame.locator('#lang-switch')); await settle(frame); await activate(frame.locator('#lang-switch')); await settle(frame);
      assert.deepEqual(await state(frame), beforeEffectLanguage); assert.equal(await frame.locator('.decision-effect').count(), 3);
      if (width === 320) {
        const spokenChoice = input === 'touch' ? 'wait' : 'refuse';
        await activate(frame.locator('[data-hook-action="' + spokenChoice + '"]'));
        const deferred = await state(frame); assert.equal(deferred.phase, 'after'); assert.equal(deferred.layers.draftWritten, null); assert.equal(deferred.layers.sceneShared, null); assert.equal(deferred.recipient, '');
        assert.equal(await frame.locator('#hook-draft,#hook-share-review,[data-hook-action^="recipient-"]').count(), 0);
        record.branch = 'spoken ' + spokenChoice + ' only';
      } else {
        await activate(frame.locator('[data-hook-action="precise"]')); await activate(frame.locator('[data-hook-action="recipient-both"]'));
        const review = await state(frame); assert.equal(review.phase, 'review'); assert.equal(review.layers.sceneShared, null); assert.equal(review.recipient, 'both');
        assert.equal(await frame.locator('#hook-share-review [data-part="correction"]').innerText(), await frame.locator('#hook-draft > p').first().innerText());
        assert.deepEqual(review.layers.recipientKnowledge, { jonas: [], claire: [], elena: [] });
        await activate(frame.locator('[data-hook-action="edit-recipient"]')); await activate(frame.locator('[data-hook-action="recipient-draft"]'));
        assert.equal((await state(frame)).layers.sceneShared, null); await activate(frame.locator('[data-hook-action="confirm"]'));
        const kept = await state(frame); assert.equal(kept.phase, 'after'); assert.equal(kept.recipient, 'draft'); assert.equal(kept.layers.sceneShared, null);
        record.branch = 'review both recipients, return, keep private';
      }
      await activate(frame.locator('[data-hook-action="record"]')); assert.equal((await state(frame)).phase, 'done');
      const sound = await page.locator('#site-soundtrack').evaluate(audio => ({ paused: audio.paused, time: audio.currentTime })); assert.deepEqual(sound, { paused: true, time: 0 });
      assert.equal(await page.locator('audio').count(), 1); assert.equal(await page.locator('#music-track-picker option').count(), 13);
      assert.ok(blocked.some(item => item.type === 'image')); assert.deepEqual(writes, []); assert.deepEqual(errors, []);
      const geometry = await frame.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth })); assert.ok(geometry.document <= geometry.width + 1);
      record.finalState = await state(frame); record.geometry = geometry; record.anchor = { before: comparisonTop, translated: afterLanguageTop }; record.inspections = inspectCalls;
      await activate(frame.locator('[data-hook-action="replay"]')); const replay = await state(frame); assert.equal(replay.selected, null); assert.deepEqual(replay.notes, []); assert.equal(replay.draft, '');
      record.status = 'PASS';
    } catch (error) { record.status = 'FAIL'; record.failure = error.message; throw error; } finally { await context.close(); }
  });
  assert.deepEqual(fingerprint(), before, 'acceptance assets must stay fixed during the run');
});
