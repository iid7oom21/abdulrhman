// One record per key keeps independent saves in different tabs from overwriting each other.
const PREFIX = 'raven.late-night.v1.';
const transientEvents = new Map();
const observedDrafts = new Map();
export const maxThumbnailChars = 218450; // 160 KiB of compressed raster data, base64 encoded.
export function isThumbnail(value) {
  return typeof value === 'string' && value.length <= maxThumbnailChars &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value);
}
const safeID = value => typeof value === 'string' && /^[a-z0-9-]{1,90}$/i.test(value);
export const nowId = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);

function issue(reason, value) {
  window.dispatchEvent(new CustomEvent('night:storage', {detail: {reason, value}}));
}
function read(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (key.startsWith('draft.')) observedDrafts.set(key,raw);
    if (raw === null) return null;
    const record = JSON.parse(raw);
    if (record?.version !== 1 || !Object.hasOwn(record,'value')) throw new Error('format');
    return record.value;
  } catch {
    issue('read');
    return null;
  }
}
function write(key, value) {
  try {
    const raw = JSON.stringify({version:1, value});
    localStorage.setItem(PREFIX + key, raw);
    if (localStorage.getItem(PREFIX + key) !== raw) throw new Error('unconfirmed');
    return true;
  } catch (error) {
    issue(error?.name === 'QuotaExceededError' ? 'quota' : 'write', value);
    return false;
  }
}
function list(name) {
  try {
    const prefix = PREFIX + name + '.';
    const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
    const rows=[];
    for (const key of keys) {
      const row=read(key.slice(PREFIX.length));
      if(row && safeID(row.activity) && safeID(row.id) && prefix+row.id===key && typeof row.at==='string')rows.push(row);
    }
    return rows.sort((a,b)=>b.at.localeCompare(a.at));
  } catch {
    issue('read');
    return [];
  }
}
export function pieces() {return list('piece').filter(row => typeof row.title === 'string' && typeof row.type === 'string' && row.data && typeof row.data === 'object');}
export function writePiece(activity, piece) {
  if (!safeID(activity) || !piece || !piece.title || !piece.type || !piece.data || typeof piece.data !== 'object') return null;
  const record = {schemaVersion:1, id:nowId(), activity, at:new Date().toISOString(), title:String(piece.title).slice(0,160),
    type:String(piece.type).slice(0,90), data:piece.data};
  if (isThumbnail(piece.thumbnail)) record.thumbnail=piece.thumbnail;
  return write('piece.'+record.id,record) ? record : null;
}
export function deletePiece(id) {
  if (!safeID(id)) return false;
  try {
    localStorage.removeItem(PREFIX+'piece.'+id);
    if (localStorage.getItem(PREFIX+'piece.'+id) !== null) throw new Error('unconfirmed');
    return true;
  } catch {issue('write'); return false;}
}
export function events() {
  const rows = new Map(transientEvents);
  for (const item of list('event')) rows.set(item.id,item);
  return [...rows.values()].filter(e=>typeof e.ar==='string' && typeof e.en==='string').sort((a,b)=>b.at.localeCompare(a.at));
}
export function recordEvent(activity, event) {
  if (!safeID(activity) || !event || typeof event.ar !== 'string' || typeof event.en !== 'string') return null;
  const row={id:nowId(), activity, at:new Date().toISOString(), ar:event.ar, en:event.en, data:event.data || {}};
  if (!write('event.'+row.id,row)) transientEvents.set(row.id,row);
  return row;
}
export const loadDraft = id => safeID(id) ? read('draft.'+id) : null;
export function saveDraft(id,value,{replace=false}={}) {
  if (!safeID(id)) return false;
  const key='draft.'+id;
  try {
    const before=localStorage.getItem(PREFIX+key);
    if (observedDrafts.has(key) && observedDrafts.get(key)!==before) {
      issue('conflict',value);
      return false;
    }
    if (before!==null && !replace) {
      const record=JSON.parse(before);
      if (record?.version!==1 || !Object.hasOwn(record,'value')) throw new Error('format');
    }
    if (!write(key,value)) return false;
    observedDrafts.set(key,JSON.stringify({version:1,value}));
    return true;
  } catch {
    issue('read',value);
    return false;
  }
}
export function download(name, content, type='application/json') {
  const blob = content instanceof Blob ? content : new Blob([typeof content === 'string' ? content : JSON.stringify(content,null,2)],{type});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
