/** Deterministic signals and explicitly declared expansion assets. No recording is fabricated. */
export const DTMF_FREQUENCIES = Object.freeze({
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], A: [697, 1633],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477], B: [770, 1633],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], C: [852, 1633],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477], D: [941, 1633],
});

const MORSE = Object.freeze({
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
});
const finite = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;

export function morseSchedule(value = 'MA22', unitMs = 180) {
  const unit = finite(unitMs, 180, 40, 1000);
  const text = String(value).trim().toUpperCase().replace(/[−–]/g, '-');
  const code = /^[.\-\s/]+$/.test(text) ? text : [...text].map(c => c === ' ' ? '/' : MORSE[c] || '').filter(Boolean).join(' ');
  const groups = code.replaceAll('/', ' / ').trim().split(/\s+/).filter(Boolean);
  const segments = [];
  let at = 0;
  groups.forEach((group, groupIndex) => {
    if (group === '/') { at += unit * 4; return; }
    [...group].filter(c => c === '.' || c === '-').forEach((symbol, index, list) => {
      const duration = unit * (symbol === '-' ? 3 : 1);
      segments.push({ at, duration, index: segments.length, group: groupIndex, symbol, frequencies: [620] });
      at += duration + (index < list.length - 1 ? unit : 0);
    });
    if (groupIndex < groups.length - 1) at += unit * 3;
  });
  return { segments, durationMs: at, code };
}

export function dtmfSchedule(value = '5862', toneMs = 450, gapMs = 180) {
  const duration = finite(toneMs, 450, 60, 2000);
  const gap = finite(gapMs, 180, 30, 1500);
  const inputs = Array.isArray(value) ? value : [...String(value).trim().toUpperCase()].filter(c => !/\s/.test(c));
  const validPairs = Object.values(DTMF_FREQUENCIES);
  const segments = inputs.map((item, index) => {
    const pair = Array.isArray(item) ? item.map(Number) : DTMF_FREQUENCIES[item];
    if (!pair || !validPairs.some(valid => valid[0] === pair[0] && valid[1] === pair[1])) throw new TypeError('Unsupported DTMF signal');
    return { at: index * (duration + gap), duration, index, frequencies: [...pair], ...(Array.isArray(item) ? {} : { digit: item }) };
  });
  return { segments, durationMs: segments.length ? segments.at(-1).at + duration : 0 };
}

/** This pending fallback is not a claim that playable media exists. */
export const MEDIA_MANIFEST = Object.freeze({
  version: 1,
  call: { id: 'ma22-call', status: 'pending', url: null, mime: 'audio/wav', sourceId: 'E03', provenance: 'تمثيل مكتوب مستند إلى MA-22؛ ليس تسجيلًا أصليًا للواقعة.', durationSeconds: null },
  cameras: ['intake', 'scanner', 'review'].map((name, index) => ({ id: `lab-camera-${name}`, status: 'pending', url: null, mime: 'video/mp4', sourceId: 'E12', durationSeconds: 20, masterStartSeconds: 40, clockOffsetSeconds: index === 1 ? 420 : 0 })),
  channels: [
    { id: 'lab-channel-a', status: 'pending', url: null, mime: 'audio/wav', sourceId: 'E13', durationSeconds: 90, masterStartSeconds: 0, calibrationSeconds: 48 },
    { id: 'lab-channel-b', status: 'pending', url: null, mime: 'audio/wav', sourceId: 'E13', durationSeconds: 54, masterStartSeconds: 36, calibrationSeconds: 12 },
  ],
  excerpt: { id: 'lab-published-excerpt', status: 'pending', url: null, mime: 'audio/wav', sourceId: 'E14', derivedFrom: 'lab-channel-a', sourceRangeSeconds: null },
  reversed: { id: 'lab-reversed-excerpt', status: 'pending', url: null, mime: 'audio/wav', sourceId: 'E13', derivedFrom: 'lab-channel-a', sourceRangeSeconds: null },
});

const manifestURL = new URL('../assets/expansion-media-manifest.json', import.meta.url);
let manifestPromise;
export async function loadMediaManifest({ reload = false } = {}) {
  if (reload) manifestPromise = null;
  manifestPromise ||= fetch(manifestURL).then(response => {
    if (!response.ok) throw new Error('Media manifest unavailable');
    return response.json();
  }).then(value => value && value.version === 1 && typeof value.call === 'object' ? value : MEDIA_MANIFEST).catch(() => MEDIA_MANIFEST);
  return manifestPromise;
}

export function mediaURL(record) {
  if (!record || record.status !== 'ready' || typeof record.url !== 'string' || !record.url.trim()) return null;
  try {
    const url = new URL(record.url, manifestURL);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** Fetch the declared bytes, not an unchecked remote media URL. */
export async function loadVerifiedMedia(record, { signal, kind = 'audio', maxBytes = 64 * 1024 * 1024 } = {}) {
  const url = mediaURL(record);
  if (!url || !String(record.mime).startsWith(`${kind}/`) || !/^[a-f\d]{64}$/i.test(record.sha256 || '')
    || !Number.isSafeInteger(record.bytes) || record.bytes < 1 || record.bytes > maxBytes
    || !Number.isFinite(record.durationSeconds) || record.durationSeconds <= 0) throw new Error('بيانات الأصل غير مكتملة؛ يلزم ملف معتمد بحجمه وبصمته ومدته.');
  const response = await fetch(url, { signal, credentials: 'same-origin' });
  if (!response.ok) throw new Error('تعذّر تنزيل أصل الوسائط.');
  const length = Number(response.headers.get('content-length'));
  if (length > maxBytes) throw new Error('حجم الأصل أكبر من الحد المسموح.');
  const bytes = await response.arrayBuffer();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (bytes.byteLength !== record.bytes || bytes.byteLength > maxBytes) throw new Error('حجم الملف لا يطابق بيان الأصل.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  if (sha256 !== record.sha256.toLowerCase()) throw new Error('بصمة الملف لا تطابق الأصل المعتمد؛ أوقف تحميله.');
  return { bytes, blob: new Blob([bytes], { type: record.mime }), url, sha256 };
}

/** Peaks are calculated only from decoded PCM samples. */
export function waveformPeaks(buffer, bins = 240) {
  const count = Math.max(1, Math.min(buffer.length, Math.floor(bins) || 240));
  const peaks = new Float32Array(count);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let bin = 0; bin < count; bin++) {
      const start = Math.floor(bin * buffer.length / count);
      const end = Math.floor((bin + 1) * buffer.length / count);
      for (let index = start; index < end; index++) peaks[bin] = Math.max(peaks[bin], Math.abs(samples[index]));
    }
  }
  return peaks;
}

export function reverseAudioBuffer(context, buffer) {
  const reversed = context.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const source = buffer.getChannelData(channel), target = reversed.getChannelData(channel);
    for (let index = 0; index < source.length; index++) target[index] = source[source.length - index - 1];
  }
  return reversed;
}

export function sliceAudioBuffer(context, buffer, start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > buffer.duration + 1 / buffer.sampleRate) throw new Error('مدى المقتطف خارج الأصل.');
  const first = Math.round(start * buffer.sampleRate), last = Math.min(buffer.length, Math.round(end * buffer.sampleRate));
  const result = context.createBuffer(buffer.numberOfChannels, last - first, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) result.copyToChannel(buffer.getChannelData(channel).subarray(first, last), channel);
  return result;
}

/** A PCM comparison is not a claim that independently encoded files have equal bytes. */
export function compareAudioBuffers(left, right) {
  if (left.sampleRate !== right.sampleRate || left.numberOfChannels !== right.numberOfChannels || left.length !== right.length) return { comparable: false, equal: false, maxDifference: null };
  let maxDifference = 0;
  for (let channel = 0; channel < left.numberOfChannels; channel++) {
    const a = left.getChannelData(channel), b = right.getChannelData(channel);
    for (let index = 0; index < a.length; index++) maxDifference = Math.max(maxDifference, Math.abs(a[index] - b[index]));
  }
  return { comparable: true, equal: maxDifference <= 1e-6, maxDifference };
}

/**
 * Call play methods directly from a trusted button with data-media-start.
 * Promise resolves true only after audible completion. Signals never solve activities.
 */
export function createSignalPlayer(services = {}) {
  const token = `expansion-signal-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  let context;
  let active;
  let destroyed = false;
  let held = false;
  const abort = new AbortController();
  const release = () => { if (held) services.audio?.release?.(token); held = false; };
  function invoke(callback, value) { try { callback?.(value); } catch (error) { console.error('Signal display callback failed', error); } }
  function finish(run, completed, reason) {
    if (!run || run.finished) return;
    run.finished = true;
    run.timers.forEach(clearTimeout);
    run.timers.clear();
    for (const node of run.nodes) {
      try { node.oscillator.stop(); } catch { /* Scheduled node may already have ended. */ }
      try { node.oscillator.disconnect(); node.gain.disconnect(); } catch { /* Already disconnected. */ }
    }
    run.nodes.length = 0;
    if (run.current) invoke(run.callback, { ...run.current, on: false, audible: run.audible });
    if (active === run) { active = null; release(); }
    invoke(run.options.onEnd, { completed, audible: run.audible, reason });
    run.resolve(Boolean(completed && run.audible));
  }
  function stop() { finish(active, false, 'stopped'); }
  function play(schedule, options = {}, kind) {
    stop();
    if (destroyed || !schedule.segments.length) return Promise.resolve(false);
    let resolve;
    const result = new Promise(done => { resolve = done; });
    const run = { options, resolve, callback: kind === 'morse' ? options.onPulse : options.onTone, nodes: [], timers: new Set(), audible: false, finished: false, current: null };
    active = run;
    if (!options.visualOnly) { services.audio?.hold?.(token); held = true; }
    void (async () => {
      let reason = options.visualOnly ? 'visual-only' : 'audio-unavailable';
      try {
        const Constructor = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!options.visualOnly && Constructor) {
          context ||= new Constructor();
          await context.resume();
          run.audible = context.state === 'running';
        }
      } catch { run.audible = false; }
      if (destroyed || active !== run || run.finished || globalThis.document?.hidden) { finish(run, false, 'stopped'); return; }
      if (run.audible) {
        try {
          const startsAt = context.currentTime + .035;
          for (const segment of schedule.segments) {
            for (const frequency of segment.frequencies) {
              const oscillator = context.createOscillator();
              const gain = context.createGain();
              const start = startsAt + segment.at / 1000;
              const end = start + segment.duration / 1000;
              oscillator.type = 'sine'; oscillator.frequency.value = frequency;
              gain.gain.setValueAtTime(0, start);
              gain.gain.linearRampToValueAtTime(.06 / segment.frequencies.length, start + .008);
              gain.gain.setValueAtTime(.06 / segment.frequencies.length, end - .008);
              gain.gain.linearRampToValueAtTime(0, end);
              oscillator.connect(gain); gain.connect(context.destination);
              run.nodes.push({ oscillator, gain });
              oscillator.start(start); oscillator.stop(end + .01);
            }
          }
          reason = 'playing';
        } catch {
          run.audible = false;
          for (const node of run.nodes) { try { node.oscillator.stop(); node.oscillator.disconnect(); node.gain.disconnect(); } catch { /* Partial setup. */ } }
          run.nodes.length = 0;
        }
      }
      if (!run.audible) release();
      invoke(options.onStatus, { audible: run.audible, reason });
      const offset = run.audible ? 35 : 0;
      const later = (callback, ms) => { const id = setTimeout(() => { run.timers.delete(id); if (active === run && !run.finished) callback(); }, ms); run.timers.add(id); };
      for (const segment of schedule.segments) {
        later(() => { run.current = segment; invoke(run.callback, { ...segment, on: true, audible: run.audible }); }, segment.at + offset);
        later(() => { run.current = null; invoke(run.callback, { ...segment, on: false, audible: run.audible }); }, segment.at + segment.duration + offset);
      }
      later(() => finish(run, true, run.audible ? 'ended' : reason), schedule.durationMs + offset + 20);
    })();
    return result;
  }
  globalThis.document?.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }, { signal: abort.signal });
  return {
    playMorse: (value = 'MA22', options = {}) => play(morseSchedule(value, options.unitMs), options, 'morse'),
    playDTMF: (value = '5862', options = {}) => play(dtmfSchedule(value, options.toneMs, options.gapMs), options, 'dtmf'),
    stop,
    destroy() { if (destroyed) return; destroyed = true; stop(); abort.abort(); context?.close?.().catch(() => {}); },
  };
}
