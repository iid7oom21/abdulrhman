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
const filmBody = readFileSync(fixture);
async function interceptFilms(context, onFilm = () => {}) {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (/\/episode-\d\.mp4$/.test(url.pathname)) {
      if (onFilm(url.pathname) === false) {
        return route.fulfill({status:503, contentType:'text/plain', body:'Fixture film temporarily unavailable'});
      }
      const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
      if (range) {
        const start = Number(range[1]), end = range[2] ? Number(range[2]) : filmBody.length - 1;
        return route.fulfill({ status:206, contentType:'video/mp4', headers:{ 'accept-ranges':'bytes', 'content-range':`bytes ${start}-${end}/${filmBody.length}` }, body:filmBody.subarray(start,end+1) });
      }
      return route.fulfill({ contentType:'video/mp4', headers:{'accept-ranges':'bytes'}, body:filmBody });
    }
    if (url.origin !== new URL(base).origin) return route.abort();
    return route.continue();
  });
}
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
  await interceptFilms(context, path => requestedFilms.push(path));
  const page = await context.newPage();
  await page.clock.install();
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
    await page.clock.fastForward(60000);
    expectedProgress[id] = null; // A completed film intentionally clears only its resume key.
    await expect(frame.locator('#rvnResumeNote')).toBeEmpty();
    await expect(video).toHaveAttribute('src', new RegExp(`episode-${id}\\.mp4$`));
    assert.equal(new URL(page.url()).searchParams.get('episode'), String(id));
    assert.ok(requestedFilms.every(path => Number(/episode-(\d+)\.mp4$/.exec(path)[1]) <= id));
    assert.equal(await frame.locator('#rvnAfterCredits img, #rvnAfterCredits video').count(), 0);
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
  await context.close();

  // Fail the actual MP4 response before metadata arrives. At this point a native
  // player's currentTime is zero even when this episode has a saved position.
  for (const savedTime of [42, 0]) {
    const offline = await browser.newContext({viewport:{width:390,height:844}, reducedMotion:'reduce'});
    try {
      await offline.addInitScript(time => {
        sessionStorage.setItem('raven_music_enabled_v2', 'off');
        sessionStorage.setItem('raven_studio_ident_v1', '1');
        localStorage.setItem('raven17_episode_1_progress', '71');
        if (time) localStorage.setItem('raven17_episode_2_progress', String(time));
      }, savedTime);
      const requests = [];
      let available = false;
      await interceptFilms(offline, path => {
        requests.push(path);
        return available;
      });
      const page = await offline.newPage();
      await page.goto(new URL('?episode=2&lang=en', base).href, {waitUntil:'domcontentloaded'});
      const film = page.frameLocator('#site-content');
      const video = film.locator('#ravenEpisodePlayer'), resume = film.locator('#rvnResumeNote');
      const retry = film.locator('#rvnRetryVideo'), next = film.locator('#rvnNextEpisode');
      await expect(film.locator('#rvnEpisodeStatus')).toHaveText('Episode 2');
      assert.equal(await video.evaluate(v => v.paused), true, 'A direct link opens the viewer paused');
      await film.locator('[data-rvn-episode="2"]').click();
      await expect(retry).toBeVisible();
      await expect(next).toBeEnabled();
      await expect(film.locator('.episodeClose')).toBeEnabled();
      await expect(film.locator('#rvnAfterCredits')).toBeHidden();
      if (savedTime) await expect(resume).toContainText('Resume');
      else await expect(resume).toBeEmpty();
      assert.ok(requests.length > 0 && requests.every(path => path.endsWith('/episode-2.mp4')));
      available = true;
      await retry.press('Enter');
      await expect.poll(() => video.evaluate(v => v.readyState >= 2 && !v.paused)).toBe(true);
      const position = await video.evaluate(v => { v.pause(); return v.currentTime; });
      assert.ok(position >= savedTime && position < savedTime + 4, `Expected ${savedTime}s after retry, got ${position}s`);
      if (!savedTime) await expect(resume).toBeEmpty();
      await expect(retry).toBeHidden();
      assert.ok(requests.every(path => path.endsWith('/episode-2.mp4')), 'Retry loads only the chosen film');
      assert.equal(await video.evaluate(() => localStorage.getItem('raven17_episode_1_progress')), '71');

      // Choose a different episode explicitly; it must also be possible to leave
      // the theater while its file is unavailable.
      available = false;
      await next.click();
      await expect(retry).toBeVisible();
      await expect(resume).toBeEmpty();
      await film.locator('.episodeClose').click();
      await expect(film.locator('#episodeModal')).toBeHidden();
      assert.equal(new URL(page.url()).searchParams.get('episode'), null);
      console.log(`PASS: episode failure, navigation and explicit same-film retry with ${savedTime}s progress.`);
    } finally {
      await offline.close();
    }
  }

  // These are storage failures, not mocked note implementations. The real input,
  // episode, replay, language and modal handlers run against the native video fixture.
  // Small focused cases cover both mobile widths without a full Cartesian product.
  const scenarios = [
    {mode:'blocked-getters', width:320},
    {mode:'normal', width:390},
    {mode:'blocked-read', width:390},
    {mode:'write-throws', width:390},
    {mode:'write-noop', width:320},
  ];
  for (const {mode, width} of scenarios) {
    const notesContext = await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
    try {
      await notesContext.addInitScript(({mode}) => {
        const storage = localStorage;
        const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
        const noteKey = key => String(key).startsWith('raven_episode_note_');
        sessionStorage.setItem('raven_music_enabled_v2', 'off');
        sessionStorage.setItem('raven_studio_ident_v1', '1');
        if (!get.call(storage, 'note-recovery-seeded')) {
          for (const id of [1,2,3]) set.call(storage, `raven_episode_note_${id}`, `old-note-${id}`);
          set.call(storage, 'other_app_preferences', 'keep');
          set.call(storage, 'note-recovery-seeded', '1');
        }
        // Only the test can inspect the original storage during fault injection.
        window.readNoteTestStorage = key => get.call(storage, key);
        if (mode === 'blocked-getters') {
          for (const name of ['localStorage','sessionStorage']) Object.defineProperty(window, name, {
            configurable:true,
            get() {throw new DOMException('Storage blocked by test', 'SecurityError');},
          });
        } else if (mode === 'blocked-read') {
          Storage.prototype.getItem = function(key) {
            if (this === storage && noteKey(key)) throw new DOMException('Note read blocked by test', 'SecurityError');
            return get.call(this, key);
          };
        } else if (mode === 'write-throws' || mode === 'write-noop') {
          Storage.prototype.setItem = function(key, value) {
            if (this === storage && noteKey(key) && !(mode === 'write-throws' && key === 'raven_episode_note_2')) {
              if (mode === 'write-throws') throw new DOMException('Note quota exhausted by test', 'QuotaExceededError');
              return; // A successful return is not proof of persistence.
            }
            return set.call(this, key, value);
          };
        }
      }, {mode});
      const requests = [];
      notesContext.on('request', request => requests.push(request.url() + '\n' + (request.postData() || '')));
      await interceptFilms(notesContext);
      const notesPage = await notesContext.newPage(), pageErrors = [];
      notesPage.on('pageerror', error => pageErrors.push(error.message));
      await notesPage.goto(new URL('?episode=1&lang=en', base).href, {waitUntil:'domcontentloaded'});
      const noteFrame = await (await notesPage.locator('#site-content').elementHandle()).contentFrame();
      await noteFrame.waitForFunction(() => document.documentElement.dataset.ravenRefinement === '2');
      await noteFrame.evaluate(() => {window.noteTestDocument = 'same-document';});
      const note = noteFrame.locator('#rvnEndNote'), status = noteFrame.locator('#rvnEndNoteStatus');
      const noteVideo = noteFrame.locator('#ravenEpisodePlayer');
      const text1 = `private-${mode}-episode-one`, text2 = `private-${mode}-episode-two`;
      const saved = mode === 'normal';
      const expectedStatus = (language, episode = 1) => (saved || (mode === 'write-throws' && episode === 2))
        ? (language === 'en' ? 'Your note was saved on this device.' : 'حُفظت ملاحظتك على هذا الجهاز.')
        : (language === 'en' ? 'Local saving is unavailable. Copy your note before leaving.' : 'تعذر الحفظ المحلي؛ انسخ ملاحظتك قبل المغادرة.');
      const revealNote = async () => {
        await expect.poll(() => noteVideo.evaluate(v => Number.isFinite(v.duration) && v.duration > 0)).toBe(true);
        // Let native play() resume/restart first. Seeking an ended video and
        // immediately playing can reset the pending seek to zero on reopen.
        await noteVideo.evaluate(async v => {await v.play();v.currentTime=v.duration-0.1;});
        await expect(noteFrame.locator('#rvnAfterCredits')).toBeVisible();
        await expect.poll(() => noteVideo.evaluate(v => v.ended)).toBe(true);
        const disclosure = noteFrame.locator('#rvnAfterCredits details');
        if (!(await disclosure.evaluate(el => el.open))) await disclosure.locator('summary').click();
      };
      await noteFrame.locator('[data-rvn-episode="1"]').click();
      await revealNote();
      await note.fill(text1);
      await expect(status).toHaveText(expectedStatus('en'));
      await noteFrame.locator('#rvnAfterNext').click();
      await revealNote();
      await note.fill(text2);
      await expect(status).toHaveText(expectedStatus('en', 2));
      await noteFrame.locator('#rvnPrevEpisode').click();
      await revealNote();
      await expect(note).toHaveValue(text1);
      await expect(status).toHaveText(expectedStatus('en'));

      // Re-rendered status must describe this episode's persistence, in either language.
      for (const language of ['ar','en']) {
        await noteFrame.locator(`#episodeModal [data-rvn-lang="${language}"]`).click();
        await expect(note).toHaveValue(text1);
        await expect(status).toHaveText(expectedStatus(language));
      }
      await noteFrame.locator('#rvnAfterReplay').click();
      await revealNote();
      await expect(note).toHaveValue(text1);
      await expect(status).toHaveText(expectedStatus('en'));

      // Failure/retry uses the existing error control and reloads only the video.
      await noteVideo.dispatchEvent('error');
      await expect(noteFrame.locator('#rvnRetryVideo')).toBeVisible();
      await noteFrame.locator('#rvnRetryVideo').click();
      await revealNote();
      await expect(note).toHaveValue(text1);
      await expect(status).toHaveText(expectedStatus('en'));

      await noteFrame.locator('.episodeClose').click();
      await expect(noteFrame.locator('#episodeModal')).toHaveAttribute('aria-hidden','true');
      await noteFrame.locator('[data-rvn-episodes]').first().click();
      await revealNote();
      assert.equal(await noteFrame.evaluate(() => window.noteTestDocument), 'same-document');
      await expect(note).toHaveValue(text1);
      await expect(status).toHaveText(expectedStatus('en'));

      // Empty text is an intentional edit, even if storage still holds old-note-1.
      await note.fill('');
      await expect(status).toHaveText(expectedStatus('en'));
      await noteFrame.locator('#rvnAfterNext').click();
      await revealNote();
      await expect(note).toHaveValue(text2);
      await expect(status).toHaveText(expectedStatus('en', 2));
      await noteFrame.locator('#rvnPrevEpisode').click();
      await revealNote();
      await expect(note).toHaveValue('');
      await expect(status).toHaveText(expectedStatus('en'));
      assert.equal(await noteFrame.evaluate(() => window.readNoteTestStorage('raven_episode_note_3')), 'old-note-3');
      assert.equal(await noteFrame.evaluate(() => window.readNoteTestStorage('other_app_preferences')), 'keep');
      if (mode === 'write-throws' || mode === 'write-noop') {
        assert.equal(await noteFrame.evaluate(() => window.readNoteTestStorage('raven_episode_note_1')), 'old-note-1');
        assert.equal(await noteFrame.evaluate(() => window.readNoteTestStorage('raven_episode_note_2')), mode === 'write-throws' ? text2 : 'old-note-2');
      }
      if (saved) {
        // Reload clears the document cache; the original storage keys must suffice.
        await notesPage.reload({waitUntil:'domcontentloaded'});
        const restored = await (await notesPage.locator('#site-content').elementHandle()).contentFrame();
        await restored.waitForFunction(() => document.documentElement.dataset.ravenRefinement === '2');
        await expect(restored.locator('#rvnEndNote')).toHaveValue('');
        await restored.locator('[data-rvn-episode="2"]').click();
        await expect(restored.locator('#rvnEndNote')).toHaveValue(text2);
      }
      assert.equal(await notesPage.locator('#site-soundtrack').evaluate(v => v.paused), true);
      const activeFrame = await (await notesPage.locator('#site-content').elementHandle()).contentFrame();
      assert.equal(await activeFrame.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(pageErrors, [], `${mode}: no uncaught page exceptions`);
      for (const text of [text1,text2]) assert.ok(requests.every(request => !request.includes(text) && !request.includes(encodeURIComponent(text))), `${mode}: private note never enters a request`);
      console.log(`PASS: ${width}px ${mode}: isolated notes, empty edit, replay, close/reopen, video retry, AR/EN status, privacy${saved ? ', durable reload' : ', no false saved claim'}.`);
    } finally {
      await notesContext.close();
    }
  }

} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
