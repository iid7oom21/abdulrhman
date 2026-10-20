let soundtrack;

// The outer document owns this one player throughout navigation.
export function createSoundtrack(rootURL) {
  if (soundtrack) return soundtrack;
  const audio = document.querySelector('#site-soundtrack');
  const toggle = document.querySelector('#music-toggle');
  const status = document.querySelector('#music-status');
  const volume = document.querySelector('#music-volume');
  const volumeLabel = document.querySelector('#music-volume-label');
  const settingsLabel = document.querySelector('#music-settings-label');
  const volumeHint = document.querySelector('#music-volume-hint');
  const cinematicControl = document.querySelector('#music-cinematic');
  const cinematicLabel = document.querySelector('#music-cinematic-label');
  const cinematicHint = document.querySelector('#music-cinematic-hint');
  const region = document.querySelector('.site-player');
  const download = document.querySelector('.music-download');
  const preferenceKey = 'raven_music_enabled_v2';
  const volumeKey = 'raven_music_volume_v1';
  const cinematicKey = 'raven_music_cinematic_v1';
  let enabled = true;
  let mediaActive = false;
  let phase = 'paused';
  let attempt = 0;
  let deviceVolume = false;
  let cinematic = true;
  let context = null;
  let source = null;
  let filter = null;
  let output = null;
  let graphTask = null;
  let unavailable = false;
  let resumeBlocked = false;
  let depth = 0;
  let depthSource;
  let pulseUntil = 0;
  let pulseTimer;
  try { enabled = sessionStorage.getItem(preferenceKey) !== 'off'; } catch {}
  try { cinematic = localStorage.getItem(cinematicKey) !== 'off'; } catch {}

  function active() {
    return enabled && ['starting', 'playing', 'waiting', 'suspended'].includes(phase);
  }

  function state() {
    return {
      playing: phase === 'playing' && !audio.paused && !audio.error &&
        (!source || context.state === 'running'),
      enabled, phase
    };
  }

  function playbackPhase() {
    if (!enabled) return 'paused';
    if (mediaActive) return 'suspended';
    if (audio.paused) return 'paused';
    if (audio.error) return 'error';
    if (source && context.state !== 'running') return 'blocked';
    return audio.readyState >= 3 ? 'playing' : 'waiting';
  }

  function sync() {
    const english = document.documentElement.lang === 'en';
    toggle.textContent = active() ? (english ? 'Pause music' : 'إيقاف الأغنية') :
      (english ? 'Play music' : 'تشغيل الأغنية');
    toggle.setAttribute('aria-pressed', String(active()));
    const messages = {
      starting: english ? 'Starting the music…' : 'جارٍ بدء الأغنية…',
      playing: english ? 'RAVEN · Now playing' : 'RAVEN · الأغنية شغّالة',
      suspended: english ? 'Music paused while media plays' : 'الأغنية متوقفة أثناء تشغيل المقطع',
      waiting: english ? 'Buffering the music…' : 'جارٍ تحميل الأغنية…',
      blocked: english ? 'Tap to start the music' : 'اضغط لتبدأ الأغنية',
      error: english ? 'Could not load. Tap to retry.' : 'تعذّر التحميل. اضغط للمحاولة.',
      paused: english ? 'RAVEN · Music paused' : 'RAVEN · الأغنية متوقفة'
    };
    status.textContent = messages[phase];
    region?.setAttribute('aria-label', english ? 'RAVEN music' : 'أغنية رايفن');
    if (download) {
      download.setAttribute('aria-label', english ? 'Download the RAVEN song' : 'تنزيل أغنية رايفن');
      download.textContent = english ? 'Download song · MP3' : 'تنزيل الأغنية · MP3';
    }
    volume.setAttribute('aria-label', english ? 'Music volume' : 'مستوى صوت الأغنية');
    if (volumeLabel) volumeLabel.textContent = english ? 'Volume' : 'الصوت';
    if (settingsLabel) {
      settingsLabel.textContent = english ? 'Sound' : 'الصوت';
      settingsLabel.setAttribute('aria-label', english ? 'Sound settings' : 'إعدادات الصوت');
    }
    if (volumeHint) {
      volumeHint.hidden = !deviceVolume;
      volumeHint.textContent = english ? 'Use your device buttons to adjust the volume.' :
        'استخدم أزرار جهازك للتحكم بمستوى الصوت.';
    }
    if (cinematicControl) {
      cinematicControl.checked = cinematic && !unavailable;
      cinematicControl.disabled = unavailable;
      cinematicControl.setAttribute('aria-label', english ? 'Cinematic sound' : 'الصوت السينمائي');
    }
    if (cinematicLabel) cinematicLabel.textContent = english ? 'Cinematic sound' : 'الصوت السينمائي';
    if (cinematicHint) {
      cinematicHint.textContent = unavailable || (resumeBlocked && !source)
        ? (english ? 'The effect is unavailable here; original audio is retained.' :
          'المؤثر غير متاح هنا؛ يبقى صوت الأغنية الأصلي.')
        : source && context.state !== 'running' && enabled && !audio.paused
          ? (english ? 'Tap Play music to resume the sound.' : 'اضغط تشغيل الأغنية لاستئناف الصوت.')
          : cinematic
            ? (english ? 'The tone changes gently as you scroll.' : 'يتغيّر طابع الصوت برفق أثناء التمرير.')
            : (english ? 'The song plays with its original sound.' : 'الأغنية بصوتها الأصلي.');
    }
  }

  function applyDepth() {
    if (!filter || !context || !cinematic || unavailable) return;
    const ceiling = Math.min(18000, context.sampleRate * 0.45);
    const floor = Math.min(5500, ceiling * 0.55);
    const accent = performance.now() < pulseUntil ? 0.78 : 1;
    const frequency = ceiling * Math.pow(floor / ceiling, depth) * accent;
    const now = context.currentTime;
    try {
      const current = filter.frequency.value;
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.setValueAtTime(current, now);
      filter.frequency.setTargetAtTime(frequency, now, 0.18);
    } catch {
      unavailable = true;
      bypassFilter();
      sync();
    }
  }

  function bypassFilter() {
    if (!source) return;
    // Keep a live destination connected before removing the processing path.
    // Disconnecting a MediaElementAudioSource does not restore native output.
    try {
      source.connect(context.destination);
      if (output && output !== context.destination) source.disconnect(output);
      output = context.destination;
    } catch { /* Keep the previously connected path if rerouting is unavailable. */ }
  }

  function routeFilter() {
    if (!source) return;
    if (!cinematic || unavailable) { bypassFilter(); return; }
    applyDepth();
    if (unavailable || output === filter) return;
    try {
      source.connect(filter);
      if (output) source.disconnect(output);
      output = filter;
    } catch {
      unavailable = true;
      bypassFilter();
    }
  }

  // Only called from trusted clicks/keyboard interactions. A failed resume
  // leaves the media element on its native path until a context is running.
  function prepareGraph() {
    if (graphTask || (unavailable && !source) || (!cinematic && !source)) return graphTask;
    graphTask = (async () => {
      try {
        if (!context) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) { unavailable = true; sync(); return; }
          context = new AudioContext();
          context.addEventListener('statechange', () => {
            if (source && enabled && !audio.paused) phase = playbackPhase();
            sync();
          });
        }
        if (context.state !== 'running') await context.resume();
        if (context.state !== 'running') throw new Error('Audio context is not running');
        resumeBlocked = false;
      } catch {
        resumeBlocked = true;
        if (source && enabled && !audio.paused) phase = 'blocked';
        sync();
        return;
      }
      if (!source && cinematic) {
        try {
          // Prepare the processing path before the irreversible element binding.
          filter = context.createBiquadFilter();
          filter.type = 'lowpass';
          filter.Q.value = Math.SQRT1_2;
          filter.frequency.value = Math.min(18000, context.sampleRate * 0.45);
          filter.connect(context.destination);
          source = context.createMediaElementSource(audio);
          source.connect(context.destination);
          output = context.destination;
        } catch {
          unavailable = true;
          bypassFilter();
          sync();
          return;
        }
      }
      routeFilter();
      if (source && enabled && !audio.paused) phase = playbackPhase();
      sync();
    })().finally(() => { graphTask = null; });
    return graphTask;
  }

  function setDepth(ratio, sourceToken) {
    const value = Number(ratio);
    depth = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    if (sourceToken !== undefined && sourceToken !== depthSource) {
      depthSource = sourceToken;
      clearTimeout(pulseTimer);
      pulseUntil = 0;
    }
    applyDepth();
    return depth;
  }

  function pulse() {
    if (!cinematic || unavailable || !source || !state().playing) return false;
    clearTimeout(pulseTimer);
    pulseUntil = performance.now() + 650;
    applyDepth();
    pulseTimer = setTimeout(() => { pulseUntil = 0; applyDepth(); }, 650);
    return true;
  }

  function setVolume(value, save = false) {
    const number = Number(value);
    const level = Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0.45;
    try {
      audio.volume = level;
      deviceVolume = Math.abs(audio.volume - level) > 0.001;
      if (!deviceVolume && save) {
        try { localStorage.setItem(volumeKey, String(level)); } catch {}
      }
    } catch { deviceVolume = true; }
    volume.value = String(level);
    volume.disabled = deviceVolume;
    if (deviceVolume && volumeHint) volume.setAttribute('aria-describedby', volumeHint.id);
    else volume.removeAttribute('aria-describedby');
    sync();
  }

  function failed(id, error) {
    if (id !== attempt) return;
    if (enabled && mediaActive) phase = 'suspended';
    else if (!enabled || error?.name === 'AbortError') phase = 'paused';
    else phase = error?.name === 'NotAllowedError' ? 'blocked' : 'error';
    sync();
  }

  function play() {
    if (enabled && mediaActive) { phase = 'suspended'; sync(); return; }
    if (!enabled || phase === 'starting' ||
        (active() && !audio.paused && !audio.error)) return;
    const id = ++attempt;
    phase = 'starting';
    sync();
    try {
      if (audio.error) audio.load();
      const result = audio.play();
      result?.then(() => {
        if (id !== attempt) return;
        if (!enabled || mediaActive) { audio.pause(); phase = playbackPhase(); }
        else phase = playbackPhase();
        sync();
      }).catch(error => failed(id, error));
    } catch (error) { failed(id, error); }
  }

  function setMediaActive(value) {
    const next = Boolean(value);
    if (mediaActive === next) return;
    mediaActive = next;
    ++attempt;
    if (mediaActive) {
      phase = enabled ? 'suspended' : 'paused';
      audio.pause();
      sync();
    } else {
      phase = 'paused';
      sync();
      if (enabled) play();
    }
  }

  function gesture(event) {
    if (!event.isTrusted || event.repeat || event.isComposing) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    // A checkbox's change handler must read its new value before sync renders it.
    if (event.target.closest?.('#music-settings, #music-volume, audio, video')) return;
    prepareGraph();
    if (event.target.closest?.('#music-toggle, [data-music-toggle]')) return;
    if (enabled && audio.paused) play();
  }

  function toggleMusic() {
    if (active()) {
      enabled = false;
      ++attempt;
      phase = 'paused';
      audio.pause();
      sync();
    } else {
      enabled = true;
      play();
    }
    try { sessionStorage.setItem(preferenceKey, enabled ? 'on' : 'off'); } catch {}
  }

  toggle.addEventListener('click', toggleMusic);
  volume.addEventListener('input', () => setVolume(volume.value, true));
  cinematicControl?.addEventListener('change', event => {
    cinematic = cinematicControl.checked;
    clearTimeout(pulseTimer);
    pulseUntil = 0;
    try { localStorage.setItem(cinematicKey, cinematic ? 'on' : 'off'); } catch {}
    routeFilter();
    if (event.isTrusted) prepareGraph();
    sync();
  });
  audio.addEventListener('play', () => {
    if (!enabled || mediaActive) { audio.pause(); phase = playbackPhase(); sync(); return; }
    phase = 'starting';
    sync();
  });
  audio.addEventListener('playing', () => {
    if (!enabled || mediaActive) { audio.pause(); phase = playbackPhase(); sync(); return; }
    phase = playbackPhase();
    sync();
  });
  const waiting = () => {
    if (enabled && !mediaActive && !audio.paused && !audio.error) { phase = 'waiting'; sync(); }
  };
  audio.addEventListener('waiting', waiting);
  audio.addEventListener('stalled', () => { if (audio.readyState < 3) waiting(); });
  audio.addEventListener('pause', () => {
    clearTimeout(pulseTimer);
    pulseUntil = 0;
    applyDepth();
    if (enabled && mediaActive) phase = 'suspended';
    else if (!enabled || !['blocked', 'error'].includes(phase)) phase = audio.error ? 'error' : 'paused';
    sync();
  });
  audio.addEventListener('error', () => {
    ++attempt;
    phase = enabled && mediaActive ? 'suspended' : 'error';
    sync();
  });
  audio.addEventListener('ended', () => { phase = enabled && mediaActive ? 'suspended' : 'paused'; sync(); });
  document.addEventListener('click', gesture);
  document.addEventListener('keydown', gesture);

  let initialVolume = volume.value;
  try {
    const saved = localStorage.getItem(volumeKey);
    if (saved !== null) initialVolume = saved;
  } catch {}
  setVolume(initialVolume);
  audio.src = new URL('fourth-signature/assets/audio/raven-baqi-athar-320.mp3', rootURL).href;
  audio.loop = true;
  audio.muted = false;
  soundtrack = { gesture, toggleMusic, state, sync, setDepth, pulse, setMediaActive };
  sync();
  play();
  return soundtrack;
}
