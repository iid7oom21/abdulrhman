import { SHOTS, SHOT_IDS, ROUNDS, CONSTRAINTS, duration, score, dailyRound, validateFile, challengeFile, customRound, generateBrief } from './edit-rules.js';
const empty = (n) => Array(n).fill(null);
const cleanCut = list => Array.isArray(list) && list.length > 0 && list.length <= 4 && list.every(id => id === null || SHOT_IDS.includes(id));
const moods = [
  { id: 'arrival', names: ['وصول هادئ', 'A quiet arrival'], cue: 'exterior', order: ['exterior', 'lamp', 'envelope'] },
  { id: 'surprise', names: ['النتيجة أولًا', 'Aftermath first'], cue: 'envelope', order: ['envelope', 'exterior', 'hand'] },
  { id: 'night', names: ['آخر الليل', 'Late at night'], cue: 'lamp', order: ['lamp', 'hand', 'envelope'] },
];
const fileErrors = {
  format: ['صيغة التحدي غير معروفة.', 'This challenge file format is unknown.'],
  title: ['أعطِ الجولة اسمًا بين حرف و٨٠ حرفًا.', 'Give this round a name of 1–80 characters.'],
  library: ['في الملف لقطة مكررة أو غير موجودة في المكتبة.', 'The library contains a repeated or unknown shot.'],
  slots: ['اختر عدد خانات بين ١ وعدد اللقطات المتاحة.', 'Choose between one slot and the number of available shots.'],
  limit: ['الحد الزمني عدد صحيح بين ٣ و٢٤ ثانية.', 'The time limit must be a whole number from 3 to 24 seconds.'],
  rule: ['قاعدة الترتيب غير معروفة.', 'Unknown ordering rule.'],
  unsolvable: ['ما فيه ترتيب يحقق هذه الشروط. زِد الوقت أو غيّر المكتبة.', 'No order satisfies those rules. Increase the time or change the library.'],
};
function node(tag, cls, text) {
  const element = document.createElement(tag);
  if (cls)
    element.className = cls;
  if (typeof text === 'string')
    element.textContent = text;
  return element;
}
function button(text, fn, action, cls) {
  const b = node('button', cls, text);
  b.type = 'button';
  if (action)
    b.dataset.editAction = action;
  b.addEventListener('click', fn);
  return b;
}
function download(object, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(object, null, 2)], { type: 'application/json' }));
  const a = node('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function startState(date, route, lang) {
  return {
    v: 1, round: 0, active: 'A', cuts: { A: empty(3), B: empty(3) }, seen: { A: '', B: '' }, history: [],
    date, dailyDone: false, selected: null, focusSlot: 0, mode: ['brief', 'custom', 'duo'].includes(route) ? 'setup' : 'cut',
    mood: 'arrival', disclosed: false, pace: 'brisk', seconds: 12, constraint: 'establish',
    custom: challengeFile(lang === 'ar' ? 'قصّتي' : 'My cut', 3, 15, 'none', [...SHOT_IDS]),
  };
}
function loadState(raw, fallback) {
  if (raw?.v !== 1 || !cleanCut(raw.cuts?.A) || !cleanCut(raw.cuts?.B) || !['A', 'B'].includes(raw.active))
    return fallback;
  const config = raw.custom;
  const safeConfig = config && typeof config.title === 'string' && config.title.length <= 80 && Array.isArray(config.library) &&
    config.library.every(id => SHOT_IDS.includes(id)) && Number.isSafeInteger(config.slots) && Number.isSafeInteger(config.limit) &&
    typeof config.constraint === 'string' && Object.hasOwn(CONSTRAINTS, config.constraint);
  const state = { ...fallback, cuts: { A: [...raw.cuts.A], B: [...raw.cuts.B] }, active: raw.active };
  if (safeConfig)
    state.custom = challengeFile(config.title, config.slots, config.limit, config.constraint, [...config.library]);
  if (Number.isInteger(raw.round) && ROUNDS[raw.round])
    state.round = raw.round;
  if (['setup', 'handover', 'cut'].includes(raw.mode))
    state.mode = raw.mode;
  if (moods.some(m => m.id === raw.mood))
    state.mood = raw.mood;
  if (['brisk', 'linger'].includes(raw.pace))
    state.pace = raw.pace;
  if ([8, 12, 16].includes(raw.seconds))
    state.seconds = raw.seconds;
  if (['establish', 'effect', 'continuity'].includes(raw.constraint))
    state.constraint = raw.constraint;
  if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date))
    state.date = raw.date;
  state.disclosed = raw.disclosed === true;
  state.dailyDone = raw.dailyDone === true;
  if (SHOT_IDS.includes(raw.selected))
    state.selected = raw.selected;
  if (Number.isInteger(raw.focusSlot) && raw.focusSlot >= 0 && raw.focusSlot < state.cuts[state.active].length)
    state.focusSlot = raw.focusSlot;
  for (const v of ['A', 'B'])
    if (typeof raw.seen?.[v] === 'string')
      state.seen[v] = raw.seen[v];
  if (Array.isArray(raw.history))
    state.history = raw.history.slice(-12).filter(item => ['A', 'B'].includes(item?.active) && cleanCut(item.cut) && typeof item.seen === 'string');
  return state;
}
export default function mount(ui) {
  const { root, route, lang, t } = ui;
  const fmt = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const nowDate = () => new Date().toISOString().slice(0, 10);
  const fallback = startState(nowDate(), route, lang);
  let state = loadState(ui.load(route, null), fallback);
  if (state.mode === 'cut' && route === 'custom' && validateFile(state.custom))
    state.mode = 'setup';
  let selected = state.selected, focusSlot = state.focusSlot, error = '', transfer = false, copyPlan = null;
  let tick = null, elapsed = 0, since = 0, running = false, preview = null, tornDown = false;
  let timerText, progress, surface, playerTools, status;
  const broken = new Set();
  const label = pair => t(...pair);
  const local = item => item[lang];
  const nameOf = id => local(SHOTS[id].name);
  const sec = n => fmt.format(n) + t(' ث', ' s');
  const currentCut = () => state.cuts[state.active];
  const compact = () => currentCut().filter(Boolean);
  const isFree = () => route === 'free' || route === 'duo';
  function challenge() {
    switch (route) {
      case 'daily': return dailyRound(state.date);
      case 'brief': return generateBrief(state.pace, state.seconds, state.constraint);
      case 'custom': return customRound(state.custom);
      default: return ROUNDS[state.round];
    }
  }
  const isComplete = () => compact().length > 0 && (isFree() || currentCut().length === challenge().slots && currentCut().every(Boolean));
  const screened = () => compact().length && state.seen[state.active] === compact().join(',');
  function persist() {
    state.selected = selected;
    state.focusSlot = focusSlot;
    ui.save(route, state);
  }
  function stop() {
    if (tick !== null)
      window.clearInterval(tick);
    tick = null;
    running = false;
  }
  function clearPlayer() {
    stop();
    elapsed = 0;
    preview = null;
    transfer = false;
    copyPlan = null;
  }
  ui.onCleanup(() => {
    tornDown = true;
    stop();
    document.removeEventListener('visibilitychange', visibility);
  });
  function visibility() {
    if (document.hidden && running)
      pause();
  }
  document.addEventListener('visibilitychange', visibility);
  function announce(text) {
    if (status)
      status.textContent = text;
  }
  function restoreFocus(selector) {
    if (selector)
      root.querySelector(selector)?.focus({ preventScroll: true });
  }
  function changeCut(next, index, focus) {
    const old = currentCut();
    if (next.length === old.length && next.every((v, i) => v === old[i]))
      return;
    state.history.push({ active: state.active, cut: [...old], seen: state.seen[state.active] });
    state.history = state.history.slice(-12);
    state.cuts[state.active] = next;
    state.seen[state.active] = '';
    focusSlot = Math.max(0, Math.min(index, next.length - 1));
    clearPlayer();
    persist();
    render();
    restoreFocus(focus);
  }
  function assign(index) {
    if (selected === null) {
      focusSlot = index;
      persist();
      render();
      restoreFocus('[data-slot="' + index + '"]');
      return;
    }
    let next = [...currentCut()];
    if (!isFree()) {
      const from = next.indexOf(selected);
      if (from >= 0)
        next[from] = next[index];
    }
    next[index] = selected;
    selected = null;
    if (currentCut().every((v, i) => v === next[i])) {
      focusSlot = index;
      persist();
      render();
      restoreFocus('[data-slot="' + index + '"]');
      return;
    }
    changeCut(next, index, '[data-slot="' + index + '"]');
  }
  function move(delta) {
    const next = [...currentCut()], other = focusSlot + delta;
    if (other < 0 || other >= next.length)
      return;
    [next[other], next[focusSlot]] = [next[focusSlot], next[other]];
    changeCut(next, other, '[data-slot="' + other + '"]');
  }
  function resetCuts(n) {
    clearPlayer();
    selected = null;
    focusSlot = 0;
    state.active = 'A';
    state.cuts = { A: empty(n), B: empty(n) };
    state.seen = { A: '', B: '' };
    state.history = [];
  }
  function action(text, fn, id, disabled = false, cls = '') {
    const b = button(text, fn, id, cls);
    b.disabled = disabled;
    return b;
  }
  function thumb(id, cls) {
    const fig = node('span', cls || 'cut-thumb');
    const image = node('img');
    image.alt = '';
    image.decoding = 'async';
    const onError = () => {
      broken.add(id);
      fig.classList.add('cut-missing');
      image.remove();
      fig.textContent = nameOf(id);
    };
    image.addEventListener('error', onError, { once: true });
    if (!broken.has(id)) {
      image.src = SHOTS[id].image;
      fig.append(image);
    }
    else
      onError();
    return fig;
  }
  function heading(parent, title, paragraph) {
    parent.append(node('h1', 'cut-heading', title));
    if (paragraph)
      parent.append(node('p', 'cut-deck', paragraph));
  }
  function choices(parent, title, options, value, onChange) {
    const field = node('fieldset', 'cut-options');
    field.append(node('legend', '', title));
    for (const [id, text] of options) {
      const b = button(text, () => onChange(id), null, 'cut-option');
      b.dataset.choice = String(id);
      b.setAttribute('aria-pressed', String(id === value));
      field.append(b);
    }
    parent.append(field);
  }
  function renderSetup(wrap) {
    if (route === 'duo') {
      const mood = moods.find(m => m.id === state.mood);
      heading(wrap, t('المخرج والمونتير', 'Director & editor'), state.mode === 'handover'
        ? t('سلّم الجهاز للمونتير. سيظهر له الموجز بعد استلام الدور.', 'Pass the device to the editor. The brief opens when they take their turn.')
        : t('للمخرج: اختر مزاج الفيلم في سرّك. سيقرأ المونتير كلمتين ويصنع نسخته، ثم تعرضان اختيار المخرج.', 'Director: privately pick the mood. Your editor receives the words and makes a cut before seeing the director’s reference.'));
      if (state.mode === 'handover') {
        wrap.append(action(t('استلمت دور المونتير', 'Take the editing desk'), () => {
          state.mode = 'cut';
          persist();
          render();
        }, 'receive', false, 'cut-main'));
        return;
      }
      const grid = node('div', 'cut-library');
      for (const option of moods) {
        const b = button('', () => {
          state.mood = option.id;
          persist();
          render();
          restoreFocus('[data-mood="' + option.id + '"]');
        }, null, 'cut-tile');
        b.dataset.mood = option.id;
        b.append(thumb(option.cue), node('strong', '', label(option.names)));
        b.setAttribute('aria-pressed', String(option === mood));
        grid.append(b);
      }
      wrap.append(grid, action(t('غطّ الاختيار وسلّم الجهاز', 'Cover the choice and pass the device'), () => {
        resetCuts(3);
        state.mode = 'handover';
        state.disclosed = false;
        persist();
        render();
      }, 'handover', false, 'cut-main'));
      return;
    }
    if (route === 'brief') {
      heading(wrap, t('مولّد تكليفات المخرج', 'Director’s brief generator'), t('قوالب محلية تركّب موجزًا قابلًا للعب من وقتك وقيدك وإيقاعك.', 'Local templates assemble a playable brief from your pace, time and constraint.'));
      const set = (key, id) => {
        state[key] = id;
        persist();
        render();
        restoreFocus('[data-choice="' + id + '"]');
      };
      choices(wrap, t('الإيقاع', 'Pace'), [['brisk', t('مكثّف', 'Brisk')], ['linger', t('متأنٍ', 'Lingering')]], state.pace, id => set('pace', id));
      choices(wrap, t('الحد الأقصى', 'Time budget'), [8, 12, 16].map(n => [n, sec(n)]), state.seconds, id => set('seconds', id));
      choices(wrap, t('قيد المخرج', 'Director’s constraint'), ['establish', 'effect', 'continuity'].map(id => [id, local(CONSTRAINTS[id])]), state.constraint, id => set('constraint', id));
      const spec = challenge();
      wrap.append(node('p', 'cut-proof', local(spec.title) + ' · ' + fmt.format(spec.slots) + t(' لقطات', ' shots') + ' · ' + sec(spec.limit) + ' · ' + local(spec.brief)));
      wrap.append(action(t('ركّب هذا التكليف', 'Edit this brief'), () => {
        resetCuts(spec.slots);
        state.mode = 'cut';
        persist();
        render();
      }, 'build-brief', false, 'cut-main'));
      return;
    }
    const file = state.custom;
    heading(wrap, t('اصنع تحدّيك', 'Build a challenge'), t('حدّد المواد وشروط العرض، ثم اختبر جولتك. يُفتح الملف داخل هذا الجهاز.', 'Choose the footage and screening rules, then play your round. Imported files open on this device.'));
    const textField = node('label', 'cut-field', t('اسم التحدي', 'Challenge name'));
    const title = node('input');
    title.value = file.title;
    title.maxLength = 80;
    title.addEventListener('input', () => {
      file.title = title.value;
      persist();
    });
    textField.append(title);
    wrap.append(textField);
    const fields = node('div', 'cut-number-fields');
    for (const [key, term, min, max] of [['slots', t('عدد الخانات', 'Slots'), 1, 4], ['limit', t('حد الثواني', 'Seconds'), 3, 24]]) {
      const lab = node('label', 'cut-field', term);
      const input = node('input');
      input.type = 'number';
      input.min = min;
      input.max = max;
      input.value = file[key];
      input.addEventListener('input', () => {
        file[key] = Number(input.value);
        persist();
      });
      lab.append(input);
      fields.append(lab);
    }
    wrap.append(fields);
    const lib = node('fieldset', 'cut-options');
    lib.append(node('legend', '', t('اللقطات المتاحة', 'Available footage')));
    for (const id of SHOT_IDS) {
      const l = node('label', 'cut-check');
      const box = node('input');
      box.type = 'checkbox';
      box.checked = file.library.includes(id);
      box.addEventListener('change', () => {
        file.library = SHOT_IDS.filter(s => s === id ? box.checked : file.library.includes(s));
        persist();
      });
      l.append(box, document.createTextNode(nameOf(id)));
      lib.append(l);
    }
    wrap.append(lib);
    const rule = node('label', 'cut-field', t('شرط الترتيب', 'Ordering rule'));
    const sel = node('select');
    for (const [id, text] of Object.entries(CONSTRAINTS)) {
      const opt = node('option', '', local(text));
      opt.value = id;
      sel.append(opt);
    }
    sel.value = file.constraint;
    sel.addEventListener('change', () => {
      file.constraint = sel.value;
      persist();
    });
    rule.append(sel);
    wrap.append(rule);
    const msg = node('p', 'cut-status', error);
    msg.setAttribute('role', 'status');
    const validate = () => {
      const fail = validateFile(file);
      error = fail ? label(fileErrors[fail]) : '';
      msg.textContent = error;
      return !fail;
    };
    const buttons = node('div', 'cut-controls');
    buttons.append(action(t('اختبر التحدي', 'Playtest challenge'), () => {
      if (!validate())
        return;
      resetCuts(file.slots);
      state.mode = 'cut';
      persist();
      render();
    }, 'playtest', false, 'cut-main'));
    const load = node('label', 'cut-field', t('استيراد ملف تحدٍ · JSON', 'Import a challenge · JSON'));
    const input = node('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      if (!f)
        return;
      try {
        if (f.size > 10000)
          throw new Error('format');
        const raw = JSON.parse(await f.text());
        const code = validateFile(raw);
        if (code)
          throw new Error(code);
        if (tornDown)
          return;
        state.custom = challengeFile(raw.title, raw.slots, raw.limit, raw.constraint, [...raw.library]);
        error = '';
        persist();
        render();
      }
      catch (ex) {
        if (!tornDown) {
          error = label(fileErrors[ex.message] || fileErrors.format);
          msg.textContent = error;
        }
      }
    });
    load.append(input);
    wrap.append(buttons, load, msg);
  }
  function play(ids = compact(), reference = false) {
    if (!ids.length)
      return;
    clearPlayer();
    preview = { ids: [...ids], reference, at: -1 };
    running = true;
    since = performance.now();
    render();
    updateFrame();
    startClock();
    restoreFocus('[data-edit-action=pause]');
    if (window.matchMedia('(max-width:720px)').matches)
      surface.scrollIntoView({ block: 'start' });
  }
  function startClock() {
    tick = window.setInterval(() => {
      if (running && preview)
        updateFrame();
    }, 80);
  }
  function updateFrame() {
    if (!preview || !surface)
      return;
    const seconds = duration(preview.ids);
    const point = Math.min(seconds, elapsed + (running ? (performance.now() - since) / 1000 : 0));
    progress.max = seconds;
    progress.value = point;
    timerText.textContent = sec(Math.floor(point)) + ' / ' + sec(seconds);
    let end = 0;
    let index = preview.ids.findIndex(id => {
      end += SHOTS[id].seconds;
      return point < end;
    });
    if (index === -1)
      index = preview.ids.length - 1;
    if (preview.at !== index) {
      preview.at = index;
      renderFrame(surface, preview.ids[index]);
    }
    if (point >= seconds && running) {
      stop();
      elapsed = seconds;
      if (!preview.reference) {
        state.seen[state.active] = preview.ids.join(',');
        if (route === 'daily' && score(challenge(), preview.ids).pass)
          state.dailyDone = true;
        persist();
        root.dispatchEvent(new CustomEvent('aftershow:cut', { bubbles: true, detail: { shots: [...preview.ids], seconds, version: state.active, route } }));
      }
      render();
      root.querySelector('[data-edit-result]')?.focus();
    }
  }
  function pause() {
    if (!running)
      return;
    const current = elapsed + (performance.now() - since) / 1000;
    if (current >= duration(preview.ids)) {
      updateFrame();
      return;
    }
    elapsed = current;
    stop();
    render();
    restoreFocus('[data-edit-action=pause]');
  }
  function resume() {
    since = performance.now();
    running = true;
    render();
    updateFrame();
    startClock();
    restoreFocus('[data-edit-action=pause]');
  }
  function renderFrame(holder, id) {
    holder.dataset.currentShot = id;
    const clip = SHOTS[id];
    const info = node('div', 'cut-frame-caption');
    info.append(node('span', '', nameOf(id)), node('span', '', sec(clip.seconds)));
    holder.replaceChildren();
    const missing = () => {
      broken.add(id);
      const note = node('div', 'cut-fallback');
      note.append(node('strong', '', local(clip.description)), button(t('حاول تحميل الصورة', 'Retry this image'), () => {
        broken.delete(id);
        renderFrame(holder, id);
      }, 'retry-image'));
      holder.replaceChildren(note, info);
    };
    if (broken.has(id)) {
      missing();
      return;
    }
    const img = node('img');
    img.alt = local(clip.description);
    img.addEventListener('error', missing, { once: true });
    img.src = clip.image;
    holder.append(img, info);
  }
  function monitor(parent) {
    const panel = node('div', 'cut-monitor');
    panel.dataset.editPlayer = '';
    surface = node('div', 'cut-frame');
    const display = preview ? preview.ids[Math.max(0, preview.at)] : (compact()[0] || 'exterior');
    renderFrame(surface, display);
    const bar = node('div', 'cut-monitor-bar');
    const field = node('span', 'cut-media-label', t('عرض صور موقّت', 'Timed stills'));
    timerText = node('bdi', 'cut-clock');
    timerText.dataset.editClock = '';
    progress = node('progress', 'cut-progress');
    progress.setAttribute('aria-label', t('موضع العرض', 'Screening position'));
    const secs = preview ? duration(preview.ids) : duration(compact());
    progress.max = secs || 1;
    progress.value = preview ? elapsed : 0;
    timerText.textContent = sec(preview ? Math.min(Math.floor(elapsed), secs) : 0) + ' / ' + sec(secs);
    playerTools = node('div', 'cut-play-controls');
    if (preview && elapsed < secs) {
      playerTools.append(action(running ? t('إيقاف مؤقت', 'Pause') : t('استئناف العرض', 'Resume'), running ? pause : resume, 'pause'));
      playerTools.append(action(t('من البداية', 'Restart'), () => play(preview.ids, preview.reference), 'restart'));
    }
    else if (preview) {
      playerTools.append(action(t('إعادة العرض', 'Replay'), () => play(preview.ids, preview.reference), 'replay'));
    }
    bar.append(field, timerText, playerTools);
    panel.append(surface, progress, bar);
    parent.append(panel);
  }
  function observed(ids) {
    const hand = ids.indexOf('hand'), envelope = ids.indexOf('envelope');
    if (hand >= 0 && envelope >= 0) {
      return envelope < hand ? t('شفنا الظرف على الطاولة قبل اليد اللي حطّته.', 'We saw the envelope at rest before the hand that placed it.')
        : envelope === hand + 1 ? t('قطعت من وضع الظرف إلى أثره مباشرة.', 'You cut straight from the hand to the envelope it left.')
          : t('بين وضع الظرف وظهوره على الطاولة لقطة أخرى.', 'A separate shot sits between placing the envelope and seeing it at rest.');
    }
    return t('أول صورة', 'First image') + ' — ' + nameOf(ids[0]) + ' / ' + t('آخر صورة', 'Last image') + ' — ' + nameOf(ids.at(-1));
  }
  function suggestion(ids) {
    const spec = challenge();
    if (!isFree()) {
      const permitted = spec.library;
      const possible = permitted.flatMap((id) => ids.map((old, i) => {
        const next = [...ids], existing = next.indexOf(id);
        if (existing !== -1)
          next[existing] = old;
        next[i] = id;
        return next;
      })).filter(next => new Set(next).size === next.length && next.join(',') !== ids.join(','));
      const rank = cut => {
        const facts = score(spec, cut);
        return Number(facts.time) + Number(facts.order);
      };
      possible.sort((a, b) => rank(b) - rank(a));
      if (possible.length)
        return possible[0];
    }
    if (ids.length === 1)
      return [SHOT_IDS.find(id => id !== ids[0])];
    const alt = [...ids];
    const distinct = alt.findIndex(id => id !== alt[0]);
    if (distinct > 0)
      [alt[0], alt[distinct]] = [alt[distinct], alt[0]];
    else
      alt[0] = SHOT_IDS.find(id => id !== alt[0]);
    return alt;
  }
  function completeActions(parent) {
    const ids = compact(), secs = duration(ids);
    const result = node('section', 'cut-result');
    result.dataset.editResult = '';
    result.tabIndex = -1;
    if (isFree()) {
      result.append(node('h3', '', t('قراءة النسخة', 'Your cut')), node('p', '', observed(ids)));
    }
    else {
      const spec = challenge(), facts = score(spec, ids);
      result.dataset.time = String(facts.time);
      result.dataset.order = String(facts.order);
      const title = facts.pass ? t('نسختك جاهزة للعرض', 'Your cut meets the brief') : t('غرفة المراجعة', 'Screening notes');
      result.append(node('h3', '', title));
      const measure = node('p', 'cut-proof', t('الزمن', 'Timing') + ' · ' + sec(secs) + ' / ' + sec(spec.limit) + ' — ' + (facts.time ? t('ضمن الوقت', 'within budget') : t('فوق الوقت', 'over budget')));
      result.append(measure, node('p', '', t('التتابع', 'Sequence') + ' · ' + (facts.order ? t('وافق ترتيبك شرط الجولة.', 'Your order meets the constraint.') : t('راجع ترتيب التكليف.', 'Revisit the brief’s sequence.')) + ' ' + observed(ids)));
    }
    if (route === 'duo') {
      const mood = moods.find(m => m.id === state.mood);
      if (!state.disclosed)
        result.append(action(t('اكشف نسخة المخرج', 'Reveal the director’s cut'), () => {
          state.disclosed = true;
          persist();
          render();
        }, 'reveal'));
      else {
        result.append(node('p', '', t('المخرج اختار', 'The director picked') + ' «' + label(mood.names) + '» · ' + mood.order.map(nameOf).join(' / ')));
        result.append(action(t('اعرض نسخة المخرج', 'Screen the reference'), () => play(mood.order, true), 'reference'));
      }
    }
    const actions = node('div', 'cut-controls');
    if (route === 'custom' && score(challenge(), ids).pass) {
      actions.append(action(t('تنزيل التحدي المختبَر · JSON', 'Download playtested challenge · JSON'), () => {
        download(state.custom, 'raven-challenge.json');
      }, 'download-rules'));
    }
    actions.append(action(t('جرّب تعديلًا', 'Suggest one edit'), () => {
      copyPlan = suggestion(ids);
      transfer = false;
      render();
      restoreFocus('[data-edit-action=apply-suggestion]');
    }, 'suggest'));
    actions.append(action(t('بطاقة من نسختي', 'Make a screening card'), () => {
      ui.save('shareCut', { source: 'edit', shots: [...ids], seconds: secs });
      ui.go('card');
    }, 'share'));
    actions.append(action(t('لوحة اللقطات في الاستوديو', 'Storyboard in the studio'), () => {
      transfer = !transfer;
      copyPlan = null;
      render();
      restoreFocus(transfer ? '[data-edit-studio-confirm]' : '[data-edit-action=studio]');
    }, 'studio'));
    if (route === 'daily')
      actions.append(action(t('مونتاج حر', 'Free edit'), () => ui.go('free'), 'practice'));
    actions.append(action(t('جرّب ليلة العرض', 'Try screening night'), () => ui.go('festival'), 'festival'));
    result.append(actions);
    if (copyPlan) {
      const other = state.active === 'A' ? 'B' : 'A';
      const suggestionText = t('اقتراح محلي للنسخة', 'Local suggestion for cut') + ' ' + other + ' — ' + copyPlan.map(nameOf).join(' / ');
      result.append(node('p', 'cut-proof', suggestionText));
      const apply = t('استخدم الاقتراح في', 'Use suggestion in') + ' ' + other + (state.cuts[other].some(Boolean) ? t(' واستبدل ترتيبها', ' · replace its order') : '');
      result.append(action(apply, () => {
        const next = copyPlan;
        state.active = other;
        changeCut(next, 0, null);
        copyPlan = null;
        preview = null;
        persist();
        render();
      }, 'apply-suggestion'));
    }
    if (transfer) {
      const note = node('div', 'cut-transfer');
      note.append(node('h4', '', t('ما سيصل إلى الاستوديو', 'Storyboard handoff')));
      const ordered = node('ol');
      ids.forEach(id => ordered.append(node('li', '', nameOf(id) + ' · ' + sec(SHOTS[id].seconds))));
      note.append(ordered);
      const url = new URL('../../studio/', document.baseURI);
      url.searchParams.set('lang', lang);
      url.searchParams.set('afterShow', ids.join(','));
      url.searchParams.set('from', route);
      const link = node('a', 'cut-main', t('افتح الاستوديو بهذه اللقطات', 'Open studio with these shots'));
      link.href = url.href;
      link.target = '_top';
      link.dataset.editStudioConfirm = '';
      note.append(link);
      result.append(note);
    }
    parent.append(result);
  }
  function editor(wrap) {
    const spec = challenge(), ids = compact(), options = isFree() ? SHOT_IDS : spec.library;
    const mood = moods.find(m => m.id === state.mood);
    let title = route === 'free' ? t('غرفة المونتاج الحر', 'Free edit') : route === 'duo' ? label(mood.names) : local(spec.title);
    if (route === 'daily')
      title = t('تحدي اليوم', 'Daily cut') + ' · ' + title;
    const brief = route === 'free' ? t('اصنع نسختين وشاهد كيف يتغيّر المعنى بينهما.', 'Make two cuts and screen the difference.')
      : route === 'duo' ? t('موجز المخرج', 'The director’s brief') + ' — ' + label(mood.names) : local(spec.brief);
    heading(wrap, title, brief);
    if (route === 'daily') {
      const line = node('div', 'cut-controls');
      line.append(node('bdi', 'cut-date', state.date + ' UTC'));
      if (state.date !== nowDate())
        line.append(action(t('افتح تحدي اليوم الجديد', 'Start the new daily cut'), () => {
          state.date = nowDate();
          state.dailyDone = false;
          resetCuts(challenge().slots);
          persist();
          render();
        }, 'new-day'));
      wrap.append(line);
    }
    if (route === 'edit') {
      const row = node('label', 'cut-round', t('الجولة', 'Round'));
      const select = node('select');
      select.setAttribute('aria-label', t('الجولة', 'Round'));
      ROUNDS.forEach((r, i) => {
        const op = node('option', '', local(r.title));
        op.value = i;
        select.append(op);
      });
      select.value = String(state.round);
      select.addEventListener('change', () => {
        const idx = Number(select.value);
        state.round = idx;
        resetCuts(ROUNDS[idx].slots);
        persist();
        render();
        restoreFocus('.cut-round select');
      });
      row.append(select);
      wrap.append(row);
    }
    if (['brief', 'custom', 'duo'].includes(route)) {
      wrap.append(action(route === 'duo' ? t('دور جديد', 'New turn') : t('تعديل التكليف', 'Edit brief'), () => {
        clearPlayer();
        state.mode = 'setup';
        persist();
        render();
      }, 'setup'));
    }
    const grid = node('div', 'cut-desk');
    const workspace = node('div', 'cut-bench');
    monitor(workspace);
    const rack = node('section', 'cut-rack');
    rack.append(node('h3', '', t('شريط اللقطات', 'Footage bin')), node('p', 'cut-hint', t('اختر صورة، ثم اضغط خانتها في خط المونتاج.', 'Pick a still, then its position on the timeline.')));
    const tiles = node('div', 'cut-library');
    for (const id of options) {
      const b = button('', () => {
        selected = selected === id ? null : id;
        persist();
        render();
        restoreFocus('[data-shot="' + id + '"]');
        announce(selected ? t('اختر خانة لوضع اللقطة.', 'Choose a timeline slot.') : t('أُلغي التحديد.', 'Selection cleared.'));
      }, null, 'cut-tile');
      b.setAttribute('aria-pressed', String(selected === id));
      b.dataset.shot = id;
      const meta = node('span', 'cut-tile-meta');
      meta.append(node('strong', '', nameOf(id)), node('bdi', '', sec(SHOTS[id].seconds)));
      b.append(thumb(id), meta);
      tiles.append(b);
    }
    rack.append(tiles);
    const timeline = node('section', 'cut-timeline');
    const top = node('div', 'cut-timeline-heading');
    top.append(node('h3', '', t('خط المونتاج', 'Timeline')), node('bdi', 'cut-clock', sec(duration(ids))));
    timeline.append(top);
    if (isFree() || state.cuts.B.some(Boolean)) {
      const versions = node('div', 'cut-controls cut-versions');
      for (const v of ['A', 'B']) {
        const b = action(t('نسخة ', 'Cut ') + v, () => {
          clearPlayer();
          selected = null;
          state.active = v;
          focusSlot = 0;
          persist();
          render();
          restoreFocus('[data-edit-action=version-' + v + ']');
        }, 'version-' + v);
        b.setAttribute('aria-pressed', String(v === state.active));
        versions.append(b);
      }
      timeline.append(versions);
    }
    const cells = node('div', 'cut-slots');
    cells.style.setProperty('--slot-count', currentCut().length);
    currentCut().forEach((id, i) => {
      const b = button('', () => assign(i), null, 'cut-slot');
      b.dataset.slot = String(i);
      b.setAttribute('aria-pressed', String(i === focusSlot));
      b.setAttribute('aria-label', t('الخانة ', 'Slot ') + fmt.format(i + 1) + ' · ' + (id ? nameOf(id) : t('فارغة', 'empty')));
      const num = node('bdi', 'cut-slot-num', String(i + 1).padStart(2, '0'));
      b.append(num, node('span', '', id ? nameOf(id) : t('ضع لقطة', 'Place shot')));
      cells.append(b);
    });
    timeline.append(cells);
    const c = node('div', 'cut-controls cut-tools');
    const cut = currentCut();
    c.append(action(t('قدّم', 'Earlier'), () => move(-1), 'earlier', focusSlot === 0 || !cut[focusSlot]));
    c.append(action(t('أخّر', 'Later'), () => move(1), 'later', focusSlot === cut.length - 1 || !cut[focusSlot]));
    c.append(action(t('أزل', 'Remove'), () => {
      const n = [...cut];
      n[focusSlot] = null;
      changeCut(n, focusSlot, '[data-slot="' + focusSlot + '"]');
    }, 'remove', !cut[focusSlot]));
    c.append(action(t('تراجع', 'Undo'), () => {
      const prev = state.history.pop();
      if (!prev)
        return;
      clearPlayer();
      state.active = prev.active;
      state.cuts[state.active] = prev.cut;
      state.seen[state.active] = prev.seen;
      focusSlot = 0;
      persist();
      render();
      restoreFocus('[data-slot="0"]');
    }, 'undo', !state.history.length));
    if (isFree()) {
      c.append(action(t('خانة إضافية', 'Add slot'), () => changeCut([...cut, null], cut.length, '[data-slot="' + cut.length + '"]'), 'add-slot', cut.length === 4));
      const dest = state.active === 'A' ? 'B' : 'A';
      c.append(action(t('انسخ إلى ', 'Copy to ') + dest + (state.cuts[dest].some(Boolean) ? t(' واستبدلها', ' · replace') : ''), () => {
        state.active = dest;
        changeCut([...cut], 0, null);
        clearPlayer();
        persist();
        render();
        restoreFocus('[data-edit-action=version-' + dest + ']');
      }, 'duplicate', !ids.length));
    }
    timeline.append(c);
    const mainActions = node('div', 'cut-controls');
    mainActions.append(action(t('اعرض نسختي', 'Screen my cut'), () => play(), 'play', !isComplete() || running, 'cut-main'));
    if (isFree())
      mainActions.append(action(t('تنزيل وصف المونتاج · JSON', 'Download cut · JSON'), () => {
        const result = { format: 'raven-timed-stills-1', version: state.active, seconds: duration(ids), shots: ids.map(id => ({ id, title: nameOf(id), seconds: SHOTS[id].seconds })) };
        download(result, 'raven-cut-' + state.active + '.json');
      }, 'download-cut', !ids.length));
    timeline.append(mainActions);
    workspace.append(timeline);
    grid.append(rack, workspace);
    wrap.append(grid);
    if (screened())
      completeActions(wrap);
    status = node('p', 'cut-status');
    status.setAttribute('role', 'status');
    wrap.append(status);
  }
  function render() {
    if (tornDown)
      return;
    const wrap = node('article', 'after-cut');
    wrap.classList.toggle('is-screening', Boolean(preview));
    if (state.mode !== 'cut' && ['brief', 'custom', 'duo'].includes(route))
      renderSetup(wrap);
    else
      editor(wrap);
    root.replaceChildren(wrap);
  }
  const spec = challenge();
  if (!isFree() && spec && state.mode === 'cut' && currentCut().length !== spec.slots)
    resetCuts(spec.slots);
  render();
}
