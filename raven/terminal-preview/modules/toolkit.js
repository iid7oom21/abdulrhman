import { el } from './core.js?v=6d062d5989d21c42';
import { renderResumeMemo } from './resume-memo.js?v=6d062d5989d21c42';

const TYPES = ['ملاحظة', 'فرضية', 'سؤال'];
const RELATIONS = ['يؤيد', 'يعارض', 'يفسر', 'يحتاج تحققًا'];
const BUCKETS = [
  ['before', 'قبل الحريق'], ['after', 'بعد الحريق'],
  ['reopened', 'إعادة الفتح · 2026'], ['unknown', 'غير محدد'],
];
const TOOL_LIST = [
  ['magnifier', '01', 'العدسة المكبرة', 'اقترب من التفاصيل الموجودة في الصورة.', 'فحص'],
  ['crop', '02', 'حدود القص', 'قارن ما ظهر بما خرج من الإطار.', 'فحص'],
  ['compare', '03', 'مقارنة وثيقتين', 'ضع المصدرين أمامك.', 'فحص'],
  ['highlight', '04', 'قلم التحديد', 'احتفظ بالفقرة التي تستحق العودة.', 'فحص'],
  ['notes', '05', 'ملاحظاتي', 'كل ملاحظة تحمل مصدرها.', 'تنظيم'],
  ['board', '06', 'لوحة الخيوط', 'اربط الأدلة وسمِّ العلاقة بينها.', 'تنظيم'],
  ['timeline', '07', 'ترتيب الأحداث', 'رتب ما قرأته، واترك المجهول مفتوحًا.', 'تنظيم'],
  ['search', '08', 'بحث في الملفات', 'ابحث داخل الأوراق التي فتحتها.', 'تنظيم'],
  ['hypotheses', '09', 'دفتر الفرضيات', 'اكتب تفسيرك وأرفق ما يسنده.', 'استنتاج'],
  ['report', '10', 'التقرير النهائي', 'حصيلة التحقيق بعد الاستنتاج الرابع.', 'استنتاج'],
  ['training-morse', '11', 'جهاز مورس', 'اقرأ إشارة بالصوت أو بالنقاط والشرط.', 'تدريب'],
  ['training-caesar', '12', 'عجلة قيصر', 'حرّك الحروف لتستعيد الرسالة.', 'تدريب'],
  ['training-numbers', '13', 'الأرقام والحروف', 'طابق الأرقام مع ترتيب الحروف.', 'تدريب'],
];

const makeId = () => globalThis.crypto?.randomUUID?.() || `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const normalize = (value) => String(value || '').normalize('NFKC').replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').toLocaleLowerCase();
const button = (text, onClick, extra = {}) => el('button', { type: 'button', class: 'tk-button', text, onClick, ...extra });
const textField = (label, input) => el('label', { class: 'tk-field' }, [el('span', { text: label }), input]);
const shortCode = (item) => item?.reference?.split(' · ')[0] || item?.id || '';

/** Search only public source fields from evidence the player has actually opened. */
export function searchOpenedEvidence(caseData, viewedIds, query, filters = {}) {
  const seen = new Set(viewedIds || []);
  const needle = normalize(query).trim();
  const person = caseData.people.find((item) => item.id === filters.person);
  return caseData.evidence.filter((item) => seen.has(item.id)).flatMap((item) => {
    if (filters.type && item.type !== filters.type) return [];
    const sourceText = [item.title, item.reference, item.summary, ...(item.body || [])].join(' ');
    if (person && !normalize(sourceText).includes(normalize(person.name))) return [];
    if (filters.code && !normalize(sourceText).includes(normalize(filters.code))) return [];
    if (!needle) return [{ evidenceId: item.id, paragraphIndex: null, text: item.summary }];
    const matches = item.body.flatMap((paragraph, index) => normalize(paragraph).includes(needle)
      ? [{ evidenceId: item.id, paragraphIndex: index, text: paragraph }] : []);
    if (!matches.length && normalize([item.title, item.reference, item.summary].join(' ')).includes(needle)) {
      matches.push({ evidenceId: item.id, paragraphIndex: null, text: item.summary });
    }
    return matches;
  });
}

export function createToolkit(root, services, callbacks = {}) {
  const data = services.caseData;
  const store = services.caseStore;
  const evidenceById = new Map(data.evidence.map((item) => [item.id, item]));
  const allowed = id => evidenceById.has(id) && (!services.investigation || services.investigation.getAccess(id).allowed);
  const abort = new AbortController();
  let destroyed = false;
  let activeTool = 'overview';
  let context = {};
  let previousFocus = null;
  let previousOverflow = '';
  let skipFocusReturn = false;
  let pendingHandoff = null;
  let internalUpdate = false;
  let contentCleanup = () => {};
  let renderGeneration = 0;
  let selectedPins = [];
  let boardMode = matchMedia('(max-width: 700px)').matches ? 'list' : 'board';

  const heading = el('h2', { id: 'toolkit-title', tabindex: '-1', text: 'حقيبة المحقق' });
  const kicker = el('span', { class: 'tk-kicker', text: 'CASE 017 / FIELD KIT', dir: 'ltr' });
  const breadcrumb = button('كل الأدوات', () => open('overview'), { class: 'tk-back', hidden: true });
  const status = el('p', { class: 'tk-status', role: 'status', 'aria-live': 'polite' });
  const body = el('div', { class: 'tk-body' });
  const dialog = el('dialog', { class: 'tk-dialog', 'aria-labelledby': 'toolkit-title', dir: 'rtl', 'data-toolkit': '' }, [
    el('header', { class: 'tk-header' }, [
      el('div', {}, [kicker, heading]),
      button('إغلاق ×', () => dialog.close(), { class: 'tk-close', 'aria-label': 'إغلاق حقيبة المحقق' }),
    ]),
    el('div', { class: 'tk-breadcrumb' }, [breadcrumb, status]),
    body,
  ]);
  root.append(dialog);

  const state = () => {
    const saved = store.get();
    // A damaged or older local record must not make the investigation tools fail.
    const hasSource = entry => entry && allowed(entry.evidenceId) && (saved.viewedIds || []).includes(entry.evidenceId);
    return {
      ...saved,
      notes: (saved.notes || []).filter(entry => hasSource(entry) && typeof entry.text === 'string' && typeof entry.quote === 'string'
        && (!entry.questionId || (Array.isArray(entry.answerSources) && entry.answerSources.length > 0 && entry.answerSources.every(hasSource)))),
      pins: (saved.pins || []).filter(hasSource),
      links: (saved.links || []).filter(entry => entry && hasSource({ evidenceId: entry.fromId }) && hasSource({ evidenceId: entry.toId }) && entry.fromId !== entry.toId),
      timeline: (saved.timeline || []).filter(entry => hasSource(entry) && typeof entry.quote === 'string' && BUCKETS.some(([id]) => id === entry.bucket)),
      hypotheses: (saved.hypotheses || []).filter(entry => entry && typeof entry.text === 'string').map(entry => ({ ...entry, sources: (Array.isArray(entry.sources) ? entry.sources : []).filter(hasSource) })),
    };
  };
  const viewed = () => data.evidence.filter((item) => allowed(item.id) && (state().viewedIds || []).includes(item.id));
  const update = (mutator) => {
    internalUpdate = true;
    try { return store.update(mutator); } finally { internalUpdate = false; }
  };
  const say = (message) => { status.textContent = message; services.notify?.(message); };
  const empty = (message, label = 'افتح أول دليل', id = 'E06') => el('div', { class: 'tk-empty' }, [
    el('span', { class: 'tk-empty-mark', 'aria-hidden': 'true', text: '＋' }),
    el('p', { text: message }),
    button(label, () => goToEvidence(id)),
  ]);
  function handoff(callback) {
    skipFocusReturn = true;
    if (dialog.open) {
      pendingHandoff = callback;
      dialog.close();
    } else callback();
  }
  function goToEvidence(id, options = {}) {
    if (id && !allowed(id)) { say('هذا الدليل لم يصل إلى حزمة المراجعة بعد.'); return; }
    handoff(() => callbacks.openEvidence?.(id, options));
  }
  function sourceButton(entry) {
    const item = evidenceById.get(entry.evidenceId);
    const index = Number.isInteger(entry.paragraphIndex) ? entry.paragraphIndex : null;
    const matches = index === null || !entry.quote || item?.body[index] === entry.quote;
    return el('div', { class: 'tk-source-reference' }, [
      button(`${shortCode(item)}${index !== null ? ` · فقرة ${index + 1}` : ''} →`,
        () => goToEvidence(entry.evidenceId, { paragraphIndex: matches ? index : undefined }),
        { class: 'tk-source', dir: 'auto' }),
      matches ? null : el('span', { class: 'tk-source-warning', text: 'تغيّر نص المصدر؛ الاقتباس المحفوظ أدناه.' }),
    ]);
  }
  function sourcePicker(seed = {}) {
    const items = viewed();
    const select = el('select', { 'aria-label': 'الدليل المصدر', required: true }, items.map((item) =>
      el('option', { value: item.id, text: `${shortCode(item)} · ${item.title}` })));
    const paragraphs = el('select', { 'aria-label': 'الفقرة المصدر', required: true });
    const quote = el('blockquote', { class: 'tk-quote' });
    if (items.some((item) => item.id === seed.evidenceId)) select.value = seed.evidenceId;
    function refreshParagraphs(seedIndex = 0) {
      const item = evidenceById.get(select.value);
      paragraphs.replaceChildren(...(item?.body || []).map((paragraph, index) => el('option', {
        value: index, text: `${index + 1}. ${paragraph.slice(0, 78)}${paragraph.length > 78 ? '…' : ''}`,
      })));
      paragraphs.value = String(Math.max(0, Math.min((item?.body.length || 1) - 1, Number(seedIndex) || 0)));
      refreshQuote();
    }
    function refreshQuote() { quote.textContent = evidenceById.get(select.value)?.body[Number(paragraphs.value)] || ''; }
    select.addEventListener('change', () => refreshParagraphs());
    paragraphs.addEventListener('change', refreshQuote);
    refreshParagraphs(seed.paragraphIndex);
    return {
      element: el('div', { class: 'tk-source-picker' }, [
        el('div', { class: 'tk-form-grid' }, [textField('المصدر', select), textField('الفقرة', paragraphs)]), quote,
      ]),
      value: () => ({ evidenceId: select.value, paragraphIndex: Number(paragraphs.value), quote: quote.textContent }),
    };
  }

  function renderOverview() {
    body.append(el('p', { class: 'tk-intro', text: 'اختر أداة تساعدك على فحص ما أمامك. طريق الاستنتاج يبقى لك.' }));
    body.append(button('مذكرة الاستئناف', () => open('resume'), { 'data-open-resume': '' }));
    for (const category of ['فحص', 'تنظيم', 'استنتاج', 'تدريب']) {
      body.append(el('h3', { class: 'tk-section-heading', text: category === 'تدريب' ? 'تدريب المحقق · اختياري' : category }));
      body.append(el('div', { class: 'tk-tools-grid' }, TOOL_LIST.filter((item) => item[4] === category).map(([id, number, title, description]) =>
        button('', () => {
          if (id === 'compare') {
            handoff(() => callbacks.openCompare?.());
          } else if (id === 'report') {
            goToEvidence(null, { tool: 'report' });
          } else if (['magnifier', 'crop', 'highlight'].includes(id)) {
            goToEvidence(id === 'highlight' ? (context.evidenceId || viewed()[0]?.id || 'E01') : 'E06', { tool: id });
          } else open(id, context);
        }, { class: 'tk-tool-card', 'data-tool': id })
      ).map((card, index) => {
        const [, number, title, description] = TOOL_LIST.filter((item) => item[4] === category)[index];
        card.append(el('span', { class: 'tk-tool-number', text: number, dir: 'ltr' }),
          el('strong', { text: title }), el('span', { class: 'tk-tool-description', text: description }),
          el('span', { class: 'tk-tool-arrow', 'aria-hidden': 'true', text: '→' }));
        return card;
      })));
    }
  }

  function renderNotes() {
    if (viewed().length) {
      const source = sourcePicker(context);
      const type = el('select', { 'aria-label': 'نوع الملاحظة' }, TYPES.map((value) => el('option', { value, text: value })));
      const text = el('textarea', { rows: 3, maxlength: 1200, required: true, placeholder: 'ما الذي لفت انتباهك؟', 'aria-label': 'نص الملاحظة' });
      const form = el('form', { class: 'tk-form' }, [
        source.element, textField('نوع الملاحظة', type), textField('ملاحظتك', text),
        el('button', { type: 'submit', class: 'tk-primary', text: 'احفظ الملاحظة' }),
      ]);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!text.value.trim()) return text.focus();
        update((draft) => { draft.notes.push({ id: makeId(), ...source.value(), type: type.value, text: text.value.trim(), createdAt: Date.now() }); });
        context = {};
        render();
        say('حُفظت الملاحظة مع مصدرها.');
      });
      body.append(form);
    } else body.append(empty('افتح دليلًا أولًا لتربط ملاحظتك بمصدرها.'));
    const notes = state().notes || [];
    body.append(el('h3', { class: 'tk-section-heading', text: `ملاحظات محفوظة · ${notes.length}` }));
    body.append(el('div', { class: 'tk-entry-list' }, notes.map((note) => el('article', { class: 'tk-note' }, [
      el('div', { class: 'tk-note-head' }, [el('span', { class: 'tk-tag', text: note.type }),
        button('حذف', () => { update((draft) => { draft.notes = draft.notes.filter((entry) => entry.id !== note.id); }); render(); say('حُذفت الملاحظة.'); }, { class: 'tk-delete', 'aria-label': `حذف الملاحظة: ${note.text.slice(0, 30)}` }),
      ]),
      el('p', { class: 'tk-user-text', text: note.text }),
      el('blockquote', { class: 'tk-quote', text: note.quote }), sourceButton(note),
    ]))));
    if (!notes.length && viewed().length) body.append(el('p', { class: 'tk-muted', text: 'ملاحظاتك ستبقى هنا عندما تعود إلى الملف.' }));
  }

  function pin(evidenceId) {
    if (!viewed().some((item) => item.id === evidenceId)) { say('افتح الدليل قبل تثبيته.'); return false; }
    if ((state().pins || []).some((item) => item.evidenceId === evidenceId)) { say('الدليل مثبت بالفعل.'); return false; }
    update((draft) => {
      const count = draft.pins.length;
      draft.pins.push({ id: evidenceId, evidenceId, x: .07 + (count % 3) * .4, y: .08 + Math.floor(count / 3) * .34, autoLayout: true });
    });
    if (dialog.open && activeTool === 'board') render();
    say('ثُبّت الدليل على اللوحة.');
    return true;
  }
  function removePin(evidenceId) {
    update((draft) => {
      draft.pins = draft.pins.filter((item) => item.evidenceId !== evidenceId);
      draft.links = draft.links.filter((item) => item.fromId !== evidenceId && item.toId !== evidenceId);
    });
    selectedPins = selectedPins.filter((id) => id !== evidenceId);
    render(); say('أُزيل الدليل وروابطه من اللوحة.');
  }
  function toggleSelection(id) {
    if (selectedPins.includes(id)) selectedPins = selectedPins.filter((value) => value !== id);
    else if (selectedPins.length < 2) selectedPins.push(id);
    else { say('اختر دليلين فقط؛ ألغِ اختيار أحدهما لتبديله.'); return; }
    render();
  }
  function renderBoard() {
    const opened = new Set(viewed().map((item) => item.id));
    const pins = (state().pins || []).filter((item) => opened.has(item.evidenceId));
    const pinned = new Set(pins.map((item) => item.evidenceId));
    selectedPins = selectedPins.filter((id) => pinned.has(id));
    const candidates = viewed().filter((item) => !pinned.has(item.id));
    body.append(el('p', { class: 'tk-intro', text: 'ثبّت الأوراق، ثم اختر دليلين وسمِّ العلاقة. هذه خريطة فرضياتك.' }));
    const toolbar = el('div', { class: 'tk-board-toolbar' });
    if (candidates.length) {
      const choose = el('select', { 'aria-label': 'دليل لإضافته إلى اللوحة' }, candidates.map((item) => el('option', { value: item.id, text: `${shortCode(item)} · ${item.title}` })));
      toolbar.append(choose, button('＋ ثبّت الدليل', () => pin(choose.value), { class: 'tk-primary' }));
    }
    const boardToggle = button('اللوحة', () => { boardMode = 'board'; render(); }, { 'aria-pressed': String(boardMode === 'board'), class: 'tk-view-button' });
    const listToggle = button('قائمة الروابط', () => { boardMode = 'list'; render(); }, { 'aria-pressed': String(boardMode === 'list'), class: 'tk-view-button' });
    toolbar.append(el('div', { class: 'tk-view-switch', role: 'group', 'aria-label': 'طريقة عرض اللوحة' }, [boardToggle, listToggle]));
    body.append(toolbar);
    if (!pins.length) {
      body.append(candidates.length ? el('div', { class: 'tk-empty' }, [el('p', { text: 'ابدأ بورقة واحدة. أضف الثانية عندما تجد بينهما صلة.' })])
        : empty('لوحتك تنتظر أول دليل تفحصه.'));
      return;
    }
    if (boardMode === 'board') renderBoardCanvas(pins);
    else body.append(el('div', { class: 'tk-pin-list' }, pins.map((pinItem) => {
      const item = evidenceById.get(pinItem.evidenceId);
      return el('article', { class: 'tk-list-pin' }, [
        el('div', {}, [el('bdi', { class: 'tk-code', text: shortCode(item), dir: 'ltr' }), el('h3', { text: item.title }), el('p', { text: item.summary })]),
        el('div', { class: 'tk-actions' }, [
          button(selectedPins.includes(item.id) ? '✓ مختار للربط' : 'اختر للربط', () => toggleSelection(item.id), { 'aria-pressed': String(selectedPins.includes(item.id)), 'data-select-pin': item.id }),
          button('افتح المصدر →', () => goToEvidence(item.id)),
          button('أزل من اللوحة', () => removePin(item.id), { class: 'tk-delete' }),
        ]),
      ]);
    })));
    const selectedItems = selectedPins.map((id) => evidenceById.get(id));
    const relation = el('select', { 'aria-label': 'نوع العلاقة' }, RELATIONS.map((value) => el('option', { value, text: value })));
    relation.value = 'يحتاج تحققًا';
    const reason = el('input', { type: 'text', maxlength: 400, placeholder: 'سبب الربط، إن أردت', 'aria-label': 'سبب الربط' });
    const form = el('form', { class: 'tk-connection-form' }, [
      el('h3', { text: selectedItems.length === 2 ? `${shortCode(selectedItems[0])} ← ${shortCode(selectedItems[1])}` : `اختر دليلين للربط · ${selectedItems.length} / 2`, dir: 'auto' }),
      el('div', { class: 'tk-form-grid' }, [textField('العلاقة من الدليل الأول إلى الثاني', relation), textField('تعليق اختياري', reason)]),
      el('button', { type: 'submit', class: 'tk-primary', text: 'اربط الدليلين', disabled: selectedPins.length !== 2, 'data-connect-pins': '' }),
    ]);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (selectedPins.length !== 2 || selectedPins[0] === selectedPins[1]) return;
      const [fromId, toId] = selectedPins;
      if ((state().links || []).some((link) => [link.fromId, link.toId].includes(fromId) && [link.fromId, link.toId].includes(toId))) {
        say('يوجد رابط بين هذين الدليلين. احذفه أولًا إذا أردت تغيير العلاقة.'); return;
      }
      update((draft) => { draft.links.push({ id: makeId(), fromId, toId, relation: relation.value, reason: reason.value.trim() }); });
      selectedPins = [];
      render(); say('حُفظت العلاقة بوصفها فرضيتك.');
    });
    body.append(form);
    const links = (state().links || []).filter((link) => pinned.has(link.fromId) && pinned.has(link.toId));
    body.append(el('h3', { class: 'tk-section-heading', text: `الروابط · ${links.length}` }));
    body.append(el('ul', { class: 'tk-link-list' }, links.map((link) => el('li', {}, [
      el('div', {}, [el('p', { class: 'tk-link-summary', text: `${shortCode(evidenceById.get(link.fromId))} ${link.relation} ${shortCode(evidenceById.get(link.toId))}`, dir: 'auto' }),
        link.reason ? el('p', { class: 'tk-user-text', text: link.reason }) : null]),
      button('حذف الرابط', () => { update((draft) => { draft.links = draft.links.filter((entry) => entry.id !== link.id); }); render(); say('حُذف الرابط.'); }, { class: 'tk-delete' }),
    ]))));
  }

  function renderBoardCanvas(pins) {
    const canvas = el('div', { class: 'tk-board-canvas', 'aria-label': 'لوحة الأدلة؛ استخدم قائمة الروابط كبديل، أو الأسهم لتحريك المقبض', 'data-board-canvas': '' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('tk-strings'); svg.setAttribute('aria-hidden', 'true');
    canvas.append(svg);
    const cards = new Map();
    const positions = new Map(pins.map((item) => [item.evidenceId, { x: clamp(item.x), y: clamp(item.y) }]));
    const automatic = new Set(pins.filter(item => item.autoLayout).map(item => item.evidenceId));
    const localAbort = new AbortController();
    const listAlternative = button('استخدم قائمة الروابط بدل السحب', () => { boardMode = 'list'; render(); }, { class: 'tk-mobile-alternative' });
    body.append(listAlternative, canvas, el('p', { class: 'tk-muted', text: 'اسحب مقبض الورقة لتحريكها. لوحة المفاتيح: ركّز المقبض واستخدم الأسهم.' }));
    const savePosition = (id) => {
      const position = positions.get(id);
      update((draft) => { const item = draft.pins.find((pinItem) => pinItem.evidenceId === id); if (item) Object.assign(item, position, { autoLayout: false }); });
    };
    function layout() {
      const cardWidth = Math.max(1, ...[...cards.values()].map(card => card.offsetWidth));
      const cardHeight = Math.max(1, ...[...cards.values()].map(card => card.offsetHeight));
      const columns = Math.max(1, Math.min(3, Math.floor((canvas.clientWidth + 24) / (cardWidth + 24))));
      const rows = Math.ceil(pins.length / columns);
      const desiredHeight = `${Math.max(660, rows * (cardHeight + 32) + 32)}px`;
      if (canvas.style.height !== desiredHeight) canvas.style.height = desiredHeight;
      const width = canvas.clientWidth, height = canvas.clientHeight;
      let index = 0;
      for (const [id, card] of cards) {
        if (automatic.has(id)) positions.set(id, {
          x: columns > 1 ? (index % columns) / (columns - 1) : .5,
          y: rows > 1 ? Math.floor(index / columns) / (rows - 1) : .08,
        });
        index += 1;
        const position = positions.get(id);
        card.style.left = `${position.x * Math.max(0, width - card.offsetWidth)}px`;
        card.style.top = `${position.y * Math.max(0, height - card.offsetHeight)}px`;
      }
      svg.setAttribute('viewBox', `0 0 ${Math.max(1, width)} ${Math.max(1, height)}`);
      svg.replaceChildren();
      for (const link of state().links || []) {
        const from = cards.get(link.fromId), to = cards.get(link.toId);
        if (!from || !to) continue;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', from.offsetLeft + from.offsetWidth / 2); line.setAttribute('y1', from.offsetTop + 12);
        line.setAttribute('x2', to.offsetLeft + to.offsetWidth / 2); line.setAttribute('y2', to.offsetTop + 12);
        svg.append(line);
      }
    }
    for (const entry of pins) {
      const item = evidenceById.get(entry.evidenceId);
      const handle = button('⠿', null, { class: 'tk-pin-grip', 'aria-label': `تحريك ${item.title}؛ استخدم الأسهم`, 'data-pin-grip': item.id });
      const card = el('article', { class: 'tk-pin', 'data-pin-id': item.id }, [
        handle,
        item.id === 'E06' ? el('img', { src: item.image, alt: '', draggable: 'false', loading: 'lazy' }) : el('div', { class: 'tk-pin-document', 'aria-hidden': 'true' }, [el('bdi', { text: shortCode(item), dir: 'ltr' }), el('span', { text: item.type })]),
        el('h3', { text: item.title }),
        button(selectedPins.includes(item.id) ? '✓ مختار' : 'اختر للربط', () => toggleSelection(item.id), { class: 'tk-pin-select', 'aria-pressed': String(selectedPins.includes(item.id)), 'data-select-pin': item.id }),
        el('div', { class: 'tk-pin-bottom' }, [button('المصدر →', () => goToEvidence(item.id), { class: 'tk-pin-source' }), button('×', () => removePin(item.id), { class: 'tk-pin-remove', 'aria-label': `إزالة ${item.title} من اللوحة` })]),
      ]);
      cards.set(item.id, card); canvas.append(card);
      let drag = null;
      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        handle.focus({ preventScroll: true });
        automatic.delete(item.id);
        drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, ...positions.get(item.id) };
        handle.setPointerCapture?.(event.pointerId); card.classList.add('is-dragging');
      }, { signal: localAbort.signal });
      handle.addEventListener('pointermove', (event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        positions.set(item.id, { x: clamp(drag.x + (event.clientX - drag.startX) / Math.max(1, canvas.clientWidth - card.offsetWidth)), y: clamp(drag.y + (event.clientY - drag.startY) / Math.max(1, canvas.clientHeight - card.offsetHeight)) });
        layout();
      }, { signal: localAbort.signal });
      const stopDrag = () => { if (!drag) return; drag = null; card.classList.remove('is-dragging'); savePosition(item.id); };
      handle.addEventListener('pointerup', stopDrag, { signal: localAbort.signal });
      handle.addEventListener('pointercancel', stopDrag, { signal: localAbort.signal });
      handle.addEventListener('lostpointercapture', stopDrag, { signal: localAbort.signal });
      handle.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        automatic.delete(item.id);
        const next = { ...positions.get(item.id) }, step = event.shiftKey ? .1 : .025;
        if (event.key === 'ArrowLeft') next.x = clamp(next.x - step);
        if (event.key === 'ArrowRight') next.x = clamp(next.x + step);
        if (event.key === 'ArrowUp') next.y = clamp(next.y - step);
        if (event.key === 'ArrowDown') next.y = clamp(next.y + step);
        positions.set(item.id, next); layout(); savePosition(item.id);
      }, { signal: localAbort.signal });
    }
    const observer = new ResizeObserver(layout); observer.observe(canvas);
    requestAnimationFrame(() => { if (!destroyed && canvas.isConnected) layout(); });
    contentCleanup = () => { localAbort.abort(); observer.disconnect(); };
  }

  function renderTimeline() {
    body.append(el('p', { class: 'tk-intro', text: 'رتّب المقتطفات بحسب ما تسنده أوراقها. 2019 و2026 هما العامان المحددان في الملف؛ بقية التوقيت نسبي.' }));
    if (viewed().length) {
      const source = sourcePicker(context);
      const bucket = el('select', { 'aria-label': 'موضع الحدث في التسلسل' }, BUCKETS.map(([value, text]) => el('option', { value, text })));
      bucket.value = 'unknown';
      const title = el('input', { type: 'text', maxlength: 200, placeholder: 'عنوان قصير، اختياري', 'aria-label': 'عنوان الحدث' });
      const form = el('form', { class: 'tk-form' }, [source.element,
        el('div', { class: 'tk-form-grid' }, [textField('موضعه في تسلسلك', bucket), textField('عنوانك', title)]),
        el('button', { type: 'submit', class: 'tk-primary', text: 'أضف إلى التسلسل' }),
      ]);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        update((draft) => { draft.timeline.push({ id: makeId(), ...source.value(), bucket: bucket.value, text: title.value.trim() }); });
        render(); say('حُفظ ترتيبك مع مصدر الحدث.');
      });
      body.append(form);
    } else body.append(empty('افتح الأوراق لتبدأ ترتيب الأحداث المسندة إليها.'));
    body.append(el('div', { class: 'tk-timeline' }, BUCKETS.map(([id, title]) => el('section', { class: 'tk-time-bucket' }, [
      el('h3', { text: title }),
      ...(state().timeline || []).filter((entry) => entry.bucket === id).map((entry) => {
        const move = el('select', { 'aria-label': `نقل الحدث: ${entry.text || shortCode(evidenceById.get(entry.evidenceId))}` }, BUCKETS.map(([value, text]) => el('option', { value, text })));
        move.value = id;
        move.addEventListener('change', () => { update((draft) => { const event = draft.timeline.find((item) => item.id === entry.id); if (event) event.bucket = move.value; }); render(); say('عُدّل ترتيب الحدث.'); });
        return el('article', { class: 'tk-time-entry' }, [
          entry.text ? el('h4', { class: 'tk-user-text', text: entry.text }) : null,
          el('blockquote', { class: 'tk-quote', text: entry.quote }), sourceButton(entry),
          el('div', { class: 'tk-actions' }, [move, button('حذف', () => { update((draft) => { draft.timeline = draft.timeline.filter((item) => item.id !== entry.id); }); render(); say('أُزيل الحدث من تسلسلك.'); }, { class: 'tk-delete' })]),
        ]);
      }),
      !(state().timeline || []).some((entry) => entry.bucket === id) ? el('p', { class: 'tk-muted', text: 'لا مقتطفات هنا بعد.' }) : null,
    ]))));
  }

  function renderSearch() {
    const query = el('input', { type: 'search', placeholder: 'اسم، رمز موقع، عبارة…', 'aria-label': 'ابحث في الأدلة المفتوحة', autocomplete: 'off' });
    const type = el('select', { 'aria-label': 'تصفية حسب نوع الوثيقة' }, [el('option', { value: '', text: 'كل أنواع الوثائق' }), ...[...new Set(viewed().map((item) => item.type))].map((value) => el('option', { value, text: value }))]);
    const person = el('select', { 'aria-label': 'تصفية حسب الشخص المذكور' }, [el('option', { value: '', text: 'كل الأسماء' }), ...data.people.map((item) => el('option', { value: item.id, text: item.name }))]);
    const code = el('input', { type: 'text', placeholder: 'مثل EXT-02', 'aria-label': 'تصفية حسب رمز مذكور', dir: 'auto' });
    const results = el('div', { class: 'tk-search-results' });
    const count = el('p', { class: 'tk-muted', role: 'status', 'aria-live': 'polite' });
    function search() {
      const matches = searchOpenedEvidence(data, state().viewedIds, query.value, { type: type.value, person: person.value, code: code.value });
      count.textContent = `${matches.length} نتيجة · ${viewed().length} من ${data.evidence.length} أوراق مفتوحة`;
      results.replaceChildren(...matches.map((match) => {
        const item = evidenceById.get(match.evidenceId);
        return el('article', { class: 'tk-search-result' }, [
          el('div', { class: 'tk-note-head' }, [el('h3', { text: item.title }), el('bdi', { class: 'tk-code', text: shortCode(item), dir: 'ltr' })]),
          el('p', { text: match.text }),
          sourceButton({ ...match, quote: match.paragraphIndex === null ? undefined : match.text }),
        ]);
      }));
      if (!matches.length) results.append(viewed().length ? el('p', { class: 'tk-empty', text: 'لا تطابق في الأوراق المفتوحة. جرّب كلمة أو رمزًا آخر.' }) : empty('افتح دليلًا ليظهر محتواه في البحث.'));
    }
    [query, type, person, code].forEach((input) => input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', search));
    body.append(el('p', { class: 'tk-intro', text: 'البحث يعيدك إلى كلام الوثائق التي فتحتها.' }),
      textField('عبارة البحث', query), el('div', { class: 'tk-search-filters' }, [textField('نوع الوثيقة', type), textField('الشخص المذكور', person), textField('الرمز', code)]), count, results);
    search();
  }

  function renderHypotheses() {
    const opened = viewed();
    if (!opened.length) body.append(empty('افتح دليلًا، ثم اكتب تفسيرًا يمكن إسناده إليه.'));
    else {
      const text = el('textarea', { required: true, maxlength: 1600, rows: 3, placeholder: 'تفسيري لما حدث…', 'aria-label': 'نص الفرضية' });
      const sourceRows = opened.map((item) => {
        const checked = el('input', { type: 'checkbox', value: item.id, 'aria-label': `إرفاق ${item.title}` });
        const stance = el('select', { 'aria-label': `موقف ${item.title} من الفرضية` }, ['يؤيد', 'يعارض', 'بحاجة إلى فحص'].map((value) => el('option', { value, text: value })));
        const reason = el('input', { type: 'text', maxlength: 400, placeholder: 'ما وجه الصلة؟', 'aria-label': `سبب إرفاق ${item.title}` });
        return { checked, stance, reason, item, element: el('div', { class: 'tk-hypothesis-source' }, [
          el('label', {}, [checked, el('span', { text: `${shortCode(item)} · ${item.title}` })]), stance, reason,
        ]) };
      });
      const form = el('form', { class: 'tk-form' }, [textField('فرضيتك', text),
        el('fieldset', { class: 'tk-source-fieldset' }, [el('legend', { text: 'أرفق مصدرًا واحدًا على الأقل' }), ...sourceRows.map((row) => row.element)]),
        el('button', { type: 'submit', class: 'tk-primary', text: 'احفظ الفرضية' }),
      ]);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!text.value.trim()) return text.focus();
        const sources = sourceRows.filter((row) => row.checked.checked).map((row) => ({ evidenceId: row.item.id, stance: row.stance.value, reason: row.reason.value.trim() }));
        if (!sources.length) { say('أرفق مصدرًا واحدًا على الأقل لتعود إليه.'); sourceRows[0].checked.focus(); return; }
        update((draft) => { draft.hypotheses.push({ id: makeId(), text: text.value.trim(), sources }); });
        render(); say('حُفظت الفرضية ومصادرها.');
      });
      body.append(el('p', { class: 'tk-intro', text: 'جرّب تفسيرًا، ثم اسأل: أي ورقة تسنده؟ وأي ورقة تعارضه؟' }), form);
    }
    body.append(el('h3', { class: 'tk-section-heading', text: `فرضياتك · ${(state().hypotheses || []).length}` }));
    body.append(el('div', { class: 'tk-entry-list' }, (state().hypotheses || []).map((entry) => el('article', { class: 'tk-note' }, [
      el('div', { class: 'tk-note-head' }, [el('span', { class: 'tk-tag', text: 'فرضية المحقق' }), button('حذف', () => { update((draft) => { draft.hypotheses = draft.hypotheses.filter((item) => item.id !== entry.id); }); render(); say('حُذفت الفرضية.'); }, { class: 'tk-delete' })]),
      el('p', { class: 'tk-user-text', text: entry.text }),
      el('ul', { class: 'tk-hypothesis-references' }, (entry.sources || []).map((source) => el('li', {}, [
        el('span', { class: 'tk-tag', text: source.stance }), sourceButton(source), source.reason ? el('p', { text: source.reason }) : null,
      ]))),
    ]))));
  }

  async function renderTraining(mode) {
    const generation = renderGeneration;
    const host = el('div', { class: 'tk-training-host' });
    body.append(el('p', { class: 'tk-training-label', text: 'تدريب مستقل · لا يغيّر أدلة القضية أو نتيجة التحقيق' }), host);
    host.append(el('p', { role: 'status', text: 'جارٍ فتح أداة التدريب…' }));
    try {
      const module = await import('./training.js?v=6d062d5989d21c42');
      if (destroyed || generation !== renderGeneration || !dialog.open) return;
      host.replaceChildren();
      contentCleanup = module.mount(host, services, { mode }) || (() => {});
    } catch (error) {
      if (destroyed || generation !== renderGeneration) return;
      host.replaceChildren(el('p', { role: 'status', text: 'تعذر فتح التدريب الآن. يمكنك متابعة التحقيق أو المحاولة مجددًا.' }), button('أعد المحاولة', render));
    }
  }

  function render() {
    const focusedPin = document.activeElement?.dataset?.selectPin;
    contentCleanup(); contentCleanup = () => {};
    renderGeneration += 1;
    body.replaceChildren(); status.textContent = '';
    const tool = TOOL_LIST.find((entry) => entry[0] === activeTool);
    heading.textContent = activeTool === 'resume' ? 'مذكرة الاستئناف' : tool?.[2] || 'حقيبة المحقق';
    breadcrumb.hidden = activeTool === 'overview';
    dialog.dataset.activeTool = activeTool;
    if (activeTool === 'resume') body.append(renderResumeMemo(services, {
      resume: () => handoff(() => callbacks.resume?.()),
      openEvidence: (id, options) => goToEvidence(id, options),
    }));
    else if (activeTool === 'notes') renderNotes();
    else if (activeTool === 'board') renderBoard();
    else if (activeTool === 'timeline') renderTimeline();
    else if (activeTool === 'search') renderSearch();
    else if (activeTool === 'hypotheses') renderHypotheses();
    else if (activeTool.startsWith('training-')) renderTraining(activeTool.slice(9));
    else renderOverview();
    if (focusedPin) body.querySelector(`[data-select-pin="${CSS.escape(focusedPin)}"]`)?.focus({ preventScroll: true });
  }
  function open(toolId = 'overview', nextContext = {}) {
    if (destroyed) return;
    activeTool = toolId;
    context = nextContext || {};
    if (!dialog.open) {
      previousFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      skipFocusReturn = false;
      document.body.style.overflow = 'hidden';
      dialog.showModal();
    }
    render(); body.scrollTop = 0; heading.focus({ preventScroll: true });
  }
  function annotate(evidenceId, paragraphIndex, quote) { open('notes', { evidenceId, paragraphIndex, quote }); }
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }, { signal: abort.signal });
  dialog.addEventListener('close', () => {
    contentCleanup(); contentCleanup = () => {}; renderGeneration += 1;
    document.body.style.overflow = previousOverflow;
    if (!skipFocusReturn && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    skipFocusReturn = false;
    const next = pendingHandoff;
    pendingHandoff = null;
    if (!destroyed) next?.();
  }, { signal: abort.signal });
  const notebookKey = saved => JSON.stringify([saved.viewedIds, saved.notes, saved.pins, saved.links, saved.highlights, saved.timeline, saved.hypotheses, saved.solvedIds, saved.progress?.completedActivityIds]);
  let lastNotebook = notebookKey(store.get());
  const unsubscribe = store.subscribe?.(saved => {
    const key = notebookKey(saved);
    if (key === lastNotebook) return;
    lastNotebook = key;
    // Training owns its own feedback and badges. Saving its completion must not
    // destroy the live exercise (or its audio controller) under the submit event.
    if (!internalUpdate && dialog.open && !destroyed && !activeTool.startsWith('training-')) render();
  });
  return {
    open, pin, annotate,
    destroy() {
      destroyed = true; pendingHandoff = null; contentCleanup(); abort.abort(); unsubscribe?.();
      if (dialog.open) { document.body.style.overflow = previousOverflow; dialog.close(); }
      dialog.remove();
    },
  };
}
