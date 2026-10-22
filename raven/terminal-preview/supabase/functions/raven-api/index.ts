import { REVISION } from '../../../modules/expansion-data.js';
import { CommandError, evaluateCommand, freshRunState, uuid } from '../_shared/run-commands.js';

const serviceUrl = Deno.env.get('SUPABASE_URL') || '';
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const origins = new Set((Deno.env.get('RAVEN_ALLOWED_ORIGINS') || 'https://iid7oom21.github.io,http://127.0.0.1:8786,http://localhost:8786').split(',').map(s => s.trim()));
const MAX_BYTES = 300_000;
type Json = Record<string, any>;

function headers(origin: string) {
  return { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS' };
}
function errorFromDatabase(data: Json, status: number) {
  const message = String(data?.message || 'Database request failed');
  if (message.includes('RAVEN_CONFLICT')) return new CommandError('CONFLICT', 'يوجد تحديث أحدث؛ أعد تحميل النسخة السحابية.', 409);
  if (message.includes('RAVEN_NOT_FOUND')) return new CommandError('NOT_FOUND', 'المحاولة غير موجودة.', 404);
  if (message.includes('RAVEN_CLOSED')) return new CommandError('RUN_CLOSED', 'هذه المحاولة مغلقة.', 409);
  if (message.includes('RAVEN_INVALID')) return new CommandError('INVALID_INPUT', 'البيانات لا تطابق شروط العملية.', 400);
  return new CommandError('DATABASE_UNAVAILABLE', 'تعذر إتمام العملية السحابية الآن.', status >= 500 ? 503 : 400);
}
async function rpc(name: string, payload: Json) {
  const response = await fetch(`${serviceUrl}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw errorFromDatabase(data, response.status);
  return data;
}
async function userId(request: Request) {
  const authorization = request.headers.get('Authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) throw new CommandError('AUTH_REQUIRED', 'سجّل الدخول أولًا.', 401);
  const response = await fetch(`${serviceUrl}/auth/v1/user`, { headers: { apikey: publicKey || secret, Authorization: authorization } });
  if (!response.ok) throw new CommandError('AUTH_REQUIRED', 'انتهت جلسة الدخول؛ سجّل الدخول مجددًا.', 401);
  const user = await response.json();
  if (!uuid(user.id)) throw new CommandError('AUTH_REQUIRED', 'تعذر التحقق من الحساب.', 401);
  return user.id;
}

Deno.serve(async request => {
  const origin = request.headers.get('Origin') || '';
  if (origin && !origins.has(origin)) return new Response(JSON.stringify({ code: 'ORIGIN_DENIED' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  const cors = headers(origin || [...origins][0]);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response(JSON.stringify({ code: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: cors });
  try {
    if (!serviceUrl || !secret) throw new CommandError('NOT_CONFIGURED', 'الخدمة غير مهيأة.', 503);
    if (Number(request.headers.get('Content-Length') || 0) > MAX_BYTES) throw new CommandError('TOO_LARGE', 'حجم الطلب كبير.', 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw new CommandError('TOO_LARGE', 'حجم الطلب كبير.', 413);
    let body: Json;
    try { body = JSON.parse(raw); } catch { throw new CommandError('INVALID_JSON', 'الطلب غير صالح.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CommandError('INVALID_JSON', 'الطلب غير صالح.');
    if (body.revision !== undefined && body.revision !== REVISION) throw new CommandError('RULESET_MISMATCH', 'إصدار القضية غير متوافق.', 409);
    if (body.action === 'leaderboard') {
      const response = await fetch(`${serviceUrl}/rest/v1/raven_leaderboard?ruleset=eq.${REVISION}&order=rank.asc&limit=50`, {
        headers: { apikey: publicKey || secret, Authorization: `Bearer ${publicKey || secret}` },
      });
      if (!response.ok) throw new CommandError('LEADERBOARD_UNAVAILABLE', 'لوحة الصدارة غير متاحة الآن.', 503);
      return new Response(JSON.stringify({ entries: await response.json(), revision: REVISION }), { headers: cors });
    }
    const uid = await userId(request);
    let result: unknown;
    switch (body.action) {
      case 'start-run': result = await rpc('raven_start_run', { p_user_id: uid, p_ruleset: REVISION, p_state: freshRunState() }); break;
      case 'load-save': result = await rpc('raven_load_case', { p_user_id: uid, p_ruleset: REVISION }); break;
      case 'save-save':
        if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) throw new CommandError('INVALID_REVISION', 'إصدار الحفظ غير صالح.');
        result = await rpc('raven_save_case', { p_user_id: uid, p_ruleset: REVISION, p_expected_revision: body.expectedRevision, p_payload: body.payload }); break;
      case 'get-run':
        if (!uuid(body.runId)) throw new CommandError('INVALID_RUN', 'معرّف المحاولة غير صالح.');
        result = await rpc('raven_get_run', { p_user_id: uid, p_run_id: body.runId }); break;
      case 'publish-run':
        if (!uuid(body.runId) || typeof body.alias !== 'string' || body.alias.trim().length < 3 || body.alias.trim().length > 24 || /[<>\p{Cc}]/u.test(body.alias)) throw new CommandError('INVALID_ALIAS', 'اكتب اسم عرض من 3 إلى 24 حرفًا.');
        result = await rpc('raven_publish_run', { p_user_id: uid, p_run_id: body.runId, p_alias: body.alias.trim(), p_public: body.published !== false }); break;
      case 'mark-viewed': case 'submit-stage': case 'reveal-hint': case 'abandon-run': {
        if (!uuid(body.runId) || !uuid(body.requestId)) throw new CommandError('INVALID_REQUEST', 'معرّف المحاولة أو الطلب غير صالح.');
        // Idempotency precedes stale checks, validation, and completed status.
        const cached = await rpc('raven_event_result', { p_user_id: uid, p_run_id: body.runId, p_request_id: body.requestId });
        if (cached) { result = cached; break; }
        const snapshot = await rpc('raven_get_run', { p_user_id: uid, p_run_id: body.runId });
        let event;
        try { event = evaluateCommand(snapshot, body); }
        catch (error) {
          // A concurrent copy can commit between the first cache lookup and snapshot read.
          if (error instanceof CommandError && ['STALE_SEQUENCE', 'RUN_CLOSED'].includes(error.code)) {
            const committed = await rpc('raven_event_result', { p_user_id: uid, p_run_id: body.runId, p_request_id: body.requestId });
            if (committed) { result = committed; break; }
          }
          throw error;
        }
        result = await rpc('raven_apply_event', {
          p_user_id: uid, p_run_id: body.runId, p_request_id: body.requestId, p_expected_seq: body.expectedSeq,
          p_kind: event.kind, p_state: event.state, p_outcome: event.outcome,
          p_hint_delta: event.hintDelta, p_wrong_delta: event.wrongDelta, p_complete: event.complete,
        });
        break;
      }
      default: throw new CommandError('INVALID_ACTION', 'الإجراء غير معروف.');
    }
    return new Response(JSON.stringify(result), { headers: cors });
  } catch (error) {
    const known = error instanceof CommandError;
    return new Response(JSON.stringify({ code: known ? error.code : 'SERVICE_UNAVAILABLE', message: known ? error.message : 'تعذرت الخدمة مؤقتًا؛ تقدمك المحلي محفوظ.' }), {
      status: known ? error.status : 503, headers: cors,
    });
  }
});
