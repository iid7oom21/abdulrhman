import { readFile } from 'node:fs/promises';
import { test, expect, route, boot, caseState } from './helpers.mjs';
import { seedExpansion } from './activity-journey.mjs';

const corePattern = /\/terminal-preview\/modules\/core\.js(?:\?.*)?$/;
const casePattern = /\/terminal-preview\/modules\/case\.js(?:\?.*)?$/;
const paths = ['', 'case-017/', 'raven-17/', 'raven-17/part-1/', 'raven-17/part-2/', 'raven-17/part-3/', 'zarqa/'];
const note = { id: 'release-note', evidenceId: 'E09', paragraphIndex: 0, type: 'ملاحظة',
  text: 'ملاحظة المحقق محفوظة أثناء تحديث الموقع.', quote: '', createdAt: 1700000000000 };

async function savedInvestigation(context) {
  const state = await seedExpansion(context, 4, { notes: [note] });
  await context.addInitScript(() => {
    // A new document token distinguishes a real navigation from retrying the
    // same rejected entry in the browser's module map.
    window.__releaseDocument = crypto.randomUUID();
    if (!localStorage.getItem('test:release-preferences')) {
      localStorage.setItem('raven-preview:v1:musicEnabled', 'false');
      localStorage.setItem('raven-preview:v1:episode:1', JSON.stringify({ time: 42, duration: 180, completed: false }));
      localStorage.setItem('test:release-preferences', '1');
    }
  });
  return state;
}

async function expectSavedInvestigation(page, seeded) {
  const state = await caseState(page);
  expect(state.progress.accepted).toEqual(seeded.progress.accepted);
  expect(state.notes).toEqual([expect.objectContaining(note)]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('raven-preview:v1:musicEnabled')))).toBe(false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('raven-preview:v1:episode:1')))).toEqual({ time: 42, duration: 180, completed: false });
  await expect(page.locator('[data-activity-id="A05"]')).toBeVisible();
}

async function oldCoreAPI() {
  const source = await readFile(new URL('../modules/core.js', import.meta.url), 'utf8');
  // Model the exact incompatible cache entry from before the ending release,
  // without making CI depend on git history or duplicating the whole old site.
  expect(source).toContain('export const caseCompletionKey');
  return source.replace('export const caseCompletionKey', 'const caseCompletionKey');
}

test('all seven static entries declare one coherent release for the app and styles', async ({ request }) => {
  const versions = new Set();
  for (const path of paths) {
    const response = await request.get(route(path));
    expect(response.ok(), path).toBe(true);
    const html = await response.text();
    const app = html.match(/<script\b[^>]*\bsrc=["']([^"']*modules\/app\.js[^"']*)["']/i)?.[1];
    expect(app, path).toBeTruthy();
    const version = new URL(app, route(path)).searchParams.get('v');
    expect(version, path).toBeTruthy(); versions.add(version);
    const styles = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/gi)].map(match => match[1]);
    expect(styles.length, path).toBeGreaterThanOrEqual(3);
    for (const style of styles) expect(new URL(style, route(path)).searchParams.get('v'), `${path}: ${style}`).toBe(version);
  }
  expect(versions.size).toBe(1);
});

test('stale unversioned core is ignored across the initial and lazy module graph without losing saved work', async ({ page, context }) => {
  const seeded = await savedInvestigation(context);
  const stale = await oldCoreAPI();
  const staleRequests = [], requested = [], errors = [];
  await page.route(corePattern, request => {
    const url = new URL(request.request().url());
    if (url.searchParams.has('v')) return request.continue();
    staleRequests.push(url.href);
    return request.fulfill({ contentType: 'text/javascript', body: stale });
  });
  page.on('request', request => requested.push(request.url()));
  page.on('pageerror', error => errors.push(error.message));
  await boot(page, 'case-017/');
  await expectSavedInvestigation(page, seeded);
  await page.locator('[data-open-toolkit]').click();
  await page.locator('[data-tool="training-morse"]').click();
  await expect(page.locator('[data-training-answer="morse"]')).toBeVisible();
  const entry = await page.locator('script[type="module"][src]').getAttribute('src');
  const version = new URL(entry, page.url()).searchParams.get('v');
  const graph = requested.map(url => new URL(url)).filter(url => /\/terminal-preview\/modules\/.*\.(js|css)$/.test(url.pathname) || /\/fourth-signature\/.*\.js$/.test(url.pathname));
  expect(graph.length).toBeGreaterThan(15);
  expect(graph.some(url => url.pathname.endsWith('/training.js'))).toBe(true);
  expect(graph.some(url => url.pathname.endsWith('/case.css'))).toBe(true);
  expect(graph.some(url => url.pathname.endsWith('/case-data.js'))).toBe(true);
  for (const url of graph) expect(url.searchParams.get('v'), url.href).toBe(version);
  expect(staleRequests).toEqual([]); expect(errors).toEqual([]);
});

test('Retry after a case-module transport failure starts a fresh document and preserves investigation, music and film progress', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const seeded = await savedInvestigation(context);
  let attempts = 0;
  await page.route(casePattern, request => ++attempts === 1 ? request.abort() : request.continue());
  await page.goto(route('case-017/?lang=ar#case-workspace'));
  await expect(page.locator('#route-outlet h1')).toHaveText('تعذّر فتح الملف');
  const documentToken = await page.evaluate(() => window.__releaseDocument);
  await page.getByRole('button', { name: 'أعد المحاولة', exact: true }).click();
  await expect(page.locator('.case-page')).toBeVisible();
  expect(await page.evaluate(() => window.__releaseDocument)).not.toBe(documentToken);
  expect(attempts).toBe(2);
  const address = new URL(page.url());
  expect(address.searchParams.get('_reload')).toBeTruthy();
  expect(address.searchParams.get('lang')).toBe('ar');
  expect(address.hash).toBe('#case-workspace');
  await expectSavedInvestigation(page, seeded);
});

test('Retry also recovers a cached ESM linking failure instead of reusing the rejected module promise', async ({ page, context }) => {
  const seeded = await savedInvestigation(context);
  const stale = await oldCoreAPI();
  const errors = []; let attempts = 0;
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route(corePattern, request => ++attempts === 1 ? request.fulfill({ contentType: 'text/javascript', body: stale }) : request.continue());
  await page.goto(route('case-017/'));
  await expect(page.locator('#route-outlet h1')).toHaveText('تعذّر فتح الملف');
  expect(errors.join('\n')).toContain('caseCompletionKey');
  const documentToken = await page.evaluate(() => window.__releaseDocument);
  await page.getByRole('button', { name: 'أعد المحاولة', exact: true }).click();
  await expect(page.locator('.case-page')).toBeVisible();
  expect(await page.evaluate(() => window.__releaseDocument)).not.toBe(documentToken);
  expect(attempts).toBe(2);
  await expectSavedInvestigation(page, seeded);
});
