#!/usr/bin/env node
// Private path check for a written-case pack. No server, model, network or save file.
// The terminal gets counts only. Scene and action identifiers go to a report file that
// must live outside Git, so a shared log never carries the shape of the story.
import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {loadCaseContent} from '../src/case-service.js';
import {checkCasePack, summarizeCheck} from '../src/case-check.js';

const help = `RAVEN — فحص مسارات القضية المكتوبة (Node.js 24)
node server/ai-dialogue/scripts/check-case.mjs --content /private/raven-case-content.json [--report /private/PRIVATE-QA-<version>.json]
Optional: --max-states 1000000
يطبع أعدادًا فقط. المعرّفات والمسارات تُكتب في ملف التقرير الخاص، خارج Git.
Exit: 0 سليم · 1 توجد مشكلات أو لم يكتمل الفحص · 2 استخدام أو حزمة غير صالحة.
`;
const fail = message => { console.error('لم يبدأ الفحص: ' + message); process.exit(2); };
let values;
try {
  ({values} = parseArgs({options: {content: {type: 'string'}, report: {type: 'string'}, 'max-states': {type: 'string', default: '1000000'}, help: {type: 'boolean'}}}));
} catch { fail('خيار غير معروف.\n' + help); }
if (values.help) { console.log(help); process.exit(0); }
if (!values.content) fail('مرّر مسار حزمة القصة.\n' + help);
const maxStates = Number(values['max-states']);
if (!Number.isInteger(maxStates) || maxStates < 1) fail('--max-states يجب أن يكون عددًا صحيحًا موجبًا.');

let reportPath = null;
if (values.report) {
  reportPath = values.report;
  if (!path.isAbsolute(reportPath) || path.resolve(reportPath) !== reportPath) fail('مسار التقرير يجب أن يكون مطلقًا.');
  let directory;
  try { directory = fs.realpathSync(path.dirname(reportPath)); } catch { fail('مجلد التقرير غير موجود.'); }
  reportPath = path.join(directory, path.basename(reportPath));
  const existing = fs.lstatSync(reportPath, {throwIfNoEntry: false});
  if (existing && !existing.isFile()) fail('مسار التقرير ليس ملفًا عاديًا.');
  for (let current = directory; ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) fail('اختر ملف تقرير خارج Git.');
    if (path.dirname(current) === current) break;
  }
}
let pack;
try { pack = loadCaseContent(path.resolve(values.content)); }
catch { fail('تعذّرت قراءة حزمة القصة. يلزم مسار مطلق لملف صالح خارج Git.'); }

const report = checkCasePack(pack, {maxStates});
console.log(JSON.stringify(summarizeCheck(report), null, 1));
if (reportPath) {
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 1) + '\n', {mode: 0o600});
  fs.chmodSync(reportPath, 0o600);
  console.log('التقرير الخاص: ' + reportPath);
} else if (!report.ok) console.log('لمعرفة المشاهد والاختيارات المعنية أعد التشغيل مع --report خارج Git.');
if (!report.exhaustive) console.log('لم يكتمل الفحص ضمن الحد. ارفع --max-states؛ غياب المشكلات هنا ليس نتيجة.');
process.exit(report.ok ? 0 : 1);
