import { CASE_VERSION, PEOPLE, EVIDENCE, ORDER, PUZZLES } from './last-call-data.js?v=0e63bd470374096b';

const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const list = value => Array.isArray(value) ? value : [];
const unique = value => [...new Set(list(value))];
const text = value => typeof value === 'string' ? value : '';
const has = (state, id) => state.solved.includes(id);
const evidenceFor = state => EVIDENCE.filter(item => item.requires.every(id => has(state, id)));
const allConfronted = state => PEOPLE.every(person => state.confronted.includes(person.id));
const allSolved = state => ORDER.every(id => has(state, id));
const exactOrder = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && expected.every((id, i) => actual[i] === id);
const exactSet = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && new Set(actual).size === expected.length && expected.every(id => actual.includes(id));
const digits = value => String(value ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).trim();
const time = value => digits(value).replace(/[：٫]/g, ':').replace(/\s/g, '');
const evidenceIdsForVerdict = ['message', 'access', 'ledger'];

export function emptyState() {
  return { version: CASE_VERSION, solved: [], inspected: [], confronted: [], notes: '', accusation: null, hints: {}, started: false };
}

function validVerdict(state, value) {
  const answer = record(value);
  return allSolved(state) && allConfronted(state) && answer.culprit === 'raed' && answer.accomplice === 'reem'
    && exactSet(answer.evidenceIds, evidenceIdsForVerdict);
}

/** Defensive local-save parsing, not a security boundary for paid services. */
export function normalizeState(raw) {
  const input = record(raw);
  const state = emptyState();
  if (input.version !== CASE_VERSION) return state;
  const accepted = unique(input.solved);
  for (const id of ORDER) {
    if (!accepted.includes(id)) break;
    state.solved.push(id);
  }
  const available = new Set(evidenceFor(state).map(item => item.id));
  state.inspected = unique(input.inspected).filter(id => available.has(id));
  state.confronted = unique(input.confronted).filter(id => {
    const person = PEOPLE.find(item => item.id === id);
    return person && available.has(person.confrontation.evidenceId);
  });
  if (has(state, 'confrontation') && !allConfronted(state)) state.solved.pop();
  state.notes = text(input.notes).slice(0, 4000);
  const hints = record(input.hints);
  for (const puzzle of PUZZLES) {
    if (!puzzle.requires.every(id => has(state, id))) continue;
    const count = Number(hints[puzzle.id]);
    if (Number.isFinite(count) && count > 0) state.hints[puzzle.id] = Math.min(3, Math.floor(count));
  }
  state.started = input.started === true || state.solved.length > 0 || state.confronted.length > 0;
  if (validVerdict(state, input.accusation)) state.accusation = { culprit: 'raed', accomplice: 'reem', evidenceIds: [...evidenceIdsForVerdict] };
  return state;
}

export function availableEvidence(state) { return evidenceFor(normalizeState(state)); }
export function isUnlocked(raw, puzzleId) {
  const state = normalizeState(raw);
  const puzzle = PUZZLES.find(item => item.id === puzzleId);
  return Boolean(puzzle && puzzle.requires.every(id => has(state, id)));
}
export function nextPuzzle(state) {
  const current = normalizeState(state);
  return ORDER.find(id => !has(current, id)) || null;
}
const result = (ok, state, message) => ({ ok, state, message });

export function solve(raw, puzzleId, value) {
  const state = normalizeState(raw);
  const answer = record(value);
  if (!ORDER.includes(puzzleId)) return result(false, state, 'هذه الخطوة غير موجودة في الملف.');
  if (!isUnlocked(state, puzzleId)) return result(false, state, 'أكمل الخطوة السابقة حتى تتوفر مصادر هذا الاستنتاج.');
  if (has(state, puzzleId)) return result(true, state, 'هذا الاستنتاج مثبت ومحفوظ بالفعل.');
  let feedback = '';
  switch (puzzleId) {
    case 'photo':
      if (!exactSet(answer.hotspots, ['drive', 'ledger', 'phone'])) feedback = 'بقي ما يستحق الفحص. ابحث عن قرص النسخ والدفتر الأزرق وشاشة الهاتف، وثبّت العناصر الثلاثة.';
      break;
    case 'message':
      if (time(answer.recorded) !== '21:47') feedback = 'راجع وقت إنشاء التسجيل في تصدير الهاتف؛ لا تضع وقت التسليم في خانة التسجيل.';
      else if (time(answer.delivered) !== '22:17') feedback = 'راجع وقت التسليم الفعلي للرسالة، وهو مختلف عن وقت إنشائها.';
      else if (answer.meaning !== 'scheduled') feedback = 'الوقت وحده لا يفسر الفرق. اقرأ وضع الإرسال: هل حدث اتصال حي أم تسليم آلي لرسالة أُعدت سابقًا؟';
      break;
    case 'clock':
      if (digits(answer.offset) === '' || Number(digits(answer.offset)) !== 7) feedback = 'قارن وقت الومضة في الجهاز المستقل بوقت الحدث نفسه على كاميرا الممر. ما مقدار تقدم الكاميرا؟';
      else if (time(answer.entry) !== '22:07' || time(answer.exit) !== '22:09') feedback = 'كاميرا الممر متقدمة؛ اطرح سبع دقائق من 22:14 و22:16. لا تغيّر وقت البوابة المستقل.';
      break;
    case 'receipt':
      if (!exactOrder(answer.order, ['header', 'item', 'approval', 'footer'])) feedback = 'رتب النموذج من رأس العملية إلى المحتوى، ثم اسم المسلّمة واعتمادها، وأخيرًا ختم الجهاز.';
      else if (answer.changed !== 'ledger') feedback = 'ارجع إلى مقارنة المشهدين: ما الذي كان على المكتب عند 21:53 وحل الملف الرمادي مكانه؟';
      break;
    case 'custody':
      if (!exactOrder(answer.order, ['sarah', 'yusuf', 'reem', 'raed', 'mazen', 'layan'])) feedback = 'تتبّع أختام النسخة من 21:10 إلى 21:40. رتب من قام بالمسح والطباعة والتسجيل والاعتماد وختم الصادر والاستلام.';
      break;
    case 'confrontation':
      if (!allConfronted(state)) feedback = `بقيت إفادة غير مثبتة. واجه ${PEOPLE.filter(person => !state.confronted.includes(person.id)).map(person => person.name).join('، ')} بالمصدر الذي يناقض كلامهم.`;
      else if (answer.confirmed !== true) feedback = 'راجع الإفادات الست ثم اختر تثبيت محضر المواجهات.';
      break;
  }
  if (feedback) return result(false, state, feedback);
  state.solved.push(puzzleId);
  state.started = true;
  return result(true, state, puzzleId === 'confrontation' ? 'ثُبتت الإفادات الست. أصبح ملف الاستنتاج النهائي جاهزًا.' : 'ثُبت الاستنتاج وحُفظ تقدمك. يمكنك الانتقال إلى الخطوة التالية.');
}

export function confront(raw, personId, evidenceId) {
  const state = normalizeState(raw);
  const person = PEOPLE.find(item => item.id === personId);
  if (!person) return result(false, state, 'اختر شخصية موجودة في الملف.');
  const available = evidenceFor(state).some(item => item.id === evidenceId);
  if (!available) return result(false, state, 'هذا المصدر لم يُفتح بعد. تابع فحص الأدلة ثم عد إلى المواجهة.');
  if (evidenceId !== person.confrontation.evidenceId) return result(false, state, `هذا المصدر لا يناقض إفادة ${person.name} المحددة. اربط الدليل بالعبارة التي تريد تصحيحها.`);
  if (!state.confronted.includes(personId)) state.confronted.push(personId);
  if (!state.inspected.includes(evidenceId)) state.inspected.push(evidenceId);
  state.started = true;
  return result(true, state, person.confrontation.response);
}

export function accuse(raw, value) {
  const state = normalizeState(raw);
  const answer = record(value);
  if (!allSolved(state) || !allConfronted(state)) return result(false, state, 'الملف لم يكتمل بعد. ثبّت الاستنتاجات الست وواجه جميع الشخصيات قبل توجيه الاتهام.');
  if (!PEOPLE.some(person => person.id === answer.culprit) || !PEOPLE.some(person => person.id === answer.accomplice)) return result(false, state, 'حدد منفذ الاعتداء ومن تستر على الأدلة، كلًّا بحسب دوره.');
  if (answer.culprit === answer.accomplice) return result(false, state, 'هناك دوران مختلفان: اعتداء أثناء نافذة الواقعة، وعبث بالسجل بعدها. راجع أدلة كل دور.');
  if (answer.culprit !== 'raed') return result(false, state, 'هذا الاتهام لا يطابق سجل المدخل الوحيد ونافذة الواقعة. راجع مسار R4 والتسجيلات التي تحدد أماكن بقية الأشخاص.');
  if (answer.accomplice !== 'reem') return result(false, state, 'التهديد أو النسخ أو الإهمال ليس هو استبدال السجل. ارجع إلى توقيع نموذج التسليم وختمه عند 22:18.');
  if (!exactSet(answer.evidenceIds, evidenceIdsForVerdict)) return result(false, state, 'اختر ثلاثة مصادر تجمع: تفسير الرسالة المتأخرة، ومسار دخول صاحب البطاقة، وفروق الدفتر والعقد. هذه تربط الزمن بالفعل والدافع، ويؤيدها باقي الملف.');
  state.accusation = { culprit: 'raed', accomplice: 'reem', evidenceIds: [...evidenceIdsForVerdict] };
  return result(true, state, 'اكتمل التحقيق: رائد نفّذ الاعتداء، وريم تسترت على تعديل العقد بعده. ثبتت أدوار الأشخاص الستة بأدلتها، دون مساواة أسرارهم جميعًا بالاعتداء.');
}
