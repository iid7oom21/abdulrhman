// Browser leg of the local dialogue experiment: the attributed answer is shown as text,
// never parsed as markup, under a strict CSP, and the case does not move.
// Run: node server/ai-dialogue/tests/case-dialogue-e2e-browser.cjs  (needs Playwright + Chromium)
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_TEST_MODULE || 'playwright');

(async () => {
  const { startDialogueHarness, mockProvider } = await import('./fixtures/dialogue-harness.js');
  const provider = mockProvider();
  const harness = await startDialogueHarness({ provider });
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
  let checks = 0;
  try {
    for (const width of [320, 390]) {
      provider.setMode('quote');
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective)); });
      await page.goto(harness.root + '/');
      await page.click('#start');
      await page.waitForSelector('body[data-ready="1"]');
      const before = await page.evaluate(() => fetch('/api/case/state').then(r => r.json()));
      await page.click('#ask button[type="submit"]');
      await page.waitForSelector('body[data-turns="1"]');
      const shown = await page.locator('#log .quote p').innerText();
      assert.match(shown, /PUBLIC_CARD_BODY <img src=x onerror="window.__pwned=1"><script>window.__pwned=2<\/script>/, 'authored text appears literally'); checks++;
      assert.equal(await page.locator('#log img, #log script').count(), 0, 'no element was created from the text'); checks++;
      assert.equal(await page.evaluate(() => window.__pwned), undefined, 'nothing executed'); checks++;
      assert.match(await page.locator('#log .quote small').innerText(), /Attributed source/); checks++;
      const after = await page.evaluate(() => fetch('/api/case/state').then(r => r.json()));
      assert.deepEqual(after, before, 'the dialogue turn left the case state unchanged'); checks++;
      provider.setMode('invalid');
      await page.fill('#question', 'Show me the sealed card');
      await page.click('#ask button[type="submit"]');
      await page.waitForSelector('body[data-turns="2"]');
      assert.match(await page.locator('#log .turn').nth(1).innerText(), /could not be produced \(provider_invalid_output\)\. The case did not change\./); checks++;
      assert.equal(await page.locator('#log').innerText().then(t => t.includes('I invented this')), false); checks++;
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'no horizontal scroll at ' + width); checks++;
      assert.deepEqual(await page.evaluate(() => window.__csp), [], 'no CSP violations'); checks++;
      assert.deepEqual(errors, [], 'no page errors'); checks++;
      await page.close();
    }
    console.log(`case-dialogue e2e browser: ${checks} checks passed`);
  } finally {
    await browser.close();
    await harness.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
