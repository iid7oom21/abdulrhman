const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs/promises'),http=require('node:http');
const {chromium}=require('playwright');

test('lighthouse festival boats answer the aimed light', async t=>{
  const root=path.resolve(__dirname,'..'),prefix='/abdulrhman/';
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(!url.pathname.startsWith(prefix))return res.writeHead(404).end();
    const file=path.resolve(root,url.pathname.slice(prefix.length));
    if(!file.startsWith(root+path.sep))return res.writeHead(404).end();
    try{
      const bytes=await fs.readFile(file);
      const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.woff2':'font/woff2'};
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(bytes);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>server.close());
  const url='http://127.0.0.1:'+server.address().port+prefix+'raven/late-night/ink-beacon.html';
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());

  async function room(lang,width){
    const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<500,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);
    await page.goto(url+'?lang='+lang);
    const q=id=>page.locator('[data-beacon="'+id+'"]');
    const step=async n=>{for(let i=0;i<n;i++)await q('step').click();};
    const align=async()=>q('angle').fill(await q('bearing').getAttribute('value'));
    return {context,page,q,errors,step,align};
  }

  for(const [lang,width] of [['ar',320],['en',390],['ar',390],['en',1280]]){
    await t.test('three passages, '+lang+' '+width+'px',async()=>{
      const {context,page,q,step,align,errors}=await room(lang,width);
      try{
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        for(let i=0;i<3;i++){
          await step(4);await align();await q('signal').click();await step(1);
          assert.equal(await q('result').getAttribute('data-outcome'),'pending');
          if(i===0){
            const time=await q('time').innerText();
            await page.locator('[data-night-language]').click();
            assert.equal(await q('signal').getAttribute('aria-pressed'),'true');
            await page.locator('[data-night-language]').click();assert.equal(await q('time').innerText(),time);
            await page.reload();assert.equal(await q('time').innerText(),time);
            assert.equal(await q('signal').getAttribute('aria-pressed'),'true');
            if(process.env.INK_BEACON_SHOTS){
              await fs.mkdir(process.env.INK_BEACON_SHOTS,{recursive:true});
              await page.locator('figure').scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);
              await page.screenshot({path:path.join(process.env.INK_BEACON_SHOTS,'beacon-'+lang+'-'+width+'.png')});
            }
          }
          await step(1);assert.equal(await q('result').getAttribute('data-outcome'),'acknowledged');
          assert.equal(await q('signal').isDisabled(),true);
          if(i<2)await q('next').click();
        }
        assert.match(await q('result').innerText(),lang==='ar'?/٣ \/ ٣/:/3 \/ 3/);
        assert.match(await page.locator('a[href*="ink-studio.html"]').getAttribute('href'),/ink-studio\.html\?lang=/);
        await q('restart').click();assert.equal(await q('result').getAttribute('data-outcome'),'pending');
        assert.equal(await q('angle').inputValue(),'12');assert.deepEqual(errors,[]);
      }finally{await context.close();}
    });
  }

  await t.test('incorrect angles, broken holds, disabled artwork and the live clock',async()=>{
    const {context,page,q,step,align,errors}=await room('en',390);
    try{
      const plate='**/art/beacon-night.webp*';await page.route(plate,r=>r.abort());await page.reload();
      await q('retry').waitFor();await step(4);await align();await q('signal').click();await step(1);
      await q('angle').fill('58');await align();await step(1);
      assert.equal(await q('result').getAttribute('data-outcome'),'pending');
      await q('angle').fill('58');await step(10);
      assert.equal(await q('result').getAttribute('data-outcome'),'missed');assert.match(await q('result').innerText(),/0.5 s/);
      await page.unroute(plate);await q('retry').click();await q('retry').waitFor({state:'hidden'});
      assert.equal(await q('result').getAttribute('data-outcome'),'missed');
      await q('next').click();await step(4);await q('signal').click();await step(12);
      assert.match(await q('result').innerText(),/outside/);
      await q('next').click();await page.clock.install();await q('play').focus();await page.keyboard.press('Enter');
      await page.clock.runFor(8100);assert.match(await q('result').innerText(),/without receiving any light/);
      await q('restart').click();await q('angle').focus();await page.keyboard.press('ArrowRight');assert.equal(await q('angle').inputValue(),'13');
      assert.deepEqual(errors,[]);
    }finally{await context.close();}
  });
});
