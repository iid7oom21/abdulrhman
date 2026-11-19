import { createHash } from 'node:crypto';
import { gateAllows } from './case-engine.js';
import { buildInterrogationContext, validateInterrogationPolicy, InterrogationContextError } from './interrogation-context.js';

/*
 * Local adapter between the written-case engine and character dialogue.
 * NOT wired into server.js or any HTTP route; production behaviour is unchanged.
 *
 * Contract (see docs/CASE-DIALOGUE-ADAPTER.md):
 * - State comes only from readCaseSession(sessionId), a server-side reader of the
 *   case store. Browser JSON is never state, knowledge or permission.
 * - The engine state plus the private author policy decide which sources the
 *   character may use (own knowledge after its disclosure gate, plus sources the
 *   player delivered to that character). The full session and author truth never
 *   reach the provider.
 * - Knowledge is not disclosure: withheld own knowledge is reported to the
 *   provider as a count only, so a character may decline but must not deny.
 * - A missing policy or actor entry is an explicit, visible "unavailable" reason;
 *   it is never presented as the character not knowing their own life.
 * - The provider may only select source IDs and an action. It cannot write text,
 *   grant material, change state or file anything. Provider failure leaves the
 *   case untouched and returns a closed error code; an unknown outcome is never
 *   retried under the same request ID.
 */

export const ADAPTER_SCOPE = 'local-only-not-wired';
const ACTIONS = ['quote_materials', 'clarify', 'unavailable'];
const PROVIDER_ERRORS = ['provider_unavailable', 'provider_rejected', 'provider_invalid_output', 'provider_busy'];
const REQUEST_KEYS = ['sessionId', 'requestId', 'actorId', 'message', 'locale', 'revision', 'contentVersion', 'presentedMaterialIds'];
const SESSION_ID = /^[a-f0-9]{64}$/;
const REQUEST_ID = /^[A-Za-z0-9_-]{1,100}$/;
const plain = value => !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class CaseDialogueError extends Error {
  constructor(code, outcomeUnknown = false) { super(code); this.code = code; this.outcomeUnknown = outcomeUnknown; }
}

export function createCaseDialogueAdapter({ pack, policy = null, readCaseSession, selectSources,
  timeoutMs = 20000, maxRequestsPerSession = 100 } = {}) {
  if (typeof readCaseSession !== 'function' || typeof selectSources !== 'function') throw new CaseDialogueError('adapter_configuration_required');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new CaseDialogueError('adapter_configuration_required');
  // A present policy must be valid for this exact pack; a missing one stays explicitly missing.
  let trustedPolicy = null;
  if (policy !== null) {
    try { trustedPolicy = validateInterrogationPolicy(pack, policy); }
    catch (error) { throw new CaseDialogueError(error instanceof InterrogationContextError ? error.code : 'invalid_interrogation_policy'); }
  }
  const ledger = new Map(); // sessionId -> Map(requestId -> {fingerprint, promise, settled})
  const inFlight = new Set(); // sessionId:actorId

  const unavailable = (base, reason) => ({ ...base, status: 'unavailable', reason, quotes: [] });
  const failed = (base, code, outcomeUnknown = false) => ({ ...base, status: 'error', error: code, ...(outcomeUnknown ? { outcomeUnknown: true } : {}) });

  async function run(request) {
    const base = { requestId: request.requestId, actorId: request.actorId, contentVersion: pack.contentVersion };
    let session;
    try { session = readCaseSession(request.sessionId); } catch { return failed(base, 'case_unavailable'); }
    if (!session || !plain(session) || !plain(session.state)) return failed(base, 'session_unavailable');
    // Work on a private copy: nothing in this adapter can write the case store.
    const state = clone(session.state);
    if (request.contentVersion !== pack.contentVersion || state.contentVersion !== pack.contentVersion || state.caseId !== pack.caseId) {
      return failed(base, 'content_version_mismatch');
    }
    // Answer only about the state the player is looking at.
    if (request.revision !== state.revision) return failed({ ...base, revision: state.revision }, 'revision_conflict');
    const stamped = { ...base, revision: state.revision };
    if (!trustedPolicy) return unavailable(stamped, 'author_policy_missing');
    const actor = trustedPolicy.actors[request.actorId];
    if (!actor) return unavailable(stamped, 'actor_policy_missing');

    let context;
    try {
      context = buildInterrogationContext(pack, state, trustedPolicy, request.actorId, {
        sessionId: request.sessionId, locale: request.locale, message: request.message,
        presentedMaterialIds: request.presentedMaterialIds,
      });
    } catch (error) {
      return failed(stamped, error instanceof InterrogationContextError ? error.code : 'invalid_context_request');
    }
    const withheldCount = actor.knowledge.filter(source => !gateAllows(source.requires, state)).length;
    if (!context.sourceIds.length) {
      // Visible system reasons, never a character's denial. No paid call without a source.
      return unavailable(stamped, actor.knowledge.length === 0 ? 'actor_has_no_authored_knowledge' : 'no_disclosable_sources');
    }
    const origin = new Map([...context.ownSources.map(item => [item.id, 'own']), ...context.receivedSources.map(item => [item.id, 'received'])]);
    const sources = [...context.ownSources, ...context.receivedSources]
      .filter((item, index, all) => all.findIndex(other => other.id === item.id) === index)
      .map(item => ({ ...item, origin: origin.get(item.id) }));
    // Provider input: no session ID, cache key, flags, scene, notes, captures or receipts.
    const providerInput = {
      schemaVersion: 1, kind: 'case-dialogue-selection', locale: context.locale,
      actor: clone(context.actor), question: { text: context.input.text, untrusted: true },
      presentedMaterialIds: [...context.input.presentedMaterialIds], sources,
      disclosure: { withheldCount, rule: 'withheld-knowledge-is-not-ignorance' },
    };
    const controller = new AbortController();
    let timer, selection;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new CaseDialogueError('provider_unavailable', true)); }, timeoutMs);
      });
      selection = await Promise.race([Promise.resolve().then(() => selectSources(clone(providerInput), { signal: controller.signal })), timeout]);
    } catch (error) {
      const code = PROVIDER_ERRORS.includes(error?.code) ? error.code : 'provider_unavailable';
      return failed(stamped, code, error?.outcomeUnknown === true || !PROVIDER_ERRORS.includes(error?.code));
    } finally { clearTimeout(timer); }
    if (!plain(selection) || Object.keys(selection).sort().join() !== 'action,materialIds' || !ACTIONS.includes(selection.action) ||
        !Array.isArray(selection.materialIds) || selection.materialIds.length > 8 ||
        new Set(selection.materialIds).size !== selection.materialIds.length ||
        selection.materialIds.some(id => !context.sourceIds.includes(id))) {
      return failed(stamped, 'provider_invalid_output');
    }
    if (selection.action === 'unavailable' || (selection.action === 'quote_materials' && !selection.materialIds.length)) {
      return unavailable(stamped, 'provider_declined');
    }
    // Server-side composition from engine-owned sources only, with attribution.
    const quotes = sources.filter(item => selection.materialIds.includes(item.id)).map(item => ({
      materialId: item.id, title: item.title, body: item.body, source: item.source, type: item.type,
      origin: item.origin, epistemicStatus: 'attributed-source',
    }));
    return { ...stamped, status: selection.action === 'clarify' ? 'clarify' : 'answered', quotes };
  }

  return {
    scope: ADAPTER_SCOPE,
    async ask(input) {
      if (!plain(input) || Object.keys(input).some(key => !REQUEST_KEYS.includes(key)) ||
          typeof input.sessionId !== 'string' || !SESSION_ID.test(input.sessionId) ||
          typeof input.requestId !== 'string' || !REQUEST_ID.test(input.requestId) ||
          typeof input.actorId !== 'string' || typeof input.message !== 'string' || !input.message.trim() ||
          !Number.isSafeInteger(input.revision) || input.revision < 0 || typeof input.contentVersion !== 'string') {
        return { status: 'error', error: 'invalid_request' };
      }
      const request = { presentedMaterialIds: [], locale: pack.defaultLocale, ...clone(input) };
      const fingerprint = hash({ actorId: request.actorId, message: request.message, locale: request.locale,
        revision: request.revision, contentVersion: request.contentVersion, presented: request.presentedMaterialIds });
      const requests = ledger.get(request.sessionId) || new Map();
      const previous = requests.get(request.requestId);
      if (previous) {
        if (previous.fingerprint !== fingerprint) return { status: 'error', error: 'request_id_conflict', requestId: request.requestId };
        // Same request: never a second provider call, including after an unknown outcome.
        return { ...clone(await previous.promise), replayed: true };
      }
      if (requests.size >= maxRequestsPerSession) return { status: 'error', error: 'requests_limit', requestId: request.requestId };
      const busyKey = request.sessionId + ':' + request.actorId;
      if (inFlight.has(busyKey)) return { status: 'error', error: 'character_busy', requestId: request.requestId };
      inFlight.add(busyKey);
      const promise = run(request).finally(() => inFlight.delete(busyKey));
      requests.set(request.requestId, { fingerprint, promise });
      ledger.set(request.sessionId, requests);
      return { ...clone(await promise), replayed: false };
    },
  };
}
