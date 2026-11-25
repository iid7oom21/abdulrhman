// Read the published four indexes only. No crawling, executing HTML, or loading
// a visitor's saved work. Run from either checkout using the script on gh-pages.
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {catalog} from '../raven/after-show/workshops.js';
import {activities,extras} from '../raven/late-night/catalog.js';
import {items} from '../raven/late-night/ink/catalog.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>readFile(resolve(root,name),'utf8');
const digest=text=>createHash('sha256').update(text).digest('hex').slice(0,12);
const plain=html=>html.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim();
const group=(...keys)=>new Set(keys);
const types=group('tool','card','game','story','simulation');
const catalogs=group('after-show','after-show-25','late-night','ink');
const states=group('listed','legacy-interactive','redirect');
const ids=(space,keys)=>keys.split(' ').map(key=>space+':'+key);
const optionalSound=group(...ids('after-show','leitmotif sound festival'),...ids('late-night','echo-last-seat city-radio sound-museum nightshift-seat'));
const formats=new Map();
function exportsFor(space,keys,formatsForRoute) {for(const key of ids(space,keys))formats.set(key,formatsForRoute);}
exportsFor('after-show','free duo custom titles',['JSON']);
exportsFor('after-show','card',['PNG']);
exportsFor('late-night','echo-last-seat darkroom-minute weightless-cam tide-harbor fabric-wind dome-sky three-evening weekend',['PNG']);
exportsFor('late-night','memory-lift seven-windows curtain-party sound-museum',['JSON']);
exportsFor('late-night','screening-room',['TXT']);
exportsFor('late-night','my-notebook',['JSON','saved image']);
exportsFor('late-night','nightshift-paper harbour-watch',['PNG']);
exportsFor('ink','ink-camera ink-page',['PNG']);
exportsFor('ink','ink-courier',['PNG','JSON']);

const workshopGames=group('edit','continuity','budget','daily','duo','custom','blocking','wayfinding');
const workshopTools=group('free','brief','titles','subtitles','description','split-screen','film-ink','grade','leitmotif');
const nightExtraTypes={'time-door':'card','three-evening':'story','my-notebook':'tool','festival-chair':'tool','idea-to-studio':'tool','dialogue-preview':'card','episode-ends':'card','behind-frame':'card',weekend:'game','screening-room':'story'};
// Minutes here are reviewer estimates of a single visit, never a shot's length.
const inkMeta={
  'ink-cut':['game',3],'ink-camera':['simulation',3],'ink-ferry':['story',3],'ink-page':['tool',4],
  'ink-beacon':['game',2],'ink-courier':['game',5],'ink-lines':['tool',3],'ink-letters':['tool',3]
};
const legacyMatch={
  '01-last-send':'edit','02-shift':'projection','03-light':'light','04-foley':'sound','05-archive':'archive',
  '06-continuity':'continuity','07-budget':'budget','08-duo':'duo','09-daily':'daily','10-night':'festival',
  '11-brief':'brief','12-tweak':'free','13-board':'edit','14-subs':'projection','15-sound':'projection',
  '16-fast-cut':'edit','17-memory':'continuity','18-rhythm':'sound','19-shadow':'light','20-fx-time':'sound',
  '21-sort':'archive','22-rehearsal':'projection','23-map':'festival','24-curtain':'edit'
};
const legacyTypes=['game','simulation','simulation','simulation','game','game','game','game','game','story','tool','tool','tool','game','game','game','game','game','simulation','simulation','game','game','tool','card','card'];
const bridges={
  'time-door':['raven/late-night/station-shadow.html'],
  'idea-to-studio':['studio/','raven/late-night/director-sentence.html'],
  'episode-ends':['raven/episodes/'],
  'behind-frame':['raven/#behind-paper-phone'],
  'dialogue-preview':['raven/dialogue/'],
  'replay-caller':['raven/late-night/weightless-cam.html']
};
function row(space,key,title,type,minutes,source,path,art=null) {
  const id=space+':'+key;
  return {id,catalog:space,title,type,path,art,languages:Object.keys(title),estimatedMinutes:minutes,
    durationSource:source,exports:formats.get(id)||[],sound:optionalSound.has(id)?'optional':'silent',
    state:space==='after-show-25'?'legacy-interactive':'listed',related:[],links:[]};
}
function afterShow() {
  return Object.entries(catalog).map(([key,[ar,en,,,,,minutes,image]])=>{
    const type=workshopGames.has(key)?'game':workshopTools.has(key)?'tool':key==='card'?'card':
      ['festival','branch-film'].includes(key)?'story':'simulation';
    return row('after-show',key,{ar,en},type,minutes,'workshops.js','raven/after-show/?activity='+key,'raven/after-show/assets/'+image+'.webp');
  });
}
async function legacy() {
  const index=await read('raven/after-show-25/index.html'),rows=[];
  const cards=index.matchAll(/<a\b[^>]*class=["']card["'][^>]*href=["']\.\/([\w-]+)\.html["'][^>]*>\s*<b>([^<]+)<\/b>[\s\S]*?<\/a>/g);
  for(const [,key,label] of cards) {
    const position=Number(key.slice(0,2))-1,path='raven/after-show-25/'+key+'.html';
    const item=row('after-show-25',key,{ar:plain(label).replace(/^\d+\.\s*/,'')},legacyTypes[position],position===0?2:1,'single-round editorial estimate',path);
    if(legacyMatch[key])item.related.push('after-show:'+legacyMatch[key]);
    if(key==='13-board')item.related.push('late-night:idea-to-studio');
    if(key==='25-picker')item.related.push('late-night:festival-chair');
    const source=await read(path);
    const order=source.match(/var ORDER\s*=\s*\[([^\]]+)\]/)?.[1];
    if(order){
      const sequence=[...order.matchAll(/'([\w-]+)'/g)].map(match=>match[1]);
      const current=sequence.indexOf(key);
      if(current<0)throw Error('Missing from own navigation: '+path);
      item.links.push('raven/after-show-25/'+sequence[(current+1)%sequence.length]+'.html');
    }
    rows.push(item);
  }
  const allCards=[...index.matchAll(/<a\b[^>]*class=["']card["']/g)].length;
  if(!allCards||rows.length!==allCards)throw Error('Unrecognised legacy card: inspect after-show-25/index.html');
  return rows;
}
function lateNight(){
  const games=activities.map(([key,ar,en,minutes,section])=>row('late-night',key,{ar,en},
    ['game','simulation',key==='puzzle-owner'?'game':'tool','story'][section],minutes,'late-night/catalog.js',
    'raven/late-night/'+key+'.html','raven/late-night/thumbs/'+key+'.webp'));
  const extra=extras.map(([key,ar,en])=>row('late-night',key,{ar,en},nightExtraTypes[key],null,'variable / unlisted','raven/late-night/'+key+'.html'));
  return [...games,...extra].map(item=>({...item,links:bridges[item.id.split(':')[1]]||[]}));
}
function ink(){
  return items.map(({page,title:[ar,en],cover})=>{
    if(!inkMeta[page])throw Error('Review type and duration for '+page);
    const [type,minutes]=inkMeta[page];
    return row('ink',page,{ar,en},type,minutes,'single-round editorial estimate','raven/late-night/'+page+'.html','raven/late-night/ink/art/'+cover+'.webp');
  });
}
function localFile(reference){
  const base=new URL('https://inventory.invalid/abdulrhman/'),url=new URL(reference,base);
  if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))throw Error('Outside site: '+reference);
  const name=decodeURIComponent(url.pathname.slice(base.pathname.length));
  return name+(name.endsWith('/')?'index.html':'');
}
function duplicates(entries,field){
  const by=new Map();
  for(const entry of entries){const value=entry[field];const ids=by.get(value)||[];ids.push(entry.id);by.set(value,ids);}
  return [...by.entries()].filter(([,ids])=>ids.length>1);
}
function titleKey(name){
  return name.normalize('NFKD').replace(/[\p{M}\p{P}\p{Z}ـ]/gu,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
}
export async function validateInventory(rows) {
  for(const field of ['id','path'])for(const [value] of duplicates(rows,field))throw Error('Duplicate '+field+': '+value);
  const known=new Set(rows.map(row=>row.id));
  await Promise.all(rows.map(async item=>{
    const languages=Object.keys(item.title);
    if(!catalogs.has(item.catalog)||!types.has(item.type)||!item.id.startsWith(item.catalog+':')||!states.has(item.state)||!['optional','silent'].includes(item.sound)||
      !Array.isArray(item.exports)||!languages.includes('ar')||languages.some(lang=>!['ar','en'].includes(lang)||!item.title[lang].trim())||
      item.languages.join()!==languages.join()||!item.durationSource||!(item.estimatedMinutes===null||Number.isFinite(item.estimatedMinutes)&&item.estimatedMinutes>0))
      throw Error('Invalid metadata: '+item.id);
    if(item.catalog==='after-show'&&new URL(item.path,'https://inventory.invalid').searchParams.get('activity')!==item.id.slice(item.catalog.length+1))
      throw Error('After the Show route does not open its activity: '+item.id);
    for(const other of item.related)if(!known.has(other))throw Error('Missing related activity: '+other);
    for(const ref of [item.path,item.art,...item.links].filter(Boolean)){
      const file=localFile(ref);
      try{await access(resolve(root,file));}catch{throw Error('Broken reference for '+item.id+': '+ref);}
    }
  }));
}
export async function inventory() {
  const entries=[...afterShow(),...await legacy(),...lateNight(),...ink()];
  await validateInventory(entries);
  const files=new Map();
  const source=name=>{if(!files.has(name))files.set(name,read(name));return files.get(name);};
  await Promise.all(entries.map(async item=>{
    const html=await source(localFile(item.path));
    // Catch static redirects in the listed entries; never run the target page to discover one.
    const redirect=html.match(/<meta\b[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*?url=([^"']+)["']/i)||
      html.match(/\blocation\.replace\(\s*['"]([^'"]+)['"]\s*\)/);
    if(redirect) {
      const target=new URL(redirect[1],new URL(item.path,'https://inventory.invalid/abdulrhman/'));
      if(target.origin!=='https://inventory.invalid'||!target.pathname.startsWith('/abdulrhman/'))throw Error('External redirect in '+item.id);
      item.state='redirect';item.redirect=target.pathname.slice('/abdulrhman/'.length)+target.search+target.hash;item.links.push(item.redirect);
    }
    item.version=digest(JSON.stringify(item)); // Indexed metadata version, independent of a visitor’s save.
  }));
  await validateInventory(entries);
  const overlaps=[];
  for(const [i,left] of entries.entries())for(const right of entries.slice(i+1)){
    const sameTitle=titleKey(left.title.ar)===titleKey(right.title.ar)||Boolean(left.title.en&&right.title.en&&titleKey(left.title.en)===titleKey(right.title.en));
    const related=left.related.includes(right.id)||right.related.includes(left.id);
    if(sameTitle||related)overlaps.push({left:left.id,right:right.id,reason:sameTitle?'matching title':'related mechanic'});
  }
  return {schemaVersion:1,release:JSON.parse(await read('raven/release.json')).release,entries,overlaps};
}
function markdown({entries,overlaps}){
  const lines=['# جرد تجارب RAVEN','','يقرأ الجرد فهارس «بعد العرض» ومسار الصفحات المستقلة و«آخر الليل» و«ليالي الحبر» من نسخة الموقع. يحتفظ كل مدخل بمعرّفه ومساره. يبيّن الجدول الثاني أين تشترك صفحتان في الاسم أو فكرة اللعب.','','من نسخة `gh-pages`، اطبع الجرد الكامل في صيغة JSON بالأمر `node scripts/workshop-inventory.mjs`. يتضمن عناوين اللغات، والصورة عند توافرها، والصوت، والروابط، ومعرّف مراجعة بيانات كل مدخل وإصدار الموقع. لإعادة إنتاج هذه الصفحة استخدم `node scripts/workshop-inventory.mjs --markdown`. يفحص الأمر `node --test tests/workshop-inventory.mjs` المصادر والروابط.','','الدقائق في الفهرسين الرئيسيين مأخوذة من تقدير المدة في المصدر. أما مدة زيارة ورش الحبر والصفحات المستقلة فتقدير تحريري لجولة واحدة ولم تُقَس مع زوار. الشرطة تعني أن المدة متغيرة أو غير محددة. صيغ الملفات تخص التنزيل من الصفحة نفسها. تُسجّل الموسيقى العامة خارج وصف صوت النشاط.','','| التجربة | المعرّف | مسار الدخول | النوع | الحالة | دقائق | مصدر المدة | اللغة | التنزيل |','| --- | --- | --- | --- | --- | ---: | --- | --- | --- |'];
  for(const r of entries)lines.push('| '+[r.title.ar,r.id,'`'+r.path+'`',r.type,r.state,r.estimatedMinutes??'—',r.durationSource,r.languages.join(', '),r.exports.join(', ')||'—'].join(' | ')+' |');
  lines.push('','## تشابه الاسم أو النشاط','','| المدخل | المدخل الآخر | أساس المقارنة |','| --- | --- | --- |');
  for(const c of overlaps)lines.push('| '+[c.left,c.right,c.reason].join(' | ')+' |');
  return lines.join('\n')+'\n';
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const result=await inventory();
  process.stdout.write(process.argv.includes('--markdown')?markdown(result):JSON.stringify(result,null,2)+'\n');
}
