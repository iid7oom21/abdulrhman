// Regression for existing episode links and saved data after restoring all three films.
// Run against a served repository root. Remote film URLs retain their identity;
// playback uses a temporary native video fixture, never a production replacement.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium, webkit, expect } = require(process.env.PLAYWRIGHT_TEST_MODULE || 'playwright/test');
const base = process.env.RAVEN_LEGACY_URL || 'http://127.0.0.1:8786/raven/';
const work = mkdtempSync(join(tmpdir(), 'raven-legacy-episodes-'));
const fixture = join(work, 'playback.mp4');
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=160x90:r=2', '-t', '180', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', fixture]);
const useWebkit = process.env.RAVEN_BROWSER === 'webkit';
const browser = await (useWebkit ? webkit : chromium).launch({ headless: true,
  ...(!useWebkit ? { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] } : {}) });
try {
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    sessionStorage.setItem('raven_music_enabled_v2', 'off');
    sessionStorage.setItem('raven_studio_ident_v1', '1');
    if (!localStorage.getItem('legacy-episode-test-seeded')) {
      for (const [id, time] of [[1, 31], [2, 42], [3, 72]]) {
        localStorage.setItem(`raven17_episode_${id}_progress`, String(time));
        localStorage.setItem(`raven_episode_note_${id}`, `original-film-${id}`);
      }
      localStorage.setItem('other_app_preferences', 'keep');
      localStorage.setItem('legacy-episode-test-seeded', '1');
    }
  });
  const requestedFilms = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (/\/episode-\d\.mp4/.test(url.pathname)) {
      requestedFilms.push(url.pathname);
      const body = readFileSync(fixture);
      const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
      if (range) {
        const start = Number(range[1]), end = range[2] ? Number(range[2]) : body.length - 1;
        return route.fulfill({ status:206, contentType:'video/mp4', headers:{ 'accept-ranges':'bytes', 'content-range':`bytes ${start}-${end}/${body.length}` }, body:body.subarray(start,end+1) });
      }
      return route.fulfill({ contentType: 'video/mp4', headers:{'accept-ranges':'bytes'}, body });
    }
    if (url.origin !== new URL(base).origin) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(new URL('?episode=1', base).href, { waitUntil: 'domcontentloaded' });
  const frame = await (await page.locator('#site-content').elementHandle()).contentFrame();
  await frame.waitForFunction(() => document.documentElement.dataset.ravenRefinement === '2');
  const video = frame.locator('#ravenEpisodePlayer');
  await expect(frame.locator('[data-rvn-episode]')).toHaveCount(3);
  const expectedProgress = { 1:'31', 2:'42', 3:'72' };
  const expectedNotes = { 1:'original-film-1', 2:'original-film-2', 3:'original-film-3' };
  const assertStorage = async activeFrame => {
    const actual = await activeFrame.evaluate(() => ({
      progress:Object.fromEntries([1,2,3].map(id => [id,localStorage.getItem(`raven17_episode_${id}_progress`)])),
      notes:Object.fromEntries([1,2,3].map(id => [id,localStorage.getItem(`raven_episode_note_${id}`)])),
      unrelated:localStorage.getItem('other_app_preferences')
    }));
    assert.deepEqual(actual, {progress:expectedProgress,notes:expectedNotes,unrelated:'keep'});
  };
  for (const id of [1,2,3]) {
    await expect(video).toHaveAttribute('src', new RegExp(`episode-${id}\\.mp4$`));
    await expect(frame.locator('#rvnEndNote')).toHaveValue(expectedNotes[id]);
    await expect(frame.locator(`[data-rvn-episode="${id}"]`)).toHaveAttribute('aria-pressed','true');
    assert.equal(new URL(page.url()).searchParams.get('episode'), String(id));
    if (id === 1) {
      await expect(frame.locator('#rvnPrevEpisode')).toBeDisabled();
      await frame.locator('[data-rvn-episode="1"]').click();
    }
    // Tab/next controls play natively. Allow the few frames elapsed since the click.
    const resume = Number(expectedProgress[id]);
    await expect.poll(() => video.evaluate((v,time) => v.currentTime >= time && v.currentTime < time + 3, resume)).toBe(true);
    const updated = resume + 10;
    await video.evaluate((v,time) => { v.currentTime=time; v.pause(); }, updated);
    await expect.poll(() => frame.evaluate(id => localStorage.getItem(`raven17_episode_${id}_progress`), id)).toBe(String(updated));
    expectedProgress[id] = String(updated);
    await assertStorage(frame); // Updating this film must not touch either other film.
    await video.evaluate(async v => { v.currentTime = v.duration - 0.1; await v.play(); });
    await expect(frame.locator('#rvnAfterCredits')).toBeVisible();
    await expect.poll(() => video.evaluate(v => v.ended)).toBe(true);
    expectedProgress[id] = null; // A completed film intentionally clears only its resume key.
    const details = frame.locator('#rvnAfterCredits details');
    if (!(await details.evaluate(el => el.open))) await details.locator('summary').click();
    expectedNotes[id] = `new-note-for-original-${id}`;
    await frame.locator('#rvnEndNote').fill(expectedNotes[id]);
    await assertStorage(frame);
    if (id < 3) {
      await expect(frame.locator('#rvnAfterNext')).toBeVisible();
      await frame.locator('#rvnAfterNext').click();
    } else {
      await expect(frame.locator('#rvnNextEpisode')).toBeDisabled();
      await expect(frame.locator('#rvnAfterNext')).toBeHidden();
    }
  }
  assert.equal(await page.locator('#site-soundtrack').evaluate(v => v.paused), true);
  assert.equal(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  for (const id of [1,2,3]) assert.ok(requestedFilms.some(url => url.endsWith(`/episode-${id}.mp4`)), `film ${id} was requested`);

  // Every saved deep link retains its own source ID, note and locale; no aliasing to another film.
  for (const id of [1,2,3]) {
    await page.goto(new URL(`?episode=${id}&lang=en`, base).href, { waitUntil: 'domcontentloaded' });
    const linked = await (await page.locator('#site-content').elementHandle()).contentFrame();
    await linked.waitForFunction(() => document.documentElement.dataset.ravenRefinement === '2');
    await expect(linked.locator('#ravenEpisodePlayer')).toHaveAttribute('src', new RegExp(`episode-${id}\\.mp4$`));
    await expect(linked.locator('#rvnEndNote')).toHaveValue(expectedNotes[id]);
    await expect(linked.locator('#rvnEpisodeStatus')).toHaveText(`Episode ${id}`);
    await expect(linked.locator('[data-rvn-i18n="filmsIntro"]')).toHaveText('Three episodes. Begin with episode one.');
    for (const lang of ['ar','en']) {
      await linked.locator(`#episodeModal [data-rvn-lang="${lang}"]`).click();
      await expect(linked.locator('#rvnEpisodeStatus')).toHaveText(lang === 'en' ? `Episode ${id}` : `الحلقة ${id}`);
      assert.equal(new URL(page.url()).searchParams.get('episode'), String(id));
      assert.equal(new URL(page.url()).searchParams.get('lang'), lang === 'en' ? 'en' : null);
      await expect(linked.locator('#rvnEndNote')).toHaveValue(expectedNotes[id]);
      await assertStorage(linked);
    }
    assert.equal(await linked.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  }
  console.log('PASS: three original episode IDs, fixture playback/resume, isolated progress and notes, final next button, deep links 1/2/3, AR/EN switching, music-off and 320px layout.');

} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
