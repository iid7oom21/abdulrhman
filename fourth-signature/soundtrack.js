// The approved song starts only through the native audio controls.
let soundtrack;
let initialized = false;

export function pauseSoundtrack() {
  soundtrack?.pause();
}

export function initializeSoundtrack() {
  if (initialized) return;
  const panel = document.querySelector('#soundtrack-panel');
  const audio = document.querySelector('#case-soundtrack');
  const section = panel?.closest('.case-soundtrack');
  if (!panel || !audio || !section) return;
  initialized = true;
  soundtrack = audio;

  let status = document.querySelector('#soundtrack-status');
  if (!status) {
    status = document.createElement('p');
    status.id = 'soundtrack-status';
    status.setAttribute('role', 'status');
    panel.querySelector('.soundtrack-body')?.append(status);
  }

  panel.addEventListener('toggle', () => {
    if (!panel.open) pauseSoundtrack();
  });
  audio.addEventListener('play', () => {
    const bounds = section.getBoundingClientRect();
    if (!panel.open || document.hidden || document.querySelector('dialog[open]') ||
        bounds.bottom <= 0 || bounds.top >= innerHeight) {
      pauseSoundtrack();
    }
  });
  audio.addEventListener('error', () => {
    pauseSoundtrack();
    status.textContent = 'تعذّر تشغيل الأغنية. يمكنك تنزيلها والمحاولة مجددًا.';
  });
  audio.addEventListener('loadeddata', () => { status.textContent = ''; });

  document.addEventListener('click', (event) => {
    if (event.target instanceof Element &&
        event.target.closest('.section-links a, #start-link, .skip-link')) pauseSoundtrack();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseSoundtrack();
  });
  window.addEventListener('pagehide', pauseSoundtrack);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => !entry.isIntersecting)) pauseSoundtrack();
    });
    observer.observe(section);
  }
}
