import { CASE_DATA } from './case-data.js?v=dossier-1';
import { node, arabic } from './dom.js?v=dossier-1';

// These pairs have distinct jobs: the record of an action and the document
// establishing its consequence (Q03), then proof and the file's limits (Q04).
const supportRules = {
  Q03: {
    instruction: 'أرفق مصدرًا يوثّق التنفيذ، ونسخة تربط الناتج بقرار الفصل. اختر دليلين من الملف.',
    pairs: [['E01', 'E07']],
  },
  Q04: {
    instruction: 'اختر دليلين يجمعان ما ثبت عن المحضر وما لا تسمح الأصول بحسمه عن الحريق.',
    pairs: [['E07', 'E08']],
  },
};

const evidenceIds = new Set(CASE_DATA.evidence.map((item) => item.id));
const questionId = (question) => typeof question === 'string' ? question : question?.id;

export function requiresSupport(question) {
  return Object.hasOwn(supportRules, questionId(question));
}

export function correctEvidenceSets(question) {
  return (supportRules[questionId(question)]?.pairs || []).map((pair) => [...pair]);
}

export function evaluateSupport(question, ids) {
  if (!requiresSupport(question)) return { valid: true, message: '' };
  if (!Array.isArray(ids) || ids.length !== 2 || new Set(ids).size !== 2 || ids.some((id) => !evidenceIds.has(id))) {
    return { valid: false, message: 'اختر دليلين مختلفين لإسناد استنتاجك، ثم ثبّته.' };
  }
  const valid = correctEvidenceSets(question).some((pair) => pair.every((id) => ids.includes(id)));
  return {
    valid,
    message: valid
      ? 'ربطت الاستنتاج بدليلين متكاملين.'
      : 'الدليلان المختاران لا يكملان البرهان المطلوب. قارن مصدر كل معلومة وما يثبته فعلًا، ثم راجع اختيارك.',
  };
}

export function createSupportPicker(question, { selectedIds = [], onChange } = {}) {
  if (!requiresSupport(question)) return null;
  const id = questionId(question);
  const validSelections = [...new Set((Array.isArray(selectedIds) ? selectedIds : []).filter((value) => evidenceIds.has(value)))];
  const selected = new Set(validSelections.slice(0, 2));
  const instructionId = `support-instruction-${id}`;
  const statusId = `support-status-${id}`;
  const count = node('p', {
    id: statusId, class: 'support-count', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true',
  });
  const fieldset = node('fieldset', {
    class: 'deduction-support', 'data-support-question': id, 'aria-describedby': `${instructionId} ${statusId}`,
  }, [
    node('legend', { text: 'أسند استنتاجك بدليلين' }),
    node('p', { id: instructionId, class: 'support-instruction', text: supportRules[id].instruction }),
    count,
  ]);
  const choices = node('div', { class: 'support-choices' });
  const updateCount = (limitReached = false) => {
    count.textContent = limitReached
      ? `اخترت ${arabic(2)} من ${arabic(2)}. أزل أحد الاختيارين قبل إضافة دليل آخر.`
      : `${arabic(selected.size)} من ${arabic(2)} أدلة مختارة${selected.size === 2 ? ' — يمكنك تثبيت الاستنتاج أو تبديل أحدهما.' : '.'}`;
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
      if (input.checked && selected.size === 2) {
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
