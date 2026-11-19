// Private-reflection component contract tests. Fixtures are invented, not case content.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const OUTPUT=process.env.RAVEN_BELIEF_QA_DIR;
const PREFIX='مراجعة اعتقاد | Belief review';
const files={
 '/belief-review.js':'raven/deleted-name/play/belief-review.js',
 '/belief-review.css':'raven/deleted-name/play/belief-review.css',
 '/style.css':'raven/deleted-name/play/style.css',
};
const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/belief-review.css"><script>
window.fixtureView={caseId:'belief-fixture',contentVersion:'fixture-v1',revision:3,locale:'ar',materials:[{id:'sheet-a',title:{ar:'ورقة اختبار أولى',en:'First fixture sheet'}},{id:'sheet-b',title:{ar:'ورقة اختبار ثانية',en:'Second fixture sheet'}}],notes:[{id:'unrelated',text:'UNRELATED_NOTE_DO_NOT_COPY',sourceId:'sheet-a'}],locked:false,saveStatus:'confirmed',persistence:'disk-file',checkpointSaved:false,hiddenAuthorData:'LOCKED_AUTHOR_SENTINEL'};
window.fixturePrepared=[];window.fixtureReason=null;window.fixturePending=null;
window.fixturePublish=function(change){Object.assign(window.fixtureView,change||{});document.documentElement.lang=fixtureView.locale;document.documentElement.dir=fixtureView.locale==='ar'?'rtl':'ltr';document.dispatchEvent(new CustomEvent('raven:case-view',{detail:structuredClone(fixtureView)}));};
window.RavenBeliefReview={getView:()=>structuredClone(fixtureView),prepareNote:function(data){fixturePrepared.push(structuredClone(data));if(fixtureReason)return {ok:false,reason:fixtureReason};fixturePending=structuredClone(data);document.getElementById('fixture-preview').hidden=false;document.getElementById('fixture-preview-text').textContent=data.text;document.getElementById('fixture-confirm').focus();return {ok:true};}};
window.fixtureConfirm=function(){const p=fixturePending;if(!p)return;fixturePending=null;fixtureView.revision++;fixtureView.notes.push({id:'note-'+fixtureView.revision,text:p.text,sourceId:p.sourceId});document.getElementById('fixture-preview').hidden=true;fixturePublish();};
</script><script src="/belief-review.js" defer></script></head><body><main class="wrap"><div id="case-app"><section id="materials-list"><details id="material-sheet-a" tabindex="-1"><summary>First source</summary><p>Fictional source A. No actual case content.</p></details><details id="material-sheet-b" tabindex="-1"><summary>Second source</summary><p>Fictional source B.</p></details></section><details id="notebook"><summary>Existing notebook</summary><div id="notebook-actions"><textarea aria-label="Existing note draft" id="existing-draft"></textarea></div></details><section id="fixture-preview" hidden><pre id="fixture-preview-text"></pre><button id="fixture-confirm" onclick="fixtureConfirm()">Confirm fixture note</button></section></div></main></body></html>`;

test('belief editor uses existing note preview and preserves append-only private history',async t=>{
 const requests=[],results=[];
 const server=http.createServer((req,res)=>{
  requests.push({method:req.method,path:req.url});
  if(req.method!=='GET'){res.writeHead(405);return res.end();}
  if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(html);}
  const file=files[req.url];if(!file){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':req.url.endsWith('.css')?'text/css':'text/javascript'});res.end(fs.readFileSync(path.join(ROOT,file)));
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));if(OUTPUT){fs.mkdirSync(OUTPUT,{recursive:true});fs.writeFileSync(path.join(OUTPUT,'belief-results.json'),JSON.stringify({scope:'Synthetic bridge contract; not a full private-case run',requests,results},null,2));}});
 const url='http://127.0.0.1:'+server.address().port;
 for(const width of [320,390,768,1440])for(const lang of ['ar','en'])await t.test(lang+' '+width,async()=>{
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<=390,reducedMotion:width===320?'reduce':'no-preference'});const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.evaluate(lang=>fixturePublish({locale:lang}),lang);
  await page.locator('#belief-review>summary').click();
  assert.equal(await page.locator('#belief-source option').count(),3);
  assert.equal(await page.locator('#belief-review').innerText().then(x=>x.includes('LOCKED_AUTHOR_SENTINEL')||x.includes('UNRELATED_NOTE_DO_NOT_COPY')),false);
  const before='OLD BELIEF <img src=x onerror=window.bad=true>',after='NEW READING based on a source';
  await page.locator('#belief-before').fill(before);await page.locator('#belief-after').fill(after);
  await page.locator('#belief-source').evaluate(select=>{select.append(new Option('Forbidden source','locked-source'));select.value='locked-source';});await page.locator('#belief-add').click();
  assert.equal(await page.evaluate(()=>fixturePrepared.length),0,'an unearned material cannot open the save preview');
  await page.evaluate(()=>fixturePublish());await page.locator('#belief-source').selectOption('sheet-a');
  await page.locator('#belief-add').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>fixtureView.notes.length),1,'preparing never appends a note');
  assert.equal(await page.locator('#belief-before').inputValue(),before,'draft remains during preview');
  const prepared=await page.evaluate(()=>structuredClone(fixturePrepared[0]));assert.equal(prepared.sourceId,'sheet-a');assert.equal(prepared.returnFocus,'belief-add');assert.ok(prepared.text.startsWith(PREFIX+'\n'));assert.ok(prepared.text.includes(before));assert.ok(prepared.text.includes(after));
  await page.locator('#fixture-confirm').click();assert.equal(await page.locator('#belief-before').inputValue(),'');
  const original=await page.evaluate(()=>structuredClone(fixtureView.notes[1]));
  await page.locator('#belief-history details>summary').click();assert.equal(await page.locator('.belief-record-text').innerText(),original.text);
  assert.equal(await page.evaluate(()=>window.bad===true),false);assert.equal(await page.locator('.belief-record img').count(),0);
  await page.locator('[data-belief-source="sheet-a"]').click();assert.equal(await page.locator('#material-sheet-a').evaluate(el=>el.open),true);assert.equal(await page.locator('#material-sheet-a').evaluate(el=>document.activeElement===el),true);
  await page.locator('[data-belief-revise]').click();assert.equal(await page.locator('#belief-previous-text').innerText(),original.text);
  await page.locator('#belief-before').fill('I now revisit the first reading');await page.locator('#belief-after').fill('Another reading, still my own');await page.locator('#belief-source').selectOption('sheet-b');
  await page.locator('#belief-after').evaluate(el=>{el.focus();el.setSelectionRange(3,13);});
  const draft=await page.locator('#belief-after').inputValue();await page.evaluate(()=>fixturePublish({locale:fixtureView.locale==='ar'?'en':'ar'}));
  assert.equal(await page.locator('#belief-after').inputValue(),draft);assert.deepEqual(await page.locator('#belief-after').evaluate(el=>[el.selectionStart,el.selectionEnd]),[3,13]);assert.equal(await page.locator('#belief-source').inputValue(),'sheet-b');
  await page.evaluate(lang=>fixturePublish({locale:lang}),lang);await page.locator('#belief-add').click();
  assert.equal(await page.evaluate(()=>fixtureView.notes.length),2);const second=await page.evaluate(()=>structuredClone(fixturePending));assert.ok(second.text.includes(original.id));
  await page.locator('#fixture-confirm').click();assert.equal(await page.evaluate(()=>fixtureView.notes.length),3);assert.deepEqual(await page.evaluate(()=>fixtureView.notes[1]),original,'the earlier reflection is not overwritten');
  for(const item of await page.locator('#belief-history details').all())await item.evaluate(el=>el.open=true);
  assert.equal(await page.locator('.belief-record-text').nth(1).innerText(),second.text);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  if(OUTPUT){fs.mkdirSync(OUTPUT,{recursive:true});await page.locator('#belief-review').screenshot({path:path.join(OUTPUT,'belief-'+lang+'-'+width+'.png')});}
  assert.deepEqual(errors,[]);results.push({lang,width,status:'PASS',appendCount:2,sourceGuard:true,draftPreserved:true,verbatim:true});await context.close();
 });
 await t.test('existing draft, locked saving and unconfirmed checkpoint retain the reflection fields',async()=>{
  const page=await browser.newPage({viewport:{width:390,height:900}});await page.goto(url);await page.locator('#belief-review>summary').click();
  await page.locator('#belief-before').fill('Earlier thought');await page.locator('#belief-after').fill('Revised thought');await page.locator('#belief-source').selectOption('sheet-a');
  await page.locator('#notebook>summary').click();await page.locator('#existing-draft').fill('KEEP THE EXISTING NOTE DRAFT');await page.evaluate(()=>fixtureReason='draft-exists');await page.locator('#belief-add').click();
  assert.equal(await page.locator('#belief-notebook-draft').isVisible(),true);assert.equal(await page.locator('#existing-draft').inputValue(),'KEEP THE EXISTING NOTE DRAFT');assert.equal(await page.locator('#belief-before').inputValue(),'Earlier thought');
  await page.evaluate(()=>{fixtureReason=null;fixturePublish({locked:true});});assert.equal(await page.locator('#belief-add').isDisabled(),true);
  await page.evaluate(()=>fixturePublish({locked:false,persistence:'browser-checkpoint',saveStatus:'confirmed',checkpointSaved:false}));await page.locator('#belief-add').click();await page.locator('#fixture-confirm').click();
  assert.equal(await page.locator('#belief-before').inputValue(),'Earlier thought','unconfirmed browser persistence must keep the draft');assert.match(await page.locator('#belief-save-status').innerText(),/لم يُؤكَّد/);
  await page.evaluate(()=>fixturePublish({checkpointSaved:true}));assert.equal(await page.locator('#belief-before').inputValue(),'');assert.match(await page.locator('#belief-save-status').innerText(),/هذا المتصفح/);
  const raw=await page.evaluate(()=>JSON.stringify(fixtureView.notes));await page.evaluate(()=>fixturePublish({persistence:'process-memory',saveStatus:'memory'}));assert.match(await page.locator('#belief-save-status').innerText(),/ذاكرة جلسة الخادم/);assert.equal(await page.evaluate(()=>JSON.stringify(fixtureView.notes)),raw);
  assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);await page.close();results.push({name:'persistence-and-draft-guard',status:'PASS'});
 });
 assert.equal(requests.some(req=>req.method!=='GET'),false,'the component performs no HTTP writes');
});
