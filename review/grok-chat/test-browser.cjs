const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {chromium}=require('playwright');

test('supplied chat page: local browser checks, no provider',async t=>{
  const source=fs.readFileSync(__dirname+'/index.html','utf8');
  let requests=0;
  const server=http.createServer((req,res)=>{
    if(req.url.startsWith('/fixture')){
      requests++;
      req.resume();
      res.setHeader('Content-Type','application/json');
      if(req.url==='/fixture/error'){res.statusCode=503;return res.end('{}');}
      if(req.url==='/fixture/pending'){res.statusCode=202;return res.end('{}');}
      if(req.url==='/fixture/empty')return res.end('{"choices":[]}');
      return res.end(JSON.stringify({choices:[{message:{content:'<img src=x onerror="window.injected=true"> الرد الاختباري'}}]}));
    }
    const mode=new URL(req.url,'http://localhost').searchParams.get('fixture');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    // Configure the dormant adapter only in this local HTTP fixture.
    res.end(mode?source.replace('const DIALOGUE_ENDPOINT = null;',`const DIALOGUE_ENDPOINT = ${JSON.stringify('/fixture/'+mode)};`):source);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));});
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const origin='http://127.0.0.1:'+server.address().port;

  await t.test('unconfigured upload makes no request and keeps the draft',async()=>{
    await page.goto(origin);
    await page.fill('#player-input','سؤالي محفوظ');
    await page.press('#player-input','Enter');
    assert.equal(requests,0);
    assert.equal(await page.inputValue('#player-input'),'سؤالي محفوظ');
    assert.match(await page.locator('#request-status').innerText(),/لم يُرسل السؤال/);
  });
  await t.test('fixture reply uses choices[0] and renders both texts safely',async()=>{
    await page.goto(origin+'?fixture=success');
    await page.fill('#player-input','<svg onload="window.injected=true">');
    await page.click('#send-button');
    await page.locator('#request-status').filter({hasText:'وصل الرد'}).waitFor();
    assert.equal(requests,1);
    assert.equal(await page.locator('#chat-box .message').count(),3);
    assert.equal(await page.locator('#chat-box img, #chat-box svg').count(),0);
    assert.equal(await page.evaluate(()=>window.injected),undefined);
    assert.match(await page.locator('#chat-box').innerText(),/الرد الاختباري/);
    assert.equal(await page.locator('.loading').count(),0);
  });
  for(const mode of ['error','empty','pending'])await t.test(mode+' retains status and blocks duplicate request',async()=>{
    await page.goto(origin+'?fixture='+mode);
    const before=requests;
    await page.fill('#player-input','سؤال '+mode);
    await page.click('#send-button');
    await page.waitForFunction(()=>!document.querySelector('.loading'));
    assert.equal(requests,before+1);
    assert.equal(await page.locator('#send-button').isDisabled(),true);
    assert.match(await page.locator('#request-status').innerText(),mode==='pending'?/قيد المعالجة/:/تعذر التحقق/);
    assert.match(await page.locator('#request-status').innerText(),/[a-f0-9]{8}-[a-f0-9-]{27}/);
    await page.fill('#player-input','محاولة ثانية');
    await page.press('#player-input','Enter');
    assert.equal(requests,before+1);
  });
  await t.test('RTL widths and keyboard input at 320/375/390',async()=>{
    for(const width of [320,375,390]){
      await page.setViewportSize({width,height:844});await page.goto(origin);
      assert.equal(await page.evaluate(()=>document.documentElement.dir),'rtl');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      for(const id of ['player-input','send-button']){
        const box=await page.locator('#'+id).boundingBox();
        assert.ok(box.x>=0&&box.x+box.width<=width);
      }
      await page.locator('#player-input').focus();await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'send-button');
    }
  });
  assert.deepEqual(errors,[]);
  console.log('Browser:',await browser.version(),'Node:',process.version);
});
