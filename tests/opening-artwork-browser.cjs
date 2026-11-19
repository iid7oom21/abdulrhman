const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');

// Public opening only. Image failures are synthetic; no private case pack or provider.
const ROOT = path.resolve(__dirname, '..');
const COVER = '/raven/deleted-name/assets/scenes/case-scenes-v1.webp';
const NOTEBOOK = '/raven/deleted-name/assets/scenes/investigation-scenes-v1.webp';
const STUDIES = '/raven/deleted-name/assets/scenes/case-tools-v1.webp';
const selectors = {cover:'[data-scene-art="case-cover"]', notebook:'[data-scene-art="private-notebook"]'};
const state = page => page.evaluate(() => {
  const hook=document.getElementById('hook');
  return {phase:hook.dataset.phase,choice:hook.dataset.choice,recipient:hook.dataset.recipient,share:hook.dataset.share,layers:hook.dataset.layers,
    draft:document.getElementById('reading-note').value,source:document.getElementById('reading-source').value,
    notes:JSON.parse(document.getElementById('reading-tools').dataset.notes).entries.map(({id,sourceId,kind,text})=>({id,sourceId,kind,text}))};
});
const art = (page, selector) => page.locator('.dn-artwork').filter({has:page.locator(selector)});
const until = async condition => {
  const deadline = Date.now() + 8000;
  while (!(await condition())) {
    if (Date.now() >= deadline) throw new Error('Expected browser condition was not observed');
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};
const waitState = (view, expected) => until(async () => await view.getAttribute('data-art-state') === expected);
const retryRequests = (requests, pathname) => requests.filter(value=>{const u=new URL(value);return u.pathname===pathname&&u.searchParams.has('rvn_art_retry');});

test('opening artwork recovers independently of choices and private reading notes', async t => {
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://fixture').pathname;
    const file=path.resolve(ROOT,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
    if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}
    try{res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
    catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));});
  async function session({width=390,lang='ar',failures=[],clock=false,holdInitial=[],holdHelper=false,failHelper=false}={}){
    const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
    await context.addInitScript(()=>{window.__artStorageWrites=[];for(const method of ['setItem','removeItem','clear']){const original=Storage.prototype[method];Storage.prototype[method]=function(...args){window.__artStorageWrites.push([method,...args]);return original.apply(this,args);};}});
    const page=await context.newPage(),requests=[],writes=[],errors=[],held=[],heldScripts=[];
    const failed=new Set(failures),holds=new Set(holdInitial),holdRetries=new Set();
    if(clock)await page.clock.install();
    page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
    await context.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(!['GET','HEAD'].includes(request.method()))writes.push(request.url());
      if(url.origin!==base)return route.abort();
      if(url.pathname.endsWith('/opening-artwork.js')){
        if(holdHelper){heldScripts.push({route,url:request.url()});return;}
        if(failHelper)return route.fulfill({status:404,contentType:'text/plain',body:'Fictional optional helper failure'});
      }
      if(request.resourceType()==='image'){
        requests.push(request.url());
        if(holds.has(url.pathname)||(url.searchParams.has('rvn_art_retry')&&holdRetries.has(url.pathname))){held.push({route,url:request.url()});return;}
        if(failed.has(url.pathname))return route.fulfill({status:404,contentType:'text/plain',body:'Fictional missing image response'});
      }
      return route.continue();
    });
    await page.goto(base+'/raven/deleted-name/content.html?lang='+lang,{waitUntil:'domcontentloaded'});
    if(!holdHelper&&!failHelper)await page.locator('.dn-artwork').first().waitFor({state:'attached'});
    return {context,page,requests,writes,errors,failed,holds,holdRetries,held,heldScripts};
  }
  async function check(options,run){const s=await session(options);try{await run(s);assert.deepEqual(s.errors,[]);assert.deepEqual(s.writes,[]);}finally{await s.context.close();}}
  const overflow=async page=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  async function notebook(page){await page.locator('[data-hook-action="open"]').click();await page.locator('[data-hook-action="enter"]').click();await page.locator('#reading-summary').click();}
  async function successful(held){const url=new URL(held.url);await held.route.fulfill({status:200,contentType:'image/webp',body:fs.readFileSync(path.join(ROOT,url.pathname))}).catch(()=>{});}

  await t.test('healthy original artwork and links stay intact without a retry request',()=>check({},async({page,requests})=>{
    const cover=art(page,selectors.cover);await waitState(cover,'loaded');
    assert.equal(await cover.locator('img').getAttribute('src'),'./assets/scenes/case-scenes-v1.webp');
    assert.ok(await cover.locator('img').evaluate(img=>img.naturalWidth>0));
    assert.equal(await cover.locator('.dn-art-retry').isVisible(),false);
    assert.equal(requests.some(value=>new URL(value).searchParams.has('rvn_art_retry')),false);
    assert.equal(await page.locator('#hook').getAttribute('data-phase'),'start');
    assert.equal(await page.locator('[data-hook-action="open"]').isEnabled(),true);
  }));
  for(const width of [320,390])for(const lang of ['ar','en'])await t.test(width+'px '+lang+': initial failure has accessible image-only keyboard recovery',()=>check({width,lang,failures:[COVER]},async({page,requests,failed})=>{
    const cover=art(page,selectors.cover);await waitState(cover,'failed');
    const retry=cover.locator('.dn-art-retry');assert.equal(await retry.isVisible(),true);
    assert.equal(await retry.evaluate(node=>node.closest('[aria-hidden="true"]')),null);
    const text=await retry.innerText();assert.match(text,lang==='ar'?/[\u0600-\u06ff]/:/retry|reload/i);
    assert.ok((await cover.locator('.dn-art-status').innerText()).trim());assert.ok((await retry.boundingBox()).height>=44);await overflow(page);
    const before=await state(page),storage=await page.evaluate(()=>window.__artStorageWrites);
    failed.delete(COVER);await retry.focus();await page.keyboard.press('Enter');await waitState(cover,'loaded');
    assert.equal(retryRequests(requests,COVER).length,1);assert.deepEqual(await state(page),before);
    assert.deepEqual(await page.evaluate(()=>window.__artStorageWrites),storage);
    assert.equal(await cover.evaluate(node=>document.activeElement===node),true);
    assert.ok(await cover.locator('img').evaluate(img=>img.naturalWidth>0));await overflow(page);
  }));
  await t.test('loaded artwork stays silent for screen readers; only failed or focused artwork is a named group',()=>check({failures:[COVER]},async({page,failed})=>{
    const cover=art(page,selectors.cover);await waitState(cover,'failed');
    assert.equal(await cover.getAttribute('role'),'group');assert.ok(await cover.getAttribute('aria-label'));
    const loaded=page.locator('.dn-artwork[data-art-state="loaded"]').first();await loaded.waitFor({state:'attached'});
    assert.equal(await loaded.getAttribute('role'),null);assert.equal(await loaded.getAttribute('aria-label'),null);
    failed.delete(COVER);const retry=cover.locator('.dn-art-retry');await retry.focus();await page.keyboard.press('Enter');await waitState(cover,'loaded');
    assert.equal(await cover.evaluate(node=>document.activeElement===node),true);
    assert.equal(await cover.getAttribute('role'),'group','the recovered illustration keeps a name while it holds focus');
    await page.locator('[data-hook-action="open"]').focus();
    await until(async()=>await cover.getAttribute('role')===null&&await cover.getAttribute('aria-label')===null);
  }));
  await t.test('retry preserves review recipient, written draft and notebook notes without storage or API writes',()=>check({failures:[NOTEBOOK]},async({page,failed,requests})=>{
    await notebook(page);await page.locator('#reading-source').selectOption('document-original');
    await page.locator('#reading-note').fill('Saved private fixture question');await page.locator('#reading-add').click();
    await page.locator('#reading-note').fill('Unsubmitted private fixture draft');
    await page.locator('[data-hook-action="continue"]').click();await page.locator('[data-hook-action="precise"]').click();await page.locator('[data-hook-action="recipient-both"]').click();
    const view=art(page,selectors.notebook);await view.scrollIntoViewIfNeeded();await waitState(view,'failed');
    const before=await state(page),storage=await page.evaluate(()=>window.__artStorageWrites);
    assert.equal(before.phase,'review');assert.equal(before.recipient,'both');assert.equal(before.notes.length,1);
    failed.delete(NOTEBOOK);await view.locator('.dn-art-retry').click();await waitState(view,'loaded');
    assert.deepEqual(await state(page),before);assert.deepEqual(await page.evaluate(()=>window.__artStorageWrites),storage);
    assert.equal(retryRequests(requests,NOTEBOOK).length,1);
  }));
  await t.test('changing language keeps recovered dynamic artwork and its URL without another retry',()=>check({failures:[NOTEBOOK]},async({page,failed,requests})=>{
    await notebook(page);await page.locator('#reading-source').selectOption('document-original');await page.locator('#reading-note').fill('Private draft across language');
    let view=art(page,selectors.notebook);await view.scrollIntoViewIfNeeded();await waitState(view,'failed');failed.delete(NOTEBOOK);await view.locator('.dn-art-retry').click();await waitState(view,'loaded');
    const url=await view.locator('img').getAttribute('src'),before=await state(page),count=retryRequests(requests,NOTEBOOK).length;
    await view.evaluate(node=>{window.__recoveredOpeningArt=node;});
    await page.locator('#lang-switch').click();view=art(page,selectors.notebook);
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    assert.equal(await view.evaluate(node=>node===window.__recoveredOpeningArt),true);
    assert.equal(await view.locator('img').getAttribute('src'),url);
    assert.equal(retryRequests(requests,NOTEBOOK).length,count);assert.deepEqual(await state(page),before);
  }));
  await t.test('double activation is single flight; timed-out attempts can be retried and obsolete responses cannot replace current artwork',()=>check({failures:[COVER],clock:true},async({page,failed,requests,holdRetries,held})=>{
    const cover=art(page,selectors.cover);await cover.scrollIntoViewIfNeeded();await waitState(cover,'failed');failed.delete(COVER);holdRetries.add(COVER);
    const retry=cover.locator('.dn-art-retry');await retry.focus();await page.keyboard.press('Enter');await page.keyboard.press('Enter');
    await waitState(cover,'retrying');assert.equal(await retry.getAttribute('aria-disabled'),'true');
    await page.waitForFunction(()=>document.querySelector('[data-scene-art="case-cover"]').closest('.dn-artwork').dataset.artState==='retrying');
    await until(()=>held.length===1);assert.equal(retryRequests(requests,COVER).length,1);assert.equal(held.length,1);
    await page.clock.fastForward(20001);await waitState(cover,'failed');assert.equal(await retry.getAttribute('aria-disabled'),'false');
    holdRetries.delete(COVER);await retry.click();await waitState(cover,'loaded');assert.equal(retryRequests(requests,COVER).length,2);
    const current=await cover.locator('img').getAttribute('src');await successful(held[0]);await page.clock.runFor(50);
    assert.equal(await cover.getAttribute('data-art-state'),'loaded');assert.equal(await cover.locator('img').getAttribute('src'),current);
  }));
  await t.test('late success of the current timed-out image recovers without a new request',()=>check({failures:[COVER],clock:true},async({page,failed,requests,holdRetries,held})=>{
    const cover=art(page,selectors.cover);await waitState(cover,'failed');failed.delete(COVER);holdRetries.add(COVER);
    await cover.locator('.dn-art-retry').click();await waitState(cover,'retrying');await until(()=>held.length===1);await page.clock.fastForward(20001);await waitState(cover,'failed');
    assert.equal(held.length,1);await successful(held[0]);await waitState(cover,'loaded');assert.equal(retryRequests(requests,COVER).length,1);
  }));
  await t.test('a visible initial image that never finishes offers recovery without reloading the opening',()=>check({clock:true,holdInitial:[COVER]},async({page,holds,held,requests})=>{
    const cover=art(page,selectors.cover);await until(()=>held.length===1);await cover.scrollIntoViewIfNeeded();await waitState(cover,'pending');
    // The task now precedes the cover. Wait for its real visibility turn before
    // advancing the controlled deadline; scrolling alone does not deliver IO.
    await cover.evaluate(node=>new Promise(resolve=>{const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();resolve();}});observer.observe(node);}));
    await page.clock.runFor(100);await page.clock.fastForward(20001);await waitState(cover,'failed');
    assert.ok(await cover.locator('.dn-art-retry').isVisible());
    holds.delete(COVER);await cover.locator('.dn-art-retry').click();await waitState(cover,'loaded');
    assert.equal(retryRequests(requests,COVER).length,1);assert.equal(await page.locator('#hook').getAttribute('data-phase'),'start');
    const active=await cover.locator('img').getAttribute('src');await successful(held[0]);assert.equal(await cover.locator('img').getAttribute('src'),active);
  }));
  await t.test('untouched lazy artwork in a closed disclosure does not report failure or make retry requests',()=>check({clock:true,holdInitial:[STUDIES]},async({page,requests})=>{
    const disclosure=page.locator('#case-studies');assert.equal(await disclosure.evaluate(node=>node.open),false);
    await page.clock.fastForward(25000);
    assert.equal(await disclosure.locator('.dn-artwork[data-art-state="failed"]').count(),0);
    assert.equal(retryRequests(requests,STUDIES).length,0);
  }));
  await t.test('a stalled optional artwork helper cannot block choices or notes and adopts them when it arrives',()=>check({holdHelper:true,failures:[NOTEBOOK]},async({page,heldScripts,failed,requests})=>{
    await until(()=>heldScripts.length===1);assert.equal(await page.locator('.dn-artwork').count(),0);
    await notebook(page);await page.locator('#reading-source').selectOption('document-original');
    await page.locator('#reading-note').fill('Private saved note before helper');await page.locator('#reading-add').click();
    await page.locator('#reading-note').fill('Private unsaved draft before helper');
    await page.locator('[data-hook-action="continue"]').click();await page.locator('[data-hook-action="precise"]').click();await page.locator('[data-hook-action="recipient-both"]').click();
    const before=await state(page),storage=await page.evaluate(()=>window.__artStorageWrites);
    assert.equal(before.phase,'review');assert.equal(before.recipient,'both');assert.equal(before.notes.length,1);
    await heldScripts[0].route.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(path.join(ROOT,'raven/deleted-name/opening-artwork.js'))});
    let view=art(page,selectors.notebook);await view.scrollIntoViewIfNeeded();await waitState(view,'failed');
    assert.deepEqual(await state(page),before);assert.deepEqual(await page.evaluate(()=>window.__artStorageWrites),storage);
    failed.delete(NOTEBOOK);await view.locator('.dn-art-retry').click();await waitState(view,'loaded');
    await view.evaluate(node=>{window.__lateOpeningArt=node;});const recovered=await view.locator('img').getAttribute('src');
    await page.locator('#lang-switch').click();view=art(page,selectors.notebook);
    assert.equal(await view.evaluate(node=>node===window.__lateOpeningArt),true);assert.equal(await view.locator('img').getAttribute('src'),recovered);
    assert.equal(retryRequests(requests,NOTEBOOK).length,1);assert.deepEqual(await state(page),before);
  }));
  await t.test('an unavailable optional artwork helper leaves the opening and notebook usable',()=>check({failHelper:true},async({page})=>{
    await notebook(page);await page.locator('#reading-source').selectOption('document-original');await page.locator('#reading-note').fill('Independent notebook note');await page.locator('#reading-add').click();
    await page.locator('[data-hook-action="continue"]').click();await page.locator('[data-hook-action="precise"]').click();await page.locator('[data-hook-action="recipient-draft"]').click();
    const current=await state(page);assert.equal(current.phase,'review');assert.equal(current.recipient,'draft');assert.equal(current.notes.length,1);
    assert.equal(await page.locator('[data-hook-action="confirm"]').isEnabled(),true);assert.equal(await page.locator('.dn-artwork').count(),0);
  }));
  await t.test('page lifecycle restoration re-arms a pending visible image deadline',()=>check({clock:true,holdInitial:[COVER]},async({page,held,holds})=>{
    const cover=art(page,selectors.cover);await until(()=>held.length===1);await cover.scrollIntoViewIfNeeded();await waitState(cover,'pending');await page.clock.runFor(100);
    // Exercise BFCache lifecycle handlers deterministically; this is not a claim
    // that Chromium placed this network-intercepted document in its BFCache.
    await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
    await page.clock.runFor(100);
    // IntersectionObserver delivery follows a browser rendering turn, not the
    // controlled timer clock. Let that turn complete before advancing timers.
    await new Promise(resolve=>setTimeout(resolve,150));
    await page.clock.fastForward(20001);await waitState(cover,'failed');
    holds.delete(COVER);await cover.locator('.dn-art-retry').click();await waitState(cover,'loaded');
  }));
  await t.test('removing dynamic artwork while retry is pending leaves no live failure controls or script errors',()=>check({failures:[NOTEBOOK],clock:true},async({page,failed,holdRetries,held})=>{
    await notebook(page);const view=art(page,selectors.notebook);await view.scrollIntoViewIfNeeded();await waitState(view,'failed');failed.delete(NOTEBOOK);holdRetries.add(NOTEBOOK);
    await view.locator('.dn-art-retry').click();await waitState(view,'retrying');await until(()=>held.length===1);assert.equal(held.length,1);
    await page.locator('#reading-tools').evaluate(node=>node.remove());await page.clock.fastForward(20001);await successful(held[0]);
    assert.equal(await art(page,selectors.notebook).count(),0);
    assert.equal(await page.locator('#hook').getAttribute('data-phase'),'compare');
  }));
});
