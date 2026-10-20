import { CASE_DATA } from './case-data.js?v=fourth-1';
import { node } from './dom.js?v=dossier-1';

// Q03 pairs the execution record with the approved report. For Q04, AUD-07
// already matches its output to that report; citing the report too is valid.
const supportRules = {
  Q03: {
    legend: 'أرفق سند اختيارك',
    instruction: 'اختر دليلين يسندان اختيارك.',
    sets: [['E01', 'E07']],
  },
  Q04: {
    legend: 'أسند الخلاصة',
    instruction: 'اختر دليلين أو ثلاثة تغطي إنتاج المحضر وأساس الفصل وحدود ما نعرفه عن الحريق.',
    sets: [['E07', 'E08'], ['E01', 'E07', 'E08']],
  },
};

const evidenceIds = new Set(CASE_DATA.evidence.map((item) => item.id));
const questionId = (question) => typeof question === 'string' ? question : question?.id;

export function requiresSupport(question) {
  return Object.hasOwn(supportRules, questionId(question));
}

export function correctEvidenceSets(question) {
  return (supportRules[questionId(question)]?.sets || []).map((set) => [...set]);
}

export function maxEvidenceCount(question) {
  return Math.max(0, ...correctEvidenceSets(question).map((set) => set.length));
}

export function evaluateSupport(question, ids) {
  if (!requiresSupport(question)) return { valid: true, message: '' };
  const validSets = correctEvidenceSets(question);
  if (!Array.isArray(ids) || !validSets.some((set) => set.length === ids.length) || new Set(ids).size !== ids.length || ids.some((id) => !evidenceIds.has(id))) {
    return { valid: false, message: maxEvidenceCount(question) === 3
      ? 'اختر دليلين أو ثلاثة من أدلة الملف، دون تكرار، ثم ثبّت الاستنتاج.'
      : 'اختر دليلين مختلفين لإسناد استنتاجك، ثم ثبّته.' };
  }
  const valid = validSets.some((set) => set.length === ids.length && set.every((id) => ids.includes(id)));
  return {
    valid,
    message: valid
      ? 'أرفقت سندًا متكاملًا لاستنتاجك.'
      : 'الأدلة المختارة لا تكمل البرهان المطلوب. قارن مصدر كل معلومة وما يثبته فعلًا، ثم راجع اختيارك.',
  };
}

export function createSupportPicker(question, { selectedIds = [], onChange } = {}) {
  if (!requiresSupport(question)) return null;
  const id = questionId(question);
  const maximum = maxEvidenceCount(question);
  const validSelections = [...new Set((Array.isArray(selectedIds) ? selectedIds : []).filter((value) => evidenceIds.has(value)))];
  const selected = new Set(validSelections.slice(0, maximum));
  const instructionId = `support-instruction-${id}`;
  const statusId = `support-status-${id}`;
  const count = node('p', {
    id: statusId, class: 'support-count', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true',
  });
  const fieldset = node('fieldset', {
    class: 'deduction-support', 'data-support-question': id, 'aria-describedby': `${instructionId} ${statusId}`,
  }, [
    node('legend', { text: supportRules[id].legend }),
    node('p', { id: instructionId, class: 'support-instruction', text: supportRules[id].instruction }),
    count,
  ]);
  const choices = node('div', { class: 'support-choices' });
  const updateCount = (limitReached = false) => {
    if (limitReached) {
      count.textContent = maximum === 3
        ? 'يمكن اختيار ثلاثة أدلة كحد أقصى؛ أزل أحدها قبل إضافة دليل آخر.'
        : 'يمكن اختيار دليلين فقط؛ أزل أحدهما قبل إضافة دليل آخر.';
    } else if (selected.size === 0) {
      count.textContent = maximum === 3 ? 'لم تختر دليلًا بعد؛ اختر دليلين أو ثلاثة.' : 'لم تختر دليلًا بعد؛ اختر دليلين.';
    } else if (selected.size === 1) {
      count.textContent = 'اخترت دليلًا واحدًا؛ أضف دليلًا آخر.';
    } else if (selected.size === 2) {
      count.textContent = maximum === 3
        ? 'اخترت دليلين. يمكنك تثبيت الاستنتاج أو إرفاق دليل ثالث.'
        : 'اخترت دليلين. يمكنك تثبيت الاستنتاج أو تبديل أحدهما.';
    } else {
      count.textContent = 'اخترت ثلاثة أدلة. يمكنك تثبيت الاستنتاج أو تبديل أحدها.';
    }
  };

  for (const item of CASE_DATA.evidence) {
    const checked = selected.has(item.id);
    const input = node('input', {
      type: 'checkbox', name: `support-${id}`, value: item.id, checked,
    });
    const referenceCode = item.reference.split(' · ')[0];
    const label = node('label', { class: `support-choice${checked ? ' is-selected' : ''}` }, [
      input,
      node('span', { class: 'support-choice-copy' }, [
        node('span', { class: 'support-code', dir: 'ltr', text: `${item.id} · ${referenceCode}` }),
        node('span', { class: 'support-title', text: item.title }),
      ]),
    ]);
    input.addEventListener('change', () => {
      if (input.checked && selected.size >= maximum) {
        input.checked = false;
        updateCount(true);
        return;
      }
      if (input.checked) selected.add(item.id);
      else selected.delete(item.id);
      label.classList.toggle('is-selected', input.checked);
      updateCount();
      onChange?.([...selected]);
    });
    choices.append(label);
  }
  fieldset.append(choices);
  updateCount();
  return fieldset;
}
