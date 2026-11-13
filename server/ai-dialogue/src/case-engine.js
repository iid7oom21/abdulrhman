import {createHash} from 'node:crypto';

const clone = value => structuredClone(value);
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const keys = (value, allowed) => plain(value) && Object.keys(value).every(key => allowed.includes(key));
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(value) && !['constructor','prototype','__proto__'].includes(value);
const primitive = value => value === null || ['string','boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value));
const text = (value, max = 40000) => typeof value === 'string' && value.length <= max;
const own = (value, key) => Object.hasOwn(value, key);
export class CaseError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
const reject = (condition, code = 'invalid_request', status = 400) => { if (!condition) throw new CaseError(code, status); };
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (plain(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export const caseFingerprint = value => createHash('sha256').update(canonical(value)).digest('hex');

export function validateCasePack(pack) {
  const valid = condition => reject(condition, 'case_pack_invalid');
  valid(keys(pack, ['schemaVersion','caseId','contentVersion','locales','defaultLocale','initialSceneId','initialFlags','initialMaterials','materials','scenes']));
  valid(pack.schemaVersion === 1 && identifier(pack.caseId) && identifier(pack.contentVersion));
  valid(Array.isArray(pack.locales) && pack.locales.length > 0 && pack.locales.length <= 8 && new Set(pack.locales).size === pack.locales.length && pack.locales.every(locale => /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale)) && pack.locales.includes(pack.defaultLocale));
  const localized = value => plain(value) && Object.keys(value).length > 0 && Object.keys(value).every(locale => pack.locales.includes(locale) && text(value[locale])) && own(value, pack.defaultLocale);
  const image = value => typeof value === 'string' && /^\/raven\/deleted-name\/assets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:webp|png|jpg)$/.test(value);
  const art = value => (value.image === undefined || image(value.image)) && (value.imageRow === undefined || [0,1,2].includes(value.imageRow));
  valid(plain(pack.materials) && Object.keys(pack.materials).length <= 2000 && plain(pack.scenes) && Object.keys(pack.scenes).length > 0 && Object.keys(pack.scenes).length <= 2000);
  valid(identifier(pack.initialSceneId) && own(pack.scenes, pack.initialSceneId));
  valid(plain(pack.initialFlags) && Object.keys(pack.initialFlags).every(key => identifier(key) && primitive(pack.initialFlags[key]) && (typeof pack.initialFlags[key] !== 'string' || pack.initialFlags[key].length <= 2000)));
  valid(Array.isArray(pack.initialMaterials) && new Set(pack.initialMaterials).size === pack.initialMaterials.length && pack.initialMaterials.every(id => identifier(id) && own(pack.materials, id)));
  const gate = (value, depth = 0) => {
    valid(depth < 20 && plain(value));
    if (keys(value, ['all']) && Array.isArray(value.all)) { valid(value.all.length <= 100); value.all.forEach(item => gate(item, depth + 1)); }
    else if (keys(value, ['any']) && Array.isArray(value.any)) { valid(value.any.length <= 100); value.any.forEach(item => gate(item, depth + 1)); }
    else if (keys(value, ['not']) && own(value, 'not')) gate(value.not, depth + 1);
    else if (keys(value, ['flag','equals'])) valid(identifier(value.flag) && own(value, 'equals') && primitive(value.equals));
    else if (keys(value, ['hasMaterial'])) valid(identifier(value.hasMaterial) && own(pack.materials, value.hasMaterial));
    else valid(false);
  };
  for (const [id, material] of Object.entries(pack.materials)) {
    valid(identifier(id) && keys(material, ['title','body','type','source','image','imageRow']));
    valid(localized(material.title) && localized(material.body) && localized(material.source) && ['document','testimony','recording','map','note'].includes(material.type) && art(material));
  }
  for (const [id, scene] of Object.entries(pack.scenes)) {
    valid(identifier(id) && keys(scene, ['title','body','image','imageRow','lines','actions']) && localized(scene.title) && localized(scene.body) && art(scene));
    valid(scene.lines === undefined || (Array.isArray(scene.lines) && scene.lines.length <= 1000));
    for (const line of scene.lines || []) {
      valid(keys(line, ['speaker','text','requires']) && localized(line.speaker) && localized(line.text));
      if (line.requires !== undefined) gate(line.requires);
    }
    valid(Array.isArray(scene.actions) && scene.actions.length <= 200);
    const ids = new Set();
    for (const action of scene.actions) {
      valid(keys(action, ['id','label','target','requires','fields','effects']) && identifier(action.id) && action.id !== 'case.note' && !ids.has(action.id) && localized(action.label)); ids.add(action.id);
      valid(action.target === undefined || (identifier(action.target) && own(pack.scenes, action.target)));
      if (action.requires !== undefined) gate(action.requires);
      valid(action.fields === undefined || (Array.isArray(action.fields) && action.fields.length <= 30));
      const fieldIds = new Set();
      for (const field of action.fields || []) {
        valid(keys(field, ['id','type','label','required','maxLength','options']) && identifier(field.id) && !fieldIds.has(field.id) && localized(field.label)); fieldIds.add(field.id);
        valid(['text','textarea','select','materialRefs'].includes(field.type) && (field.required === undefined || typeof field.required === 'boolean'));
        if (['text','textarea'].includes(field.type)) valid(Number.isInteger(field.maxLength) && field.maxLength > 0 && field.maxLength <= 2000 && field.options === undefined);
        else if (field.type === 'select') {
          valid(Array.isArray(field.options) && field.options.length > 0 && field.options.length <= 100 && field.options.every(plain) && new Set(field.options.map(item => item.value)).size === field.options.length);
          field.options.forEach(item => valid(keys(item, ['value','label']) && text(item.value, 200) && item.value.length > 0 && localized(item.label)));
          valid(field.maxLength === undefined);
        } else valid(field.options === undefined && field.maxLength === undefined);
      }
      if (action.effects !== undefined) {
        const effects = action.effects; valid(keys(effects, ['set','grant','share','capture','receipt']));
        valid(effects.set === undefined || (plain(effects.set) && Object.entries(effects.set).every(([key, value]) => identifier(key) && primitive(value) && (typeof value !== 'string' || value.length <= 2000))));
        valid(effects.grant === undefined || (Array.isArray(effects.grant) && effects.grant.length <= 2000 && effects.grant.every(key => identifier(key) && own(pack.materials, key))));
        valid(effects.share === undefined || (Array.isArray(effects.share) && effects.share.length <= 200));
        for (const share of effects.share || []) valid(keys(share, ['materialId','recipient']) && identifier(share.materialId) && own(pack.materials, share.materialId) && identifier(share.recipient));
        // Reserved suffix keeps receipt snapshots immutable even if a later
        // authored action accidentally chooses a snapshot's key for its draft.
        valid(effects.capture === undefined || (identifier(effects.capture) && !/\.revision\.\d+$/.test(effects.capture)));
        if (effects.receipt !== undefined) {
          const receipt = effects.receipt;
          valid(keys(receipt, ['kind','title','fromCapture','relatesTo']) && identifier(receipt.kind) && localized(receipt.title));
          valid(receipt.fromCapture === undefined || identifier(receipt.fromCapture));
          valid(receipt.relatesTo === undefined || identifier(receipt.relatesTo));
        }
      }
    }
  }
  return clone(pack);
}

export function validateOpening(value) {
  if (value === undefined || value === null) return null;
  reject(keys(value, ['version','choice','recipient']) && value.version === 'paper-opening-2026-11-05-r2' && ['precise','wait','refuse','lie'].includes(value.choice));
  reject(['precise','lie'].includes(value.choice) ? ['jonas','both','draft'].includes(value.recipient) : value.recipient === null);
  return {...clone(value), scope:'imported-local-choice'};
}
export function createCaseState(pack, opening = null) {
  return {caseId:pack.caseId, contentVersion:pack.contentVersion, revision:0, sceneId:pack.initialSceneId,
    flags:{...clone(pack.initialFlags), opening_imported:opening !== null, opening_choice:opening?.choice || 'none', opening_recipient:opening?.recipient || 'none'},
    materialIds:[...pack.initialMaterials], notes:[], captures:{}, shares:[], receipts:[], opening:clone(opening)};
}
export function gateAllows(gate, state) {
  if (gate === undefined) return true;
  if (own(gate, 'all')) return gate.all.every(item => gateAllows(item, state));
  if (own(gate, 'any')) return gate.any.some(item => gateAllows(item, state));
  if (own(gate, 'not')) return !gateAllows(gate.not, state);
  if (own(gate, 'flag')) return own(state.flags, gate.flag) && state.flags[gate.flag] === gate.equals;
  return state.materialIds.includes(gate.hasMaterial);
}
const noteAction = state => ({id:'case.note',label:{ar:'إضافة ملاحظة خاصة',en:'Add a private note'},fields:[
  {id:'text',type:'textarea',label:{ar:'الملاحظة',en:'Note'},required:true,maxLength:2000},
  {id:'sourceId',type:'select',label:{ar:'المادة',en:'Source'},required:true,options:state.materialIds.map(id => ({value:id,label:{ar:id,en:id}}))},
]});
const displayFields = (action, state, pack) => (action.fields || []).map(field => ({...clone(field),
  ...(field.type === 'materialRefs' ? {options:state.materialIds.map(id => ({value:id,label:clone(pack.materials[id].title)}))} : {})}));
function valuesFor(action, incoming, state) {
  const fields = action.fields || [], values = incoming === undefined ? {} : incoming;
  reject(plain(values) && Object.keys(values).every(key => fields.some(field => field.id === key)));
  const result = {};
  for (const field of fields) {
    const value = values[field.id];
    if (value === undefined) { reject(!field.required); continue; }
    if (field.type === 'materialRefs') {
      reject(Array.isArray(value) && value.length <= 200 && new Set(value).size === value.length && value.every(id => state.materialIds.includes(id)) && (!field.required || value.length > 0));
    } else if (field.type === 'select') reject(typeof value === 'string' && field.options.some(option => option.value === value));
    else reject(text(value, field.maxLength) && (!field.required || value.trim().length > 0));
    result[field.id] = clone(value);
  }
  return result;
}
export function validateCaseRequest(request) {
  reject(keys(request, ['id','revision','contentVersion','actionId','values']) && identifier(request.id) && identifier(request.actionId) && identifier(request.contentVersion) && Number.isSafeInteger(request.revision) && request.revision >= 0 && (request.values === undefined || plain(request.values)));
  return {id:request.id,revision:request.revision,contentVersion:request.contentVersion,actionId:request.actionId,values:clone(request.values || {})};
}
const receiptCapture = (state, fromCapture) => {
  const capture = state.captures[fromCapture];
  return capture ? {key:fromCapture + '.revision.' + capture.revision,capture} : null;
};
export function applyCaseAction(pack, state, request) {
  reject(request.contentVersion === pack.contentVersion && state.contentVersion === pack.contentVersion, 'content_version_mismatch', 409);
  reject(request.revision === state.revision, 'revision_conflict', 409);
  const scene = pack.scenes[state.sceneId];
  const action = request.actionId === 'case.note' && state.materialIds.length ? noteAction(state) : scene.actions.find(item => item.id === request.actionId && gateAllows(item.requires, state));
  reject(action, 'action_unavailable', 409);
  const values = valuesFor(action, request.values, state), next = clone(state);
  next.revision++;
  if (request.actionId === 'case.note') {
    next.notes.push({id:'note.' + request.id,text:values.text,sourceId:values.sourceId}); return next;
  }
  const effects = action.effects || {};
  Object.assign(next.flags, effects.set || {});
  for (const materialId of effects.grant || []) if (!next.materialIds.includes(materialId)) next.materialIds.push(materialId);
  for (const share of effects.share || []) {
    reject(next.materialIds.includes(share.materialId), 'material_unavailable', 409);
    next.shares.push({...clone(share),revision:next.revision});
  }
  if (effects.capture) {
    reject(!next.receipts.some(receipt => receipt.fromCapture === effects.capture),'capture_conflict',409);
    next.captures[effects.capture] = {values,actionId:action.id,revision:next.revision,
      label:clone(action.label),fields:displayFields(action,state,pack)};
  }
  if (effects.receipt) {
    const receipt = effects.receipt;
    const entry = {id:'receipt.' + request.id,kind:receipt.kind,title:clone(receipt.title),scope:'story-only',revision:next.revision};
    if (receipt.fromCapture) {
      const snapshot = receiptCapture(next,receipt.fromCapture); reject(snapshot, 'capture_unavailable', 409);
      const {key:snapshotKey,capture} = snapshot;
      reject(!own(next.captures, snapshotKey) || canonical(next.captures[snapshotKey]) === canonical(capture), 'capture_conflict', 409);
      next.captures[snapshotKey] = clone(capture); entry.fromCapture = snapshotKey;
    }
    if (receipt.relatesTo) {
      const previous = next.receipts.findLast(item => item.kind === receipt.relatesTo);
      reject(previous, 'receipt_unavailable', 409); entry.relatesTo = previous.id;
    }
    next.receipts.push(entry);
  }
  if (action.target !== undefined) next.sceneId = action.target;
  return next;
}
const optionalArt = value => ({...(value.image === undefined ? {} : {image:value.image}),...(value.imageRow === undefined ? {} : {imageRow:value.imageRow})});
function receiptPreview(action, state, pack) {
  const effects = action.effects || {}, receipt = effects.receipt;
  // A review can describe only an already captured draft and earned attachments.
  // In particular, do not preview a grant or guess values submitted by this action.
  if (!receipt || effects.capture || (effects.share || []).some(share => !state.materialIds.includes(share.materialId))) return null;
  const preview = {kind:receipt.kind,title:clone(receipt.title),scope:'story-only'};
  if (receipt.fromCapture) {
    const snapshot = receiptCapture(state,receipt.fromCapture);
    if (!snapshot || (own(state.captures,snapshot.key) && canonical(state.captures[snapshot.key]) !== canonical(snapshot.capture))) return null;
    preview.fromCapture = snapshot.key; preview.capture = clone(snapshot.capture);
  }
  if (receipt.relatesTo) {
    const previous = state.receipts.findLast(item => item.kind === receipt.relatesTo);
    if (!previous) return null;
    preview.relatesTo = previous.id;
  }
  preview.shares = clone(effects.share || []);
  preview.materials = [...new Set(preview.shares.map(share => share.materialId))].map(id => ({id,title:clone(pack.materials[id].title)}));
  return preview;
}
export function projectCaseState(pack, state, persistence = 'process-memory') {
  const scene = pack.scenes[state.sceneId];
  const actions = scene.actions.filter(action => gateAllows(action.requires, state)).map(action => {
    const fields = displayFields(action,state,pack), preview = receiptPreview(action,state,pack);
    return {id:action.id,label:clone(action.label),...(fields.length ? {fields} : {}),...(preview ? {receiptPreview:preview} : {})};
  });
  if (state.materialIds.length) {
    const note = noteAction(state); note.fields[1].options = state.materialIds.map(id => ({value:id,label:clone(pack.materials[id].title)})); actions.push(note);
  }
  return {caseId:state.caseId, contentVersion:state.contentVersion,revision:state.revision,saveStatus:persistence === 'disk-file' ? 'confirmed' : persistence === 'browser-checkpoint' ? 'browser-required' : 'memory',persistence,
    scene:{id:state.sceneId,title:clone(scene.title),body:clone(scene.body),...optionalArt(scene),lines:(scene.lines || []).filter(line => gateAllows(line.requires,state)).map(line => ({speaker:clone(line.speaker),text:clone(line.text)}))},
    materials:state.materialIds.map(id => ({id,title:clone(pack.materials[id].title),body:clone(pack.materials[id].body),type:pack.materials[id].type,source:clone(pack.materials[id].source),...optionalArt(pack.materials[id])})),
    actions,notes:clone(state.notes),captures:clone(state.captures),shares:clone(state.shares),receipts:clone(state.receipts),opening:clone(state.opening)};
}

// Structural checks also protect old-version sessions. Current-version sessions are replayed by
// the service, so a valid JSON snapshot cannot silently forge acquired material or progression.
export function validateStoredCaseState(state) {
  const localized = value => plain(value) && Object.keys(value).length > 0 && Object.entries(value).every(([locale,item]) => /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) && text(item));
  const displayField = field => keys(field,['id','type','label','required','maxLength','options']) && identifier(field.id) && ['text','textarea','select','materialRefs'].includes(field.type) && localized(field.label) && (field.required === undefined || typeof field.required === 'boolean') && (field.maxLength === undefined || (Number.isInteger(field.maxLength) && field.maxLength > 0 && field.maxLength <= 2000)) && (field.options === undefined || (Array.isArray(field.options) && field.options.length <= 2000 && field.options.every(option => keys(option,['value','label']) && text(option.value,200) && localized(option.label))));
  reject(keys(state,['caseId','contentVersion','revision','sceneId','flags','materialIds','notes','captures','shares','receipts','opening']) && identifier(state.caseId) && identifier(state.contentVersion) && identifier(state.sceneId) && Number.isSafeInteger(state.revision) && state.revision >= 0, 'case_store_invalid');
  reject(plain(state.flags) && Object.entries(state.flags).every(([key,value]) => identifier(key) && primitive(value)), 'case_store_invalid');
  reject(Array.isArray(state.materialIds) && state.materialIds.every(identifier) && new Set(state.materialIds).size === state.materialIds.length, 'case_store_invalid');
  reject(Array.isArray(state.notes) && state.notes.every(note => keys(note,['id','text','sourceId']) && text(note.id,160) && text(note.text,2000) && state.materialIds.includes(note.sourceId)), 'case_store_invalid');
  reject(plain(state.captures) && Object.entries(state.captures).every(([key,capture]) => text(key,160) && keys(capture,['values','actionId','revision','label','fields']) && plain(capture.values) && Object.entries(capture.values).every(([id,value]) => identifier(id) && (text(value,2000) || (Array.isArray(value) && value.length <= 200 && value.every(materialId => state.materialIds.includes(materialId))))) && identifier(capture.actionId) && Number.isSafeInteger(capture.revision) && capture.revision > 0 && capture.revision <= state.revision && (capture.label === undefined || localized(capture.label)) && (capture.fields === undefined || (Array.isArray(capture.fields) && capture.fields.length <= 30 && capture.fields.every(displayField)))), 'case_store_invalid');
  reject(Array.isArray(state.shares) && state.shares.every(share => keys(share,['materialId','recipient','revision']) && state.materialIds.includes(share.materialId) && identifier(share.recipient) && Number.isSafeInteger(share.revision) && share.revision > 0 && share.revision <= state.revision), 'case_store_invalid');
  reject(Array.isArray(state.receipts) && state.receipts.every(receipt => keys(receipt,['id','kind','title','scope','fromCapture','relatesTo','revision']) && text(receipt.id,160) && identifier(receipt.kind) && plain(receipt.title) && Object.entries(receipt.title).every(([locale,value]) => /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) && text(value)) && receipt.scope === 'story-only' && Number.isSafeInteger(receipt.revision) && receipt.revision > 0 && receipt.revision <= state.revision && (receipt.fromCapture === undefined || own(state.captures,receipt.fromCapture)) && (receipt.relatesTo === undefined || state.receipts.some(previous => previous.id === receipt.relatesTo && previous.revision < receipt.revision))), 'case_store_invalid');
  if (state.opening !== null) {
    reject(keys(state.opening,['version','choice','recipient','scope']) && state.opening.scope === 'imported-local-choice', 'case_store_invalid');
    validateOpening({version:state.opening.version,choice:state.opening.choice,recipient:state.opening.recipient});
  }
  return true;
}
