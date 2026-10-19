import { CASE_DATA } from './case-data.js?v=desk-2';
import { createScene, initializeScenes, pauseScenes, disposeScenes, refreshScenes } from './media.js?v=cinema-2';

const $ = (selector, scope = document) => scope.querySelector(selector);
import { node, arabic } from './dom.js?v=dossier-1';
import { createDocument, createDocumentPreview } from './documents.js?v=desk-2';
import { createSupportPicker, requiresSupport, evaluateSupport, maxEvidenceCount } from './deduction-support.js?v=desk-2';
import { createEnding } from './ending.js?v=closure-1';
const questions = CASE_DATA.questions;
const evidence = CASE_DATA.evidence;
const storageKey = `raven-case:${CASE_DATA.id}`;
let storageAvailable = true;
let toastTimer;
let selectedAnswers = {};
let wrongAnswers = {};
let supportErrors = {};
let hintQuestions = new Set();

const stepEvidence = {
  Q01: ['E06', 'E02', 'E03'],
  Q02: ['E01', 'E02', 'E05'],
  Q03: ['E01', 'E07', 'E08'],
  Q04: ['E01', 'E07', 'E08'],
};


function freshState() {
  return { viewedIds: [], solvedIds: [], activeIndex: 0, revealed: false, supportByQuestion: {}, hintIds: [], hintHistoryComplete: true };
}

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved || typeof saved !== 'object') return freshState();
    const solvedIds = [];
    for (const question of questions) {
      if (!Array.isArray(saved.solvedIds) || !saved.solvedIds.includes(question.id)) break;
      solvedIds.push(question.id);
    }
    return {
      viewedIds: Array.isArray(saved.viewedIds) ? [...new Set(saved.viewedIds.filter((id) => evidence.some((item) => item.id === id)))] : [],
      solvedIds,
      activeIndex: Number.isInteger(saved.activeIndex) ? Math.max(0, Math.min(saved.activeIndex, solvedIds.length, questions.length)) : solvedIds.length,
      revealed: saved.revealed === true && solvedIds.length === questions.length,
      hintIds: Array.isArray(saved.hintIds) ? [...new Set(saved.hintIds.filter(id => questions.some(question => question.id === id)))] : [],
      hintHistoryComplete: saved.hintHistoryComplete === true && Array.isArray(saved.hintIds),
      supportByQuestion: Object.fromEntries(questions.filter(requiresSupport).map(question => [question.id,
        Array.isArray(saved.supportByQuestion?.[question.id]) ? [...new Set(saved.supportByQuestion[question.id].filter(id => evidence.some(item => item.id === id)))].slice(0, maxEvidenceCount(question)) : [],
      ])),
    };
  } catch {
    storageAvailable = false;
    return freshState();
  }
}

let state = readState();

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    storageAvailable = false;
  }
  updateSaveIndicator();
}

function updateSaveIndicator() {
  const indicator = $('#saved-indicator');
  indicator.replaceChildren(node('span', { 'aria-hidden': 'true', text: '●' }), document.createTextNode(storageAvailable ? ' يُحفظ تقدّمك على هذا الجهاز' : ' الحفظ غير متاح؛ أبقِ الصفحة مفتوحة'));
  $('#start-link').replaceChildren(document.createTextNode(state.solvedIds.length || state.viewedIds.length ? 'واصل التحقيق' : 'ابدأ بفحص الصورة'), node('span', { 'aria-hidden': 'true', text: '←' }));
}

function showToast(message) {
  const toast = $('#toast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

function image(src, alt, attributes = {}) {
  return node('img', { src, alt, loading: 'lazy', ...attributes, onError: (event) => {
    event.currentTarget.classList.add('image-unavailable');
    event.currentTarget.alt = '';
  } });
}

function initializeStory() {
  document.title = `${CASE_DATA.title} — رايفن`;
  $('#hero-subtitle').textContent = CASE_DATA.subtitle;
  $('#backstory').textContent = Array.isArray(CASE_DATA.backstory) ? CASE_DATA.backstory.join('\n\n') : CASE_DATA.backstory;
  $('#people-grid').replaceChildren(...CASE_DATA.people.map((person, index) => node('article', { class: 'person-card' }, [
    node('button', { class: 'person-open', type: 'button', 'aria-label': `افتح ملف ${person.name}`, 'aria-haspopup': 'dialog', onClick: () => openPerson(person.id) }, [
      node('div', { class: 'portrait-wrap' }, [image(person.image, `صورة ${person.name} في ملف القضية`, { width: 1086, height: 1448 }), node('span', { class: 'person-index', 'aria-hidden': 'true', text: String(index + 1).padStart(2, '0') })]),
      node('div', { class: 'person-copy' }, [
        node('p', { class: 'person-file-ref', text: `ملف ${String(index + 1).padStart(2, '0')} / ${person.id.toUpperCase()}` }),
        node('h3', { text: person.name }),
        node('p', { class: 'person-role', text: person.role }),
        node('span', { class: 'person-action', 'aria-hidden': 'true' }, [node('span', { text: 'عرض الصفة' }), node('span', { text: '←' })]),
      ]),
    ]),
  ])));
}

function renderEvidence() {
  $('#evidence-grid').replaceChildren(...evidence.map((item, index) => {
    const reviewed = state.viewedIds.includes(item.id);
    return node('button', { class: 'evidence-card', type: 'button', 'data-evidence-id': item.id, 'aria-label': `${item.title} — ${reviewed ? 'سبق فتحه، افتح الدليل' : 'افتح الدليل'}`, onClick: () => openEvidence(item.id) }, [
      node('div', { class: 'evidence-art' }, [
        createDocumentPreview(item, index),
        node('span', { class: 'evidence-num', 'aria-hidden': 'true', text: String(index + 1).padStart(2, '0') }),
        reviewed ? node('span', { class: 'reviewed-badge', text: '✓ فُتحت' }) : null,
      ]),
      node('div', { class: 'evidence-content' }, [
        node('p', { class: 'evidence-type', text: item.type }),
        node('h3', { text: item.title }),
        node('span', { class: 'evidence-card-footer' }, [node('span', { text: item.reference }), node('span', { text: 'اقرأ الدليل  ←' })]),
      ]),
    ]);
  }));
  $('#reviewed-count').textContent = `${arabic(state.viewedIds.length)} / ${arabic(evidence.length)} أدلة مفتوحة`;
  for (const button of document.querySelectorAll('.step-evidence-button')) {
    const reviewed = state.viewedIds.includes(button.dataset.evidenceId);
    $('.step-evidence-status', button).textContent = reviewed ? '✓ فُتحت' : 'افتح الورقة ←';
  }
}

const dialogTriggers = new WeakMap();
function openDialog(dialog, trigger = document.activeElement) {
  pauseScenes();
  dialogTriggers.set(dialog, trigger);
  dialog.showModal();
  document.body.style.overflow = 'hidden';
}

function openPerson(id) {
  const index = CASE_DATA.people.findIndex((person) => person.id === id);
  if (index < 0) return;
  const person = CASE_DATA.people[index];
  $('#person-kicker').textContent = `أطراف الملف / ${arabic(index + 1)} من ${arabic(CASE_DATA.people.length)}`;
  const description = person.description.startsWith(`${person.name}. `) ? person.description.slice(person.name.length + 2) : person.description;
  disposeScenes($('#person-content'));
  $('#person-content').replaceChildren(node('article', { class: 'person-dossier' }, [
    createScene({ id: person.id, poster: person.image, alt: `صورة ${person.name} في ملف القضية`, label: person.name, className: 'person-dossier-media', imageClass: 'person-dossier-portrait' }),
    node('div', { class: 'person-dossier-copy' }, [
      node('p', { class: 'eyebrow', text: 'التوقيع الرابع / ملف شخصية' }),
      node('h2', { id: 'person-title', text: person.name }),
      node('p', { class: 'person-dossier-role', text: person.role }),
      node('p', { class: 'person-dossier-description', text: description }),
      node('p', { class: 'person-dossier-note', text: 'الصفة الوظيفية والوقائع المسجّلة عند إعادة فتح القضية.' }),
      node('button', { class: 'button button-outline', type: 'button', 'data-close-dialog': true, text: 'عُد إلى أطراف الملف  ←' }),
    ]),
  ]));
  openDialog($('#person-dialog'));
  $('#person-dialog').scrollTop = 0;
}

function openEvidence(id, { replace = false, trigger } = {}) {
  const item = evidence.find((entry) => entry.id === id);
  if (!item) return;
  const index = evidence.indexOf(item);
  const origin = replace ? dialogTriggers.get($('#evidence-dialog')) : trigger || document.activeElement;
  const fromEnding = state.revealed && origin?.closest('#ending');
  $('#document-kicker').textContent = 'من ملف القضية';
  const content = [
    node('div', { class: 'document-tools' }, [
      node('p', { text: id === 'E06' ? 'قارن القصاصة بالإطار الكامل' : 'مقتطف من الأصل' }),
      node('button', { class: 'button button-outline', type: 'button', text: 'قارن هذه الوثيقة', onClick: () => {
        $('#compare-first').value = id;
        if ($('#compare-second').value === id) $('#compare-second').value = evidence.find(entry => entry.id !== id).id;
        activeComparisonTab = 0;
        const returnTarget = dialogTriggers.get($('#evidence-dialog')) || $('#active-question-title');
        $('#evidence-dialog').close();
        queueMicrotask(() => openComparison(returnTarget));
      } }),
    ]),
    createDocument(item, { titleId: 'document-title' }),
    node('div', { class: 'document-return' }, [node('button', { type: 'button', class: 'button button-gold', text: fromEnding ? 'عُد إلى الخلاصة ←' : 'عُد إلى الاستنتاج ←', onClick: () => {
      dialogTriggers.set($('#evidence-dialog'), fromEnding ? origin : $('#active-question-title'));
      $('#evidence-dialog').close();
      if (!fromEnding) focusQuestion();
    } })]),
  ];
  const attachmentImage = id === 'E06' ? 'assets/padlock.webp' : item.image;
  if (attachmentImage) {
    const sceneId = attachmentImage.includes('padlock') ? 'padlock' : attachmentImage.includes('documents') ? 'documents' : attachmentImage.includes('archive') ? 'archive' : /(?:fire|hero)/.test(attachmentImage) ? 'hero' : null;
    const attachment = node('details', { class: 'document-attachment' }, [node('summary', { text: id === 'E06' ? 'مشهد القفل · توضيحي' : 'افتح المرفق البصري' })]);
    attachment.append(node('p', { class: 'attachment-caption', text: 'تصوّر للمشهد؛ افحص نص الوثيقة للاستدلال.' }));
    attachment.addEventListener('toggle', () => {
      if (attachment.open && !attachment.querySelector('.scene-player,.document-visual')) {
        attachment.append(sceneId ? createScene({ id: sceneId, poster: attachmentImage, alt: `مرفق بصري: ${item.title}`, label: item.title, className: 'document-scene' }) : node('div', { class: 'document-visual' }, image(attachmentImage, item.title)));
      } else if (!attachment.open) pauseScenes();
    });
    content.push(attachment);
  }
  content.push(node('nav', { class: 'document-pagination', 'aria-label': 'تصفح وثائق القضية' }, [
    node('button', { type: 'button', disabled: index === 0, text: 'الوثيقة السابقة', onClick: () => openEvidence(evidence[index - 1].id, { replace: true }) }),
    node('button', { type: 'button', disabled: index === evidence.length - 1, text: 'الوثيقة التالية', onClick: () => openEvidence(evidence[index + 1].id, { replace: true }) }),
  ]));
  disposeScenes($('#document-content'));
  $('#document-content').replaceChildren(...content);
  const activeCardIndex = [...$('#evidence-grid').children].indexOf(document.activeElement);
  if (!state.viewedIds.includes(id)) {
    state.viewedIds.push(id);
    saveState();
    renderEvidence();
    if (activeCardIndex >= 0) $('#evidence-grid').children[activeCardIndex].focus({ preventScroll: true });
  }
  if (!replace) openDialog($('#evidence-dialog'), trigger || document.activeElement);
  $('#evidence-dialog').scrollTop = 0;
  if (replace) { $('#document-title').tabIndex = -1; $('#document-title').focus({ preventScroll: true }); }
}

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-dialog]')) dialog.close();
    else if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    disposeScenes(dialog);
    const anotherOpen = document.querySelector('dialog[open]');
    document.body.style.overflow = anotherOpen ? 'hidden' : '';
    const trigger = dialogTriggers.get(dialog);
    const returnTarget = trigger?.isConnected ? trigger : trigger?.dataset.evidenceId ? $(`.evidence-card[data-evidence-id="${trigger.dataset.evidenceId}"]`) : null;
    if (!anotherOpen && returnTarget) returnTarget.focus({ preventScroll: true });
    dialogTriggers.delete(dialog);
    refreshScenes();
  });
}

const mobileComparison = matchMedia('(max-width: 700px)');
let activeComparisonTab = 0;
let comparisonScroll = [0, 0];

function openComparison(trigger = document.activeElement) {
  renderComparison();
  openDialog($('#compare-dialog'), trigger);
}

function updateComparisonTabs() {
  const mobile = mobileComparison.matches;
  $('#comparison-tabs').hidden = !mobile;
  const tabs = [...$('#comparison-tabs').children];
  [...$('#comparison-documents').children].forEach((paper, index) => {
    paper.hidden = mobile && index !== activeComparisonTab;
    paper.setAttribute('role', mobile ? 'tabpanel' : 'region');
    paper.setAttribute('aria-labelledby', mobile ? `compare-tab-${index}` : `compare-title-${index}`);
    tabs[index].setAttribute('aria-selected', String(index === activeComparisonTab));
    tabs[index].tabIndex = index === activeComparisonTab ? 0 : -1;
  });
}

function initializeComparison() {
  const first = $('#compare-first');
  const second = $('#compare-second');
  for (const select of [first, second]) {
    select.replaceChildren(...evidence.map((item) => node('option', { value: item.id, text: item.title })));
    select.addEventListener('change', renderComparison);
  }
  if (evidence.length > 1) second.selectedIndex = 1;
  $('#comparison-presets').replaceChildren(...(CASE_DATA.comparisons || []).map((comparison) => node('button', {
    type: 'button', text: comparison.title, onClick: () => {
      first.value = comparison.leftId;
      second.value = comparison.rightId;
      renderComparison();
    },
  })));
  $('#open-compare').addEventListener('click', () => openComparison());
  mobileComparison.addEventListener('change', updateComparisonTabs);
}

function renderComparison() {
  const firstId = $('#compare-first').value;
  const secondId = $('#compare-second').value;
  const items = [firstId, secondId].map((id) => evidence.find((item) => item.id === id));
  comparisonScroll = [0, 0];
  $('#comparison-documents').replaceChildren(...items.filter(Boolean).map((item, index) => {
    const paper = createDocument(item, { comparison: true, titleId: `compare-title-${index}` });
    paper.id = `compare-doc-${index}`;
    paper.tabIndex = 0;
    return paper;
  }));
  $('#comparison-tabs').replaceChildren(...items.map((item, index) => node('button', {
    type: 'button', role: 'tab', id: `compare-tab-${index}`, 'aria-controls': `compare-doc-${index}`,
    text: `${index === 0 ? 'الأول' : 'الثاني'} · ${item.reference.split(' · ')[0]}`,
    onClick: () => {
      comparisonScroll[activeComparisonTab] = $('#comparison-documents').scrollTop;
      activeComparisonTab = index;
      updateComparisonTabs();
      $('#comparison-documents').scrollTop = comparisonScroll[index];
    },
    onKeydown: event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - activeComparisonTab;
      $(`#compare-tab-${next}`).click();
      $(`#compare-tab-${next}`).focus();
    },
  })));
  updateComparisonTabs();
  $('#comparison-documents').scrollTop = 0;
  $('#comparison-note').open = false;
  const comparison = (CASE_DATA.comparisons || []).find((item) => (item.leftId === firstId && item.rightId === secondId) || (item.rightId === firstId && item.leftId === secondId));
  $('#compare-observation').textContent = firstId === secondId ? 'اختر دليلين مختلفين لتبدأ المقارنة.' : comparison?.insight || 'قارن التوقيت والمصدر والعبارات المحدّدة. التشابه وحده لا يثبت أن الروايتين متطابقتان.';
}

function renderProgress() {
  $('#progress-label').textContent = `${arabic(state.solvedIds.length)} / ${arabic(questions.length)}`;
  $('#progress-fill').style.width = `${state.solvedIds.length / questions.length * 100}%`;
  $('#question-steps').replaceChildren(...questions.map((question, index) => {
    const solved = state.solvedIds.includes(question.id);
    return node('button', {
      type: 'button', class: `question-step${solved ? ' completed' : ''}`,
      disabled: index > state.solvedIds.length,
      'aria-current': index === state.activeIndex ? 'step' : null,
      'aria-label': `الاستنتاج ${arabic(index + 1)}${solved ? '، مكتمل' : index > state.solvedIds.length ? '، مغلق' : ''}`,
      onClick: () => { state.activeIndex = index; saveState(); renderQuestion(true); },
    }, [node('span', { 'aria-hidden': 'true', text: solved ? '✓' : arabic(index + 1) }), document.createTextNode(`استنتاج ${arabic(index + 1)}`)]);
  }));
}

function renderQuestion(moveFocus = false) {
  renderProgress();
  const panel = $('#question-panel');
  const question = questions[state.activeIndex];
  if (!question) {
    panel.replaceChildren(node('div', { class: 'completed-panel' }, [
      node('span', { class: 'completed-symbol', 'aria-hidden': 'true', text: '✓' }),
      node('p', { class: 'question-kicker', text: 'اكتملت سلسلة الاستنتاجات' }),
      node('h3', { id: 'active-question-title', tabindex: '-1', text: 'اكتملت استنتاجاتك.' }),
      node('p', { text: 'راجع في الخلاصة ما أثبتته الأوراق وما بقي غير محسوم.' }),
      node('button', { class: 'button button-gold', type: 'button', onClick: revealEnding, text: state.revealed ? 'عد إلى خلاصة القضية  ←' : 'افتح خلاصة القضية  ←' }),
    ]));
    if (moveFocus) focusQuestion();
    return;
  }
  const solved = state.solvedIds.includes(question.id);
  const leads = stepEvidence[question.id].map(id => evidence.find(item => item.id === id));
  const selected = solved ? question.correctId : selectedAnswers[question.id];
  const wrong = wrongAnswers[question.id];
  const options = node('fieldset', { class: 'question-options', 'aria-labelledby': 'active-question-title' });
  for (const option of question.options) {
    const isSelected = selected === option.id;
    const isWrong = wrong === option.id && !solved;
    const classes = ['question-option', isSelected ? 'selected' : '', solved && isSelected ? 'correct' : '', isWrong ? 'incorrect' : ''].filter(Boolean).join(' ');
    const input = node('input', {
      type: 'radio', name: `answer-${question.id}`, value: option.id,
      checked: isSelected, disabled: solved,
      onChange: () => {
        selectedAnswers[question.id] = option.id;
        delete wrongAnswers[question.id];
        delete supportErrors[question.id];
        for (const label of options.children) {
          label.classList.toggle('selected', $('input', label).value === option.id);
          label.classList.remove('incorrect');
          $('.option-status.wrong', label)?.remove();
        }
        $('#submit-answer').disabled = false;
        $('.answer-feedback.error', panel)?.remove();
      },
    });
    options.append(node('label', { class: classes }, [input, node('span', { text: option.label }), solved && isSelected ? node('span', { class: 'option-status', text: '✓ صحيح' }) : isWrong ? node('span', { class: 'option-status wrong', text: 'راجع الدليل' }) : null]));
  }
  const hintVisible = hintQuestions.has(question.id);
  const hintButton = node('button', { class: 'text-button', type: 'button', 'aria-expanded': hintVisible ? 'true' : 'false', 'aria-controls': 'question-hint', text: hintVisible ? 'أخفِ التلميح' : 'أحتاج تلميحًا', onClick: () => {
    const box = $('#question-hint');
    box.hidden = !box.hidden;
    hintButton.textContent = box.hidden ? 'أحتاج تلميحًا' : 'أخفِ التلميح';
    hintButton.setAttribute('aria-expanded', String(!box.hidden));
    if (box.hidden) hintQuestions.delete(question.id);
    else {
      hintQuestions.add(question.id);
      if (!solved && !state.revealed && !state.hintIds.includes(question.id)) { state.hintIds.push(question.id); saveState(); }
    }
  } });
  const submitButton = node('button', { id: 'submit-answer', class: 'button button-gold', type: 'button', disabled: !solved && !selected, text: solved ? (state.activeIndex === questions.length - 1 ? 'أكمل التحقيق  ←' : 'الاستنتاج التالي  ←') : 'ثبّت الاستنتاج  ←', onClick: () => {
    if (solved) {
      state.activeIndex += 1;
      saveState();
      renderQuestion(true);
      return;
    }
    const support = evaluateSupport(question, state.supportByQuestion[question.id]);
    if (selectedAnswers[question.id] === question.correctId && support.valid) {
      if (!state.solvedIds.includes(question.id)) state.solvedIds.push(question.id);
      delete wrongAnswers[question.id];
      delete supportErrors[question.id];
      saveState();
    } else if (selectedAnswers[question.id] === question.correctId) {
      delete wrongAnswers[question.id];
      supportErrors[question.id] = support.message;
    } else {
      wrongAnswers[question.id] = selectedAnswers[question.id];
      delete supportErrors[question.id];
    }
    renderQuestion();
    const feedback = $('.answer-feedback', panel);
    feedback.tabIndex = -1;
    feedback.scrollIntoView({ behavior: 'instant', block: 'center' });
    feedback.focus({ preventScroll: true });
  } });
  const supportPicker = !solved ? createSupportPicker(question, {
    selectedIds: state.supportByQuestion[question.id] || [],
    onChange: ids => {
      state.supportByQuestion[question.id] = ids;
      delete supportErrors[question.id];
      if (!wrongAnswers[question.id]) $('.answer-feedback.error', panel)?.remove();
      saveState();
    },
  }) : null;
  const content = [
    node('p', { class: 'question-kicker', text: `الاستنتاج ${arabic(state.activeIndex + 1)} من ${arabic(questions.length)}` }),
    node('h3', { id: 'active-question-title', tabindex: '-1', text: question.prompt }),
    node('div', { class: 'step-evidence', role: 'group', 'aria-label': 'أوراق هذه الخطوة' }, leads.map((item, index) => node('button', {
      type: 'button', class: 'step-evidence-button', 'data-evidence-id': item.id,
      'aria-label': `${item.title} — افتح الدليل`, onClick: () => openEvidence(item.id),
    }, [
      node('div', { class: 'step-evidence-art', 'aria-hidden': 'true' }, [createDocumentPreview(item, index)]),
      node('span', { class: 'step-evidence-title', text: item.title }),
      node('span', { class: 'step-evidence-status', text: state.viewedIds.includes(item.id) ? '✓ فُتحت' : 'افتح الورقة ←' }),
    ]))),
    node('button', { type: 'button', class: 'text-button question-compare', text: 'قارن ورقتين', onClick: () => {
      $('#compare-first').value = leads[0].id;
      $('#compare-second').value = leads[1].id;
      activeComparisonTab = 0;
      openComparison();
    } }),
    options,
    supportPicker,
    node('div', { class: 'question-actions' }, [submitButton, hintButton]),
    node('div', { class: 'hint-box', id: 'question-hint', hidden: !hintVisible, text: question.hint }),
  ];
  if (solved) content.push(node('div', { class: 'answer-feedback', role: 'status' }, [node('strong', { text: '✓ استنتاج تسنده الأدلة.' }), node('details', { class: 'answer-reasoning' }, [node('summary', { text: 'كيف تثبته الأوراق؟' }), node('p', { text: question.explanation })])]));
  else if (supportErrors[question.id]) content.push(node('div', { class: 'answer-feedback error', role: 'status' }, [node('strong', { text: 'أكمل سند الاستنتاج.' }), document.createTextNode(supportErrors[question.id])]));
  else if (wrong) content.push(node('div', { class: 'answer-feedback error', role: 'status' }, [node('strong', { text: 'هذا الاختيار لا تسنده الأوراق.' }), document.createTextNode('راجع مستندات الخطوة، ثم حاول مرة أخرى.')]));
  const linked = evidence;
  if (linked.length) {
    const library = node('div', { class: 'linked-evidence' }, [node('span', { text: 'افحص المستندات:' }), ...linked.map((item) => node('button', { type: 'button', class: 'evidence-chip', text: `${item.id} · ${item.title}`, onClick: () => openEvidence(item.id) }))]);
    content.push(node('details', { class: 'support-library' }, [node('summary', { text: 'بقية أوراق الملف' }), library]));
  }
  panel.replaceChildren(...content.filter(Boolean));
  if (moveFocus) focusQuestion();
}

function focusQuestion() {
  $('#question-panel').scrollIntoView({ behavior: 'instant', block: 'start' });
  $('#active-question-title').focus({ preventScroll: true });
}

$('#start-link').addEventListener('click', event => {
  event.preventDefault();
  $('#deductions').scrollIntoView({ behavior: 'instant', block: 'start' });
  if (!state.viewedIds.length && !state.solvedIds.length) {
    openEvidence('E06', { trigger: $('.step-evidence-button[data-evidence-id="E06"]') });
  } else focusQuestion();
});

function openCaseDrawer(hash) {
  const drawer = ['#evidence', '#people', '#briefing'].includes(hash) ? $(hash) : null;
  if (drawer) { drawer.open = true; drawer.scrollIntoView({ behavior: 'instant', block: 'start' }); }
}
for (const link of document.querySelectorAll('.section-links a')) {
  link.addEventListener('click', () => openCaseDrawer(link.getAttribute('href')));
}
window.addEventListener('hashchange', () => openCaseDrawer(location.hash));

function renderEnding() {
  const ending = $('#ending');
  disposeScenes(ending);
  if (!state.revealed || state.solvedIds.length !== questions.length) {
    ending.hidden = true;
    ending.replaceChildren();
    return;
  }
  ending.replaceChildren(createEnding(CASE_DATA, {
    hintCount: state.hintHistoryComplete ? state.hintIds.length : null,
    onOpenEvidence: (id, trigger) => openEvidence(id, { trigger }),
    onRestart: trigger => openDialog($('#reset-dialog'), trigger),
  }));
  ending.querySelector('a[href="#evidence"]')?.addEventListener('click', () => openCaseDrawer('#evidence'));
  ending.hidden = false;
}

function revealEnding() {
  if (state.solvedIds.length !== questions.length) return;
  state.revealed = true;
  saveState();
  renderEnding();
  $('#ending').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  $('#ending-title').focus({ preventScroll: true });
}

$('#reset-progress').addEventListener('click', () => openDialog($('#reset-dialog')));
$('#confirm-reset').addEventListener('click', () => {
  state = freshState();
  selectedAnswers = {};
  wrongAnswers = {};
  supportErrors = {};
  hintQuestions.clear();
  saveState();
  renderEvidence();
  renderQuestion();
  renderEnding();
  $('#reset-dialog').close();
  showToast('بدأ تحقيق جديد. جميع الأدلة متاحة للفحص.');
  $('#deductions').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  $('#active-question-title').focus({ preventScroll: true });
});

initializeStory();
initializeScenes();
renderEvidence();
initializeComparison();
renderQuestion();
renderEnding();
updateSaveIndicator();
openCaseDrawer(location.hash);
