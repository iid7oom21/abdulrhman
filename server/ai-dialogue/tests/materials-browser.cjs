const {test}=require('node:test');const assert=require('node:assert/strict');const {chromium}=require('playwright');
test('materials UI uses the real server and recipient contexts',async t=>{
 const {createPreviewServer}=await import('../src/server.js');const server=createPreviewServer();
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 t.after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.locator('#materials-panel summary').click();
 await page.locator('#material-status').filter({hasText:'المواد المسجلة'}).waitFor();
 const create=async(type,text,original)=>{
  await page.selectOption('#material-type',type);if(original)await page.selectOption('#material-original',original);
  await page.fill('#material-text',text);const before=await page.locator('#materials-list .material').count();
  await page.click('#material-save');await page.waitForFunction(n=>document.querySelectorAll('#materials-list .material').length===n,before+1);
  await page.waitForFunction(()=>!document.getElementById('material-save').disabled);
  return page.locator('#materials-list .material').last().getAttribute('data-material-id');
 };
 const original=await create('statement','FIXTURE الأصل الذي يبقى');
 const correction=await create('correction','FIXTURE التصحيح الخاص',original);
 const motive=await create('motive','FIXTURE دافع خاص');
 await create('private_note','<img src=x onerror="window.injected=true">FIXTURE ملاحظة');
 const share=async(id,to)=>{
  await page.selectOption('#share-material',id);await page.selectOption('#share-recipient',to);
  const done=page.waitForResponse(r=>r.url().endsWith('/api/shares')&&r.request().method()==='POST');
  await page.click('#material-share');await done;
  await page.waitForFunction(()=>!document.getElementById('material-share').disabled);
 };
 await share(correction,'jonas');
 assert.match(await page.locator('#knowledge-list').innerText(),/التصحيح الخاص/);
 assert.doesNotMatch(await page.locator('#knowledge-list').innerText(),/الأصل الذي|دافع خاص|ملاحظة/);
 await page.selectOption('#share-recipient','claire');await page.locator('#knowledge-list').filter({hasText:'لم تصله'}).waitFor();
 await page.selectOption('#material-type','report');await page.fill('#material-text','FIXTURE مسودة التقرير');
 await page.locator(`#attachments input[value="${correction}"]`).check();
 await page.click('#material-save');await page.locator('#materials-list').filter({hasText:'مسودة التقرير'}).waitFor();
 await page.waitForFunction(()=>!document.getElementById('material-save').disabled);
 const report=await page.locator('#materials-list .material').last().getAttribute('data-material-id');
 await share(report,'claire');
 assert.match(await page.locator('#knowledge-list').innerText(),/مسودة التقرير/);assert.match(await page.locator('#knowledge-list').innerText(),/التصحيح الخاص/);
 assert.doesNotMatch(await page.locator('#knowledge-list').innerText(),/دافع خاص|الأصل الذي|ملاحظة/);
 assert.equal(await page.locator('#materials-list img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
 await page.fill('#input','ما المواد التي وصلتك؟');await page.click('#send');await page.locator('#status').filter({hasText:'وصل الرد'}).waitFor();
 assert.match(await page.locator('#log').innerText(),/التصحيح الخاص/);assert.doesNotMatch(await page.locator('#log').innerText(),/دافع خاص|الأصل الذي/);
 const download=page.waitForEvent('download');await page.click('#material-export');assert.equal((await download).suggestedFilename(),'raven-materials-backup.json');
 let posts=0;
 await page.route('**/api/materials',async route=>{
  if(route.request().method()!=='POST')return route.continue();
  posts++;await route.fetch();await route.fulfill({status:503,contentType:'application/json',body:'{"error":"read_failed_after_save"}'});
 });
 await page.selectOption('#material-type','statement');await page.fill('#material-text','FIXTURE إجراء محفوظ مع رد غير مؤكد');
 await page.click('#material-save');await page.locator('#material-status').filter({hasText:'لم يتأكد'}).waitFor();
 assert.equal(await page.locator('#material-save').isDisabled(),true);
 const pendingId=await page.evaluate(()=>JSON.parse(localStorage.getItem('raven_deleted_name_material_actions_v1')).pending.id);
 assert.ok(pendingId);await page.click('#material-check');
 await page.locator('#material-status').filter({hasText:'تأكد تسجيل الإجراء الأصلي'}).waitFor();
 assert.match(await page.locator('#materials-list').innerText(),/إجراء محفوظ مع رد غير مؤكد/);assert.equal(posts,1);
 await page.unroute('**/api/materials');
 for(const width of [320,375,390]){
  await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const id of ['material-save','material-share','share-recipient','material-text']){const box=await page.locator('#'+id).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);}
  if(process.env.SCREENSHOT_DIR)await page.screenshot({path:`${process.env.SCREENSHOT_DIR}/materials-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
});
