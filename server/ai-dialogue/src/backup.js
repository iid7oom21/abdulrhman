import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {validateSnapshot} from './snapshot.js';

const FORMAT='raven-preview-backup-v1',MAX_BYTES=64*1024*1024;
const digest=data=>createHash('sha256').update(data).digest('hex');
function read(file){if(fs.statSync(file).size>MAX_BYTES)throw new Error('backup_too_large');return fs.readFileSync(file,'utf8');}
function validate(raw){const snapshot=JSON.parse(raw);if(!snapshot)throw new Error("invalid_backup");validateSnapshot(snapshot);return snapshot;}
function publishNew(file,raw){
  const target=path.resolve(file),tmp=path.join(path.dirname(target),'.raven-backup-'+randomUUID());
  fs.mkdirSync(path.dirname(target),{recursive:true});let fd;
  try{
    fd=fs.openSync(tmp,'wx',0o600);fs.writeFileSync(fd,raw);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
    // link is atomic and fails if the destination exists. Never replace a live store or backup.
    fs.linkSync(tmp,target);
  }finally{if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(tmp);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
export function createBackup(source,destination){
  const raw=read(source);validate(raw);
  const data={format:FORMAT,createdAt:new Date().toISOString(),sha256:digest(raw),snapshot:raw};
  const encoded=JSON.stringify(data);if(Buffer.byteLength(encoded)>MAX_BYTES)throw new Error('backup_too_large');
  publishNew(destination,encoded);return {sha256:data.sha256,bytes:Buffer.byteLength(raw)};
}
export function restoreBackup(source,destination){
  const data=JSON.parse(read(source));
  if(!data||data.format!==FORMAT||typeof data.snapshot!=='string'||data.sha256!==digest(data.snapshot))throw new Error('invalid_backup');
  validate(data.snapshot);publishNew(destination,data.snapshot);
  return {sha256:data.sha256,bytes:Buffer.byteLength(data.snapshot)};
}
