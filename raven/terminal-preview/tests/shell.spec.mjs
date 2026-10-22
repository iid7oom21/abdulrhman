import { test, expect, PREVIEW, route, boot, expectNoOverflow, openEvidence, selectCaseTab } from './helpers.mjs';

const paths = ['', 'raven-17/', 'raven-17/part-1/', 'raven-17/part-2/', 'raven-17/part-3/', 'zarqa/', 'case-017/'];

test('every direct route has a static entry, noindex, and a mounted accessible page', async ({ page, request }) => {
  for (const path of paths) {
    const response = await request.get(route(path));
    expect(response.status(), path).toBe(200);
    const html = await response.text();
    expect(html, path).toMatch(/name=["']robots["'][^>]+noindex/i);
    await boot(page, path);
    await expect(page.locator('#route-outlet h1')).toBeVisible();
    expect(await page.locator('iframe').count()).toBe(0);
    await expectNoOverflow(page);
  }
});

for (const width of [320, 390, 430, 1440]) {
  test(`home and investigation fit at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width > 500 ? 1000 : 844 });
    await boot(page);
    await expectNoOverflow(page);
    await page.screenshot({ path: info.outputPath(`home-${width}.png`), fullPage: true });
    await boot(page, 'case-017/');
    await expectNoOverflow(page);
    await page.screenshot({ path: info.outputPath(`case-${width}.png`), fullPage: true });
    const visibleSmallControls = await page.locator('button').evaluateAll(buttons => buttons.filter(button => {
      const r = button.getBoundingClientRect();
      return r.width && r.height && getComputedStyle(button).visibility !== 'hidden' && (r.height < 47.5 || r.width < 47.5);
    }).map(button => ({ text: button.textContent.trim(), width: button.offsetWidth, height: button.offsetHeight })));
    expect(visibleSmallControls).toEqual([]);
  });
}

test('cold load fetches no song or episode and the reduced motion hero remains a poster', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await boot(page);
  await page.waitForLoadState('networkidle');
  expect(requests.filter(url => /raven-baqi-athar.*\.mp3|episode-[123]\.mp4/i.test(url))).toEqual([]);
  const soundtrack = page.locator('#preview-soundtrack');
  expect(await soundtrack.evaluate(element => element.currentSrc || element.getAttribute('src') || '')).toBe('');
  expect(await soundtrack.evaluate(element => element.paused)).toBe(true);
  expect(await page.locator('video').evaluateAll(videos => videos.every(video => video.paused))).toBe(true);
});

test('internal navigation and Back keep the exact same audio node', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page);
  await page.evaluate(() => { window.__previewAudio = document.querySelector('#preview-soundtrack'); });
  const caseLink = page.locator('a[href*="/case-017/"]').first();
  await caseLink.click();
  await expect(page).toHaveURL(/\/case-017\//);
  await expect(page.locator('#route-outlet h1')).toHaveText('التوقيع الرابع.');
  expect(await page.evaluate(() => window.__previewAudio === document.querySelector('#preview-soundtrack'))).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(PREVIEW);
  await expect(page.locator('#route-outlet h1')).toHaveText(/كل حكاية\s*تترك أثرًا\./);
  await expect(page.locator('.home-page')).toBeVisible();
  expect(await page.evaluate(() => window.__previewAudio === document.querySelector('#preview-soundtrack'))).toBe(true);
  expect(errors).toEqual([]);
});

test('case to films to episode to case to home mounts each destination without route cleanup errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page, 'case-017/');
  await selectCaseTab(page, 'evidence');
  await expect(page.locator('.case-evidence-card')).toHaveCount(16);
  await page.locator('#site-header a[href$="/raven-17/"]').click();
  await expect(page).toHaveURL(route('raven-17/'));
  await expect(page.locator('#route-outlet h1')).toHaveText('RAVEN 17');
  await expect(page.locator('[data-episode-card]')).toHaveCount(2);
  await expect(page.locator('.case-page')).toHaveCount(0);
  await page.locator('[data-episode-card="1"] a').first().click();
  await expect(page).toHaveURL(route('raven-17/part-1/'));
  await expect(page.locator('#route-outlet h1')).toHaveText('RAVEN 17 — الجزء الأول');
  await expect(page.locator('[data-film-video="1"]')).toBeVisible();
  await page.locator('#site-header a[href$="/case-017/"]').click();
  await expect(page).toHaveURL(route('case-017/'));
  await expect(page.locator('#route-outlet h1')).toHaveText('التوقيع الرابع.');
  await selectCaseTab(page, 'evidence');
  await expect(page.locator('.case-evidence-card')).toHaveCount(16);
  await expect(page.locator('[data-film-video]')).toHaveCount(0);
  await page.locator('#site-header .brand').click();
  await expect(page).toHaveURL(PREVIEW);
  await expect(page.locator('#route-outlet h1')).toHaveText(/كل حكاية\s*تترك أثرًا\./);
  await expect(page.locator('.home-hero')).toBeVisible();
  await expect(page.locator('[data-episode-card]')).toHaveCount(2);
  await expect(page.locator('.case-page')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a failed soundtrack does not prevent entering the case or reading evidence', async ({ page }) => {
  await page.route('**/*raven-baqi-athar*.mp3*', intercepted => intercepted.abort());
  await boot(page);
  await page.locator('a[href*="/case-017/"]').first().click();
  await openEvidence(page, 'E01');
  await expect(page.locator('dialog[open]')).toBeVisible();
  await expect(page.locator('dialog[open]')).toContainText('محضر المسؤولية');
});

test('all preview storage remains isolated from legacy progress', async ({ context, page }) => {
  const legacy = JSON.stringify({ viewedIds: ['E02'], solvedIds: ['Q01'], activeIndex: 1 });
  await context.addInitScript(value => {
    if (!localStorage.getItem('test:legacy-seeded')) {
      localStorage.setItem('raven-case:fourth-signature-reconstruction', value);
      localStorage.setItem('raven17_episode_1_progress', '42');
      localStorage.setItem('raven_language', 'ar');
      localStorage.setItem('test:legacy-seeded', '1');
    }
  }, legacy);
  await boot(page, 'case-017/');
  await openEvidence(page, 'E01');
  await expect(page.locator('dialog[open]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('raven-case:fourth-signature-reconstruction'))).toBe(legacy);
  expect(await page.evaluate(() => localStorage.getItem('raven17_episode_1_progress'))).toBe('42');
});

test('denied persistent storage leaves the current session usable', async ({ context, page }) => {
  await context.addInitScript(() => {
    Storage.prototype.setItem = function () { throw new DOMException('Storage disabled', 'SecurityError'); };
    Storage.prototype.getItem = function () { throw new DOMException('Storage disabled', 'SecurityError'); };
  });
  await boot(page, 'case-017/');
  await openEvidence(page, 'E01');
  await expect(page.locator('dialog[open]')).toBeVisible();
  await expect(page.locator('dialog[open]')).toContainText('محضر المسؤولية');
});
