import { test, expect, boot, expectNoOverflow, route } from './helpers.mjs';

const SAVE_KEY = 'raven-preview:v1:last-call:v1';
const stage = (page, id) => page.locator(`[data-lc-step="${id}"]`);
const submit = (page, id) => page.locator(`[data-lc-submit="${id}"]`);
const tab = (page, id) => page.locator(`[data-lc-tab="${id}"]`);
const status = page => page.locator('[data-lc-status]');
const readSave = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}'), SAVE_KEY);

async function expectSolved(page, expected) {
  await expect.poll(async () => (await readSave(page)).solved || []).toEqual(expected);
}

async function startCase(page) {
  await boot(page, 'last-call/');
  await expect(page.locator('[data-lc-start]')).toBeVisible();
  await page.locator('[data-lc-start]').click();
  await expect(stage(page, 'photo')).toBeVisible();
  await expect(page.locator('.opening-dialog')).toBeHidden();
}

async function reorder(page, group, order, keyboard = false) {
  const list = page.locator(`[data-lc-reorder="${group}"]`);
  for (let position = 0; position < order.length; position++) {
    let current = await list.locator('[data-item]').evaluateAll(nodes => nodes.map(node => node.dataset.item));
    let remaining = current.indexOf(order[position]) - position;
    expect(remaining).toBeGreaterThanOrEqual(0);
    while (remaining-- > 0) {
      const up = list.locator(`[data-item="${order[position]}"] [data-move="up"]`);
      if (keyboard) { await up.focus(); await page.keyboard.press('Enter'); }
      else await up.click();
    }
  }
  expect(await list.locator('[data-item]').evaluateAll(nodes => nodes.map(node => node.dataset.item))).toEqual(order);
}

async function firstThreeStages(page, { keyboard = false, mistakes = false } = {}) {
  if (mistakes) {
    await submit(page, 'photo').click();
    await expect(status(page)).not.toBeEmpty();
    await expectSolved(page, []);
    await expect(stage(page, 'clock')).toBeDisabled();
  }
  for (const id of ['drive', 'ledger', 'phone']) {
    const hotspot = page.locator(`[data-hotspot="${id}"]`);
    if (keyboard) { await hotspot.focus(); await page.keyboard.press('Enter'); }
    else await hotspot.click();
  }
  await submit(page, 'photo').click();
  await expectSolved(page, ['photo']);
  await stage(page, 'message').click();
  await page.locator('[name="recorded"]').fill('21:47');
  await page.locator('[name="delivered"]').fill('22:17');
  await page.locator('[name="meaning"]').selectOption('scheduled');
  await submit(page, 'message').click();
  await expectSolved(page, ['photo', 'message']);
  await stage(page, 'clock').click();
  await page.locator('[name="offset"]').fill('7');
  await page.locator('[name="entry"]').fill('22:07');
  await page.locator('[name="exit"]').fill(mistakes ? '22:16' : '22:09');
  if (mistakes) {
    await submit(page, 'clock').click();
    await expectSolved(page, ['photo', 'message']);
    await expect(status(page)).not.toBeEmpty();
    await page.locator('[name="exit"]').fill('22:09');
  }
  await submit(page, 'clock').click();
  await expectSolved(page, ['photo', 'message', 'clock']);
}

async function remainingStages(page, { keyboard = false } = {}) {
  await tab(page, 'workbench').click();
  await stage(page, 'receipt').click();
  const slider = page.getByRole('slider', { name: 'مقارنة المكتب قبل وبعد الواقعة', exact: true });
  await expect(slider).toBeVisible();
  await slider.focus();
  const before = Number(await slider.inputValue());
  await page.keyboard.press('ArrowRight');
  expect(Number(await slider.inputValue())).not.toBe(before);
  await reorder(page, 'receipt', ['header', 'item', 'approval', 'footer'], keyboard);
  await page.locator('[name="changed"]').selectOption('ledger');
  await submit(page, 'receipt').click();
  await expectSolved(page, ['photo', 'message', 'clock', 'receipt']);
  await stage(page, 'custody').click();
  await reorder(page, 'custody', ['sarah', 'yusuf', 'reem', 'raed', 'mazen', 'layan'], keyboard);
  await submit(page, 'custody').click();
  await expectSolved(page, ['photo', 'message', 'clock', 'receipt', 'custody']);
  await stage(page, 'confrontation').click();
  await tab(page, 'people').click();

  const raed = page.locator('[data-lc-person="raed"]');
  await raed.locator('[name="evidence"]').selectOption('scene');
  await raed.locator('[data-lc-confront="raed"]').click();
  await expect(status(page)).not.toBeEmpty();
  expect((await readSave(page)).confronted).not.toContain('raed');

  for (const [person, evidence] of Object.entries({ sarah: 'copy', layan: 'threat', yusuf: 'loan', mazen: 'maintenance', reem: 'handover', raed: 'gate' })) {
    const card = page.locator(`[data-lc-person="${person}"]`);
    await card.locator('[name="evidence"]').selectOption(evidence);
    await card.locator(`[data-lc-confront="${person}"]`).click();
    await expect.poll(async () => (await readSave(page)).confronted || []).toContain(person);
  }
  await tab(page, 'workbench').click();
  await stage(page, 'confrontation').click();
  if (!(await readSave(page)).solved.includes('confrontation')) await submit(page, 'confrontation').click();
  await expectSolved(page, ['photo', 'message', 'clock', 'receipt', 'custody', 'confrontation']);
}

async function completeVerdict(page) {
  await tab(page, 'verdict').click();
  await page.locator('[name="culprit"]').selectOption('layan');
  await page.locator('[name="accomplice"]').selectOption('reem');
  for (const id of ['message', 'access', 'ledger']) await page.locator(`[name="evidenceIds"][value="${id}"]`).check();
  await page.locator('[data-lc-accuse]').click();
  expect((await readSave(page)).accusation).toBeNull();
  await expect(status(page)).not.toBeEmpty();
  await page.locator('[name="culprit"]').selectOption('raed');
  await page.locator('[data-lc-accuse]').click();
  await expect.poll(async () => Boolean((await readSave(page)).accusation)).toBe(true);
  const save = await readSave(page);
  expect(save.accusation.culprit).toBe('raed');
  expect(save.accusation.accomplice).toBe('reem');
  await expect(page.locator('[data-lc-ending] [data-lc-panel-heading]')).toBeInViewport();
  await expectNoOverflow(page);
}

test('the complete free case requires actual clues, six confrontations and supported verdict; saves survive reload', async ({ page }) => {
  test.setTimeout(150000);
  const errors = [], remoteMutations = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).origin !== new URL(route('')).origin) remoteMutations.push(request.url());
  });
  await startCase(page);
  await firstThreeStages(page, { mistakes: true });
  const beforeReload = await readSave(page);
  await page.reload();
  await expect(stage(page, 'receipt')).toBeVisible();
  expect((await readSave(page)).solved).toEqual(beforeReload.solved);
  await remainingStages(page);
  await completeVerdict(page);
  await page.reload();
  await expect.poll(async () => Boolean((await readSave(page)).accusation)).toBe(true);
  await expect(page.locator('#preview-soundtrack')).toHaveCount(1);
  expect(errors).toEqual([]);
  expect(remoteMutations).toEqual([]);
});

test('390px phone supports all stages, keyboard clues and reorder buttons without horizontal overflow', async ({ page }, info) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 390, height: 844 });
  await startCase(page);
  await expectNoOverflow(page);
  await firstThreeStages(page, { keyboard: true });
  await expectNoOverflow(page);
  await remainingStages(page, { keyboard: true });
  await completeVerdict(page);
  await expectNoOverflow(page);
  await page.screenshot({ path: info.outputPath('last-call-mobile-verdict.png'), fullPage: true });
});

test('evidence is keyboard accessible; early accusations are rejected; notes and reset preserve the previous case', async ({ page }) => {
  const oldCase = JSON.stringify({ version: 3, viewedIds: ['E01'] });
  const oldFilm = JSON.stringify({ time: 42, watched: false });
  await page.addInitScript(({ oldCase, oldFilm }) => {
    if (!localStorage.getItem('test:last-call-old-save')) {
      localStorage.setItem('raven-preview:v1:case-017:expansion-v3', oldCase);
      localStorage.setItem('raven-preview:v1:episode:2', oldFilm);
      localStorage.setItem('test:last-call-old-save', '1');
    }
  }, { oldCase, oldFilm });
  await page.setViewportSize({ width: 390, height: 844 });
  await startCase(page);
  // The shared shell normalizes legacy saves on startup; retain that valid snapshot.
  const oldCaseAtStart = await page.evaluate(() => localStorage.getItem('raven-preview:v1:case-017:expansion-v3'));
  expect(JSON.parse(oldCaseAtStart).viewedIds).toContain('E01');
  await tab(page, 'evidence').click();
  const source = page.locator('[data-lc-evidence="report"]');
  await source.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.lc-evidence-dialog[open]')).toBeVisible();
  await expect(page.locator('.lc-evidence-dialog')).toContainText('22:06');
  await expect(page.getByRole('button', { name: 'إغلاق الدليل', exact: true })).toBeFocused();
  await expectNoOverflow(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.lc-evidence-dialog')).toHaveCount(0);
  await expect(source).toBeFocused();
  expect((await readSave(page)).inspected).toContain('report');

  await tab(page, 'people').click();
  const sarah = page.locator('[data-lc-person="sarah"]');
  await sarah.locator('.lc-question').click();
  await expect(page.locator('[data-lc-answer="sarah"]')).toBeVisible();
  await expect(sarah.locator('[name="evidence"] option[value="copy"]')).toHaveCount(0);
  await tab(page, 'verdict').click();
  await page.locator('[name="culprit"]').selectOption('raed');
  await page.locator('[name="accomplice"]').selectOption('reem');
  for (const id of ['scene', 'report', 'reference']) await page.locator(`[name="evidenceIds"][value="${id}"]`).check();
  await page.locator('[data-lc-accuse]').click();
  expect((await readSave(page)).accusation).toBeNull();
  await expectSolved(page, []);
  await expect(status(page)).toContainText('الملف لم يكتمل');

  await tab(page, 'notes').click();
  await page.locator('[data-lc-notes]').fill('وصول الرسالة لا يثبت حياة ناصر. أراجع ساعة الممر.');
  await page.reload();
  await tab(page, 'notes').click();
  await expect(page.locator('[data-lc-notes]')).toHaveValue('وصول الرسالة لا يثبت حياة ناصر. أراجع ساعة الممر.');
  await page.locator('[data-lc-reset]').click();
  await page.getByRole('button', { name: 'احتفظ بتقدمي', exact: true }).click();
  await expect(page.locator('[data-lc-notes]')).not.toHaveValue('');
  await page.locator('[data-lc-reset]').click();
  await page.locator('[data-lc-reset]').click();
  await expect(page.locator('[data-lc-start]')).toBeVisible();
  const reset = await readSave(page);
  expect(reset.started).toBe(false);
  expect(reset.notes).toBe('');
  expect(reset.inspected).toEqual([]);
  const retained = await page.evaluate(() => [localStorage.getItem('raven-preview:v1:case-017:expansion-v3'), localStorage.getItem('raven-preview:v1:episode:2')]);
  expect(retained).toEqual([oldCaseAtStart, oldFilm]);
  await expectNoOverflow(page);
});

test('denied browser storage still permits investigating during the current visit', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () { throw new DOMException('Storage blocked', 'SecurityError'); };
    Storage.prototype.setItem = function () { throw new DOMException('Storage blocked', 'SecurityError'); };
  });
  await startCase(page);
  for (const id of ['drive', 'ledger', 'phone']) await page.locator(`[data-hotspot="${id}"]`).click();
  await submit(page, 'photo').click();
  await expect(stage(page, 'message')).toBeEnabled();
  await stage(page, 'message').click();
  await expect(page.locator('[name="recorded"]')).toBeVisible();
  await expect(page.locator('#site-notice')).toContainText('الحفظ الدائم غير متاح');
});
