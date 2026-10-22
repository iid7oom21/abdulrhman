import { test, expect, boot, expectNoOverflow, caseState, openEvidence, closeEvidence, EXPANSION_KEY } from './helpers.mjs';

const state = caseState;
async function openTool(page, name) {
  if (await page.locator('.tk-dialog[open]').count()) await page.getByRole('button', { name: 'كل الأدوات', exact: true }).click();
  else await page.locator('[data-open-toolkit]').click();
  await page.locator(`[data-tool="${name}"]`).click();
}
async function read(page, ids) {
  for (const id of ids) {
    await openEvidence(page, id);
    await closeEvidence(page);
  }
}

test('board, timeline and hypotheses persist investigator choices without grading them', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, 'case-017/');
  await read(page, ['E01', 'E06']);
  await openTool(page, 'board');
  for (const id of ['E01', 'E06']) {
    await page.getByLabel('دليل لإضافته إلى اللوحة', { exact: true }).selectOption(id);
    await page.getByRole('button', { name: '＋ ثبّت الدليل', exact: true }).click();
  }
  for (const id of ['E01', 'E06']) await page.locator(`[data-select-pin="${id}"]`).click();
  await page.getByLabel('نوع العلاقة', { exact: true }).selectOption('يحتاج تحققًا');
  await page.getByLabel('سبب الربط', { exact: true }).fill('أريد مقارنة سياق التوقيع في المصدرين.');
  await page.locator('[data-connect-pins]').click();
  expect((await state(page)).links).toHaveLength(1);
  expect((await state(page)).links[0]).toMatchObject({ relation: 'يحتاج تحققًا', reason: 'أريد مقارنة سياق التوقيع في المصدرين.' });
  await openTool(page, 'timeline');
  await page.getByLabel('الدليل المصدر', { exact: true }).selectOption('E06');
  await page.getByLabel('موضع الحدث في التسلسل', { exact: true }).selectOption('unknown');
  await page.getByLabel('عنوان الحدث', { exact: true }).fill('حدث يحتاج إلى ترتيب');
  await page.getByRole('button', { name: 'أضف إلى التسلسل', exact: true }).click();
  expect((await state(page)).timeline[0]).toMatchObject({ bucket: 'unknown', evidenceId: 'E06' });
  await openTool(page, 'hypotheses');
  await page.getByLabel('نص الفرضية', { exact: true }).fill('فرضية شخصية قيد الفحص.');
  await page.locator('.tk-hypothesis-source input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: 'احفظ الفرضية', exact: true }).click();
  const saved = await state(page);
  expect(saved.hypotheses[0].sources).toHaveLength(1);
  expect(saved.solvedIds).toEqual([]);
  await expect(page.locator('.tk-note')).toContainText('فرضية شخصية قيد الفحص.');
  await expectNoOverflow(page);
  await page.reload();
  const reloaded = await state(page);
  expect(reloaded.links).toEqual(saved.links);
  expect(reloaded.timeline).toEqual(saved.timeline);
  expect(reloaded.hypotheses).toEqual(saved.hypotheses);
});

test('search exposes only opened source documents and no answer or ending text', async ({ page }) => {
  await boot(page, 'case-017/');
  await read(page, ['E01']);
  await openTool(page, 'search');
  await expect(page.locator('.tk-search-result')).toHaveCount(1);
  await expect(page.locator('.tk-search-result')).toContainText('محضر المسؤولية');
  await page.getByLabel('ابحث في الأدلة المفتوحة', { exact: true }).fill('2026');
  await expect(page.locator('.tk-search-result')).toHaveCount(0);
  await page.getByLabel('ابحث في الأدلة المفتوحة', { exact: true }).fill('');
  const text = await page.locator('.tk-search-results').innerText();
  expect(text).not.toContain('ما بقي غير محسوم');
  expect(text).not.toContain('أعد إنتاجه');
  expect((await state(page)).solvedIds).toEqual([]);
});

test('all three training tools keep feedback and never solve a case deduction', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await boot(page, 'case-017/');
  await openTool(page, 'training-morse');
  await page.locator('[data-training-answer="morse"]').fill('٠١٧');
  await page.getByRole('button', { name: 'تحقق من الإشارة', exact: true }).click();
  await expect(page.locator('.training-result[data-result="correct"]')).toBeVisible();
  await page.locator('[data-training-mode="caesar"]').click();
  await page.locator('[data-training-shift]').fill('3');
  await expect(page.locator('[data-training-decoded]')).toHaveText('THE FILE IS OPEN');
  await page.getByRole('button', { name: 'تحقق من فك الشفرة', exact: true }).click();
  await expect(page.locator('.training-result[data-result="correct"]')).toBeVisible();
  await page.locator('[data-training-mode="numbers"]').click();
  await page.locator('[data-training-answer="numbers"]').fill('RAVEN');
  await page.getByRole('button', { name: 'تحقق من الكلمة', exact: true }).click();
  await expect(page.locator('.training-result[data-result="correct"]')).toBeVisible();
  const saved = await state(page);
  for (const mode of ['morse', 'caesar', 'numbers']) expect(saved.training[mode].completed).toBe(true);
  expect(saved.viewedIds).toEqual([]);
  expect(saved.solvedIds).toEqual([]);
  await expectNoOverflow(page);
});

test('malformed saved notebook entries do not break any investigative tool', async ({ context, page }) => {
  await context.addInitScript(key => {
    localStorage.setItem('raven-preview:v1:initialized', 'true');
    localStorage.setItem(key, JSON.stringify({ viewedIds: ['E01'], notes: [{}, { text: 'bad', evidenceId: 'UNKNOWN' }], pins: [{}], links: [{}], timeline: [{}], hypotheses: [{ text: 'old record', sources: 7 }] }));
  }, EXPANSION_KEY);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await boot(page, 'case-017/');
  for (const tool of ['notes', 'board', 'timeline', 'hypotheses', 'search']) {
    await openTool(page, tool);
    await expect(page.locator('.tk-dialog[open]')).toHaveAttribute('data-active-tool', tool);
  }
  expect(errors).toEqual([]);
});
