import { el } from './core.js';
import { createToolkit } from './toolkit.js';
import { EVIDENCE_FOCUS } from '../../../fourth-signature/evidence-focus.js?v=fourth-1';
import { evaluateSupport, requiresSupport, maxEvidenceCount } from '../../../fourth-signature/deduction-support.js?v=fourth-1';

const TYPES = {
  E01: ['administrative', 'ADM', 'محضر إداري'], E02: ['receipt', 'LC', 'محضر تسليم'],
  E03: ['technical', 'MA', 'طلب إصلاح'], E04: ['inventory', 'AR', 'سجل جرد'],
  E05: ['transfer', 'RC', 'إيصال إحالة'], E06: ['photograph', 'PH', 'بطاقة حفظ'],
  E07: ['audit', 'AUD', 'سجل تدقيق'], E08: ['letter', 'REV', 'مراسلة محفوظة'],
};
const STEP_EVIDENCE = { Q01: ['E06', 'E02', 'E03'], Q02: ['E01', 'E05', 'E08'], Q03: ['E01', 'E07', 'E08'], Q04: ['E01', 'E07', 'E08'] };
const num = value => new Intl.NumberFormat('ar', { useGrouping: false }).format(value);
const button = (text, action, attrs = {}) => el('button', { type: 'button', class: 'case-button', text, onClick: action, ...attrs });
const label = (text, control) => el('label', { class: 'case-field' }, [el('span', { text }), control]);

export function mount(root, services) {
  const data = services.caseData;
  const evidence = data.evidence;
  const state = () => services.caseStore.get();
  const asset = path => services.caseAsset(path);
  let disposed = false;
  let tab = 'evidence';
  let activeQuestion = Math.max(0, data.questions.findIndex(q => !state().solvedIds.includes(q.id)));
  let modalDisposers = [];
  let heroDisposers = [];
  let compareDisposers = [];
  const page = el('div', { class: 'case-page', dir: 'rtl', lang: 'ar' });
  const workspace = el('section', { class: 'case-workspace', id: 'case-workspace', tabindex: '-1', 'aria-label': 'مساحة التحقيق' });
  const nav = el('nav', { class: 'case-folders', 'aria-label': 'ملفات القضية' });
  const progressText = el('span', { class: 'case-progress-text', 'aria-live': 'polite' });
  const progressFill = el('span', { class: 'case-progress-fill' });
  const dialog = el('dialog', { class: 'case-dialog', 'aria-labelledby': 'case-dialog-title' });
  const comparison = el('dialog', { class: 'case-dialog case-comparison-dialog', 'aria-labelledby': 'case-compare-title' });
  root.replaceChildren(page);
  page.append(dialog, comparison);
  const toolkit = createToolkit(page, services, { openEvidence, openCompare });

  function cleanupList(list) { for (const dispose of list.splice(0)) { try { dispose(); } catch (_) {} } }
  function pauseWithin(container) { container.querySelectorAll('video').forEach(video => video.pause()); }
  function closeReader() { pauseWithin(dialog); if (dialog.open) dialog.close(); }
  function closeComparison() { pauseWithin(comparison); if (comparison.open) comparison.close(); }
  dialog.addEventListener('close', () => { pauseWithin(dialog); cleanupList(modalDisposers); });
  comparison.addEventListener('close', () => { pauseWithin(comparison); cleanupList(compareDisposers); });
  const tool = (id, context = {}) => { closeReader(); closeComparison(); toolkit.open(id, context); };
  function showDialog(content, title) {
    closeComparison();
    pauseWithin(dialog); cleanupList(modalDisposers);
    dialog.replaceChildren(el('header', { class: 'case-dialog-head' }, [
      el('div', {}, [el('span', { class: 'case-eyebrow', text: 'أرشيف بيلمار / الملف ٠١٧' }), el('h2', { id: 'case-dialog-title', text: title })]),
      button('إغلاق ×', closeReader, { class: 'case-close', 'aria-label': 'إغلاق الوثيقة' }),
    ]), ...[content].flat());
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  function markViewed(id) {
    if (!state().viewedIds.includes(id)) services.caseStore.update(s => { s.viewedIds.push(id); });
  }

  function scene({ image, video, title, alt, hero = false }, disposers = modalDisposers) {
    const status = el('p', { class: 'case-scene-status', role: 'status', hidden: true });
    const media = el('video', { class: 'case-scene-video', poster: image, preload: 'none', playsinline: true, muted: true, 'aria-label': alt || title });
    media.muted = true;
    const control = button('شغّل المشهد ↻', async () => {
      if (!media.paused) { media.pause(); return; }
      if (!media.src) media.src = video;
      if (media.ended) media.currentTime = 0;
      try { await media.play(); status.hidden = true; } catch (_) { status.textContent = 'تعذّر تشغيل المشهد الآن؛ الصورة والوثيقة متاحتان للفحص.'; status.hidden = false; }
    }, { class: 'case-button case-scene-toggle', 'data-scene-play': hero ? 'hero' : title });
    const setControl = () => { control.textContent = !media.paused ? 'أوقف المشهد Ⅱ' : media.ended ? 'أعد المشهد ↻' : 'شغّل المشهد ▷'; control.setAttribute('aria-pressed', String(!media.paused)); };
    for (const event of ['play', 'pause', 'ended']) media.addEventListener(event, setControl);
    media.addEventListener('error', () => { status.textContent = 'المشهد غير متاح الآن؛ يمكنك متابعة فحص الصورة.'; status.hidden = false; setControl(); });
    // These archive clips are deliberately silent. They never own the music channel.
    if (hero) {
      media.dataset.ambientVideo = '';
      const autoplayAllowed = () => services.motionAllowed?.() !== false && !page.classList.contains('case-quiet') && !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData;
      const observer = new IntersectionObserver(entries => {
        if (entries[0]?.isIntersecting && autoplayAllowed()) {
          if (!media.src) media.src = matchMedia('(max-width: 900px)').matches ? asset('assets/video/hero-mobile.mp4') : video;
          media.play().catch(() => {});
        } else media.pause();
      }, { threshold: .25 });
      observer.observe(media);
      disposers.push(() => { observer.disconnect(); media.pause(); });
    }
    return el('figure', { class: `case-scene${hero ? ' case-hero-scene' : ''}` }, [
      el('div', { class: 'case-scene-picture' }, media),
      el('figcaption', { class: 'case-scene-controls' }, [el('span', { text: title }), control]), status,
    ]);
  }

  const hero = el('section', { class: 'case-hero', 'aria-labelledby': 'case-title' }, [
    el('div', { class: 'case-hero-copy' }, [
      el('p', { class: 'case-eyebrow', text: 'ملف ٠١٧ / أعيد فتحه عام ٢٠٢٦' }),
      el('h1', { id: 'case-title' }, ['التوقيع ', el('span', { text: 'الرابع.' })]),
      el('p', { class: 'case-hero-lead', text: data.subtitle }),
      el('div', { class: 'case-hero-actions' }, [button(state().viewedIds.length ? 'واصل التحقيق ←' : 'ابدأ بفحص الصورة ←', () => openEvidence('E06'), { class: 'case-button case-primary' }), el('span', { class: 'case-small', text: '٨ أدلة · ٤ استنتاجات · أنت المحقق' })]),
    ]),
    scene({ image: asset('assets/hero.webp'), video: asset('assets/video/hero.mp4'), title: 'ليلة الحريق / لوسيان أمام الأرشيف', alt: 'لوسيان يحمل قفلًا أمام مبنى الأرشيف المشتعل', hero: true }, heroDisposers),
  ]);
  const intro = el('details', { class: 'case-brief' }, [el('summary', { text: 'ما الذي حدث؟' }), el('p', { text: data.backstory })]);
  let revealPinned = false;
  const redaction = button('أنت.', () => { revealPinned = !revealPinned; revealWord(revealPinned); }, { class: 'case-redaction', 'aria-label': 'اكشف الكلمة المحجوبة', 'aria-expanded': 'false' });
  function revealWord(show) { redaction.classList.toggle('is-revealed', show); redaction.setAttribute('aria-expanded', String(show)); redaction.setAttribute('aria-label', show ? 'أنت. الكلمة المكشوفة' : 'اكشف الكلمة المحجوبة'); }
  redaction.addEventListener('mouseenter', () => revealWord(true));
  redaction.addEventListener('mouseleave', () => revealWord(revealPinned));
  redaction.addEventListener('focus', () => revealWord(true));
  redaction.addEventListener('blur', () => revealWord(revealPinned));
  const redactedLine = el('p', { class: 'case-redacted-line' }, ['الحقيقة تحتاج إلى شاهد واحد: ', redaction]);
  const toolsButton = button('حقيبة المحقق · ١٣ أداة →', () => tool('overview'), { class: 'case-button case-tools-open', 'data-open-toolkit': true });
  const toolbar = el('div', { class: 'case-toolbar' }, [el('div', { class: 'case-progress' }, [progressText, el('div', { class: 'case-progress-track', 'aria-hidden': 'true' }, progressFill)]), toolsButton]);
  page.prepend(...(services.lang === 'en' ? [el('p', { class: 'case-language-note', lang: 'en', dir: 'ltr', text: 'Case documents and investigation tools are in Arabic.' })] : []), hero, redactedLine, intro, toolbar, nav, workspace);
  const quiet = button('واجهة هادئة', () => {
    const active = !page.classList.contains('case-quiet'); page.classList.toggle('case-quiet', active);
    quiet.setAttribute('aria-pressed', String(active)); services.store?.set?.('caseQuiet', active);
  }, { class: 'case-quiet-toggle', 'aria-pressed': 'false' });
  if (services.store?.get?.('caseQuiet', false)) { page.classList.add('case-quiet'); quiet.setAttribute('aria-pressed', 'true'); }
  page.append(el('footer', { class: 'case-footer' }, [el('span', { text: 'تقدّمك وملاحظاتك محفوظة على هذا الجهاز.' }), quiet, button('إعادة فتح الملف من البداية', resetCase, { class: 'case-reset' })]));

  function updateProgress() {
    if (disposed) return;
    progressText.textContent = `${num(state().solvedIds.length)} / ٤ استنتاجات · ${num(state().viewedIds.length)} / ٨ أدلة مفتوحة`;
    progressFill.style.width = `${state().solvedIds.length / 4 * 100}%`;
    page.querySelectorAll('[data-evidence-id]').forEach(card => {
      const viewed = state().viewedIds.includes(card.dataset.evidenceId);
      card.classList.toggle('is-viewed', viewed);
      const badge = card.querySelector('.case-read-status'); if (badge) badge.textContent = viewed ? 'فُتح ✓' : 'افتح الملف ←';
    });
  }
  function selectTab(next, move = true) {
    if (next === 'board') { tool('board'); return; }
    tab = next; renderNav();
    workspace.replaceChildren(next === 'people' ? peopleView() : next === 'deductions' ? deductionsView() : evidenceView());
    if (move) { workspace.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); workspace.focus({ preventScroll: true }); }
  }
  function renderNav() {
    nav.replaceChildren(...[['evidence', 'الأدلة'], ['people', 'الشخصيات'], ['board', 'لوحة الربط'], ['deductions', 'الاستنتاجات']].map(([id, name]) => button(name, () => selectTab(id), { class: `case-folder${tab === id ? ' is-active' : ''}`, 'aria-current': tab === id ? 'page' : null, 'data-case-tab': id })));
  }
  function documentThumbnail(item) {
    const [kind, mark, name] = TYPES[item.id];
    if (item.id === 'E06') return el('div', { class: 'case-file-photo' }, [el('img', { src: item.image, alt: '', loading: 'lazy', decoding: 'async' }), el('span', { text: 'PH—06', dir: 'ltr' })]);
    return el('div', { class: `case-file-paper case-file-${kind}`, 'aria-hidden': 'true' }, [
      el('div', { class: 'case-file-rule' }, [el('span', { text: mark, dir: 'ltr' }), el('bdi', { text: item.reference.split(' · ')[0], dir: 'ltr' })]),
      el('strong', { text: name }),
      el('p', { text: item.reference.split(' · ')[1] || item.type }),
      el('span', { class: 'case-file-sign', text: item.signature?.split(' · ')[0] || item.sourceLabel?.split(' — ')[0] || 'أرشيف بيلمار' }),
    ]);
  }
  function evidenceView() {
    return el('div', { class: 'case-evidence-view' }, [
      el('header', { class: 'case-section-heading' }, [el('div', {}, [el('span', { class: 'case-eyebrow', text: 'صندوق الأصول' }), el('h2', { text: 'الأوراق تقول أكثر.' })]), button('ابحث في الملفات المفتوحة', () => tool('search'))]),
      el('div', { class: 'case-evidence-grid' }, evidence.map(item => button('', () => openEvidence(item.id), { class: `case-evidence-card${state().viewedIds.includes(item.id) ? ' is-viewed' : ''}`, 'data-evidence-id': item.id, 'aria-label': `افتح ${item.title}` })).map((card, index) => {
        const item = evidence[index]; card.append(documentThumbnail(item), el('div', { class: 'case-file-caption' }, [el('span', { class: 'case-file-id', text: item.id, dir: 'ltr' }), el('h3', { text: item.title }), el('p', { text: item.summary }), el('span', { class: 'case-read-status', text: state().viewedIds.includes(item.id) ? 'فُتح ✓' : 'افتح الملف ←' })])); return card;
      })),
      el('div', { class: 'case-action-strip' }, [el('p', { text: 'راقب ما تقوله كل ورقة، وما يمكن أن تثبته.' }), button('انتقل إلى الاستنتاجات ←', () => selectTab('deductions'), { class: 'case-button case-primary' })]),
    ]);
  }
  function peopleView() {
    return el('div', {}, [el('header', { class: 'case-section-heading' }, [el('div', {}, [el('span', { class: 'case-eyebrow', text: 'أطراف الملف' }), el('h2', { text: 'خمسة أسماء. رواية واحدة؟' })])]), el('div', { class: 'case-people-grid' }, data.people.map(person => button('', () => openPerson(person), { class: 'case-person', 'aria-label': `افتح ملف ${person.name}` })).map((card, index) => { const person = data.people[index]; card.append(el('img', { src: person.image, alt: person.name, loading: 'lazy', decoding: 'async' }), el('div', {}, [el('span', { text: person.role }), el('h3', { text: person.name }), el('span', { class: 'case-person-link', text: 'افتح الملف →' })])); return card; }))]);
  }
  function openPerson(person) {
    showDialog(el('div', { class: 'case-person-dossier' }, [
      scene({ image: person.image, video: asset(`assets/video/${person.id}.mp4`), title: person.name, alt: person.name }),
      el('p', { class: 'case-eyebrow', text: person.role }), el('p', { class: 'case-person-description', text: person.description }),
      button('راجع الأوراق ←', () => { closeReader(); selectTab('evidence'); }),
    ]), person.name);
  }

  function paragraph(item, index, { tools = true, prefix = 'case' } = {}) {
    const quote = item.body[index];
    const isHighlighted = () => (state().highlights || []).some(h => h.evidenceId === item.id && h.paragraphIndex === index && (!h.quote || h.quote === quote));
    const row = el('div', { class: `case-paragraph${isHighlighted() ? ' is-highlighted' : ''}`, id: `${prefix}-${item.id}-p${index}`, 'data-paragraph-index': index, tabindex: '-1' }, [el('span', { class: 'case-line-number', text: num(index + 1), 'aria-hidden': 'true' }), el('p', { text: quote })]);
    if (tools) {
      const highlight = button(isHighlighted() ? 'إزالة التحديد' : 'حدّد الفقرة', () => {
        const existed = isHighlighted(); services.caseStore.update(s => {
          s.highlights = (s.highlights || []).filter(h => !(h.evidenceId === item.id && h.paragraphIndex === index));
          if (!existed) s.highlights.push({ evidenceId: item.id, paragraphIndex: index, quote });
        }); row.classList.toggle('is-highlighted', !existed); highlight.textContent = existed ? 'حدّد الفقرة' : 'إزالة التحديد'; highlight.setAttribute('aria-pressed', String(!existed));
      }, { 'aria-pressed': String(isHighlighted()), class: 'case-paragraph-tool', 'data-highlight': `${item.id}:${index}` });
      row.append(el('div', { class: 'case-paragraph-tools' }, [highlight, button('دوّن ملاحظة', () => { closeReader(); closeComparison(); toolkit.annotate(item.id, index, quote); }, { class: 'case-paragraph-tool', 'data-annotate': `${item.id}:${index}` })]));
    }
    return row;
  }
  function renderDocument(item, { full = false, comparisonMode = false, prefix = 'case' } = {}) {
    const [kind, mark, name] = TYPES[item.id];
    const sheet = el('article', { class: `case-paper case-paper-${kind}`, 'data-document': item.id }, [
      el('header', { class: 'case-paper-heading' }, [el('div', { class: 'case-paper-masthead' }, [el('span', { class: 'case-paper-emblem', text: mark, dir: 'ltr', 'aria-hidden': 'true' }), el('span', { text: name }), el('bdi', { text: item.reference.split(' · ')[0], dir: 'ltr' })]), el('h3', { text: item.title }), el('p', { class: 'case-paper-reference', text: item.reference })]),
    ]);
    if (item.id === 'E06' && !comparisonMode) sheet.append(photoInspector());
    const excerpt = EVIDENCE_FOCUS[item.id];
    if (excerpt && !full) sheet.append(el('div', { class: 'case-paper-excerpt' }, [el('p', { class: 'case-paper-label', text: excerpt.label }), ...excerpt.lines.map(text => el('p', { text }))]));
    const body = el('div', { class: 'case-paper-body' }, item.body.map((_, index) => paragraph(item, index, { prefix })));
    const fullText = el('details', { class: 'case-full-text', open: full }, [el('summary', { text: 'اقرأ الوثيقة كاملة وحدّد ما يهمك' }), body]);
    sheet.append(fullText);
    if (item.signature) sheet.append(el('div', { class: 'case-paper-signature' }, [el('span', { text: 'خانة التوقيع' }), el('p', { text: item.signature })]));
    sheet.append(el('footer', { class: 'case-paper-source' }, [el('span', { text: item.sourceLabel || item.reference }), el('bdi', { dir: 'ltr', text: item.id })]));
    return sheet;
  }

  function openEvidence(id, options = {}) {
    if (options.tool === 'report') { showReport(); return; }
    const item = evidence.find(item => item.id === (id || 'E06')); if (!item) return;
    markViewed(item.id);
    const content = el('div', { class: 'case-reader' });
    const actions = el('div', { class: 'case-reader-tools', 'aria-label': 'أدوات الدليل' }, [
      button('قارن ورقتين', () => openCompare(item.id), { 'data-compare-evidence': item.id }),
      button('ثبّت على اللوحة', () => { toolkit.pin(item.id); }, { 'data-pin-evidence': item.id }),
      button('ملاحظاتي', () => tool('notes', { evidenceId: item.id })),
    ]);
    content.append(actions, renderDocument(item, { full: Number.isInteger(options.paragraphIndex) || options.tool === 'highlight' }));
    if (item.id === 'E06') content.append(el('details', { class: 'case-attachment' }, [
      el('summary', { text: 'افحص القفل · مرفق توضيحي' }),
      el('p', { class: 'case-small', text: 'المرفق يوضّح القفل. بطاقة PH-06 هي مصدر الاستدلال.' }),
      magnifier(asset('assets/padlock.webp'), 'القفل المكسور', { label: 'عدسة القفل' }),
      scene({ image: asset('assets/padlock.webp'), video: asset('assets/video/padlock.mp4'), title: 'مشهد القفل', alt: 'جزآ قفل مكسور على ورقة' }),
    ]));
    content.append(el('div', { class: 'case-reader-return' }, [button('عُد إلى الاستنتاج ←', () => { closeReader(); selectTab('deductions'); }, { class: 'case-button case-primary' }), button('حقيبة المحقق', () => tool('overview', { evidenceId: item.id }))]));
    showDialog(content, item.title);
    if (Number.isInteger(options.paragraphIndex)) {
      const target = dialog.querySelector(`#case-${item.id}-p${options.paragraphIndex}`);
      requestAnimationFrame(() => { target?.scrollIntoView({ block: 'center' }); target?.focus({ preventScroll: true }); });
    }
    if (options.tool === 'magnifier') requestAnimationFrame(() => { dialog.querySelector('[data-photo-mode="full"]')?.click(); dialog.querySelector('[data-magnifier-toggle]')?.click(); });
    if (options.tool === 'crop') requestAnimationFrame(() => dialog.querySelector('[data-photo-mode="full"]')?.click());
  }

  function magnifier(src, alt, { label: title = 'عدسة فحص الصورة' } = {}) {
    let active = false, x = .5, y = .5;
    const image = el('img', { src, alt, draggable: 'false', loading: 'lazy', decoding: 'async' });
    const view = el('div', { class: 'case-magnifier-view', tabindex: '-1', role: 'group', 'aria-label': title }, image);
    const instructions = el('p', { class: 'case-magnifier-help', text: 'اسحب الصورة أو استخدم الأسهم لفحص التفاصيل. زر إعادة الضبط يعيد المركز.', hidden: true });
    function update() { image.style.transform = active ? 'scale(2)' : ''; image.style.transformOrigin = `${x * 100}% ${y * 100}%`; }
    const toggle = button('عدسة ×٢', () => { active = !active; view.classList.toggle('is-active', active); view.tabIndex = active ? 0 : -1; instructions.hidden = !active; toggle.textContent = active ? 'أغلق العدسة' : 'عدسة ×٢'; toggle.setAttribute('aria-pressed', String(active)); update(); if (active) view.focus({ preventScroll: true }); }, { 'data-magnifier-toggle': true, 'aria-pressed': 'false' });
    let dragging = false;
    const locate = event => { const rect = view.getBoundingClientRect(); x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)); y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)); update(); };
    view.addEventListener('pointerdown', event => { if (!active) return; dragging = true; view.setPointerCapture(event.pointerId); locate(event); event.preventDefault(); });
    view.addEventListener('pointermove', event => { if (active && (dragging || event.pointerType === 'mouse')) locate(event); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) view.addEventListener(event, () => { dragging = false; });
    view.addEventListener('keydown', event => {
      if (!active || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'Escape'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.key === 'Escape') { toggle.click(); toggle.focus(); return; }
      if (event.key === 'Home') x = y = .5;
      if (event.key === 'ArrowLeft') x -= .08; if (event.key === 'ArrowRight') x += .08;
      if (event.key === 'ArrowUp') y -= .08; if (event.key === 'ArrowDown') y += .08;
      x = Math.max(0, Math.min(1, x)); y = Math.max(0, Math.min(1, y)); update();
    });
    image.addEventListener('error', () => { view.replaceChildren(el('p', { text: 'الصورة غير متاحة؛ يبقى نص الدليل متاحًا.' })); toggle.disabled = true; });
    return el('section', { class: 'case-magnifier' }, [view, el('div', { class: 'case-inspection-controls' }, [toggle, button('إعادة الضبط', () => { x = y = .5; update(); })]), instructions]);
  }
  function photoInspector() {
    let full = false, outline = false, ratio = 1672 / 941;
    const inspector = el('section', { class: 'case-photo-inspector', 'aria-label': 'قصاصة الصورة والإطار الكامل' });
    const scan = magnifier(asset('assets/photo-ph06.webp'), 'إطار الصورة الكامل: لوسيان يحمل جزأي قفل، وسياج قفص المعدات وبطاقة EXT-02', { label: 'فحص الصورة PH-06' });
    const image = scan.querySelector('img');
    const view = scan.querySelector('.case-magnifier-view');
    const border = el('span', { class: 'case-crop-outline', 'aria-hidden': 'true', hidden: true });
    view.append(border);
    const caption = el('p', { class: 'case-photo-caption' });
    const cropButton = button('قصاصة المحضر', () => { full = false; render(); }, { 'data-photo-mode': 'crop' });
    const fullButton = button('الإطار الكامل', () => { full = true; render(); }, { 'data-photo-mode': 'full' });
    const frameButton = button('حدود القص', () => { outline = !outline; render(); }, { 'aria-pressed': 'false' });
    const lens = scan.querySelector('[data-magnifier-toggle]');
    function render() {
      if (lens.getAttribute('aria-pressed') === 'true') lens.click();
      view.classList.toggle('is-cropped', !full); view.style.aspectRatio = full ? '' : String(ratio * .55); border.hidden = !(full && outline);
      image.alt = full ? 'الإطار الكامل: لوسيان يحمل جزأي قفل، وسياج قفص المعدات وبطاقة EXT-02' : 'القصاصة: لوسيان يحمل جزأي قفل أمام الأرشيف';
      cropButton.setAttribute('aria-pressed', String(!full)); fullButton.setAttribute('aria-pressed', String(full)); frameButton.disabled = !full; frameButton.setAttribute('aria-pressed', String(outline));
      lens.disabled = !full;
      caption.textContent = full ? 'الإطار الأوسع. قارن العناصر الظاهرة بنص بطاقة الحفظ.' : 'التعليق المثبت أسفل القصاصة: «قفل المخرج بيد الحارس». افتح الإطار الكامل لفحصه بالعدسة.';
    }
    image.addEventListener('load', () => { if (image.naturalWidth && image.naturalHeight) { ratio = image.naturalWidth / image.naturalHeight; view.style.aspectRatio = full ? '' : String(ratio * .55); } });
    inspector.append(el('div', { class: 'case-photo-modes' }, [cropButton, fullButton, frameButton]), scan, caption, el('p', { class: 'case-photo-source', text: 'إعادة بناء بصرية من وصف بطاقة PH-06. نص البطاقة هو المرجع.' })); render(); return inspector;
  }

  function openCompare(firstId, secondId) {
    closeReader(); cleanupList(compareDisposers);
    const first = el('select', { id: 'case-compare-first', 'aria-label': 'الوثيقة الأولى' }, evidence.map(item => el('option', { value: item.id, text: `${item.reference.split(' · ')[0]} · ${item.title}` })));
    const second = el('select', { id: 'case-compare-second', 'aria-label': 'الوثيقة الثانية' }, evidence.map(item => el('option', { value: item.id, text: `${item.reference.split(' · ')[0]} · ${item.title}` })));
    first.value = evidence.some(e => e.id === firstId) ? firstId : 'E01';
    second.value = evidence.some(e => e.id === secondId) && secondId !== first.value ? secondId : first.value === 'E02' ? 'E01' : 'E02';
    const tabs = el('div', { class: 'case-compare-tabs', role: 'tablist', 'aria-label': 'الوثيقة المعروضة على الجوال' });
    const papers = el('div', { class: 'case-compare-papers' });
    const message = el('p', { class: 'case-compare-message', role: 'status', text: 'قارن العنوان وخانة التوقيع وما تقوله كل وثيقة.' });
    comparison.replaceChildren(el('header', { class: 'case-dialog-head' }, [el('h2', { id: 'case-compare-title', text: 'قارن ورقتين' }), button('إغلاق ×', closeComparison, { class: 'case-close', 'aria-label': 'إغلاق المقارنة' })]), el('div', { class: 'case-compare-selects' }, [label('الوثيقة الأولى', first), label('الوثيقة الثانية', second)]), message, tabs, papers);
    let active = 0;
    const breakpoint = matchMedia('(max-width: 720px)');
    function activate(index) {
      active = index;
      [...tabs.children].forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
      [...papers.children].forEach((panel, i) => { panel.hidden = breakpoint.matches && i !== active; panel.setAttribute('role', breakpoint.matches ? 'tabpanel' : 'region'); });
    }
    function renderPair() {
      if (first.value === second.value) { papers.replaceChildren(); tabs.replaceChildren(); message.textContent = 'اختر وثيقتين مختلفتين للمقارنة.'; return; }
      message.textContent = 'قارن العنوان وخانة التوقيع وما تقوله كل وثيقة.';
      papers.replaceChildren(); tabs.replaceChildren();
      [first.value, second.value].forEach((id, index) => {
        const item = evidence.find(e => e.id === id); markViewed(id);
        const tab = button(item.title, () => activate(index), { class: 'case-compare-tab', role: 'tab', id: `case-compare-tab-${index}`, 'aria-controls': `case-compare-panel-${index}` });
        tab.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const target = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - active; activate(target); tabs.children[target]?.focus(); } });
        tabs.append(tab);
        papers.append(el('section', { class: 'case-compare-panel', id: `case-compare-panel-${index}`, 'aria-labelledby': tab.id, tabindex: '0' }, renderDocument(item, { full: true, comparisonMode: true, prefix: `compare-${index}` })));
      }); activate(0);
    }
    first.addEventListener('change', renderPair); second.addEventListener('change', renderPair);
    const resize = () => activate(active); breakpoint.addEventListener('change', resize); compareDisposers.push(() => breakpoint.removeEventListener('change', resize));
    renderPair(); if (!comparison.open) comparison.showModal(); comparison.scrollTop = 0;
  }

  function deductionsView() {
    const container = el('div', { class: 'case-deductions' });
    const steps = el('nav', { class: 'case-steps', 'aria-label': 'خطوات الاستنتاج' }, data.questions.map((q, index) => button('', () => { activeQuestion = index; selectTab('deductions', false); }, { class: `case-step${index === activeQuestion ? ' is-current' : ''}${state().solvedIds.includes(q.id) ? ' is-solved' : ''}`, 'aria-current': index === activeQuestion ? 'step' : null, disabled: index > state().solvedIds.length, 'data-question-step': index })).map((b, index) => { b.append(el('strong', { text: state().solvedIds.includes(data.questions[index].id) ? '✓' : num(index + 1) }), el('span', { text: `استنتاج ${num(index + 1)}` })); return b; }));
    container.append(el('header', { class: 'case-section-heading' }, [el('div', {}, [el('span', { class: 'case-eyebrow', text: 'من الورقة إلى البرهان' }), el('h2', { text: 'ما الذي تثبته الأدلة؟' })])]), steps);
    if (state().solvedIds.length === data.questions.length && activeQuestion >= data.questions.length) {
      container.append(el('section', { class: 'case-complete' }, [el('span', { class: 'case-seal', text: 'اكتملت المراجعة' }), el('h3', { text: data.ending.title }), el('p', { text: 'عادت التوقيعات إلى أوراقها. وبقي للحريق سؤاله.' }), button('اقرأ التقرير النهائي ←', showReport, { class: 'case-button case-primary', 'data-final-report': true })])); return container;
    }
    const q = data.questions[activeQuestion] || data.questions[0];
    const solved = state().solvedIds.includes(q.id);
    const panel = el('section', { class: 'case-question', 'data-question-id': q.id });
    panel.append(el('p', { class: 'case-eyebrow', text: `الاستنتاج ${num(activeQuestion + 1)} من ٤` }), el('h3', { id: 'case-question-title', text: q.prompt, tabindex: '-1' }));
    const leads = el('div', { class: 'case-question-evidence' }, STEP_EVIDENCE[q.id].map(id => evidenceRow(evidence.find(e => e.id === id))));
    function evidenceRow(item) { return el('button', { type: 'button', class: `case-evidence-row${state().viewedIds.includes(item.id) ? ' is-viewed' : ''}`, 'data-evidence-id': item.id, onClick: () => openEvidence(item.id) }, [el('bdi', { dir: 'ltr', text: item.reference.split(' · ')[0] }), el('span', { text: item.title }), el('span', { class: 'case-read-status', text: state().viewedIds.includes(item.id) ? 'فُتح ✓' : 'افتح ←' })]); }
    panel.append(leads, button('قارن ورقتين', () => openCompare(STEP_EVIDENCE[q.id][0], STEP_EVIDENCE[q.id][1]), { class: 'case-button case-question-compare' }));
    const options = el('fieldset', { class: 'case-answer-options', 'aria-labelledby': 'case-question-title' });
    q.options.forEach(option => options.append(el('label', { class: 'case-answer-option' }, [el('input', { type: 'radio', name: `answer-${q.id}`, value: option.id, checked: (solved ? q.correctId : state().answers?.[q.id]) === option.id, disabled: solved, onChange: () => services.caseStore.update(s => { s.answers[q.id] = option.id; }) }), el('span', { text: option.label })])));
    panel.append(options);
    let support = [...(state().supportByQuestion?.[q.id] || [])];
    if (requiresSupport(q)) {
      const fieldset = el('fieldset', { class: 'case-support', 'data-support-question': q.id }, [el('legend', { text: 'أرفق سند استنتاجك' }), el('p', { text: q.id === 'Q03' ? 'اختر دليلين يسندان اختيارك.' : 'اختر دليلين أو ثلاثة تسند الخلاصة وحدودها.' })]);
      const choices = el('div', { class: 'case-support-choices' });
      evidence.forEach(item => {
        const check = el('input', { type: 'checkbox', name: `support-${q.id}`, value: item.id, checked: support.includes(item.id), disabled: solved });
        check.addEventListener('change', () => {
          if (check.checked && support.length >= maxEvidenceCount(q)) { check.checked = false; services.notify('أزل أحد الأدلة المختارة قبل إضافة دليل آخر.'); return; }
          support = check.checked ? [...support, item.id] : support.filter(id => id !== item.id);
          services.caseStore.update(s => { s.supportByQuestion[q.id] = support; });
        });
        choices.append(el('label', {}, [check, el('span', { text: `${item.reference.split(' · ')[0]} · ${item.title}` })]));
      }); fieldset.append(choices); panel.append(fieldset);
    }
    const feedback = el('p', { class: `case-answer-feedback${solved ? ' is-correct' : ''}`, role: 'status', text: solved ? q.explanation : '', hidden: !solved });
    const hint = el('p', { class: 'case-hint', text: q.hint, hidden: true });
    const hintButton = button('أحتاج تلميحًا', () => { hint.hidden = !hint.hidden; hintButton.setAttribute('aria-expanded', String(!hint.hidden)); }, { class: 'case-hint-button', 'aria-expanded': 'false' });
    const submit = button(solved ? activeQuestion === 3 ? 'إلى التقرير النهائي ←' : 'الاستنتاج التالي ←' : 'ثبّت الاستنتاج ←', () => {
      if (state().solvedIds.includes(q.id)) {
        activeQuestion += 1; selectTab('deductions', false); workspace.querySelector('#case-question-title')?.focus(); return;
      }
      const answer = state().answers?.[q.id]; const checked = evaluateSupport(q, support);
      if (!answer) { feedback.textContent = 'اختر استنتاجك أولًا.'; feedback.hidden = false; return; }
      if (answer !== q.correctId) { feedback.textContent = 'راجع ما تثبته الأوراق، ثم جرّب استنتاجًا يسنده المصدر.'; feedback.hidden = false; return; }
      if (!checked.valid) { feedback.textContent = checked.message; feedback.hidden = false; return; }
      services.caseStore.update(s => { if (!s.solvedIds.includes(q.id)) s.solvedIds.push(q.id); });
      selectTab('deductions', false); workspace.querySelector('.case-answer-feedback')?.scrollIntoView({ block: 'nearest' });
    }, { class: 'case-button case-primary', 'data-submit-answer': q.id });
    panel.append(feedback, hint, el('div', { class: 'case-question-actions' }, [submit, hintButton]));
    if (state().solvedIds.length === 4) panel.append(button('التقرير النهائي', showReport, { class: 'case-button', 'data-final-report': true }));
    container.append(panel); return container;
  }

  function showReport() {
    if (state().solvedIds.length < data.questions.length) { services.notify('يتاح التقرير بعد إكمال الاستنتاجات الأربعة.'); selectTab('deductions'); return; }
    const report = el('article', { class: 'case-report', id: 'case-final-report' }, [
      el('p', { class: 'case-eyebrow', text: 'الملف ٠١٧ / نتيجة مراجعة الأصول' }), el('h3', { text: data.ending.title }),
      el('p', { class: 'case-report-summary', text: data.ending.summary }),
      el('h4', { text: 'ما أثبتته الأوراق' }), el('ol', {}, data.ending.reasoning.map(text => el('li', { text }))),
      el('h4', { text: 'ما بقي غير محسوم' }), el('ul', { class: 'case-report-limits' }, data.ending.limits.map(text => el('li', { text }))),
    ]);
    const notes = (state().notes || []);
    if (notes.length) report.append(el('section', { class: 'case-report-personal' }, [el('h4', { text: 'ملاحظاتك الشخصية · ليست نتائج التقرير' }), ...notes.map(note => el('blockquote', {}, [el('p', { text: note.text || note.content || '' }), el('cite', { text: note.evidenceId ? `المصدر: ${note.evidenceId}` : 'ملاحظة المحقق' })]))]));
    const actions = el('div', { class: 'case-report-actions' }, [button('اطبع التقرير', () => {
      document.body.classList.add('printing-case-report');
      const done = () => { document.body.classList.remove('printing-case-report'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done); window.print(); setTimeout(done, 1000);
    }, { class: 'case-button case-primary' }), button('أعد فحص الأوراق', () => { closeReader(); selectTab('evidence'); })]);
    showDialog([report, actions], 'التقرير النهائي');
  }
  function resetCase() {
    showDialog(el('div', { class: 'case-reset-confirm' }, [el('p', { text: 'ستبدأ القضية من جديد، وتُمسح ملاحظاتك ولوحتك وفرضياتك في هذه النسخة. يبقى تقدم الحلقات كما هو.' }), button('ابدأ ملفًا جديدًا', () => {
      closeReader(); closeComparison(); services.caseStore.update(s => {
        Object.assign(s, { viewedIds: [], solvedIds: [], answers: {}, supportByQuestion: {}, notes: [], highlights: [], pins: [], links: [], timeline: [], hypotheses: [], training: {} });
      }); activeQuestion = 0; selectTab('evidence'); services.notify('فُتح ملف جديد.');
    }, { class: 'case-button case-primary' }), button('احتفظ بتقدمي', closeReader)]), 'إعادة فتح الملف');
  }
  const unsubscribe = services.caseStore.subscribe?.(updateProgress);
  renderNav(); selectTab('evidence', false); updateProgress();
  const hash = location.hash;
  if (['#deductions', '#people', '#evidence'].includes(hash)) selectTab(hash.slice(1), false);
  if (hash === '#report' && state().solvedIds.length === 4) showReport();
  return () => {
    disposed = true; unsubscribe?.(); closeReader(); closeComparison(); toolkit.destroy();
    cleanupList(heroDisposers); cleanupList(modalDisposers); cleanupList(compareDisposers);
    document.body.classList.remove('printing-case-report'); page.remove();
  };
}
