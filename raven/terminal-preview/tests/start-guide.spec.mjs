import { test, expect, boot, caseState, selectCaseTab, expectNoOverflow } from './helpers.mjs';
import { seedExpansion } from './activity-journey.mjs';

const guidePreference = 'raven-preview:v1:caseStartGuideCollapsed';
const score = state => ({
  accepted: state.progress.accepted,
  hints: state.progress.hintsByActivity,
  wrong: state.progress.wrongSubmissions,
  solved: state.solvedIds,
});

test('beginner guide explains the workflow without solving, keeps drafts and remembers dismissal at 320px', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await context.addInitScript(() => localStorage.setItem('raven-preview:v1:musicEnabled', 'false'));
  await boot(page, 'case-017/');
  const guide = page.locator('[data-start-guide]');
  const initial = await caseState(page);
  await expect(guide).toHaveAttribute('open', '');
  await expect(guide.locator('summary')).toContainText('كيف أبدأ التحقيق؟');
  await expect(guide).not.toContainText('B17-R');
  await expect(guide.locator('[data-guide-source]')).toBeVisible();
  expect(initial.viewedIds).toEqual([]);
  expect(initial.progress.accepted).toEqual([]);
  expect(initial.progress.hintsByActivity).toEqual({});
  await expectNoOverflow(page);

  const draft = page.locator('[data-activity-id="A01"] [data-activity-field="code"]');
  await draft.fill('مسودة فحص');
  await guide.locator('[data-guide-source]').click();
  await expect(page.locator('.case-dialog[open] [data-document="E09"]')).toBeVisible();
  expect((await caseState(page)).viewedIds).toEqual(['E09']);
  await page.getByRole('button', { name: 'عُد إلى المهمة الحالية ←', exact: true }).click();
  await expect(draft).toHaveValue('مسودة فحص');
  await expect(guide).toHaveAttribute('open', '');

  await guide.locator('[data-guide-start]').click();
  await expect(guide).not.toHaveAttribute('open');
  await expect(page.locator('[data-activity-id="A01"] .act-title')).toBeFocused();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), guidePreference)).toBe(true);
  expect(score(await caseState(page))).toEqual(score(initial));
  await page.reload();
  await expect(guide).not.toHaveAttribute('open');
  await expect(draft).toHaveValue('مسودة فحص');

  await selectCaseTab(page, 'evidence');
  const opener = page.locator('[data-open-start-guide]');
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(guide).toHaveAttribute('open', '');
  await expect(guide.locator('summary')).toBeFocused();
  await expect(draft).toHaveValue('مسودة فحص');
  await guide.locator('summary').press('Enter');
  await expect(guide).not.toHaveAttribute('open');
  expect(score(await caseState(page))).toEqual(score(initial));
  expect(await page.locator('#preview-soundtrack').evaluate(audio => audio.paused)).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('raven-preview:v1:musicEnabled')))).toBe(false);
  await expectNoOverflow(page);
});

test('returning investigator guide targets the current unlocked source and fits phone and desktop layouts', async ({ page, context }) => {
  await seedExpansion(context, 4, { drafts: { A05: { exit: 'unknown' } } });
  await boot(page, 'case-017/');
  const initial = await caseState(page);
  const guide = page.locator('[data-start-guide]');
  await expect(guide).not.toHaveAttribute('open');

  // Reviewing an old task must not make the guide restart or solve the case.
  await page.locator('.act-reference').filter({ has: page.locator('[data-activity-open="A01"]') }).locator('summary').click();
  await page.locator('[data-activity-open="A01"]').click();
  await expect(page.locator('[data-activity-id="A01"]')).toBeVisible();
  await page.locator('[data-open-start-guide]').click();
  await expect(page.locator('[data-activity-id="A05"]')).toBeVisible();
  await expect(guide).toHaveAttribute('open', '');
  await expect(guide).not.toContainText('B17-R');
  await expect(guide).not.toContainText('AUD-07');
  expect((await caseState(page)).viewedIds).toEqual(initial.viewedIds);

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoOverflow(page);
    for (const control of [guide.locator('summary'), guide.locator('[data-guide-source]'), guide.locator('[data-guide-start]')]) {
      await expect(control).toBeVisible();
      const bounds = await control.boundingBox();
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(bounds.width).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await guide.locator('[data-guide-source]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.case-dialog[open] [data-document="E06"]')).toBeVisible();
  expect((await caseState(page)).viewedIds).toEqual([...initial.viewedIds, 'E06']);
  await page.getByRole('button', { name: 'عُد إلى المهمة الحالية ←', exact: true }).click();
  await expect(page.locator('[data-activity-id="A05"] [data-activity-field="exit"]')).toHaveValue('unknown');
  // Returning to a progressed case keeps help collapsed until requested again.
  await expect(guide).not.toHaveAttribute('open');
  await guide.locator('summary').press('Enter');
  await expect(guide).toHaveAttribute('open', '');
  await guide.locator('[data-guide-start]').click();
  await expect(page.locator('[data-activity-id="A05"] .act-title')).toBeFocused();
  expect(score(await caseState(page))).toEqual(score(initial));
  await expectNoOverflow(page);
});
