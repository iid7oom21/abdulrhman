// Full case-controller integration with a fictional HTTP fixture. Never reads a case pack.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const OUTPUT=process.env.RAVEN_BELIEF_QA_DIR;
const PREFIX='مراجعة اعتقاد | Belief review';
const VERSION='belief-integration-fixture-v1';
const PLAY='/raven/deleted-name/play/content.html';
const ART='/raven/deleted-name/assets/scenes/belief-fixture.webp';
const local=(en,ar)=>({en,ar});
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture({artwork=false}={}){
 const sources=[{value:'sheet-a',label:local('First fictional sheet','ورقة اختبار أولى')},{value:'sheet-b',label:local('Second fictional sheet','ورقة اختبار ثانية')}];
 const api={requests:[],started:false,mutations:0,artRequests:0,seen:new Map(),state:{
  caseId:'belief-integration-fixture',contentVersion:VERSION,revision:0,saveStatus:'confirmed',persistence:'disk-file',
  scene:{id:'fictional-desk',title:local('Fictional reading desk','مكتب قراءة خيالي'),body:local('A fictional reading surface. No story evidence.','مساحة قراءة خيالية للاختبار. ليست دليلًا في القصة.'),...(artwork?{image:ART,imageRow:0}:{})},
  materials:sources.map((source,index)=>({id:source.value,title:source.label,body:local('Invented test text '+(index+1),'نص خيالي للاختبار '+(index+1)),source:local('Fictional fixture','مصدر اختبار خيالي'),type:'document'})),
  actions:[{id:'fixture-inspect',label:local('Inspect the fictional table','افحص طاولة الاختبار')},{id:'case.note',label:local('Add a private note','إضافة ملاحظة خاصة'),fields:[{id:'text',type:'textarea',label:local('Private note','الملاحظة الخاصة'),required:true,maxLength:2000},{id:'sourceId',type:'select',label:local('Source','المصدر'),required:true,options:sources}]}],
  notes:[],captures:{},shares:[],receipts:[],opening:null,
  forbiddenSentinel:'UNACQUIRED_AUTHOR_FIXTURE_MUST_NOT_APPEAR'
 }};
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 api.server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://fixture.invalid').pathname;
  if(pathname===ART){api.artRequests++;res.writeHead(503,{'Content-Type':'text/plain'});res.end('Fictional image failure');return;}
  if(pathname.startsWith('/api/')){
   let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):null;api.requests.push({method:req.method,path:pathname,body});
   if(pathname==='/api/case/config')return json(res,200,{enabled:true,caseId:api.state.caseId,contentVersion:VERSION,locales:['ar','en'],persistence:'disk-file'});
   if(pathname==='/api/case/state')return json(res,api.started?200:401,api.started?api.state:{error:'no_session'});
   if(pathname==='/api/case/start'&&req.method==='POST'){api.started=true;return json(res,200,api.state);}
   if(pathname==='/api/case/actions'&&req.method==='POST'){
    if(api.seen.has(body.id))return json(res,200,api.seen.get(body.id));
    if(api.state.saveStatus==='unconfirmed')return json(res,503,{error:'storage_unavailable'});
    if(body.revision!==api.state.revision)return json(res,409,{error:'revision_conflict'});
    assert.deepEqual(Object.keys(body).sort(),['actionId','contentVersion','id','revision','values']);
    assert.equal(body.contentVersion,VERSION);api.mutations++;api.state.revision++;
    if(body.actionId==='case.note'){
     assert.deepEqual(Object.keys(body.values).sort(),['sourceId','text']);assert.ok(sources.some(s=>s.value===body.values.sourceId));
     api.state.notes.push({id:'note-'+api.state.revision,text:body.values.text,sourceId:body.values.sourceId});
    }else{assert.equal(body.actionId,'fixture-inspect');api.state.scene.title=local('Fictional table inspected','تم فحص طاولة الاختبار');}
    const saved=clone(api.state);api.seen.set(body.id,saved);return json(res,200,saved);
   }
   return json(res,404,{error:'not_found'});
  }
  const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.woff2':'font/woff2'};res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
 });return api;
}
const posts=api=>api.requests.filter(r=>r.method==='POST'&&r.path==='/api/case/actions');
async function until(condition,message){const end=Date.now()+5000;while(Date.now()<end){if(await condition())return;await new Promise(r=>setTimeout(r,20));}assert.fail(message);}
async function fill(page,before,after,source='sheet-a'){await page.locator('#belief-before').fill(before);await page.locator('#belief-after').fill(after);await page.locator('#belief-source').selectOption(source);}
async function open(page,root,lang){await page.goto(root+PLAY+'?lang='+lang);await page.locator('#case-start').click();await page.locator('#case-app').waitFor({state:'visible'});await page.locator('#belief-review>summary').focus();await page.keyboard.press('Space');await page.locator('#belief-before').waitFor();}
async function overflow(page){const d=await page.evaluate(()=>({viewport:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(d.html<=d.viewport+1&&d.body<=d.viewport+1,JSON.stringify(d));return d;}

test('belief review integrates with the actual case controller, preview and append-only HTTP notes',async t=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const results=[];
 t.after(async()=>{await browser.close();if(OUTPUT){fs.mkdirSync(OUTPUT,{recursive:true});fs.writeFileSync(path.join(OUTPUT,'integration-results.json'),JSON.stringify({scope:'Full app.js + HTTP fiction fixture; no private case pack',results},null,2)+'\n');}});
 for(const width of [320,390])for(const lang of ['ar','en'])for(const failure of [false,true])await t.test(`${lang} ${width} ${failure?'failed image and unconfirmed saving':'normal append and reload'}`,async()=>{
  const api=fixture({artwork:failure});await new Promise(r=>api.server.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+api.server.address().port;
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await open(page,root,lang);assert.equal(await page.locator('html').getAttribute('dir'),lang==='ar'?'rtl':'ltr');
   assert.equal(await page.locator('#belief-source option').count(),3);
   const bridge=await page.evaluate(()=>window.RavenBeliefReview.getView());assert.equal('checkpoint' in bridge,false);assert.equal('flags' in bridge,false);assert.equal('body' in bridge.materials[0],false);assert.equal('forbiddenSentinel' in bridge,false);
   assert.doesNotMatch(await page.locator('#belief-review').innerText(),/UNACQUIRED_AUTHOR_FIXTURE/);
   const before='Belief before — invented fixture',after='Reading after — invented fixture';
   if(!failure){
    await page.locator('form[data-action-id="fixture-inspect"] button').click();await until(()=>api.mutations===1,'ordinary fixture action not confirmed');
    await page.waitForFunction(()=>!document.querySelector('#belief-add').disabled);await fill(page,before,after);
    await page.locator('#belief-add').focus();await page.keyboard.press('Enter');await page.locator('#review-panel').waitFor({state:'visible'});
    assert.equal(posts(api).length,1,'preview must not submit');assert.equal(await page.locator('#belief-before').inputValue(),before);assert.match(await page.locator('#review-body').innerText(),/Belief review/);
    await page.locator('#review-edit').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'belief-add');assert.equal(await page.locator('#belief-before').inputValue(),before);
    await page.locator('#belief-add').click();await page.locator('#review-confirm').click();await until(()=>api.state.notes.length===1,'reflection not saved');await page.waitForFunction(()=>document.getElementById('belief-before').value==='');
    const first=clone(api.state.notes[0]);assert.ok(first.text.startsWith(PREFIX+'\n'));assert.ok(first.text.includes(before)&&first.text.includes(after));assert.equal(first.sourceId,'sheet-a');assert.equal(api.state.shares.length,0);assert.equal(api.state.receipts.length,0);
    const startCount=api.requests.filter(r=>r.path==='/api/case/start').length;await page.reload();await page.locator('#case-app').waitFor({state:'visible'});assert.equal(api.requests.filter(r=>r.path==='/api/case/start').length,startCount);
    await page.locator('#belief-review>summary').click();await page.locator('#belief-history details>summary').click();assert.equal(await page.locator('.belief-record-text').innerText(),first.text);
    await page.locator('[data-belief-revise]').click();assert.equal(await page.locator('#belief-previous-text').innerText(),first.text);assert.equal(await page.evaluate(()=>document.activeElement.id),'belief-before');
    await fill(page,'I revisit the earlier fixture thought','A different source changes my reading','sheet-b');
    const other=lang==='ar'?'en':'ar';await page.locator('#language-'+other).click();assert.equal(await page.locator('#belief-before').inputValue(),'I revisit the earlier fixture thought');assert.equal(await page.locator('#belief-source').inputValue(),'sheet-b');await page.locator('#language-'+lang).click();
    await page.locator('#belief-add').click();assert.equal(api.state.notes.length,1);await page.locator('#review-confirm').click();await until(()=>api.state.notes.length===2,'linked reflection not appended');await page.waitForFunction(()=>document.getElementById('belief-before').value==='');assert.deepEqual(api.state.notes[0],first);assert.ok(api.state.notes[1].text.includes(first.id));assert.equal(api.state.notes[1].sourceId,'sheet-b');
    for(const item of await page.locator('#belief-history details').all())await item.evaluate(el=>el.open=true);assert.equal(await page.locator('.belief-record-text').count(),2);
    const revision=api.state.revision;await page.reload();await page.locator('#case-app').waitFor({state:'visible'});assert.equal(api.state.revision,revision);assert.equal(api.state.notes.length,2);assert.deepEqual(api.state.notes[0],first);await page.locator('#belief-review>summary').click();for(const item of await page.locator('#belief-history details').all())await item.evaluate(el=>el.open=true);
   }else{
    await page.locator('#scene-art .case-art-retry').waitFor({state:'visible'});assert.ok(api.artRequests>0);assert.match(await page.locator('#scene-body').innerText(),lang==='ar'?/خيالية/:/fictional/);
    await fill(page,before,after);await page.locator('#belief-add').click();assert.equal(posts(api).length,0);await page.locator('#review-edit').click();
    await page.locator('#notebook>summary').click();await page.locator('form[data-action-id="case.note"] textarea').fill('PRESERVE EXISTING NOTEBOOK DRAFT');
    await page.locator('#belief-add').click();await page.locator('#belief-notebook-draft').waitFor({state:'visible'});assert.equal(await page.locator('form[data-action-id="case.note"] textarea').inputValue(),'PRESERVE EXISTING NOTEBOOK DRAFT');assert.equal(posts(api).length,0);
    api.state.saveStatus='unconfirmed';await page.locator('#state-refresh').click();await page.waitForFunction(()=>document.querySelector('#belief-add').disabled);assert.equal(await page.locator('#belief-before').inputValue(),before);assert.equal(await page.locator('#belief-after').inputValue(),after);assert.equal(await page.locator('#belief-source').inputValue(),'sheet-a');
    const beforePosts=posts(api).length;await page.locator('#belief-form').evaluate(form=>form.requestSubmit());const rejected=await page.evaluate(()=>window.RavenBeliefReview.prepareNote({text:'UNCONFIRMED MUST NOT SAVE',sourceId:'sheet-a'}));assert.deepEqual(rejected,{ok:false,reason:'locked'});
    const other=lang==='ar'?'en':'ar';await page.locator('#language-'+other).click();await page.locator('#language-'+lang).click();assert.equal(await page.locator('#belief-before').inputValue(),before);assert.equal(await page.locator('form[data-action-id="case.note"] textarea').inputValue(),'PRESERVE EXISTING NOTEBOOK DRAFT');
    await page.locator('#scene-art .case-art-retry').click();await page.locator('#scene-art .case-art-retry').waitFor({state:'visible'});assert.equal(await page.locator('#belief-before').inputValue(),before);assert.equal(posts(api).length,beforePosts);assert.equal(api.state.notes.length,0);assert.equal(await page.locator('#belief-add').isDisabled(),true);
    await page.waitForTimeout(150);assert.equal(posts(api).length,beforePosts,'image retries and unconfirmed state must never auto-post');assert.equal(api.mutations,0);
   }
   const dimensions=await overflow(page);assert.deepEqual(errors,[]);
   if(OUTPUT){fs.mkdirSync(OUTPUT,{recursive:true});await page.locator('#belief-review').screenshot({path:path.join(OUTPUT,`integration-${failure?'failure':'normal'}-${lang}-${width}.png`)});}
   results.push({width,lang,mode:failure?'failed-image-unconfirmed':'append-reload',status:'PASS',mutations:api.mutations,notes:api.state.notes.length,shares:api.state.shares.length,receipts:api.state.receipts.length,dimensions,pageErrors:errors});
  }finally{await context.close();api.server.closeAllConnections?.();await new Promise(r=>api.server.close(r));}
 });
});
