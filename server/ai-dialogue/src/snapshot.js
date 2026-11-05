import {createMaterialStore} from './materials.js';
import {fingerprint,MAX_REQUESTS_PER_OWNER} from './dialogue.js';
import {DISK_FORMAT} from './disk-store.js';

export function validateSnapshot(snapshot,{maxSessions=100,maxMaterials=200,maxShares=500,createMaterials=createMaterialStore}={}) {
  const restored=new Map();
  if(snapshot===null)return restored;
  if(!snapshot || snapshot.format!==DISK_FORMAT || !Array.isArray(snapshot.sessions) || !Array.isArray(snapshot.requests))throw new Error('incompatible_store_file');
  try {
      if ((snapshot?.sessions.length || 0) > maxSessions) throw new Error();
      for (const saved of snapshot?.sessions || []) {
        if (!saved || typeof saved.owner !== 'string' || !/^[a-f0-9]{64}$/.test(saved.owner) || restored.has(saved.owner) ||
            !Number.isFinite(saved.touchedAt) || !Array.isArray(saved.actions) || saved.actions.length > maxMaterials + maxShares) throw new Error();
        const materials = createMaterials();
        for (const action of saved.actions) {
          if (action?.kind === 'material' && action.input?.author === 'player' && typeof action.input.id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(action.input.id) &&
              ['statement','correction','motive','private_note','report'].includes(action.input.type)) materials.createMaterial(action.input);
          else if (action?.kind === 'share' && action.input?.sender === 'player' && typeof action.input.eventId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(action.input.eventId) &&
              Array.isArray(action.input.recipients) && !action.input.recipients.includes('player')) materials.share(action.input);
          else throw new Error();
        }
        if (materials.listMaterials().length > maxMaterials || materials.listShareEvents().length > maxShares) throw new Error();
        restored.set(saved.owner, { materials, touchedAt:saved.touchedAt, actions:structuredClone(saved.actions) });
      }
      const seen = new Set(), counts = new Map();
      for (const record of snapshot?.requests || []) {
        if (!record || !restored.has(record.owner) || typeof record.id !== 'string' || !/^[\w-]{1,100}$/.test(record.id) || seen.has(record.id) ||
            !['jonas','claire'].includes(record.characterId) || typeof record.message !== 'string' || !record.message.trim() || record.message.length > 8000 ||
            typeof record.contentVersion !== 'string' || !/^[\w.-]{1,100}$/.test(record.contentVersion) ||
            record.fingerprint !== fingerprint({characterId:record.characterId,message:record.message,contentVersion:record.contentVersion}) ||
            !['pending','unknown','completed','error'].includes(record.status) || record.storage !== 'server-memory' ||
            typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt)) ||
            (record.response !== undefined && (typeof record.response?.text !== 'string' || !record.response.text.trim() || record.response.text.length > 40000 || typeof record.response.refused !== 'boolean')) ||
            (record.status === 'completed' && !record.response)) throw new Error();
        seen.add(record.id); counts.set(record.owner, (counts.get(record.owner) || 0) + 1);
        if (counts.get(record.owner) > MAX_REQUESTS_PER_OWNER) throw new Error();
      }
    } catch { throw new Error('incompatible_store_file: snapshot was left untouched'); }
  return restored;
}
