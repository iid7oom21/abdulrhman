const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const L=(ar,en)=>({ar,en});
const boardKey=(tag='fixture-session',version='lab-fixture-v1')=>'raven.investigation.board.v1.'+encodeURIComponent(JSON.stringify(['lab-fixture',version,tag]));
function fixture(){
  const api={requests:[],state:{caseId:'lab-fixture',contentVersion:'lab-fixture-v1',revision:0,persistence:'process-memory',saveStatus:'memory',checkpointInfo:{sessionTag:'fixture-session'},scene:{id:'desk',title:L('مكتب اختبار خيالي','Fictional test desk'),body:L('نص اختبار فقط.','Test text only.'),lines:[]},materials:[{id:'letter',title:L('خطاب الاختبار','Test letter'),body:L('نص المصدر <img src=x onerror="window.injected=true">','Source text <img src=x onerror="window.injected=true">'),source:L('مكتب خيالي','Fictional desk'),type:'document'},{id:'map',title:L('خريطة الاختبار','Test map'),body:L('غرفتان خياليتان.','Two fictional rooms.'),source:L('ملف الاختبار','Test folder'),type:'map'}],actions:[{id:'follow-up',label:L('راجع المصدر المتاح','Review the available source')}],notes:[],shares:[],receipts:[],captures:{},opening:null}};
  const json=(res,data)=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  api.server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://fixture').pathname;
    if(name.startsWith('/api/')){api.requests.push({method:req.method,path:name});if(name==='/api/case/config')return json(res,{enabled:true,caseId:api.state.caseId,contentVersion:api.state.contentVersion,locales:['ar','en'],defaultLocale:'ar',persistence:'process-memory'});if(name==='/api/case/state')return json(res,api.state);res.writeHead(404);return res.end();}
    const file=path.resolve(ROOT,'.'+(name.endsWith('/')?name+'index.html':name));
    if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
    res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
  });return api;
}
test('review workbench: earned sources, private board, scope, storage and accessible reading',async t=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 async function check(options,run){
  const api=fixture();if(options.noTag)delete api.state.checkpointInfo;
  await new Promise(r=>api.server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+api.server.address().port,context=await browser.newContext({viewport:{width:options.width||390,height:900},reducedMotion:'reduce'});
  if(options.init)await context.addInitScript(options.init,{key:boardKey()});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{await page.goto(base+'/raven/investigation-lab/'+(options.lang==='en'?'?lang=en':''));await page.locator('#lab-workbench:not([hidden])').waitFor();await run({api,base,context,page});assert.deepEqual(errors,[]);assert.equal(api.requests.some(r=>r.method!=='GET'),false,'workbench cannot mutate case state or call a provider');}
  finally{await context.close();await new Promise(r=>api.server.close(r));}
 }
 async function add(page,note='A private hypothesis, not an established fact.'){await page.selectOption('#lab-link-a','letter');await page.selectOption('#lab-link-b','map');await page.fill('#lab-link-note',note);await page.click('#lab-link-add');}
 try{
  for(const width of [320,390,768,1440])for(const lang of ['ar','en'])await t.test(width+'px '+lang+' keyboard inspector, safe text, contrast and overflow',()=>check({width,lang},async({page})=>{
   assert.equal(await page.locator('html').getAttribute('dir'),lang==='ar'?'rtl':'ltr');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   assert.equal(await page.locator('#lab-inspect-select option').count(),3);
   await page.click('#lab-inspect-open');assert.match(await page.locator('#lab-board-status').innerText(),lang==='ar'?/اختر مادة للفحص/:/Choose a material to inspect/);
   await page.selectOption('#lab-inspect-select','letter');await page.locator('#lab-inspect-open').focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('#lab-inspector').evaluate(x=>x.open),true);
   assert.match(await page.locator('#lab-inspector-body').innerText(),/<img/);
   assert.equal(await page.locator('#lab-inspector-body img').count(),0);assert.equal(await page.evaluate(()=>Boolean(window.injected)),false);
   await page.locator('#lab-zoom').fill('180');assert.equal(await page.locator('#lab-zoom-value').innerText(),'180%');
   await page.click('#lab-scan');assert.equal(await page.locator('#lab-scan').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#lab-inspector').evaluate(x=>x.classList.contains('lab-pulse')),false,'reduced motion disables pulse');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   if(process.env.RAVEN_WORKBENCH_ARTIFACTS && width===390 && lang==='ar')await page.screenshot({path:path.join(process.env.RAVEN_WORKBENCH_ARTIFACTS,'workbench-inspector-390.png')});
   await page.keyboard.press('Escape');assert.equal(await page.locator('#lab-inspect-open').evaluate(x=>document.activeElement===x),true);
   await page.click('#lab-hint-button');assert.match(await page.locator('#lab-hint-output').innerText(),lang==='ar'?/راجع المصدر المتاح/:/Review the available source/);
   assert.equal(await page.locator('#lab-link-add').evaluate(x=>x.getBoundingClientRect().height>=44),true);
   if(process.env.RAVEN_WORKBENCH_ARTIFACTS && [390,1440].includes(width) && lang==='ar')await page.screenshot({path:path.join(process.env.RAVEN_WORKBENCH_ARTIFACTS,'workbench-'+width+'.png'),fullPage:true});
  }));
  await t.test('private connection survives reload and language change without becoming story evidence',()=>check({},async({page,api})=>{
   const revision=api.state.revision;await add(page,'<script>window.injected=true</script>');
   assert.match(await page.locator('#lab-board-status').innerText(),/حُفظت/);
   assert.equal(await page.locator('.lab-link').count(),1);assert.equal(await page.locator('.lab-link script').count(),0);
   await page.fill('#lab-link-note','Unsaved question');await page.click('#language-en');assert.equal(await page.locator('#lab-link-note').inputValue(),'Unsaved question');
   assert.match(await page.locator('#lab-board-status').innerText(),/saved in this browser/);assert.match(await page.locator('#case-link').getAttribute('href'),/deleted-name\/play\/\?lang=en/);
   await page.reload();await page.locator('#lab-workbench:not([hidden])').waitFor();assert.equal(await page.locator('.lab-link').count(),1);assert.equal(api.state.revision,revision);assert.deepEqual(api.state.receipts,[]);
   await page.click('.lab-link button');assert.equal(await page.locator('.lab-link').count(),0);
  }));
  await t.test('same source cannot create a connection',()=>check({},async({page})=>{await page.selectOption('#lab-link-a','letter');await page.selectOption('#lab-link-b','letter');await page.fill('#lab-link-note','Question');await page.click('#lab-link-add');assert.equal(await page.locator('.lab-link').count(),0);assert.match(await page.locator('#lab-board-status').innerText(),/مختلفين/);}));
  await t.test('failed or silent storage writes retain the in-page board and never claim saving',()=>check({init:()=>{Storage.prototype.setItem=function(){};}},async({page})=>{await add(page);assert.equal(await page.locator('.lab-link').count(),1);assert.match(await page.locator('#lab-board-status').innerText(),/تعذر تأكيد الحفظ/);assert.equal(await page.evaluate(key=>localStorage.getItem(key),boardKey()),null);}));
  await t.test('corrupt saved data remains untouched and editing is paused',()=>check({init:({key})=>localStorage.setItem(key,'{corrupt')},async({page})=>{assert.equal(await page.locator('#lab-link-add').isDisabled(),true);assert.match(await page.locator('#lab-board-status').innerText(),/أبقيناها دون تغيير/);assert.equal(await page.evaluate(key=>localStorage.getItem(key),boardKey()),'{corrupt');}));
  await t.test('an unidentified session cannot edit or export a board, but can inspect sources and read guidance',()=>check({noTag:true},async({page})=>{
   for(const id of ['lab-link-a','lab-link-b','lab-link-kind','lab-link-note','lab-link-add','lab-board-export'])assert.equal(await page.locator('#'+id).isDisabled(),true,id+' requires a stable session identity');
   assert.match(await page.locator('#lab-board-status').innerText(),/هوية الجلسة/);
   assert.equal(await page.locator('.lab-link').count(),0);
   await page.selectOption('#lab-inspect-select','letter');await page.click('#lab-inspect-open');assert.equal(await page.locator('#lab-inspector').evaluate(x=>x.open),true);await page.keyboard.press('Escape');
   await page.click('#lab-hint-button');assert.match(await page.locator('#lab-hint-output').innerText(),/راجع المصدر المتاح/);
   assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(x=>x.startsWith('raven.investigation.board.')).length),0);
  }));
  await t.test('loss of session identity clears a private board and every unidentified projection clears draft fields',()=>check({},async({page,api})=>{
   await add(page,'PRIVATE_IDENTIFIED_SESSION_NOTE');await page.fill('#lab-link-note','PRIVATE_UNSAVED_DRAFT');
   api.state.revision=5;delete api.state.checkpointInfo;await page.click('#state-refresh');
   await page.locator('#lab-link-note:disabled').waitFor();
   assert.equal(await page.locator('.lab-link').count(),0);assert.equal(await page.locator('#lab-link-note').inputValue(),'');assert.equal(await page.locator('#lab-link-note').isDisabled(),true);
   // Reproduce an old/unknown projection boundary without relying on a revision drop.
   await page.locator('#lab-link-note').evaluate(el=>{el.value='STALE_UNIDENTIFIED_DRAFT';});
   api.state.revision=9;await page.click('#state-refresh');
   await page.waitForFunction(()=>document.getElementById('lab-link-note').value==='');
   assert.equal(await page.locator('#lab-link-note').inputValue(),'');assert.equal(await page.locator('.lab-link').count(),0);assert.equal(await page.locator('#lab-link-add').isDisabled(),true);
   assert.doesNotMatch(await page.locator('#lab-workbench').innerText(),/PRIVATE_IDENTIFIED_SESSION_NOTE|PRIVATE_UNSAVED_DRAFT|STALE_UNIDENTIFIED_DRAFT/);
   assert.match(await page.evaluate(key=>localStorage.getItem(key),boardKey()),/PRIVATE_IDENTIFIED_SESSION_NOTE/,'the correctly scoped saved copy is preserved');
   await page.evaluate(()=>{document.getElementById('lab-link-note').value='PRIVATE_BEFORE_DISCONNECT';document.dispatchEvent(new CustomEvent('raven:case-view',{detail:{locale:'ar',caseId:null}}));});
   assert.equal(await page.locator('#lab-link-note').inputValue(),'');assert.equal(await page.locator('#lab-workbench').isHidden(),true);
  }));
  await t.test('new session and content version isolate boards without deleting old copies',()=>check({},async({page,api})=>{await add(page);const saved=await page.evaluate(key=>localStorage.getItem(key),boardKey());api.state.checkpointInfo.sessionTag='second-session';await page.click('#state-refresh');await page.waitForFunction(()=>document.querySelectorAll('.lab-link').length===0);assert.equal(await page.locator('.lab-link').count(),0);await add(page,'Second session');api.state.contentVersion='lab-fixture-v2';await page.reload();await page.locator('#lab-workbench:not([hidden])').waitFor();assert.equal(await page.locator('.lab-link').count(),0);assert.equal(await page.evaluate(key=>localStorage.getItem(key),boardKey()),saved);}));
  await t.test('another tab preserves the board and moves only a lost remove-button focus to recovery',()=>check({},async({page,context,base,api})=>{
   await add(page,'FIRST_PRIVATE_CONNECTION');
   const second=await context.newPage();await second.goto(base+'/raven/investigation-lab/');await second.locator('#lab-workbench:not([hidden])').waitFor();
   await second.locator('.lab-link button').focus();
   await add(page,'SECOND_PRIVATE_CONNECTION');await second.locator('#lab-link-add:disabled').waitFor();
   assert.match(await second.locator('#lab-board-status').innerText(),/تبويب آخر/);
   assert.equal(await second.locator('#lab-board-reload').evaluate(el=>document.activeElement===el),true,'disabled replacement control hands focus to the visible recovery action');
   assert.equal(await second.locator('.lab-link').count(),1,'a remote update does not remove or silently replace the current reading');
   await second.keyboard.press('Enter');assert.equal(await second.locator('.lab-link').count(),2);assert.equal(await second.locator('#lab-link-add').isDisabled(),false);
   assert.equal(await second.locator('.lab-link button').first().evaluate(el=>document.activeElement===el),true,'keyboard recovery moves from the now-hidden button to a usable connection control');
   await second.fill('#lab-link-note','UNSAVED_PRIVATE_QUESTION');
   await add(page,'THIRD_PRIVATE_CONNECTION');await second.locator('#lab-link-add:disabled').waitFor();
   assert.equal(await second.locator('#lab-link-note').evaluate(el=>document.activeElement===el),true,'conflict must not steal focus from another intact control');
   assert.equal(await second.locator('#lab-link-note').inputValue(),'UNSAVED_PRIVATE_QUESTION');
   await second.locator('#lab-board-reload').evaluate(el=>el.click());
   assert.equal(await second.locator('#lab-link-note').evaluate(el=>document.activeElement===el),true,'programmatic recovery does not steal focus when the recovery button was not focused');
   assert.equal(await second.locator('#lab-link-note').inputValue(),'UNSAVED_PRIVATE_QUESTION');
   await second.selectOption('#lab-inspect-select','letter');await second.click('#lab-inspect-open');await second.locator('#lab-zoom').focus();
   await second.evaluate(()=>{window.workbenchStorageEvents=0;window.addEventListener('storage',()=>window.workbenchStorageEvents++);});
   await add(page,'FOURTH_PRIVATE_CONNECTION');
   await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).links.length===4,boardKey());
   await second.waitForFunction(()=>window.workbenchStorageEvents>0);
   assert.equal(await second.locator('#lab-zoom').evaluate(el=>document.activeElement===el),true,'an open inspector retains its focus');
   assert.equal(await second.locator('#lab-inspector').evaluate(el=>el.open),true);
   assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).links.map(x=>x.note),boardKey()),['FIRST_PRIVATE_CONNECTION','SECOND_PRIVATE_CONNECTION','THIRD_PRIVATE_CONNECTION','FOURTH_PRIVATE_CONNECTION'],'focus recovery does not remove links or overwrite the newer saved board');
   assert.equal(api.state.revision,0);assert.deepEqual(api.state.receipts,[]);
   await second.keyboard.press('Escape');
   const savedFour=await page.evaluate(key=>localStorage.getItem(key),boardKey());
   await page.evaluate(key=>localStorage.setItem(key,'{corrupt-recovery-fixture'),boardKey());
   await second.locator('#lab-board-reload').focus();await second.keyboard.press('Enter');
   assert.equal(await second.locator('#lab-board-reload').evaluate(el=>document.activeElement===el&&!el.hidden),true,'a reload that stays locked retains its recovery focus');
   assert.match(await second.locator('#lab-board-status').innerText(),/أبقيناها دون تغيير/);
   await page.evaluate(({key,raw})=>localStorage.setItem(key,JSON.stringify({...JSON.parse(raw),links:[]})),{key:boardKey(),raw:savedFour});
   await second.keyboard.press('Enter');
   assert.equal(await second.locator('.lab-link').count(),0);
   assert.equal(await second.locator('#lab-link-note').evaluate(el=>document.activeElement===el&&!el.disabled),true,'an empty recovered board focuses the editable note field');
   await second.close();
  }));
 }finally{await browser.close();}
});
