import { test, expect, route } from './helpers.mjs';

function pcmWav(seconds = 2) {
  const rate = 8000;
  const data = Buffer.alloc(44 + rate * seconds * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(data.length - 44, 40);
  return data;
}

async function harness(page, { ready = false, eligible = false } = {}) {
  const source = route('fixtures/call.wav');
  if (ready) await page.route('**/fixtures/call.wav', request => request.fulfill({ contentType: 'audio/wav', body: pcmWav() }));
  await page.route('**/__call-harness__', request => request.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ar" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${route('modules/case.css')}"><link rel="stylesheet" href="${route('modules/incoming-call.css')}"><style>body{margin:0;padding:14px;background:#101610;color:#eee;font-family:Arial,sans-serif}#host{max-width:900px;margin:auto}</style><body><main id="host"></main><dialog id="other"><button id="other-close">أغلق الوثيقة</button></dialog></body></html>` }));
  await page.goto(route('__call-harness__'));
  await page.evaluate(async ({ moduleURL, ready, source, eligible }) => {
    const module = await import(moduleURL);
    let state = { solvedIds: eligible ? ['Q01', 'Q02'] : [], viewedIds: eligible ? ['E03'] : [], call: module.normalizeCall() };
    const listeners = new Set();
    const holds = new Set();
    const notices = [];
    const services = {
      caseStore: {
        get: () => structuredClone(state),
        update: mutator => { const draft = structuredClone(state); mutator(draft); state = draft; for (const listener of listeners) listener(structuredClone(state)); },
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      },
      investigation: { getAccess: () => ({ allowed: true }) },
      audio: { hold: token => holds.add(token), release: token => holds.delete(token) },
      notify: message => notices.push(message),
      expansionMedia: { call: { id: 'test-call', status: ready ? 'ready' : 'pending', url: ready ? source : null } },
    };
    let cleanup = module.mountIncomingCall(document.querySelector('#host'), services);
    window.callHarness = {
      get: () => structuredClone(state), set: patch => services.caseStore.update(s => Object.assign(s, patch)),
      holds: () => [...holds], notices, services,
      destroy: () => cleanup(), remount: () => { cleanup(); cleanup = module.mountIncomingCall(document.querySelector('#host'), services); },
    };
    document.querySelector('#other-close').onclick = () => document.querySelector('#other').close();
  }, { moduleURL: route('modules/incoming-call.js'), ready, source, eligible });
}

test('optional call waits for Q02, viewed E03 and an idle reader; missing audio stays honest', async ({ page }) => {
  await harness(page);
  await expect(page.locator('[data-incoming-call]')).toBeHidden();
  await page.evaluate(() => callHarness.set({ solvedIds: ['Q01', 'Q02'] }));
  await expect(page.locator('[data-incoming-call]')).toBeHidden();
  await page.evaluate(() => { document.querySelector('#other').showModal(); callHarness.set({ viewedIds: ['E03'] }); });
  await expect(page.locator('[data-incoming-call]')).toBeHidden();
  expect(await page.evaluate(() => callHarness.get().call.delivery)).toBe('unseen');
  await page.locator('#other-close').click();
  await expect(page.locator('[data-incoming-call]')).toBeVisible();
  expect(await page.evaluate(() => callHarness.get().call.delivery)).toBe('pending');
  await page.locator('[data-call-open]').click();
  await expect(page.locator('[data-call-dialog]')).toBeVisible();
  await expect(page.locator('.call-status')).toContainText('التسجيل الصوتي لم يُضف');
  await expect(page.locator('[data-call-play]')).toBeHidden();
  await expect(page.locator('[data-call-transcript]')).toContainText('لوسيان مكلّف يشيله ويسلّم قطعه');
  await expect(page.locator('[data-call-transcript]')).toContainText('الاستبدال يتأجل');
  expect(await page.locator('[data-call-audio]').getAttribute('src')).toBeNull();
  expect(await page.evaluate(() => callHarness.get().call.delivery)).toBe('read');
  expect(await page.evaluate(() => callHarness.get().call.listenedAt)).toBeNull();
  expect(await page.evaluate(() => callHarness.get().solvedIds)).toEqual(['Q01', 'Q02']);
});

test('defer survives remount; reset clears optional scene without re-prompting early', async ({ page }) => {
  await harness(page, { eligible: true });
  await page.locator('[data-call-defer]').click();
  const noticeCount = await page.evaluate(() => callHarness.notices.length);
  await page.evaluate(() => callHarness.remount());
  await expect(page.locator('[data-incoming-call]')).toHaveAttribute('data-delivery', 'deferred');
  await expect(page.locator('[data-call-defer]')).toBeHidden();
  expect(await page.evaluate(() => callHarness.notices.length)).toBe(noticeCount);
  await page.evaluate(() => callHarness.set({ solvedIds: [], viewedIds: [], call: {} }));
  await expect(page.locator('[data-incoming-call]')).toBeHidden();
  expect(await page.evaluate(() => callHarness.holds())).toEqual([]);
});

test('real decodable call acquires music hold, pauses on close, and only ended marks listened', async ({ page }) => {
  await harness(page, { eligible: true, ready: true });
  await page.locator('[data-call-open]').click();
  await page.locator('[data-call-play]').click();
  await expect.poll(() => page.locator('[data-call-audio]').evaluate(audio => !audio.paused && audio.currentTime > 0)).toBe(true);
  expect(await page.evaluate(() => callHarness.holds().length)).toBe(1);
  await page.getByRole('button', { name: 'إغلاق مشهد الاتصال' }).click();
  await expect.poll(() => page.locator('[data-call-audio]').evaluate(audio => audio.paused)).toBe(true);
  expect(await page.evaluate(() => callHarness.holds())).toEqual([]);
  expect(await page.evaluate(() => callHarness.get().call.delivery)).toBe('read');
  expect(await page.evaluate(() => callHarness.get().call.position)).toBeGreaterThan(0);
  await page.locator('[data-call-open]').click();
  await page.locator('[data-call-play]').click();
  await expect.poll(() => page.evaluate(() => callHarness.get().call.delivery)).toBe('listened');
  expect(await page.evaluate(() => callHarness.holds())).toEqual([]);
  await page.locator('[data-call-play]').click();
  await expect.poll(() => page.locator('[data-call-audio]').evaluate(audio => !audio.paused && audio.currentTime < 1)).toBe(true);
  await page.evaluate(() => callHarness.destroy());
  expect(await page.evaluate(() => callHarness.holds())).toEqual([]);
  await expect(page.locator('[data-call-dialog]')).toHaveCount(0);
});

test('rejected or stale call playback releases its hold without completing the scene', async ({ page }) => {
  await harness(page, { eligible: true, ready: true });
  await page.locator('[data-call-open]').click();
  await page.evaluate(() => { HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('Denied', 'NotAllowedError')); });
  await page.locator('[data-call-play]').click();
  await expect(page.locator('.call-status')).toContainText('لم يسمح المتصفح');
  expect(await page.evaluate(() => callHarness.holds())).toEqual([]);
  await page.evaluate(() => { HTMLMediaElement.prototype.play = () => new Promise(resolve => { window.finishStalePlay = resolve; }); });
  await page.locator('[data-call-play]').click();
  expect(await page.evaluate(() => callHarness.holds().length)).toBe(1);
  await page.evaluate(() => { callHarness.destroy(); finishStalePlay(); });
  expect(await page.evaluate(() => callHarness.holds())).toEqual([]);
  expect(await page.evaluate(() => callHarness.get().call.delivery)).toBe('read');
});

test('320px transcript supports keyboard close and focus return without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await harness(page, { eligible: true });
  await page.locator('[data-call-open]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.call-dialog-head h2')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.locator('[data-call-dialog]').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-call-dialog]')).toBeHidden();
  await expect(page.locator('[data-call-open]')).toBeFocused();
});

test('Morse/DTMF schedules carry exact signal timing and real frequency pairs', async ({ page }) => {
  await harness(page);
  const schedules = await page.evaluate(async moduleURL => {
    const { morseSchedule, dtmfSchedule, mediaURL } = await import(moduleURL);
    return { morse: morseSchedule('MA22', 100), dtmf: dtmfSchedule('5862', 100, 50), pending: mediaURL({ status: 'pending', url: 'made-up.wav' }), invalid: mediaURL({ status: 'ready', url: 'javascript:alert(1)' }) };
  }, route('modules/expansion-media.js'));
  expect(schedules.morse.code).toBe('-- .- ..--- ..---');
  expect(schedules.morse.segments[0]).toMatchObject({ symbol: '-', at: 0, duration: 300 });
  expect(schedules.morse.segments[1]).toMatchObject({ symbol: '-', at: 400, duration: 300 });
  expect(schedules.dtmf.segments.map(item => item.frequencies)).toEqual([[770, 1336], [852, 1336], [770, 1477], [697, 1336]]);
  expect(schedules.dtmf.durationMs).toBe(550);
  expect(schedules.pending).toBeNull(); expect(schedules.invalid).toBeNull();
});

test('signal player runs actual Web Audio and releases on completion or destroy', async ({ page }) => {
  await harness(page);
  await page.evaluate(async moduleURL => {
    const { createSignalPlayer } = await import(moduleURL);
    window.signalPlayer = createSignalPlayer(callHarness.services);
    window.signalStatus = null; window.signalEnd = null; window.signalResult = null;
    const button = document.createElement('button'); button.id = 'play-signal'; button.textContent = 'تشغيل'; button.dataset.mediaStart = '';
    button.onclick = async () => { window.signalResult = await signalPlayer.playDTMF('5', { toneMs: 100, onStatus: v => window.signalStatus = v, onEnd: v => window.signalEnd = v }); };
    document.body.append(button);
  }, route('modules/expansion-media.js'));
  await page.locator('#play-signal').click();
  await expect.poll(() => page.evaluate(() => signalResult)).toBe(true);
  expect(await page.evaluate(() => signalStatus.audible)).toBe(true);
  expect(await page.evaluate(() => signalEnd)).toMatchObject({ audible: true, completed: true, reason: 'ended' });
  expect(await page.evaluate(() => callHarness.holds())).toEqual([]);
  await page.evaluate(() => { window.stoppedResult = signalPlayer.playMorse('MA22'); signalPlayer.destroy(); });
  expect(await page.evaluate(async () => await stoppedResult)).toBe(false);
  expect(await page.evaluate(() => callHarness.holds())).toEqual([]);
});

test('unavailable audio produces explicit visual callbacks without a fake audible result', async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(async moduleURL => {
    window.AudioContext = undefined; window.webkitAudioContext = undefined;
    const { createSignalPlayer } = await import(moduleURL);
    const player = createSignalPlayer(callHarness.services);
    const pulses = []; let end; let status;
    const audible = await player.playMorse('E', { unitMs: 40, onPulse: value => pulses.push(value), onStatus: value => status = value, onEnd: value => end = value });
    player.destroy();
    return { audible, pulses, end, status, holds: callHarness.holds() };
  }, route('modules/expansion-media.js'));
  expect(result.audible).toBe(false);
  expect(result.status.audible).toBe(false);
  expect(result.pulses.map(value => value.on)).toEqual([true, false]);
  expect(result.end).toMatchObject({ completed: true, audible: false });
  expect(result.holds).toEqual([]);
});

test('call coordinates with the existing soundtrack owner and preserves explicit music off', async ({ page }) => {
  await page.route('**/*raven-baqi-athar*.mp3*', request => request.fulfill({ contentType: 'audio/wav', body: pcmWav(4) }));
  await harness(page, { eligible: true, ready: true });
  await page.evaluate(async moduleURL => {
    const { createAudio } = await import(moduleURL);
    const memory = new Map();
    callHarness.services.store = { get: (key, fallback) => memory.has(key) ? memory.get(key) : fallback, set: (key, value) => memory.set(key, value) };
    callHarness.services.t = ar => ar;
    const dock = document.createElement('div'); document.body.append(dock);
    callHarness.services.audio = createAudio(dock, callHarness.services);
  }, route('modules/audio.js'));
  const song = page.locator('#preview-soundtrack');
  await page.locator('[data-audio-toggle]').click();
  await expect.poll(() => song.evaluate(audio => !audio.paused && audio.currentTime > 0)).toBe(true);
  await page.locator('[data-call-open]').click();
  await page.locator('[data-call-play]').click();
  await expect.poll(() => song.evaluate(audio => audio.paused)).toBe(true);
  await page.getByRole('button', { name: 'إغلاق مشهد الاتصال' }).click();
  await expect.poll(() => song.evaluate(audio => !audio.paused)).toBe(true);
  await page.locator('[data-audio-toggle]').click();
  await expect.poll(() => song.evaluate(audio => audio.paused)).toBe(true);
  await page.locator('[data-call-open]').click();
  await page.locator('[data-call-play]').click();
  await expect.poll(() => page.evaluate(() => callHarness.get().call.delivery)).toBe('listened');
  expect(await song.evaluate(audio => audio.paused)).toBe(true);
  expect(await page.evaluate(() => callHarness.services.store.get('musicEnabled'))).toBe(false);
  await page.evaluate(() => { callHarness.destroy(); callHarness.services.audio.destroy(); });
});
