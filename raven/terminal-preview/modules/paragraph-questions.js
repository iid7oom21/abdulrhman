import { node as el } from '../../../fourth-signature/dom.js?v=70ffb86082c1ed7e';

// Each answer has an exact clicked paragraph and exact already-opened sources.
const QUESTIONS = [
  { id: 'E01:1:sites', evidenceId: 'E01', paragraphIndex: 1,
    label: 'هل طلب الصيانة يصف القفل والمخرج بوصفهما الشيء نفسه؟',
    answer: 'يفصل MA-22 بين عطل مزلاج AR-01 وإجراء إزالة قفل EXT-02. اقرأ البندين معًا قبل تفسير اتهام المحضر.',
    sources: [['E03', 0], ['E03', 1]] },
  { id: 'E01:2:lucian', evidenceId: 'E01', paragraphIndex: 2,
    label: 'ما غرض توقيع لوسيان في LC-14؟',
    answer: 'يسجّل LC-14 تسليم نصفي القفل وقصّافة الأقفال المستعارة، وخانة لوسيان فيه «توقيع المسلّم». هذا وصف الأصل؛ قارن بنفسك الغرض بالنص الذي يعلو الأسماء في المحضر.',
    sources: [['E02', 1], ['E02', 2]] },
  { id: 'E01:3:recipient', evidenceId: 'E01', paragraphIndex: 3,
    label: 'أي غرض تسجّله خانة «توقيع المستلم» في RC-31؟',
    answer: 'يسجّل RC-31 استلام المرفقات وإحالتها، ويضع اسم نورا في خانة المستلم. الإيصال أُودع معها بوصفه الورقة الرابعة.',
    sources: [['E05', 2], ['E05', 3]] },
  { id: 'E06:1:coverage', evidenceId: 'E06', paragraphIndex: 1,
    label: 'ما حدود الإطار الكامل بحسب بطاقة الحفظ؟',
    answer: 'تذكر بطاقة PH-06 سياج قفص المعدات وبطاقة EXT-02، وتقول إن AR-01 خارج الإطار. لا تصف الصورة حالة ذلك المخرج أثناء الحريق.',
    sources: [['E06', 1]] },
];

function stateOf(services) { return services.caseStore?.get?.() || {}; }
function mayRead(services, id) {
  const viewed = stateOf(services).viewedIds;
  if (!Array.isArray(viewed) || !viewed.includes(id)) return false;
  try { return !services.investigation || services.investigation.getAccess(id).allowed === true; }
  catch { return false; }
}

export function availableParagraphQuestions(item, index, services) {
  if (!item || !mayRead(services, item.id)) return [];
  const evidence = Array.isArray(services.caseData?.evidence) ? services.caseData.evidence : [];
  return QUESTIONS.filter(q => q.evidenceId === item.id && q.paragraphIndex === index).flatMap(q => {
    const answerSources = q.sources.map(([evidenceId, paragraphIndex]) => {
      const source = evidence.find(entry => entry.id === evidenceId);
      const quote = source?.body?.[paragraphIndex];
      return mayRead(services, evidenceId) && typeof quote === 'string'
        ? { evidenceId, paragraphIndex, quote, title: source.title, reference: source.reference } : null;
    });
    return answerSources.every(Boolean) ? [{ ...q, answerSources }] : [];
  });
}

/** An inline disclosure; it neither solves a deduction nor invents evidence. */
export function attachParagraphQuestions(paragraphElement, item, index, services) {
  if (!paragraphElement || !QUESTIONS.some(q => q.evidenceId === item?.id && q.paragraphIndex === index)
    || paragraphElement.querySelector('[data-paragraph-questions]')) return () => {};
  const quote = item.body?.[index];
  if (typeof quote !== 'string') return () => {};
  const abort = new AbortController();
  const panelId = `paragraph-questions-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  const trigger = el('button', { type: 'button', class: 'case-paragraph-tool paragraph-question-btn', text: 'اسأل عن هذه الفقرة',
    'aria-expanded': 'false', 'aria-controls': panelId, 'data-paragraph-questions': `${item.id}:${index}` });
  const panel = el('section', { id: panelId, class: 'paragraph-question-panel', hidden: true, 'aria-label': 'سؤال وإجابة من المصادر المفتوحة' });
  let internalUpdate = false;
  const saved = q => (Array.isArray(stateOf(services).notes) ? stateOf(services).notes : [])
    .some(note => note?.questionId === q.id || note?.id === `pq:${q.id}`);

  function render() {
    panel.replaceChildren();
    const questions = availableParagraphQuestions(item, index, services);
    if (!questions.length) {
      panel.append(el('p', { role: 'status', text: 'لا توجد إجابة متاحة من الأدلة المفتوحة حاليًا. يمكنك تدوين سؤالك والعودة إليه بعد متابعة التحقيق.' }));
      return;
    }
    for (const question of questions) {
      const article = el('article', { class: 'paragraph-source-answer' }, [
        el('h4', { text: question.label }), el('p', { text: question.answer }),
      ]);
      question.answerSources.forEach(source => {
        const cite = el('button', { type: 'button', class: 'paragraph-source-link',
          text: `${source.reference.split(' · ')[0]} · الفقرة ${source.paragraphIndex + 1}`,
          disabled: typeof services.openEvidence !== 'function' });
        cite.addEventListener('click', () => {
          if (mayRead(services, source.evidenceId)) services.openEvidence?.(source.evidenceId, { paragraphIndex: source.paragraphIndex });
        }, { signal: abort.signal });
        article.append(el('blockquote', { class: 'paragraph-answer-quote', text: source.quote }), cite);
      });
      const save = el('button', { type: 'button', class: 'evidence-helper-button', 'data-save-paragraph-question': question.id,
        text: saved(question) ? 'محفوظ في أسئلتك ✓' : 'احفظ السؤال وإجابته', disabled: saved(question) });
      save.addEventListener('click', () => {
        const current = availableParagraphQuestions(item, index, services).find(q => q.id === question.id);
        if (!current || saved(question)) return;
        const notes = Array.isArray(stateOf(services).notes) ? stateOf(services).notes : [];
        if (notes.length >= 500) { services.notify?.('وصل دفتر الملاحظات إلى حده. احذف ملاحظة قبل الحفظ.'); return; }
        internalUpdate = true;
        try {
          services.caseStore.update(draft => {
            if (!Array.isArray(draft.notes)) draft.notes = [];
            if (draft.notes.some(note => note?.questionId === current.id || note?.id === `pq:${current.id}`)) return;
            draft.notes.push({ id: `pq:${current.id}`, questionId: current.id, evidenceId: item.id, paragraphIndex: index, quote,
              type: 'سؤال', text: `${current.label}\n${current.answer}`, createdAt: Date.now(),
              answerSources: current.answerSources.map(({ evidenceId, paragraphIndex, quote }) => ({ evidenceId, paragraphIndex, quote })) });
          });
        } finally { internalUpdate = false; }
        save.disabled = true; save.textContent = 'محفوظ في أسئلتك ✓';
        services.notify?.('حُفظ السؤال مع مصادر إجابته.');
      }, { signal: abort.signal });
      article.append(save); panel.append(article);
    }
  }
  function close() { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); }
  trigger.addEventListener('click', () => {
    const opening = panel.hidden;
    panel.hidden = !opening; trigger.setAttribute('aria-expanded', String(opening));
    if (opening) render();
  }, { signal: abort.signal });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); trigger.focus(); }
  }, { signal: abort.signal });
  (paragraphElement.querySelector('.case-paragraph-tools') || paragraphElement).append(trigger);
  paragraphElement.append(panel);
  const unsubscribe = services.caseStore?.subscribe?.(() => {
    if (!panel.hidden && !internalUpdate) render();
  });
  return () => { abort.abort(); unsubscribe?.(); trigger.remove(); panel.remove(); };
}
