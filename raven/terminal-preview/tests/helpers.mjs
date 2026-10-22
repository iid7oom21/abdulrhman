import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const { test, expect } = require(process.env.PLAYWRIGHT_TEST_MODULE || '@playwright/test');
export const PREVIEW = process.env.RAVEN_PREVIEW_URL || 'http://127.0.0.1:8786/raven/terminal-preview/';
export const route = path => new URL(path, PREVIEW).href;
export const CASE = route('case-017/');
export async function boot(page, path = '') {
  await page.goto(route(path), { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main#route-outlet')).toBeVisible();
  await expect(page.locator('#preview-soundtrack')).toHaveCount(1);
}
export async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
export async function previewStorage(page) {
  return page.evaluate(() => Object.fromEntries(Object.entries(localStorage)
    .filter(([key]) => key.startsWith('raven-preview:v1'))
    .map(([key, value]) => {
      try { return [key, JSON.parse(value)]; } catch { return [key, value]; }
    })));
}
