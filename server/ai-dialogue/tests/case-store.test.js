import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {openCaseStore, CASE_STORE_FORMAT, MAX_CASE_STORE_BYTES} from '../src/case-store.js';

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'raven-case-store-test-'));
  t.after(() => fs.rmSync(directory, {recursive:true, force:true}));
  return {directory, file:path.join(directory, 'case.json')};
}
const snapshot = (revision = 1) => ({revision, records:[{id:'record-a', value:'synthetic value'}]});
function validate(payload) {
  assert.ok(payload && Object.keys(payload).length === 2 && Number.isSafeInteger(payload.revision));
  assert.ok(Array.isArray(payload.records));
  for (const record of payload.records) assert.ok(record && Object.keys(record).length === 2 &&
    typeof record.id === 'string' && typeof record.value === 'string');
}
const code = expected => error => error.code === expected && error.message === expected && error.cause === undefined;
const envelope = payload => JSON.stringify({format:CASE_STORE_FORMAT, payload});

test('missing file loads without creating directories; separate case store survives a genuine process reopen', t => {
  const f = fixture(t), file = path.join(f.directory, 'private', 'nested', 'case.json');
  const store = openCaseStore(file, {validate});
  assert.equal(store.load(), null); assert.equal(fs.existsSync(path.dirname(file)), false);
  const unrelated = path.join(f.directory, 'dialogue.json'); fs.writeFileSync(unrelated, 'KEEP_DIALOGUE_STORE');
  store.save(snapshot());
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {format:CASE_STORE_FORMAT, payload:snapshot()});
  const script = `import {openCaseStore} from ${JSON.stringify(new URL('../src/case-store.js', import.meta.url).href)};
    const validate = ${validate.toString().replaceAll('assert.ok(', 'check(')};
    const check = ok => { if (!ok) throw new Error('invalid'); };
    const store = openCaseStore(process.argv[1], {validate});
    const value = store.load(); value.revision += 1; store.save(value);
    process.stdout.write(JSON.stringify(store.load()));`;
  const reopened = spawnSync(process.execPath, ['--input-type=module', '-e', script, file], {encoding:'utf8'});
  assert.equal(reopened.status, 0, reopened.stderr);
  assert.deepEqual(JSON.parse(reopened.stdout), snapshot(2));
  assert.deepEqual(store.load(), snapshot(2));
  assert.equal(fs.readFileSync(unrelated, 'utf8'), 'KEEP_DIALOGUE_STORE');
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['case.json']);
});

test('malformed, foreign, invalid nested, extra-field and invalid UTF-8 stores keep their exact original bytes', t => {
  const f = fixture(t), store = openCaseStore(f.file, {validate});
  const originals = [Buffer.from('{broken'), Buffer.from(JSON.stringify({format:'different-format',payload:snapshot()})),
    Buffer.from(envelope({revision:1,records:[{id:'record-a',value:7}]})),
    Buffer.from(JSON.stringify({format:CASE_STORE_FORMAT,payload:snapshot(),extra:true})),
    Buffer.concat([Buffer.from('{"format":"' + CASE_STORE_FORMAT + '","payload":{"revision":1,"records":[{"id":"a","value":"'), Buffer.from([0xff]), Buffer.from('"}]}}')])];
  for (const original of originals) {
    fs.writeFileSync(f.file, original);
    assert.throws(() => store.load(), code('case_store_invalid'));
    assert.throws(() => store.save(snapshot(2)), code('case_store_invalid'));
    assert.deepEqual(fs.readFileSync(f.file), original);
    assert.deepEqual(fs.readdirSync(f.directory), ['case.json']);
  }
});

test('new directory entries are synced as well as the final file entry before save succeeds', t => {
  const f = fixture(t), directories = [f.directory, path.join(f.directory, 'private'), path.join(f.directory, 'private', 'nested')];
  const realFsync = fs.fsyncSync, synced = [];
  t.mock.method(fs, 'fsyncSync', fd => {
    const stat = fs.fstatSync(fd); if (stat.isDirectory()) synced.push(stat.ino);
    realFsync(fd);
  });
  const file = path.join(directories[2], 'case.json');
  openCaseStore(file, {validate}).save(snapshot());
  const inodes = directories.map(directory => fs.statSync(directory).ino);
  assert.deepEqual(synced.slice(0, 2), inodes.slice(0, 2));
  assert.ok(synced.length >= 3 && synced.slice(2).every(inode => inode === inodes[2]));
  assert.deepEqual(openCaseStore(file, {validate}).load(), snapshot());
});

test('save validation failure performs no filesystem writes and never leaks validator error text', t => {
  const f = fixture(t), store = openCaseStore(f.file, {validate}); store.save(snapshot());
  const before = fs.readFileSync(f.file), stat = fs.statSync(f.file);
  for (const value of [undefined, {revision:2,records:[{id:'a',value:2}]},
    {revision:1,records:[],big:1n}, {...snapshot(),unexpected:undefined}]) {
    assert.throws(() => store.save(value), code('case_store_invalid'));
    assert.deepEqual(fs.readFileSync(f.file), before); assert.equal(fs.statSync(f.file).mtimeMs, stat.mtimeMs);
  }
  for (const validator of [() => false, () => { throw new Error(f.file); }, async () => true,
    async () => { throw new Error(f.file); }]) {
    const target = path.join(f.directory, 'missing', 'case.json');
    assert.throws(() => openCaseStore(target, {validate:validator}).save(snapshot()), code('case_store_invalid'));
    assert.equal(fs.existsSync(path.dirname(target)), false);
  }
  assert.deepEqual(fs.readdirSync(f.directory), ['case.json']);
  assert.throws(() => openCaseStore('relative.json', {validate}), code('case_store_invalid'));
  assert.throws(() => openCaseStore(f.file), code('case_store_invalid'));
});

test('file and ancestor symlinks and directories are rejected without altering the referent', t => {
  const f = fixture(t), original = Buffer.from(envelope(snapshot())), real = path.join(f.directory, 'real.json');
  fs.writeFileSync(real, original); fs.symlinkSync(real, f.file);
  const store = openCaseStore(f.file, {validate});
  assert.throws(() => store.load(), code('case_store_invalid'));
  assert.throws(() => store.save(snapshot(2)), code('case_store_invalid'));
  assert.deepEqual(fs.readFileSync(real), original); assert.equal(fs.lstatSync(f.file).isSymbolicLink(), true);
  const realDirectory = path.join(f.directory, 'real'); fs.mkdirSync(realDirectory);
  const link = path.join(f.directory, 'link'); fs.symlinkSync(realDirectory, link);
  const nested = openCaseStore(path.join(link, 'new.json'), {validate});
  assert.throws(() => nested.load(), code('case_store_invalid'));
  assert.throws(() => nested.save(snapshot()), code('case_store_invalid'));
  assert.deepEqual(fs.readdirSync(realDirectory), []);
  assert.throws(() => openCaseStore(realDirectory, {validate}).load(), code('case_store_invalid'));
});

test('64 MiB limit applies to existing files and encoded saves without overwriting either', t => {
  const f = fixture(t), store = openCaseStore(f.file, {validate});
  fs.writeFileSync(f.file, 'oversized original'); fs.truncateSync(f.file, MAX_CASE_STORE_BYTES + 1);
  assert.throws(() => store.load(), code('case_store_invalid'));
  assert.throws(() => store.save(snapshot()), code('case_store_invalid'));
  assert.equal(fs.statSync(f.file).size, MAX_CASE_STORE_BYTES + 1);
  fs.writeFileSync(f.file, envelope(snapshot())); const before = fs.readFileSync(f.file);
  assert.throws(() => store.save({revision:1,records:[{id:'large',value:'x'.repeat(MAX_CASE_STORE_BYTES)}]}), code('case_store_invalid'));
  assert.deepEqual(fs.readFileSync(f.file), before); assert.deepEqual(fs.readdirSync(f.directory), ['case.json']);
});

test('failure before rename preserves the previous snapshot and removes its temporary file', t => {
  const f = fixture(t), store = openCaseStore(f.file, {validate}); store.save(snapshot());
  const original = fs.readFileSync(f.file);
  t.mock.method(fs, 'renameSync', () => { throw new Error('PRIVATE_PATH_' + f.file); });
  assert.throws(() => store.save(snapshot(2)), code('storage_unavailable'));
  assert.deepEqual(fs.readFileSync(f.file), original);
  assert.deepEqual(fs.readdirSync(f.directory), ['case.json']);
});

test('failed exclusive temp creation cannot remove someone else’s existing file', t => {
  const f = fixture(t), store = openCaseStore(f.file, {validate}); store.save(snapshot());
  const realOpen = fs.openSync; let occupied;
  t.mock.method(fs, 'openSync', (file, flags, mode) => {
    if ((flags & fs.constants.O_EXCL) && path.basename(file).startsWith('.raven-case-')) {
      occupied = file; fs.writeFileSync(file, 'KEEP_EXISTING_TEMP');
    }
    return realOpen(file, flags, mode);
  });
  assert.throws(() => store.save(snapshot(2)), code('storage_unavailable'));
  assert.equal(fs.readFileSync(occupied, 'utf8'), 'KEEP_EXISTING_TEMP');
  assert.deepEqual(store.load(), snapshot());
});

test('file sync precedes atomic rename; directory-sync failure reports uncertainty after committing exact valid bytes', t => {
  const f = fixture(t), store = openCaseStore(f.file, {validate}); store.save(snapshot());
  const realFsync = fs.fsyncSync, realRename = fs.renameSync, sequence = []; let renamed = false;
  t.mock.method(fs, 'fsyncSync', fd => {
    if (fs.fstatSync(fd).isDirectory()) {
      sequence.push(renamed ? 'directory-sync-after-rename' : 'directory-sync-before-rename');
      if (renamed) throw new Error(f.file);
    } else sequence.push('file-sync');
    realFsync(fd);
  });
  t.mock.method(fs, 'renameSync', (from, to) => {
    sequence.push('rename'); assert.equal(path.dirname(from), path.dirname(to));
    assert.equal(fs.statSync(from).mode & 0o777, 0o600); realRename(from, to); renamed = true;
  });
  assert.throws(() => store.save(snapshot(2)), code('storage_unavailable'));
  assert.equal(sequence[sequence.indexOf('rename') - 1], 'file-sync');
  assert.equal(sequence[sequence.indexOf('rename') + 1], 'directory-sync-after-rename');
  assert.deepEqual(openCaseStore(f.file, {validate}).load(), snapshot(2));
  assert.deepEqual(fs.readdirSync(f.directory), ['case.json']);
});

test('independent stores cannot overwrite a snapshot they did not load or a generation changed by another writer', t => {
  const f = fixture(t), first = openCaseStore(f.file, {validate}), second = openCaseStore(f.file, {validate});
  assert.equal(first.load(), null); assert.equal(second.load(), null);
  first.save(snapshot()); const initialBytes = fs.readFileSync(f.file);
  assert.throws(() => second.save(snapshot(2)), code('storage_unavailable'));
  assert.deepEqual(fs.readFileSync(f.file), initialBytes);
  assert.throws(() => openCaseStore(f.file, {validate}).save(snapshot(2)), code('storage_unavailable'));
  assert.deepEqual(fs.readFileSync(f.file), initialBytes);
  const updated = second.load(); updated.revision++;
  updated.records.push({id:'record-b', value:'second writer'});
  assert.deepEqual(first.load(), snapshot()); // returned objects are detached from disk
  second.save(updated); const updatedBytes = fs.readFileSync(f.file);
  assert.throws(() => first.save(snapshot(3)), code('storage_unavailable'));
  assert.deepEqual(fs.readFileSync(f.file), updatedBytes);
  assert.deepEqual(first.load(), updated);
  updated.revision++; first.save(updated);
  assert.deepEqual(second.load(), updated);
  assert.deepEqual(fs.readdirSync(f.directory), ['case.json']);
});

test('two actual child writers loaded at the same generation produce one save and one explicit conflict', async t => {
  const f = fixture(t); openCaseStore(f.file, {validate}).save(snapshot());
  const script = `import {openCaseStore} from ${JSON.stringify(new URL('../src/case-store.js', import.meta.url).href)};
    const check = ok => { if (!ok) throw new Error('invalid'); };
    const validate = ${validate.toString().replaceAll('assert.ok(', 'check(')};
    const store = openCaseStore(process.argv[1], {validate}), value = store.load();
    process.once('message', () => {
      value.revision++; value.records.push({id:process.argv[2],value:'child value'});
      try { store.save(value); process.send({type:'result',saved:true}); }
      catch (error) { process.send({type:'result',saved:false,code:error.code}); }
      process.disconnect();
    });
    process.send({type:'ready'});`;
  const run = id => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script, f.file, id], {stdio:['ignore','ignore','pipe','ipc']});
    t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
    let result, stderr = ''; child.stderr.on('data', data => { stderr += data; });
    const ready = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.on('message', message => { if (message.type === 'ready') resolve(); else result = message; });
      child.once('exit', status => { if (status !== 0) reject(new Error(stderr || 'child_failed')); });
    });
    const done = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', status => status === 0 && result ? resolve(result) : reject(new Error(stderr || 'child_failed')));
    });
    return {child,ready,done};
  };
  const writers = [run('writer-one'), run('writer-two')];
  await Promise.all(writers.map(writer => writer.ready));
  for (const writer of writers) writer.child.send('save');
  const results = await Promise.all(writers.map(writer => writer.done));
  assert.equal(results.filter(result => result.saved).length, 1);
  assert.equal(results.filter(result => result.code === 'storage_unavailable').length, 1);
  const saved = openCaseStore(f.file, {validate}).load();
  assert.equal(saved.revision, 2); assert.equal(saved.records.length, 2);
  assert.deepEqual(saved.records[0], snapshot().records[0]);
  assert.equal(saved.records[1].id, results[0].saved ? 'writer-one' : 'writer-two');
  assert.deepEqual(fs.readdirSync(f.directory), ['case.json']);
});

test('a real crash leaves a lock for manual review; validated read-only recovery remains available', t => {
  const f = fixture(t); openCaseStore(f.file, {validate}).save(snapshot());
  const before = fs.readFileSync(f.file), lockFile = f.file + '.lock';
  const script = `import fs from 'node:fs';
    import {openCaseStore} from ${JSON.stringify(new URL('../src/case-store.js', import.meta.url).href)};
    const check = ok => { if (!ok) throw new Error('invalid'); };
    const validate = ${validate.toString().replaceAll('assert.ok(', 'check(')};
    const store = openCaseStore(process.argv[1], {validate}), value = store.load();
    const sync = fs.fsyncSync;
    fs.fsyncSync = fd => { sync(fd); if (fs.fstatSync(fd).isDirectory() && fs.existsSync(process.argv[1] + '.lock')) process.exit(17); };
    value.revision++; store.save(value);`;
  const crashed = spawnSync(process.execPath, ['--input-type=module', '-e', script, f.file], {encoding:'utf8'});
  assert.equal(crashed.status, 17, crashed.stderr);
  const lockBytes = fs.readFileSync(lockFile);
  assert.equal(fs.statSync(lockFile).mode & 0o777, 0o600);
  assert.equal(JSON.parse(lockBytes).format, 'raven-case-write-lock-v1');
  const recovery = openCaseStore(f.file, {validate});
  assert.deepEqual(recovery.load(), snapshot());
  assert.throws(() => recovery.save(snapshot(2)), code('storage_unavailable'));
  assert.deepEqual(fs.readFileSync(f.file), before); assert.deepEqual(fs.readFileSync(lockFile), lockBytes);
  // Test-only manual recovery after the child has exited and both files were checked.
  fs.unlinkSync(lockFile); recovery.save(snapshot(2));
  assert.deepEqual(recovery.load(), snapshot(2));
  assert.deepEqual(fs.readdirSync(f.directory), ['case.json']);
});

test('an existing symlink lock is never followed or removed', t => {
  const f = fixture(t), store = openCaseStore(f.file, {validate}); store.save(snapshot());
  const referent = path.join(f.directory, 'private.txt'); fs.writeFileSync(referent, 'KEEP_PRIVATE_BYTES');
  fs.symlinkSync(referent, f.file + '.lock');
  assert.deepEqual(store.load(), snapshot());
  assert.throws(() => store.save(snapshot(2)), code('storage_unavailable'));
  assert.equal(fs.lstatSync(f.file + '.lock').isSymbolicLink(), true);
  assert.equal(fs.readFileSync(referent, 'utf8'), 'KEEP_PRIVATE_BYTES');
});
