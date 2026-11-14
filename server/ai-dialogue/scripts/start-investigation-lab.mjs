// Local review of the existing written case. Never starts a model or deploys.
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {createPreviewServer} from '../src/server.js';
import {loadCaseContent} from '../src/case-service.js';
import {simulateReply} from '../src/dialogue.js';

const inside = (file, root) => file === root || file.startsWith(root + path.sep);
function privateDirectory(directory, siteRoot) {
  if (!path.isAbsolute(directory)) throw new Error('lab_data_requires_absolute_path');
  const resolved = path.resolve(directory);
  for (let current = resolved; ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) throw new Error('lab_data_must_be_outside_git');
    if (fs.existsSync(current) && fs.realpathSync(current) !== current) throw new Error('lab_data_symlink_rejected');
    if (current === path.dirname(current)) break;
  }
  if (inside(resolved, siteRoot)) throw new Error('lab_data_must_be_private');
  fs.mkdirSync(resolved, {recursive:true, mode:0o700});
  const stat = fs.lstatSync(resolved);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('lab_data_requires_private_directory');
  return resolved;
}

export function createInvestigationLab({contentPath, siteRoot, dataDirectory}) {
  if (![contentPath, siteRoot, dataDirectory].every(value => typeof value === 'string' && path.isAbsolute(value))) throw new Error('lab_requires_absolute_paths');
  const root = fs.realpathSync(siteRoot);
  if (root !== path.resolve(siteRoot) || !fs.statSync(root).isDirectory()) throw new Error('lab_site_invalid');
  for (const file of ['raven/investigation-lab/index.html', 'raven/investigation-lab/style.css', 'raven/investigation-lab/workbench.js', 'raven/deleted-name/play/app.js']) {
    const full = path.join(root, file);
    if (!fs.lstatSync(full).isFile() || fs.realpathSync(full) !== full) throw new Error('lab_public_files_missing_or_unsafe');
  }
  // Validate the private content before creating any recovery key.
  const pack = loadCaseContent(contentPath, {siteRoot:root});
  const directory = privateDirectory(dataDirectory, root);
  const keyFile = path.join(directory, 'review-checkpoint.key');
  try { fs.writeFileSync(keyFile, randomBytes(32).toString('hex'), {flag:'wx', mode:0o600}); }
  catch (error) { if (error.code !== 'EEXIST') throw new Error('lab_key_write_failed'); }
  const info = fs.lstatSync(keyFile);
  if (!info.isFile() || info.isSymbolicLink() || info.size !== 64 || (info.mode & 0o077)) throw new Error('lab_key_invalid');
  const key = fs.readFileSync(keyFile, 'utf8');
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('lab_key_invalid');
  return createPreviewServer({
    siteRoot:root, casePack:pack, caseCheckpointKey:key, secureCookie:false,
    generate:simulateReply, providerInfo:{provider:'simulation', model:null},
    readControls:() => ({providerCallsEnabled:false}),
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const {values} = parseArgs({options:{content:{type:'string'},site:{type:'string'},data:{type:'string'},port:{type:'string',default:'10001'},help:{type:'boolean'}}});
    if (values.help) {
      console.log('Local written-case review only. No model calls or publication.\nnode start-investigation-lab.mjs --content /private/case.json --site /public-site --data /private/review-data [--port 10001]');
    } else {
      const port = Number(values.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('lab_port_invalid');
      const server = createInvestigationLab({contentPath:values.content, siteRoot:values.site, dataDirectory:values.data});
      server.on('error', () => {console.error('تعذر بدء المعاينة المحلية؛ تحقق من المنفذ ومسارات المراجعة.'); process.exitCode = 1;});
      server.listen(port, '127.0.0.1', () => console.log(`معاينة محلية فقط، دون نموذج أو نشر:\nhttp://127.0.0.1:${port}/raven/investigation-lab/\nالحفظ في هذا المتصفح؛ احتفظ بمجلد بيانات المراجعة ومفتاحه. للإيقاف Ctrl+C.`));
      for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
    }
  } catch {
    // No private path, content, key or raw provider error is printed.
    console.error('لم تبدأ المعاينة. استخدم --help، وتحقق من ملفات الموقع ومن أن القصة وبيانات المراجعة خارج Git والموقع، بصلاحيات خاصة.');
    process.exitCode = 1;
  }
}
