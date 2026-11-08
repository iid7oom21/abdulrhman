#!/usr/bin/env node
// Local written-case launcher. No API key, provider, hosting or paid call.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {createPreviewServer} from '../src/server.js';

const help = `RAVEN — تشغيل القضية محليًا (Node.js 24)
node server/ai-dialogue/scripts/start-case.mjs --content /private/raven-case-content.json --site /public-site --data /private/saves
Optional: --port 10000
The content and saves stay outside Git and the public site. No model calls.
`;
try {
  const {values} = parseArgs({options:{content:{type:'string'},site:{type:'string'},data:{type:'string'},port:{type:'string',default:'10000'},help:{type:'boolean'}}});
  if (values.help) { console.log(help); process.exit(0); }
  if (!values.content || !values.site || !values.data) throw new Error('مرّر مسارات القصة والموقع والحفظ.\n' + help);
  const content = fs.realpathSync(path.resolve(values.content));
  const site = fs.realpathSync(path.resolve(values.site));
  const data = path.resolve(values.data);
  const inside = (file, root) => file === root || file.startsWith(root + path.sep);
  if (!fs.statSync(site).isDirectory() || !fs.existsSync(path.join(site,'raven/deleted-name/play/content.html'))) throw new Error('نسخة الموقع لا تحتوي واجهة القضية.');
  if (inside(content,site) || inside(data,site)) throw new Error('القصة والحفظ يجب أن يبقيا خارج مجلد الموقع.');
  for (let current = data; ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current,'.git'))) throw new Error('اختر مجلد حفظ خارج Git.');
    if (path.dirname(current) === current) break;
  }
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('المنفذ يجب أن يكون بين 1 و65535.');
  const server = createPreviewServer({
    siteRoot:site, caseContentPath:content, caseStoragePath:path.join(data,'case-store.json'),
    storeFile:path.join(data,'dialogue-preview.json'), secureCookie:false,
    providerInfo:{provider:'simulation',model:null},
    readControls:() => ({providerCallsEnabled:false}),
  });
  server.on('error',error => { console.error(error.code === 'EADDRINUSE' ? 'المنفذ مستخدم. افتح الخادم الموجود أو أوقفه أولًا؛ لا تشغّل خادمين بمجلد الحفظ نفسه.' : 'تعذّر تشغيل الخادم: ' + (error.code || error.message)); process.exitCode = 1; });
  server.listen(port,'127.0.0.1',() => {
    console.log(`RAVEN جاهز على هذا الجهاز:\nhttp://127.0.0.1:${port}/raven/deleted-name/\nالمتابعة: http://127.0.0.1:${port}/raven/deleted-name/play/\nاترك هذه النافذة مفتوحة. للإيقاف: Ctrl+C.\nالقصة مكتوبة، دون نموذج أو رسوم استخدام. الحفظ في المجلد الذي اخترته.`);
  });
  const close = () => server.close(() => process.exit(0));
  process.once('SIGINT',close); process.once('SIGTERM',close);
} catch (error) {
  console.error('لم يبدأ التشغيل: ' + error.message);
  process.exitCode = 1;
}
