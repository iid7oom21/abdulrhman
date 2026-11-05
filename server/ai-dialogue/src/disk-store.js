import fs from 'node:fs';
import path from 'node:path';

// A single JSON file on the local disk of the machine running this process.
// It survives a process restart while that same disk exists; it is lost if the disk is wiped or the machine changes.
export const DISK_FORMAT = 'raven-ai-dialogue-disk-v1';

export function openDiskStore(file) {
  const target = path.resolve(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  return {
    file: target,
    load() {
      let raw;
      try { raw = fs.readFileSync(target, 'utf8'); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
      let data;
      try { data = JSON.parse(raw); } catch { data = null; }
      // An unreadable or foreign file is never overwritten: refuse to start instead of losing it.
      if (!data || data.format !== DISK_FORMAT || !Array.isArray(data.sessions) || !Array.isArray(data.requests)) {
        throw new Error(`incompatible_store_file: ${target} was left untouched`);
      }
      return data;
    },
    save(state) {
      // Write a temporary file then rename, so a crash mid-write keeps the previous complete file.
      const tmp = `${target}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ format: DISK_FORMAT, ...state }));
      fs.renameSync(tmp, target);
    },
  };
}
