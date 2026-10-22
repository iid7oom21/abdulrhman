import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect, route, boot, expectNoOverflow, selectCaseTab } from './helpers.mjs';
import { seedExpansion } from './activity-journey.mjs';

// Test-only H.264 fixture: 64x36, 2fps, 20.000 seconds, 2027 bytes (ffprobe).
// It is served only by Playwright interception, never shipped as a story recording.
const CAMERA = Buffer.from('AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAPCbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAATiAAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAu10cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAATiAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAEAAAAAkAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAE4gAAAAAAABAAAAAAJlbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAFAABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAACEG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAdBzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAEAAJABIAAAASAAAAAAAAAABFUxhdmM2MS4xOS4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAK/+EAF2dCwAraEf58BEAAAAMAQAAAAwEDxImoAQAEaM4PyAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAAGWAAAAAAAAABhzdHRzAAAAAAAAAAEAAAAoAAAgAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAoAAAAAQAAALRzdHN6AAAAAAAAAAAAAAAoAAACcwAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAAAoAAAAKAAAACgAAABRzdGNvAAAAAAAAAAEAAAPyAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2MS43LjEwMwAAAAhmcmVlAAAEAW1kYXQAAAJTBgX//0/cRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MCByZWY9MSBkZWJsb2NrPTA6MDowIGFuYWx5c2U9MDowIG1lPWRpYSBzdWJtZT0wIHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTAgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0wIDh4OGRjdD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PTAgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTI1MCBrZXlpbnRfbWluPTIgc2NlbmVjdXQ9MCBpbnRyYV9yZWZyZXNoPTAgcmM9Y3JmIG1idHJlZT0wIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTAAgAAAABhliIQ6EYoAAhl+OAAIA8nJyddddddddeAAAAAGQZogF6GwAAAABkGaQBehsAAAAAZBmmAXobAAAAAGQZqAF6GwAAAABkGaoBehsAAAAAZBmsAXobAAAAAGQZrgF6GwAAAABkGbABehsAAAAAZBmyAXobAAAAAGQZtAF6GwAAAABkGbYBehsAAAAAZBm4AXobAAAAAGQZugF6GwAAAABkGbwBehsAAAAAZBm+AXobAAAAAGQZoAF6GwAAAABkGaIBehsAAAAAZBmkAXobAAAAAGQZpgF6GwAAAABkGagBehsAAAAAZBmqAXobAAAAAGQZrAF6GwAAAABkGa4BehsAAAAAZBmwAXobAAAAAGQZsgF6GwAAAABkGbQBehsAAAAAZBm2AXobAAAAAGQZuAF6GwAAAABkGboBehsAAAAAZBm8AXobAAAAAGQZvgF6GwAAAABkGaABehsAAAAAZBmiAXobAAAAAGQZpAF6GwAAAABkGaYBehsAAAAAZBmoAXobAAAAAGQZqgF6GwAAAABkGawBehsAAAAAZBmuAXobA=', 'base64');
const RATE = 48000;
function pcmWav(samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(RATE, 24); bytes.writeUInt32LE(RATE * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => bytes.writeInt16LE(sample, 44 + index * 2));
  return bytes;
}
const sourceSamples = new Int16Array(RATE * 90);
for (let i = 0; i < sourceSamples.length; i++) {
  // Unequal amplitude blocks and a chirp make reversed audio observably different.
  const second = i / RATE;
  const level = second < 30 ? 1800 : second < 60 ? 6500 : 12000;
  sourceSamples[i] = Math.round(level * Math.sin(2 * Math.PI * (180 * second + .2 * second * second)));
}
for (let pulse = 0; pulse < 3; pulse++) sourceSamples.fill(22000 - pulse * 1000, 48 * RATE + pulse * 12000, 48 * RATE + pulse * 12000 + 600);
const excerptSamples = sourceSamples.slice(73 * RATE, 77 * RATE);
const FIXTURES = {
  'camera-a.mp4': CAMERA, 'camera-b.mp4': CAMERA, 'camera-c.mp4': CAMERA,
  'a.wav': pcmWav(sourceSamples), 'b.wav': pcmWav(sourceSamples.slice(36 * RATE)),
  'excerpt.wav': pcmWav(excerptSamples), 'reversed.wav': pcmWav(excerptSamples.slice().reverse()),
  'wrong-excerpt.wav': pcmWav(sourceSamples.slice(70 * RATE, 74 * RATE)),
  'song.wav': pcmWav(sourceSamples.slice(0, 6 * RATE)),
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function record(id, file, durationSeconds, extra = {}) {
  return { id, status: 'ready', url: route(`__workbench_fixtures__/${file}`), mime: file.endsWith('.mp4') ? 'video/mp4' : 'audio/wav',
    bytes: FIXTURES[file].length, sha256: digest(FIXTURES[file]), durationSeconds, locale: 'ar', version: 'browser-fixture-only', provenance: 'اختبار آلي، ليس من مواد القصة.', ...extra };
}
function readyManifest() {
  const a = record('lab-channel-a', 'a.wav', 90, { sourceId: 'E13', masterStartSeconds: 0, calibrationSeconds: 48 });
  return { version: 1, call: { id: 'ma22-call', status: 'pending', url: null },
    cameras: ['a', 'b', 'c'].map((name, index) => record(['lab-camera-intake', 'lab-camera-scanner', 'lab-camera-review'][index], `camera-${name}.mp4`, 20, { sourceId: 'E12', masterStartSeconds: 40, clockOffsetSeconds: index === 1 ? 420 : 0 })),
    channels: [a, record('lab-channel-b', 'b.wav', 54, { sourceId: 'E13', masterStartSeconds: 36, calibrationSeconds: 12 })],
    excerpt: record('lab-published-excerpt', 'excerpt.wav', 4, { sourceId: 'E14', derivedFrom: a.id, sourceRangeSeconds: [73, 77], sourceSha256: a.sha256 }),
    reversed: record('lab-reversed-excerpt', 'reversed.wav', 4, { sourceId: 'E13', derivedFrom: a.id, sourceRangeSeconds: [73, 77], sourceSha256: a.sha256 }),
  };
}
async function mediaRoutes(page, manifest, { broken = null } = {}) {
  const requests = [];
  await page.route('**/__workbench_fixtures__/*', async request => {
    const file = new URL(request.request().url()).pathname.split('/').at(-1);
    requests.push(file);
    if (file === broken || !FIXTURES[file]) return request.fulfill({ status: 404, body: 'fixture unavailable' });
    return request.fulfill({ contentType: file.endsWith('.mp4') ? 'video/mp4' : 'audio/wav', body: FIXTURES[file] });
  });
  await page.route('**/assets/expansion-media-manifest.json', request => request.fulfill({ json: manifest }));
  return requests;
}
async function nativeMediaProbe(page, outputRate = 48000) {
  await page.addInitScript(outputRate => {
    window.__mediaStarts = []; window.__blobCreates = []; window.__blobRevokes = [];
    const NativeContext = window.AudioContext || window.webkitAudioContext;
    if (NativeContext) {
      // Real native decoding and playback, fixed sampling rate for exact fixture comparisons.
      window.AudioContext = new Proxy(NativeContext, { construct(Target, args) { return Reflect.construct(Target, [{ ...(args[0] || {}), sampleRate: outputRate }]); } });
      const create = NativeContext.prototype.createBufferSource;
      NativeContext.prototype.createBufferSource = function (...args) {
        const node = create.apply(this, args); const start = node.start; const stop = node.stop;
        let entry;
        node.start = function (...startArgs) {
          entry = { buffer: node.buffer, args: startArgs, contextTime: node.context.currentTime, outputSampleRate: node.context.sampleRate, stopped: false };
          window.__mediaStarts.push(entry);
          return start.apply(node, startArgs);
        };
        node.stop = function (...stopArgs) { if (entry) entry.stopped = true; return stop.apply(node, stopArgs); };
        return node;
      };
    }
    const createBlob = URL.createObjectURL.bind(URL); const revokeBlob = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = object => { const url = createBlob(object); window.__blobCreates.push(url); return url; };
    URL.revokeObjectURL = url => { window.__blobRevokes.push(url); revokeBlob(url); };
  }, outputRate);
}
async function harness(page, activityId, { manifest = readyManifest(), offset = 0, broken = null, owner = false, outputRate = 48000 } = {}) {
  const requests = await mediaRoutes(page, manifest, { broken });
  await nativeMediaProbe(page, outputRate);
  await page.route('**/__media-workbench-harness__', request => request.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${route('styles.css')}"><link rel="stylesheet" href="${route('modules/activities.css')}"><link rel="stylesheet" href="${route('modules/media-workbench.css')}"><link rel="stylesheet" href="${route('modules/audio.css')}"><style>body{margin:0;padding:12px;background:#101610;color:#eee}#host{max-width:900px;margin:auto}button,input{min-height:48px;max-width:100%}</style></head><body><main id="host"></main><div id="dock"></div></body></html>` }));
  if (owner) await page.route('**/*raven-baqi-athar*.mp3*', request => request.fulfill({ contentType: 'audio/wav', body: FIXTURES['song.wav'] }));
  await page.goto(route('__media-workbench-harness__'));
  await page.evaluate(async ({ moduleURL, audioURL, activityId, manifest, offset, owner }) => {
    const { mountMediaWorkbench } = await import(moduleURL);
    const holds = new Set(); const listeners = new Set(); const notices = [];
    const memory = new Map();
    const services = {
      expansionMedia: manifest,
      audio: { hold: token => holds.add(token), release: token => holds.delete(token) },
      notify: value => notices.push(value), t: ar => ar,
      store: { get: (key, fallback) => memory.has(key) ? memory.get(key) : fallback, set: (key, value) => memory.set(key, value) },
    };
    if (owner) {
      const { createAudio } = await import(audioURL);
      services.audio = createAudio(document.querySelector('#dock'), services);
    }
    let availability = null;
    const cleanup = mountMediaWorkbench(document.querySelector('#host'), services, {
      activityId, getOffset: () => offset, subscribeOffset(callback) { listeners.add(callback); return () => listeners.delete(callback); },
      onAvailability(value) { availability = value; },
    });
    window.workbenchHarness = {
      services, notices, holds: () => [...holds], availability: () => availability,
      setOffset(value) { offset = value; for (const callback of listeners) callback(value); },
      destroy() { cleanup(); }, listeners: () => listeners.size,
    };
  }, { moduleURL: route('modules/media-workbench.js'), audioURL: route('modules/audio.js'), activityId, manifest, offset, owner });
  return requests;
}
async function load(page) {
  await page.locator('[data-workbench-load]').click();
  await expect(page.locator('[data-media-workbench]')).toHaveAttribute('data-availability', 'ready', { timeout: 15000 });
  await expect(page.locator('[data-workbench-play]')).toBeVisible();
  await expect(page.locator('[data-workbench-play]')).toBeEnabled();
}
const play = page => page.locator('[data-workbench-play]').click();
const pause = page => page.locator('[data-workbench-pause]').click();

for (const activityId of ['A16', 'A18', 'A19']) {
  test(`${activityId} pending recordings stay explicit and never synthesize a ready workbench`, async ({ page }) => {
    const manifest = readyManifest();
    for (const record of [...manifest.cameras, ...manifest.channels, manifest.excerpt, manifest.reversed]) record.status = 'pending';
    const requests = await harness(page, activityId, { manifest });
    if (await page.locator('[data-workbench-load]:visible:enabled').count()) await page.locator('[data-workbench-load]').click();
    await expect(page.locator('[data-workbench-status]')).toBeVisible();
    await expect(page.locator('[data-workbench-play]:visible:enabled')).toHaveCount(0);
    await expect(page.locator('[data-waveform]')).toHaveCount(0);
    expect(requests).toEqual([]);
    expect(await page.evaluate(() => workbenchHarness.holds())).toEqual([]);
  });
}

test('verified 20-second cameras scrub and switch at the same master time, then clean up their real videos', async ({ page }) => {
  const requests = await harness(page, 'A16');
  expect(requests).toEqual([]);
  await load(page);
  const first = page.locator('[data-workbench-video="0"]');
  await expect.poll(() => first.evaluate(video => video.duration)).toBeCloseTo(20, 1);
  await page.locator('[data-workbench-seek]').fill('47');
  await expect.poll(() => first.evaluate(video => video.currentTime)).toBeCloseTo(7, 1);
  await play(page);
  await expect.poll(() => first.evaluate(video => !video.paused && video.currentTime > 7)).toBe(true);
  expect(await page.evaluate(() => workbenchHarness.holds().length)).toBe(1);
  await page.locator('[data-workbench-camera="1"]').click();
  const second = page.locator('[data-workbench-video="1"]');
  await expect.poll(() => second.evaluate(video => !video.paused)).toBe(true);
  expect(await first.evaluate(video => video.paused)).toBe(true);
  const positions = await page.evaluate(() => [...document.querySelectorAll('[data-workbench-video]')].map(video => video.currentTime));
  expect(Math.abs(positions[1] - positions[0])).toBeLessThan(.75);
  await pause(page);
  expect(await page.evaluate(() => workbenchHarness.holds())).toEqual([]);
  await page.locator('[data-workbench-camera="2"]').click();
  await page.locator('[data-workbench-seek]').fill('55');
  await expect.poll(() => page.locator('[data-workbench-video="2"]').evaluate(video => video.currentTime)).toBeCloseTo(15, 1);
  await page.evaluate(() => { window.detachedVideos = [...document.querySelectorAll('[data-workbench-video]')]; workbenchHarness.destroy(); });
  expect(await page.evaluate(() => detachedVideos.every(video => video.paused))).toBe(true);
  expect(await page.evaluate(() => workbenchHarness.holds())).toEqual([]);
  expect(await page.evaluate(() => __blobCreates.every(url => __blobRevokes.includes(url)))).toBe(true);
  expect(new Set(requests)).toEqual(new Set(['camera-a.mp4', 'camera-b.mp4', 'camera-c.mp4']));
});

test('alignment decodes real PCM, derives waveforms from its samples and applies the user offset to both channels', async ({ page }) => {
  await harness(page, 'A18', { offset: 36 });
  await load(page);
  await expect(page.locator('[data-waveform]')).toHaveCount(2);
  await page.locator('[data-workbench-seek]').fill('48');
  await play(page);
  await expect.poll(() => page.evaluate(() => __mediaStarts.length)).toBeGreaterThanOrEqual(2);
  const starts = await page.evaluate(() => __mediaStarts.slice(-2).map(item => ({ duration: item.buffer.duration, offset: item.args[1] || 0, when: item.args[0] || 0 })));
  expect(starts.find(item => Math.abs(item.duration - 90) < .1)?.offset).toBeCloseTo(48, 1);
  expect(starts.find(item => Math.abs(item.duration - 54) < .1)?.offset).toBeCloseTo(12, 1);
  expect(Math.abs(starts[0].when - starts[1].when)).toBeLessThan(.03);
  const peaks = await page.evaluate(async moduleURL => {
    const { waveformPeaks } = await import(moduleURL);
    const buffer = __mediaStarts.find(item => Math.abs(item.buffer.duration - 90) < .1).buffer;
    const result = waveformPeaks(buffer, 90);
    return { result: Array.from(result), sampleRate: buffer.sampleRate, peak: Math.max(...buffer.getChannelData(0).subarray(48 * buffer.sampleRate, 49 * buffer.sampleRate)) };
  }, route('modules/expansion-media.js'));
  expect(peaks.sampleRate).toBe(48000);
  expect(peaks.result.length).toBe(90);
  expect(peaks.result[48]).toBeGreaterThan(peaks.result[0] * 2);
  expect(peaks.peak).toBeCloseTo(22000 / 32768, 4);
  await pause(page);
  await page.evaluate(() => workbenchHarness.setOffset(0));
  await page.locator('[data-workbench-seek]').fill('48');
  await play(page);
  const changed = await page.evaluate(() => __mediaStarts.slice(-2).map(item => ({ duration: item.buffer.duration, offset: item.args[1] || 0 })));
  expect(changed.find(item => Math.abs(item.duration - 54) < .1)?.offset).toBeCloseTo(48, 1);
  await page.evaluate(() => workbenchHarness.destroy());
  expect(await page.evaluate(() => workbenchHarness.holds())).toEqual([]);
  expect(await page.evaluate(() => workbenchHarness.listeners())).toBe(0);
});

test('reverse restores the supplied buffer and compares the excerpt against its actual position in the original', async ({ page }) => {
  await harness(page, 'A19');
  await load(page);
  await play(page);
  await expect.poll(() => page.evaluate(() => __mediaStarts.length)).toBeGreaterThan(0);
  await pause(page);
  await page.evaluate(() => { window.unrestored = __mediaStarts.at(-1).buffer; });
  await page.locator('[data-workbench-reverse]').click();
  await expect(page.locator('[data-workbench-reverse]')).toHaveAttribute('aria-pressed', 'true');
  await play(page);
  await expect.poll(() => page.evaluate(() => __mediaStarts.at(-1).buffer !== unrestored)).toBe(true);
  const reversal = await page.evaluate(() => {
    const original = unrestored.getChannelData(0); const restored = __mediaStarts.at(-1).buffer.getChannelData(0);
    return { length: restored.length, exact: restored.length === original.length && [0, 1, 103, 4001, original.length - 1].every(i => Math.abs(restored[i] - original[original.length - 1 - i]) < .000001) };
  });
  expect(reversal).toEqual({ length: RATE * 4, exact: true });
  await pause(page);
  await page.locator('[data-workbench-original]').click();
  const original = await page.evaluate(() => {
    const run = __mediaStarts.at(-1); const offset = Math.round((run.args[1] || 0) * run.buffer.sampleRate);
    return [0, 1, 103, 4001].map(index => run.buffer.getChannelData(0)[offset + index]);
  });
  [0, 1, 103, 4001].forEach((sampleIndex, index) => expect(original[index]).toBeCloseTo(excerptSamples[sampleIndex] / 32768, 4));
  await page.locator('[data-workbench-excerpt]').click();
  await expect.poll(() => page.evaluate(() => __mediaStarts.at(-1).buffer.duration)).toBeCloseTo(4, 1);
  await expect(page.locator('[data-workbench-comparison]')).toHaveAttribute('data-excerpt-equal', 'true');
  await expect(page.locator('[data-workbench-comparison]')).toHaveAttribute('data-reverse-equal', 'true');
  await page.evaluate(() => workbenchHarness.destroy());
  expect(await page.evaluate(() => workbenchHarness.holds())).toEqual([]);
});

test('48kHz source comparisons stay exact when the native playback device runs at 44.1kHz', async ({ page }) => {
  await harness(page, 'A19', { outputRate: 44100 });
  await load(page);
  await expect(page.locator('[data-workbench-comparison]')).toHaveAttribute('data-excerpt-equal', 'true');
  await expect(page.locator('[data-workbench-comparison]')).toHaveAttribute('data-reverse-equal', 'true');
  await page.locator('[data-workbench-original]').click();
  await expect.poll(() => page.evaluate(() => __mediaStarts.length)).toBeGreaterThan(0);
  const actual = await page.evaluate(() => ({ sourceRate: __mediaStarts.at(-1).buffer.sampleRate, outputRate: __mediaStarts.at(-1).outputSampleRate, duration: __mediaStarts.at(-1).buffer.duration }));
  expect(actual).toEqual({ sourceRate: 48000, outputRate: 44100, duration: 4 });
  await page.locator('[data-workbench-reverse]').click();
  await expect(page.locator('[data-workbench-comparison]')).toHaveAttribute('data-reverse-equal', 'true');
  await page.evaluate(() => workbenchHarness.destroy());
  expect(await page.evaluate(() => workbenchHarness.holds())).toEqual([]);
});

test('a different excerpt with a valid file hash is not falsely declared the same source slice', async ({ page }) => {
  const manifest = readyManifest();
  manifest.excerpt = record('lab-published-excerpt', 'wrong-excerpt.wav', 4, { sourceId: 'E14', derivedFrom: manifest.channels[0].id, sourceRangeSeconds: [73, 77], sourceSha256: manifest.channels[0].sha256 });
  await harness(page, 'A19', { manifest });
  await load(page);
  await expect(page.locator('[data-workbench-comparison]')).toHaveAttribute('data-excerpt-equal', 'false');
  await expect(page.locator('[data-workbench-comparison]')).toHaveAttribute('data-reverse-equal', 'true');
});

for (const failure of ['digest', 'duration', 'missing']) {
  test(`${failure} failure retains the written fallback without claiming verified playable media`, async ({ page }) => {
    const manifest = readyManifest();
    if (failure === 'digest') manifest.channels[0].sha256 = '0'.repeat(64);
    if (failure === 'duration') manifest.channels[0].durationSeconds = 91;
    await harness(page, 'A18', { manifest, broken: failure === 'missing' ? 'a.wav' : null });
    await page.locator('[data-workbench-load]').click();
    await expect(page.locator('[data-media-workbench]')).toHaveAttribute('data-availability', 'error');
    await expect(page.locator('[data-workbench-status]')).toContainText('البديل المكتوب');
    await expect(page.locator('[data-workbench-play]:visible:enabled')).toHaveCount(0);
    expect(await page.evaluate(() => workbenchHarness.holds())).toEqual([]);
    await page.evaluate(() => workbenchHarness.destroy());
    expect(await page.evaluate(() => __blobCreates.every(url => __blobRevokes.includes(url)))).toBe(true);
  });
}

test('visibility changes during verified loading do not strand partial camera resources or duplicate the next playback', async ({ page }) => {
  await harness(page, 'A16');
  let received;
  const arrived = new Promise(resolve => { received = resolve; });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/__workbench_fixtures__/camera-b.mp4', async request => {
    received(); await gate;
    await request.fulfill({ contentType: 'video/mp4', body: CAMERA });
  });
  await page.locator('[data-workbench-load]').click();
  await arrived;
  await page.evaluate(() => {
    window.fixtureHidden = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => fixtureHidden });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  release();
  await expect(page.locator('[data-media-workbench]')).toHaveAttribute('data-availability', 'ready');
  await expect(page.locator('[data-workbench-video]')).toHaveCount(3);
  expect(await page.evaluate(() => workbenchHarness.holds())).toEqual([]);
  await page.evaluate(() => { fixtureHidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await play(page);
  await expect.poll(() => page.locator('[data-workbench-video="0"]').evaluate(video => !video.paused)).toBe(true);
  await page.evaluate(() => workbenchHarness.destroy());
  expect(await page.evaluate(() => __blobCreates.length)).toBe(3);
  expect(await page.evaluate(() => __blobCreates.every(url => __blobRevokes.includes(url)))).toBe(true);
  expect(await page.evaluate(() => workbenchHarness.holds())).toEqual([]);
});

test('workbench playback coordinates with the real soundtrack owner and never reverses a manual music-off choice', async ({ page }) => {
  await harness(page, 'A18', { offset: 36, owner: true });
  const song = page.locator('#preview-soundtrack');
  await page.locator('[data-audio-toggle]').click();
  await expect.poll(() => song.evaluate(audio => !audio.paused && audio.currentTime > 0)).toBe(true);
  await load(page);
  await play(page);
  await expect.poll(() => song.evaluate(audio => audio.paused)).toBe(true);
  await pause(page);
  await expect.poll(() => song.evaluate(audio => !audio.paused)).toBe(true);
  await page.locator('[data-audio-toggle]').click();
  await expect.poll(() => song.evaluate(audio => audio.paused)).toBe(true);
  await play(page);
  await pause(page);
  expect(await song.evaluate(audio => audio.paused)).toBe(true);
  expect(await page.evaluate(() => workbenchHarness.services.store.get('musicEnabled'))).toBe(false);
  await page.evaluate(() => { workbenchHarness.destroy(); workbenchHarness.services.audio.destroy(); });
});

for (const [activityId, prefix] of [['A16', 15], ['A18', 17], ['A19', 18]]) {
  test(`${activityId} actual integration is keyboard operable at 320px and navigation destroys active media`, async ({ context, page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await seedExpansion(context, prefix);
    await mediaRoutes(page, readyManifest());
    await nativeMediaProbe(page);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await boot(page, 'case-017/');
    await expect(page.locator(`[data-activity-media="${activityId}"]`)).toBeVisible();
    await page.locator('[data-workbench-load]').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('[data-media-workbench]')).toHaveAttribute('data-availability', 'ready', { timeout: 15000 });
    await expect(page.locator('[data-workbench-play]')).toBeVisible();
    await expect(page.locator('[data-workbench-play]')).toBeEnabled();
    const seek = page.locator('[data-workbench-seek]');
    await seek.focus(); await seek.press('Home'); await seek.press('ArrowRight');
    expect(Number(await seek.inputValue())).toBeGreaterThan(activityId === 'A16' ? 40 : 0);
    if (activityId === 'A16') {
      await page.locator('[data-workbench-camera="2"]').focus(); await page.keyboard.press('Enter');
      await expect(page.locator('[data-workbench-camera="2"]')).toHaveAttribute('aria-pressed', 'true');
    } else if (activityId === 'A18') {
      await page.locator('[data-alignment-slider]').fill('36');
      await expect(page.locator('[data-activity-field="alignment"]')).toHaveValue('36');
      await expect(page.locator('.workbench-wave').last()).toContainText('36');
    } else {
      await page.locator('[data-workbench-reverse]').focus(); await page.keyboard.press('Enter');
      await expect(page.locator('[data-workbench-reverse]')).toHaveAttribute('aria-pressed', 'true');
    }
    await expectNoOverflow(page);
    if (process.env.RAVEN_MEDIA_SCREENSHOTS) {
      await mkdir(process.env.RAVEN_MEDIA_SCREENSHOTS, { recursive: true });
      await expect(page.locator('#site-notice')).not.toHaveClass(/visible/, { timeout: 8000 });
      await page.setViewportSize({ width: 320, height: 1400 });
      await page.locator('[data-media-workbench]').evaluate(element => element.scrollIntoView({ block: 'center' }));
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(process.env.RAVEN_MEDIA_SCREENSHOTS, `media-${activityId.toLowerCase()}-320.png`), animations: 'disabled' });
      await page.setViewportSize({ width: 320, height: 844 });
    }
    await play(page);
    if (activityId !== 'A16') await expect.poll(() => page.evaluate(() => __mediaStarts.length)).toBeGreaterThan(0);
    await page.evaluate(() => { window.detachedVideos = [...document.querySelectorAll('[data-workbench-video]')]; });
    await selectCaseTab(page, 'evidence');
    await expect(page.locator('[data-media-workbench]')).toHaveCount(0);
    expect(await page.evaluate(() => detachedVideos.every(video => video.paused))).toBe(true);
    expect(await page.evaluate(() => __mediaStarts.every(run => run.stopped))).toBe(true);
    expect(await page.evaluate(() => __blobCreates.every(url => __blobRevokes.includes(url)))).toBe(true);
    expect(errors).toEqual([]);
  });
}
