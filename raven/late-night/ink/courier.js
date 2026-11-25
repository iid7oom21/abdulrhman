import {element, mount} from '../night-shell.js';
import {download} from '../night-store.js';
import {START, LETTER, CINEMA, MAX_STEPS, WET_LIMIT, PANELS, MANGA_FORMAT, DRAFT_FORMAT,
  terrain, neighbor, preview, replay, validDraft, validateCourierManga, panelEvents} from './courier-rules.js';

const tabs = ['game', 'weather', 'manga'];
const artURL = id => new URL('art/courier/' + id + '.webp', import.meta.url).href;
const editing = new URL(location.href).searchParams.has('piece');
const makeState = () => ({path:[], order:[...PANELS], weather:{rain:60, wind:15}, tab:'game'});
let state, selection = null, focusCell = START, recovery = null;
const words = {
  gameTab:['العب','Play'], weatherTab:['ارسم المطر','Sketch the rain'], mangaTab:['مانجا جولتي','My manga'],
  'map-title':['طريق السينما','The cinema route'], confirm:['أكّد الخطوة','Confirm step'],
  'see-manga':['افتح مانجا جولتي','Open my manga'], undo:['تراجع خطوة','Undo a step'],
  reset:['جولة جديدة','New round'], weatherTitle:['محاكاة خطوط المطر','Rain-streak simulator'],
  rainLabel:['كثافة المطر','Rain density'], windLabel:['اتجاه الريح','Wind direction'],
  print:['نزّل الكادر PNG','Download frame PNG'], mangaTitle:['صفحة من جولتك','A page from your round'],
  'save-manga':['احفظ في دفتر أعمالي','Save to my portfolio'], export:['نزّل المانجا JSON','Download manga JSON'],
  back:['العودة إلى ليالي الحبر','Back to Ink Nights'], 'retry-stage':['أعد تحميل الرسم','Reload illustration'],
  'retry-weather':['أعد تحميل رسم المرفأ','Reload harbour artwork'],
};
const terrainWords = {wall:['مبنى','Building'], water:['ماء مكشوف','Exposed water'], covered:['ممر مسقوف','Covered walk']};
const stageCopy = {
  departure:['يغادر الساعي محطة المرفأ باتجاه مكتب الرسائل.', 'The courier leaves the harbour station for the dispatch office.'],
  crossing:['يعبر الساعي شوارع المرفأ تحت المطر.', 'The courier crosses the harbour streets in the rain.'],
  letter:['تسلّم الساعي الظرف عند مكتب الرسائل.', 'The courier collects the envelope at the dispatch office.'],
  shelter:['توقّف الساعي تحت المظلّة.', 'The courier stops beneath the awning.'],
  arrival:['يسلّم الساعي الرسالة عند باب السينما.', 'The courier delivers the letter at the cinema door.'],
};

function init(ui) {
  const source = editing ? ui.editData : ui.load();
  const valid = editing ? validateCourierManga(source) : validDraft(source);
  if (valid) {
    state = {path:[...source.path], order:[...source.order], weather:{...source.weather}, tab:editing ? 'manga' : source.tab};
  } else {
    state = makeState();
    if (editing) recovery = 'piece';
    else if (source !== null && source !== undefined) recovery = 'draft';
  }
  focusCell = replay(state.path).cell;
}

function render(ui) {
  const {t, root} = ui;
  if (!state) init(ui);
  root.replaceChildren(document.getElementById('courier-view').content.cloneNode(true));
  const $ = id => root.querySelector('#' + id);
  const number = value => new Intl.NumberFormat(ui.lang, {maximumFractionDigits:1}).format(value);
  const cellName = i => t('خانة ', 'Cell ') + number(i + 1);
  let round = replay(state.path);
  let weatherPlate, weatherCtx, weatherReady = false, mounted = true, shownArt;
  const saveDraft = () => {
    if (editing || recovery === 'draft') return;
    ui.save({...state, format:DRAFT_FORMAT});
  };
  const mangaData = () => ({format:MANGA_FORMAT, path:[...state.path], order:[...state.order], weather:{...state.weather}});
  for (const [key, pair] of Object.entries(words)) $(key).textContent = t(...pair);
  $('back').href = ui.url('ink-studio.html');
  $('brief').textContent = t('خذ الرسالة من الخانة ٤ وسلّمها إلى السينما في ٢٥ خلال ١٦ خطوة. اختر خانة مجاورة لتفحص كلفتها. أبقِ البلل دون ١٠٠.',
    'Collect the letter in cell 4 and deliver it to the cinema in 25 within 16 steps. Select a neighbouring cell to check its cost. Keep wetness below 100.');
  $('status').tabIndex = -1;
  if (recovery) {
    $('recovery').hidden = false;
    $('recovery').textContent = recovery === 'piece'
      ? t('تعذّر فتح هذه القطعة. يمكنك لعب جولة جديدة هنا.', 'This piece could not be opened. You can play a fresh round here.')
      : t('تعذّرت استعادة الجولة المحفوظة. يمكنك اللعب مؤقتًا أو اختيار «جولة جديدة» لحفظ بداية جديدة.', 'Your saved round could not be restored. Play in memory or choose New round to save a fresh start.');
  }

  function setTab(tab, persist = true) {
    state.tab = tab;
    for (const name of tabs) {
      $(name).hidden = name !== tab;
      $(name + 'Tab').setAttribute('aria-pressed', String(name === tab));
    }
    if (tab === 'weather') drawWeather();
    if (tab === 'manga') drawManga();
    if (persist) saveDraft();
  }
  for (const tab of tabs) $(tab + 'Tab').onclick = () => setTab(tab);
  $('see-manga').onclick = () => { setTab('manga'); $('mangaTitle').tabIndex = -1; $('mangaTitle').focus(); };

  function endDescription() {
    if (round.outcome === 'delivered') return t('وصلت الرسالة إلى السينما.', 'Delivered to the cinema.');
    if (round.outcome === 'soaked') return t('توقّفت الرحلة. بلغ البلل ', 'The route ended at wetness ') + number(round.wetness) + t(' من ١٠٠.', ' out of 100.');
    if (round.outcome === 'out-of-time') return t('نفدت الخطوات قبل التسليم.', 'The courier ran out of steps before delivery.');
    if (round.pickup !== null) return t('الرسالة معك. اتجه إلى السينما.', 'You have the letter. Head for the cinema.');
    if (round.cell === CINEMA) return t('وصلت إلى السينما. ما زالت الرسالة في مكتب الرسائل.', 'You reached the cinema. The letter is still at the dispatch office.');
    return t('الرسالة في مكتب الرسائل.', 'The letter is at the dispatch office.');
  }

  const art = $('stage-art');
  art.onerror = () => {art.hidden = true; $('retry-stage').hidden = false;};
  art.onload = () => {art.hidden = false; $('retry-stage').hidden = true;};
  function setStage() {
    let id = round.steps ? 'crossing' : 'departure';
    if (round.outcome !== 'playing') id = round.outcome === 'delivered' ? 'arrival' : 'shelter';
    else if (round.pickup === round.steps) id = 'letter';
    $('caption').textContent = t(...stageCopy[id]);
    if (shownArt === id) return;
    shownArt = id; art.hidden = false; $('retry-stage').hidden = true;
    art.src = artURL(id);
  }
  $('retry-stage').onclick = () => {art.hidden = false; $('retry-stage').hidden = true; art.src = artURL(shownArt);};

  const board = $('board');
  const symbols = {wall:'▨', water:'≈', covered:'·', letter:'✉︎', cinema:'▣', courier:'●'};
  const nouns = {...terrainWords, letter:['الرسالة','Letter'], cinema:['السينما','Cinema'], courier:['الساعي','Courier']};
  for (const id of ['courier','letter','cinema','covered','water','wall']) {
    const item = element('span');
    const symbol = element('b', symbols[id]);
    symbol.setAttribute('aria-hidden', 'true');
    item.append(symbol, document.createTextNode(' ' + t(...nouns[id]) + (id === 'covered' ? ' +'+ number(3) : id === 'water' ? ' +' + number(22) : '')));
    $('legend').append(item);
  }
  const cells = Array.from({length:25}, (_, i) => {
    const b = element('button');
    b.type = 'button'; b.dataset.cell = i;
    b.append(element('span', number(i + 1),'cell-number'), element('span', '', 'cell-symbol'));
    b.lastChild.setAttribute('aria-hidden','true');
    b.onclick = () => select(i);
    board.append(b); return b;
  });
  function viewBoard() {
    for (const [i,b] of cells.entries()) {
      const surface = terrain(i);
      const landmark = i === LETTER && round.pickup === null ? 'letter' : i === CINEMA ? 'cinema' : null;
      const mark = i === round.cell ? 'courier' : landmark || surface;
      const terms = [cellName(i), t(...terrainWords[surface])];
      if (landmark) terms.push(t(...nouns[landmark]));
      if (i === round.cell) terms.push(t('أنت هنا','You are here'));
      b.setAttribute('aria-label', terms.join(t('، ', ', ')));
      b.setAttribute('aria-current', String(i === round.cell));
      b.setAttribute('aria-pressed', String(i === selection));
      b.className = 'cell-' + surface;
      b.disabled = round.outcome !== 'playing';
      b.tabIndex = !b.disabled && i === focusCell ? 0 : -1;
      b.lastChild.textContent = symbols[mark];
    }
  }
  function viewSelection() {
    $('confirm').disabled = true;
    if (selection === null || round.outcome !== 'playing') { $('preview').textContent = ''; return; }
    const next = preview(round, selection);
    if (next.reason) {
      const messages = {wall:['مبنى مغلق. اختر طريقًا آخر.', 'This building is closed. Choose another route.'],
        current:['أنت في هذه الخانة. اختر خانة مجاورة.', 'You are here. Choose a neighbouring cell.'],
        distant:['هذه الخانة بعيدة. تحرّك خانة واحدة أفقيًا أو عموديًا.', 'That cell is out of reach. Move one cell horizontally or vertically.']};
      $('preview').textContent = t(...messages[next.reason]);
      return;
    }
    const cost = element('bdi', '+' + number(next.cost) + ' (' + number(next.wetness) + '/' + number(WET_LIMIT) + ')');
    cost.dir = 'ltr';
    $('preview').replaceChildren(cellName(selection) + ' · ' + t(...terrainWords[terrain(selection)]) + ' · ' + t('البلل ', 'Wetness '), cost);
    $('confirm').disabled = false;
  }
  function select(i) {
    if (round.outcome !== 'playing') return;
    selection = i; focusCell = i; viewBoard(); viewSelection();
  }
  board.addEventListener('keydown', event => {
    const deltas = {ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0]};
    if (!Object.hasOwn(deltas,event.key) || round.outcome !== 'playing') return;
    event.preventDefault();
    const destination = neighbor(Number(event.target.dataset.cell), ...deltas[event.key]);
    if (destination !== null) {select(destination); cells[destination].focus();}
  });

  function viewGame() {
    round = replay(state.path);
    for (const [id, label, value, limit] of [
      ['steps-meter', t('الخطوات ', 'Steps '), round.steps, MAX_STEPS],
      ['wet-meter', t('البلل ', 'Wetness '), round.wetness, WET_LIMIT],
    ]) {
      const amount = element('bdi', number(value) + ' / ' + number(limit));
      amount.dir = 'ltr'; $(id).replaceChildren(label, amount);
    }
    $('status').textContent = endDescription(); $('status').dataset.outcome = round.outcome;
    $('undo').disabled = !round.steps;
    $('confirm').hidden = round.outcome !== 'playing';
    $('see-manga').hidden = round.outcome === 'playing';
    viewBoard(); viewSelection(); setStage();
  }
  $('confirm').onclick = () => {
    if (selection === null || preview(round, selection).reason) return;
    state.path.push(selection); focusCell = selection; selection = null;
    viewGame(); saveDraft();
    if (round.outcome === 'playing') cells[round.cell].focus(); else $('status').focus();
  };
  $('undo').onclick = () => {
    if (!state.path.length) return;
    state.path.pop(); selection = null; focusCell = state.path.at(-1) ?? START;
    viewGame(); saveDraft(); cells[round.cell].focus();
  };
  $('reset').onclick = () => {
    state = makeState(); selection = null; focusCell = START; recovery = null; $('recovery').hidden = true;
    $('rain').value = state.weather.rain; $('wind').value = state.weather.wind;
    viewGame();
    if (!editing) ui.replaceDraft({...state, format:DRAFT_FORMAT});
    cells[START].focus();
  };

  function drawWeather() {
    const {rain, wind} = state.weather;
    $('measure').textContent = t('كثافة المطر ', 'Rain density ') + number(rain) + '/'+number(100) + ' · ' +
      t('انحراف الخطوط ', 'Streak offset ') + number(wind * .4) + t(' بكسل. يتغيّر الرسم وحده.', ' px. These settings affect the illustration only.');
    $('scene').setAttribute('aria-label', $('measure').textContent);
    $('print').disabled = true;
    try { weatherCtx ||= $('scene').getContext('2d'); } catch { weatherCtx = null; }
    if (!weatherCtx) {
      $('weather-caption').textContent = t('تعذّر الرسم على هذا الجهاز. تقدر تغيّر القيم وتقرأ أثرها أعلاه.', 'Canvas is unavailable on this device. You can still change the settings and read their values.');
      return;
    }
    if (!weatherPlate) {loadWeather(); return;}
    if (!weatherReady) return;
    const ctx = weatherCtx, canvas = $('scene');
    ctx.drawImage(weatherPlate, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(210,229,239,.66)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < rain * 2; i++) {
      const x = i * 137 % canvas.width, y = i * 61 % canvas.height;
      ctx.moveTo(x, y); ctx.lineTo(x + wind * .4, y + 17);
    }
    ctx.stroke();
    $('weather-caption').textContent = t('شوارع المرفأ مع خطوط المطر التي ضبطتها.', 'Harbour streets with your rain settings.');
    $('print').disabled = false;
  }
  function loadWeather() {
    weatherReady = false; $('retry-weather').hidden = true;
    $('weather-caption').textContent = t('جارٍ تحميل رسم المرفأ…', 'Loading the harbour illustration…');
    weatherPlate = new Image();
    weatherPlate.onload = () => {if (!mounted) return; weatherReady = true; drawWeather();};
    weatherPlate.onerror = () => {
      if (!mounted) return;
      $('weather-caption').textContent = t('تعذّر تحميل رسم المرفأ. قيم المحاكاة متاحة.', 'The harbour illustration could not load. The simulator values are available.');
      $('retry-weather').hidden = false;
    };
    weatherPlate.src = artURL('route');
  }
  $('retry-weather').onclick = loadWeather;
  for (const key of ['rain','wind']) {
    $(key).value = state.weather[key];
    $(key).oninput = () => { state.weather[key] = Number($(key).value); $('exportStatus').textContent = ''; drawWeather(); };
    $(key).onchange = saveDraft;
  }
  $('print').onclick = () => {
    if (!weatherReady || !weatherCtx) return;
    try {
      $('scene').toBlob(blob => {
        if (!mounted) return;
        if (blob) download('raven-rain-courier.png', blob);
        else $('exportStatus').textContent = t('تعذّر إنشاء الصورة.', 'The image could not be created.');
      }, 'image/png');
    } catch { $('exportStatus').textContent = t('تعذّر تنزيل الصورة.', 'The image could not be downloaded.'); }
  };

  function panelCaption(event) {
    if (event.id === 'departure') return t('غادر الساعي المحطة عند ', 'The courier left the station at ') + cellName(START) + '.';
    if (event.art === 'letter') return t('أخذ الساعي الرسالة في الخطوة ', 'The courier collected the letter on step ') + number(event.step) + '.';
    if (event.id === 'middle') return t('في الخطوة ', 'At step ') + number(event.step) + t(' وصل الساعي إلى ', ' the courier reached ') + cellName(event.cell) + '.';
    return endDescription() + ' ' + t('الخطوة ', 'Step ') + number(event.step) + ' · ' + t('البلل ', 'Wetness ') + number(round.wetness) + '.';
  }
  function movePanel(index, offset) {
    const to = index + offset;
    const moved = state.order[index];
    [state.order[index], state.order[to]] = [state.order[to], moved];
    saveDraft(); drawManga();
    const card = $('panels').querySelector('[data-panel="' + moved + '"]');
    const preferred = card.querySelector(offset > 0 ? '.move-later' : '.move-earlier');
    (preferred.disabled ? card.querySelector('button:not([hidden]):enabled') : preferred)?.focus();
  }
  function drawManga() {
    const earned = panelEvents(state.path);
    const ended = round.outcome !== 'playing';
    $('mangaHint').textContent = ended ? t('غيّر ترتيب اللقطات الثلاث من رحلتك، ثم احفظ النسخة التي اخترتها.', 'Arrange the three moments from your route and save your edition.') :
      t('تظهر لقطات رحلتك عندما تحدث. أكمل الجولة لتجميع الصفحة.', 'Scenes appear as they happen. Finish the round to assemble your page.');
    const deck = $('panels'); deck.replaceChildren();
    for (const [i,id] of state.order.entries()) {
      const event = earned.find(e => e.id === id);
      if (!event) continue;
      const card = element('article', null, 'panel'); card.dataset.panel = id;
      const picture = element('img'), caption = element('p',panelCaption(event));
      picture.alt = ''; picture.width = 480; picture.height = 270;
      picture.src = artURL('print-' + event.art);
      const retry = element('button',t('أعد تحميل اللوحة', 'Reload panel'));
      retry.hidden = true;
      picture.onerror = () => {picture.hidden = true; retry.hidden = false;};
      picture.onload = () => {picture.hidden = false; retry.hidden = true;};
      retry.onclick = () => {picture.hidden = false; retry.hidden = true; picture.src = artURL('print-' + event.art);};
      card.append(picture, caption);
      if (ended) {
        const controls = element('div',null,'courier-panel-controls');
        for (const offset of [-1,1]) {
          const btn = element('button',offset < 0 ? t('قدّم اللوحة','Move earlier') : t('أخّر اللوحة','Move later'), offset < 0 ? 'move-earlier' : 'move-later');
          btn.disabled = i+offset < 0 || i+offset >= state.order.length;
          btn.onclick = () => movePanel(i,offset);
          controls.append(btn);
        }
        card.append(controls);
      }
      card.append(retry); deck.append(card);
    }
    $('export').disabled = !ended; $('save-manga').disabled = !ended;
  }
  function thumbnail() {
    const img = $('panels').querySelector('img');
    if (!img?.naturalWidth) return null;
    try {
      const c = document.createElement('canvas'); c.width = 220; c.height = 124;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img,0,0,c.width,c.height); return c.toDataURL('image/webp',.7);
    } catch { return null; }
  }
  const pieceTitle = () => t('ساعي المطر','Rain Courier') + ' · ' + number(round.steps) + t(' خطوة',' steps');
  $('save-manga').onclick = () => {
    const data = mangaData();
    if (!validateCourierManga(data)) return;
    const item = ui.savePiece({title:pieceTitle(), type:MANGA_FORMAT, data, thumbnail:thumbnail()});
    $('manga-status').textContent = item ? t('تقدر تفتح هذه النسخة للتعديل من دفتر أعمالك.', 'You can reopen this edition from your portfolio.') :
      t('تعذّر حفظ هذه النسخة. يمكنك تنزيل المانجا بصيغة JSON.', 'This edition could not be saved. You can download the manga as JSON.');
  };
  $('export').onclick = async () => {
    const data = mangaData();
    if (!validateCourierManga(data)) return;
    try {
      const {portableWork} = await import('../work-file.js');
      const packet = portableWork({activity:'ink-courier', type:MANGA_FORMAT, title:pieceTitle(), data});
      if (!packet) throw new Error('format');
      download('raven-rain-manga.json', packet);
    } catch {
      $('manga-status').textContent = t('تعذّر تجهيز الملف. احتفظ بالصفحة مفتوحة وأعد التنزيل.', 'The file could not be prepared. Keep the page open and retry the download.');
    }
  };
  viewGame(); setTab(state.tab, false);
  return () => {mounted = false;};
}

mount({id:'ink-courier',title:['ساعي المطر','Rain Courier'],
  intro:['رسالة تنتظرها سينما المرفأ. أيّ طريق تسلك تحت المطر؟', 'Harbour Cinema is waiting for a letter. Which way will you take through the rain?'],render});
