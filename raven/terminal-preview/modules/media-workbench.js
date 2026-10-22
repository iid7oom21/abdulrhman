import { el } from './core.js';
import { loadMediaManifest, mediaURL, loadVerifiedMedia, waveformPeaks, reverseAudioBuffer, sliceAudioBuffer, compareAudioBuffers } from './expansion-media.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const time = value => { const seconds = Math.max(0, Number(value) || 0); return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${Math.floor(seconds % 1 * 10)}`; };
const button = (label, action, attrs = {}) => el('button', { type: 'button', class: 'case-button', text: label, onClick: action, ...attrs });

/** Optional real-media tools. These never submit answers or manufacture investigation progress. */
export function mountMediaWorkbench(root, services, options = {}) {
  const { activityId, onAvailability = () => {}, getOffset = () => 0, subscribeOffset } = options;
  if (!['A16', 'A18', 'A19'].includes(activityId)) return () => {};
  const lifetime = new AbortController();
  const token = `workbench-${crypto.randomUUID()}`;
  let destroyed = false, loaded = false, loading = false, held = false, playing = false;
  let generation = 0, frame = null, context = null, decoder = null, manifest, records = [], assets = [], videos = [];
  let position = activityId === 'A16' ? 40 : 0, minimum = position, maximum = position + 1;
  let anchor = 0, startingPosition = 0, selectedCamera = 0, restored = false, mode = 'reverse';
  let nodes = [], urls = [], originalExcerpt, restoredBuffer, comparison;
  const section = el('section', { class: 'media-workbench', 'data-media-workbench': activityId, 'aria-label': 'فحص الوسائط الأصلية' });
  const status = el('p', { class: 'workbench-status', 'data-workbench-status': '', role: 'status', 'aria-live': 'polite', text: 'جارٍ قراءة بيان الوسائط…' });
  const load = button('حمّل المادة للفحص', prepare, { 'data-workbench-load': '', hidden: true, disabled: true });
  const display = el('div', { class: 'workbench-display' });
  const controls = el('div', { class: 'workbench-controls', hidden: true });
  const play = button('تشغيل', start, { 'data-workbench-play': '', 'data-media-start': '', disabled: true });
  const pause = button('إيقاف مؤقت', () => stop(), { 'data-workbench-pause': '', disabled: true });
  const output = el('output', { dir: 'ltr', 'data-workbench-time': '' });
  const seek = el('input', { type: 'range', min: minimum, max: maximum, step: .05, value: position, 'aria-label': 'موضع الوسائط على خط الزمن', 'data-workbench-seek': '' });
  const seekLabel = el('label', { class: 'workbench-seek-label' }, [el('span', { text: activityId === 'A16' ? 'زمن جلسة المراجعة' : 'موضع الاستماع' }), seek, output]);
  const extras = el('div', { class: 'workbench-extra-controls' });
  const comparisonText = el('p', { class: 'workbench-comparison', 'data-workbench-comparison': '', hidden: true });
  controls.append(el('div', { class: 'workbench-buttons' }, [play, pause]), extras, seekLabel);
  section.append(status, load, display, controls, comparisonText);
  root.append(section);

  function availability(state) { if (!destroyed) { section.dataset.availability = state; onAvailability({ state }); } }
  function release() { if (held) { held = false; services.audio?.release?.(token); } }
  function hold() { if (!held) { held = true; services.audio?.hold?.(token); } }
  function currentPosition() {
    if (!playing) return position;
    return activityId === 'A16' ? (videos[selectedCamera]?.currentTime || 0) + minimum : startingPosition + context.currentTime - anchor;
  }
  function updatePosition() {
    seek.min = String(minimum); seek.max = String(maximum); seek.value = String(clamp(position, minimum, maximum));
    seek.setAttribute('aria-valuetext', time(position));
    output.textContent = `${time(position)} / ${time(maximum)}`;
    play.setAttribute('aria-pressed', String(playing));
    pause.disabled = !playing;
  }
  function stop({ preserve = true, quiet = false } = {}) {
    if (playing && preserve) position = clamp(currentPosition(), minimum, maximum);
    generation++; playing = false;
    cancelAnimationFrame(frame); frame = null;
    for (const node of nodes) { try { node.source.stop(); } catch {} node.source.disconnect(); node.gain.disconnect(); }
    nodes = [];
    for (const video of videos) video.pause();
    release(); updatePosition();
    if (loaded && !quiet && !destroyed) status.textContent = 'توقف التشغيل. موضع الفحص محفوظ داخل هذه المهمة.';
  }
  function tick() {
    if (destroyed || !playing) return;
    position = clamp(currentPosition(), minimum, maximum); updatePosition();
    if (position >= maximum - .015) { stop({ preserve: false, quiet: true }); position = maximum; updatePosition(); status.textContent = 'انتهى التشغيل. يمكنك إعادة الفحص؛ لم يُرسل استنتاج تلقائي.'; return; }
    frame = requestAnimationFrame(tick);
  }
  function getContext() {
    if (!context) {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) throw new Error('فك الصوت غير متاح في هذا المتصفح؛ استخدم التفريغ المكتوب.');
      context = new AudioContext();
    }
    return context;
  }
  function getDecoder() {
    if (!decoder) {
      const OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
      if (!OfflineContext) throw new Error('فك الصوت الموثّق غير متاح هنا؛ استخدم التفريغ المكتوب.');
      // Production masters are 48 kHz PCM. Keep their samples independent of a
      // device's 44.1 kHz output, whose resampling would alter slice boundaries
      // and make an exact reversed derivative falsely appear different.
      decoder = new OfflineContext(2, 1, 48000);
    }
    return decoder;
  }
  function tracks() {
    if (activityId === 'A18') return [{ buffer: assets[0].buffer, offset: 0 }, { buffer: assets[1].buffer, offset: clamp(getOffset(), 0, 90) }];
    return [{ buffer: mode === 'original' ? originalExcerpt : mode === 'excerpt' ? assets[1].buffer : restored ? restoredBuffer : assets[2].buffer, offset: 0 }];
  }
  function audioBounds() {
    minimum = 0;
    maximum = Math.max(...tracks().map(track => track.offset + track.buffer.duration));
    position = clamp(position, minimum, maximum); updatePosition();
  }
  async function start() {
    if (!loaded || destroyed || loading) return;
    stop({ quiet: true });
    if (position >= maximum - .02) position = minimum;
    hold(); // Reserve the existing soundtrack synchronously in the trusted gesture.
    const attempt = generation;
    try {
      if (activityId === 'A16') {
        const video = videos[selectedCamera];
        video.currentTime = position - minimum;
        const promise = video.play();
        playing = true;
        await promise;
      } else {
        const audio = getContext();
        await audio.resume();
        if (destroyed || attempt !== generation) return;
        if (audio.state !== 'running') throw new Error('لم يسمح المتصفح بالصوت؛ اضغط تشغيل مرة أخرى.');
        anchor = audio.currentTime + .03; startingPosition = position;
        const selectedTracks = tracks();
        for (const track of selectedTracks) {
          const local = Math.max(0, position - track.offset);
          if (local >= track.buffer.duration) continue;
          const source = audio.createBufferSource(), gain = audio.createGain();
          source.buffer = track.buffer; gain.gain.value = selectedTracks.length > 1 ? .5 : 1;
          source.connect(gain); gain.connect(audio.destination); nodes.push({ source, gain });
          source.start(anchor + Math.max(0, track.offset - position), local);
        }
        playing = true;
      }
      if (destroyed || attempt !== generation) { if (destroyed) stop({ quiet: true }); return; }
      status.textContent = activityId === 'A18' ? `تعمل القناتان بإزاحة B التي اخترتها: ${clamp(getOffset(), 0, 90)} ثانية.` : 'تشغيل الأصل الذي جرى التحقق منه.';
      updatePosition(); frame = requestAnimationFrame(tick);
    } catch (error) {
      if (destroyed || attempt !== generation) return;
      stop({ quiet: true }); status.textContent = `${error.message || 'تعذّر التشغيل.'} البديل المكتوب متاح.`;
    }
  }
  function clearAssets() {
    for (const video of videos) { video.pause(); video.removeAttribute('src'); video.load(); }
    videos = []; assets = [];
    for (const url of urls) URL.revokeObjectURL(url);
    urls = []; display.replaceChildren(); extras.replaceChildren();
  }
  async function videoMetadata(record, verified) {
    const video = el('video', { muted: true, playsinline: true, preload: 'metadata', 'aria-label': record.id });
    video.muted = true; video.playsInline = true;
    const url = URL.createObjectURL(verified.blob); urls.push(url); videos.push(video);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('تعذّر قراءة مدة الفيديو.')), 15000);
      const finish = error => { clearTimeout(timer); video.removeEventListener('loadedmetadata', ready); video.removeEventListener('error', fail); lifetime.signal.removeEventListener('abort', abort); error ? reject(error) : resolve(); };
      const ready = () => finish();
      const fail = () => finish(new Error('ملف الفيديو غير قابل لفك الترميز.'));
      const abort = () => finish(new DOMException('Aborted', 'AbortError'));
      video.addEventListener('loadedmetadata', ready); video.addEventListener('error', fail); lifetime.signal.addEventListener('abort', abort, { once: true });
      video.src = url;
    });
    if (!Number.isFinite(video.duration) || Math.abs(video.duration - record.durationSeconds) > .25) throw new Error('مدة الفيديو لا تطابق بيان الأصل.');
    return video;
  }
  async function prepare() {
    if (loading || loaded || destroyed) return;
    loading = true; load.disabled = true; status.textContent = 'تنزيل الأصول والتحقق من البصمات وفك الوسائط…';
    try {
      if (activityId === 'A18' && (records[0]?.id !== 'lab-channel-a' || records[1]?.id !== 'lab-channel-b'
        || records[0].masterStartSeconds !== 0 || records[1].masterStartSeconds !== 36
        || Math.abs(records[0].durationSeconds - 90) > .05 || Math.abs(records[1].durationSeconds - 54) > .05)) throw new Error('بيان القناتين لا يطابق جلسة المراجعة المعتمدة.');
      const results = await Promise.all(records.map(record => loadVerifiedMedia(record, { signal: lifetime.signal, kind: activityId === 'A16' ? 'video' : 'audio' })));
      if (destroyed) return;
      if (activityId === 'A16') {
        const startTimes = records.map(record => Number(record.masterStartSeconds));
        if (startTimes.some(value => !Number.isFinite(value) || value !== 40) || records.some(record => Math.abs(record.durationSeconds - 20) > .25)) throw new Error('الكاميرات يجب أن تغطي نافذة الجلسة المشتركة 00:40–01:00.');
        // Sequential insertion preserves the camera index even when metadata loads at different speeds.
        for (let index = 0; index < records.length; index++) {
          await videoMetadata(records[index], results[index]);
          if (destroyed) return;
        }
        minimum = 40; maximum = 60; position = minimum;
        renderCameras();
      } else {
        const sourceDecoder = getDecoder();
        const buffers = await Promise.all(results.map(result => sourceDecoder.decodeAudioData(result.bytes.slice(0))));
        if (destroyed) return;
        buffers.forEach((buffer, index) => { if (Math.abs(buffer.duration - records[index].durationSeconds) > .05) throw new Error('مدة التسجيل المفكوك لا تطابق البيان.'); });
        assets = buffers.map((buffer, index) => ({ buffer, record: records[index], verified: results[index] }));
        if (activityId === 'A19') prepareComparison(sourceDecoder);
        audioBounds(); renderAudio();
      }
      loaded = true; controls.hidden = false; load.hidden = true; play.disabled = false;
      status.textContent = 'اكتمل التحقق من الملفات. المادة جاهزة للتشغيل.';
      availability('ready'); updatePosition();
    } catch (error) {
      if (destroyed) return;
      clearAssets(); controls.hidden = true; comparisonText.hidden = true;
      status.textContent = `${error.message || 'تعذّر التحقق من الأصول.'} استخدم البديل المكتوب أو أعد المحاولة.`;
      availability('error');
    } finally { loading = false; if (!destroyed) load.disabled = false; }
  }
  function renderCameras() {
    const labels = ['كاميرا الاستلام', 'كاميرا المسح', 'كاميرا المراجعة'];
    videos.forEach((video, index) => {
      video.dataset.workbenchVideo = String(index); video.hidden = index !== selectedCamera;
      video.addEventListener('ended', () => { if (selectedCamera === index) { stop({ quiet: true }); position = maximum; updatePosition(); } }, { signal: lifetime.signal });
      video.addEventListener('error', () => { stop({ quiet: true }); status.textContent = 'تعذّر تشغيل الفيديو؛ البديل الزمني المكتوب متاح.'; availability('error'); }, { signal: lifetime.signal });
      display.append(video);
      extras.append(button(labels[index], () => {
        const resume = playing; stop({ quiet: true }); selectedCamera = index;
        videos.forEach((item, camera) => { item.hidden = camera !== index; item.currentTime = position - minimum; });
        for (const control of extras.querySelectorAll('[data-workbench-camera]')) control.setAttribute('aria-pressed', String(Number(control.dataset.workbenchCamera) === index));
        status.textContent = `${labels[index]} · نفس موضع الجلسة ${time(position)}. قارن طابع الكاميرا ببطاقة المعايرة لفحص اختلاف الساعات.`;
        if (resume) void start();
      }, { 'data-workbench-camera': index, 'data-media-start': '', 'aria-pressed': String(index === selectedCamera) }));
    });
  }
  function prepareComparison(bufferFactory) {
    const original = assets[0];
    for (const asset of assets.slice(1)) {
      const range = asset.record.sourceRangeSeconds;
      if (asset.record.derivedFrom !== original.record.id || asset.record.sourceSha256 !== original.verified.sha256 || !Array.isArray(range) || range.length !== 2) throw new Error('سلسلة اشتقاق المقتطف غير موثقة في البيان.');
      const slice = sliceAudioBuffer(bufferFactory, original.buffer, range[0], range[1]);
      if (Math.abs(slice.duration - asset.buffer.duration) > .05) throw new Error('مدى الاشتقاق لا يطابق مدة المقتطف.');
    }
    const excerptRange = assets[1].record.sourceRangeSeconds;
    originalExcerpt = sliceAudioBuffer(bufferFactory, original.buffer, excerptRange[0], excerptRange[1]);
    restoredBuffer = reverseAudioBuffer(bufferFactory, assets[2].buffer);
    const reversedRange = assets[2].record.sourceRangeSeconds;
    const reverseSource = sliceAudioBuffer(bufferFactory, original.buffer, reversedRange[0], reversedRange[1]);
    comparison = { excerpt: compareAudioBuffers(originalExcerpt, assets[1].buffer), reverse: compareAudioBuffers(reverseSource, restoredBuffer) };
    comparisonText.hidden = false;
    const describe = result => result.equal ? 'عينات الصوت المفكوكة متطابقة' : result.comparable ? 'العينات المفكوكة مختلفة؛ لا يصح إثبات التطابق' : 'أبعاد العينات مختلفة؛ لا يصح إثبات التطابق';
    comparisonText.textContent = `المقتطف مقابل مداه من الأصل: ${describe(comparison.excerpt)}. استعادة التسجيل المعكوس: ${describe(comparison.reverse)}. هذا فحص PCM؛ بصمات ملفات المصدر والفرع مستقلة.`;
    comparisonText.dataset.excerptEqual = String(comparison.excerpt.equal);
    comparisonText.dataset.reverseEqual = String(comparison.reverse.equal);
  }
  function waveform(buffer, label, offset, duration) {
    const canvas = el('canvas', { width: 640, height: 88, 'data-waveform': '', role: 'img', 'aria-label': `${label}؛ موجة محسوبة من عينات التسجيل، مدته ${time(buffer.duration)}` });
    const drawing = canvas.getContext('2d');
    drawing.fillStyle = '#101a17'; drawing.fillRect(0, 0, 640, 88);
    drawing.strokeStyle = '#c8a577'; drawing.lineWidth = 1;
    const peaks = waveformPeaks(buffer, 320), left = offset / duration * 640, width = buffer.duration / duration * 640;
    drawing.beginPath();
    peaks.forEach((peak, index) => { const x = left + index / peaks.length * width, height = Math.max(.4, peak * 38); drawing.moveTo(x, 44 - height); drawing.lineTo(x, 44 + height); });
    drawing.stroke();
    return el('figure', { class: 'workbench-wave' }, [el('figcaption', { text: label }), canvas]);
  }
  function renderAudio() {
    display.replaceChildren(); extras.replaceChildren();
    if (activityId === 'A18') {
      display.append(waveform(assets[0].buffer, 'القناة A · عينات فعلية', 0, maximum), waveform(assets[1].buffer, `القناة B · إزاحتك ${clamp(getOffset(), 0, 90)} ثانية`, clamp(getOffset(), 0, 90), maximum));
    } else {
      display.append(waveform(tracks()[0].buffer, mode === 'original' ? 'مدى المقتطف من الأصل A' : mode === 'excerpt' ? 'المقتطف المنشور' : restored ? 'عينات التسجيل بعد عكس ترتيبها' : 'التسجيل المعكوس كما سُلّم', 0, maximum));
      const select = next => { stop({ quiet: true }); mode = next; position = 0; audioBounds(); renderAudio(); };
      extras.append(button(restored ? 'أعد الاتجاه كما سُلّم' : 'اعكس العينات واستمع', () => { restored = !restored; select('reverse'); void start(); }, { 'data-workbench-reverse': '', 'data-media-start': '', 'aria-pressed': String(restored) }),
        button('اسمع مدى المقتطف من الأصل', () => { select('original'); void start(); }, { 'data-workbench-original': '', 'data-media-start': '' }),
        button('اسمع المقتطف المنشور', () => { select('excerpt'); void start(); }, { 'data-workbench-excerpt': '', 'data-media-start': '' }));
    }
  }
  seek.addEventListener('input', () => { const selected = Number(seek.value); stop({ quiet: true }); position = clamp(selected, minimum, maximum); if (activityId === 'A16') videos.forEach(video => { video.currentTime = position - minimum; }); updatePosition(); }, { signal: lifetime.signal });
  const offsetCleanup = subscribeOffset?.(() => { if (!loaded || activityId !== 'A18') return; stop({ quiet: true }); audioBounds(); renderAudio(); status.textContent = 'تغيّرت إزاحة القناة B. اضغط تشغيل لفحص المحاذاة التي اخترتها.'; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop({ quiet: true }); }, { signal: lifetime.signal });
  void (async () => {
    manifest = services.expansionMedia || await loadMediaManifest();
    if (destroyed) return;
    records = activityId === 'A16' ? manifest.cameras || [] : activityId === 'A18' ? manifest.channels || [] : [manifest.channels?.[0], manifest.excerpt, manifest.reversed];
    const expected = activityId === 'A18' ? 2 : 3;
    const ready = records.filter(record => mediaURL(record)).length;
    const allReady = records.length === expected && ready === expected;
    load.hidden = !allReady; load.disabled = !allReady;
    status.textContent = allReady ? 'المادة متاحة. حمّلها لبدء الفحص.' : 'التسجيلات الأصلية لم تُضف كاملة بعد. تابع الفحص بالسجل المكتوب أدناه.';
    availability(ready ? 'partial' : 'pending');
  })();
  return () => {
    if (destroyed) return;
    destroyed = true; lifetime.abort(); offsetCleanup?.(); stop({ quiet: true }); clearAssets(); context?.close().catch(() => {}); decoder = null; section.remove();
  };
}
