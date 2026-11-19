// Presentation acceptance tests against the actual opening, without a provider.
// node --test tests/visual-opening-browser.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const RESULTS=process.env.RAVEN_VISUAL_QA_DIR;
const frozenScripts=['a5ff6904b872ea28a463d72e73d9ccc9a5dd3c646c8092f587f22bdff168f2cd','4706a6c7a49e6f8432f2b7078addb1c0fd85453c977d2a68d06a8b5b78f4ed49'];
const activeFiles=['raven/deleted-name/content.html','raven/deleted-name/opening-visual.js','raven/deleted-name/opening-visual.css','raven/deleted-name/opening-artwork.js','raven/deleted-name/reading-tools.js','raven/deleted-name/case-entry.js'];
const fingerprint=()=>Object.fromEntries(activeFiles.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex')]));
const readState=page=>page.locator('#hook').evaluate(hook=>({phase:hook.dataset.phase,choice:hook.dataset.choice,recipient:hook.dataset.recipient,share:hook.dataset.share,layers:JSON.parse(hook.dataset.layers),comparison:document.querySelector('#hook-comparison')?.hidden??null,notes:JSON.parse(document.querySelector('#reading-tools').dataset.notes).entries.map(({id,sourceId,kind,text})=>({id,sourceId,kind,text})),noteDraft:document.querySelector('#reading-note').value}));
const overflows=page=>page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));

test('visual opening keeps the approved script, readable cards and local choice boundaries',async t=>{
 const html=fs.readFileSync(path.join(ROOT,activeFiles[0]),'utf8');
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>crypto.createHash('sha256').update(m[1]).digest('hex'));
 assert.deepEqual(scripts,frozenScripts,'merged navigation translations match the inspected incoming source; the scene engine remains unchanged');
 const before=fingerprint(),results=[];
 const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://fixture').pathname);}catch{res.writeHead(400);return res.end();}
  if(pathname.startsWith('/api/')){res.writeHead(404,{'Content-Type':'application/json'});return res.end('{"error":"static_fixture_no_case_server"}');}
  if(pathname.endsWith('/'))pathname+='index.html';
  const file=path.resolve(ROOT,'.'+pathname);
  if(!file.startsWith(ROOT+path.sep)||pathname.split('/').some(x=>x.startsWith('.'))||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');
  if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));if(RESULTS){fs.mkdirSync(RESULTS,{recursive:true});fs.writeFileSync(path.join(RESULTS,'visual-opening-results.json'),JSON.stringify({mode:'actual local Chromium; external resources blocked',baseRevision:'07ba37b586d2eac5ebf151c2a7d32930c68cef92',before,after:fingerprint(),filesStable:JSON.stringify(before)===JSON.stringify(fingerprint()),results},null,2)+'\n');}});
 for(const width of [320,390,768,1440])for(const lang of ['ar','en'])await t.test(width+'px '+lang+': cards, focus, comparison, draft and translation',async()=>{
  const context=await browser.newContext({viewport:{width,height:width<768?844:1000},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],writes=[],external=[];
  page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(()=>{window.__visualWrites=[];for(const method of ['setItem','removeItem','clear']){const fn=Storage.prototype[method];Storage.prototype[method]=function(...args){window.__visualWrites.push({method,args});return fn.apply(this,args);};}});
  await context.route('**/*',route=>{const req=route.request();if(!['GET','HEAD'].includes(req.method()))writes.push(req.url());if(new URL(req.url()).origin!==base){external.push({type:req.resourceType(),host:new URL(req.url()).host});return route.abort();}return route.continue();});
  const record={width,lang,status:'RUNNING',errors,writes,externalBlocked:external};results.push(record);
  try{
   await page.goto(base+'/raven/deleted-name/content.html?lang='+lang,{waitUntil:'domcontentloaded'});
   await page.locator('#opening-card-dialog').waitFor({state:'attached'});
   assert.equal(await page.locator('html').getAttribute('dir'),lang==='ar'?'rtl':'ltr');
   assert.equal(await page.locator('#optional-cast').evaluate(x=>x.open),false);
   assert.equal(await page.locator('#optional-rules').evaluate(x=>x.open),false);
   assert.equal(await page.locator('#hook').evaluate(x=>Boolean(x.compareDocumentPosition(document.querySelector('#optional-cast'))&Node.DOCUMENT_POSITION_FOLLOWING)),true,'the opening precedes optional reference cards');
   const layout=await overflows(page);assert.ok(layout.document<=layout.viewport+1,JSON.stringify(layout));
   const entry=page.locator('.opening-entry-card .opening-main-action');assert.ok((await entry.boundingBox()).height>=44);
   if(RESULTS&&[390,1440].includes(width)){fs.mkdirSync(RESULTS,{recursive:true});await page.screenshot({path:path.join(RESULTS,'after-direct-'+lang+'-'+width+'.png'),fullPage:true});}
   const initial=await readState(page),initialWrites=await page.evaluate(()=>window.__visualWrites);
   await page.locator('#optional-cast>summary').click();
   assert.equal(await page.locator('[data-character="noah"]').isVisible(),false,'Noah is not present in the opening');
   assert.equal(await page.locator('[data-visual-open="noah"]').count(),0);
   const claire=page.locator('[data-visual-open="claire"]');await claire.scrollIntoViewIfNeeded();await claire.focus();
   const scroll=await page.evaluate(()=>scrollY);await page.keyboard.press('Enter');
   assert.equal(await page.locator('#opening-card-dialog').evaluate(x=>x.open),true);
   assert.equal(await page.locator('#opening-card-title').innerText(),lang==='ar'?'كلير':'Claire');
   assert.equal(await page.locator('.card-dialog-body>p').innerText(),await page.locator('[data-character="claire"] dd').innerText());
   assert.equal(await page.evaluate(()=>document.activeElement.id),'opening-card-title');
   await page.keyboard.press('Escape');
   assert.equal(await claire.evaluate(x=>document.activeElement===x),true);
   assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scroll)<=2,'closing the card restores its reading position');
   assert.deepEqual(await readState(page),initial);assert.deepEqual(await page.evaluate(()=>window.__visualWrites),initialWrites);
   await page.locator('#optional-cast>summary').click();
   await page.locator('[data-hook-action="open"]').click();assert.equal(await page.locator('#hook').getAttribute('data-phase'),'invite');
   await page.locator('[data-hook-action="enter"]').click();assert.equal(await page.locator('#hook').getAttribute('data-phase'),'compare');
   const documentText=await page.locator('#hook-document>dl').innerText();
   const paper=page.locator('[data-visual-open="paper"]');await paper.scrollIntoViewIfNeeded();await paper.focus();
   const paperScroll=await page.evaluate(()=>scrollY),beforeRead=await readState(page);await page.keyboard.press('Enter');
   assert.equal(await page.locator('.card-dialog-body dl').innerText(),documentText,'reading dialog must show the exact acquired source');
   assert.equal(await page.locator('.card-dialog-body textarea,.card-dialog-body input').count(),0);
   assert.deepEqual(await readState(page),beforeRead);
   if(RESULTS&&[390,1440].includes(width))await page.screenshot({path:path.join(RESULTS,'after-paper-dialog-'+lang+'-'+width+'.png')});
   await page.keyboard.press('Escape');assert.equal(await paper.evaluate(x=>document.activeElement===x),true);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-paperScroll)<=2);
   await page.locator('[data-hook-action="compare-toggle"]').click();
   if(!await page.locator('#reading-details').evaluate(x=>x.open))await page.locator('#reading-summary').click();
   await page.locator('#reading-source').selectOption('document-original');await page.locator('#reading-note').fill('PRIVATE-SAVED-FIXTURE');await page.locator('#reading-add').click();await page.locator('#reading-note').fill('PRIVATE-UNSAVED-FIXTURE');
   const beforeFocus=await readState(page);await page.locator('[data-visual-focus]').scrollIntoViewIfNeeded();const beforeFocusScroll=await page.evaluate(()=>scrollY);await page.locator('[data-visual-focus]').click();
   assert.equal(await page.locator('body').evaluate(x=>x.classList.contains('paper-focus')),true);assert.equal(await page.locator('#paper-focus-exit').isVisible(),true);
   assert.equal(await page.locator('#assignment-stage').isVisible(),false);assert.equal(await page.locator('#hook-comparison').isVisible(),true);
   const focusedTop=await page.locator('#hook-document h3').boundingBox();assert.ok(focusedTop.y>=-1&&focusedTop.y<300,'entering paper focus reveals the paper heading, not just its sticky exit button');
   assert.deepEqual(await readState(page),beforeFocus);const focusedLayout=await overflows(page);assert.ok(focusedLayout.document<=focusedLayout.viewport+1);
   if(RESULTS&&[390,1440].includes(width))await page.screenshot({path:path.join(RESULTS,'after-focus-'+lang+'-'+width+'.png')});
   await page.keyboard.press('Escape');assert.equal(await page.locator('body').evaluate(x=>x.classList.contains('paper-focus')),false);assert.equal(await page.locator('[data-visual-focus]').evaluate(x=>document.activeElement===x),true);assert.deepEqual(await readState(page),beforeFocus);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-beforeFocusScroll)<=2,'leaving paper focus restores the place where it was opened');
   await page.locator('#lang-switch').click();assert.deepEqual(await readState(page),beforeFocus);await page.locator('#lang-switch').click();assert.deepEqual(await readState(page),beforeFocus);
   await page.locator('[data-hook-action="continue"]').click();await page.locator('[data-hook-action="precise"]').click();await page.locator('[data-hook-action="recipient-draft"]').click();
   assert.equal(await page.locator('#hook').getAttribute('data-phase'),'review');assert.equal(await page.locator('#opening-sharing-guide').isVisible(),true);assert.equal((await readState(page)).layers.sceneShared,null);
   assert.equal(await page.locator('#hook-share-review [data-part="correction"]').innerText(),await page.locator('#hook-draft>p').first().innerText());
   const beforeLanguage=await readState(page);await page.locator('#lang-switch').click();assert.deepEqual(await readState(page),beforeLanguage);await page.locator('#lang-switch').click();
   assert.deepEqual(writes,[],'visual controls must not send game writes or provider calls');assert.deepEqual(errors,[]);
   const allowedWrites=await page.evaluate(()=>window.__visualWrites);assert.ok(allowedWrites.every(x=>x.method==='setItem'&&x.args[0]==='raven_language'),'visual controls must not persist or transmit notes');
   record.status='PASS';record.finalState=await readState(page);record.geometry=layout;
  }catch(error){record.status='FAIL';record.failure=error.message;throw error;}finally{await context.close();}
 });
 assert.deepEqual(fingerprint(),before,'source assets must not change during acceptance run');
});
