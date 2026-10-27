import { el } from './core.js?v=0e63bd470374096b';
import { STORAGE_KEY, PEOPLE, PUZZLES, EVIDENCE, PHOTO_HOTSPOTS, RECEIPT_PARTS, CUSTODY_STAMPS, PHONE_EXPORT, CAMERA_LOG } from './last-call-data.js?v=0e63bd470374096b';
import { emptyState, normalizeState, availableEvidence, isUnlocked, solve, confront, accuse, nextPuzzle } from './last-call-engine.js?v=0e63bd470374096b';

const asset = name => new URL(`../assets/${name}`, import.meta.url).href;
const personById = id => PEOPLE.find(person => person.id === id);
const evidenceById = id => EVIDENCE.find(item => item.id === id);
const button = (text, action, attributes = {}) => el('button', { type: 'button', text, onClick: action, ...attributes });
const small = text => el('p', { class: 'lc-small', text });
const tag = text => el('span', { class: 'lc-tag', text });
const paragraph = text => el('p', { text });
const option = (value, text, selected) => el('option', { value, text, selected: value === selected });
const field = (label, control) => el('label', { class: 'lc-field' }, [el('span', { text: label }), control]);
const input = (name, placeholder, value = '') => el('input', { name, value, placeholder, inputmode: 'numeric', autocomplete: 'off', dir: 'ltr', required: true });
const select = (name, placeholder, choices, selected = '') => el('select', { name, required: true }, [option('', placeholder, selected), ...choices.map(([id, title]) => option(id, title, selected))]);

export function mount(root, services) {
  let state = normalizeState(services.store.get(STORAGE_KEY, emptyState()));
  let tab = 'workbench';
  let active = nextPuzzle(state) || 'confrontation';
  let disposed = false;
  let openDialog;
  let resetArmed = false;
  let statusTimer;
  const asked = new Set();
  const draft = {
    photo: new Set(state.solved.includes('photo') ? ['drive', 'ledger', 'phone'] : []),
    message: state.solved.includes('message') ? { recorded: PHONE_EXPORT.recorded, delivered: PHONE_EXPORT.delivered, meaning: PHONE_EXPORT.mode } : {},
    clock: state.solved.includes('clock') ? { offset: '7', entry: '22:07', exit: '22:09' } : {},
    receipt: { order: state.solved.includes('receipt') ? RECEIPT_PARTS.map(part => part.id) : ['approval', 'footer', 'header', 'item'], changed: state.solved.includes('receipt') ? 'ledger' : '' },
    custody: { order: state.solved.includes('custody') ? CUSTODY_STAMPS.map(stamp => stamp.personId) : ['mazen', 'reem', 'layan', 'sarah', 'raed', 'yusuf'] },
    verdict: { culprit: '', accomplice: '', evidenceIds: [] },
  };
  const page = el('div', { class: 'lc-page', lang: 'ar', dir: 'rtl' });
  const status = el('p', { class: 'lc-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', 'data-lc-status': '' });
  const content = el('div', { class: 'lc-content' });
  root.append(page);

  function save() { services.store.set(STORAGE_KEY, state); }
  function announce(message, ok = true) {
    status.textContent = message;
    status.classList.toggle('lc-status-error', !ok);
    status.classList.add('lc-status-visible');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => status.classList.remove('lc-status-visible'), 9000);
  }
  function focusAfter(selector = '[data-lc-panel-heading]') {
    requestAnimationFrame(() => {
      if (disposed) return;
      const target = page.querySelector(selector);
      target?.focus({ preventScroll: true });
      if (target) target.scrollIntoView({ block: selector === '[data-lc-panel-heading]' ? 'start' : 'nearest', behavior: 'instant' });
    });
  }
  function displayEvidence(id, opener) {
    const item = availableEvidence(state).find(entry => entry.id === id);
    if (!item) return;
    if (!state.inspected.includes(id)) { state = { ...state, inspected: [...state.inspected, id] }; save(); }
    openDialog?.close();
    const dialog = el('dialog', { class: 'lc-evidence-dialog', 'aria-labelledby': 'lc-document-title', dir: 'rtl', lang: 'ar' }, [
      el('div', { class: 'lc-document-top' }, [el('span', { text: 'RAVEN / EVIDENCE', dir: 'ltr' }), button('إغلاق ×', () => dialog.close(), { autofocus: true, 'aria-label': 'إغلاق الدليل' })]),
      el('article', { class: 'lc-document' }, [el('p', { class: 'lc-eyebrow', text: item.source }), el('h2', { id: 'lc-document-title', text: item.title }), ...item.body.map(paragraph)]),
    ]);
    dialog.addEventListener('close', () => { dialog.remove(); if (openDialog === dialog) openDialog = null; if (!disposed && opener?.isConnected) opener.focus(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
    page.append(dialog); openDialog = dialog; dialog.showModal();
  }
  function evidenceButton(id) {
    const item = evidenceById(id);
    const control = button(item?.title || id, () => displayEvidence(id, control), { class: 'lc-source-link', 'data-lc-evidence': id });
    return control;
  }
  function changeTab(next) { tab = next; resetArmed = false; render(); focusAfter(); }
  function complete(id, answer) {
    const result = solve(state, id, answer);
    if (result.ok) { state = result.state; save(); }
    render(); announce(result.message, result.ok); focusAfter(result.ok ? '[data-lc-next]' : '[data-lc-panel-heading]');
  }
  function progressHeader() {
    return el('div', { class: 'lc-workspace-heading' }, [
      el('div', {}, [el('p', { class: 'lc-eyebrow', text: 'ملف 018 / مكتب التحقيق' }), el('h1', { text: 'آخر اتصال' })]),
      el('div', { class: 'lc-progress-meta' }, [el('span', { text: `${state.solved.length} / 6`, dir: 'ltr' }), small(state.accusation ? 'اكتملت القضية' : 'استنتاجات مثبتة'), small('تقدمك محفوظ على هذا الجهاز')]),
    ]);
  }
  function opening() {
    return el('section', { class: 'lc-intro' }, [
      el('div', { class: 'lc-cover' }, [el('img', { src: asset('last-call-cover.webp'), alt: '', width: 1672, height: 941, fetchpriority: 'high' }), el('span', { class: 'lc-cover-index', text: 'CASE / 018', dir: 'ltr' })]),
      el('div', { class: 'lc-intro-copy' }, [
        el('p', { class: 'lc-eyebrow', text: 'ست إفادات. رسالة واحدة. وتوقيت لا يستقيم.' }),
        el('h1', {}, ['آخر ', el('em', { text: 'اتصال' })]),
        paragraph('وصلت رسالة ناصر عند 22:17. لكن الواقعة سبقتها. ستة أشخاص مرّ بينهم عقد واحد… وكل واحد يخفي جزءًا من الليلة.'),
        el('div', { class: 'lc-intro-facts' }, [tag('٦ شخصيات'), tag('٦ أدوات تحقيق'), tag('تجربة مجانية كاملة')]),
        button('افتح ملف القضية ←', () => { state = { ...state, started: true }; save(); render(); focusAfter(); }, { class: 'button primary', 'data-lc-start': '' }),
        small('افحص المشهد، اضبط الزمن، ثم واجه كل شخص بما تستطيع إثباته. يمكنك التوقف والعودة من مكانك.'),
        el('p', { class: 'lc-content-note', text: 'قضية خيالية تتناول جريمة قتل، دون مشاهد عنف صريحة.' }),
        el('a', { class: 'lc-intro-archive', href: services.routeURL('case-017/'), text: 'تابع القضية السابقة من الأرشيف ↗' }),
      ]),
    ]);
  }
  function rail() {
    const nav = el('nav', { class: 'lc-stage-rail', 'aria-label': 'مراحل التحقيق' }, [el('p', { class: 'lc-eyebrow', text: 'مسار القضية' })]);
    PUZZLES.forEach((puzzle, index) => {
      const done = state.solved.includes(puzzle.id), unlocked = isUnlocked(state, puzzle.id);
      const item = button('', () => { active = puzzle.id; tab = 'workbench'; render(); focusAfter(); }, { class: 'lc-stage', 'data-lc-step': puzzle.id, disabled: !unlocked, 'aria-current': active === puzzle.id && tab === 'workbench' ? 'step' : undefined });
      item.append(el('span', { class: 'lc-stage-number', text: done ? '✓' : String(index + 1).padStart(2, '0'), 'aria-hidden': 'true' }), el('span', {}, [el('strong', { text: puzzle.title }), el('small', { text: done ? 'استنتاج مثبت' : unlocked ? 'متاح للفحص' : 'يفتح بعد المرحلة السابقة' })])); nav.append(item);
    });
    nav.append(button('07 / محضر الاتهام', () => changeTab('verdict'), { class: 'lc-stage lc-verdict-step', 'data-lc-tab': 'verdict', 'aria-current': tab === 'verdict' ? 'step' : undefined }), el('a', { class: 'lc-archive-link', href: services.routeURL('case-017/'), text: 'أرشيف القضية السابقة ↗' }));
    return nav;
  }
  function tabs() {
    const available = availableEvidence(state);
    return el('nav', { class: 'lc-tabs', 'aria-label': 'أدوات المحقق' }, [
      ...[['workbench', 'الفحص'], ['evidence', `الأدلة · ${available.length}`], ['people', `الإفادات · ${state.confronted.length}/6`], ['notes', 'دفتر المحقق']].map(([id, title]) => button(title, () => changeTab(id), { 'data-lc-tab': id, 'aria-pressed': String(tab === id) })),
    ]);
  }
  function panelHeading(title, subtitle) {
    return el('header', { class: 'lc-panel-heading' }, [el('h2', { text: title, tabindex: -1, 'data-lc-panel-heading': '' }), subtitle ? paragraph(subtitle) : null]);
  }
  function formFor(id, children, read) {
    const form = el('form', { class: 'lc-puzzle-form', 'data-lc-form': id }, [...children, button('ثبّت الاستنتاج ←', null, { type: 'submit', class: 'button primary', 'data-lc-submit': id })]);
    form.addEventListener('submit', event => { event.preventDefault(); const data = new FormData(form); complete(id, read(data)); });
    return form;
  }
  function diagram({ interactive = false, after = false } = {}) {
    const desk = el('div', { class: `lc-desk${after ? ' lc-desk-after' : ''}`, role: interactive ? 'group' : 'img', 'aria-label': after ? 'المكتب بعد الواقعة: ملف رمادي مكان الدفتر الأزرق، الهاتف ووحدة النسخ في موضعهما' : 'إعادة بناء المكتب: هاتف ووحدة نسخ ودفتر أزرق' });
    desk.append(el('div', { class: 'lc-desk-grain', 'aria-hidden': 'true' }), el('div', { class: 'lc-desk-lamp', 'aria-hidden': 'true' }), el('div', { class: 'lc-desk-cup', 'aria-hidden': 'true' }), el('div', { class: 'lc-desk-cable', 'aria-hidden': 'true' }));
    const props = [
      ['phone', 'الهاتف', 'lc-prop-phone', [el('span', { class: 'lc-phone-speaker', 'aria-hidden': 'true' }), el('span', { class: 'lc-phone-time', text: '22:17', dir: 'ltr' }), el('span', { class: 'lc-phone-notice', text: 'إرسال مجدول' })]],
      ['drive', 'وحدة النسخ', 'lc-prop-drive', [el('span', { class: 'lc-drive-dot', 'aria-hidden': 'true' }), el('span', { text: 'RAW / S-02', dir: 'ltr' })]],
      ['ledger', after ? 'الملف الرمادي' : 'الدفتر الأزرق', after ? 'lc-prop-folder' : 'lc-prop-ledger', [el('span', { class: 'lc-ledger-line', 'aria-hidden': 'true' }), el('span', { text: after ? 'ملف التسليم' : 'دفتر العقود' }), el('small', { text: after ? '22:18' : 'N / 018', dir: 'ltr' })]],
    ];
    props.forEach(([id, label, className, contents]) => {
      const prop = interactive ? button('', () => {
        draft.photo.add(id);
        const details = page.querySelector('[data-lc-observation]');
        details.replaceChildren(el('strong', { text: PHOTO_HOTSPOTS.find(item => item.id === id)?.label || label }), paragraph(PHOTO_HOTSPOTS.find(item => item.id === id)?.detail || 'تم تسجيل العنصر للفحص.'));
        prop.classList.add('lc-prop-found'); prop.setAttribute('aria-pressed', 'true');
        page.querySelector('[data-lc-found-count]').textContent = `${draft.photo.size} / 3 عناصر مفحوصة`;
        announce(`فحصت ${label}.`);
      }, { class: `lc-prop ${className}${draft.photo.has(id) ? ' lc-prop-found' : ''}`, 'data-hotspot': id, 'aria-label': `افحص ${label}`, 'aria-pressed': String(draft.photo.has(id)) }) : el('div', { class: `lc-prop ${className}` });
      prop.append(...contents); desk.append(prop);
    });
    desk.append(el('div', { class: 'lc-desk-caption', text: after ? '22:20 / بعد تسليم ريم' : '21:53 / قبل الواقعة', dir: 'rtl' }));
    return desk;
  }
  function photoPuzzle() {
    return formFor('photo', [
      el('figure', { class: 'lc-scene' }, [diagram({ interactive: true }), el('figcaption', { text: 'إعادة بناء مسرح الواقعة · اضغط على الأشياء لفحصها' })]),
      el('div', { class: 'lc-observation', 'data-lc-observation': '' }, [el('strong', { text: 'الصورة لا تقول كل شيء من النظرة الأولى.' }), paragraph('ابدأ بثلاثة أشياء على المكتب. لاحظ اختلاف ما يظهر في النسخة الكاملة وما أخفته سارة من الصورة المتداولة.')]),
      el('div', { class: 'lc-inline-meta' }, [el('span', { 'data-lc-found-count': '', text: `${draft.photo.size} / 3 عناصر مفحوصة` }), evidenceButton('scene')]),
    ], () => ({ hotspots: [...draft.photo] }));
  }
  function messagePuzzle() {
    const d = draft.message;
    const form = formFor('message', [
      el('div', { class: 'lc-phone-export' }, [el('div', { class: 'lc-export-top', text: 'نسخة محفوظة من سجل الهاتف' }), el('blockquote', { text: PHONE_EXPORT.text }), el('dl', { class: 'lc-log' }, [el('dt', { text: 'إنشاء التسجيل' }), el('dd', { text: PHONE_EXPORT.recorded, dir: 'ltr' }), el('dt', { text: 'التسليم إلى المستلمين' }), el('dd', { text: PHONE_EXPORT.delivered, dir: 'ltr' }), el('dt', { text: 'طريقة الإرسال' }), el('dd', { text: 'إرسال لاحق / مهمة محفوظة' })])]),
      el('div', { class: 'lc-field-grid' }, [field('وقت تسجيل الرسالة', input('recorded', 'HH:MM', d.recorded)), field('وقت وصول الرسالة', input('delivered', 'HH:MM', d.delivered))]),
      field('ماذا يثبت وصولها؟', select('meaning', 'اختر الاستنتاج', [['alive', 'أن ناصر كان حيًا وقت وصول الرسالة'], ['scheduled', 'أن موعد التسليم مختلف عن وقت التسجيل'], ['forged', 'أن الصوت مزوّر بالضرورة']], d.meaning)),
      evidenceButton('report'),
    ], data => ({ recorded: data.get('recorded'), delivered: data.get('delivered'), meaning: data.get('meaning') }));
    form.addEventListener('input', () => Object.assign(d, Object.fromEntries(new FormData(form))));
    return form;
  }
  function clockPuzzle() {
    const d = draft.clock;
    const form = formFor('clock', [
      el('div', { class: 'lc-camera-grid' }, [
        el('article', { class: 'lc-camera-card' }, [el('span', { class: 'lc-camera-label', text: 'الحدث المرجعي / ومضة البوابة' }), el('strong', { text: CAMERA_LOG.referenceCamera, dir: 'ltr' }), small(`وقت النظام المستقل: ${CAMERA_LOG.referenceReal}`)]),
        el('article', { class: 'lc-camera-card lc-camera-dark' }, [el('span', { class: 'lc-camera-label', text: 'ممر الأرشيف / شاشة الكاميرا' }), el('div', { class: 'lc-camera-times', dir: 'ltr' }, [el('strong', { text: CAMERA_LOG.entryCamera }), el('span', { text: '→' }), el('strong', { text: CAMERA_LOG.exitCamera })]), small('الدخول ← الخروج')]),
      ]),
      el('div', { class: 'lc-source-row' }, [evidenceButton('maintenance'), evidenceButton('reference')]),
      field('كم دقيقة تتقدم ساعة الكاميرا؟', input('offset', 'عدد الدقائق', d.offset)),
      el('div', { class: 'lc-field-grid' }, [field('وقت الدخول الحقيقي', input('entry', 'HH:MM', d.entry)), field('وقت الخروج الحقيقي', input('exit', 'HH:MM', d.exit))]),
      small('طابق الومضة أولًا، ثم طبّق الفرق نفسه على الدخول والخروج. لا تغيّر ساعة سجل البطاقات.'),
    ], data => ({ offset: data.get('offset'), entry: data.get('entry'), exit: data.get('exit') }));
    form.addEventListener('input', () => Object.assign(d, Object.fromEntries(new FormData(form))));
    return form;
  }
  function reorder(id, entries) {
    const list = el('ol', { class: 'lc-reorder', 'data-lc-reorder': id, 'aria-label': id === 'receipt' ? 'رتب قصاصات محضر التسليم' : 'رتب مسار نسخة العقد' });
    draft[id].order.forEach((itemId, index) => {
      const entry = entries.find(item => item.id === itemId);
      const row = el('li', { 'data-item': itemId }, [el('span', { class: 'lc-order-index', text: String(index + 1).padStart(2, '0'), 'aria-hidden': 'true' }), el('div', { class: 'lc-order-text' }, [el('strong', { text: entry.title }), entry.detail ? small(entry.detail) : null])]);
      const move = delta => {
        const order = draft[id].order; [order[index], order[index + delta]] = [order[index + delta], order[index]];
        render(); announce('تغيّر الترتيب. اقرأ التسلسل قبل تثبيته.');
        const newIndex = index + delta; const direction = newIndex === 0 ? 'down' : 'up';
        focusAfter(`[data-lc-reorder="${id}"] [data-item="${itemId}"] [data-move="${direction}"]`);
      };
      row.append(el('div', { class: 'lc-order-controls' }, [button('↑', () => move(-1), { disabled: index === 0, 'data-move': 'up', 'aria-label': `ارفع ${entry.title}` }), button('↓', () => move(1), { disabled: index === draft[id].order.length - 1, 'data-move': 'down', 'aria-label': `أنزل ${entry.title}` })]));
      list.append(row);
    });
    return list;
  }
  function comparison() {
    const after = el('div', { class: 'lc-compare-after' }, [diagram({ after: true })]);
    const view = el('div', { class: 'lc-compare-view', style: '--reveal:50%' }, [diagram(), after, el('span', { class: 'lc-compare-line', 'aria-hidden': 'true' })]);
    const range = el('input', { type: 'range', min: 0, max: 100, value: 50, step: 1, dir: 'ltr', 'aria-label': 'مقارنة المكتب قبل وبعد الواقعة', 'aria-valuetext': 'نصف المشهد قبل ونصفه بعد' });
    const set = value => { range.value = value; view.style.setProperty('--reveal', `${value}%`); range.setAttribute('aria-valuetext', `${value}% من المشهد بعد الواقعة`); };
    range.addEventListener('input', () => set(range.value));
    return el('figure', { class: 'lc-comparison' }, [view, el('div', { class: 'lc-compare-controls' }, [button('قبل الواقعة', () => set(0)), range, button('بعد الواقعة', () => set(100))]), el('figcaption', { text: 'حرّك الفاصل لكشف التغيير. لوحتان لإعادة بناء المكتب من صورتين في ملف القضية.' })]);
  }
  function receiptPuzzle() {
    const form = formFor('receipt', [
      el('div', { class: 'lc-task-label', text: '01 / ركّب محضر التسليم' }),
      small('وجدت أربع قصاصات. أعد ترتيبها من عنوان المحضر إلى نهايته، ثم قارن محتواه بالمكتب.'),
      reorder('receipt', RECEIPT_PARTS.map(part => ({ id: part.id, title: part.text }))),
      el('div', { class: 'lc-task-label', text: '02 / قارن المشهدين' }), comparison(),
      field('ما الذي تغيّر بين الصورتين؟', select('changed', 'اختر الأثر الذي يفسّر التسليم', [['phone', 'الهاتف اختفى من المكتب'], ['ledger', 'الدفتر الأزرق استُبدل بملف رمادي'], ['drive', 'وحدة النسخ انتقلت إلى يسار المكتب']], draft.receipt.changed)),
    ], data => ({ order: [...draft.receipt.order], changed: data.get('changed') }));
    form.addEventListener('change', event => { if (event.target.name === 'changed') draft.receipt.changed = event.target.value; });
    return form;
  }
  function custodyPuzzle() {
    return formFor('custody', [
      el('div', { class: 'lc-task-label', text: 'نسخة العقد / من الماسح إلى المستلمة' }),
      paragraph('وصلت نسخة معدّلة من العقد إلى ليان. رتّب الأختام من الأقدم إلى الأحدث لتتبع انتقال ملف العقد من الأصل إلى النسخة المعدّلة، ثم ارجع إلى إفاداتهم. تداول الورقة وحده لا يثبت القتل.'),
      reorder('custody', CUSTODY_STAMPS.map(stamp => ({ id: stamp.personId, title: `${personById(stamp.personId).name} · ${stamp.time}`, detail: stamp.text }))),
      evidenceButton('ledger'),
    ], () => ({ order: [...draft.custody.order] }));
  }
  function personCard(person) {
    const confirmed = state.confronted.includes(person.id);
    const evidence = availableEvidence(state);
    const control = select('evidence', 'اختر دليلًا للمواجهة', evidence.map(item => [item.id, item.title]));
    const form = el('form', { class: 'lc-confront-form' }, [field('اعرض دليلًا يناقض الإفادة', control), button(confirmed ? 'الإفادة المعدلة مثبتة ✓' : 'واجه بالدليل ←', null, { type: 'submit', 'data-lc-confront': person.id, disabled: confirmed })]);
    form.addEventListener('submit', event => {
      event.preventDefault(); const result = confront(state, person.id, control.value);
      if (result.ok) { state = result.state; save(); }
      render(); announce(result.message, result.ok); focusAfter(`[data-lc-person="${person.id}"] h3`);
    });
    return el('article', { class: `lc-person${confirmed ? ' lc-person-confirmed' : ''}`, 'data-lc-person': person.id }, [
      el('header', { class: 'lc-person-heading' }, [el('span', { class: 'lc-person-monogram', 'aria-hidden': 'true', text: person.name.charAt(0) }), el('div', {}, [el('h3', { text: person.name, tabindex: -1 }), small(person.role)]), confirmed ? tag('إفادة معدلة') : null]),
      el('p', { class: 'lc-statement-label', text: 'الإفادة الأولى' }), el('blockquote', { text: person.initial }),
      button(person.question, () => { asked.add(person.id); render(); focusAfter(`[data-lc-answer="${person.id}"]`); }, { class: 'lc-question', 'aria-expanded': String(asked.has(person.id)) }),
      asked.has(person.id) ? el('p', { class: 'lc-answer', text: person.response, tabindex: -1, 'data-lc-answer': person.id }) : null,
      confirmed ? el('div', { class: 'lc-corrected' }, [el('strong', { text: 'بعد عرض الدليل' }), paragraph(person.confrontation.response), evidenceButton(person.confrontation.evidenceId)]) : form,
    ]);
  }
  function peoplePanel(insideStep = false) {
    return el('div', { class: 'lc-people-panel' }, [
      !insideStep ? panelHeading('ستة أشخاص. ست نسخ من الليلة.', 'اسمع الإفادة، ثم اعرض دليلًا يختبرها. الخوف أو الكذب لا يكفيان وحدهما لإثبات القتل.') : null,
      el('div', { class: 'lc-person-grid' }, PEOPLE.map(personCard)),
      small('الحوارات مكتوبة ضمن القضية، وتبقى مجانية حتى النهاية. الحوار الحر بالذكاء الاصطناعي إضافة مستقبلية اختيارية.'),
      insideStep ? button('ثبّت مراجعة الإفادات ←', () => complete('confrontation', { confirmed: true }), { class: 'button primary', 'data-lc-submit': 'confrontation' }) : null,
    ]);
  }
  function workbench() {
    const puzzle = PUZZLES.find(item => item.id === active) || PUZZLES[0];
    const solved = state.solved.includes(puzzle.id);
    const hintCount = state.hints[puzzle.id] || 0;
    const next = nextPuzzle(state);
    const clueSources = (puzzle.evidence || []).filter(id => availableEvidence(state).some(item => item.id === id));
    const puzzleRenderers = { photo: photoPuzzle, message: messagePuzzle, clock: clockPuzzle, receipt: receiptPuzzle, custody: custodyPuzzle, confrontation: () => peoplePanel(true) };
    return el('section', { class: 'lc-panel', 'data-lc-active-puzzle': puzzle.id }, [
      el('div', { class: 'lc-panel-topline' }, [el('p', { class: 'lc-eyebrow', text: puzzle.kicker }), tag(solved ? 'مثبت ✓' : 'قيد الفحص')]),
      panelHeading(puzzle.title, puzzle.brief),
      solved ? el('div', { class: 'lc-solved-banner' }, [el('strong', { text: 'حُفظ هذا الاستنتاج في ملفك.' }), paragraph('يمكنك مراجعة الأداة والأدلة أو مواصلة التحقيق.'), button(next ? 'انتقل إلى الاستنتاج التالي ←' : 'افتح محضر الاتهام ←', () => { if (next) { active = next; render(); focusAfter(); } else changeTab('verdict'); }, { class: 'button primary', 'data-lc-next': '' })]) : null,
      puzzleRenderers[puzzle.id](),
      clueSources.length ? el('div', { class: 'lc-source-row' }, [el('span', { class: 'lc-small', text: 'مراجع هذه المرحلة:' }), ...clueSources.map(evidenceButton)]) : null,
      el('aside', { class: 'lc-hints' }, [
        button(hintCount ? `تلميح إضافي (${Math.min(hintCount + 1, 3)}/3)` : 'أحتاج تلميحًا', () => { state = { ...state, hints: { ...state.hints, [puzzle.id]: Math.min(3, hintCount + 1) } }; save(); render(); focusAfter('[data-lc-hint]'); }, { class: 'lc-hint-button', disabled: hintCount >= 3 }),
        ...puzzle.hints.slice(0, hintCount).map((hint, index) => el('p', { class: 'lc-hint', text: `${index + 1}. ${hint}`, tabindex: -1, 'data-lc-hint': index === hintCount - 1 ? '' : undefined })),
      ]),
    ]);
  }
  function evidencePanel() {
    const evidence = availableEvidence(state);
    return el('section', { class: 'lc-panel' }, [panelHeading('الأدلة', 'كل مستند هنا له مصدر. افصل بين ما يقوله الدليل وما تتوقعه أنت.'),
      el('div', { class: 'lc-evidence-grid' }, evidence.map((item, index) => {
        const card = button('', () => displayEvidence(item.id, card), { class: 'lc-evidence-card', 'data-lc-evidence': item.id });
        card.append(el('span', { class: 'lc-document-number', text: `DOC / ${String(index + 1).padStart(2, '0')}`, dir: 'ltr' }), el('strong', { text: item.title }), small(item.source), el('span', { class: 'lc-card-footer', text: state.inspected.includes(item.id) ? 'تمت المراجعة · افتح مجددًا ↗' : 'افتح المستند ↗' })); return card;
      })), small(`${evidence.length} من ${EVIDENCE.length} مستندًا متاحًا. يفتح الباقي بعد ربط الأدلة في مراحل الفحص.`)]);
  }
  function notesPanel() {
    const text = el('textarea', { id: 'lc-notes', rows: 10, maxlength: 4000, placeholder: 'من غيّر إفادته؟ ما المصدر؟ ما الذي لم يثبت بعد؟', 'data-lc-notes': '' }); text.value = state.notes;
    const count = small(`${state.notes.length} / 4000`);
    text.addEventListener('input', () => { state = { ...state, notes: text.value.slice(0, 4000) }; save(); count.textContent = `${state.notes.length} / 4000 · محفوظ`; });
    return el('section', { class: 'lc-panel' }, [panelHeading('دفتر المحقق', 'دوّن فرضيتك، وما يؤيدها، وما قد ينقضها. تحفظ الملاحظات تلقائيًا على جهازك.'), field('ملاحظات القضية', text), count,
      el('div', { class: 'lc-reset' }, [el('h3', { text: 'بدء تحقيق جديد' }), paragraph('يمسح تقدم «آخر اتصال» وملاحظاتها على هذا الجهاز فقط.'),
        button(resetArmed ? 'تأكيد مسح التقدم والبدء من جديد' : 'إعادة القضية', () => { if (!resetArmed) { resetArmed = true; render(); focusAfter('[data-lc-reset]'); return; } state = emptyState(); save(); active = 'photo'; tab = 'workbench'; draft.photo.clear(); draft.message = {}; draft.clock = {}; draft.receipt = { order: ['approval', 'footer', 'header', 'item'], changed: '' }; draft.custody.order = ['mazen', 'reem', 'layan', 'sarah', 'raed', 'yusuf']; draft.verdict = { culprit: '', accomplice: '', evidenceIds: [] }; asked.clear(); resetArmed = false; render(); focusAfter('[data-lc-start]'); }, { 'data-lc-reset': '', class: resetArmed ? 'lc-danger-button' : '' }),
        resetArmed ? button('احتفظ بتقدمي', () => { resetArmed = false; render(); focusAfter(); }) : null,
      ])]);
  }
  function verdictPanel() {
    if (state.accusation) return ending();
    const d = draft.verdict;
    const form = el('form', { class: 'lc-verdict-form' }, [
      el('div', { class: 'lc-field-grid' }, [field('المسؤول عن مقتل ناصر', select('culprit', 'اختر الشخص', PEOPLE.map(p => [p.id, p.name]), d.culprit)), field('من تستّر على الأدلة بعد الواقعة؟', select('accomplice', 'اختر الشخص', PEOPLE.map(p => [p.id, p.name]), d.accomplice))]),
      el('fieldset', { class: 'lc-proof-picker' }, [el('legend', { text: 'اختر ثلاثة أدلة: زمن الرسالة، الدخول إلى الأرشيف، ودافع تغيير العقد.' }), ...availableEvidence(state).map(item => el('label', {}, [el('input', { type: 'checkbox', name: 'evidenceIds', value: item.id, checked: d.evidenceIds.includes(item.id) }), el('span', { text: item.title })]))]),
      button('قدّم محضر الاتهام ←', null, { type: 'submit', class: 'button primary', 'data-lc-accuse': '' }),
    ]);
    form.addEventListener('change', () => { const data = new FormData(form); Object.assign(d, { culprit: data.get('culprit'), accomplice: data.get('accomplice'), evidenceIds: data.getAll('evidenceIds') }); });
    form.addEventListener('submit', event => { event.preventDefault(); const data = new FormData(form); const result = accuse(state, { culprit: data.get('culprit'), accomplice: data.get('accomplice'), evidenceIds: data.getAll('evidenceIds') }); if (result.ok) { state = result.state; save(); } render(); announce(result.message, result.ok); focusAfter(); });
    return el('section', { class: 'lc-panel' }, [panelHeading('محضر الاتهام', 'سمّ المسؤول، ميّز القتل عن التستر، واربط قرارك بأدلة محددة. لن يتحول التخمين إلى حكم.'),
      el('div', { class: 'lc-verdict-readiness' }, [tag(`${state.solved.length}/6 استنتاجات`), tag(`${state.confronted.length}/6 إفادات مراجعة`)]),
      state.solved.length < 6 ? paragraph('لا يزال الملف مفتوحًا. يمكنك ترتيب فرضيتك الآن؛ يثبت المحضر بعد استكمال الفحص ومواجهة الشخصيات الست.') : null,
      form,
    ]);
  }
  function ending() {
    return el('section', { class: 'lc-panel lc-ending', 'data-lc-ending': '' }, [
      el('p', { class: 'lc-eyebrow', text: 'CASE 018 / CLOSED', dir: 'ltr' }), panelHeading('وصلت الرسالة. وانكشف ما قبلها.', 'ربطت زمن الرسالة، وهوية الداخل، والعقد المعدّل. لم تكن الساعة المتأخرة دليل نجاة.'),
      el('div', { class: 'lc-ending-finding' }, [el('span', { class: 'lc-finding-time', text: '22:07–22:09', dir: 'ltr' }), el('div', {}, [el('h3', { text: 'رائد: المسؤول عن مقتل ناصر' }), paragraph('دخل الأرشيف في 22:07 وخرج في 22:09. تتقاطع هويته وسجل بطاقته مع نافذة الواقعة ودافع إخفاء التزوير. الرسالة التي وصلت في 22:17 سُجّلت قبل ذلك بنصف ساعة.')])]),
      el('div', { class: 'lc-ending-finding lc-ending-secondary' }, [el('span', { class: 'lc-finding-time', text: '22:18', dir: 'ltr' }), el('div', {}, [el('h3', { text: 'ريم: تستّر بعد الواقعة' }), paragraph('استبدلت الدفتر وغيّرت محضر التسليم. وجودها في البوابة خلال نافذة الواقعة يفصل فعل التستر عن فعل القتل.')])]),
      el('h3', { class: 'lc-outcomes-title', text: 'دور كل شخص في الصورة الكاملة' }),
      el('div', { class: 'lc-outcomes' }, PEOPLE.map(person => el('article', {}, [el('h3', { text: person.name }), small(person.role), paragraph(person.outcome)]))),
      el('div', { class: 'lc-ending-actions' }, [button('راجع أدلة القضية', () => changeTab('evidence'), { class: 'button primary' }), button('افتح دفتر المحقق', () => changeTab('notes')), el('a', { class: 'button', href: services.routeURL(''), text: 'العودة إلى رايفن ←' })]),
      small('أكملت القضية بالحوارات والأدوات المجانية. لا يتطلب الحل شراء أي إضافة.'),
    ]);
  }
  function render() {
    if (disposed) return;
    if (!state.started) { page.replaceChildren(opening(), status); return; }
    const workspace = el('div', { class: 'lc-workspace' }, [rail(), content]);
    page.replaceChildren(progressHeader(), workspace, status);
    const panel = tab === 'evidence' ? evidencePanel() : tab === 'people' ? el('section', { class: 'lc-panel' }, [peoplePanel()]) : tab === 'notes' ? notesPanel() : tab === 'verdict' ? verdictPanel() : workbench();
    content.replaceChildren(tabs(), panel);
  }
  render();
  return () => { disposed = true; clearTimeout(statusTimer); openDialog?.close(); page.remove(); };
}
