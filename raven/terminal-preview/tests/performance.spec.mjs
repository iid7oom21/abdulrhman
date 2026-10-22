import { test, expect, boot } from './helpers.mjs';

test('normal first load stays below the 1.5 MB transfer budget', async ({ browser, browserName }, info) => {
  test.skip(browserName !== 'chromium', 'Transfer accounting uses Chromium CDP.');
  const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  const received = [];
  const urls = new Map();
  cdp.on('Network.requestWillBeSent', event => urls.set(event.requestId, event.request.url));
  cdp.on('Network.loadingFinished', event => received.push({ url: urls.get(event.requestId), bytes: event.encodedDataLength }));
  try {
    await boot(page);
    await page.waitForLoadState('networkidle');
    const total = received.reduce((sum, entry) => sum + entry.bytes, 0);
    await info.attach('initial-transfer.json', { body: JSON.stringify({ total, received }, null, 2), contentType: 'application/json' });
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(1500000);
    expect(received.some(entry => /raven-baqi-athar|episode-[123]\.mp4/.test(entry.url || ''))).toBe(false);
  } finally { await context.close(); }
});

test('Save-Data keeps the cinematic hero as a poster', async ({ context, page }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await boot(page);
  await page.waitForLoadState('networkidle');
  expect(requests.filter(url => /hero-loop\.mp4/.test(url))).toEqual([]);
  expect(await page.locator('video').evaluateAll(videos => videos.every(video => video.paused))).toBe(true);
});
