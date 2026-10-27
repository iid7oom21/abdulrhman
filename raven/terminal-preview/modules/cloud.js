import { CLOUD_CONFIG } from './runtime-config.js?v=0e63bd470374096b';
import { REVISION } from './expansion-data.js?v=0e63bd470374096b';
import { el } from './core.js?v=0e63bd470374096b';

export class CloudError extends Error {
  constructor(message, code = 'UNAVAILABLE', status = 0) { super(message); this.code = code; this.status = status; }
}
const validSession = value => value && typeof value.access_token === 'string' && typeof value.refresh_token === 'string'
  && typeof value.user?.id === 'string' && Number.isFinite(value.expires_at);
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const makeRequestId = () => crypto.randomUUID();
const stableJSON = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

export function createCloud(services, config = CLOUD_CONFIG) {
  let base = '';
  try {
    const parsed = new URL(config.supabaseUrl);
    if (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) base = parsed.href.replace(/\/$/, '');
  } catch { /* Local play needs no hosted service. */ }
  const configured = Boolean(base && typeof config.publishableKey === 'string' && config.publishableKey.trim());
  const listeners = new Set();
  const snapshots = new Map();
  let session = services.store.get('cloud:session', null);
  if (!validSession(session)) session = null;
  let refreshPromise = null;
  let destroyed = false;
  let authEpoch = 0;
  let queue = Promise.resolve();
  let saveQueue = Promise.resolve();
  let syncTimer;
  let syncEnabled = false;
  let saveRevision = 0;
  let applyingSave = false;
  let status = configured ? 'سجّل الدخول للحفظ السحابي والمنافسة.' : 'الحفظ المحلي يعمل. Google والحفظ السحابي والصدارة بانتظار إعداد الخدمة.';
  let conflict = null;
  const announce = message => { if (destroyed) return; if (message) status = message; for (const listener of listeners) listener(); };
  const requireConfig = () => { if (destroyed) throw new CloudError('أُغلقت الجلسة المحلية.', 'DESTROYED'); if (!configured) throw new CloudError('الخدمة السحابية غير مهيأة؛ يمكنك متابعة اللعب محليًا.', 'NOT_CONFIGURED'); };
  const assertEpoch = epoch => { if (destroyed || authEpoch !== epoch) throw new CloudError('تغير الحساب أو انتهت الجلسة؛ أعد المحاولة.', 'ACCOUNT_CHANGED', 401); };
  const rememberSession = next => {
    if (session?.user?.id !== next?.user?.id) {
      authEpoch++; syncEnabled = false; clearTimeout(syncTimer); snapshots.clear(); saveRevision = 0; conflict = null;
    }
    session = next;
    services.store.set('cloud:session', next);
    announce(next ? 'تم تسجيل الدخول. اختر استئناف حفظك أو حفظ تقدمك الحالي.' : 'تم تسجيل الخروج؛ الحفظ المحلي باقٍ.');
  };
  async function authRequest(path, payload, token = '') {
    const response = await fetch(`${base}/auth/v1/${path}`, { method: 'POST', headers: {
      apikey: config.publishableKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, body: JSON.stringify(payload) });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new CloudError('تعذر تسجيل الدخول. تحقق من إعداد Google أو حاول مجددًا.', 'AUTH_ERROR', response.status);
    return data;
  }
  const normalizeAuth = data => ({ access_token: data.access_token, refresh_token: data.refresh_token,
    expires_at: Number(data.expires_at) || Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600), user: { id: data.user.id, email: data.user.email || '' } });
  async function token() {
    requireConfig();
    if (!session) throw new CloudError('سجّل الدخول أولًا.', 'AUTH_REQUIRED', 401);
    if (session.expires_at > Date.now() / 1000 + 60) return session.access_token;
    if (!refreshPromise) {
      const epoch = authEpoch;
      const pending = authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
        .then(data => { assertEpoch(epoch); rememberSession(normalizeAuth(data)); return session.access_token; })
        .catch(error => { if (authEpoch === epoch && (error.status === 400 || error.status === 401)) rememberSession(null); throw error; })
        .finally(() => { if (refreshPromise === pending) refreshPromise = null; });
      refreshPromise = pending;
    }
    return refreshPromise;
  }
  async function api(action, payload = {}, anonymous = false) {
    requireConfig();
    const epoch = authEpoch;
    const bearer = anonymous ? '' : await token();
    if (!anonymous) assertEpoch(epoch);
    let response;
    try {
      response = await fetch(`${base}/functions/v1/${config.functionName || 'raven-api'}`, {
        method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
        body: JSON.stringify({ ...payload, action, revision: REVISION }),
      });
    } catch { throw new CloudError('انقطع الاتصال. احتُفظ بتقدمك المحلي؛ أعد المحاولة عند الاتصال.', 'NETWORK'); }
    let data;
    try { data = await response.json(); } catch {
      if (response.ok) throw new CloudError('وصل رد غير مكتمل؛ أعد المحاولة لاستعادة نتيجة الطلب نفسه.', 'NETWORK');
      data = null;
    }
    if (!anonymous) assertEpoch(epoch);
    if (!response.ok) throw new CloudError(data?.message || 'تعذرت العملية السحابية.', data?.code || 'SERVER_ERROR', response.status);
    if (data?.progress?.runId && (data.progress.seq >= (snapshots.get(data.progress.runId)?.progress?.seq ?? -1))) snapshots.set(data.progress.runId, data);
    return data;
  }
  function runAction(action, runId, payload = {}, requestId = makeRequestId(), expectedSeq = 0) {
    const epoch = authEpoch;
    const uid = session?.user?.id;
    const key = `cloud:pending-events:${uid}`;
    const fingerprint = stableJSON({ action, runId, payload, expectedSeq });
    const readPending = () => {
      const saved = services.store.get(key, []);
      return Array.isArray(saved) ? saved.filter(item => item && typeof item.fingerprint === 'string' && typeof item.requestId === 'string' && Number.isSafeInteger(item.expectedSeq)).slice(-30) : [];
    };
    const execute = async () => {
      assertEpoch(epoch);
      const pending = readPending();
      const event = pending.find(item => item.fingerprint === fingerprint) || {
        fingerprint, runId, action, requestId, expectedSeq: Math.max(expectedSeq, snapshots.get(runId)?.progress?.seq || 0), createdAt: Date.now(),
      };
      if (uid && !pending.includes(event)) services.store.set(key, [...pending, event].slice(-30));
      const clear = () => { if (uid) services.store.set(key, readPending().filter(item => item.fingerprint !== fingerprint)); };
      try {
        const result = await api(action, { ...payload, runId, requestId: event.requestId, expectedSeq: event.expectedSeq });
        if (!result?.progress || !Number.isSafeInteger(result.progress.seq)) throw new CloudError('وصل رد غير مكتمل؛ أعد المحاولة لاستعادة نتيجة الطلب نفسه.', 'NETWORK');
        clear(); return result;
      } catch (error) {
        // A lost response may hide an already committed event. Retrying must reuse its UUID.
        if (!['NETWORK', 'ACCOUNT_CHANGED'].includes(error.code) && !(error.status >= 500)) clear();
        throw error;
      }
    };
    const result = queue.then(execute, execute);
    queue = result.catch(() => {});
    return result;
  }
  async function signIn() {
    requireConfig();
    if (!globalThis.crypto?.subtle) throw new CloudError('يحتاج تسجيل الدخول اتصال HTTPS آمنًا.', 'SECURE_CONTEXT');
    const epoch = authEpoch;
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
    assertEpoch(epoch);
    const redirect = new URL(services.routeURL(config.redirectPath || 'case-017/'));
    redirect.search = ''; redirect.hash = '';
    try { sessionStorage.setItem('raven:oauth-pkce', JSON.stringify({ verifier, redirect: redirect.href, createdAt: Date.now() })); }
    catch { throw new CloudError('اسمح بحفظ جلسة المتصفح لإتمام تسجيل الدخول.', 'STORAGE_UNAVAILABLE'); }
    const authorize = new URL(`${base}/auth/v1/authorize`);
    authorize.searchParams.set('provider', 'google');
    authorize.searchParams.set('redirect_to', redirect.href);
    authorize.searchParams.set('code_challenge', challenge);
    authorize.searchParams.set('code_challenge_method', 's256');
    authorize.searchParams.set('scopes', 'openid email profile');
    location.assign(authorize.href);
  }
  async function finishAuth() {
    if (!configured) return;
    const address = new URL(location.href);
    if (address.searchParams.has('error')) {
      for (const key of ['error', 'error_code', 'error_description']) address.searchParams.delete(key);
      history.replaceState(history.state, '', address.href);
      announce('لم يكتمل تسجيل الدخول. يمكنك المحاولة مجددًا أو متابعة اللعب كضيف.');
      return;
    }
    const code = address.searchParams.get('code');
    if (!code) return;
    let verifier;
    try { verifier = JSON.parse(sessionStorage.getItem('raven:oauth-pkce') || 'null'); sessionStorage.removeItem('raven:oauth-pkce'); } catch { /* invalid state */ }
    address.searchParams.delete('code'); history.replaceState(history.state, '', address.href);
    const expected = verifier?.redirect ? new URL(verifier.redirect) : null;
    if (typeof verifier?.verifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier.verifier) || !Number.isFinite(verifier.createdAt) || verifier.createdAt > Date.now() + 60000 || !expected || expected.origin !== location.origin || expected.pathname !== location.pathname || Date.now() - verifier.createdAt > 10 * 60 * 1000) {
      throw new CloudError('انتهى طلب الدخول أو فُتح في متصفح آخر. ابدأ تسجيل الدخول من هذه الصفحة.', 'INVALID_CALLBACK');
    }
    const epoch = authEpoch;
    const data = await authRequest('token?grant_type=pkce', { auth_code: code, code_verifier: verifier.verifier });
    assertEpoch(epoch); rememberSession(normalizeAuth(data));
  }
  async function signOut() {
    const old = session;
    authEpoch++; refreshPromise = null;
    const current = services.caseStore.get();
    if (current.progress?.mode === 'ranked') {
      if (old) services.store.set(`cloud:ranked:${old.user.id}`, { runId: current.progress.runId });
      const backup = services.store.get('cloud:practice-backup', null);
      if (backup && backup.progress?.mode !== 'ranked') services.caseStore.update(() => backup);
      else services.caseStore.reset();
    }
    syncEnabled = false; clearTimeout(syncTimer); snapshots.clear(); saveRevision = 0; conflict = null;
    rememberSession(null);
    if (current.progress?.mode === 'ranked') announce('تم تسجيل الخروج والعودة للممارسة. محاولتك التنافسية محفوظة على الخادم ووقتها يستمر.');
    const epoch = authEpoch;
    if (old && configured) { try { await authRequest('logout', {}, old.access_token); } catch { if (authEpoch === epoch) announce('خرجت من هذا الجهاز؛ تعذر إلغاء الجلسة البعيدة أثناء انقطاع الاتصال.'); } }
  }
  async function loadSave() {
    const saved = await api('load-save');
    return { ...(saved || { revision: 0, payload: null }), accountId: session?.user?.id };
  }
  function saveSave(payload = services.caseStore.get(), expectedRevision) {
    const copy = structuredClone(payload);
    const accountId = session?.user?.id;
    const epoch = authEpoch;
    const execute = () => {
      assertEpoch(epoch);
      if (!accountId || accountId !== session?.user?.id) throw new CloudError('تغير الحساب؛ احفظ مجددًا بالحساب الحالي.', 'ACCOUNT_CHANGED', 401);
      return commitSave(copy, expectedRevision ?? saveRevision);
    };
    const result = saveQueue.then(execute, execute);
    saveQueue = result.catch(() => {});
    return result;
  }
  async function commitSave(payload, expectedRevision) {
    if (payload.progress?.mode === 'ranked') throw new CloudError('المحاولة التنافسية تُحفظ مع كل إجراء على الخادم.', 'RANKED_SAVE');
    const uid = session?.user?.id;
    const epoch = authEpoch;
    if (uid) services.store.set(`cloud:pending:${uid}`, { payload, expectedRevision });
    try {
      const saved = await api('save-save', { payload, expectedRevision });
      saveRevision = saved.revision; conflict = null;
      if (uid) services.store.set(`cloud:pending:${uid}`, null);
      announce('حُفظ تقدمك سحابيًا.');
      return saved;
    } catch (error) {
      assertEpoch(epoch);
      if (error.status === 409) {
        syncEnabled = false;
        const remote = await loadSave().catch(() => null);
        assertEpoch(epoch);
        conflict = { local: structuredClone(payload), remote };
        services.store.set(`cloud:conflict:${uid}`, conflict);
        announce('هناك نسختان مختلفتان. احتُفظ بهما؛ اختر النسخة التي تريد استكمالها.');
      } else announce(error.message);
      throw error;
    }
  }
  function acceptRemote(saved) {
    if (!session || saved?.accountId !== session.user.id) throw new CloudError('هذا الحفظ لا يخص الحساب الحالي؛ حمّله مجددًا.', 'ACCOUNT_CHANGED');
    if (!saved?.payload) throw new CloudError('لا يوجد حفظ سحابي بعد.', 'NO_SAVE');
    services.store.set('cloud:local-backup', services.caseStore.get());
    applyingSave = true;
    try { services.caseStore.update(() => saved.payload); } finally { applyingSave = false; }
    saveRevision = saved.revision; conflict = null; syncEnabled = true;
    announce('استُعيد الحفظ السحابي. بقيت نسخة من تقدم الجهاز قبل الاستعادة.');
  }
  async function resolveConflict(useRemote) {
    if (!conflict) return;
    const pending = conflict;
    if (useRemote) acceptRemote(pending.remote);
    else {
      await saveSave(pending.local, pending.remote?.revision || 0);
      syncEnabled = true;
    }
  }
  function scheduleSync() {
    if (destroyed || applyingSave || !syncEnabled || !session || services.caseStore.get().progress?.mode === 'ranked') return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => saveSave().catch(() => {}), 1500);
  }
  const unsubscribe = services.caseStore.subscribe(scheduleSync);
  const online = () => { if (syncEnabled && session) scheduleSync(); };
  window.addEventListener('online', online);
  const ready = finishAuth().catch(error => { announce(error.message); });

  return {
    configured, ready,
    getSession: () => session ? { user: { ...session.user }, expiresAt: session.expires_at } : null,
    getStatus: () => ({ message: status, conflict, syncEnabled }),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    signIn, signOut, loadSave, saveSave, acceptRemote, resolveConflict,
    async enableSync() { await saveSave(); syncEnabled = true; announce('الحفظ السحابي التلقائي مفعّل لهذا الحساب.'); },
    startRun: () => api('start-run'),
    getRun: runId => api('get-run', { runId }),
    submitStage: (runId, activityId, payload, requestId, expectedSeq) => runAction('submit-stage', runId, { activityId, payload }, requestId, expectedSeq),
    revealHint: (runId, activityId, level, requestId, expectedSeq) => runAction('reveal-hint', runId, { activityId, level }, requestId, expectedSeq),
    markViewed: (runId, evidenceId, requestId, expectedSeq) => runAction('mark-viewed', runId, { evidenceId }, requestId, expectedSeq),
    abandonRun: (runId, requestId, expectedSeq) => runAction('abandon-run', runId, {}, requestId, expectedSeq),
    publishRun: (runId, alias, published = true) => api('publish-run', { runId, alias, published }),
    listLeaderboard: () => api('leaderboard', {}, true),
    destroy() { destroyed = true; authEpoch++; refreshPromise = null; clearTimeout(syncTimer); unsubscribe(); listeners.clear(); window.removeEventListener('online', online); },
  };
}

export function mountCloudPanel(host, services) {
  const cloud = services.cloud;
  if (!cloud) return () => {};
  let disposed = false;
  let busy = false;
  let board = null;
  let errorMessage = '';
  let aliasValue = '';
  const details = el('details', { class: 'cloud-panel', 'data-cloud-panel': '' });
  details.append(el('summary', { text: 'الحساب والحفظ والصدارة' }));
  const content = el('div', { class: 'cloud-panel-body' });
  details.append(content); host.append(details);
  const message = el('p', { role: 'status', 'aria-live': 'polite', class: 'cloud-status' });
  const btn = (label, fn, attributes = {}) => el('button', { type: 'button', class: 'case-button', ...attributes, onClick: () => act(fn) }, label);
  async function act(fn) {
    if (busy) return;
    errorMessage = ''; busy = true; content.setAttribute('aria-busy', 'true');
    try { await fn(); } catch (error) { errorMessage = error.message; services.notify?.(error.message); message.textContent = error.message; }
    finally { busy = false; if (!disposed) { content.removeAttribute('aria-busy'); render(); } }
  }
  function applyRun(snapshot) {
    const current = services.caseStore.get();
    if (current.progress?.mode !== 'ranked') services.store.set('cloud:practice-backup', current);
    services.caseStore.update(s => { s.progress = snapshot.progress; s.viewedIds = snapshot.viewedIds || []; s.drafts = {}; });
  }
  function render() {
    if (disposed) return;
    const active = content.contains(document.activeElement) ? document.activeElement : null;
    const focusedLabel = active?.getAttribute('aria-label');
    const cursor = active?.selectionStart;
    content.replaceChildren();
    const info = cloud.getStatus();
    message.textContent = errorMessage || info.message;
    content.append(message);
    if (!cloud.configured) {
      content.append(el('p', { class: 'cloud-small', text: 'يمكنك إكمال الأنشطة وحفظها على هذا الجهاز. لم تُفعّل المنافسة السحابية بعد.' }));
      return;
    }
    const account = cloud.getSession();
    const controls = el('div', { class: 'cloud-actions' });
    if (!account) controls.append(btn('الدخول باستخدام Google', () => cloud.signIn(), { 'data-cloud-signin': '' }));
    else {
      const p = services.caseStore.get().progress;
      if (p?.mode !== 'ranked') controls.append(btn('حفظ تقدمي سحابيًا', () => cloud.enableSync()), btn('استئناف الحفظ السحابي', async () => cloud.acceptRemote(await cloud.loadSave())));
      controls.append(btn('تسجيل الخروج', () => cloud.signOut()));
      if (p?.mode === 'ranked' && p.runId && !p.completedAt) {
        controls.append(btn('تحديث المحاولة من الخادم', async () => applyRun(await cloud.getRun(p.runId))), btn('إنهاء المحاولة والعودة للممارسة', async () => {
          await cloud.abandonRun(p.runId, makeRequestId(), p.seq);
          const backup = services.store.get('cloud:practice-backup', null);
          if (backup) services.caseStore.update(() => backup); else services.caseStore.reset();
        }));
      } else {
        controls.append(btn('ابدأ أو استأنف محاولة تنافسية', async () => {
          const snapshot = await cloud.startRun(); applyRun(snapshot);
          services.notify?.('بدأ وقت المنافسة على الخادم؛ يستمر عند الخروج أو انقطاع الاتصال.');
        }));
      }
      if (p?.mode === 'ranked' && p.completedAt && p.runId) {
        const alias = el('input', { type: 'text', minlength: '3', maxlength: '24', autocomplete: 'nickname', 'aria-label': 'اسم العرض في الصدارة', placeholder: 'اسم عرض تختاره · 3–24 حرفًا' });
        alias.value = aliasValue;
        alias.addEventListener('input', () => { aliasValue = alias.value; });
        content.append(el('label', { class: 'cloud-alias' }, [el('span', { text: 'نشر النتيجة اختياري؛ لا يظهر بريدك.' }), alias]),
          btn('انشر أفضل نتيجتي', async () => { await cloud.publishRun(p.runId, alias.value); services.notify?.('حُفظ خيار نشر أفضل نتيجة موثقة.'); }),
          btn('إخفاء نتيجتي العامة', async () => { await cloud.publishRun(p.runId, alias.value, false); services.notify?.('أُخفيت النتيجة العامة.'); }));
      }
    }
    controls.append(btn('عرض الصدارة', async () => { board = await cloud.listLeaderboard(); })); content.append(controls);
    if (info.conflict) content.append(el('div', { class: 'cloud-conflict' }, [
      el('p', { text: 'حُفظت نسخة الجهاز ونسخة السحابة قبل الاختيار.' }),
      btn('استكمل نسخة السحابة', () => cloud.resolveConflict(true)), btn('احتفظ بنسخة الجهاز واحفظها سحابيًا', () => cloud.resolveConflict(false)),
    ]));
    if (board) {
      const entries = Array.isArray(board.entries) ? board.entries : [];
      const list = el('ol', { class: 'cloud-leaderboard' }, entries.map(entry => el('li', {}, [
        el('strong', { text: entry.alias }), el('span', { text: `${entry.hint_count} تلميح · ${entry.wrong_count} خطأ · ${Math.floor(entry.elapsed_ms / 60000)} دقيقة ${Math.floor(entry.elapsed_ms / 1000) % 60} ثانية` }),
      ])));
      content.append(el('h3', { text: 'الصدارة · هذا الإصدار' }), el('p', { class: 'cloud-small', text: 'أقل تلميحات، ثم أخطاء، ثم وقت. النتائج تُعتمد على الخادم.' }), entries.length ? list : el('p', { text: 'لا توجد نتائج منشورة لهذا الإصدار بعد.' }));
    }
    if (focusedLabel) {
      const replacement = [...content.querySelectorAll('[aria-label]')].find(node => node.getAttribute('aria-label') === focusedLabel);
      replacement?.focus();
      if (replacement?.setSelectionRange && typeof cursor === 'number') replacement.setSelectionRange(cursor, cursor);
    }
  }
  const signature = () => { const p = services.caseStore.get().progress || {}; return [p.mode, p.runId, p.seq, p.completedAt].join('|'); };
  let lastSignature = signature();
  const unsubscribe = cloud.subscribe(() => { if (!busy) render(); });
  const unsubscribeCase = services.caseStore.subscribe(() => { const next = signature(); if (next !== lastSignature) { lastSignature = next; if (details.open && !busy) render(); } });
  details.addEventListener('toggle', () => { if (details.open) render(); });
  cloud.ready.then(() => { if (!disposed) render(); }); render();
  return () => { disposed = true; unsubscribe(); unsubscribeCase(); details.remove(); };
}
