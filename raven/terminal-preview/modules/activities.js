import { el } from './core.js?v=039ed59b19dc579c';
import { ACTIVITIES, CHAPTERS } from './expansion-data.js?v=039ed59b19dc579c';
import { createSignalPlayer } from './expansion-media.js?v=039ed59b19dc579c';

const arabic = value => new Intl.NumberFormat('ar', { useGrouping: false }).format(value);
const button = (text, action, attributes = {}) => el('button', { type: 'button', class: 'act-button', text, onClick: action, ...attributes });
const optionValue = item => String(typeof item === 'object' ? item.value ?? item.id : item);
const optionLabel = item => String(typeof item === 'object' ? item.label ?? item.title ?? item.value ?? item.id : item);
const idOf = activity => activity.id || `A${String(activity.number).padStart(2, '0')}`;
const clone = value => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const text = (tag, value, className = '') => el(tag, { text: value, class: className });

/** The view owns drafts and media presentation; only the investigation engine accepts progress. */
export function mountActivities(root, services, callbacks = {}) {
  const engine = services.investigation;
  if (!engine) {
    root.replaceChildren(text('p', 'تعذّر فتح مساحة التحقيق. أعد تحميل الصفحة.', 'act-status'));
    return () => {};
  }
  let destroyed = false;
  const initialSnapshot = engine.getSnapshot();
  let guideOpen = !(initialSnapshot.completedActivityIds || []).length && !services.store?.get?.('caseStartGuideCollapsed', false);
  let selectedId = initialSnapshot.currentActivityId || idOf(ACTIVITIES[Math.min(ACTIVITIES.length - 1, (initialSnapshot.completedActivityIds || []).length)]);
  let localUpdate = false;
  let selectedDraft = {};
  let cleanups = [];
  let busy = false;
  let renderedKey = '';
  let generation = 0;
  let status;
  let fieldNodes = new Map();
  let fieldObservers = new Map();
  const offsetListeners = new Set();
  let signal;
  let saveTimer;
  const shell = el('section', { class: 'act-investigation', dir: 'rtl', 'aria-label': 'مراحل التحقيق' });
  root.replaceChildren(shell);

  const snapshot = () => engine.getSnapshot();
  const signature = snap => `${(snap.completedActivityIds || []).join(',')}|${snap.seq}|${JSON.stringify(snap.hintsByActivity || {})}`;
  const completed = () => snapshot().completedActivityIds || [];
  const currentIndex = () => Math.min(ACTIVITIES.length - 1, completed().length);
  const savedDraft = id => services.caseStore.get().drafts?.[id] || snapshot().accepted?.find(record => record.activityId === id)?.payload || {};
  const access = id => engine.getAccess(id)?.allowed === true;
  const getActivity = id => ACTIVITIES.find(a => idOf(a) === id) || ACTIVITIES[currentIndex()];
  const isComplete = id => completed().includes(id);
  const canVisit = id => {
    const index = ACTIVITIES.findIndex(a => idOf(a) === id);
    return index >= 0 && index <= currentIndex();
  };

  function say(message, kind = '') {
    if (!status) return;
    status.textContent = message;
    status.className = `act-status${kind ? ` is-${kind}` : ''}`;
    status.hidden = !message;
  }
  function flushDraft() {
    clearTimeout(saveTimer);
    if (destroyed || isComplete(selectedId)) return;
    localUpdate = true;
    try { engine.saveDraft(selectedId, clone(selectedDraft)); } finally { localUpdate = false; }
  }
  function setValue(key, value, { updateControl = true, immediate = false } = {}) {
    if (isComplete(selectedId)) return;
    selectedDraft[key] = clone(value);
    if (updateControl) fieldNodes.get(key)?.set(value);
    fieldObservers.get(key)?.(value);
    if (key === 'alignment') offsetListeners.forEach(listener => listener(Number(value || 0)));
    clearTimeout(saveTimer);
    if (immediate) flushDraft(); else saveTimer = setTimeout(flushDraft, 180);
  }
  function disposeView() {
    signal?.destroy(); signal = null;
    for (const cleanup of cleanups.splice(0)) cleanup();
    fieldNodes.clear();
    fieldObservers.clear();
    offsetListeners.clear();
  }
  function openActivity(id, focus = true) {
    if (busy) { say('انتظر اكتمال التحقق من النتيجة الحالية.'); return; }
    if (!canVisit(id)) { services.notify?.('أكمل المهمة الحالية لفتح هذه المرحلة.'); return; }
    flushDraft(); selectedId = id; render();
    if (focus) shell.querySelector('.act-title')?.focus({ preventScroll: true });
  }
  function startGuide() {
    // Procedural help only: opening the guide never opens evidence or submits work.
    const current = getActivity(snapshot().currentActivityId || idOf(ACTIVITIES[currentIndex()]));
    const ids = (current.requiredEvidenceIds || []).filter(access);
    const sourceId = ids.find(id => !services.caseStore.get().viewedIds.includes(id)) || ids[0];
    const source = services.caseData.evidence.find(item => item.id === sourceId);
    const guide = el('details', { class: 'act-start-guide', 'data-start-guide': '', open: guideOpen });
    const step = (title, copy) => el('li', {}, [text('strong', title), text('p', copy)]);
    const first = step('افتح المصدر', 'اقرأ الوثيقة، ثم اضغط «عُد إلى المهمة الحالية».');
    if (source) first.append(button(`افتح ${source.title} ←`, () => {
      flushDraft(); callbacks.openEvidence?.(sourceId);
    }, { 'data-guide-source': sourceId }));
    const instructions = el('ol', { class: 'act-guide-steps' }, [first,
      step('افحص وسجّل', current.id === 'A01'
        ? 'اقلب الظرف وغيّر الإضاءة. اكتب المرجع الذي يظهر، بحروفه وأرقامه والشرطة.'
        : 'اتبع طلب المهمة واستخدم أزرار الفحص، ثم سجّل ما يدعمه المصدر.'),
      step('ثبّت وتابع', 'اضغط «ثبّت نتيجة الفحص»، ثم «واصل إلى المهمة التالية» بعد القبول.'),
    ]);
    guide.append(text('summary', 'كيف أبدأ التحقيق؟'),
      text('p', 'ابدأ بمصدر واحد، ثم جرّب الفحص.', 'act-guide-lead'), instructions,
      text('p', 'الأدوات اختيارية. «أحتاج تلميحًا» يُحسب ضمن محاولتك؛ هذا الدليل لا يُحسب.', 'act-small'),
      button('فهمت، إلى المهمة الحالية ←', () => {
        guideOpen = false; services.store?.set?.('caseStartGuideCollapsed', true);
        openActivity(idOf(current));
        shell.querySelector('.act-title')?.scrollIntoView({ block: 'start', behavior: 'auto' });
      }, { class: 'act-button act-primary', 'data-guide-start': '' }),
    );
    guide.addEventListener('toggle', () => {
      if (destroyed || shell.querySelector('[data-start-guide]') !== guide) return;
      guideOpen = guide.open;
      if (!guideOpen) services.store?.set?.('caseStartGuideCollapsed', true);
    });
    return guide;
  }
  function sources(activity) {
    const ids = activity.requiredEvidenceIds || [];
    if (!ids.length) return null;
    return el('div', { class: 'act-sources', 'aria-label': 'مصادر المهمة' }, ids.map(id => {
      const item = services.caseData.evidence.find(e => e.id === id);
      const viewed = services.caseStore.get().viewedIds?.includes(id);
      return button(`${item?.reference?.split(' · ')[0] || id} · ${item?.title || 'وثيقة'}${viewed ? ' ✓' : ''}`, () => {
        flushDraft(); callbacks.openEvidence?.(id);
      }, { class: 'act-source', disabled: !access(id), 'data-activity-source': id });
    }));
  }

  function renderField(field, activity) {
    if (field.type === 'hidden' || field.key === 'computedHashes') return null;
    const name = `act-${activity.id}-${field.key}`;
    const value = selectedDraft[field.key];
    const wrapper = el('div', { class: `act-field act-field-${field.type || 'text'}`, 'data-field-key': field.key });
    const label = text('label', field.key === 'answer' ? 'اختر الاستنتاج الذي تسنده الأدلة' : field.label || field.key, 'act-field-label');
    label.htmlFor = name;
    wrapper.append(label);
    if (field.description) wrapper.append(text('p', field.description, 'act-small'));
    const locked = isComplete(activity.id);
    const options = field.options || field.items || [];

    if (field.type === 'order') {
      const items = field.items || field.options || [];
      const itemIds = items.map(optionValue);
      let order = Array.isArray(value) && value.length === itemIds.length && new Set(value).size === itemIds.length && value.every(v => itemIds.includes(String(v)))
        ? value.map(String) : [...itemIds];
      if (selectedDraft[field.key] === undefined) selectedDraft[field.key] = [...order];
      const list = el('ol', { class: 'act-order-list', id: name, 'aria-label': field.label, 'data-activity-field': field.key });
      label.removeAttribute('for');
      function draw(focusId, focusDirection) {
        list.replaceChildren(...order.map((id, index) => {
          const item = items.find(item => optionValue(item) === id);
          const move = direction => {
            const nextIndex = index + direction;
            if (nextIndex < 0 || nextIndex >= order.length) return;
            [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
            setValue(field.key, order, { updateControl: false, immediate: true });
            draw(id, direction);
          };
          return el('li', { class: 'act-order-item', 'data-order-item': id }, [
            text('span', arabic(index + 1), 'act-order-number'),
            text('span', optionLabel(item), 'act-order-label'),
            el('div', { class: 'act-order-actions' }, [
              button('↑', () => move(-1), { disabled: locked || index === 0, 'aria-label': `قدّم ${optionLabel(item)}`, 'data-order-up': id }),
              button('↓', () => move(1), { disabled: locked || index === order.length - 1, 'aria-label': `أخّر ${optionLabel(item)}`, 'data-order-down': id }),
            ]),
          ]);
        }));
        if (focusId) {
          const attr = focusDirection < 0 ? 'data-order-up' : 'data-order-down';
          const focus = list.querySelector(`[${attr}="${CSS.escape(focusId)}"]`);
          if (focus && !focus.disabled) focus.focus();
          else list.querySelector(`[data-order-${focusDirection < 0 ? 'down' : 'up'}="${CSS.escape(focusId)}"]`)?.focus();
        }
      }
      draw(); wrapper.append(list);
      fieldNodes.set(field.key, { element: list, set(next) { order = [...next]; draw(); } });
    } else if (field.type === 'multi') {
      label.removeAttribute('for');
      const box = el('fieldset', { class: 'act-choice-list', id: name, 'data-activity-field': field.key }, [el('legend', { class: 'act-visually-hidden', text: field.label })]);
      const chosen = new Set(Array.isArray(value) ? value.map(String) : []);
      for (const option of options) {
        const val = optionValue(option);
        const input = el('input', { type: 'checkbox', name, value: val, checked: chosen.has(val), disabled: locked, 'data-activity-field': field.key });
        input.addEventListener('change', () => {
          if (input.checked) chosen.add(val); else chosen.delete(val);
          setValue(field.key, [...chosen], { updateControl: false, immediate: true });
        });
        box.append(el('label', { class: 'act-choice' }, [input, text('span', optionLabel(option))]));
      }
      wrapper.append(box);
      fieldNodes.set(field.key, { element: box, set(next) { chosen.clear(); for (const id of next || []) chosen.add(String(id)); box.querySelectorAll('input').forEach(input => { input.checked = chosen.has(input.value); }); } });
    } else if ((field.type === 'select' || field.type === 'choice') && (field.key === 'answer' || options.some(option => optionLabel(option).length > 90))) {
      wrapper.classList.add('act-field-choice');
      label.removeAttribute('for');
      const box = el('fieldset', { class: 'act-choice-list act-choice-quotes', id: name, 'data-activity-field': field.key }, [el('legend', { class: 'act-visually-hidden', text: field.label })]);
      for (const option of options) {
        const val = optionValue(option);
        const input = el('input', { type: 'radio', name, value: val, checked: String(value) === val, disabled: locked, 'data-activity-field': field.key });
        input.addEventListener('change', () => { if (input.checked) setValue(field.key, val, { updateControl: false, immediate: true }); });
        box.append(el('label', { class: 'act-choice' }, [input, el('span', {}, [/^E\d\d:\d+$/.test(val) ? text('b', `${val.split(':')[0]} · الفقرة ${arabic(Number(val.split(':')[1]) + 1)}`, 'act-quote-source') : null, text('span', optionLabel(option))])]));
      }
      wrapper.append(box);
      fieldNodes.set(field.key, { element: box, set(next) { box.querySelectorAll('input').forEach(input => { input.checked = input.value === String(next); }); } });
    } else if (field.type === 'select' || field.type === 'choice') {
      const control = el('select', { id: name, name, disabled: locked, 'data-activity-field': field.key }, [el('option', { value: '', text: field.placeholder || 'اختر بعد الفحص…' }), ...options.map(option => el('option', { value: optionValue(option), text: optionLabel(option) }))]);
      control.value = value == null ? '' : String(value);
      control.addEventListener('change', () => setValue(field.key, control.value, { updateControl: false, immediate: true }));
      wrapper.append(control);
      fieldNodes.set(field.key, { element: control, set(next) { control.value = String(next ?? ''); } });
    } else {
      const isNumber = field.type === 'number';
      // Archive codes can include letters and separators. Only explicitly
      // numeric fields should request the mobile number keyboard.
      const control = el('input', { id: name, name, type: isNumber ? 'number' : 'text', autocomplete: 'off', spellcheck: 'false', value: value ?? '',
        min: field.min, max: field.max, step: field.step ?? (isNumber ? 1 : undefined), disabled: locked,
        maxlength: isNumber ? undefined : field.maxLength || (field.optional ? 1200 : 180), inputmode: field.inputMode || (isNumber ? 'numeric' : 'text'),
        dir: field.dir || (/code|pin|cipher|morse|binary|hex|hash/i.test(field.key) ? 'ltr' : 'auto'),
        placeholder: field.placeholder, 'data-activity-field': field.key });
      control.addEventListener('input', () => setValue(field.key, isNumber && control.value !== '' ? Number(control.value) : control.value, { updateControl: false }));
      control.addEventListener('change', flushDraft);
      wrapper.append(control);
      fieldNodes.set(field.key, { element: control, set(next) { control.value = next ?? ''; } });
    }
    return wrapper;
  }

  function fieldKey(activity, candidates) {
    return candidates.find(key => (activity.fields || []).some(field => field.key === key));
  }
  function widgetValue(activity, candidates, value) {
    const key = fieldKey(activity, candidates);
    if (key) setValue(key, value, { immediate: true });
  }
  function panel(title, children = [], note = '') {
    return el('section', { class: 'act-apparatus' }, [text('h4', title, 'act-apparatus-title'), ...children, note ? text('p', note, 'act-small') : null]);
  }
  function table(headers, rows, { ltr = false } = {}) {
    return el('div', { class: 'act-table-scroll', tabindex: '0', 'aria-label': headers.join('، ') }, [
      el('table', { class: 'act-table', dir: ltr ? 'ltr' : 'rtl' }, [
        el('thead', {}, el('tr', {}, headers.map(header => el('th', { scope: 'col', text: header })))),
        el('tbody', {}, rows.map(row => el('tr', {}, row.map(cell => el('td', { text: String(cell) }))))),
      ]),
    ]);
  }
  function details(label, children) { return el('details', { class: 'act-reference' }, [text('summary', label), ...children]); }
  function readyMedia(activity, fallback) {
    const host = el('div', { class: 'act-media-host', 'data-activity-media': activity.id, 'data-media-availability': 'pending' }, [text('p', 'جارٍ فحص مواد هذه المهمة…', 'act-small')]);
    const mountedGeneration = generation;
    let disposed = false;
    let unmount;
    fallback.open = true;
    fallback.classList.add('act-media-fallback');
    cleanups.push(() => { disposed = true; unmount?.(); });
    import('./media-workbench.js?v=039ed59b19dc579c').then(({ mountMediaWorkbench }) => {
      if (disposed || destroyed || generation !== mountedGeneration) return;
      host.replaceChildren();
      unmount = mountMediaWorkbench(host, services, {
        activityId: activity.id,
        getOffset: () => Number(selectedDraft.alignment || 0),
        subscribeOffset(listener) {
          offsetListeners.add(listener);
          listener(Number(selectedDraft.alignment || 0));
          return () => offsetListeners.delete(listener);
        },
        onAvailability({ state }) {
          if (disposed || destroyed || generation !== mountedGeneration) return;
          host.dataset.mediaAvailability = state;
          if (state !== 'ready') fallback.open = true;
          else if (!fallback.contains(document.activeElement)) fallback.open = false;
        },
      });
    }).catch(() => {
      if (disposed || destroyed || generation !== mountedGeneration) return;
      host.dataset.mediaAvailability = 'error';
      host.replaceChildren(text('p', 'تعذّر تحميل أدوات الوسائط. يمكنك متابعة الفحص بالنسخة المكتوبة أدناه.', 'act-small'));
      fallback.open = true;
    });
    return host;
  }
  function savedUi(key, fallback) { return selectedDraft._ui?.[key] ?? fallback; }
  function saveUi(key, value) {
    selectedDraft._ui = { ...(selectedDraft._ui || {}), [key]: value };
    flushDraft();
  }

  function envelopeWidget(activity) {
    let back = selectedDraft.face === 'back';
    let lamp = selectedDraft.lamp === 'uv';
    const face = el('div', { class: 'act-envelope', 'aria-label': 'ظرف مراجعة 2026' });
    const label = text('p', '', 'act-device-status');
    const flip = button('اقلب الظرف', () => widgetValue(activity, ['face'], back ? 'front' : 'back'), { 'data-envelope-flip': '', disabled: isComplete(activity.id) });
    const uv = button('شغّل ضوء UV', () => widgetValue(activity, ['lamp'], lamp ? 'normal' : 'uv'), { 'aria-pressed': String(lamp), 'data-envelope-uv': '', disabled: isComplete(activity.id) });
    function draw() {
      face.classList.toggle('is-back', back); face.classList.toggle('is-uv', lamp);
      face.replaceChildren(text('span', back ? 'ظهر الظرف / مراجعة 2026' : 'وحدة مراجعة الأرشيف / 2026', 'act-envelope-label'),
        text('strong', back ? (lamp ? activity.puzzle.uv : 'ختم استلام باهت') : 'ملف 017', 'act-envelope-code'),
        text('span', back ? (lamp ? 'وجه خلفي · سجل المناولة الجديد' : 'افحص الختم بضوء الفحص') : 'افحص وجهي الظرف قبل تسجيل مرجعه.', 'act-envelope-note'));
      label.textContent = `${back ? 'الوجه الخلفي' : 'الوجه الأمامي'} · ${lamp ? 'ضوء الفحص مفعّل' : 'إضاءة عادية'}`;
      uv.textContent = lamp ? 'أطفئ ضوء UV' : 'شغّل ضوء UV'; uv.setAttribute('aria-pressed', String(lamp));
    }
    fieldObservers.set('face', value => { back = value === 'back'; draw(); });
    fieldObservers.set('lamp', value => { lamp = value === 'uv'; draw(); });
    draw();
    return panel('منضدة فحص الظرف', [face, el('div', { class: 'act-controls' }, [flip, uv]), label], 'غلاف جديد من مراجعة 2026. العلامة تخص وجه بطاقة المناولة الخلفي.');
  }

  function signalWidget(activity, dtmf = false) {
    const lamp = el('span', { class: 'act-signal-lamp', 'aria-hidden': 'true' });
    const display = text('output', dtmf ? 'انتظر النغمة' : 'إشارة الفهرسة', 'act-signal-display');
    const note = text('p', 'يمكنك استخدام المرجع البصري أيضًا؛ الاستماع لا يثبت الإجابة تلقائيًا.', 'act-small');
    signal = createSignalPlayer(services);
    let playNumber = 0;
    const stop = () => { playNumber++; signal?.stop(); lamp.classList.remove('is-on'); play.disabled = false; display.textContent = dtmf ? 'الإشارة متوقفة' : '-- .- ..--- ..---'; };
    const play = button(dtmf ? 'استمع إلى نغمات الهاتف' : 'استمع إلى إشارة مورس', async () => {
      const attempt = ++playNumber; play.disabled = true;
      try {
        const ok = dtmf ? await signal.playDTMF('5862', { onTone: event => {
          if (attempt !== playNumber) return;
          lamp.classList.toggle('is-on', Boolean(event.on));
          if (event.on) display.textContent = `${event.frequencies?.join(' + ') || ''} Hz`;
        } }) : await signal.playMorse('MA22', { onPulse: event => {
          if (attempt !== playNumber) return;
          lamp.classList.toggle('is-on', Boolean(event.on));
          if (event.on) display.textContent = event.symbol === '-' ? '—' : '•';
        } });
        if (attempt !== playNumber || destroyed) return;
        note.textContent = ok ? 'انتهت الإشارة. استخدم المرجع لتدوين ما فككته.' : 'الصوت غير متاح الآن؛ تسلسل النبضات أو الترددات أدناه يحمل المعلومات نفسها.';
      } catch { if (attempt === playNumber) note.textContent = 'تعذّر تشغيل الإشارة. المرجع البصري متاح.'; }
      finally { if (attempt === playNumber && !destroyed) { play.disabled = false; lamp.classList.remove('is-on'); } }
    }, { 'data-media-start': '', 'data-signal-play': dtmf ? 'dtmf' : 'morse' });
    cleanups.push(() => { playNumber++; });
    const body = [el('div', { class: 'act-signal-device', dir: 'ltr' }, [lamp, display]), el('div', { class: 'act-controls' }, [play, button('أوقف الإشارة', stop)]), note];
    if (dtmf) {
      body.push(details('افحص الترددات والمرجع البصري', [
        table(['النغمة', 'التردد الأول Hz', 'التردد الثاني Hz'], [['1', 770, 1336], ['2', 852, 1336], ['3', 770, 1477], ['4', 697, 1336]]),
        table(['Hz', 1209, 1336, 1477], [[697, '1', '2', '3'], [770, '4', '5', '6'], [852, '7', '8', '9'], [941, '*', '0', '#']], { ltr: true }),
      ]));
    } else {
      body.push(text('p', '-- .- ..--- ..---', 'act-code-line'), details('مرجع مورس والحروف', [
        table(['الحرف', 'الإشارة'], [['A', '.-'], ['B', '-...'], ['C', '-.-.'], ['D', '-..'], ['E', '.'], ['F', '..-.'], ['G', '--.'], ['H', '....'], ['I', '..'], ['J', '.---'], ['K', '-.-'], ['L', '.-..'], ['M', '--'], ['N', '-.'], ['O', '---'], ['P', '.--.'], ['Q', '--.-'], ['R', '.-.'], ['S', '...'], ['T', '-'], ['U', '..-'], ['V', '...-'], ['W', '.--'], ['X', '-..-'], ['Y', '-.--'], ['Z', '--..'], ['0', '-----'], ['1', '.----'], ['2', '..---'], ['3', '...--'], ['4', '....-'], ['5', '.....'], ['6', '-....'], ['7', '--...'], ['8', '---..'], ['9', '----.']], { ltr: true }),
      ]));
      body.push(panel('عجلة قيصر', [text('p', 'RSHQ', 'act-code-line'), text('p', 'سجل الترميز: أزيحت حروف النص الأصلي ثلاث خانات إلى الأمام. استعد النص قبل الإزاحة.', 'act-small'), caesarWheel()]));
    }
    return panel(dtmf ? 'محلل نغمات الاتصال' : 'مستقبل إشارات الفهرسة', body);
  }

  function caesarWheel() {
    const display = text('output', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'act-alphabet');
    const value = text('span', '0');
    const range = el('input', { type: 'range', min: 0, max: 25, value: 0, 'aria-label': 'إزاحة مرجع قيصر' });
    range.addEventListener('input', () => {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; const offset = Number(range.value);
      display.textContent = alphabet.slice(offset) + alphabet.slice(0, offset); value.textContent = String(offset);
    });
    return el('div', { class: 'act-wheel', dir: 'ltr' }, [text('p', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'act-alphabet'), display, el('label', {}, ['Shift ', value, range])]);
  }

  function routeWidget() {
    return panel('مسار وحدة المراجعة', [
      el('div', { class: 'act-route-map', dir: 'ltr', 'aria-label': 'ابدأ عند النقطة9، اتبع السهم إلى3 ثم6 ثم4' }, ['9', '→', '3', '↓', '4', '←', '6'].map((value, index) => text('span', value, /\d/.test(value) ? 'act-route-node' : 'act-route-arrow'))),
      details('بطاقة إحداثيات الكلمات', [text('p', 'تُقرأ الأسطر والكلمات من اليمين. الإحداثيات: 1:3، 2:2، 3:2، 4:3.'),
        el('ol', { class: 'act-word-lines' }, ['بعد المراجعة افتح الحافظة بحذر', 'افحص درج المكتب قبل المغادرة', 'سجل الوارد يوضح مصدر كل مادة', 'احتفظ بالمفتاح الثاني داخل الظرف'].map(line => text('li', line))),
      ]),
    ], 'المخطط يصف مسار فهرسة 2026، ولا يحدد موقعًا ميدانيًا في حريق 2019.');
  }

  function fingerprintWidget(activity) {
    function print(label, features) {
      const view = el('div', { class: 'act-fingerprint', 'aria-label': `${label}: ${features.join('، ')}` }, [text('span', label)]);
      for (let i = 0; i < 7; i++) view.append(el('i', { class: 'act-ridge', style: `--ridge:${i};` }));
      features.forEach(feature => {
        const symbol = feature.startsWith('حلقة') ? '∩' : feature.startsWith('تفرع') ? 'Y' : '•';
        const side = feature.includes('يسار') ? 'left' : feature.includes('يمين') ? 'right' : feature.includes('أعلى') ? 'top' : 'bottom';
        view.append(el('b', { class: `act-minutia act-minutia-${side}`, text: symbol, 'aria-hidden': 'true' }));
      });
      return view;
    }
    const names = {elias:'إلياس',nora:'نورا',elena:'إلينا'};
    return panel('بطاقة مقارنة آثار المناولة', [
      el('div', { class: 'act-print-grid' }, [print('أثر الغلاف', activity.puzzle.trace), ...activity.puzzle.samples.map(sample => print(names[sample.id], sample.features))]),
      details('وصف العلامات للمقارنة', [table(['البطاقة','العلامات'], [['أثر الغلاف', activity.puzzle.trace.join('، ')], ...activity.puzzle.samples.map(sample => [names[sample.id],sample.features.join('، ')])])]),
    ], 'رسم توضيحي لمادة مراجعة 2026؛ المقارنة داخل هذه البطاقة تتعلق بالمناولة، ولا تؤرخ اللمس أو تثبت الموافقة على المحضر.');
  }

  function cameraWidget(activity) {
    let camera = savedUi('camera', 'A');
    let time = Number(savedUi('cameraTime', 40));
    const frame = el('div', { class: 'act-camera-frame' });
    const timestamp = text('output', '', 'act-camera-time');
    const range = el('input', { type: 'range', min: 40, max: 60, step: 1, value: time, 'aria-label': 'موضع الفحص في سجل الكاميرات بالثواني' });
    const cameras = el('div', { class: 'act-controls' }, ['A', 'B', 'C'].map(id => button(`كاميرا ${id}`, () => { camera = id; saveUi('camera', id); draw(); }, { 'data-camera': id, 'aria-pressed': String(camera === id) })));
    function draw() {
      const minute = (camera === 'B' ? 43 : 36) + Math.floor(time / 60);
      timestamp.textContent = `CAM ${camera} · 21:${String(minute).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
      const record = activity.puzzle.cameras.find(record => record.id === camera);
      const event = time >= record.at ? record.description : `زاوية ${record.label} قبل الفعل الموصوف في سجلها.`;
      frame.replaceChildren(text('span', 'سجل ملاحظات · إعادة بناء مكتوبة', 'act-camera-label'), timestamp, text('p', event), text('small', 'لا يظهر ما يحدث خارج مجال هذه الزاوية.'));
      cameras.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.camera === camera)));
    }
    range.addEventListener('input', () => { time = Number(range.value); saveUi('cameraTime', time); draw(); });
    draw();
    const fallback = details('سجل الكاميرات المكتوب', [frame, el('label', { class: 'act-range-label' }, ['افحص اللحظة', range]), cameras, text('p', 'بطاقات إعادة بناء من سجل E12، وليست إطارات مستخرجة من فيديو. وهي متاحة أيضًا عند تعذّر تحميل المشاهد.', 'act-small')]);
    return panel('كاميرات مختبر المراجعة', [readyMedia(activity, fallback), fallback]);
  }

  function alignmentWidget(activity) {
    let offset = Number(selectedDraft.alignment || 0);
    const lanes = el('div', { class: 'act-caption-lanes', dir: 'ltr' });
    const meter = text('output', '', 'act-code-line');
    const range = el('input', { type: 'range', min: 0, max: 90, step: 1, value: offset, 'aria-label': 'إزاحة القناة B بالثواني', 'data-alignment-slider': '', disabled: isComplete(activity.id) });
    function draw() {
      lanes.replaceChildren(...[
        { label: 'A', mark: activity.puzzle.markerA, offset: 0 },
        { label: 'B', mark: activity.puzzle.markerB, phrase: activity.puzzle.phraseB, offset },
      ].map(track => el('div', { class: 'act-caption-track' }, [
        text('b', track.label), el('div', { class: 'act-track-line' }, [
          el('span', { class: 'act-calibration-mark', style: `left:${Math.min(98, (track.mark + track.offset) / 100 * 100)}%;`, text: '|||', 'aria-label': `نقرات المعايرة عند ${track.mark} ثانية في القناة ${track.label}` }),
          track.phrase === undefined ? null : el('span', { class: 'act-phrase-mark', style: `left:${Math.min(98, (track.phrase + track.offset))}%;`, text: '◈', 'aria-label': `العبارة عند ${track.phrase} ثانية في القناة ${track.label}` }),
        ]),
      ])));
      meter.textContent = `B + ${offset}s`;
    }
    range.addEventListener('input', () => widgetValue(activity, ['alignment'], Number(range.value)));
    fieldObservers.set('alignment', value => { offset = Number(value || 0); range.value = String(offset); draw(); });
    draw();
    const fallback = details('علامات التزامن المكتوبة', [lanes,
      table(['القناة', 'النقرات الثلاث', 'العبارة'], [['A', '00:48', '—'], ['B', '00:12', '00:37']]),
      text('p', 'هذه علامات من تفريغ E13 وليست موجات صوتية. تظهر الموجات الفعلية في المشغّل بعد تحميل التسجيلات والتحقق منها.', 'act-small'),
    ]);
    return panel('محاذاة قناتي الجلسة', [readyMedia(activity, fallback), el('label', { class: 'act-range-label' }, ['حرّك القناة B حتى تتطابق علامة المعايرة', range]), meter, fallback]);
  }

  function reverseWidget(activity) {
    let reversed = selectedDraft.direction === 'reverse';
    const words = activity.puzzle.segments;
    const display = text('p', '', 'act-reverse-text');
    const toggle = button('اعكس ترتيب المقاطع', () => widgetValue(activity, ['direction'], reversed ? 'forward' : 'reverse'), { 'aria-pressed': String(reversed), 'data-reverse-toggle': '', disabled: isComplete(activity.id) });
    function draw() { display.textContent = (reversed ? [...words].reverse() : words).join(' / '); toggle.setAttribute('aria-pressed', String(reversed)); }
    fieldObservers.set('direction', value => { reversed = value === 'reverse'; draw(); });
    draw();
    const fallback = details('اتجاه المقاطع في التفريغ المكتوب', [display, toggle, text('p', 'ترتيب كلمات مأخوذ من المادة المكتوبة. هذا البديل النصي لا يشغّل تسجيلًا ولا يحاكي صوته.', 'act-small')]);
    return panel('اتجاه المقطع ومصدره', [readyMedia(activity, fallback), fallback, details('مقتطف الإيصال ومسار الجلسة', [
      text('blockquote', 'الأمامي منشور، والخلفي معلق.'),
      text('p', 'قارن العبارة بسياق E13 كاملًا، ثم حدد هل المقتطف مصدر مستقل أم جزء من الجلسة نفسها.'),
    ])]);
  }

  function hashWidget(activity) {
    const files = activity.puzzle?.files || [];
    const list = el('div', { class: 'act-hash-files' });
    const manifestRows = files.map(file => [file.label || file.id, file.sha256 || activity.puzzle?.manifest?.[file.id] || 'راجع بيان الرقمنة']);
    const result = text('p', '', 'act-small');
    const localGeneration = generation;
    const rows = new Map();
    for (const file of files) {
      const digest = text('output', selectedDraft.computedHashes?.[file.id] || 'لم تُحسب بعد', 'act-hash-output');
      const compute = button('احسب بصمة الملف', async () => {
        compute.disabled = true;
        try {
          if (!globalThis.crypto?.subtle) throw new Error('crypto-unavailable');
          const path = file.url || file.path;
          const url = new URL(path, new URL('../', import.meta.url));
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = await response.arrayBuffer();
          const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
          if (destroyed || localGeneration !== generation) return;
          digest.textContent = hash;
          setValue('computedHashes', { ...(selectedDraft.computedHashes || {}), [file.id]: hash }, { immediate: true });
          result.textContent = 'حُسبت البصمة من بايتات الملف الذي حُمّل. قارنها بالسجل قبل اختيار النسخة.';
        } catch {
          if (!destroyed && localGeneration === generation) result.textContent = 'تعذّر حساب البصمة. تحقق من الاتصال وأن الصفحة تعمل عبر HTTPS أو localhost، ثم أعد المحاولة.';
        } finally { if (!destroyed && localGeneration === generation) compute.disabled = false; }
      }, { 'data-hash-file': file.id, disabled: isComplete(activity.id) });
      const row = el('div', { class: 'act-hash-file' }, [text('strong', file.label || file.id), digest, compute]);
      rows.set(file.id, row); list.append(row);
    }
    if (!files.length) result.textContent = 'لا تتوفر ملفات البيان لهذه النسخة. لا يمكن اعتماد فحص بصمات بلا ملفات.';
    return panel('منضدة التحقق من الملفات', [list, result, details('بيان SHA-256 المرجعي', [table(['الملف', 'البصمة المسجلة'], manifestRows)])], '7A41 في ملف 2019 معرّف أرشفة؛ البصمات الطويلة هنا تخص ملفات رقمنة 2026 الجديدة.');
  }

  function siteWidget(activity) {
    let moving = 'lockSite';
    const selectors = el('div', { class: 'act-controls' });
    const map = el('div', { class: 'act-site-map' });
    const labels = {lockSite:'القفل المزال',latchSite:'المزلاج المطلوب إصلاحه'};
    for (const [key,label] of Object.entries(labels)) selectors.append(button(`ضع ${label}`, () => { moving = key; draw(); }, { 'data-map-piece':key,disabled:isComplete(activity.id) }));
    function draw() {
      selectors.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.mapPiece === moving)));
      map.replaceChildren(...activity.puzzle.sites.map(site => el('div', {class:site.id === 'EXT-02' ? 'act-site-cage' : 'act-site-exit'}, [
        text('b',site.id),text('span',site.label),
        ...Object.keys(labels).filter(key => selectedDraft[key] === site.id).map(key => text('i',labels[key],'act-map-marker')),
        button(`ضع هنا: ${labels[moving]}`, () => { widgetValue(activity,[moving],site.id); map.querySelector(`[data-map-target="${site.id}"]`)?.focus({preventScroll:true}); }, { 'data-map-target':site.id,disabled:isComplete(activity.id) }),
      ])));
    }
    fieldObservers.set('lockSite',draw);fieldObservers.set('latchSite',draw);draw();
    return panel('مخطط العلاقات المكانية',[selectors,map], 'اختر عنصرًا ثم موقعه. هذا مخطط للعلاقات في الأوراق؛ لا يحدد مسافات أو يضيف تفاصيل ميدانية.');
  }

  function columnsWidget(activity) {
    const columns = activity.puzzle.columns;
    const permutations = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
    const read = indices => [0,1].map(row => indices.map(index => columns[index].text[row]).join('')).join('');
    let sequence = [...(permutations.find(indices => read(indices) === String(selectedDraft.word || '').toUpperCase()) || [0,1,2])];
    const display = el('div', {class:'act-column-board',dir:'ltr'});
    const output = text('output',read(sequence),'act-code-line');
    function draw() {
      display.replaceChildren(...sequence.map((index,position) => el('div', {class:'act-column-strip'}, [
        text('b',String(columns[index].index)), ...columns[index].text.split('').map(letter => text('span',letter)),
        el('div', {class:'act-column-actions'},[-1,1].map(direction => button(direction < 0 ? '←' : '→', () => {
          const target = position + direction;
          [sequence[position],sequence[target]] = [sequence[target],sequence[position]];
          setValue('word',read(sequence),{immediate:true});draw();
          const moved = display.querySelector(`[data-column-move="${columns[index].index}:${direction}"]`);
          if (moved && !moved.disabled) moved.focus({preventScroll:true});
          else display.querySelector(`[data-column-move="${columns[index].index}:${-direction}"]`)?.focus({preventScroll:true});
        }, {disabled:isComplete(activity.id) || position + direction < 0 || position + direction > 2,'aria-label':`${direction < 0 ? 'قدّم' : 'أخّر'} العمود ${columns[index].index}`,'data-column-move':`${columns[index].index}:${direction}`}))),
      ])));
      output.textContent=read(sequence);
    }
    fieldObservers.set('word',value => {const matching=permutations.find(indices=>read(indices)===String(value).toUpperCase());if(matching){sequence=[...matching];draw();}});
    draw();
    return panel('مفتاح استعادة الحزمة',[
      text('p',`${activity.puzzle.minuend} − ${activity.puzzle.subtrahend}`,'act-code-line'),
      text('p','اطرح كل خانة بمفردها. إذا كان الناتج سالبًا أضف 10، دون استلاف. أعد الأعمدة إلى أرقامها، ثم اقرأ كل صف من اليسار.','act-small'),display,output,
    ]);
  }

  function scanWidget(activity) {
    const diagram=el('div',{class:'act-scan-sample act-corner-sheet'},[text('span','2026 / REVIEW'),text('strong','بطاقة المناولة'),text('span','مشتق رقمي · أصل محفوظ')]);
    const corner=el('span',{class:'act-scan-corner','aria-label':'قطعة الركن'});diagram.append(corner);
    const controls=el('div',{class:'act-controls'}, activity.fields.find(field=>field.key==='corner').options.map(option=>button(option.label,()=>widgetValue(activity,['corner'],option.value),{'data-scan-corner':option.value,disabled:isComplete(activity.id)})));
    function draw(value){corner.dataset.position=value||'';controls.querySelectorAll('button').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.scanCorner===value)));}
    fieldObservers.set('corner',draw);draw(selectedDraft.corner);
    return panel('طاولة إصلاح المسح',[diagram,text('p','ضع قطعة الركن حيث يستمر حدّاها، ثم رتب الشرائط أدناه بعلامات الوصل.','act-small'),controls],activity.puzzle.caption);
  }

  function customWidget(activity) {
    const number = Number(activity.number || String(activity.id).slice(1));
    if (number === 1) return envelopeWidget(activity);
    if (number === 20) return scanWidget(activity);
    if (number === 2) return panel('غلاف الفهرسة والقالب', [
      el('div', { class: `act-scan-sample ${number === 2 ? 'is-envelope' : ''}`, 'aria-hidden': 'true' }, [text('span', '2026 / REVIEW'), text('strong', number === 2 ? '◌  ◌  ▰  ◌' : 'بطاقة المناولة'), text('span', number === 2 ? 'قالب ربط القصاصات' : 'وجهان · أصل محفوظ')]),
      text('p', 'رتّب الأجزاء أدناه بالأسهم؛ تطابق علامات التسجيل يسبق قراءة النتيجة.', 'act-small'),
    ]);
    if (number === 3 || number === 17) return signalWidget(activity, number === 17);
    if (number === 4) return panel('سجل الفهرسة — اقرأ المفقود لا المشطوب', [table(['المجال', 'الموجود', 'المشطوب'], [['21–26', '21،23،25،26', '22'], ['35–40', '35،37،39،40', '36'], ['50–55', '50،51،53،54', '55'], ['61–66', '61،62،64،65', '63']])]);
    if (number === 5) return panel('افحص حدود القص', [text('p', 'قارن التعليق المضاف بما تصفه بطاقة الصورة. احتفظ بما يظهر وما يقع خارج الإطار.'), button('افتح مقارنة الصورة', () => { flushDraft(); (callbacks.openPhoto || callbacks.openEvidence)?.('E06', { tool: 'crop' }); }, { 'data-activity-photo': '' })]);
    if (number === 6) return siteWidget(activity);
    if (number === 7) return panel('ثلاث بطاقات. عنوان واحد.', [
      text('p', 'A1Z26 · 14–15–18–20–8', 'act-code-line'), text('p', '01010010 01000011 00110011 00110001', 'act-code-line'), text('p', '42 4F 58', 'act-code-line'),
      details('مرجع التحويل', [text('p', 'A1Z26: A=1 … Z=26. الثنائي والسداسي هنا يرمزان إلى بايتات ASCII.'), table(['ASCII', 'الحرف'], [[49, '1'], [51, '3'], [66, 'B'], [67, 'C'], [79, 'O'], [82, 'R'], [88, 'X']], { ltr: true })]),
    ]);
    if (number === 9) return routeWidget();
    if (number === 10) return panel('مفاتيح الفهرسة الرمزية', [
      text('p', '○□△☆◇□△ = المستلم', 'act-code-line'), text('p', '○☆◇□○△ = ؟', 'act-code-line'),
      table(['الرمز', 'القيمة'], [['○', 7], ['△', 2], ['□', 9], ['☆', 4]]), text('p', '△ ☆ ○ □', 'act-code-line'),
      details('بطاقة الأحرف الأولى', [text('p', activity.puzzle.acrosticLines.join('\n'))]),
    ]);
    if (number === 11) return panel('قفل الاستبعاد', [table(['المحاولة', 'قيد الفحص'], [['682', 'رقم واحد صحيح وفي مكانه.'], ['614', 'رقم واحد صحيح في مكان خاطئ.'], ['206', 'رقمان صحيحان في مكانين خاطئين.'], ['738', 'لا رقم صحيح.'], ['780', 'رقم واحد صحيح في مكان خاطئ.']])], 'ثلاث خانات مختلفة. الصفر في البداية مسموح.');
    if (number === 12) return panel('اطلب ما يفرّق بين التفسيرين', [text('p', 'هل وقّع الاسم الرابع موافقة على الاتهام، أم استلامًا للأوراق؟ اختر أصلًا يمكن فحص خانته وسياقه.'), text('p', 'يمكنك تدوين توقعك في الملاحظات قبل الطلب. التوقع ليس نتيجة مثبتة ولا يحتسب خطأ.', 'act-small')]);
    if (number === 13) return panel('المرفقات وخانات التوقيع', [el('div', { class: 'act-signature-mat' }, ['LC-14', 'MA-22', 'AR-09', 'RC-31'].map(code => el('div', { class: 'act-signature-slip' }, [text('b', code), text('span', 'راجع خانة التوقيع في الأصل')]))), text('p', 'ثلاثة مرفقات، وإيصال أُودع معها كورقة رابعة. أعد كل توقيع إلى الغرض المكتوب في أصله.', 'act-small')]);
    if (number === 15) return fingerprintWidget(activity);
    if (number === 16) return cameraWidget(activity);
    if (number === 18) return alignmentWidget(activity);
    if (number === 19) return reverseWidget(activity);
    if (number === 21) return columnsWidget(activity);
    if (number === 22) return panel('مطابقة الإصدار قبل استخدام المفتاح', [el('div', { class: 'act-version-cards' }, [
      el('div', {}, [text('b', 'V1'), text('p', '◇3 △1 ○4 □8', 'act-code-line')]),
      el('div', {}, [text('b', 'V2'), text('p', '◇7 △2 ○5 □6', 'act-code-line')]),
    ]), text('p', 'اقرأ إصدار الحزمة المطلوب في سجل الرقمنة، ثم فك ◇ △ ○ □ باستخدام مفتاح الإصدار نفسه.', 'act-small')]);
    if (number === 23) return hashWidget(activity);
    if (number === 24) return panel('المراسلات المستعادة', [text('p', 'رتّب انتقال البطاقة الجديدة من الإيداع إلى الإحالة والنسخ والاستلام والإرفاق. استخدم عبارات الرسائل، لا ترتيب ظهورها في الشاشة.')]);
    if (number === 25) return panel('جدول فريق المراجعة', [details('قرائن ترتيب العمل', [el('ul', {}, [
      'إلياس قبل نورا.', 'لوسيان ثالث أو رابع.', 'التسليم مباشرة بعد نورا.', 'الصيانة مباشرة بعد الجرد.',
      'إلينا ليست صاحبة الصيانة أو الإحالة.', 'نورا ليست صاحبة الجرد أو التسليم.', 'الصيانة قبل التسليم.', 'نورا مباشرة بعد الصيانة.',
    ].map(line => text('li', line)))]), table(['نوع سجل 2026', 'رقم الفهرسة'], [['الجرد', 6], ['صيانة جهاز المسح', 2], ['الإحالة', 8], ['محضر التسليم', 4]])]);
    if (number === 26) return panel('أعد بناء سلسلة إنتاج ADM-04', [text('p', 'ابدأ بمصادر التوقيعات، ثم تتبع النص المضاف والتصدير. اربط الناتج المعتمد بسجل التنفيذ قبل نسبة إنتاجه إلى الحساب.')]);
    if (number === 27) return panel('الزمن الذي تسمح به الأوراق', [text('p', 'استعمل قبل أو بعد عندما توجد علاقة موثقة. اختر «غير محدد» عندما لا يكفي المصدر. لا تستنتج دقيقة أو سببًا من ترتيب الأوراق.')]);
    if (number === 28) return panel('اختبر فرضية اكتمال الحزمة', [text('p', 'لو كانت الحزمة المنشورة كاملة، فما الذي يجب أن يطابق سجل استلام الوجهين؟ قارن التوقع بقائمة الملفات ومقتطف الإيصال.')]);
    if (number === 29) return panel('حدود الإثبات', [text('p', 'فصل النتيجة عن القفزة جزء من التحقيق: مناولة ورقة، والموافقة على نص، وإنتاج محضر، وتحديد منشأ الحريق ليست دعوى واحدة.')]);
    if (number === 30) return panel('سلسلة الادعاء والمصدر', [text('p', 'اختر المصدر والعبارة التي تثبت الادعاء نفسه. تشابه الكلمات لا يكفي إذا تغيّر السياق.')]);
    if (number === 31) return panel('عنوان الحافظة النهائية', [el('div', { class: 'act-meta-address' }, ['الخزانة', 'الدرج', 'الملف'].map(label => el('div', {}, [text('span', label), text('strong', '؟')]))), text('p', 'اجمع علامات الفهرسة التي حصلت عليها، بالترتيب: خزانة، درج، ملف.', 'act-small')]);
    if (number === 32) return panel('قرار المراجعة', [text('p', 'الخلاصة الأصلية للقضية تبقى مستقلة عن تصحيح حزمة2026. أرفق الوجه الخلفي الصحيح، والتزم بما ثبت وبما لم يحسمه الملف.')]);
    return null;
  }

  function render() {
    if (destroyed) return;
    disposeView(); generation++;
    const snap = snapshot();
    if (!canVisit(selectedId)) selectedId = snap.currentActivityId || idOf(ACTIVITIES[currentIndex()]);
    const activity = getActivity(selectedId);
    selectedId = idOf(activity);
    selectedDraft = clone(savedDraft(selectedId));
    const done = isComplete(selectedId);
    const chapterNumber = Number(activity.chapter?.id ?? activity.chapter);
    const chapter = CHAPTERS.find((c, index) => Number(c.id ?? c.number ?? index + 1) === chapterNumber) || CHAPTERS[chapterNumber - 1];
    const chapterTitle = typeof chapter === 'string' ? chapter : chapter?.title || `المرحلة ${arabic(chapterNumber)}`;
    renderedKey = signature(snap);
    const header = el('header', { class: 'act-header' }, [
      el('div', {}, [text('p', 'ملف 017 / مساحة المحقق', 'act-eyebrow'), text('h2', 'كل خطوة تفتح أثرًا.', 'act-heading')]),
      text('p', `${arabic(completed().length)} / ٣٢ مهمة`, 'act-overall-count'),
    ]);
    const chapters = el('nav', { class: 'act-chapters', 'aria-label': 'مراحل التحقيق السبع' }, CHAPTERS.map((entry, index) => {
      const number = Number(entry.id ?? entry.number ?? index + 1);
      const first = ACTIVITIES.find(item => Number(item.chapter?.id ?? item.chapter) === number);
      const all = ACTIVITIES.filter(item => Number(item.chapter?.id ?? item.chapter) === number);
      const allDone = all.length && all.every(item => isComplete(idOf(item)));
      return button(`${arabic(number)}${allDone ? ' ✓' : ''}`, () => openActivity(idOf(first)), {
        class: `act-chapter${number === chapterNumber ? ' is-current' : ''}`, disabled: !first || !canVisit(idOf(first)),
        'aria-label': typeof entry === 'string' ? entry : entry.title,
        'aria-current': number === chapterNumber ? 'step' : undefined,
      });
    }));
    const navigator = details('راجع المهمات المفتوحة', [el('div', { class: 'act-task-index' }, ACTIVITIES.map(item => button(`${arabic(item.number)} · ${item.title}${isComplete(idOf(item)) ? ' ✓' : ''}`, () => openActivity(idOf(item)), {
      disabled: !canVisit(idOf(item)), 'data-activity-open': idOf(item), 'aria-current': idOf(item) === selectedId ? 'step' : undefined,
    })))]);
    const card = el('article', { class: `act-card${done ? ' is-complete' : ''}`, 'data-activity-id': selectedId });
    card.append(text('p', `${chapterTitle} · المهمة ${arabic(activity.number)} من ٣٢`, 'act-eyebrow'), el('h3', { class: 'act-title', text: activity.title, tabindex: '-1' }), text('p', activity.instruction || '', 'act-instruction'), text('p', 'مصدر هذه المهمة · افتحه قبل الفحص', 'act-source-heading'), sources(activity));
    const briefing = (activity.briefing || []).filter(line => line !== activity.instruction);
    if (briefing.length) card.append(el('div', { class: 'act-briefing' }, briefing.map(line => text('p', line))));
    const widget = customWidget(activity); if (widget) card.append(widget);
    const questionId = activity.puzzle?.questionId || ({ 8: 'Q01', 14: 'Q02', 26: 'Q03', 32: 'Q04' })[activity.number];
    const question = services.caseData.questions?.find(q => q.id === questionId);
    if (question) card.append(text('h4', question.prompt, 'act-canonical-question'));
    const form = el('form', { class: 'act-form', novalidate: '', 'aria-label': `حل المهمة ${arabic(activity.number)}` });
    const fields = el('div', { class: 'act-fields' }, (activity.fields || []).map(field => renderField(field, activity)));
    form.append(fields);
    status = el('p', { class: 'act-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', hidden: true });
    const submit = el('button', { class: 'act-button act-primary', type: 'submit', text: 'ثبّت نتيجة الفحص ←', 'data-activity-submit': selectedId, disabled: done || busy });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy || done) return;
      flushDraft(); busy = true; submit.disabled = true; say('جارٍ التحقق من النتيجة…');
      try {
        const result = await engine.submit(selectedId, clone(selectedDraft), crypto.randomUUID(), snapshot().seq);
        if (destroyed) return;
        busy = false;
        if (isComplete(selectedId)) {
          render(); say(result?.message || 'ثبتت النتيجة. يمكنك متابعة المهمة التالية.', 'success');
          shell.querySelector('[data-activity-next]')?.focus({ preventScroll: true });
          if (selectedId === 'A32' && result?.accepted === true && engine.canReport()) callbacks.onCompleted?.();
        } else { renderedKey = signature(snapshot()); submit.disabled = false; say(result?.message || 'راجع الفحص والمصادر المتاحة، ثم جرّب مرة أخرى.', 'error'); }
      } catch { if (!destroyed) { busy = false; submit.disabled = false; say('تعذّر إرسال النتيجة. مسودتك محفوظة؛ أعد المحاولة.', 'error'); } }
    });
    const hintArea = el('div', { class: 'act-hints' });
    const levels = snap.hintsByActivity?.[selectedId];
    const seen = Array.isArray(levels) ? levels : Number.isInteger(levels) ? Array.from({ length: levels }, (_, i) => i + 1) : [];
    for (const level of seen) {
      const hint = activity.hints?.[Number(level) - 1];
      if (hint) hintArea.append(text('p', `${arabic(level)} · ${hint}`, 'act-hint-text'));
    }
    const hint = button(seen.length ? 'تلميح أوضح' : 'أحتاج تلميحًا', async () => {
      if (seen.length >= 3 || done) return;
      flushDraft();
      try {
        const response = await engine.revealHint(selectedId, seen.length + 1, crypto.randomUUID(), snapshot().seq);
        if (!destroyed) {
          render();
          if (response?.message && !response?.ok && !response?.accepted) say(response.message);
        }
      } catch { say('التلميح غير متاح الآن. حاول مجددًا.'); }
    }, { class: 'act-button act-hint-button', disabled: done || seen.length >= 3, 'data-activity-hint': selectedId });
    if (!done) form.append(el('div', { class: 'act-submit-row' }, [submit, hint]));
    form.append(status, hintArea);
    card.append(form);
    if (done) {
      const next = ACTIVITIES[ACTIVITIES.findIndex(item => idOf(item) === selectedId) + 1];
      card.append(el('div', { class: 'act-completed' }, [text('span', '✓ نتيجة مثبتة', 'act-completed-label'),
        next ? button('واصل إلى المهمة التالية ←', () => openActivity(idOf(next)), { class: 'act-button act-primary', 'data-activity-next': idOf(next) })
          : button('اقرأ التقرير النهائي ←', () => callbacks.showReport?.(), { class: 'act-button act-primary', 'data-activity-report': '' }),
        ...(!next ? [button('أعد مشهد النهاية ↻', () => callbacks.replayEnding?.(), { 'data-ending-replay': '' })] : []),
      ]));
      if (question) card.append(text('p', question.explanation, 'act-result-explanation'));
    }
    const footer = el('p', { class: 'act-save-note', text: 'مسودة الفحص محفوظة على هذا الجهاز. يمكنك فتح الأدلة والعودة إلى المهمة.' });
    shell.replaceChildren(header, startGuide(), chapters, navigator, card, footer);
  }

  const unsubscribe = engine.subscribe(() => {
    if (destroyed || localUpdate) return;
    const snap = snapshot();
    const key = signature(snap);
    if (key !== renderedKey && !busy) render();
    else shell.querySelectorAll('[data-activity-source]').forEach(node => {
      const id = node.dataset.activitySource;
      const item = services.caseData.evidence.find(evidence => evidence.id === id);
      const viewed = services.caseStore.get().viewedIds?.includes(id);
      node.textContent = `${item?.reference?.split(' · ')[0] || id} · ${item?.title || 'وثيقة'}${viewed ? ' ✓' : ''}`;
    });
  });
  render();
  return () => {
    flushDraft(); destroyed = true; clearTimeout(saveTimer); unsubscribe?.(); disposeView(); generation++;
    shell.remove();
  };
}
