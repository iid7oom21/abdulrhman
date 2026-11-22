const words = (ar, en) => ({ ar, en });
const shot = (id, seconds, name, description) => ({
  id, seconds, name, description, image: './assets/' + id + '.webp',
});
export const SHOTS = {
  exterior: shot('exterior', 5, words('واجهة المبنى', 'The exterior'), words('واجهة المبنى في أول الليل.', 'A building exterior at dusk.')),
  hand: shot('hand', 4, words('وضع الظرف', 'The hand'), words('يد تضع ظرفًا على سطح الطاولة.', 'A hand places an envelope on the table.')),
  envelope: shot('envelope', 3, words('الظرف على الطاولة', 'The envelope'), words('بقي الظرف وحده على الطاولة.', 'The envelope rests alone on the table.')),
  lamp: shot('lamp', 6, words('المصباح', 'The lamp'), words('ضوء مصباح فوق سطح العمل.', 'A lamp lights the work surface.')),
};
export const SHOT_IDS = Object.keys(SHOTS);
export const CONSTRAINTS = {
  none: words('الترتيب مفتوح', 'Any order'),
  establish: words('ابدأ بواجهة المبنى', 'Open on the exterior'),
  effect: words('اختم بالظرف المستقر', 'End on the resting envelope'),
  continuity: words('اقطع من اليد مباشرة إلى الظرف المستقر', 'Cut directly from the hand to the resting envelope'),
  lamp: words('ابدأ بالمصباح', 'Open on the lamp'),
  opening: words('المكان ثم الفعل ثم الأثر', 'Place, then action, then aftermath'),
};
function round(id, title, brief, slots, limit, constraint, library = SHOT_IDS) {
  return { id, title, brief, slots, limit, constraint, library };
}
export const ROUNDS = [
  round('transmission', words('آخر إرسال', 'Last Transmission'), words('عرّفني بالمكان، ورّني الفعل، واختم بأثره خلال ١٢ ثانية.', 'Establish the place, show the action, and end on its aftermath within 12 seconds.'), 3, 12, 'opening'),
  round('night', words('افتتاح ليلي', 'Night opening'), words('افتح المشهد بضوء المصباح. اختر اللقطتين التاليتين بحرية وأنهِ النسخة خلال ١٥ ثانية.', 'Open on the light of the lamp. Pick two more shots and finish within 15 seconds.'), 3, 15, 'lamp'),
  round('time', words('الشريط القصير', 'Short reel'), words('لك لقطتان كاملتان وثماني ثوانٍ على الشاشة. اختر ما تحتفظ به.', 'You have two full shots and eight seconds of screen time. Choose what stays.'), 2, 8, 'none'),
  round('continuity', words('قطع على الحركة', 'Match on action'), words('في مونتاج من ثلاث لقطات، اقطع من وضع الظرف مباشرة إلى الظرف المستقر. اختر موقع هذا القطع.', 'In a three-shot cut, follow the hand placing the envelope immediately with the envelope at rest. Choose where to put the cut.'), 3, 15, 'continuity'),
];
export const FORMAT = 'raven-edit-challenge-1';
export function duration(ids) {
  return ids.reduce((total, id) => total + (Object.hasOwn(SHOTS, id) ? SHOTS[id].seconds : 0), 0);
}
export function score(challenge, ids) {
  const structure = ids.length === challenge.slots && new Set(ids).size === ids.length && ids.every(id => challenge.library.includes(id));
  const seconds = duration(ids);
  const time = seconds <= challenge.limit;
  const constraint = challenge.constraint;
  const tests = {
    none: () => true,
    establish: () => ids[0] === 'exterior',
    lamp: () => ids[0] === 'lamp',
    effect: () => ids.at(-1) === 'envelope',
    continuity: () => ids.some((id, i) => id === 'hand' && ids[i + 1] === 'envelope'),
    opening: () => ids.join(',') === 'exterior,hand,envelope',
  };
  const order = Object.hasOwn(tests, constraint) && tests[constraint]();
  return { seconds, time, order, structure, pass: structure && time && order };
}
export function solutions(challenge) {
  const complete = [];
  function place(ids) {
    if (ids.length === challenge.slots) {
      if (score(challenge, ids).pass)
        complete.push(ids);
      return;
    }
    for (const id of challenge.library)
      if (!ids.includes(id))
        place([...ids, id]);
  }
  place([]);
  return complete;
}
export function dailyRound(date) {
  let seed = 0;
  for (const letter of FORMAT + ':' + date)
    seed = (Math.imul(seed, 31) + letter.charCodeAt(0)) >>> 0;
  return ROUNDS[seed % ROUNDS.length];
}
export function challengeFile(title, slots, limit, constraint, library) {
  return { format: FORMAT, title, slots, limit, constraint, library };
}
export function validateFile(file) {
  if (!file || typeof file !== 'object' || file.format !== FORMAT)
    return 'format';
  if (typeof file.title !== 'string' || file.title.length > 80 || !file.title.trim())
    return 'title';
  if (!Array.isArray(file.library) || file.library.length > 4 ||
    file.library.some(id => typeof id !== 'string' || !Object.hasOwn(SHOTS, id)) ||
    new Set(file.library).size !== file.library.length)
    return 'library';
  if (!Number.isInteger(file.slots) || file.slots < 1 || file.slots > file.library.length)
    return 'slots';
  if (!Number.isInteger(file.limit) || file.limit < 3 || file.limit > 24)
    return 'limit';
  if (typeof file.constraint !== 'string' || !Object.hasOwn(CONSTRAINTS, file.constraint))
    return 'rule';
  return solutions(file).length ? null : 'unsolvable';
}
export function customRound(file) {
  return round('custom', words(file.title, file.title), CONSTRAINTS[file.constraint], file.slots, file.limit, file.constraint, [...file.library]);
}
export function generateBrief(pace, limit, constraint) {
  const title = pace === 'brisk' ? words('قصّة مكثّفة', 'A brisk cut') : words('لحظة ممتدة', 'A lingering moment');
  const counts = pace === 'brisk' ? [4, 3, 2, 1] : [2, 3, 1];
  for (const slots of counts) {
    const proposed = round('brief', title, CONSTRAINTS[constraint], slots, limit, constraint);
    const playable = solutions(proposed);
    if (playable.length) {
      const usable = new Set(playable.flat());
      return { ...proposed, library: SHOT_IDS.filter(id => usable.has(id)) };
    }
  }
  return null;
}
