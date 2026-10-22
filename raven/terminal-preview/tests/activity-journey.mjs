import { expect, EXPANSION_KEY, caseState, openEvidence, closeEvidence, selectCaseTab } from './helpers.mjs';
import { execFileSync } from 'node:child_process';

// Playwright's transformer classifies the site's .js files as CommonJS because
// the static site has no Node package boundary. Load authored fixtures with native
// Node ESM in a child process; no application state is changed by this read.
const dataURL = new URL('../modules/expansion-data.js', import.meta.url).href;
const engineURL = new URL('../modules/investigation.js', import.meta.url).href;
const fixtureURL = new URL('./expansion-fixtures.mjs', import.meta.url).href;
const fixtureData = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
  const { ACTIVITIES, REVISION } = await import(${JSON.stringify(dataURL)});
  const { normalizeProgress } = await import(${JSON.stringify(engineURL)});
  const { SOLUTION_PAYLOADS, acceptedPrefix } = await import(${JSON.stringify(fixtureURL)});
  console.log(JSON.stringify({ activities: ACTIVITIES, payloads: SOLUTION_PAYLOADS,
    prefixes: Array.from({length:33}, (_, n) => normalizeProgress({revision:REVISION, accepted:acceptedPrefix(n)})) }));
`], { encoding: 'utf8' }));
export const ACTIVITIES = fixtureData.activities;
export async function solutions() { return fixtureData.payloads; }

export function solutionFor(payloads, activity) {
  return structuredClone(Array.isArray(payloads) ? payloads[activity.number - 1] : payloads[activity.id]);
}

/** Valid setup for isolated notebook/report regressions, never the full journey. */
export async function seedExpansion(context, through = 0, extra = {}) {
  const state = {
    viewedIds: [...new Set(ACTIVITIES.slice(0, through).flatMap(activity => activity.requiredEvidenceIds))],
    progress: structuredClone(fixtureData.prefixes[through]), drafts: {}, notes: [], highlights: [],
    pins: [], links: [], timeline: [], hypotheses: [], training: {}, call: {}, photoRegions: [], ...extra,
  };
  await context.addInitScript(({ key, state, marker }) => {
    if (localStorage.getItem(marker)) return;
    localStorage.setItem('raven-preview:v1:initialized', 'true');
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem(marker, '1');
  }, { key: EXPANSION_KEY, state, marker: `test:expansion-seed-${through}` });
  return state;
}

export async function readRequiredSources(page, activity) {
  const seen = (await caseState(page)).viewedIds || [];
  for (const id of activity.requiredEvidenceIds) {
    if (seen.includes(id)) continue;
    await openEvidence(page, id);
    await closeEvidence(page);
  }
  await selectCaseTab(page, 'activities');
  await expect(page.locator(`[data-activity-id="${activity.id}"]`).first()).toBeVisible();
}

export async function moveOrder(page, scope, key, desired) {
  const field = scope.locator(`[data-field-key="${key}"]`);
  for (let target = 0; target < desired.length; target++) {
    for (let moves = 0; moves < desired.length; moves++) {
      const order = await field.locator('[data-order-item]').evaluateAll(rows => rows.map(row => row.dataset.orderItem));
      if (order[target] === desired[target]) break;
      const index = order.indexOf(desired[target]);
      if (index < target) throw new Error(`Order widget lost ${desired[target]} in ${key}`);
      await field.locator(`[data-order-item="${desired[target]}"] [data-order-up]`).click();
    }
  }
  expect(await field.locator('[data-order-item]').evaluateAll(rows => rows.map(row => row.dataset.orderItem))).toEqual(desired);
}

/** Fill the public widgets with an independently supplied answer, using browser input. */
export async function fillActivity(page, activity, payload) {
  const scope = page.locator(`[data-activity-id="${activity.id}"]`).first();
  for (const field of activity.fields) {
    if (payload[field.key] === undefined) continue;
    const value = payload[field.key];
    const control = scope.locator(`[data-activity-field="${field.key}"]`);
    if (field.type === 'order') await moveOrder(page, scope, field.key, value);
    else if (field.type === 'multi') {
      const inputs = scope.locator(`[data-field-key="${field.key}"] input[type="checkbox"]`);
      for (const checkbox of await inputs.all()) {
        const included = value.includes(await checkbox.getAttribute('value'));
        await checkbox.setChecked(included);
      }
    } else if (field.type === 'hashes') {
      for (const button of await scope.locator('[data-hash-file]').all()) await button.click();
      await expect.poll(async () => {
        const saved = await caseState(page);
        return Object.keys(saved.drafts?.[activity.id]?.computedHashes || {}).length;
      }).toBe(3);
    } else if (field.type === 'select') {
      if (await scope.locator(`[data-field-key="${field.key}"] input[type="radio"]`).count()) await scope.locator(`[data-field-key="${field.key}"] input[value="${value}"]`).check();
      else await control.selectOption(String(value));
    } else await control.fill(String(value));
  }
}

export async function submitActivity(page, activity) {
  await page.locator(`[data-activity-id="${activity.id}"] [data-activity-submit]`).click();
}
