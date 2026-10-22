import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect, boot } from './helpers.mjs';

// Deterministic, real media decoding: synthetic PCM fixtures exercise playback
// policy and continuity. They do not assert the remote film's artistic content.
function silentWav(seconds = 30) {
  const rate = 8000;
  const body = Buffer.alloc(44 + rate * seconds * 2);
  body.write('RIFF', 0); body.writeUInt32LE(body.length - 8, 4); body.write('WAVEfmt ', 8);
  body.writeUInt32LE(16, 16); body.writeUInt16LE(1, 20); body.writeUInt16LE(1, 22);
  body.writeUInt32LE(rate, 24); body.writeUInt32LE(rate * 2, 28); body.writeUInt16LE(2, 32); body.writeUInt16LE(16, 34);
  body.write('data', 36); body.writeUInt32LE(body.length - 44, 40);
  return body;
}
async function fixtureSong(page) {
  await page.route('**/*raven-baqi-athar*.mp3*', request => request.fulfill({ contentType: 'audio/wav', body: silentWav() }));
}
const playing = page => page.locator('#preview-soundtrack').evaluate(audio => !audio.paused && audio.currentTime > 0);

test('music starts on interaction, keeps its position across routes, and remembers explicit pause', async ({ page }) => {
  await fixtureSong(page);
  await boot(page);
  await page.locator('[data-audio-toggle]').click();
  await expect.poll(() => playing(page)).toBe(true);
  await page.evaluate(() => { window.__persistentAudio = document.querySelector('#preview-soundtrack'); window.__songPosition = window.__persistentAudio.currentTime; });
  await page.locator('a[href*="/case-017/"]').first().click();
  await expect.poll(() => playing(page)).toBe(true);
  expect(await page.evaluate(() => window.__persistentAudio === document.querySelector('#preview-soundtrack') && window.__persistentAudio.currentTime >= window.__songPosition)).toBe(true);
  await page.locator('[data-audio-toggle]').click();
  await expect.poll(() => page.locator('#preview-soundtrack').evaluate(audio => audio.paused)).toBe(true);
  await page.reload();
  await page.locator('[data-evidence-id="E01"]').first().click();
  expect(await page.locator('#preview-soundtrack').evaluate(audio => audio.paused)).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('raven-preview:v1:musicEnabled')))).toBe(false);
});

test('a film gets first-interaction audio priority, resumes music on pause, and respects manual music off', async ({ page }) => {
  await fixtureSong(page);
  const videoFile = fileURLToPath(new URL('../assets/hero-loop.mp4', import.meta.url));
  await page.route('**/episode-1.mp4*', request => request.fulfill({ contentType: 'video/mp4', body: fs.readFileSync(videoFile) }));
  await boot(page, 'raven-17/part-1/');
  const soundtrack = page.locator('#preview-soundtrack');
  const film = page.locator('[data-film-video="1"]');
  const button = page.locator('.theater-controls [data-media-start]').first();
  await button.click();
  await expect.poll(() => film.evaluate(video => !video.paused && video.currentTime > 0)).toBe(true);
  expect(await soundtrack.evaluate(audio => audio.hasAttribute('src'))).toBe(false);
  expect(await soundtrack.evaluate(audio => audio.paused)).toBe(true);
  await button.click();
  await expect.poll(() => playing(page)).toBe(true);
  await button.click();
  await expect.poll(() => film.evaluate(video => !video.paused)).toBe(true);
  await expect.poll(() => soundtrack.evaluate(audio => audio.paused)).toBe(true);
  await page.locator('[data-audio-toggle]').click();
  await button.click();
  expect(await soundtrack.evaluate(audio => audio.paused)).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('raven-preview:v1:musicEnabled')))).toBe(false);
});

test('volume and ambience are explicit persistent choices with accessible settings dismissal', async ({ page }) => {
  await fixtureSong(page);
  await boot(page);
  await page.locator('.sound-settings-button').click();
  await expect(page.locator('#preview-music-volume')).toBeFocused();
  await page.locator('#preview-music-volume').fill('30');
  expect(await page.locator('#preview-soundtrack').evaluate(audio => audio.volume)).toBeCloseTo(.3);
  await page.locator('[data-ambient-toggle]').click();
  await expect(page.locator('[data-ambient-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('#preview-audio-settings')).toBeHidden();
  await expect(page.locator('.sound-settings-button')).toBeFocused();
  await page.reload();
  expect(await page.locator('#preview-soundtrack').evaluate(audio => audio.volume)).toBeCloseTo(.3);
  await page.locator('.sound-settings-button').click();
  await expect(page.locator('[data-ambient-toggle]')).toHaveAttribute('aria-pressed', 'true');
});
