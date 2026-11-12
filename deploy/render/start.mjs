#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash, randomUUID} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {createPreviewServer} from '../../server/ai-dialogue/src/server.js';
import {loadCaseContent} from '../../server/ai-dialogue/src/case-service.js';
import {validateCasePack} from '../../server/ai-dialogue/src/case-engine.js';
import {simulateReply} from '../../server/ai-dialogue/src/dialogue.js';
import {SITE_COMMIT, PUBLIC_RELEASE, EXPORT_MARKER, validatePublicExport} from './build.mjs';

export const MAX_CONTENT_BYTES = 8 * 1024 * 1024;
export const DEFAULT_SITE_ROOT = fileURLToPath(new URL('../../.render-site', import.meta.url));
export const DEFAULT_SECRET_FILE = '/etc/secrets/raven-case-content.json';
export class RenderStartupError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const check = (condition, code) => { if (!condition) throw new RenderStartupError(code); };
const inside = (file, root) => file === root || file.startsWith(root + path.sep);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sameFile = (one, two) => one.dev === two.dev && one.ino === two.ino;
const sameVersion = (one, two) => sameFile(one,two) && one.size === two.size && one.mtimeMs === two.mtimeMs && one.ctimeMs === two.ctimeMs;
const exists = file => { try { return fs.lstatSync(file); } catch (error) { if(['ENOENT','ENOTDIR'].includes(error.code)) return null; throw error; } };
const envValue = (env, key, fallback) => Object.hasOwn(env,key) ? (check(typeof env[key] === 'string' && env[key].length > 0,'invalid_configuration'),env[key]) : fallback;

function absolute(file) {
  check(typeof file === 'string' && path.isAbsolute(file) && !file.includes('\0') && path.resolve(file) === file,'unsafe_path');
  return file;
}
function pathWithoutLinks(file, {missing = false} = {}) {
  absolute(file);
  let current = path.parse(file).root;
  const parts = file.slice(current.length).split(path.sep).filter(Boolean);
  for (const [index, part] of parts.entries()) {
    current = path.join(current,part); const info = exists(current);
    if (!info) { check(missing,'path_missing'); return; }
    check(!info.isSymbolicLink() && (index === parts.length - 1 || info.isDirectory()),'unsafe_path');
  }
  check(fs.realpathSync(file) === file,'unsafe_path');
}
function privatePath(file, siteRoot) {
  absolute(file); check(!inside(file,siteRoot),'private_path_in_site');
  pathWithoutLinks(file,{missing:true});
  for (let current = file; ; current = path.dirname(current)) {
    check(!exists(path.join(current,'.git')),'private_path_in_git');
    if (path.dirname(current) === current) break;
  }
}
function syncDirectory(directory) {
  const fd = fs.openSync(directory,fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function privateDirectory(directory, mount) {
  let current = mount;
  for (const part of path.relative(mount,directory).split(path.sep).filter(Boolean)) {
    current = path.join(current,part); const info = exists(current);
    if (!info) { fs.mkdirSync(current,{mode:0o700}); syncDirectory(path.dirname(current)); }
    else check(info.isDirectory() && !info.isSymbolicLink(),'unsafe_path');
    const fd = fs.openSync(current,fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    try { fs.fchmodSync(fd,0o700); } finally { fs.closeSync(fd); }
  }
}
function boundedRead(file, limit = MAX_CONTENT_BYTES) {
  pathWithoutLinks(file);
  const expected = fs.lstatSync(file);
  check(expected.isFile() && expected.size <= limit,'invalid_private_file');
  const fd = fs.openSync(file,fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd);
    check(before.isFile() && sameVersion(before,expected) && before.size <= limit,'invalid_private_file');
    const bytes = Buffer.alloc(before.size + 1); let length = 0, count;
    while (length < bytes.length && (count = fs.readSync(fd,bytes,length,bytes.length-length,null))) length += count;
    check(length === before.size && sameVersion(before,fs.fstatSync(fd)),'private_file_changed');
    return bytes.subarray(0,length);
  } finally { fs.closeSync(fd); }
}
function validateBytes(bytes, expectedHash) {
  check(bytes.length > 0 && bytes.length <= MAX_CONTENT_BYTES,'invalid_content');
  if (expectedHash) check(sha256(bytes) === expectedHash,'content_hash_mismatch');
  try { validateCasePack(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))); }
  catch { throw new RenderStartupError('invalid_content'); }
}
function decodeSecret(value) {
  // Buffer.from(base64) is permissive; require a canonical encoding before decoding.
  check(value.length <= Math.ceil((MAX_CONTENT_BYTES + 65536) / 3) * 4 && value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(value),'invalid_content_encoding');
  const compressed = Buffer.from(value,'base64');
  check(compressed.length > 0 && compressed.toString('base64') === value,'invalid_content_encoding');
  try { return gunzipSync(compressed,{maxOutputLength:MAX_CONTENT_BYTES}); }
  catch { throw new RenderStartupError('invalid_compressed_content'); }
}
function secureExistingFile(file) {
  const info = exists(file); if (!info) return;
  check(info.isFile() && !info.isSymbolicLink() && info.nlink === 1,'unsafe_private_file');
  const fd = fs.openSync(file,fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try { check(sameFile(info,fs.fstatSync(fd)),'private_file_changed'); fs.fchmodSync(fd,0o600); }
  finally { fs.closeSync(fd); }
}
function replaceContent(file, bytes, siteRoot) {
  const directory = path.dirname(file), original = exists(file);
  if (original) check(original.isFile() && !original.isSymbolicLink() && original.nlink === 1,'unsafe_private_file');
  const temporary = path.join(directory,'.content-' + randomUUID() + '.tmp');
  let fd, created = false, renamed = false;
  try {
    fd = fs.openSync(temporary,fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,0o600); created = true;
    fs.fchmodSync(fd,0o600); fs.writeFileSync(fd,bytes); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    loadCaseContent(temporary,{siteRoot}); // Validate the actual staged private file before publication.
    const current = exists(file);
    check(original ? current && sameVersion(original,current) : !current,'cached_content_changed');
    fs.renameSync(temporary,file); renamed = true; syncDirectory(directory);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (created && !renamed) fs.unlinkSync(temporary);
  }
}

export function prepareRenderRuntime({env = process.env, siteRoot = DEFAULT_SITE_ROOT, defaultSecretFile = DEFAULT_SECRET_FILE} = {}) {
  try {
    pathWithoutLinks(siteRoot); check(fs.lstatSync(siteRoot).isDirectory(),'invalid_public_export');
    const marker = JSON.parse(boundedRead(path.join(siteRoot,EXPORT_MARKER),4096).toString('utf8'));
    check(marker && Object.keys(marker).sort().join(',') === 'commit,format,release' &&
      marker.format === 'raven-render-site-v1' && marker.commit === SITE_COMMIT && marker.release === PUBLIC_RELEASE,'public_commit_mismatch');
    validatePublicExport(siteRoot);
    const portText = envValue(env,'PORT','10000');
    check(/^\d+$/.test(portText) && Number(portText) >= 1 && Number(portText) <= 65535,'invalid_port');
    const storageMode = envValue(env,'RAVEN_RENDER_STORAGE_MODE','disk');
    check(['disk','browser-checkpoint'].includes(storageMode),'invalid_storage_mode');
    const browserCheckpoint = storageMode === 'browser-checkpoint';
    // A restart must use the same operator-supplied key. Never create a key at
    // boot: that would make the browser's only recovery copy unreadable.
    if (browserCheckpoint) check(/^[a-fA-F0-9]{64}$/.test(envValue(env,'RAVEN_CASE_CHECKPOINT_KEY','')),'invalid_checkpoint_key');
    const mount = browserCheckpoint ? fs.realpathSync(os.tmpdir()) : absolute(envValue(env,'RAVEN_RENDER_DATA_MOUNT','/var/data'));
    pathWithoutLinks(mount); check(fs.lstatSync(mount).isDirectory(),'persistent_mount_missing');
    const dataDir = absolute(browserCheckpoint
      ? envValue(env,'RAVEN_RENDER_EPHEMERAL_DIR',path.join(mount,'raven-private-render'))
      : envValue(env,'RAVEN_RENDER_DATA_DIR',path.join(mount,'raven')));
    check(dataDir !== mount && inside(dataDir,mount),browserCheckpoint ? 'content_outside_temporary_directory' : 'data_outside_mount');
    privatePath(dataDir,siteRoot);
    const contentDir = path.join(dataDir,'content'), storageDir = browserCheckpoint ? null : path.join(dataDir,'stores');
    privatePath(contentDir,siteRoot); if (storageDir) privatePath(storageDir,siteRoot);
    const caseContentPath = path.join(contentDir,'raven-case-content.json');
    const fileExplicit = Object.hasOwn(env,'RAVEN_CASE_CONTENT_FILE'), gzipExplicit = Object.hasOwn(env,'RAVEN_CASE_CONTENT_GZIP_BASE64');
    check(!(fileExplicit && gzipExplicit),'conflicting_content_sources');
    let expectedHash = envValue(env,'RAVEN_CASE_CONTENT_SHA256',null);
    if (expectedHash !== null) { check(/^[a-fA-F0-9]{64}$/.test(expectedHash),'invalid_content_hash'); expectedHash = expectedHash.toLowerCase(); }
    let bytes, source;
    if (gzipExplicit) { bytes = decodeSecret(envValue(env,'RAVEN_CASE_CONTENT_GZIP_BASE64')); source = 'secret-env'; }
    else {
      const secretFile = absolute(envValue(env,'RAVEN_CASE_CONTENT_FILE',defaultSecretFile));
      privatePath(secretFile,siteRoot);
      if (fileExplicit || exists(secretFile)) { bytes = boundedRead(secretFile); loadCaseContent(secretFile,{siteRoot}); source = 'secret-file'; }
      else {
        // An ephemeral cache is not a recoverable deployment input. The free
        // mode needs its private content supplied through Render on every boot.
        check(!browserCheckpoint,'private_content_required');
        privatePath(caseContentPath,siteRoot); bytes = boundedRead(caseContentPath); loadCaseContent(caseContentPath,{siteRoot}); source = 'validated-cache';
      }
    }
    validateBytes(bytes,expectedHash);
    privateDirectory(contentDir,mount); if (storageDir) privateDirectory(storageDir,mount);
    privatePath(caseContentPath,siteRoot);
    if (source !== 'validated-cache') replaceContent(caseContentPath,bytes,siteRoot);
    secureExistingFile(caseContentPath);
    const caseStoragePath = storageDir ? path.join(storageDir,'case-store.json') : null;
    const storeFile = storageDir ? path.join(storageDir,'dialogue-preview.json') : null;
    for (const file of [caseStoragePath,storeFile].filter(Boolean)) { privatePath(file,siteRoot); secureExistingFile(file); }
    loadCaseContent(caseContentPath,{siteRoot});
    return {siteRoot,dataDir,storageMode,caseContentPath,caseContentSHA256:sha256(bytes),caseStoragePath,storeFile,source,host:'0.0.0.0',port:Number(portText)};
  } catch (error) {
    if (error instanceof RenderStartupError) throw error;
    throw new RenderStartupError('render_startup_failed'); // No content, path, secret or parser excerpt in logs.
  }
}

export function createRenderServer(options = {}) {
  const runtime = prepareRenderRuntime(options);
  try {
    const server = createPreviewServer({siteRoot:runtime.siteRoot,caseContentPath:runtime.caseContentPath,
      caseStoragePath:runtime.caseStoragePath,storeFile:runtime.storeFile,hostedRootRedirect:'/raven/',
      caseCheckpointKey:runtime.storageMode === 'browser-checkpoint' ? (options.env || process.env).RAVEN_CASE_CHECKPOINT_KEY : null,
      secureCookie:true,generate:simulateReply,providerInfo:{provider:'simulation',model:null},
      readControls:() => ({providerCallsEnabled:false,controlAvailable:true,purchasesEnabled:false,
        entitlementUseEnabled:false,writtenDialogueAvailable:true})});
    return {server,runtime};
  } catch { throw new RenderStartupError('render_server_unavailable'); }
}

export async function startRenderServer(options = {}) {
  const result = createRenderServer(options);
  await new Promise((resolve,reject) => {
    const failed = () => reject(new RenderStartupError('render_listen_failed'));
    result.server.once('error',failed);
    result.server.listen(result.runtime.port,result.runtime.host,() => { result.server.removeListener('error',failed); resolve(); });
  });
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const {server,runtime} = await startRenderServer();
    const storageLabel = runtime.storageMode === 'browser-checkpoint' ? 'browser recovery checkpoints; server memory is temporary' : 'private disk storage';
    console.log(`RAVEN written case listening on port ${runtime.port}; ${storageLabel}; model calls disabled.`);
    const close = () => server.close(() => process.exit(0));
    process.once('SIGINT',close); process.once('SIGTERM',close);
  } catch (error) {
    console.error(`RAVEN Render startup failed: ${error instanceof RenderStartupError ? error.code : 'render_startup_failed'}`);
    process.exitCode = 1;
  }
}
