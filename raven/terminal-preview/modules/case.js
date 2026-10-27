import { el, caseCompletionKey } from './core.js?v=0e63bd470374096b';
import { createToolkit } from './toolkit.js?v=0e63bd470374096b';
import { mountActivities } from './activities.js?v=0e63bd470374096b';
import { attachPhotoRegions } from './photo-regions.js?v=0e63bd470374096b';
import { attachParagraphQuestions } from './paragraph-questions.js?v=0e63bd470374096b';
import { mountIncomingCall } from './incoming-call.js?v=0e63bd470374096b';
import { mountCloudPanel } from './cloud.js?v=0e63bd470374096b';
import { EVIDENCE_FOCUS } from '../../../fourth-signature/evidence-focus.js?v=0e63bd470374096b';

const TYPES = {
  E01: ['administrative', 'ADM', 'محضر إداري'], E02: ['receipt', 'LC', 'محضر تسليم'],
  E03: ['technical', 'MA', 'طلب إصلاح'], E04: ['inventory', 'AR', 'سجل جرد'],
  E05: ['transfer', 'RC', 'إيصال إحالة'], E06: ['photograph', 'PH', 'بطاقة حفظ'],
  E07: ['audit', 'AUD', 'سجل تدقيق'], E08: ['letter', 'REV', 'مراسلة محفوظة'],
  E09: ['transfer', 'UV', 'ظرف المراجعة'], E10: ['technical', 'B17', 'بطاقة مناولة'],
  E11: ['audit', 'SHA', 'بيان الرقمنة'], E12: ['photograph', 'CAM', 'سجل الكاميرات'],
  E13: ['technical', 'REC', 'جلسة المختبر'], E14: ['receipt', 'PUB', 'إيصال النشر'],
  E15: ['technical', 'TRACE', 'آثار المناولة'], E16: ['letter', 'LOG', 'مراسلات المراجعة'],
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
  let tab = 'activities';
  let activeQuestion = Math.max(0, data.questions.findIndex(q => !state().solvedIds.includes(q.id)));
  let modalDisposers = [];
  let heroDisposers = [];
  let compareDisposers = [];
  let activityCleanup = () => {};
  let readerRequest = 0;
  let compareRequest = 0;
  let viewedQueue = Promise.resolve();
  let endingController;
  let endingImport;
  let endingRequest = 0;
  let endingRunKey = '';
  const investigation = services.investigation;
  const canAccess = id => investigation.getAccess(id).allowed;
  const accessible = () => evidence.filter(item => canAccess(item.id));
  const page = el('div', { class: 'case-page', dir: 'rtl', lang: 'ar' });
  const workspace = el('section', { class: 'case-workspace', id: 'case-workspace', tabindex: '-1', 'aria-label': 'مساحة التحقيق' });
  const nav = el('nav', { class: 'case-folders', 'aria-label': 'ملفات القضية' });
  const progressText = el('span', { class: 'case-progress-text', 'aria-live': 'polite' });
  const progressFill = el('span', { class: 'case-progress-fill' });
  const dialog = el('dialog', { class: 'case-dialog', 'aria-labelledby': 'case-dialog-title' });
  const comparison = el('dialog', { class: 'case-dialog case-comparison-dialog', 'aria-labelledby': 'case-compare-title' });
  root.replaceChildren(page);
  page.append(dialog, comparison);
  const toolkit = createToolkit(page, services, { openEvidence, openCompare, resume: () => selectTab('activities') });
  services.openEvidence = openEvidence;
  investigation.setActive?.(true);

  function cleanupList(list) { for (const dispose of list.splice(0)) { try { dispose(); } catch (_) {} } }
  function pauseWithin(container) { container.querySelectorAll('video').forEach(video => video.pause()); }
  function closeReader() { readerRequest++; pauseWithin(dialog); if (dialog.open) dialog.close(); }
  function closeComparison() { compareRequest++; pauseWithin(comparison); if (comparison.open) comparison.close(); }
  dialog.addEventListener('close', () => { pauseWithin(dialog); cleanupList(modalDisposers); });
  comparison.addEventListener('close', () => { pauseWithin(comparison); cleanupList(compareDisposers); });
  dialog.addEventListener('cancel', () => { readerRequest++; });
  comparison.addEventListener('cancel', () => { compareRequest++; });
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
    attachHelpers(dialog, modalDisposers);
  }
  function markViewed(id) {
    const task = viewedQueue.then(() => !disposed && canAccess(id) ? investigation.markViewed(id) : false)
      .catch(error => { services.notify(error.message || 'تعذر تسجيل فتح الدليل. أعد المحاولة.'); return false; });
    viewedQueue = task;
    return task;
  }
  function attachHelpers(container, disposers) {
    for (const row of container.querySelectorAll('.case-paragraph')) {
      const sheet = row.closest('[data-document]');
      const item = evidence.find(item => item.id === sheet?.dataset.document);
      if (item) disposers.push(attachParagraphQuestions(row, item, Number(row.dataset.paragraphIndex), services));
    }
    for (const scan of container.querySelectorAll('.case-photo-inspector')) disposers.push(attachPhotoRegions(scan, services, 'E06'));
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
      el('div', { class: 'case-hero-actions' }, [button(state().progress.completedActivityIds.length ? 'واصل التحقيق ←' : 'افتح حزمة المراجعة ←', () => selectTab('activities'), { class: 'case-button case-primary', 'data-resume-investigation': true }), button('دليل البداية', openStartGuide, { 'data-open-start-guide': '' }), el('span', { class: 'case-small', text: '٧ مراحل · ٣٢ نشاطًا · ١٦ دليلًا' })]),
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
  const toolbar = el('div', { class: 'case-toolbar' }, [el('div', { class: 'case-progress' }, [progressText, el('div', { class: 'case-progress-track', 'aria-hidden': 'true' }, progressFill)]), el('div', { class: 'case-toolbar-actions' }, [toolsButton, button('مذكرة الاستئناف', () => tool('resume'), { 'data-open-resume': true })])]);
  const accountHost = el('div', { class: 'case-account-host' });
  const callHost = el('div', { class: 'case-call-host' });
  page.prepend(...(services.lang === 'en' ? [el('p', { class: 'case-language-note', lang: 'en', dir: 'ltr', text: 'Case documents and investigation tools are in Arabic.' })] : []), hero, redactedLine, intro, toolbar, accountHost, callHost, nav, workspace);
  const cloudCleanup = mountCloudPanel(accountHost, services) || (() => {});
  const callCleanup = mountIncomingCall(callHost, services) || (() => {});
  const quiet = button('واجهة هادئة', () => {
    const active = !page.classList.contains('case-quiet'); page.classList.toggle('case-quiet', active);
    quiet.setAttribute('aria-pressed', String(active)); services.store?.set?.('caseQuiet', active);
  }, { class: 'case-quiet-toggle', 'aria-pressed': 'false' });
  if (services.store?.get?.('caseQuiet', false)) { page.classList.add('case-quiet'); quiet.setAttribute('aria-pressed', 'true'); }
  page.append(el('footer', { class: 'case-footer' }, [el('span', { text: 'تقدّمك وملاحظاتك محفوظة على هذا الجهاز.' }), quiet, button('إعادة فتح الملف من البداية', resetCase, { class: 'case-reset' })]));

  function updateProgress() {
    if (disposed) return;
    if (!investigation.canReport() || (endingRunKey && endingRunKey !== caseCompletionKey(state().progress))) {
      endingRequest++; endingController?.close(); endingRunKey = '';
    }
    progressText.textContent = `${num(state().progress.completedActivityIds.length)} / ٣٢ نشاطًا · ${num(state().solvedIds.length)} / ٤ استنتاجات · ${num(state().viewedIds.length)} / ١٦ دليلًا`;
    progressFill.style.width = `${state().progress.completedActivityIds.length / 32 * 100}%`;
    page.querySelectorAll('[data-evidence-id]').forEach(card => {
      const viewed = state().viewedIds.includes(card.dataset.evidenceId);
      card.classList.toggle('is-viewed', viewed);
      const allowed = canAccess(card.dataset.evidenceId);
      const badge = card.querySelector('.case-read-status'); if (badge) badge.textContent = !allowed ? 'يفتح مع تقدم التحقيق' : viewed ? 'فُتح ✓' : 'افتح الملف ←';
      if (card.tagName === 'BUTTON') card.disabled = !allowed;
    });
  }
  function openStartGuide() {
    selectTab('activities', false);
    const guide = workspace.querySelector('[data-start-guide]');
    if (!guide) return;
    guide.open = true;
    guide.querySelector('summary')?.focus({ preventScroll: true });
    guide.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  function selectTab(next, move = true) {
    if (next === 'board') { tool('board'); return; }
    activityCleanup(); activityCleanup = () => {};
    tab = next; renderNav();
    if (next === 'activities') {
      workspace.replaceChildren();
      activityCleanup = mountActivities(workspace, services, { openEvidence, openPhoto: () => openEvidence('E06', { tool: 'crop' }), openTool: tool, showReport,
        onCompleted: () => { void showEnding({ automatic: true }); }, replayEnding: () => { void showEnding(); },
      }) || (() => {});
    } else workspace.replaceChildren(next === 'people' ? peopleView() : next === 'deductions' ? deductionsView() : evidenceView());
    if (move) { workspace.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); workspace.focus({ preventScroll: true }); }
  }
  function renderNav() {
    nav.replaceChildren(...[['activities', 'المهمة الحالية'], ['evidence', 'الأدلة'], ['people', 'الشخصيات'], ['board', 'لوحة الربط'], ['deductions', 'الاستنتاجات']].map(([id, name]) => button(name, () => selectTab(id), { class: `case-folder${tab === id ? ' is-active' : ''}`, 'aria-current': tab === id ? 'page' : null, 'data-case-tab': id })));
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
        const item = evidence[index];
        const allowed = canAccess(item.id); card.disabled = !allowed;
        card.append(allowed ? documentThumbnail(item) : el('div', { class: 'case-file-locked', 'aria-hidden': 'true', text: item.id, dir: 'ltr' }), el('div', { class: 'case-file-caption' }, [el('span', { class: 'case-file-id', text: item.id, dir: 'ltr' }), el('h3', { text: item.title }), el('p', { text: allowed ? item.summary : 'يُتاح هذا الملف عند الوصول إلى مهمته.' }), el('span', { class: 'case-read-status', text: !allowed ? 'يفتح مع تقدم التحقيق' : state().viewedIds.includes(item.id) ? 'فُتح ✓' : 'افتح الملف ←' })])); return card;
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

  async function openEvidence(id, options = {}) {
    if (options.tool === 'report') { showReport(); return; }
    const item = evidence.find(item => item.id === (id || 'E06')); if (!item) return;
    if (!canAccess(item.id)) { services.notify(investigation.getAccess(item.id).reason || 'أكمل المهمة الحالية لفتح هذا الدليل.'); return; }
    const request = ++readerRequest;
    if (!await markViewed(item.id) || disposed || request !== readerRequest) return;
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
    content.append(el('div', { class: 'case-reader-return' }, [button('عُد إلى المهمة الحالية ←', () => { closeReader(); selectTab('activities'); }, { class: 'case-button case-primary' }), button('حقيبة المحقق', () => tool('overview', { evidenceId: item.id }))]));
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
    const allowed = accessible();
    if (allowed.length < 2) { services.notify('تحتاج وثيقتين متاحتين للمقارنة.'); return; }
    const first = el('select', { id: 'case-compare-first', 'aria-label': 'الوثيقة الأولى' }, allowed.map(item => el('option', { value: item.id, text: `${item.reference.split(' · ')[0]} · ${item.title}` })));
    const second = el('select', { id: 'case-compare-second', 'aria-label': 'الوثيقة الثانية' }, allowed.map(item => el('option', { value: item.id, text: `${item.reference.split(' · ')[0]} · ${item.title}` })));
    first.value = allowed.some(e => e.id === firstId) ? firstId : allowed[0].id;
    second.value = allowed.some(e => e.id === secondId) && secondId !== first.value ? secondId : allowed.find(item => item.id !== first.value).id;
    const tabs = el('div', { class: 'case-compare-tabs', role: 'tablist', 'aria-label': 'الوثيقة المعروضة على الجوال' });
    const papers = el('div', { class: 'case-compare-papers' });
    const message = el('p', { class: 'case-compare-message', role: 'status', text: 'قارن العنوان وخانة التوقيع وما تقوله كل وثيقة.' });
    comparison.replaceChildren(el('header', { class: 'case-dialog-head' }, [el('h2', { id: 'case-compare-title', text: 'قارن ورقتين' }), button('إغلاق ×', closeComparison, { class: 'case-close', 'aria-label': 'إغلاق المقارنة' })]), el('div', { class: 'case-compare-selects' }, [label('الوثيقة الأولى', first), label('الوثيقة الثانية', second)]), message, tabs, papers);
    let active = 0;
    const contentDisposers = [];
    compareDisposers.push(() => cleanupList(contentDisposers));
    const breakpoint = matchMedia('(max-width: 720px)');
    function activate(index) {
      active = index;
      [...tabs.children].forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
      [...papers.children].forEach((panel, i) => { panel.hidden = breakpoint.matches && i !== active; panel.setAttribute('role', breakpoint.matches ? 'tabpanel' : 'region'); });
    }
    async function renderPair() {
      const request = ++compareRequest;
      cleanupList(contentDisposers);
      if (![first.value, second.value].every(canAccess)) { papers.replaceChildren(); tabs.replaceChildren(); message.textContent = 'الدليل غير متاح في هذه المرحلة.'; return; }
      if (first.value === second.value) { papers.replaceChildren(); tabs.replaceChildren(); message.textContent = 'اختر وثيقتين مختلفتين للمقارنة.'; return; }
      message.textContent = 'قارن العنوان وخانة التوقيع وما تقوله كل وثيقة.';
      papers.replaceChildren(); tabs.replaceChildren();
      const selected = [first.value, second.value];
      for (const id of selected) {
        if (!await markViewed(id) || disposed || !comparison.open || request !== compareRequest) return;
      }
      selected.forEach((id, index) => {
        const item = evidence.find(e => e.id === id);
        const tab = button(item.title, () => activate(index), { class: 'case-compare-tab', role: 'tab', id: `case-compare-tab-${index}`, 'aria-controls': `case-compare-panel-${index}` });
        tab.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const target = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - active; activate(target); tabs.children[target]?.focus(); } });
        tabs.append(tab);
        papers.append(el('section', { class: 'case-compare-panel', id: `case-compare-panel-${index}`, 'aria-labelledby': tab.id, tabindex: '0' }, renderDocument(item, { full: true, comparisonMode: true, prefix: `compare-${index}` })));
      }); activate(0); attachHelpers(papers, contentDisposers);
    }
    first.addEventListener('change', renderPair); second.addEventListener('change', renderPair);
    const resize = () => activate(active); breakpoint.addEventListener('change', resize); compareDisposers.push(() => breakpoint.removeEventListener('change', resize));
    if (!comparison.open) comparison.showModal(); renderPair(); comparison.scrollTop = 0;
  }

  function deductionsView() {
    const container = el('div', { class: 'case-deductions' }, [
      el('header', { class: 'case-section-heading' }, [el('div', {}, [el('span', { class: 'case-eyebrow', text: 'من الورقة إلى البرهان' }), el('h2', { text: 'استنتاجاتك المثبتة' })])]),
      el('p', { text: 'تثبت الاستنتاجات داخل مسار التحقيق. تبقى نتائجك هنا للمراجعة.' }),
    ]);
    for (const [index, q] of data.questions.entries()) {
      const solved = state().solvedIds.includes(q.id);
      container.append(el('section', { class: `case-question${solved ? ' is-solved' : ''}`, 'data-question-id': q.id }, [
        el('p', { class: 'case-eyebrow', text: `الاستنتاج ${num(index + 1)} · النشاط ${num([8, 14, 26, 32][index])}` }),
        el('h3', { text: q.prompt }),
        solved ? el('p', { class: 'case-answer-feedback is-correct', text: q.explanation }) : el('p', { text: 'يتاح تثبيته عند الوصول إلى مهمته.' }),
        ...(solved ? STEP_EVIDENCE[q.id].filter(canAccess).map(id => button(evidence.find(item => item.id === id).title, () => openEvidence(id), { 'data-evidence-id': id })) : []),
      ]));
    }
    container.append(button(investigation.canReport() ? 'اقرأ التقرير النهائي ←' : 'واصل المهمة الحالية ←', () => investigation.canReport() ? showReport() : selectTab('activities'), { class: 'case-button case-primary', ...(investigation.canReport() ? { 'data-final-report': true } : {}) }));
    if (investigation.canReport()) container.append(button('أعد مشهد النهاية ↻', () => { void showEnding(); }, { 'data-ending-replay': '' }));
    return container;
  }

  async function showEnding({ automatic = false } = {}) {
    if (disposed || !investigation.canReport()) return false;
    const request = ++endingRequest;
    const requestedRun = caseCompletionKey(state().progress);
    closeReader(); closeComparison();
    try {
      endingImport ||= import('./case-ending.js?v=0e63bd470374096b').catch(error => { endingImport = null; throw error; });
      const module = await endingImport;
      if (disposed || request !== endingRequest || !investigation.canReport() || requestedRun !== caseCompletionKey(state().progress)) return false;
      endingController ||= module.createCaseEnding(page, services, { onReport: showReport });
      endingRunKey = requestedRun;
      return endingController.open({ automatic });
    } catch {
      if (disposed || request !== endingRequest || requestedRun !== caseCompletionKey(state().progress)) return false;
      services.notify('تعذّر تحميل مشهد النهاية. التقرير النهائي متاح.');
      showReport(); return false;
    }
  }

  function showReport() {
    if (!investigation.canReport()) { services.notify('يتاح التقرير بعد إكمال الأنشطة الـ٣٢ واستنتاجاتها.'); selectTab('activities'); return; }
    endingRequest++; endingController?.close();
    const report = el('article', { class: 'case-report', id: 'case-final-report' }, [
      el('p', { class: 'case-eyebrow', text: 'الملف ٠١٧ / نتيجة مراجعة الأصول' }), el('h3', { text: data.ending.title }),
      el('p', { class: 'case-report-summary', text: data.ending.summary }),
      el('h4', { text: 'ما أثبتته الأوراق' }), el('ol', {}, data.ending.reasoning.map(text => el('li', { text }))),
      el('h4', { text: 'ما بقي غير محسوم' }), el('ul', { class: 'case-report-limits' }, data.ending.limits.map(text => el('li', { text }))),
    ]);
    report.append(el('section', { class: 'case-report-expansion' }, [
      el('h4', { text: 'ملحق مراجعة ٢٠٢٦ · الوجه B17-R' }),
      el('p', { text: 'دخل وجها بطاقة المناولة الجديدة مراجعة الرقمنة. نُشر الوجه الأمامي، وبقي الخلفي B17-R في المراجعة؛ لذلك لم يكن وصف الحزمة المنشورة بأنها كاملة دقيقًا. أُرفق الوجه الخلفي الموافق لبيان الملفات لاستكمال الحزمة.' }),
      el('p', { text: 'هذا استنتاج عن معالجة مواد ٢٠٢٦. لا يثبت وحده تعمد الإخفاء أو هوية من تسبب فيه، ولا يغيّر حدود التحقيق في منشأ حريق ٢٠١٩.' }),
    ]));
    const notes = (state().notes || []);
    if (notes.length) report.append(el('section', { class: 'case-report-personal' }, [el('h4', { text: 'ملاحظاتك الشخصية · ليست نتائج التقرير' }), ...notes.map(note => el('blockquote', {}, [el('p', { text: note.text || note.content || '' }), el('cite', { text: note.evidenceId ? `المصدر: ${note.evidenceId}` : 'ملاحظة المحقق' })]))]));
    const actions = el('div', { class: 'case-report-actions' }, [button('اطبع التقرير', () => {
      if (!investigation.canReport()) return;
      document.body.classList.add('printing-case-report');
      const done = () => { document.body.classList.remove('printing-case-report'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done); window.print(); setTimeout(done, 1000);
    }, { class: 'case-button case-primary' }), button('أعد مشهد النهاية ↻', () => { void showEnding(); }, { 'data-ending-replay': '' }), button('أعد فحص الأوراق', () => { closeReader(); selectTab('evidence'); })]);
    showDialog([report, actions], 'التقرير النهائي');
  }
  function resetCase() {
    showDialog(el('div', { class: 'case-reset-confirm' }, [el('p', { text: 'ستبدأ الأنشطة الـ٣٢ من جديد، وتُمسح ملاحظاتك ولوحتك وفرضياتك في التوسعة. يبقى حفظ القضية السابقة وتقدم الحلقات وإعدادات الصوت.' }), button('ابدأ ملفًا جديدًا', async () => {
      const current = state().progress;
      if (current.mode === 'ranked' && current.runId && services.cloud?.configured) {
        try { await services.cloud.abandonRun(current.runId, crypto.randomUUID(), current.seq); }
        catch { services.notify('تعذّر إنهاء المحاولة المتصلة. أعد المحاولة بعد استعادة الاتصال.'); return; }
      }
      closeReader(); closeComparison(); services.caseStore.reset();
      investigation.setActive?.(true); activeQuestion = 0; selectTab('activities'); services.notify('فُتحت حزمة مراجعة جديدة.');
    }, { class: 'case-button case-primary' }), button('احتفظ بتقدمي', closeReader)]), 'إعادة فتح الملف');
  }

  const unsubscribe = services.caseStore.subscribe?.(updateProgress);
  renderNav(); selectTab('activities', false); updateProgress();
  const hash = location.hash;
  if (['#activities', '#deductions', '#people', '#evidence'].includes(hash)) selectTab(hash.slice(1), false);
  if (hash === '#report') showReport();
  return () => {
    disposed = true; endingRequest++; endingController?.destroy(); unsubscribe?.(); activityCleanup(); callCleanup(); cloudCleanup(); investigation.setActive?.(false); closeReader(); closeComparison(); toolkit.destroy();
    if (services.openEvidence === openEvidence) delete services.openEvidence;
    cleanupList(heroDisposers); cleanupList(modalDisposers); cleanupList(compareDisposers);
    document.body.classList.remove('printing-case-report'); page.remove();
  };
}
