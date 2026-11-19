const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),OUT=process.env.RAVEN_READING_QA_DIR,KEY='raven_opening_readability_v1';
const files=['content.html','opening-visual.js','opening-visual.css','reading-tools.js','reading-continuity.js'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'raven/deleted-name',f))).digest('hex')]));
const settle=p=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const state=p=>p.evaluate(()=>({phase:document.querySelector('#hook').dataset.phase,layers:document.querySelector('#hook').dataset.layers,comparison:document.querySelector('#hook-comparison')?.hidden,source:document.querySelector('#reading-source').value,draft:document.querySelector('#reading-note').value,notes:JSON.parse(document.querySelector('#reading-tools').dataset.notes).entries.map(({id,sourceId,kind,text})=>({id,sourceId,kind,text})),selected:document.querySelector('[data-reading-selected="true"]')?.dataset.hookAction}));

test('reading comfort changes display only and reports preference storage honestly',async t=>{
 const before=hashes(),results=[];
 const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://fixture').pathname);}catch{res.writeHead(400);return res.end();}
  if(pathname.endsWith('/'))pathname+='index.html';const file=path.resolve(ROOT,'.'+pathname);
  if(!file.startsWith(ROOT+path.sep)||pathname.split('/').some(p=>p.startsWith('.'))||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');
  if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));if(OUT){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'reading-results.json'),JSON.stringify({before,after:hashes(),filesStable:JSON.stringify(before)===JSON.stringify(hashes()),results},null,2)+'\n');}});
 for(const width of [320,390])for(const language of ['ar','en'])for(const blocked of [false,true])await t.test(`${width} ${language} storage ${blocked?'blocked':'available'}`,async()=>{
  const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],writes=[];
  const record={width,language,blocked,status:'RUNNING',errors,writes};results.push(record);page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({blocked,key})=>{
   window.__preferenceWrites=[];
   const set=Storage.prototype.setItem,get=Storage.prototype.getItem;
   Storage.prototype.setItem=function(k,v){window.__preferenceWrites.push({key:k,value:v});if(blocked&&k===key)throw new DOMException('Synthetic preference policy','SecurityError');return set.call(this,k,v);};
   Storage.prototype.getItem=function(k){if(blocked&&k===key)throw new DOMException('Synthetic preference policy','SecurityError');return get.call(this,k);};
  },{blocked,key:KEY});
  await context.route('**/*',route=>{if(!['GET','HEAD'].includes(route.request().method()))writes.push(route.request().url());return new URL(route.request().url()).origin===base?route.continue():route.abort();});
  const openSettings=async()=>{if(!await page.locator('#opening-reading-settings').evaluate(n=>n.open))await page.locator('#opening-reading-summary').click();};
  try{
   await page.goto(base+'/raven/deleted-name/content.html?lang='+language,{waitUntil:'domcontentloaded'});
   await page.locator('#opening-reading-settings').waitFor({state:'attached'});
   assert.equal(await page.locator('#opening-reading-settings').count(),1,'reuse one existing card dialog, not a second reader');
   await page.locator('[data-hook-action="open"]').click();await page.locator('[data-hook-action="enter"]').click();await page.locator('[data-hook-action="compare-toggle"]').click();
   await page.locator('[data-hook-action="source-original"]').click();await page.locator('#reading-note').fill('PRIVATE-SAVED');await page.locator('#reading-add').click();await page.locator('#reading-note').fill('PRIVATE-UNSAVED');await page.locator('[data-hook-action="source-conclusion"]').click();
   const expected=await state(page),opener=page.locator('[data-visual-open="paper"]');await opener.scrollIntoViewIfNeeded();const openerTop=(await opener.boundingBox()).y;
   const originalText=await page.locator('#hook-document > dl').innerText();await opener.click();await openSettings();
   const oldSize=await page.locator('.card-dialog-body dd').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize));
   await page.locator('.card-dialog-body > dl').evaluate(n=>{window.__originalReadingNode=n;});
   await page.locator('#opening-reading-size').focus();await page.keyboard.press('End');await page.keyboard.press('Enter');
   assert.equal(await page.locator('#opening-reading-size').inputValue(),'largest');
   await page.locator('#opening-reading-night').focus();await page.keyboard.press('Space');
   assert.equal(await page.locator('#opening-reading-night').isChecked(),true);assert.equal(await page.locator('body').getAttribute('data-reading-night'),'true');
   assert.equal(await page.locator('.card-dialog-body > dl').evaluate(n=>n===window.__originalReadingNode),true,'display changes retain the readable document node');
   assert.equal(await page.locator('.card-dialog-body > dl').innerText(),originalText);assert.deepEqual(await state(page),expected);
   const display=await page.locator('.card-dialog-body > dl').evaluate(n=>({background:getComputedStyle(n).backgroundColor,color:getComputedStyle(n).color,size:parseFloat(getComputedStyle(n.querySelector('dd')).fontSize),width:n.scrollWidth,clientWidth:n.clientWidth,animation:getComputedStyle(n).animationName,transition:getComputedStyle(n).transitionDuration}));
   assert.ok(display.size>oldSize);assert.equal(display.size,24);assert.equal(display.background,'rgb(24, 26, 25)');assert.ok(display.width<=display.clientWidth+1);assert.equal(display.animation,'none');assert.equal(display.transition,'0s');
   const status=await page.locator('#opening-reading-status').innerText();assert.match(status,blocked?(language==='ar'?/تعذر/:/could not be saved/):(language==='ar'?/حُفظت/:/saved in this browser/));
   const preferenceWrites=await page.evaluate(key=>window.__preferenceWrites.filter(w=>w.key===key),KEY);
   assert.ok(preferenceWrites.length>=2);for(const write of preferenceWrites){const p=JSON.parse(write.value);assert.deepEqual(Object.keys(p).sort(),['night','size','version']);assert.equal(p.version,1);}
   await page.locator('#opening-reading-reset').focus();await page.keyboard.press('Tab');assert.equal(await page.locator('.card-dialog-close').evaluate(n=>document.activeElement===n),true);await page.keyboard.press('Shift+Tab');assert.equal(await page.locator('#opening-reading-reset').evaluate(n=>document.activeElement===n),true);
   if(OUT){fs.mkdirSync(OUT,{recursive:true});await page.screenshot({path:path.join(OUT,`night-${language}-${width}-${blocked?'temporary':'saved'}.png`)});}
   await page.keyboard.press('Escape');await settle(page);assert.equal(await opener.evaluate(n=>document.activeElement===n),true);assert.ok(Math.abs((await opener.boundingBox()).y-openerTop)<=2,'resized reading returns to the same opener position');
   await page.locator('#lang-switch').click();await settle(page);assert.deepEqual(await state(page),expected);assert.equal(await page.locator('body').getAttribute('data-reading-size'),'largest');
   await page.locator('#lang-switch').click();await settle(page);assert.deepEqual(await state(page),expected);
   await page.locator('[data-visual-focus]').scrollIntoViewIfNeeded();const focusTop=(await page.locator('[data-visual-focus]').boundingBox()).y;await page.locator('[data-visual-focus]').click();
   await page.locator('[data-visual-open="paper"]').click();await openSettings();await page.locator('#opening-reading-size').selectOption('large');await page.keyboard.press('Escape');await settle(page);
   assert.equal(await page.locator('body').evaluate(n=>n.classList.contains('paper-focus')),true);assert.deepEqual(await state(page),expected);
   await page.locator('#paper-focus-exit').click();await settle(page);assert.ok(Math.abs((await page.locator('[data-visual-focus]').boundingBox()).y-focusTop)<=2,'leaving focus mode keeps the original reading position after size changes');
   const allowedWrites=await page.evaluate(()=>window.__preferenceWrites);assert.ok(allowedWrites.every(w=>[KEY,'raven_language'].includes(w.key)),'only display preferences and existing language preference are written');
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('#opening-reading-settings').waitFor({state:'attached'});
   assert.equal(await page.locator('body').getAttribute('data-reading-size'),blocked?'standard':'large');assert.equal(await page.locator('body').getAttribute('data-reading-night'),blocked?'false':'true');
   assert.equal((await state(page)).phase,'start');assert.deepEqual((await state(page)).notes,[]);assert.equal((await state(page)).draft,'');
   await page.locator('#task-message-preview').click();await openSettings();const restored=await page.locator('#opening-reading-status').innerText();assert.match(restored,blocked?(language==='ar'?/تعذر/:/could not be saved/):(language==='ar'?/المحفوظة/:/restored/));
   await page.locator('#opening-reading-reset').click();assert.equal(await page.locator('body').getAttribute('data-reading-size'),'standard');assert.equal(await page.locator('body').getAttribute('data-reading-night'),'false');assert.equal(await page.locator('#opening-reading-reset').evaluate(n=>document.activeElement===n),true);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);assert.equal(overflow,true);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
   record.status='PASS';record.display=display;record.preferenceStatus=status;record.restoredStatus=restored;
  }catch(error){record.status='FAIL';record.failure=error.message;throw error;}finally{await context.close();}
 });
 await t.test('invalid stored values do not become CSS or game state',async()=>{
  const context=await browser.newContext(),page=await context.newPage();await context.addInitScript(key=>localStorage.setItem(key,JSON.stringify({version:1,size:'999999px',night:'true',notes:'not a preference'})),KEY);
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  try{await page.goto(base+'/raven/deleted-name/content.html',{waitUntil:'domcontentloaded'});await page.locator('#opening-reading-settings').waitFor({state:'attached'});assert.equal(await page.locator('body').getAttribute('data-reading-size'),'standard');assert.equal(await page.locator('body').getAttribute('data-reading-night'),'false');assert.equal((await state(page)).phase,'start');assert.deepEqual((await state(page)).notes,[]);}finally{await context.close();}
 });
 assert.deepEqual(hashes(),before,'opening files remain fixed during the check');
});
