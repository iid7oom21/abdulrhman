import { caseFingerprint, gateAllows, validateCasePack, validateStoredCaseState } from './case-engine.js';

// Pure, server-side projection. Callers must supply engine-owned state and a private,
// author-reviewed policy; JSON from a browser is never an authoritative state/policy.
// This module performs no model call, produces no dialogue and changes no game state.
const own = (value, key) => Object.hasOwn(value, key);
const plain = value => !!value && Object.getPrototypeOf(value) === Object.prototype;
const keys = (value, allowed) => plain(value) && Object.keys(value).every(key => allowed.includes(key));
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(value) && !['constructor','prototype','__proto__'].includes(value);
const primitive = value => value === null || ['boolean','string'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value));
const localized = (value, pack, max) => plain(value) && own(value, pack.defaultLocale) && Object.entries(value).every(([locale, text]) => pack.locales.includes(locale) && typeof text === 'string' && text.trim().length > 0 && text.length <= max);
const clone = value => structuredClone(value);
export const INTERROGATION_LIMITS = Object.freeze({ messageChars:8000, sourceCount:40, contextChars:32000 });
export class InterrogationContextError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const requireValue = (condition, code) => { if (!condition) throw new InterrogationContextError(code); };

function validatePack(pack) {
  try { validateCasePack(pack); } catch { throw new InterrogationContextError('invalid_case_pack'); }
}

function validateGate(gate, pack, budget, depth = 0) {
  requireValue(plain(gate) && depth < 12 && --budget.remaining >= 0, 'invalid_interrogation_policy');
  if (keys(gate, ['all']) && Array.isArray(gate.all)) {
    requireValue(gate.all.length <= 64, 'invalid_interrogation_policy');
    gate.all.forEach(item => validateGate(item, pack, budget, depth + 1));
  } else if (keys(gate, ['any']) && Array.isArray(gate.any)) {
    requireValue(gate.any.length <= 64, 'invalid_interrogation_policy');
    gate.any.forEach(item => validateGate(item, pack, budget, depth + 1));
  } else if (keys(gate, ['not']) && own(gate, 'not')) validateGate(gate.not, pack, budget, depth + 1);
  else if (keys(gate, ['flag','equals'])) {
    requireValue(identifier(gate.flag) && own(pack.initialFlags, gate.flag) && own(gate, 'equals') && primitive(gate.equals) && (typeof gate.equals !== 'string' || gate.equals.length <= 2000), 'invalid_interrogation_policy');
  } else if (keys(gate, ['hasMaterial'])) {
    requireValue(identifier(gate.hasMaterial) && own(pack.materials, gate.hasMaterial), 'invalid_interrogation_policy');
  } else requireValue(false, 'invalid_interrogation_policy');
}

function validatePolicy(pack, policy) {
  requireValue(keys(policy, ['schemaVersion','caseId','contentVersion','policyVersion','actors']) && policy.schemaVersion === 1 && identifier(policy.policyVersion), 'invalid_interrogation_policy');
  requireValue(policy.caseId === pack.caseId && policy.contentVersion === pack.contentVersion, 'content_version_mismatch');
  requireValue(plain(policy.actors) && Object.keys(policy.actors).length > 0 && Object.keys(policy.actors).length <= 32, 'invalid_interrogation_policy');
  const budget = { remaining:256 };
  for (const [id, actor] of Object.entries(policy.actors)) {
    requireValue(identifier(id) && keys(actor, ['name','voiceStyle','knowledge','receivedRequires']) && localized(actor.name, pack, 120) && localized(actor.voiceStyle, pack, 1200), 'invalid_interrogation_policy');
    requireValue(Array.isArray(actor.knowledge) && actor.knowledge.length <= INTERROGATION_LIMITS.sourceCount && new Set(actor.knowledge.map(item => item?.materialId)).size === actor.knowledge.length, 'invalid_interrogation_policy');
    for (const source of actor.knowledge) {
      requireValue(keys(source, ['materialId','requires']) && identifier(source.materialId) && own(pack.materials, source.materialId), 'invalid_interrogation_policy');
      if (source.requires !== undefined) validateGate(source.requires, pack, budget);
    }
    if (actor.receivedRequires !== undefined) validateGate(actor.receivedRequires, pack, budget);
  }
}

export function validateInterrogationPolicy(pack, policy) {
  validatePack(pack);
  validatePolicy(pack, policy);
  return clone(policy);
}

/**
 * knowledge lists sources the actor knows under trusted author policy. `requires`
 * gates disclosure, not whether the actor remembers their own life. Undisclosable
 * source text never reaches the output. receivedRequires independently gates use
 * of player-delivered sources (for example, current permission to send to AI).
 * No caller-provided fact, transcript, note or requested source grants knowledge.
 */
export function buildInterrogationContext(pack, state, policy, actorId, options = {}) {
  validatePack(pack);
  validatePolicy(pack, policy);
  requireValue(identifier(actorId) && own(policy.actors, actorId), 'unknown_character');
  try { validateStoredCaseState(state); } catch { throw new InterrogationContextError('invalid_case_state'); }
  requireValue(state.caseId === pack.caseId && state.contentVersion === pack.contentVersion, 'content_version_mismatch');
  requireValue(own(pack.scenes, state.sceneId) && state.materialIds.every(id => own(pack.materials, id)), 'invalid_case_state');
  requireValue(keys(options, ['sessionId','locale','message','presentedMaterialIds']) && identifier(options.sessionId), 'invalid_context_request');
  const locale = options.locale ?? pack.defaultLocale;
  const message = options.message ?? '';
  const presented = options.presentedMaterialIds ?? [];
  requireValue(pack.locales.includes(locale) && typeof message === 'string' && message.length <= INTERROGATION_LIMITS.messageChars, 'invalid_context_request');
  requireValue(Array.isArray(presented) && presented.length <= INTERROGATION_LIMITS.sourceCount && presented.every(identifier) && new Set(presented).size === presented.length, 'invalid_context_request');
  const actor = policy.actors[actorId];
  const ownIds = actor.knowledge.filter(source => gateAllows(source.requires, state)).map(source => source.materialId);
  const receivedIds = gateAllows(actor.receivedRequires, state)
    ? [...new Set(state.shares.filter(share => share.recipient === actorId && state.materialIds.includes(share.materialId)).map(share => share.materialId))]
    : [];
  // A known personal source is not a material the player is allowed to present.
  requireValue(presented.every(id => receivedIds.includes(id)), 'material_unavailable');
  const sourceIds = [...new Set([...ownIds, ...receivedIds])];
  requireValue(sourceIds.length <= INTERROGATION_LIMITS.sourceCount, 'context_too_large');
  const localize = value => value[locale] ?? value[pack.defaultLocale];
  const source = id => {
    const material = pack.materials[id];
    return { id, title:localize(material.title), body:localize(material.body), type:material.type,
      source:localize(material.source), epistemicStatus:'attributed-source', untrusted:true };
  };
  const context = {
    schemaVersion:1, kind:'interrogation-context', caseId:pack.caseId, contentVersion:pack.contentVersion,
    policyVersion:policy.policyVersion, revision:state.revision, locale,
    actor:{id:actorId, name:localize(actor.name), voiceStyle:localize(actor.voiceStyle)},
    input:{text:message, untrusted:true, presentedMaterialIds:[...presented]},
    ownSources:ownIds.map(source), receivedSources:receivedIds.map(source), sourceIds,
  };
  // Never silently discard a source: it might be the correction to another source.
  requireValue(JSON.stringify(context).length <= INTERROGATION_LIMITS.contextChars, 'context_too_large');
  // Private cache metadata only. Do not serialize a raw session ID into model input.
  // Fingerprints also invalidate a mistakenly reused version after policy/source edits.
  const cacheKey = caseFingerprint({caseId:pack.caseId, contentVersion:pack.contentVersion,
    packFingerprint:caseFingerprint(pack), policyVersion:policy.policyVersion, policyFingerprint:caseFingerprint(policy),
    actorId, sessionId:options.sessionId, revision:state.revision, context});
  return { ...context, cacheKey };
}

/** Procedural navigation, not deduction: accepts ONLY an engine-projected view. */
export function buildInvestigationHint(projected, options = {}) {
  requireValue(plain(projected) && identifier(projected.caseId) && identifier(projected.contentVersion) && Number.isSafeInteger(projected.revision) && projected.revision >= 0, 'invalid_projection');
  requireValue(keys(options, ['limit']) && Number.isInteger(options.limit ?? 3) && (options.limit ?? 3) > 0 && (options.limit ?? 3) <= 10, 'invalid_hint_request');
  requireValue(Array.isArray(projected.actions) && projected.actions.length <= 201 && projected.actions.every(item => plain(item) && identifier(item.id)) && new Set(projected.actions.map(item => item.id)).size === projected.actions.length, 'invalid_projection');
  requireValue(Array.isArray(projected.materials) && projected.materials.length <= 2000 && projected.materials.every(item => plain(item) && identifier(item.id)) && new Set(projected.materials.map(item => item.id)).size === projected.materials.length, 'invalid_projection');
  const limit = options.limit ?? 3;
  return {kind:'procedural-navigation', caseId:projected.caseId, contentVersion:projected.contentVersion,
    revision:projected.revision, actionIds:projected.actions.slice(0, limit).map(item => item.id),
    sourceIds:projected.materials.slice(0, limit).map(item => item.id)};
}
