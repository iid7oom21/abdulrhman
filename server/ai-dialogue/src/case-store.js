import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';

export const CASE_STORE_FORMAT = 'raven-case-store-v1';
export const MAX_CASE_STORE_BYTES = 64 * 1024 * 1024;

// Private local file, separate from the dialogue preview store. Writers compare
// their last observed generation while holding a short exclusive file lock.
// A thrown save can follow a successful rename: callers must stop writes and recover.
export class CaseStoreError extends Error {
  constructor(code) { super(code); this.name = 'CaseStoreError'; this.code = code; }
}
const invalid = () => new CaseStoreError('case_store_invalid');
const unavailable = () => new CaseStoreError('storage_unavailable');
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;
const sameVersion = (a, b) => !a || !b ? a === b : sameFile(a, b) &&
  a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sameGeneration = (a, b) => !a || !b ? a === b : a.digest === b.digest && sameVersion(a.stat, b.stat);

export function openCaseStore(file, {validate} = {}) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || file.includes('\0') ||
      path.resolve(file) !== file || typeof validate !== 'function') throw invalid();
  const directory = path.dirname(file);
  const lockFile = file + '.lock';
  // undefined means no snapshot has been observed; null means observed absent.
  let observedGeneration;

  // Refuse symlink ancestors as well as the leaf. Missing parents are created only
  // after the new snapshot and any existing file have passed validation.
  function checkParents(create = false) {
    let current = path.parse(directory).root;
    for (const part of directory.slice(current.length).split('/').filter(Boolean)) {
      current = path.join(current, part);
      let stat;
      try { stat = fs.lstatSync(current); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        if (!create) return false;
        fs.mkdirSync(current, {mode:0o700}); stat = fs.lstatSync(current);
        // Persist the new directory's entry too, not only the final snapshot's
        // entry: otherwise a crash could lose a newly created ancestor path.
        const parentFd = fs.openSync(path.dirname(current), fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        try { fs.fsyncSync(parentFd); } finally { fs.closeSync(parentFd); }
      }
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw invalid();
    }
    if (fs.realpathSync(directory) !== directory) throw invalid();
    return true;
  }

  function validatePayload(payload) {
    try {
      const result = validate(payload);
      if (result === false) throw invalid();
      if (result && typeof result.then === 'function') {
        // Async validators are unsupported; also consume rejection so rejecting
        // the callback cannot become an unhandled process-level exception.
        Promise.resolve(result).catch(() => {});
        throw invalid();
      }
    } catch { throw invalid(); }
  }

  function decode(bytes) {
    try {
      const envelope = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) ||
          Object.keys(envelope).length !== 2 || envelope.format !== CASE_STORE_FORMAT ||
          !Object.hasOwn(envelope, 'payload')) throw invalid();
      validatePayload(envelope.payload);
      return envelope.payload;
    } catch { throw invalid(); }
  }

  function readCurrent() {
    if (!checkParents()) return null;
    let expected;
    try { expected = fs.lstatSync(file); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (!expected.isFile() || expected.isSymbolicLink() || expected.size > MAX_CASE_STORE_BYTES) throw invalid();
    let fd;
    try {
      fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || !sameFile(expected, stat) || stat.size > MAX_CASE_STORE_BYTES ||
          fs.realpathSync(file) !== file) throw invalid();
      // Read at most the observed size plus one byte; a growing file cannot cause
      // readFile to allocate unbounded memory or silently truncate the snapshot.
      const bytes = Buffer.allocUnsafe(stat.size + 1);
      let length = 0, count;
      while (length < bytes.length && (count = fs.readSync(fd, bytes, length, bytes.length - length, null))) length += count;
      if (length !== stat.size || !sameVersion(stat, fs.fstatSync(fd))) throw invalid();
      const raw = bytes.subarray(0, length);
      return {payload:decode(raw), generation:{stat, digest:digest(raw)}};
    } finally { if (fd !== undefined) fs.closeSync(fd); }
  }

  function outward(error) { return error instanceof CaseStoreError ? error : unavailable(); }
  return {
    load() {
      // A leftover lock blocks writes, not read-only recovery/export. Each read
      // parses a fresh payload; changing the returned object cannot change disk.
      try {
        const current = readCurrent();
        observedGeneration = current?.generation ?? null;
        return current?.payload ?? null;
      }
      catch (error) { throw outward(error); }
    },
    save(payload) {
      let bytes;
      try {
        validatePayload(payload);
        bytes = Buffer.from(JSON.stringify({format:CASE_STORE_FORMAT, payload}));
        if (bytes.length > MAX_CASE_STORE_BYTES) throw invalid();
        decode(bytes);
      } catch { throw invalid(); }

      let temporary, fd, parentFd, lockFd, lockStat, committedGeneration;
      let created = false, lockCreated = false, renamed = false, failure;
      try {
        const previousGeneration = readCurrent()?.generation ?? null; // Corrupt/foreign files are never replaced.
        // Never silently adopt an existing snapshot for a caller that has not
        // loaded it. Empty-file first saves remain supported.
        if (observedGeneration === undefined && previousGeneration !== null) throw unavailable();
        checkParents(true);
        parentFd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        const parent = fs.fstatSync(parentFd);
        // No waiting, timeout cleanup or PID-based stealing: a crash lock needs
        // operator review. An existing file/symlink/directory is left untouched.
        lockFd = fs.openSync(lockFile, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
        lockCreated = true; lockStat = fs.fstatSync(lockFd);
        fs.fchmodSync(lockFd, 0o600);
        fs.writeFileSync(lockFd, JSON.stringify({format:'raven-case-write-lock-v1', pid:process.pid, token:randomUUID()}));
        fs.fsyncSync(lockFd); fs.fsyncSync(parentFd);
        const currentGeneration = readCurrent()?.generation ?? null;
        const expectedGeneration = observedGeneration === undefined ? null : observedGeneration;
        if (!sameGeneration(expectedGeneration, currentGeneration)) throw unavailable();
        temporary = path.join(directory, '.raven-case-' + randomUUID() + '.tmp');
        fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
        created = true;
        fs.fchmodSync(fd, 0o600);
        fs.writeFileSync(fd, bytes);
        fs.fsyncSync(fd);
        const written = fs.fstatSync(fd);
        fs.closeSync(fd); fd = undefined;
        checkParents();
        if (!sameFile(parent, fs.lstatSync(directory))) throw unavailable();
        // Also refuse an out-of-band change from a writer that ignored the lock.
        if (!sameGeneration(expectedGeneration, readCurrent()?.generation ?? null)) throw unavailable();
        fs.renameSync(temporary, file); renamed = true;
        fs.fsyncSync(parentFd);
        const committed = fs.lstatSync(file);
        if (!committed.isFile() || !sameFile(written, committed)) throw unavailable();
        committedGeneration = {stat:committed, digest:digest(bytes)};
      } catch (error) { failure = outward(error); }
      finally {
        if (created && !renamed) {
          try { fs.unlinkSync(temporary); }
          catch (error) { if (error.code !== 'ENOENT') failure ??= unavailable(); }
        }
        if (lockCreated) {
          try {
            const existingLock = fs.lstatSync(lockFile);
            if (!lockStat || !existingLock.isFile() || !sameFile(lockStat, existingLock)) throw unavailable();
            fs.unlinkSync(lockFile); fs.fsyncSync(parentFd);
          } catch { failure ??= unavailable(); }
        }
        for (const descriptor of [fd, lockFd, parentFd]) if (descriptor !== undefined) {
          try { fs.closeSync(descriptor); } catch { failure ??= unavailable(); }
        }
      }
      if (failure) throw failure;
      observedGeneration = committedGeneration;
    },
  };
}
