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
  const region = document.querySelector('.site-player');
  const download = document.querySelector('.music-download');
  const preferenceKey = 'raven_music_enabled_v2';
  const volumeKey = 'raven_music_volume_v1';
  let enabled = true;
  let phase = 'paused';
  let attempt = 0;
  let deviceVolume = false;
  try { enabled = sessionStorage.getItem(preferenceKey) !== 'off'; } catch {}

  function active() {
    return enabled && ['starting', 'playing', 'waiting'].includes(phase);
  }

  function state() {
    return { playing: phase === 'playing' && !audio.paused && !audio.error, enabled, phase };
  }

  function sync() {
    const english = document.documentElement.lang === 'en';
    toggle.textContent = active() ? (english ? 'Pause music' : 'إيقاف الأغنية') :
      (english ? 'Play music' : 'تشغيل الأغنية');
    toggle.setAttribute('aria-pressed', String(active()));
    const messages = {
      starting: english ? 'Starting the music…' : 'جارٍ بدء الأغنية…',
      playing: english ? 'RAVEN · Now playing' : 'RAVEN · الأغنية شغّالة',
      waiting: english ? 'Buffering the music…' : 'جارٍ تحميل الأغنية…',
      blocked: english ? 'Tap to start the music' : 'اضغط لتبدأ الأغنية',
      error: english ? 'Could not load. Tap to retry.' : 'تعذّر التحميل. اضغط للمحاولة.',
      paused: english ? 'RAVEN · Music paused' : 'RAVEN · الأغنية متوقفة'
    };
    status.textContent = messages[phase];
    region?.setAttribute('aria-label', english ? 'RAVEN music' : 'أغنية رايفن');
    download?.setAttribute('aria-label', english ? 'Download the RAVEN song' : 'تنزيل أغنية رايفن');
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
    if (!enabled || error?.name === 'AbortError') phase = 'paused';
    else phase = error?.name === 'NotAllowedError' ? 'blocked' : 'error';
    sync();
  }

  function play() {
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
        if (!enabled) { audio.pause(); phase = 'paused'; }
        else if (audio.error) phase = 'error';
        else if (audio.paused) phase = 'paused';
        else phase = audio.readyState >= 3 ? 'playing' : 'waiting';
        sync();
      }).catch(error => failed(id, error));
    } catch (error) { failed(id, error); }
  }

  function gesture(event) {
    if (!event.isTrusted || event.repeat || event.isComposing) return;
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    if (event.target.closest?.('#music-toggle, #music-settings, #music-volume, [data-music-toggle], audio, video')) return;
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
  audio.addEventListener('play', () => {
    if (!enabled) { audio.pause(); return; }
    phase = 'starting';
    sync();
  });
  audio.addEventListener('playing', () => {
    if (!enabled) { audio.pause(); return; }
    phase = 'playing';
    sync();
  });
  const waiting = () => {
    if (enabled && !audio.paused && !audio.error) { phase = 'waiting'; sync(); }
  };
  audio.addEventListener('waiting', waiting);
  audio.addEventListener('stalled', () => { if (audio.readyState < 3) waiting(); });
  audio.addEventListener('pause', () => {
    if (!enabled || !['blocked', 'error'].includes(phase)) phase = audio.error ? 'error' : 'paused';
    sync();
  });
  audio.addEventListener('error', () => { ++attempt; phase = 'error'; sync(); });
  audio.addEventListener('ended', () => { phase = 'paused'; sync(); });
  document.addEventListener('click', gesture);
  document.addEventListener('keydown', gesture);

  let initialVolume = volume.value;
  try {
    const saved = localStorage.getItem(volumeKey);
    if (saved !== null) initialVolume = saved;
  } catch {}
  setVolume(initialVolume);
  audio.src = new URL('fourth-signature/assets/audio/raven-dark-pop-intimate-revised.mp3', rootURL).href;
  audio.loop = true;
  audio.muted = false;
  soundtrack = { gesture, toggleMusic, state, sync };
  sync();
  play();
  return soundtrack;
}
