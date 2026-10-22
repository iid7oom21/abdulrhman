import { REVISION, ACTIVITIES } from '../../../modules/expansion-data.js';
import { emptyProgress, normalizeProgress, availableEvidenceIds, evaluateActivity, sanitizePayload } from '../../../modules/investigation.js';

export class CommandError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
export const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const fail = (code, message, status) => { throw new CommandError(code, message, status); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);

export function freshRunState() {
  return { progress: { ...emptyProgress(), mode: 'ranked', revision: REVISION }, viewedIds: [] };
}

/** Pure evaluation. Database commits the returned delta under a row lock/CAS. */
export function evaluateCommand(snapshot, command) {
  if (!plain(command) || !uuid(command.requestId)) fail('INVALID_REQUEST', 'معرّف الطلب غير صالح.');
  if (!Number.isSafeInteger(command.expectedSeq) || command.expectedSeq < 0) fail('INVALID_REQUEST', 'تسلسل الطلب غير صالح.');
  if (!plain(snapshot) || snapshot.progress?.revision !== REVISION) fail('RULESET_MISMATCH', 'إصدار القضية غير متوافق.', 409);
  if (snapshot.status !== 'active') fail('RUN_CLOSED', 'هذه المحاولة مغلقة.', 409);
  if (snapshot.progress.seq !== command.expectedSeq) fail('STALE_SEQUENCE', 'حدّث المحاولة قبل إعادة الإرسال.', 409);

  const progress = normalizeProgress(snapshot.progress);
  progress.mode = 'ranked'; progress.runId = snapshot.progress.runId;
  // Restore server fields; normalizeProgress must never be allowed to set the score.
  progress.seq = snapshot.progress.seq;
  progress.startedAt = snapshot.progress.startedAt;
  progress.wrongSubmissions = snapshot.progress.wrongSubmissions;
  progress.requestResults = {};
  const allowed = new Set(availableEvidenceIds(progress));
  const viewedIds = [...new Set((snapshot.viewedIds || []).filter(id => allowed.has(id)))];
  const state = { progress, viewedIds };
  const next = ACTIVITIES[progress.completedActivityIds.length];
  const event = { state, outcome: { ok: true, valid: true, correct: false, accepted: false, seq: progress.seq + 1 }, hintDelta: 0, wrongDelta: 0, complete: false };

  if (command.action === 'mark-viewed') {
    if (typeof command.evidenceId !== 'string' || !allowed.has(command.evidenceId)) fail('EVIDENCE_LOCKED', 'هذا الدليل غير متاح بعد.', 403);
    if (!viewedIds.includes(command.evidenceId)) viewedIds.push(command.evidenceId);
    return { ...event, kind: 'view', outcome: { ...event.outcome, message: 'فُتح الدليل.' } };
  }
  if (command.action === 'abandon-run') return { ...event, kind: 'abandon', outcome: { ...event.outcome, message: 'أغلقت المحاولة دون نشر نتيجة.' } };
  if (!next || command.activityId !== next.id) fail('ACTIVITY_LOCKED', 'أكمل النشاط الحالي أولًا.', 409);

  if (command.action === 'reveal-hint') {
    const level = command.level;
    if (!Number.isInteger(level) || level < 1 || level > 3) fail('INVALID_HINT', 'مستوى التلميح غير صالح.');
    const prior = progress.hintsByActivity[next.id] || [];
    if (!prior.includes(level) && level !== prior.length + 1) fail('INVALID_HINT', 'افتح التلميحات بالترتيب.');
    event.hintDelta = prior.includes(level) ? 0 : 1;
    progress.hintsByActivity[next.id] = [...new Set([...prior, level])].sort();
    const hint = Array.isArray(next.hints) ? next.hints[level - 1] : '';
    return { ...event, kind: 'hint', outcome: { ...event.outcome, activityId: next.id, hint, level, message: hint } };
  }
  if (command.action !== 'submit-stage') fail('INVALID_ACTION', 'الإجراء غير معروف.');
  if (!plain(command.payload)) fail('INVALID_PAYLOAD', 'أكمل مدخلات النشاط أولًا.');
  const result = evaluateActivity(next.id, command.payload, { viewedIds });
  if (!result.valid) fail('INVALID_PAYLOAD', result.message || 'أكمل مدخلات النشاط أولًا.');
  event.outcome = { ...result, ok: result.correct, accepted: result.correct, activityId: next.id, seq: progress.seq + 1 };
  if (result.correct) {
    progress.accepted.push({ activityId: next.id, payload: sanitizePayload(next.id, command.payload) });
    progress.completedActivityIds.push(next.id);
    event.complete = progress.completedActivityIds.length === 32;
  } else {
    event.wrongDelta = 1;
    progress.wrongSubmissions += 1;
  }
  return { ...event, kind: 'submit' };
}
