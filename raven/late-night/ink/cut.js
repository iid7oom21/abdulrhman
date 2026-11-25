import {action, element, link, mount} from '../night-shell.js';

const shots = {
  pier: {
    name: ['الرصيف', 'The pier'],
    description: ['تنتظر مسافرة على رصيف الميناء أمام ممرّ العبّارة.', 'A traveller waits on the rain-dark pier in front of the ferry ramp.'],
  },
  signal: {
    name: ['إشارة الصعود', 'Boarding signal'],
    description: ['يرتفع الفانوس إيذانًا بالصعود إلى العبّارة.', 'A lantern rises to admit passengers to the ferry.'],
  },
  deck: {
    name: ['سطح العبّارة', 'Ferry deck'],
    description: ['تمشي المسافرة على سطح العبّارة ويدها على الدرابزين.', 'The traveller walks along the ferry deck with one hand on the rail.'],
  },
};
const library = ['deck', 'pier', 'signal'];
const lengthOf = cut => cut.reduce((sum, shot) => sum + shot.seconds, 0);

function validCut(value) {
  return value?.version === 1 && Array.isArray(value.cut) && value.cut.length <= 3 &&
    value.cut.every(shot => shot && typeof shot.id === 'string' && Object.hasOwn(shots, shot.id) &&
      Number.isInteger(shot.seconds) && shot.seconds >= 1 && shot.seconds <= 4) &&
    new Set(value.cut.map(shot => shot.id)).size === value.cut.length;
}

let cut, mode = 'edit', elapsed = 0, started = 0, preview = 'pier';

function render(ui) {
  const {root, t} = ui;
  if (!cut) {
    const saved = ui.editData || ui.load();
    cut = validCut(saved) ? saved.cut.map(shot => ({...shot})) : [];
    if (cut.length === 3 && saved?.screened === true) mode = 'result';
    if (cut.length) preview = cut[0].id;
  }
  const n = value => new Intl.NumberFormat(ui.lang, {maximumFractionDigits: 1}).format(value);
  const name = id => t(...shots[id].name);
  const src = id => new URL('art/ferry-' + id + '.webp', import.meta.url).href;
  const data = () => ({version: 1, cut: cut.map(shot => ({...shot})), screened: mode === 'result'});
  const save = () => ui.save(data());
  let raf = 0;

  function control(id, label, run, cls) {
    const b = action(label, run, cls);
    b.dataset.cutAction = id;
    return b;
  }

  const stage = element('figure', null, 'ink-stage');
  const still = element('img');
  const caption = element('figcaption');
  const retry = control('retry-art', t('أعد تحميل اللقطة','Reload this still'), () => {
    still.hidden = false;
    retry.hidden = true;
    still.src = src(stage.dataset.shot);
  });
  retry.hidden = true;
  still.addEventListener('error', () => {still.hidden = true; retry.hidden = false;});
  still.addEventListener('load', () => {still.hidden = false; retry.hidden = true;});
  stage.append(still, caption, retry);
  function showShot(id) {
    if (stage.dataset.shot === id) return;
    stage.dataset.shot = id;
    still.alt = t(...shots[id].description);
    caption.textContent = still.alt;
    still.hidden = false;
    retry.hidden = true;
    still.src = src(id);
  }
  const workspace = element('section');
  const back = link(t('العودة إلى ليالي الحبر','Back to Ink Nights'), ui.url('./ink-studio.html'));
  root.replaceChildren(stage, workspace, back);

  function edit(focusSelector) {
    mode = 'edit';
    elapsed = 0;
    workspace.replaceChildren();
    showShot(preview);
    const legend = element('h2', t('اختر اللقطات بترتيب عرضها','Choose shots in screening order'));
    const strip = element('div', null, 'ink-strip');
    for (const id of library) {
      const btn = control('add-' + id, '', () => {
        cut.push({id, seconds: 2});
        preview = id;
        save(); edit(cut.length === 3 ? '[data-cut-action="play"]' : '.ink-strip button:enabled');
      }, 'ink-card');
      const thumb = element('img');
      thumb.alt = ''; thumb.src = src(id);
      thumb.addEventListener('error', () => {thumb.hidden = true;});
      btn.append(thumb, element('span', name(id)));
      btn.disabled = cut.some(shot => shot.id === id);
      strip.append(btn);
    }
    const timeline = element('ol', null, 'ink-timeline');
    for (const [i, shot] of cut.entries()) {
      const row = element('li');
      const duration = element('select');
      const label = element('label', t('مدة لقطة ', 'Duration of ') + name(shot.id) + ' ');
      for (let s = 1; s <= 4; s++) {
        const option = element('option', n(s) + t(' ث',' s'));
        option.value = s; option.selected = s === shot.seconds;
        duration.append(option);
      }
      duration.dataset.duration = shot.id;
      duration.onchange = () => {
        shot.seconds = Number(duration.value);
        preview = shot.id;
        save(); edit('[data-duration="' + shot.id + '"]');
      };
      label.append(duration);
      row.append(label);
      if (i > 0) {
        const earlier = control('earlier-' + shot.id, t('قدّم اللقطة', 'Move earlier'), () => {
          [cut[i-1], cut[i]] = [cut[i], cut[i-1]];
          preview = shot.id;
          save(); edit('[data-duration="' + shot.id + '"]');
        });
        earlier.setAttribute('aria-label', t('قدّم لقطة ', 'Move earlier: ') + name(shot.id));
        row.append(earlier);
      }
      timeline.append(row);
    }
    const actions = element('div', null, 'ink-controls');
    const play = control('play', t('اعرض نسختي','Screen my cut'), () => {
      elapsed = 0;
      startPlayback();
      stage.scrollIntoView({block:'start'});
    }, 'primary');
    play.disabled = cut.length !== 3;
    actions.append(play);
    if (cut.length) actions.append(control('undo', t('أزل اللقطة الأخيرة','Remove last shot'), () => {
      const removed = cut.pop(); preview = removed.id; save(); edit('[data-cut-action="add-' + removed.id + '"]');
    }));
    workspace.append(legend, strip, timeline, actions);
    if (focusSelector) workspace.querySelector(focusSelector)?.focus({preventScroll:true});
  }

  const progress = element('progress');
  const clock = element('span');
  progress.setAttribute('aria-label', t('تقدّم العرض','Screening progress'));
  function startPlayback() {
    mode = 'playing';
    started = performance.now() - elapsed;
    playback();
  }
  function playback() {
    cancelAnimationFrame(raf);
    const controls = element('div', null, 'ink-controls');
    const paused = mode === 'paused';
    const toggle = control(paused ? 'resume' : 'pause', paused ? t('تابع العرض','Resume') : t('أوقف مؤقتًا','Pause'), () => {
      if (mode === 'paused') return startPlayback();
      elapsed = Math.min(lengthOf(cut) * 1000, performance.now() - started);
      mode = 'paused'; playback();
    });
    controls.append(toggle, control('edit', t('عد إلى المونتاج','Back to editing'), () => {
      cancelAnimationFrame(raf); edit('[data-cut-action="play"]');
    }));
    workspace.replaceChildren(progress, clock, controls);
    progress.max = lengthOf(cut) * 1000;
    function tick() {
      if (mode === 'playing') elapsed = Math.max(0, performance.now() - started);
      if (elapsed >= progress.max) {mode = 'result'; save(); result(); return;}
      let end = 0;
      const current = cut.find(shot => {end += shot.seconds * 1000; return elapsed < end;});
      showShot(current.id);
      progress.value = elapsed;
      clock.textContent = n(Math.floor(elapsed / 100) / 10) + ' / ' + n(progress.max / 1000) + t(' ث',' s');
      if (mode === 'playing') raf = requestAnimationFrame(tick);
    }
    tick();
  }

  function result() {
    workspace.replaceChildren();
    const total = lengthOf(cut), order = cut.map(s => s.id);
    const deckTime = cut.find(s => s.id === 'deck').seconds;
    const ordered = order[0] === 'pier' && order[2] === 'deck';
    const passed = ordered && total === 6 && deckTime >= 2;
    showShot(cut[2].id);
    const summary = element('section', null, 'ink-result');
    summary.dataset.passed = String(passed);
    summary.append(element('h2', passed ? t('نسختك جاهزة للعرض','Your cut meets the brief') : t('راجع القطع','Review your cut')));
    const cueSheet = element('ol');
    let time = 0;
    for (const shot of cut) {
      cueSheet.append(element('li', name(shot.id) + ' · ' + n(time) + '–' + n(time + shot.seconds) + t(' ث',' s')));
      time += shot.seconds;
    }
    const first = name(order[0]), last = name(order[2]);
    summary.append(cueSheet, element('p', t('افتتحت نسختك بلقطة «' + first + '» وانتهت بلقطة «' + last + '».',
      'Your cut opens on “' + first + '” and ends on “' + last + '”.')));
    const timing = total === 6 ? t('زمن العرض ست ثوانٍ.', 'The screening runs for six seconds.') :
      t('زمن نسختك ' + n(total) + ' ث، والمطلوب ست ثوانٍ.', 'Your cut runs for ' + n(total) + ' s. The brief calls for six.');
    summary.append(element('p', timing + ' ' + t('بقي سطح العبّارة في الكادر ' + n(deckTime) + ' ث.', 'The deck stays on screen for ' + n(deckTime) + ' s.')));
    if (!ordered) summary.append(element('p', order.indexOf('signal') < order.indexOf('pier') ?
      t('ظهرت إشارة الصعود قبل اللقطة التي تعرّفنا بالرصيف.', 'The signal appears before the shot that establishes the landing.') :
      t('ظهرت المسافرة على السطح قبل إشارة الصعود.', 'The traveller reaches the deck before the boarding signal.')));
    if (deckTime < 2) summary.append(element('p', t('تحتاج لقطة الوصول إلى ثانية أخرى كي تحقق التكليف.', 'Hold the arrival one more second to meet the brief.')));
    const controls = element('div', null, 'ink-controls');
    const keep = control('keep', t('احفظ نسختي في دفتر أعمالي','Keep this cut in my portfolio'), () => {
      const piece = {title:t('القطع الأخير · عبّارة الليل','The Final Cut · Night ferry'), type:'ferry-cut', data:data()};
      if (ui.savePiece(piece)) keep.disabled = true;
    });
    controls.append(control('revise', t('عدّل نسختي','Revise my cut'), () => {mode='edit'; save(); edit('[data-cut-action="play"]');}),
      control('replay', t('أعد العرض','Replay'), () => {elapsed=0;startPlayback();}), keep);
    workspace.append(summary, controls);
  }
  if (mode === 'result') result();
  else if (mode === 'playing' || mode === 'paused') playback();
  else edit();
  function pauseOnExit() {
    if (mode !== 'playing') return;
    elapsed = Math.min(lengthOf(cut) * 1000, performance.now() - started);
    mode = 'paused';
    playback();
  }
  function visibility() { if (document.hidden) pauseOnExit(); }
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pagehide',pauseOnExit);
  return () => {
    cancelAnimationFrame(raf);
    document.removeEventListener('visibilitychange',visibility);
    window.removeEventListener('pagehide',pauseOnExit);
  };
}

mount({id:'ink-cut', title:['القطع الأخير','The Final Cut'], intro:[
  'مونتاج لوحات أنمي موقّتة. لديك ست ثوانٍ: افتح على الرصيف، ثم أعطِ إشارة الصعود، واختم بثانيتين على الأقل فوق سطح العبّارة.',
  'Edit timed anime stills into six seconds. Open on the pier, give the boarding signal, then hold the ferry deck for at least two seconds.',
], render});
