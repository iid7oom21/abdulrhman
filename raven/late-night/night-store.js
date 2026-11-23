// One record per key keeps independent saves in different tabs from overwriting each other.
const PREFIX = 'raven.late-night.v1.';
const transientEvents = new Map();
const safeID = value => typeof value === 'string' && /^[a-z0-9-]{1,90}$/i.test(value);
export const nowId = () => globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);

function issue(reason, value) {
  window.dispatchEvent(new CustomEvent('night:storage', {detail: {reason, value}}));
}
function read(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
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
  } catch {
    issue('write', value);
    return false;
  }
}
function list(name) {
  try {
    const prefix = PREFIX + name + '.';
    const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));
    return keys.map(key => read(key.slice(PREFIX.length))).filter(row =>
      row && safeID(row.id) && safeID(row.activity) && typeof row.at === 'string'
    ).sort((a,b) => b.at.localeCompare(a.at));
  } catch {
    issue('read');
    return [];
  }
}
export function pieces() {return list('piece').filter(row => typeof row.title === 'string' && typeof row.type === 'string' && row.data && typeof row.data === 'object');}
export function writePiece(activity, piece) {
  if (!safeID(activity) || !piece || !piece.title || !piece.type || !piece.data || typeof piece.data !== 'object') return null;
  const record = {id:nowId(), activity, at:new Date().toISOString(), title:String(piece.title).slice(0,160),
    type:String(piece.type).slice(0,90), data:piece.data};
  if (typeof piece.thumbnail === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(piece.thumbnail)) record.thumbnail=piece.thumbnail;
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
export const saveDraft = (id,value) => safeID(id) && write('draft.'+id,value);
export function download(name, content, type='application/json') {
  const blob = content instanceof Blob ? content : new Blob([typeof content === 'string' ? content : JSON.stringify(content,null,2)],{type});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; document.body.append(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
