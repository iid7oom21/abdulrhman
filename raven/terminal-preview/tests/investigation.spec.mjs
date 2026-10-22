import { test, expect, boot, expectNoOverflow } from './helpers.mjs';

const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('raven-preview:v1:case')));
const closeReader = page => page.getByRole('button', { name: 'إغلاق الوثيقة', exact: true }).click();
async function openEvidence(page, id) {
  await page.locator(`[data-evidence-id="${id}"]`).first().click();
  await expect(page.locator('.case-dialog[open]')).toBeVisible();
}
async function openTool(page, name) {
  await page.locator('[data-open-toolkit]').click();
  await page.locator(`[data-tool="${name}"]`).click();
}

test('all four original deductions require valid source support and preserve the ending limits', async ({ page }) => {
  await boot(page, 'case-017/');
  for (let i = 1; i <= 8; i++) { await openEvidence(page, `E0${i}`); await closeReader(page); }
  await page.locator('[data-case-tab="deductions"]').click();
  await expect(page.locator('[data-question-step="3"]')).toBeDisabled();
  await page.locator('input[name="answer-Q01"][value="a"]').check();
  await page.locator('[data-submit-answer="Q01"]').click();
  expect((await state(page)).solvedIds).toEqual([]);
  for (const [id, answer, support] of [['Q01', 'b', []], ['Q02', 'd', []], ['Q03', 'a', ['E01', 'E07']], ['Q04', 'c', ['E07', 'E08']]]) {
    await page.locator(`input[name="answer-${id}"][value="${answer}"]`).check();
    if (support.length) {
      await page.locator(`[data-submit-answer="${id}"]`).click();
      expect((await state(page)).solvedIds).not.toContain(id);
      for (const evidence of ['E02', 'E03']) await page.locator(`input[name="support-${id}"][value="${evidence}"]`).check();
      await page.locator(`[data-submit-answer="${id}"]`).click();
      expect((await state(page)).solvedIds).not.toContain(id);
      for (const evidence of ['E02', 'E03']) await page.locator(`input[name="support-${id}"][value="${evidence}"]`).uncheck();
      for (const evidence of support) await page.locator(`input[name="support-${id}"][value="${evidence}"]`).check();
    }
    await page.locator(`[data-submit-answer="${id}"]`).click();
    await expect(page.locator('.case-answer-feedback.is-correct')).toBeVisible();
    expect((await state(page)).solvedIds).toContain(id);
    if (id !== 'Q04') await page.locator(`[data-submit-answer="${id}"]`).click();
  }
  await page.locator('[data-final-report]').click();
  await expect(page.locator('#case-final-report')).toContainText('ما بقي غير محسوم');
  await expect(page.locator('.case-report-limits')).toContainText('الحريق');
  await page.reload();
  expect((await state(page)).solvedIds).toEqual(['Q01', 'Q02', 'Q03', 'Q04']);
});

test('photo, magnifier and scene controls work without covering the photo at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await boot(page, 'case-017/');
  const hero = page.locator('.case-hero-scene');
  const picture = await hero.locator('.case-scene-picture').boundingBox();
  const controls = await hero.locator('.case-scene-controls').boundingBox();
  expect(controls.y).toBeGreaterThanOrEqual(picture.y + picture.height - 1);
  await openTool(page, 'magnifier');
  await expect(page.locator('.case-dialog[open]')).toBeVisible();
  await expect(page.locator('.case-dialog [data-photo-mode="full"]').first()).toHaveAttribute('aria-pressed', 'true');
  const lens = page.locator('.case-magnifier-view.is-active').first();
  await expect(lens).toBeVisible();
  await lens.press('ArrowRight');
  await lens.press('Escape');
  await expect(page.locator('.case-magnifier-view.is-active')).toHaveCount(0);
  await expectNoOverflow(page);
});

test('a highlight and a source-linked note survive reload and reopen their exact paragraph', async ({ page }) => {
  await boot(page, 'case-017/');
  await openEvidence(page, 'E01');
  await page.locator('.case-full-text > summary').click();
  await page.locator('[data-highlight="E01:0"]').click();
  await expect(page.locator('[data-highlight="E01:0"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-annotate="E01:0"]').click();
  await expect(page.locator('.tk-dialog[open]')).toBeVisible();
  await page.getByLabel('نص الملاحظة', { exact: true }).fill('أراجع سياق هذه الفقرة قبل الاستنتاج.');
  await page.getByRole('button', { name: 'احفظ الملاحظة', exact: true }).click();
  await expect(page.locator('.tk-note')).toContainText('أراجع سياق');
  const saved = await state(page);
  expect(saved.notes[0]).toMatchObject({ evidenceId: 'E01', paragraphIndex: 0 });
  expect(saved.notes[0].quote.length).toBeGreaterThan(10);
  await page.reload();
  await openTool(page, 'notes');
  await expect(page.locator('.tk-note')).toContainText('أراجع سياق');
  await page.locator('.tk-note .tk-source').click();
  await expect(page.locator('.case-dialog[open]')).toBeVisible();
  await expect(page.locator('#case-E01-p0')).toBeVisible();
  await expect(page.locator('[data-highlight="E01:0"]')).toHaveAttribute('aria-pressed', 'true');
});

test('mobile comparison switches accessible tabs and closes back to the case', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, 'case-017/');
  await openEvidence(page, 'E01');
  await page.locator('[data-compare-evidence="E01"]').click();
  await expect(page.locator('.case-comparison-dialog[open]')).toBeVisible();
  await page.locator('#case-compare-second').selectOption('E07');
  await page.locator('#case-compare-tab-1').click();
  await expect(page.locator('#case-compare-tab-1')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#case-compare-panel-1')).toBeVisible();
  await expect(page.locator('#case-compare-panel-0')).toBeHidden();
  await expectNoOverflow(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('case reset keeps episode progress and legacy imports happen only once', async ({ context, page }) => {
  await context.addInitScript(() => {
    if (localStorage.getItem('test:reset-seed')) return;
    localStorage.setItem('test:reset-seed', '1');
    localStorage.setItem('raven-case:fourth-signature-reconstruction', JSON.stringify({ viewedIds: ['E01'], solvedIds: ['Q01'] }));
    localStorage.setItem('raven17_episode_1_progress', '42');
  });
  await boot(page, 'case-017/');
  expect((await state(page)).viewedIds).toContain('E01');
  await page.getByRole('button', { name: 'إعادة فتح الملف من البداية', exact: true }).click();
  await page.getByRole('button', { name: 'ابدأ ملفًا جديدًا', exact: true }).click();
  expect((await state(page)).viewedIds).toEqual([]);
  expect((await state(page)).solvedIds).toEqual([]);
  await page.reload();
  expect((await state(page)).viewedIds).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('raven-preview:v1:episode:1')))).toMatchObject({ time: 42 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('raven-case:fourth-signature-reconstruction')).viewedIds)).toEqual(['E01']);
});

test('classified reveal works by keyboard and closing a document restores its trigger focus', async ({ page }) => {
  await boot(page, 'case-017/');
  const reveal = page.locator('.case-redaction');
  await reveal.focus();
  await expect(reveal).toHaveAttribute('aria-expanded', 'true');
  await reveal.press('Enter');
  await page.locator('[data-open-toolkit]').focus();
  await expect(reveal).toHaveAttribute('aria-expanded', 'true');
  await openEvidence(page, 'E01');
  await page.keyboard.press('Escape');
  await expect(page.locator('.case-dialog[open]')).toHaveCount(0);
  await expect(page.locator('[data-evidence-id="E01"]').first()).toBeFocused();
});

test('final report enters print mode before invoking print and clears it after printing', async ({ context, page }) => {
  await context.addInitScript(() => {
    localStorage.setItem('raven-preview:v1:initialized', 'true');
    localStorage.setItem('raven-preview:v1:case', JSON.stringify({ solvedIds: ['Q01', 'Q02', 'Q03', 'Q04'] }));
    window.__printCalls = 0;
    window.__printSawClass = false;
    window.print = () => {
      window.__printCalls++;
      window.__printSawClass = document.body.classList.contains('printing-case-report');
    };
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page, 'case-017/');
  await openTool(page, 'report');
  await expect(page.locator('#case-final-report')).toBeVisible();
  await page.getByRole('button', { name: 'اطبع التقرير', exact: true }).click();
  expect(await page.evaluate(() => window.__printCalls)).toBe(1);
  expect(await page.evaluate(() => window.__printSawClass)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('body')).not.toHaveClass(/printing-case-report/);
  await expect(page.locator('#case-final-report')).toBeVisible();
  expect(errors).toEqual([]);
});
