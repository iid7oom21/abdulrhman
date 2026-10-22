import { node as el } from '../../../fourth-signature/dom.js';
import { ACTIVITIES } from './expansion-data.js';

const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value : '';
const unique = value => [...new Set(list(value).filter(id => typeof id === 'string'))];

/** A body for the existing toolkit dialog, never a new unmanaged modal. */
export function renderResumeMemo(services, { resume, openEvidence } = {}) {
  const state = services.caseStore?.get?.() || {};
  const snapshot = services.investigation?.getSnapshot?.() || state.progress || {};
  const evidence = list(services.caseData?.evidence);
  const evidenceById = new Map(evidence.map(item => [item.id, item]));
  const activities = Array.isArray(ACTIVITIES) ? ACTIVITIES : [];
  const activityById = new Map(activities.map(item => [item.id, item]));
  const accessible = id => {
    try { return evidenceById.has(id) && (!services.investigation || services.investigation.getAccess(id).allowed === true); }
    catch { return false; }
  };
  const viewed = unique(state.viewedIds).filter(accessible);
  const opened = new Set(viewed);
  const completed = unique(snapshot.completedActivityIds).filter(id => activityById.has(id));
  const solved = unique(snapshot.solvedIds || state.solvedIds).filter(id => list(services.caseData?.questions).some(q => q.id === id));
  const notes = list(state.notes).filter(note => note && typeof note === 'object' && typeof note.text === 'string'
    && (!note.evidenceId || opened.has(note.evidenceId)));
  const questions = notes.filter(note => typeof note.questionId === 'string'
    && list(note.answerSources).length > 0
    && list(note.answerSources).every(source => source && opened.has(source.evidenceId) && typeof source.quote === 'string'));
  const personal = notes.filter(note => !note.questionId);
  const current = snapshot.currentActivity || activities.find(item => !completed.includes(item.id));
  const sourceAction = openEvidence || services.openEvidence;
  const root = el('article', { class: 'resume-memo', 'data-resume-memo': '' }, [
    el('p', { class: 'evidence-helper-label', text: 'مذكرة الاستئناف · ملف ٠١٧' }),
    el('p', { class: 'resume-memo-intro', text: current ? `خطوتك التالية: ${current.title}.` : 'أنجزت أنشطة المراجعة. يمكنك العودة إلى التقرير وأسانيده.' }),
  ]);
  const progress = el('section', { class: 'resume-memo-section', 'aria-label': 'التقدم المسجل' }, [
    el('h3', { text: 'التقدم المسجل' }),
    el('p', { text: `${completed.length} / ${activities.length || 32} نشاطًا · ${solved.length} / 4 استنتاجات · ${viewed.length} / ${evidence.length || 16} دليلًا مفتوحًا` }),
  ]);
  if (typeof resume === 'function') progress.append(el('button', { type: 'button', class: 'evidence-helper-button',
    'data-resume-investigation': '', text: current ? 'واصل المهمة الحالية ←' : 'عُد إلى التحقيق ←', onClick: () => resume(current?.id) }));
  const done = el('details', { class: 'resume-memo-details' }, [el('summary', { text: 'الأنشطة المنجزة' })]);
  done.append(completed.length ? el('ol', {}, completed.map(id => {
    const activity = activityById.get(id);
    return el('li', { text: `${activity.number || activities.indexOf(activity) + 1}. ${activity.title}` });
  })) : el('p', { text: 'لم تُثبت نتيجة نشاط بعد.' }));
  progress.append(done);
  const sourceList = el('details', { class: 'resume-memo-details' }, [el('summary', { text: 'الأدلة المفتوحة' })]);
  sourceList.append(viewed.length ? el('ul', {}, viewed.map(id => {
    const item = evidenceById.get(id);
    return el('li', {}, el('button', { type: 'button', class: 'paragraph-source-link',
      text: `${item.title} · ${item.reference.split(' · ')[0]}`, disabled: typeof sourceAction !== 'function',
      onClick: () => { if (accessible(id)) sourceAction?.(id); } }));
  })) : el('p', { text: 'لم تفتح دليلًا بعد.' }));
  progress.append(sourceList); root.append(progress);

  function noteCard(note, isQuestion = false) {
    const card = el('article', { class: 'resume-memo-note' }, [
      el('p', { class: 'evidence-helper-label', text: isQuestion ? 'سؤال محفوظ من المصادر' : (text(note.type) || 'ملاحظة شخصية') }),
      el('p', { class: 'resume-memo-note-text', text: note.text }),
    ]);
    const sources = isQuestion ? list(note.answerSources) : [{ evidenceId: note.evidenceId, paragraphIndex: note.paragraphIndex, quote: note.quote }];
    for (const source of sources) {
      if (!opened.has(source.evidenceId)) continue;
      const item = evidenceById.get(source.evidenceId);
      const index = Number.isInteger(source.paragraphIndex) && source.paragraphIndex >= 0 ? source.paragraphIndex : null;
      const quote = text(source.quote);
      const exact = index !== null && item.body?.[index] === quote;
      if (quote) card.append(el('details', { class: 'resume-memo-details' }, [el('summary', { text: 'الاقتباس المحفوظ' }), el('blockquote', { text: quote })]));
      card.append(el('button', { type: 'button', class: 'paragraph-source-link', text: item.title,
        disabled: typeof sourceAction !== 'function', onClick: () => {
          if (accessible(item.id)) sourceAction?.(item.id, exact ? { paragraphIndex: index } : {});
        } }));
      if (quote && index !== null && !exact) card.append(el('p', { class: 'evidence-helper-label', text: 'حُفظ هذا الاقتباس سابقًا؛ يفتح الرابط الوثيقة دون افتراض تطابق رقم الفقرة الحالي.' }));
    }
    return card;
  }
  root.append(el('section', { class: 'resume-memo-section', 'aria-label': 'ملاحظاتك الشخصية' }, [
    el('h3', { text: 'ملاحظاتك الشخصية' }), el('p', { text: 'تعبّر عن قراءتك وفرضياتك؛ ليست نتائج مثبتة تلقائيًا.' }),
    ...(personal.length ? personal.map(note => noteCard(note)) : [el('p', { text: 'لا توجد ملاحظات شخصية محفوظة.' })]),
  ]));
  root.append(el('section', { class: 'resume-memo-section', 'aria-label': 'أسئلتك المحفوظة ومصادرها' }, [
    el('h3', { text: 'أسئلتك المحفوظة ومصادرها' }),
    ...(questions.length ? questions.map(note => noteCard(note, true)) : [el('p', { text: 'لا توجد أسئلة محفوظة من مصادر مفتوحة.' })]),
  ]));
  return root;
}
