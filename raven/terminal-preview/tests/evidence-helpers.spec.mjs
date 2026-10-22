import { test, expect, PREVIEW, expectNoOverflow } from './helpers.mjs';

// Isolated DOM consumers exercise the helper contracts without bypassing the
// actual investigation's progression. The full journey suite covers integration.
async function harness(page, mode, seed = {}) {
  const url = new URL('__evidence_helpers_test__.html', PREVIEW).href;
  await page.route('**/__evidence_helpers_test__.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="fixture"></main></body></html>' }));
  await page.goto(url);
  for (const path of ['styles.css', 'modules/case.css', 'modules/toolkit.css', 'modules/evidence-helpers.css']) {
    await page.addStyleTag({ url: new URL(path, PREVIEW).href });
  }
  await page.evaluate(async ({ base, mode, seed }) => {
    const sourceBase = new URL('../../fourth-signature/', base);
    const { CASE_DATA } = await import(new URL('case-data.js', sourceBase).href);
    const { EXPANSION_EVIDENCE } = await import(new URL('modules/expansion-data.js', base).href);
    const CASE = { ...CASE_DATA, evidence: [...CASE_DATA.evidence, ...EXPANSION_EVIDENCE].map(item => ({ ...item, image: new URL(item.image, sourceBase).href })) };
    const listeners = new Set();
    let state = { viewedIds: ['E01', 'E06'], notes: [], photoRegions: [], solvedIds: [], progress: {}, ...seed };
    let allowed = new Set(seed.allowed || CASE.evidence.map(item => item.id));
    const calls = [];
    const services = {
      caseData: CASE,
      caseStore: {
        get: () => structuredClone(state),
        update: mutator => { mutator(state); for (const fn of listeners) fn(structuredClone(state)); },
        subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
      },
      investigation: { getAccess: id => ({ allowed: allowed.has(id) }), getSnapshot: () => state.progress },
      notify: text => calls.push(['notify', text]),
      openEvidence: (...args) => calls.push(['evidence', ...args]),
    };
    const host = document.querySelector('#fixture');
    host.className = 'case-page';
    let cleanup = [];
    async function render() {
      for (const dispose of cleanup) dispose(); cleanup = [];
      host.replaceChildren();
      if (mode === 'photo') {
        const { attachPhotoRegions } = await import(new URL('modules/photo-regions.js', base).href);
        const inspector = document.createElement('section'); inspector.className = 'case-photo-inspector';
        inspector.innerHTML = '<button type="button" data-photo-mode="full" aria-pressed="false">الإطار الكامل</button><section class="case-magnifier"><div class="case-magnifier-view is-cropped"><img alt="صورة PH-06"></div><button type="button" data-magnifier-toggle aria-pressed="false">العدسة</button></section>';
        inspector.querySelector('img').src = CASE.evidence.find(item => item.id === 'E06').image;
        const scan = inspector.querySelector('.case-magnifier');
        const view = scan.querySelector('.case-magnifier-view');
        const full = inspector.querySelector('[data-photo-mode]');
        const lens = scan.querySelector('[data-magnifier-toggle]');
        full.addEventListener('click', () => { view.classList.remove('is-cropped'); full.setAttribute('aria-pressed', 'true'); });
        lens.addEventListener('click', () => { view.classList.toggle('is-active'); lens.setAttribute('aria-pressed', String(view.classList.contains('is-active'))); });
        host.append(inspector); cleanup.push(attachPhotoRegions(scan, services));
      } else if (mode === 'questions') {
        const { attachParagraphQuestions } = await import(new URL('modules/paragraph-questions.js', base).href);
        const item = CASE.evidence.find(item => item.id === 'E01');
        for (let index = 0; index < item.body.length; index++) {
          const row = document.createElement('section'); row.dataset.fixtureParagraph = String(index);
          const p = document.createElement('p'); p.textContent = item.body[index]; row.append(p); host.append(row);
          cleanup.push(attachParagraphQuestions(row, item, index, services));
        }
      } else {
        const { renderResumeMemo } = await import(new URL('modules/resume-memo.js', base).href);
        host.append(renderResumeMemo(services, { resume: id => calls.push(['resume', id]), openEvidence: services.openEvidence }));
      }
    }
    window.__helpers = {
      services, calls, render,
      patch: patch => { Object.assign(state, patch); for (const fn of listeners) fn(structuredClone(state)); },
      restrict: ids => { allowed = new Set(ids); for (const fn of listeners) fn(structuredClone(state)); },
      dispose: () => { for (const fn of cleanup) fn(); cleanup = []; },
    };
    await render();
  }, { base: PREVIEW, mode, seed });
}

test('photo discovery requires activation, switches to full frame, restores aria, and cleans up', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await harness(page, 'photo');
  await expect(page.locator('.photo-regions-layer')).toBeHidden();
  await page.locator('[data-region-choice="lock"]').focus();
  expect(await page.evaluate(() => window.__helpers.services.caseStore.get().photoRegions)).toEqual([]);
  await page.locator('[data-region-choice="lock"]').press('Enter');
  await expect(page.locator('.photo-regions-layer')).toBeVisible();
  await expect(page.locator('[data-region="lock"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-region-choice="lock"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__helpers.services.caseStore.get().photoRegions.length)).toBe(1);
  const image = await page.locator('.case-magnifier-view').boundingBox();
  const controls = await page.locator('.photo-region-controls').boundingBox();
  expect(controls.y).toBeGreaterThanOrEqual(image.y + image.height);
  await page.locator('[data-magnifier-toggle]').click();
  await expect(page.locator('.photo-regions-layer')).toBeHidden();
  await page.locator('[data-region-choice="ext02"]').click();
  await expect(page.locator('.case-magnifier-view')).not.toHaveClass(/is-active/);
  await expect(page.locator('.photo-region-status')).toContainText('المصدر المكتوب');
  await page.evaluate(() => window.__helpers.render());
  await expect(page.locator('[data-region-choice="ext02"]')).toHaveAttribute('aria-pressed', 'true');
  await expectNoOverflow(page);
  await page.evaluate(() => window.__helpers.dispose());
  await expect(page.locator('[data-photo-regions]')).toHaveCount(0);
  await expect(page.locator('.photo-region-controls')).toHaveCount(0);
});

test('paragraph questions disclose only exact opened sources and save once with source quotations', async ({ page }) => {
  await harness(page, 'questions', { viewedIds: ['E01'], allowed: ['E01', 'E03', 'E05'] });
  const sites = page.locator('[data-fixture-paragraph="1"]');
  await sites.getByRole('button', { name: 'اسأل عن هذه الفقرة' }).click();
  await expect(sites.locator('.paragraph-question-panel')).toContainText('لا توجد إجابة متاحة');
  await expect(page.locator('.paragraph-answer-quote')).toHaveCount(0);
  await page.evaluate(() => window.__helpers.patch({ viewedIds: ['E01', 'E03'] }));
  await expect(sites.locator('.paragraph-answer-quote')).toHaveCount(2);
  await expect(sites.locator('.paragraph-question-panel')).toContainText('يفصل MA-22');
  const save = sites.locator('[data-save-paragraph-question]');
  await save.click();
  await expect(save).toBeDisabled();
  const notes = await page.evaluate(() => window.__helpers.services.caseStore.get().notes);
  expect(notes).toHaveLength(1);
  expect(notes[0].answerSources.map(source => source.evidenceId)).toEqual(['E03', 'E03']);
  expect(notes[0].answerSources[1].quote).toContain('يُكلّف لوسيان');
  await sites.getByRole('button', { name: 'اسأل عن هذه الفقرة' }).click();
  await sites.getByRole('button', { name: 'اسأل عن هذه الفقرة' }).click();
  await expect(sites.locator('[data-save-paragraph-question]')).toBeDisabled();
  const fourth = page.locator('[data-fixture-paragraph="3"]');
  await fourth.getByRole('button', { name: 'اسأل عن هذه الفقرة' }).click();
  await expect(fourth.locator('.paragraph-question-panel')).toContainText('لا توجد إجابة متاحة');
  await page.evaluate(() => window.__helpers.patch({ viewedIds: ['E01', 'E03', 'E05'] }));
  await expect(fourth.locator('.paragraph-question-panel')).toContainText('اسم نورا');
  await expect(fourth.locator('.paragraph-question-panel')).not.toContainText('توقيع المسلّم');
  await fourth.locator('[data-save-paragraph-question]').focus();
  await page.keyboard.press('Escape');
  await expect(fourth.locator('.paragraph-question-panel')).toBeHidden();
  await expect(fourth.getByRole('button', { name: 'اسأل عن هذه الفقرة' })).toBeFocused();
  await page.evaluate(() => window.__helpers.restrict(['E01']));
  await expect(sites.locator('.paragraph-answer-quote')).toHaveCount(0);
});

test('resume memo separates personal text, filters unavailable sources, and safely handles malformed entries', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await harness(page, 'memo', {
    viewedIds: ['E01', 'E06', 'E07'], allowed: ['E01', 'E06'], solvedIds: ['Q01'],
    progress: { completedActivityIds: ['A01'], solvedIds: ['Q01'] },
    notes: [null, {}, { text: 3 }, { id: 'own', evidenceId: 'E01', type: 'فرضية', text: '<img src=x onerror="window.__injected=1">أحتاج تحققًا', quote: 'اقتباسي المحفوظ' },
      { id: 'locked', evidenceId: 'E07', text: 'LOCKED_SENTINEL' },
      { id: 'q', questionId: 'source-q', evidenceId: 'E01', type: 'سؤال', text: 'سؤال من مصدر مفتوح', answerSources: [{ evidenceId: 'E06', paragraphIndex: 1, quote: 'اقتباس بطاقة الحفظ' }] },
      { id: 'locked-q', questionId: 'locked', evidenceId: 'E01', text: 'LOCKED_ANSWER_SENTINEL', answerSources: [{ evidenceId: 'E07', paragraphIndex: 1, quote: 'غير متاح' }] }],
  });
  await expect(page.locator('.resume-memo')).toContainText('1 / 32');
  await expect(page.locator('[aria-label="ملاحظاتك الشخصية"]')).toContainText('أحتاج تحققًا');
  await expect(page.locator('[aria-label="أسئلتك المحفوظة ومصادرها"]')).toContainText('سؤال من مصدر مفتوح');
  await expect(page.locator('[aria-label="ملاحظاتك الشخصية"]')).not.toContainText('سؤال من مصدر مفتوح');
  await expect(page.locator('.resume-memo')).not.toContainText('LOCKED_');
  await expect(page.locator('.resume-memo img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
  await page.locator('[data-resume-investigation]').click();
  expect(await page.evaluate(() => window.__helpers.calls.some(call => call[0] === 'resume'))).toBe(true);
  await expectNoOverflow(page);
});

test('restoring an earlier run drops sourced answers whose supporting evidence is still locked', async ({ page }) => {
  await harness(page, 'memo');
  const saved = await page.evaluate(async base => {
    const { normalizeCase } = await import(new URL('modules/core.js', base).href);
    const normalized = normalizeCase({
      viewedIds: ['E01', 'E03', 'E06'],
      notes: [
        { id: 'personal', evidenceId: 'E01', text: 'فرضية شخصية بحاجة إلى فحص', quote: 'اقتباس المحضر' },
        { id: 'sites', questionId: 'E01:1:sites', evidenceId: 'E01', type: 'سؤال', text: 'LOCKED_E03_ANSWER', quote: 'اقتباس المحضر',
          answerSources: [{ evidenceId: 'E03', paragraphIndex: 0, quote: 'المصدر المقفل' }] },
        { id: 'mixed', questionId: 'mixed-sources', evidenceId: 'E01', type: 'سؤال', text: 'LOCKED_MIXED_ANSWER', quote: 'اقتباس المحضر',
          answerSources: [{ evidenceId: 'E06', paragraphIndex: 1, quote: 'المصدر المفتوح' }, { evidenceId: 'E03', paragraphIndex: 0, quote: 'المصدر المقفل' }] },
        { id: 'photo', questionId: 'E06:1:frame', evidenceId: 'E06', type: 'سؤال', text: 'جواب من بطاقة الصورة المفتوحة', quote: 'اقتباس البطاقة',
          answerSources: [{ evidenceId: 'E06', paragraphIndex: 1, quote: 'المصدر المفتوح' }] },
      ],
    });
    window.__helpers.patch(normalized);
    await window.__helpers.render();
    return { viewed: normalized.viewedIds, notes: normalized.notes.map(note => note.id) };
  }, PREVIEW);
  expect(saved.viewed).toEqual(['E01', 'E06']);
  expect(saved.notes).toEqual(['personal', 'photo']);
  await expect(page.locator('.resume-memo')).not.toContainText('LOCKED_');
  await expect(page.locator('.resume-memo')).toContainText('جواب من بطاقة الصورة المفتوحة');
});
