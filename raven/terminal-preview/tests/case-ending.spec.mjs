import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect, route, boot, caseState, expectNoOverflow, selectCaseTab } from './helpers.mjs';
import { ACTIVITIES, solutions, solutionFor, seedExpansion, readRequiredSources, fillActivity, submitActivity } from './activity-journey.mjs';

// Test-only native H.264 + AAC fixture: 64x36, 2fps, exactly 14 seconds.
// Its AAC track is silent; it verifies real media loading/muting, not finished story audio.
const ENDING_VIDEO = Buffer.from('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AAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAVAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAE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AAAGQZogF6GwARggBwAAAAZBmkAXobAAAAAGQZpgF6GwARggBwAAAAZBmoAXobAAAAAGQZqgF6GwARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAAZBmsAXobABGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcAAAAGQZrgF6GwARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcAAAAGQZsAF6GwARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcAAAAGQZsgF6GwARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHAAAABkGbQBehsAEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAH3gIATGF2YzYxLjE5LjEwMQACMEAOARggBwEYIAcAAAAGQZtgF6GwARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHAAAABkGbgBehsAEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHAAAABkGboBehsAEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAAZBm8AXobABGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAAZBm+AXobABGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAAZBmgAXobABGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcAAAAGQZogF6GwARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcAAAAGQZpAF6GwARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHAAAABkGaYBehsAEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHAAAABkGagBehsAEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAAZBmqAXobABGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAfeAgBMYXZjNjEuMTkuMTAxAAIwQA4BGCAHARggBwEYIAcBGCAHAAAABkGawBehsAEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAAZBmuAXobABGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAAZBmwAXobABGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAAZBmyAXobABGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcAAAAGQZtAF6GwARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcAAAAGQZtgF6GwARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAH', 'base64');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function readyManifest(overrides = {}) {
  return { version: 1, video: { id: 'case-017-ending', status: 'ready',
    url: route('__ending_fixtures__/ending.mp4'), mime: 'video/mp4', bytes: ENDING_VIDEO.length,
    sha256: digest(ENDING_VIDEO), durationSeconds: 14, hasAudio: true, ...overrides } };
}
const pendingManifest = () => ({ version: 1, video: { id: 'case-017-ending', status: 'pending', url: null } });
const endingDialog = page => page.locator('[data-case-ending][open]');

async function endingRoutes(page, manifest = pendingManifest(), { broken = false } = {}) {
  const requests = [];
  await page.route('**/assets/case-ending.json', request => {
    requests.push('manifest'); return request.fulfill({ json: manifest });
  });
  await page.route('**/__ending_fixtures__/ending.mp4', request => {
    requests.push('video'); return request.fulfill(broken ? { status: 404, body: 'Unavailable test fixture' }
      : { contentType: 'video/mp4', body: ENDING_VIDEO });
  });
  return requests;
}

async function finishLastActivity(page, context) {
  await seedExpansion(context, 31);
  await boot(page, 'case-017/');
  const last = ACTIVITIES[31];
  await readRequiredSources(page, last);
  await fillActivity(page, last, solutionFor(await solutions(), last));
  await submitActivity(page, last);
  await expect.poll(async () => (await caseState(page)).progress.accepted.length).toBe(32);
  await expect(endingDialog(page)).toBeVisible();
}

function musicFixture() {
  const rate = 48000, count = rate * 2;
  const bytes = Buffer.alloc(44 + count * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24); bytes.writeUInt32LE(rate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(count * 2, 40);
  for (let index = 0; index < count; index++) bytes.writeInt16LE(Math.round(Math.sin(index / rate * Math.PI * 440) * 300), 44 + index * 2);
  return bytes;
}

/** Isolated lifecycle harness, using the real normalized store, gate and audio owner. */
async function harness(page, { through = 32, manifest = pendingManifest(), broken = false, quiet = false } = {}) {
  await seedExpansion(page.context(), through);
  const requests = await endingRoutes(page, manifest, { broken });
  await page.route('**/*raven-baqi-athar*.mp3*', request => request.fulfill({ contentType: 'audio/wav', body: musicFixture() }));
  await page.addInitScript(() => {
    window.__endingBlobs = []; window.__endingRevoked = [];
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = object => { const url = create(object); window.__endingBlobs.push(url); return url; };
    URL.revokeObjectURL = url => { window.__endingRevoked.push(url); revoke(url); };
  });
  await page.route('**/__case-ending-harness__', request => request.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${route('styles.css')}"><link rel="stylesheet" href="${route('modules/case-ending.css')}"><link rel="stylesheet" href="${route('modules/audio.css')}"><style>body{margin:0;background:#101510;color:#eee}main{max-width:900px;margin:auto}#launch{min-height:48px}</style></head><body><main id="host"><button id="launch">أعد مشهد النهاية</button><output id="report-result"></output></main><div id="dock"></div></body></html>` }));
  await page.goto(route('__case-ending-harness__'));
  await page.evaluate(async ({ base, manifest, quiet }) => {
    const core = await import(new URL('modules/core.js', base));
    const { createInvestigation } = await import(new URL('modules/investigation.js', base));
    const { createAudio } = await import(new URL('modules/audio.js', base));
    const { createCaseEnding } = await import(new URL('modules/case-ending.js', base));
    const store = core.createStore(); store.set('caseQuiet', quiet);
    const services = { store, caseStore: core.createCaseStore(store), caseData: core.CASE, caseAsset: core.caseAsset,
      caseEndingMedia: manifest, t: ar => ar, notify: () => {}, lang: 'ar' };
    services.investigation = createInvestigation(services);
    services.audio = createAudio(document.querySelector('#dock'), services);
    const ducks = new Set(); const events = [];
    const duck = services.audio.duck, unduck = services.audio.unduck;
    services.audio.duck = (token, factor) => { ducks.add(token); events.push(['duck', token, factor]); duck(token, factor); };
    services.audio.unduck = token => { ducks.delete(token); events.push(['unduck', token]); unduck(token); };
    let reports = 0;
    const ending = createCaseEnding(document.querySelector('#host'), services, { onReport() {
      reports++; document.querySelector('#report-result').textContent = 'التقرير النهائي';
    } });
    document.querySelector('#launch').addEventListener('click', () => ending.open());
    window.endingHarness = { services, ending, events, ducks: () => [...ducks], reports: () => reports,
      state: () => services.caseStore.get(), destroy() { ending.destroy(); services.investigation.destroy(); } };
  }, { base: route(''), manifest, quiet });
  return requests;
}

async function openHarness(page) {
  await page.locator('#launch').click();
  await expect(endingDialog(page)).toBeVisible();
}

test('forged completion cannot reveal an ending, replay control, or fetch ending assets', async ({ page, context }) => {
  const requests = await endingRoutes(page, readyManifest());
  const modules = [];
  page.on('request', request => { if (request.url().includes('modules/case-ending.js')) modules.push(request.url()); });
  await seedExpansion(context, 0, { solvedIds: ['Q01', 'Q02', 'Q03', 'Q04'],
    ending: { version: 1, presentedAt: 1, completedAt: 2, skippedAt: 0, runKey: 'forged' },
    progress: { completedActivityIds: ACTIVITIES.map(item => item.id), accepted: [], completedAt: 1 } });
  await boot(page, 'case-017/');
  await selectCaseTab(page, 'deductions');
  await expect(page.locator('[data-ending-replay]:visible')).toHaveCount(0);
  await expect(endingDialog(page)).toHaveCount(0);
  expect((await caseState(page)).ending).toEqual({ version: 1, presentedAt: 0, completedAt: 0, skippedAt: 0, runKey: '' });
  expect(requests).toEqual([]); expect(modules).toEqual([]);
  // The module's own public entry point independently checks the real engine gate.
  await harness(page, { through: 0, manifest: readyManifest() });
  expect(await page.evaluate(() => endingHarness.ending.open({ automatic: true }))).toBe(false);
  await expect(endingDialog(page)).toHaveCount(0);
  expect(await page.evaluate(() => endingHarness.ducks())).toEqual([]);
});

test('real A32 completion presents the reduced-motion ending once, then supports report and manual replay', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const requests = await endingRoutes(page, readyManifest());
  await finishLastActivity(page, context);
  const dialog = endingDialog(page);
  await expect(dialog.locator('[data-ending-report]')).toBeVisible();
  await expect(dialog).toContainText('B17-R');
  await expect(dialog).toContainText('الحريق');
  expect(requests).toEqual([]);
  const first = (await caseState(page)).ending;
  expect(first.presentedAt).toBeGreaterThan(0); expect(first.completedAt).toBeGreaterThan(0); expect(first.skippedAt).toBe(0);
  await expectNoOverflow(page);
  await dialog.locator('[data-ending-report]').click();
  await expect(endingDialog(page)).toHaveCount(0);
  const report = page.locator('#case-final-report');
  await expect(report).toBeVisible();
  await expect(report.locator('.case-report-limits')).toContainText('الحريق');
  await expect(report.locator('.case-report-expansion')).toContainText('B17-R');
  await expect(report.locator('.case-report-expansion')).toContainText('لا يثبت وحده تعمد الإخفاء');
  await page.reload();
  await expect(page.locator('[data-activity-id="A32"]')).toBeVisible();
  await expect(endingDialog(page)).toHaveCount(0);
  expect((await caseState(page)).ending.presentedAt).toBe(first.presentedAt);
  const replay = page.locator('[data-activity-id="A32"] [data-ending-replay]');
  await replay.focus(); await page.keyboard.press('Enter');
  await expect(endingDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(endingDialog(page)).toHaveCount(0);
  await expect(replay).toBeFocused();
  await selectCaseTab(page, 'deductions');
  await page.locator('[data-ending-replay]:visible').click();
  await expect(endingDialog(page)).toBeVisible();
  expect((await caseState(page)).progress.accepted).toHaveLength(32);
});

test('skip at 320px reaches the final card without pretending the whole cinematic played', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 320, height: 844 });
  await endingRoutes(page);
  await finishLastActivity(page, context);
  const dialog = endingDialog(page);
  const skip = dialog.locator('[data-ending-skip]');
  await expect(skip).toBeVisible();
  await skip.focus(); await page.keyboard.press('Enter');
  await expect(dialog.locator('[data-ending-report]')).toBeVisible();
  const saved = (await caseState(page)).ending;
  expect(saved.skippedAt).toBeGreaterThan(0); expect(saved.completedAt).toBe(0);
  await expect(dialog).toContainText('B17-R');
  await expectNoOverflow(page);
  for (let index = 0; index < 7; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await dialog.locator('[data-ending-report]').click();
  await expect(page.locator('#case-final-report')).toBeVisible();
});

test('loading an already completed run stays quiet; reset removes ending progress and keeps music preference', async ({ page, context }) => {
  await seedExpansion(context, 32);
  await context.addInitScript(() => localStorage.setItem('raven-preview:v1:musicEnabled', 'false'));
  await boot(page, 'case-017/');
  await expect(endingDialog(page)).toHaveCount(0);
  await page.locator('[data-activity-id="A32"] [data-ending-replay]').click();
  await expect(endingDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'إعادة فتح الملف من البداية', exact: true }).click();
  await page.getByRole('button', { name: 'ابدأ ملفًا جديدًا', exact: true }).click();
  await expect(page.locator('[data-activity-id="A01"]')).toBeVisible();
  expect((await caseState(page)).ending).toEqual({ version: 1, presentedAt: 0, completedAt: 0, skippedAt: 0, runKey: '' });
  expect(await page.evaluate(() => localStorage.getItem('raven-preview:v1:musicEnabled'))).toBe('false');
  await expect(page.locator('[data-ending-replay]:visible')).toHaveCount(0);
});

test('an unavailable ending module leaves the completed investigation and report usable', async ({ page, context }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route(/\/modules\/case-ending\.js(?:\?.*)?$/, request => request.abort());
  await seedExpansion(context, 31);
  await boot(page, 'case-017/');
  await readRequiredSources(page, ACTIVITIES[31]);
  await fillActivity(page, ACTIVITIES[31], solutionFor(await solutions(), ACTIVITIES[31]));
  await submitActivity(page, ACTIVITIES[31]);
  await expect(page.locator('#case-final-report')).toBeVisible();
  expect((await caseState(page)).progress.accepted).toHaveLength(32);
  expect(errors).toEqual([]);
});

test('the pending-media DOM cinematic finishes its real timeline without fabricating video or audio', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 320, height: 844 });
  const requests = await harness(page);
  await page.clock.install();
  await openHarness(page);
  await expect(endingDialog(page).locator('[data-ending-skip]')).toBeVisible();
  await expect(page.locator('[data-ending-video]:visible')).toHaveCount(0);
  expect(await page.locator('[data-ending-video]').getAttribute('src')).toBeNull();
  await page.clock.fastForward(4000);
  await expect(endingDialog(page).locator('[data-ending-stage]')).toHaveAttribute('data-scene', '1');
  const artifacts = process.env.RAVEN_ENDING_SCREENSHOTS;
  if (artifacts) {
    await mkdir(artifacts, { recursive: true });
    await page.screenshot({ path: join(artifacts, 'ending-documents-320.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: join(artifacts, 'ending-documents-desktop.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 320, height: 844 });
  }
  await page.clock.fastForward(11000);
  await expect(endingDialog(page).locator('[data-ending-report]')).toBeVisible();
  if (artifacts) await page.screenshot({ path: join(artifacts, 'ending-final-320.png'), animations: 'disabled' });
  expect(await page.evaluate(() => endingHarness.state().ending.completedAt)).toBeGreaterThan(0);
  expect(await page.evaluate(() => endingHarness.ducks())).toEqual([]);
  expect(requests).toEqual([]); // override manifest is local; there is no approved video to fetch
});

test('quiet mode displays the final card immediately without fetching even a ready video', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const requests = await harness(page, { quiet: true, manifest: readyManifest() });
  await openHarness(page);
  await expect(endingDialog(page).locator('[data-ending-report]')).toBeVisible();
  expect(requests).toEqual([]);
});

test('a verified native ending video starts muted, ducks only when audible and restores the original music volume', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const requests = await harness(page, { manifest: readyManifest() });
  await openHarness(page);
  const video = endingDialog(page).locator('[data-ending-video]');
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  expect(await video.evaluate(element => element.duration)).toBeCloseTo(14, 1);
  expect(await video.evaluate(element => element.muted)).toBe(true);
  expect(await page.evaluate(() => endingHarness.ducks())).toEqual([]);
  await expect.poll(() => video.evaluate(element => !element.paused)).toBe(true);
  await endingDialog(page).locator('[data-ending-play]').click();
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(true);
  await endingDialog(page).locator('[data-ending-play]').click();
  await expect.poll(() => video.evaluate(element => !element.paused)).toBe(true);
  await endingDialog(page).locator('[data-ending-sound]').click();
  await expect.poll(() => video.evaluate(element => !element.paused && !element.muted)).toBe(true);
  await expect.poll(() => page.evaluate(() => endingHarness.ducks().length)).toBe(1);
  expect(await page.locator('#preview-soundtrack').evaluate(element => element.volume)).toBeLessThan(.65);
  await video.evaluate(element => { element.currentTime = 13.8; });
  await expect(endingDialog(page).locator('[data-ending-report]')).toBeVisible();
  expect(await page.evaluate(() => endingHarness.state().ending.completedAt)).toBeGreaterThan(0);
  expect(await page.evaluate(() => endingHarness.ducks())).toEqual([]);
  await page.evaluate(() => { window.retiredEndingVideo = document.querySelector('[data-ending-video]'); });
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => endingHarness.ducks())).toEqual([]);
  expect(await page.locator('#preview-soundtrack').evaluate(element => element.volume)).toBeCloseTo(.65, 3);
  expect(await page.evaluate(() => retiredEndingVideo.paused)).toBe(true);
  expect(requests).toEqual(['video']);
  await page.evaluate(() => endingHarness.destroy());
  expect(await page.evaluate(() => __endingBlobs.every(url => __endingRevoked.includes(url)))).toBe(true);
});

test('Back navigation during an audible ending destroys its video and preserves the shell soundtrack node', async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seedExpansion(context, 32);
  await endingRoutes(page, readyManifest());
  await page.route('**/*raven-baqi-athar*.mp3*', request => request.fulfill({ contentType: 'audio/wav', body: musicFixture() }));
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await boot(page);
  await page.evaluate(() => { window.originalSong = document.querySelector('#preview-soundtrack'); });
  await page.locator('a[href*="/case-017/"]').first().click();
  await expect(page.locator('[data-activity-id="A32"]')).toBeVisible();
  await page.locator('[data-activity-id="A32"] [data-ending-replay]').click();
  await endingDialog(page).locator('[data-ending-sound]').click();
  const video = endingDialog(page).locator('[data-ending-video]');
  await expect.poll(() => video.evaluate(element => !element.paused && !element.muted)).toBe(true);
  await expect.poll(() => page.locator('#preview-soundtrack').evaluate(element => element.volume)).toBeLessThan(.65);
  await page.evaluate(() => { window.disposedEnding = document.querySelector('[data-ending-video]'); });
  await page.goBack();
  await expect(page.locator('.home-page')).toBeVisible();
  await expect(page.locator('[data-case-ending]')).toHaveCount(0);
  expect(await page.evaluate(() => disposedEnding.paused && !disposedEnding.getAttribute('src'))).toBe(true);
  expect(await page.evaluate(() => originalSong === document.querySelector('#preview-soundtrack'))).toBe(true);
  expect(await page.locator('#preview-soundtrack').evaluate(element => element.volume)).toBeCloseTo(.65, 3);
  expect((await caseState(page)).progress.accepted).toHaveLength(32);
  expect(errors).toEqual([]);
});

test('manual music-off survives audible ending playback, pause, replay, and destruction', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await harness(page, { manifest: readyManifest() });
  await page.locator('[data-audio-toggle]').click();
  await expect.poll(() => page.locator('#preview-soundtrack').evaluate(element => !element.paused)).toBe(true);
  await page.locator('[data-audio-toggle]').click();
  expect(await page.evaluate(() => endingHarness.services.store.get('musicEnabled'))).toBe(false);
  await openHarness(page);
  await expect(endingDialog(page).locator('[data-ending-sound]')).toBeVisible();
  await endingDialog(page).locator('[data-ending-sound]').click();
  await expect.poll(() => page.evaluate(() => endingHarness.ducks().length)).toBe(1);
  expect(await page.locator('#preview-soundtrack').evaluate(element => element.paused)).toBe(true);
  await endingDialog(page).locator('[data-ending-skip]').click();
  expect(await page.evaluate(() => endingHarness.ducks())).toEqual([]);
  await endingDialog(page).locator('[data-ending-replay]').click();
  await expect(endingDialog(page).locator('[data-ending-video]')).toBeVisible();
  await page.evaluate(() => endingHarness.destroy());
  await expect(endingDialog(page)).toHaveCount(0);
  expect(await page.evaluate(() => endingHarness.ducks())).toEqual([]);
  expect(await page.evaluate(() => endingHarness.services.store.get('musicEnabled'))).toBe(false);
  expect(await page.locator('#preview-soundtrack').evaluate(element => element.paused)).toBe(true);
});

test('visibility changes pause audible media, release ducking and retain a playable position', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await harness(page, { manifest: readyManifest() });
  await openHarness(page);
  const video = endingDialog(page).locator('[data-ending-video]');
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  await endingDialog(page).locator('[data-ending-sound]').click();
  await expect.poll(() => page.evaluate(() => endingHarness.ducks().length)).toBe(1);
  const position = await video.evaluate(element => element.currentTime);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(true);
  expect(await page.evaluate(() => endingHarness.ducks())).toEqual([]);
  expect(await video.evaluate(element => element.currentTime)).toBeGreaterThanOrEqual(position);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(endingDialog(page)).toBeVisible();
  await page.evaluate(() => endingHarness.destroy());
  expect(await page.evaluate(() => endingHarness.ducks())).toEqual([]);
});

for (const failure of ['network', 'hash']) {
  test(`optional-video ${failure} failure retains the honest DOM ending and leaves audio ownership clean`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await harness(page, { manifest: readyManifest(failure === 'hash' ? { sha256: '0'.repeat(64) } : {}), broken: failure === 'network' });
    await openHarness(page);
    await expect(endingDialog(page).locator('[data-ending-status]')).toContainText(/تعذّر|تعذر|غير متاح|لم/);
    await expect(page.locator('[data-ending-video]:visible')).toHaveCount(0);
    await endingDialog(page).locator('[data-ending-skip]').click();
    await expect(endingDialog(page).locator('[data-ending-report]')).toBeVisible();
    expect(await page.evaluate(() => endingHarness.ducks())).toEqual([]);
    expect(errors).toEqual([]);
  });
}
