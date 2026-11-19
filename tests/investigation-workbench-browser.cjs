const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const L=(ar,en)=>({ar,en});
const boardKey=(tag='fixture-session',version='lab-fixture-v1',caseId='lab-fixture')=>'raven.investigation.board.v1.'+encodeURIComponent(JSON.stringify([caseId,version,tag]));
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
  const api=fixture();if(options.noTag)delete api.state.checkpointInfo;if(options.configure)options.configure(api.state);
  await new Promise(r=>api.server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+api.server.address().port,context=await browser.newContext({viewport:{width:options.width||390,height:900},reducedMotion:'reduce'});
  if(options.init)await context.addInitScript(options.init,{key:boardKey()});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{await page.goto(base+'/raven/investigation-lab/content.html'+(options.lang==='en'?'?lang=en':''));await page.locator('#lab-workbench:not([hidden])').waitFor();await run({api,base,context,page});assert.deepEqual(errors,[]);assert.equal(api.requests.some(r=>r.method!=='GET'),false,'workbench cannot mutate case state or call a provider');}
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
   const body=page.locator('#lab-inspector-body');
   const initial=await body.evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),color:getComputedStyle(el).color,text:el.textContent}));
   await page.locator('#lab-zoom').fill('180');assert.equal(await page.locator('#lab-zoom-value').innerText(),'180%');
   await page.click('#lab-scan');assert.equal(await page.locator('#lab-scan').getAttribute('aria-pressed'),'true');
   assert.equal(await page.locator('#lab-inspector').evaluate(x=>x.classList.contains('lab-pulse')),false,'reduced motion disables pulse');
   const enlarged=await body.evaluate(el=>({size:parseFloat(getComputedStyle(el).fontSize),color:getComputedStyle(el).color,text:el.textContent}));
   assert.ok(enlarged.size>=initial.size*1.79);
   assert.equal(enlarged.text,initial.text);
   assert.notEqual(enlarged.color,initial.color);
   assert.equal(await body.evaluate(el=>el.getAnimations({subtree:true}).length),0);
   assert.equal(await page.locator('#lab-inspector').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
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
  for(const mode of ['disk-file','process-memory']) await t.test(mode+' reading identity scopes private links without checkpoint credentials',()=>check({noTag:true,configure:state=>{state.clientSessionTag='a'.repeat(64);state.persistence=mode;state.saveStatus=mode==='disk-file'?'confirmed':'memory';}},async({page,api})=>{
   assert.equal(await page.locator('#lab-link-add').isDisabled(),false);
   await add(page,'PRIVATE_FIRST_SESSION_LINK');
   const firstKey=boardKey('a'.repeat(64));
   const first=await page.evaluate(key=>localStorage.getItem(key),firstKey);
   assert.match(first,/PRIVATE_FIRST_SESSION_LINK/);
   await page.reload();await page.locator('#lab-workbench:not([hidden])').waitFor();
   assert.equal(await page.locator('.lab-link').count(),1);
   api.state.clientSessionTag='b'.repeat(64);await page.click('#state-refresh');
   await page.waitForFunction(()=>document.querySelectorAll('.lab-link').length===0);
   assert.equal(await page.locator('#lab-link-add').isDisabled(),false);
   await add(page,'PRIVATE_SECOND_SESSION_LINK');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),firstKey),first,'the old scoped copy remains unchanged');
   assert.doesNotMatch(await page.locator('#lab-workbench').innerText(),/PRIVATE_FIRST_SESSION_LINK/);
   // A malformed newer identity cannot silently fall back to an old scope.
   api.state.clientSessionTag='invalid-new-identity';api.state.checkpointInfo={sessionTag:'fixture-session'};
   await page.click('#state-refresh');await page.locator('#lab-link-add:disabled').waitFor();
   assert.equal(await page.locator('.lab-link').count(),0);
   assert.doesNotMatch(await page.locator('#lab-workbench').innerText(),/PRIVATE_FIRST_SESSION_LINK|PRIVATE_SECOND_SESSION_LINK/);
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),firstKey),first);
  }));
  await t.test('case ID, content version and session tag each isolate links and unsaved text',()=>check({},async({page,api})=>{
   const tag=api.state.checkpointInfo.sessionTag,version=api.state.contentVersion,caseId=api.state.caseId;
   await add(page,'ORIGINAL_BOARD_ONLY');
   const original=await page.evaluate(key=>localStorage.getItem(key),boardKey());
   for(const [nextCase,nextVersion,nextTag] of [[caseId+'-other',version,tag],[caseId,version+'-other',tag],[caseId,version,tag+'-other']]){
    await page.fill('#lab-link-note','ORIGINAL_UNSAVED');
    api.state.caseId=nextCase;api.state.contentVersion=nextVersion;api.state.checkpointInfo.sessionTag=nextTag;
    await page.click('#state-refresh');await page.waitForFunction(()=>!document.querySelector('.lab-link'));
    assert.equal(await page.locator('#lab-link-note').inputValue(),'');
    await add(page,'OTHER_BOARD_ONLY');
    assert.match(await page.evaluate(key=>localStorage.getItem(key),boardKey(nextTag,nextVersion,nextCase)),/OTHER_BOARD_ONLY/);
    api.state.caseId=caseId;api.state.contentVersion=version;api.state.checkpointInfo.sessionTag=tag;
    await page.click('#state-refresh');await page.getByText('ORIGINAL_BOARD_ONLY',{exact:true}).waitFor();
    assert.doesNotMatch(await page.locator('#lab-links').innerText(),/OTHER_BOARD_ONLY/);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),boardKey()),original);
   }
  }));
  await t.test('unreadable browser storage is reported honestly and still permits reading',()=>check({lang:'en',init:()=>{
   const get=Storage.prototype.getItem;
   Storage.prototype.getItem=function(key){if(key.startsWith('raven.investigation.board.'))throw new DOMException('fixture unavailable','SecurityError');return get.call(this,key);};
  }},async({page})=>{
   assert.match(await page.locator('#lab-board-status').innerText(),/cannot access browser storage/i);
   assert.equal(await page.locator('#lab-link-add').isDisabled(),true);
   await page.selectOption('#lab-inspect-select','map');await page.click('#lab-inspect-open');
   assert.equal(await page.locator('#lab-inspector-body').innerText(),'Two fictional rooms.');await page.keyboard.press('Escape');
   await page.click('#lab-hint-button');assert.match(await page.locator('#lab-hint-output').innerText(),/Review the available source/);
  }));
  await t.test('only actionable displayed choices can appear in written hints',()=>check({lang:'en'},async({page,api})=>{
   const label=value=>L(value,value);
   api.state.actions.push({id:'unsupported',label:label('Unavailable fixture'),fields:[{id:'x',type:'unknown'}]},
    {id:'case.note',label:label('Private notebook action')},{id:'ask',label:label('Ask a fixture question'),reason:'HIDDEN_REASON'});
   await page.click('#state-refresh');await page.getByRole('button',{name:'Ask a fixture question'}).waitFor();
   for(const expected of ['Review the available source','Ask a fixture question','Review the available source']){
    await page.click('#lab-hint-button');const output=await page.locator('#lab-hint-output').innerText();
    assert.ok(output.includes(expected),output);assert.doesNotMatch(output,/Unavailable fixture|Private notebook action|HIDDEN_REASON/);
   }
   api.state.readOnly=true;await page.click('#state-refresh');
   await page.waitForFunction(()=>document.querySelector('#actions button').disabled);
   await page.click('#lab-hint-button');assert.match(await page.locator('#lab-hint-output').innerText(),/No follow-up/);
  }));
  await t.test('explicit private board download stays separate from case submission and case export',()=>check({lang:'en'},async({page,api})=>{
   const downloads=[],requests=[],marker='PRIVATE_BOARD_EXPORT_ONLY',reported='PUBLIC_FIXTURE_RESPONSE';
   page.on('download',d=>downloads.push(d.suggestedFilename()));
   page.on('request',r=>requests.push([r.method(),r.url(),r.postData()]));
   const reportAction={id:'submit-fixture',label:L('تقرير تجريبي','Fixture report'),fields:[{id:'text',type:'text',label:L('النص','Text'),required:true}]};
   api.state.actions=[reportAction];
   await page.click('#state-refresh');await page.locator('#actions input').waitFor();
   let payload;
   await page.route('**/api/case/actions',async route=>{
    payload=route.request().postDataJSON();api.state.revision++;
    api.state.captures.report={actionId:reportAction.id,label:reportAction.label,revision:api.state.revision,fields:reportAction.fields,values:payload.values};
    await route.fulfill({json:api.state});
   });
   await page.route('**/api/case/export',route=>route.fulfill({json:{caseId:api.state.caseId,captures:api.state.captures}}));
   await add(page,marker);assert.deepEqual(downloads,[]);
   assert.match(await page.locator('#lab-board-export').innerText(),/private/i);
   async function readDownload(selector){
    const started=page.waitForEvent('download');await page.click(selector);
    return JSON.parse(await fs.promises.readFile(await (await started).path(),'utf8'));
   }
   const board=await readDownload('#lab-board-export');assert.equal(board.links[0].note,marker);
   await page.fill('#actions input',reported);await page.click('#actions button[type=submit]');await page.click('#review-confirm');
   await page.locator('#reports-body').getByText(reported,{exact:true}).waitFor();
   assert.deepEqual(payload.values,{text:reported});
   assert.doesNotMatch(await page.locator('#reports-body').innerText(),new RegExp(marker));
   const record=await readDownload('#case-export');assert.equal(record.captures.report.values.text,reported);
   assert.doesNotMatch(JSON.stringify(record),new RegExp(marker));
   assert.doesNotMatch(JSON.stringify(requests),new RegExp(marker));
   assert.deepEqual(downloads,['raven-private-board.json','raven-case-record.json']);
  }));
  await t.test('another tab preserves the board and moves only a lost remove-button focus to recovery',()=>check({},async({page,context,base,api})=>{
   await add(page,'FIRST_PRIVATE_CONNECTION');
   const second=await context.newPage();await second.goto(base+'/raven/investigation-lab/content.html');await second.locator('#lab-workbench:not([hidden])').waitFor();
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
   await second.waitForFunction(()=>document.activeElement.id==='lab-inspect-open');
   const savedFour=await page.evaluate(key=>localStorage.getItem(key),boardKey());
   await page.evaluate(key=>localStorage.setItem(key,'{corrupt-recovery-fixture'),boardKey());
   await second.locator('#lab-board-reload').focus();await second.keyboard.press('Enter');
   assert.equal(await second.locator('#lab-board-reload').evaluate(el=>document.activeElement===el&&!el.hidden),true,'a reload that stays locked retains its recovery focus');
   assert.match(await second.locator('#lab-board-status').innerText(),/أبقيناها دون تغيير/);
   assert.match(await second.locator('#lab-links').innerText(),/FIRST_PRIVATE_CONNECTION/,'a failed reload keeps the current reading available for export');
   assert.equal(await page.evaluate(key=>localStorage.getItem(key),boardKey()),'{corrupt-recovery-fixture');
   await page.evaluate(({key,raw})=>localStorage.setItem(key,JSON.stringify({...JSON.parse(raw),links:[]})),{key:boardKey(),raw:savedFour});
   await second.waitForFunction(()=>document.querySelector('#lab-board-status').textContent.includes('تبويب آخر'));
   await second.keyboard.press('Enter');
   await second.locator('#lab-board-reload').waitFor({state:'hidden'});
   assert.equal(await second.locator('.lab-link').count(),0);
   assert.equal(await second.locator('#lab-link-note').evaluate(el=>document.activeElement===el&&!el.disabled),true,'an empty recovered board focuses the editable note field');
   await second.close();
  }));
 }finally{await browser.close();}
});

test('independent review bridges preserve workbench and belief drafts during busy, language and refresh',async t=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 t.after(()=>browser.close());
 for(const width of [320,390])for(const lang of ['ar','en'])await t.test(width+'px '+lang,async()=>{
  const api=fixture();await new Promise(r=>api.server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+api.server.address().port,context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();
  let release=null;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.reviewBridgeEvents=[];for(const type of ['raven:case-view','raven:belief-view'])document.addEventListener(type,event=>window.reviewBridgeEvents.push({type,hasCase:Boolean(event.detail?.caseId),hasActions:Array.isArray(event.detail?.actions),hasNotes:Array.isArray(event.detail?.notes)}));});
  try{
   await page.goto(base+'/raven/investigation-lab/content.html?lang='+lang);await page.locator('#case-app').waitFor({state:'visible'});await page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false');
   assert.equal(await page.locator('#lab-workbench').isVisible(),true,'a valid case must keep the investigation workbench visible after the controller becomes idle');
   // Exercise both actual components together; this only injects the public
   // belief component into the test page, without changing production markup.
   await page.addScriptTag({url:base+'/raven/deleted-name/play/belief-review.js'});await page.locator('#belief-review>summary').click();
   await page.fill('#belief-before','Fixture belief draft');await page.fill('#belief-after','Revised fixture belief');await page.selectOption('#belief-source','letter');
   await page.selectOption('#lab-link-a','letter');await page.selectOption('#lab-link-b','map');await page.fill('#lab-link-note','KEEP UNSAVED FIXTURE QUESTION');
   const checkDrafts=async()=>{assert.equal(await page.locator('#lab-workbench').isVisible(),true);assert.equal(await page.locator('#lab-link-note').inputValue(),'KEEP UNSAVED FIXTURE QUESTION');assert.equal(await page.locator('#lab-link-a').inputValue(),'letter');assert.equal(await page.locator('#lab-link-b').inputValue(),'map');assert.equal(await page.locator('#belief-before').inputValue(),'Fixture belief draft');assert.equal(await page.locator('#belief-after').inputValue(),'Revised fixture belief');assert.equal(await page.locator('#belief-source').inputValue(),'letter');};
   await page.route('**/api/case/state',async route=>{await new Promise(resolve=>{release=resolve;});await route.continue();});
   await page.locator('#state-refresh').click();await page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='true');await checkDrafts();
   api.state.revision++;assert.ok(release);release();release=null;await page.waitForFunction(()=>document.body.getAttribute('aria-busy')==='false');await page.unroute('**/api/case/state');await checkDrafts();
   const other=lang==='ar'?'en':'ar';await page.click('#language-'+other);await checkDrafts();await page.click('#language-'+lang);await checkDrafts();
   const events=await page.evaluate(()=>window.reviewBridgeEvents.filter(item=>item.hasCase));assert.ok(events.some(item=>item.type==='raven:case-view'));assert.ok(events.some(item=>item.type==='raven:belief-view'));
   assert.ok(events.filter(item=>item.type==='raven:case-view').every(item=>item.hasActions&&!item.hasNotes),'workbench events cannot carry private notebook notes');assert.ok(events.filter(item=>item.type==='raven:belief-view').every(item=>item.hasNotes&&!item.hasActions),'belief events keep their own narrow contract');
   assert.equal(api.requests.some(r=>r.method!=='GET'),false);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   if(process.env.RAVEN_WORKBENCH_ARTIFACTS){await page.locator('#lab-workbench').screenshot({path:path.join(process.env.RAVEN_WORKBENCH_ARTIFACTS,`bridge-after-${lang}-${width}.png`)});}
  }finally{release?.();await context.close();api.server.closeAllConnections?.();await new Promise(r=>api.server.close(r));}
 });
});
