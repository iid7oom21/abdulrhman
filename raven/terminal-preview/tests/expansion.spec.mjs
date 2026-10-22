import { test, expect, boot, caseState, expectNoOverflow, selectCaseTab, openEvidence, closeEvidence, EXPANSION_KEY } from './helpers.mjs';
import { ACTIVITIES, solutions, solutionFor, seedExpansion, readRequiredSources, fillActivity, submitActivity } from './activity-journey.mjs';

function wrongPayload(activity, good) {
  const bad = structuredClone(good);
  // A real but incorrect source pair must fail even with the correct canonical answer.
  if (activity.id === 'A26' || activity.id === 'A32') { bad.support = ['E02', 'E03']; return bad; }
  const field = activity.fields.find(f => f.type === 'text' && !f.optional)
    || activity.fields.find(f => f.type === 'select')
    || activity.fields.find(f => f.type === 'number')
    || activity.fields.find(f => f.type === 'order');
  if (!field) throw new Error(`No rejection input for ${activity.id}`);
  if (field.type === 'select') bad[field.key] = field.options.find(o => o.value !== good[field.key]).value;
  else if (field.type === 'number') bad[field.key] = good[field.key] + 1;
  else if (field.type === 'order') bad[field.key] = [...good[field.key]].reverse();
  else bad[field.key] = '000-invalid';
  return bad;
}

async function inspectDevice(page, activity) {
  const scope = page.locator(`[data-activity-id="${activity.id}"]`);
  if (activity.id === 'A01') {
    if (await scope.locator('[data-activity-field="face"]').inputValue() === 'back') await scope.locator('[data-envelope-flip]').click();
    if (await scope.locator('[data-activity-field="lamp"]').inputValue() === 'uv') await scope.locator('[data-envelope-uv]').click();
    await scope.locator('[data-envelope-flip]').click();
    await scope.locator('[data-envelope-uv]').click();
    await expect(scope.locator('.act-envelope-code')).toHaveText('B17-R');
    await expect(scope.locator('[data-activity-field="face"]')).toHaveValue('back');
    await expect(scope.locator('[data-activity-field="lamp"]')).toHaveValue('uv');
  } else if (activity.id === 'A03') {
    const wheel = scope.getByRole('slider', { name: 'إزاحة مرجع قيصر' });
    await wheel.focus();
    await wheel.press('ArrowRight'); await wheel.press('ArrowRight'); await wheel.press('ArrowRight');
    await expect(scope.locator('.act-alphabet').last()).toHaveText('DEFGHIJKLMNOPQRSTUVWXYZABC');
    await scope.locator('[data-signal-play="morse"]').click();
    await scope.getByRole('button', { name: 'أوقف الإشارة', exact: true }).click();
  } else if (activity.id === 'A05') {
    await scope.locator('[data-activity-photo]').click();
    await page.locator('.case-dialog [data-photo-mode="full"]').first().click();
    await expect(page.locator('.case-dialog [data-photo-mode="full"]').first()).toHaveAttribute('aria-pressed', 'true');
    await page.locator('.case-dialog [data-photo-mode="crop"]').first().click();
    await closeEvidence(page);
  } else if (activity.id === 'A06') {
    for (const [piece, target] of [['lockSite', 'EXT-02'], ['latchSite', 'AR-01']]) {
      await scope.locator(`[data-map-piece="${piece}"]`).click();
      await scope.locator(`[data-map-target="${target}"]`).click();
      await expect(scope.locator(`[data-activity-field="${piece}"]`)).toHaveValue(target);
    }
  } else if (activity.id === 'A16') {
    const scrubber = scope.getByRole('slider', { name: 'موضع الفحص في سجل الكاميرات بالثواني' });
    for (const [camera, second] of [['A', '42'], ['B', '46'], ['C', '52']]) {
      await scope.locator(`[data-camera="${camera}"]`).click();
      await scrubber.fill(second);
      await expect(scope.locator(`[data-camera="${camera}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(scope.locator('.act-camera-time')).toContainText(`CAM ${camera}`);
    }
  } else if (activity.id === 'A17') {
    await scope.locator('[data-signal-play="dtmf"]').click();
    await scope.getByRole('button', { name: 'أوقف الإشارة', exact: true }).click();
  } else if (activity.id === 'A18') {
    await scope.locator('[data-alignment-slider]').fill('36');
    await expect(scope.locator('[data-activity-field="alignment"]')).toHaveValue('36');
  } else if (activity.id === 'A19') {
    await scope.locator('[data-reverse-toggle]').click();
    await expect(scope.locator('.act-reverse-text')).toHaveText('درج / المراجعة / الثالث');
    await expect(scope.locator('[data-activity-field="direction"]')).toHaveValue('reverse');
  } else if (activity.id === 'A20') {
    await scope.locator('[data-scan-corner="bottom-right"]').click();
    await expect(scope.locator('[data-activity-field="corner"]')).toHaveValue('bottom-right');
  } else if (activity.id === 'A21') {
    await scope.locator('[data-column-move="1:-1"]').click();
    await expect(scope.locator('[data-activity-field="word"]')).toHaveValue('SOURCE');
  }
}

test('all 32 public activities reject wrong work, restore each chapter, and reach the evidence-based report at 320px', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 320, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const payloads = await solutions();
  await boot(page, 'case-017/');
  await submitActivity(page, ACTIVITIES[0]);
  expect((await caseState(page)).progress.wrongSubmissions).toBe(0);
  // Correct data alone is not enough until the available source has actually been opened.
  await fillActivity(page, ACTIVITIES[0], solutionFor(payloads, ACTIVITIES[0]));
  await submitActivity(page, ACTIVITIES[0]);
  expect((await caseState(page)).progress.accepted).toHaveLength(0);
  expect((await caseState(page)).progress.wrongSubmissions).toBe(0);
  await page.reload();
  for (const activity of ACTIVITIES) {
    await test.step(`${activity.id}: ${activity.title}`, async () => {
      await readRequiredSources(page, activity);
      await inspectDevice(page, activity);
      const good = solutionFor(payloads, activity);
      await fillActivity(page, activity, wrongPayload(activity, good));
      await submitActivity(page, activity);
      await expect.poll(async () => (await caseState(page)).progress.wrongSubmissions).toBe(activity.number);
      expect((await caseState(page)).progress.accepted).toHaveLength(activity.number - 1);
      await expect(page.locator(`[data-activity-id="${activity.id}"] .act-status`)).toHaveClass(/is-error/);
      await fillActivity(page, activity, good);
      if (activity.id === 'A23') expect((await caseState(page)).drafts.A23.computedHashes).toEqual(good.computedHashes);
      await submitActivity(page, activity);
      await expect.poll(async () => (await caseState(page)).progress.accepted.length).toBe(activity.number);
      const checkpoint = await caseState(page);
      expect(checkpoint.solvedIds).toEqual(['Q01', 'Q02', 'Q03', 'Q04'].slice(0, [8, 14, 26, 32].filter(n => n <= activity.number).length));
      await expectNoOverflow(page);
      if (activity.number === 14) {
        await expect(page.locator('[data-call-defer]')).toBeVisible();
        await page.locator('[data-call-defer]').click();
        expect((await caseState(page)).call.delivery).toBe('deferred');
      }
      if ([4, 8, 14, 19, 25, 30].includes(activity.number)) {
        await page.reload();
        expect((await caseState(page)).progress.accepted).toEqual(checkpoint.progress.accepted);
        await expect(page.locator(`[data-activity-id="A${String(activity.number + 1).padStart(2, '0')}"]`)).toBeVisible();
      } else if (activity.number < 32) {
        await page.locator(`[data-activity-next="A${String(activity.number + 1).padStart(2, '0')}"]`).click();
      }
    });
  }
  const ending = page.locator('[data-case-ending][open]');
  await expect(ending).toBeVisible();
  // Reduced-motion runs show the static conclusion immediately. In animated
  // runs the public skip control reaches that same card without skipping A32.
  if (await ending.locator('[data-ending-skip]').isEnabled()) await ending.locator('[data-ending-skip]').click();
  await ending.locator('[data-ending-report]').click();
  const report = page.locator('#case-final-report');
  await expect(report).toBeVisible();
  await expect(report.locator('.case-report-limits')).toContainText('الحريق');
  await expect(report.locator('.case-report-expansion')).toContainText('B17-R');
  await expect(report.locator('.case-report-expansion')).toContainText('لا يثبت وحده تعمد الإخفاء');
  expect((await caseState(page)).progress.completedAt).toBeGreaterThan(0);
  await expectNoOverflow(page);
  expect(errors).toEqual([]);
});

test('mobile UV reference uses a text keyboard, preserves typed B17-R on reload and submits with its opened source', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await boot(page, 'case-017/');
  await readRequiredSources(page, ACTIVITIES[0]);
  const scope = page.locator('[data-activity-id="A01"]');
  for (const hook of ['data-envelope-flip', 'data-envelope-uv']) {
    await scope.locator(`[${hook}]`).focus();
    await page.keyboard.press('Enter');
  }
  const reference = scope.locator('[data-activity-field="code"]');
  await expect(reference).toHaveAttribute('type', 'text');
  await expect(reference).toHaveAttribute('inputmode', 'text');
  await expect(scope.locator('.act-envelope-code')).toHaveText('B17-R');
  await reference.focus();
  await reference.pressSequentially('B17-R');
  await expect(reference).toHaveValue('B17-R');
  await expect.poll(async () => (await caseState(page)).drafts.A01.code).toBe('B17-R');
  await page.reload();
  await expect(reference).toHaveAttribute('inputmode', 'text');
  await expect(reference).toHaveValue('B17-R');
  await expect(scope.locator('[data-activity-field="face"]')).toHaveValue('back');
  await expect(scope.locator('[data-activity-field="lamp"]')).toHaveValue('uv');
  expect((await caseState(page)).viewedIds).toContain('E09');
  await submitActivity(page, ACTIVITIES[0]);
  await expect.poll(async () => (await caseState(page)).progress.accepted.length).toBe(1);
  expect((await caseState(page)).progress.accepted[0].payload.code).toBe('B17-R');
  expect((await caseState(page)).progress.wrongSubmissions).toBe(0);
  await expectNoOverflow(page);
});

test('mobile input hints across all activities preserve text references, colon times and explicit numeric codes', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  // Review a valid completed fixture so every declared input can be inspected;
  // this setup does not bypass the separate full journey or submit future work.
  await seedExpansion(context, 32);
  await boot(page, 'case-017/');
  const payloads = await solutions();
  const seen = new Map();
  for (const activity of ACTIVITIES) {
    const fields = activity.fields.filter(field => ['text', 'number'].includes(field.type));
    if (!fields.length) continue;
    await test.step(`${activity.id}: declared keyboard hints`, async () => {
      const index = page.locator('.act-reference').filter({ has: page.locator(`[data-activity-open="${activity.id}"]`) });
      if (await index.getAttribute('open') === null) await index.locator('summary').click();
      await page.locator(`[data-activity-open="${activity.id}"]`).click();
      const scope = page.locator(`[data-activity-id="${activity.id}"]`);
      for (const field of fields) {
        const input = scope.locator(`[data-activity-field="${field.key}"]`);
        const type = field.type === 'number' ? 'number' : 'text';
        const mode = field.inputMode || (type === 'number' ? 'numeric' : 'text');
        await expect(input).toHaveAttribute('type', type);
        await expect(input).toHaveAttribute('inputmode', mode);
        if (field.maxLength) await expect(input).toHaveAttribute('maxlength', String(field.maxLength));
        const answer = solutionFor(payloads, activity)[field.key];
        if (answer !== undefined) await expect(input).toHaveValue(String(answer));
        seen.set(`${activity.id}:${field.key}`, { type, mode });
      }
    });
  }
  // These encode different semantic formats despite misleading key names:
  // a UV reference, ASCII/hex-decoded text, minute:second and a cabinet address.
  for (const key of ['A01:code', 'A07:document', 'A07:container', 'A18:position', 'A31:key']) {
    expect(seen.get(key), key).toEqual({ type: 'text', mode: 'text' });
  }
  for (const key of ['A04:code', 'A11:code', 'A17:code']) {
    expect(seen.get(key), key).toEqual({ type: 'text', mode: 'numeric' });
  }
  for (const key of ['A18:clockOffset', 'A18:alignment']) {
    expect(seen.get(key), key).toEqual({ type: 'number', mode: 'numeric' });
  }
  expect((await caseState(page)).progress.accepted).toHaveLength(32);
  await expectNoOverflow(page);
});

test('drafts and progressive hints restore without unlocking future tasks; keyboard can perform UV inspection', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await boot(page, 'case-017/');
  const scope = page.locator('[data-activity-id="A01"]');
  for (const hook of ['data-envelope-flip', 'data-envelope-uv']) {
    const control = scope.locator(`[${hook}]`); await control.focus(); await control.press('Enter');
  }
  await scope.locator('[data-activity-field="code"]').fill('B17');
  await scope.locator('[data-activity-hint]').click();
  await expect(scope.locator('.act-hint-text')).toHaveCount(1);
  const saved = await caseState(page);
  expect(saved.progress.hintsByActivity.A01).toEqual([1]);
  await page.reload();
  await expect(scope.locator('[data-activity-field="code"]')).toHaveValue('B17');
  await expect(scope.locator('[data-activity-field="face"]')).toHaveValue('back');
  await expect(scope.locator('[data-activity-field="lamp"]')).toHaveValue('uv');
  await expect(scope.locator('.act-envelope-code')).toHaveText('B17-R');
  expect((await caseState(page)).progress.hintsByActivity.A01).toEqual([1]);
  await scope.locator('[data-activity-hint]').click();
  await expect(scope.locator('.act-hint-text')).toHaveCount(2);
  expect((await caseState(page)).progress.hintsByActivity.A01).toEqual([1, 2]);
  await page.locator('.act-reference').filter({ has: page.locator('[data-activity-open="A32"]') }).locator('summary').click();
  await expect(page.locator('[data-activity-open="A02"]')).toBeDisabled();
  await expect(page.locator('[data-activity-open="A32"]')).toBeDisabled();
  expect((await caseState(page)).progress.accepted).toHaveLength(0);
  await expectNoOverflow(page);
});

test('locked or unopened documents cannot leak through comparison, search, or persisted annotations', async ({ context, page }) => {
  await seedExpansion(context, 4, { notes: [{ id: 'spoiler', evidenceId: 'E07', paragraphIndex: 0, quote: 'closed', text: 'secret from closed audit' }], highlights: ['E07:0'] });
  await boot(page, 'case-017/');
  expect((await caseState(page)).notes).toEqual([]);
  expect((await caseState(page)).highlights).toEqual([]);
  await openEvidence(page, 'E01');
  await page.locator('[data-compare-evidence="E01"]').click();
  const comparisonOptions = await page.locator('#case-compare-second option').evaluateAll(options => options.map(option => option.value));
  expect(comparisonOptions).not.toContain('E07');
  expect(comparisonOptions).not.toContain('E16');
  await page.keyboard.press('Escape');
  await page.locator('[data-open-toolkit]').click();
  await page.locator('[data-tool="search"]').click();
  await page.getByLabel('ابحث في الأدلة المفتوحة', { exact: true }).fill('AUD-07');
  await expect(page.locator('.tk-search-result')).toHaveCount(0);
  await page.getByRole('button', { name: 'إغلاق حقيبة المحقق', exact: true }).click();
  await selectCaseTab(page, 'evidence');
  await expect(page.locator('[data-evidence-id="E07"]')).toBeDisabled();
  await expect(page.locator('[data-evidence-id="E02"]')).toBeEnabled();
});

test('reset removes a valid activity prefix and stale drafts but preserves paused music and film progress', async ({ context, page }) => {
  await seedExpansion(context, 14, { drafts: { A15: { sample: 'elena' }, A99: { answer: 'fake' } } });
  await context.addInitScript(() => {
    if (localStorage.getItem('test:reset-music-seeded')) return;
    localStorage.setItem('test:reset-music-seeded', 'yes');
    localStorage.setItem('raven-preview:v1:musicEnabled', 'false');
    localStorage.setItem('raven-preview:v1:episode:1', JSON.stringify({ time: 43, watched: false, duration: 300 }));
  });
  await boot(page, 'case-017/');
  expect((await caseState(page)).progress.accepted).toHaveLength(14);
  expect((await caseState(page)).drafts.A99).toBeUndefined();
  const before = await page.evaluate(() => ({ episode: localStorage.getItem('raven-preview:v1:episode:1'), music: localStorage.getItem('raven-preview:v1:musicEnabled') }));
  await page.getByRole('button', { name: 'إعادة فتح الملف من البداية', exact: true }).click();
  await page.getByRole('button', { name: 'ابدأ ملفًا جديدًا', exact: true }).click();
  const reset = await caseState(page);
  expect(reset.progress.accepted).toEqual([]);
  expect(reset.solvedIds).toEqual([]);
  expect(reset.drafts.A15).toBeUndefined(); expect(reset.drafts.A99).toBeUndefined();
  expect(Object.values(reset.drafts).every(draft => Object.keys(draft).length === 0)).toBe(true);
  expect(await page.locator('#preview-soundtrack').evaluate(audio => audio.paused)).toBe(true);
  await page.reload();
  expect((await caseState(page)).progress.accepted).toEqual([]);
  expect(await page.evaluate(() => ({ episode: localStorage.getItem('raven-preview:v1:episode:1'), music: localStorage.getItem('raven-preview:v1:musicEnabled') }))).toEqual(before);
});
