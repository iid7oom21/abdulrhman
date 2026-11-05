const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};

async function setup(t,options={}) {
  const {createPreviewServer}=await import('../src/server.js');
  const server=createPreviewServer(options);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  t.after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
  const context=await browser.newContext(),page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));
  const root=`http://127.0.0.1:${server.address().port}`;
  await page.goto(root);await page.locator('#status').filter({hasText:'دُمج'}).waitFor();
  const post=async(p,data)=>context.request.post(root+p,{data});
  return {page,context,root,post,errors};
}

test('real browser + HTTP + provider adapter: accepted pending, recipient scope, switch, safe response, one generation',async t=>{
  const {createOpenAIReply}=await import('../src/provider.js');
  const gate=deferred();t.after(()=>gate.resolve());let calls=0,contextSent;
  const generate=createOpenAIReply({apiKey:'TEST_ONLY',model:'fixture',fetchImpl:async(url,opts)=>{
    calls++;contextSent=JSON.parse(opts.body);await gate.promise;
    return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({action:'received_materials',materialIds:['c1']})}]}]}));
  }});
  const {page,post,errors}=await setup(t,{generate,providerInfo:{provider:'openai',model:'fixture'}});
  await page.locator('#runtime-mode').filter({hasText:'OpenAI'}).waitFor();
  for(const material of [
    {id:'s1',type:'statement',text:'PRIVATE ORIGINAL'},
    {id:'c1',type:'correction',originalId:'s1',text:'<img src=x onerror="window.injected=1">التصحيح فقط'},
    {id:'m1',type:'motive',text:'PRIVATE MOTIVE'}
  ])assert.equal((await post('/api/materials',material)).status(),200);
  assert.equal((await post('/api/shares',{eventId:'share-c',materialId:'c1',recipients:['jonas']})).status(),200);
  const accepted=page.waitForResponse(r=>r.url().endsWith('/api/dialogue'));
  await page.fill('#input','ما التصحيح الذي وصلك؟');await page.click('#send');
  const response=await accepted;assert.equal(response.status(),202);const op=await response.json();
  await page.locator('#status').filter({hasText:'قيد المعالجة'}).waitFor();assert.equal(await page.locator('#send').isDisabled(),true);
  assert.doesNotMatch(JSON.stringify(contextSent),/PRIVATE ORIGINAL|PRIVATE MOTIVE/);
  await page.selectOption('#character','claire');await page.locator('#status').filter({hasText:'دُمج'}).waitFor();
  assert.doesNotMatch(await page.locator('#log').innerText(),/التصحيح/);gate.resolve();
  await page.selectOption('#character','jonas');await page.locator('#status').filter({hasText:'دُمج'}).waitFor();
  await page.click('#check');await page.locator('#status').filter({hasText:'وصل الرد'}).waitFor();
  assert.match(await page.locator('#log').innerText(),/التصحيح فقط/);assert.equal(await page.locator('#log img').count(),0);
  assert.equal(await page.evaluate(()=>window.injected),undefined);assert.equal(calls,1);
  const replay=await post('/api/dialogue',{requestId:op.id,characterId:'jonas',message:op.message});
  assert.equal((await replay.json()).replayed,true);assert.equal(calls,1);assert.deepEqual(errors,[]);
});

test('disk save failure retains known reply in browser after poll/reload and never claims disk confirmation',async t=>{
  const {openDiskStore}=await import('../src/disk-store.js');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'raven-ui-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  let fail=false,calls=0;const gate=deferred();t.after(()=>gate.resolve());
  const {page,errors}=await setup(t,{storeFile:path.join(dir,'store.json'),openStore:f=>{
    const disk=openDiskStore(f);return {...disk,save:s=>{if(fail)throw new Error('full');disk.save(s);}};
  },generate:async()=>{calls++;await gate.promise;return {text:'REPLY SURVIVES',refused:false};}});
  await page.locator('footer').filter({hasText:'القرص نفسه'}).waitFor();
  await page.fill('#input','سؤال');await page.click('#send');await page.locator('#status').filter({hasText:'قيد المعالجة'}).waitFor();
  fail=true;gate.resolve();await page.click('#check');await page.locator('#status').filter({hasText:'حفظه على القرص غير مؤكد'}).waitFor();
  assert.match(await page.locator('#log').innerText(),/REPLY SURVIVES/);
  assert.doesNotMatch(await page.locator('#log').innerText(),/تأكد تسجيل العملية/);
  await page.reload();await page.locator('#status').filter({hasText:'دُمج'}).waitFor();
  assert.match(await page.locator('#log').innerText(),/REPLY SURVIVES/);assert.match(await page.locator('#log').innerText(),/حفظه على الخادم غير مؤكد/);
  assert.equal(calls,1);assert.deepEqual(errors,[]);
});

test('another tab restores the existing pending request and keeps its rejected question as a draft',async t=>{
  const gate=deferred();t.after(()=>gate.resolve());let calls=0;
  const {page,context,root,errors}=await setup(t,{generate:async()=>{calls++;await gate.promise;return {text:'ready',refused:false};}});
  const other=await context.newPage();await other.goto(root);await other.locator('#status').filter({hasText:'دُمج'}).waitFor();
  await page.fill('#input','السؤال الأول');await page.click('#send');await page.locator('#status').filter({hasText:'قيد المعالجة'}).waitFor();
  await other.fill('#input','مسودة ثانية');await other.click('#send');
  await other.locator('#status').filter({hasText:'عملية سابقة'}).waitFor();
  await other.locator('#log').filter({hasText:'السؤال الأول'}).waitFor();
  assert.equal(await other.inputValue('#input'),'مسودة ثانية');assert.equal(await other.locator('#send').isDisabled(),true);
  assert.equal(calls,1);gate.resolve();assert.deepEqual(errors,[]);
});

test('operator-disabled provider is labeled as written dialogue; free replies and history remain available',async t=>{
  let calls=0,enabled=true;
  const {page,post,errors}=await setup(t,{generate:()=>{calls++;return {text:'رد رفض مكتوب',refused:true,source:'deterministic-fallback'};},providerInfo:{provider:'openai',model:'fixture'},readControls:()=>({providerCallsEnabled:enabled,controlAvailable:true,purchasesEnabled:false,entitlementUseEnabled:false,writtenDialogueAvailable:true})});
  await page.locator('#runtime-mode').filter({hasText:'OpenAI'}).waitFor();enabled=false;
  await page.fill('#input','ما الذي تعرفه؟');await page.click('#send');await page.locator('#status').filter({hasText:'وصل الرد'}).waitFor();
  assert.match(await page.locator('#log').innerText(),/النص الأصلي لهذه الإفادة غير متاح/);
  assert.match(await page.locator('#log').innerText(),/رد مكتوب من الخادم/);assert.equal(calls,0);
  await page.locator('#runtime-mode').filter({hasText:'المزوّد متوقف'}).waitFor();
  assert.equal((await post('/api/payments/create',{price:1,userId:'forged'})).status(),404);
  enabled=true;await page.click('#history');await page.locator('#status').filter({hasText:'دُمج'}).waitFor();await page.locator('#runtime-mode').filter({hasText:'OpenAI'}).waitFor();assert.equal(calls,0);
  await page.fill('#input','سؤال بعد إعادة المزوّد');await page.click('#send');await page.locator('#status').filter({hasText:'وصل الرد'}).waitFor();
  assert.equal(calls,1);assert.match(await page.locator('#log').innerText(),/رد مكتوب من الخادم/);assert.doesNotMatch(await page.locator('#log').innerText(),/دون استدعاء النموذج/);assert.deepEqual(errors,[]);
});
