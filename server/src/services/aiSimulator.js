const CASE_FACTS = {
  'on-the-other-side': {
    title: 'على الجانب الآخر',
    suspects: ['نبيل مراد', 'هالة مراد', 'مالك مراد', 'كمال ناصر'],
    facts: [
      'أبواب قاعة تقييم المقتنيات أُغلقت.',
      'أثر مسح كيميائي على حافة طاولة التقييم يطابق قفازات كمال ناصر.',
      'نبيل مراد غير توقيت السجل.',
      'هالة مراد كانت تقف في الزاوية العمياء للكاميرا.',
      'مالك مراد يدعي كسر الباب من الخارج لكن شظايا الزجاج سقطت باتجاه الخارج لا الداخل.'
    ],
    forbidden: ['لا تخترع دليلاً جديداً', 'لا تحدد الفاعل', 'لا تفتح مرحلة جديدة']
  }
};

export function generateDialogueReply({ caseId, userMessage, sessionContext, mode }) {
  const facts = CASE_FACTS[caseId];
  if (!facts) {
    return { text: 'لا توجد بيانات محاكاة لهذه القضية.', tokens: 10, costUsd: 0.0001 };
  }
  const hint = facts.facts[Math.floor(Math.random() * facts.facts.length)];
  const text = `بناءً على الأدلة الموجودة فقط: ${hint}\n(هذه محاكاة. الذكاء الاصطناعي لا يضيف حقائق جديدة.)`;
  return {
    text,
    tokens: Math.min(280, text.length),
    costUsd: 0.002,
    mode: mode || 'ai'
  };
}

export function estimateCost({ messages }) {
  return {
    estimatedUsd: (messages * 0.002).toFixed(4),
    note: 'تقدير محاكاة فقط. القياس الفعلي مطلوب قبل التسعير النهائي.'
  };
}
