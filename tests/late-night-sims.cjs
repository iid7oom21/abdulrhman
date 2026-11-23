const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..'),base='http://night.test/abdulrhman/',q=base+'raven/late-night/';
const type={'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2'};
test('measured geometry, tide solutions, camera impulses and contiguous cloth intervals',async()=>{
  const {pulse,crossing,clothRun}=await import('../raven/late-night/sims/models.js');
  const {cameraRun}=await import('../raven/late-night/sims/camera-rules.js');
  const o=pulse(1,0,false),closed=pulse(1,0,true);assert.ok(o.success);assert.ok(!closed.success);assert.equal(o.gap,closed.gap);assert.ok(o.ratio>closed.ratio);
  assert.ok(!pulse(21,2,false).success);
  assert.ok(!crossing(0,2.7,0).success);assert.ok(crossing(0,1.5,0).success);assert.ok(crossing(17,2.7,0).success);assert.ok(!crossing(60,1.5,0).success);
  const pushes=[{t:0,dv:4},{t:2.5,dv:-4}];
  assert.equal(cameraRun(pushes,4.25).success,false);assert.equal(cameraRun(pushes,4.5).success,true);assert.equal(cameraRun(pushes,4.5).brakeAt,2.5);
  assert.equal(cameraRun([{t:0,dv:4}]).success,false);assert.ok(cameraRun([{t:0,dv:1}]).success);assert.deepEqual(cameraRun(pushes).pushes,pushes);
  const steady=clothRun({left:135,right:490,weight:1.65,fan:0}),fold=clothRun({left:235,right:337,weight:.65,fan:1.65});
  assert.equal(steady.best,6);assert.ok(fold.best<2&&fold.total>2);assert.equal(fold.success,false);
});
test('play all five simulators at the project mount',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  for(const [lang,width] of [['ar',320],['en',320],['ar',390],['en',390],['ar',1280],['en',1280]])await t.test(lang+' '+width,async()=>{
    const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:width<600,reducedMotion:'reduce',acceptDownloads:true});
    try{
      let broken='';const outside=[],errors=[];
      await ctx.route('**/*',async r=>{
        const url=r.request().url();if(!url.startsWith(base)){outside.push(url);return r.abort();}
        const file=path.resolve(root,new URL(url).pathname.slice('/abdulrhman/'.length));
        if(broken&&file.endsWith(broken))return r.abort('failed');
        try{await r.fulfill({body:await fs.readFile(file),contentType:type[path.extname(file)]||'application/octet-stream'});}
        catch{await r.fulfill({status:404,body:''});}
      });
      const p=await ctx.newPage();p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(e.message));
      const enter=async id=>{await p.goto(q+id+'.html?lang='+lang);await p.locator('.sim-actions button').first().waitFor();};
      const control=id=>p.locator('[data-sim="'+id+'"]'),click=id=>control(id).click(),
        fill=(id,v)=>control(id).fill(String(v)),sel=(id,v)=>control(id).selectOption(String(v)),canvas=p.locator('.night-sim>figure canvas');
      const get=d=>canvas.getAttribute('data-'+d),pixels=()=>canvas.evaluate(c=>{
        const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
        let h=2166136261;for(const n of a)h=Math.imul(h^n,16777619);return h>>>0;
      });
      const fits=async()=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      const download=async()=>{
        const pending=p.waitForEvent('download');await click('export');const out=await pending;
        assert.ok(out.suggestedFilename().endsWith('.png'));const bytes=await fs.readFile(await out.path());assert.equal(bytes.toString('ascii',1,4),'PNG');
      };
      broken='/echo.js';await p.goto(q+'echo-last-seat.html?lang='+lang);await control('retry').waitFor();
      broken='';await control('retry').click();await control('source').waitFor();
      await control('source').focus();await p.keyboard.press('ArrowRight');assert.equal(await control('source').inputValue(),'4');
      if(width<600)await control('sound').tap();else await control('sound').press('Enter');
      await control('sound').press('Enter');
      const gap=Number(await get('gap'));await fill('source',21);assert.ok(Number(await get('gap'))<gap);
      await click('run');assert.equal(await p.locator('audio').getAttribute('src'),null);
      await click('sound');await click('run');assert.match(await p.locator('audio').getAttribute('src'),/^blob:/);
      await p.waitForFunction(()=>document.querySelector('audio').currentTime>0);await click('sound');
      await click('save');await download();await fits();
      await enter('darkroom-minute');const a=await pixels();const aw=await get('win');
      await click('develop');await click('pin0');await fill('time',35);await fill('mask',90);
      await click('pin1');assert.equal(await p.locator('.sim-edit canvas').count(),2);await click('see0');assert.equal(await pixels(),a);
      await click('see1');assert.notEqual(await pixels(),a);assert.notEqual(await get('win'),aw);
      await click('save');await download();await fits();
      await enter('weightless-cam');await click('push4');await control('step').focus();for(let i=0;i<10;i++)await p.keyboard.press('Enter');
      assert.equal(await get('x'),'10');await click('push-4');for(let i=0;i<8;i++)await click('step');
      await click('finish');assert.equal(await get('hold'),'2');assert.ok(await p.locator('.sim-actions a[href*="replay-caller"]').isVisible());
      await click('save');await download();await fits();
      const run=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('.event.')).map(k=>JSON.parse(localStorage[k]).value).find(e=>e.data.kind==='camera-run'));
      assert.equal(run.data.brakeAt,2.5);assert.equal(run.data.frames.length,19);assert.equal(run.data.success,true);
      await enter('tide-harbor');assert.equal(await get('success'),'false');await fill('height',1.5);assert.equal(await get('success'),'true');
      await fill('height',2.7);await fill('departure',17);assert.equal(await get('success'),'true');await click('run');await click('save');await download();await fits();
      await enter('fabric-wind');await fill('left',235);await fill('right',337);await sel('weight',.65);await sel('fan',1.65);assert.ok(Number(await get('best'))<2);
      await click('repin');assert.equal(await control('weight').inputValue(),'0.65');await click('run');await fill('frame',4.8);
      const frame=await pixels();await p.locator('[data-night-language]').click();assert.equal(await canvas.getAttribute('data-time'),'4.8');
      assert.equal(await pixels(),frame);await click('save');await download();await fits();
      const pieces=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('.piece.')).map(k=>JSON.parse(localStorage[k]).value));
      assert.equal(pieces.length,5);assert.ok(pieces.every(r=>r.thumbnail.startsWith('data:image/webp')));
      for(const r of pieces){
        await p.goto(q+r.activity+'.html?piece='+r.id+'&lang='+lang);await p.locator('.sim-actions button').first().waitFor();
        if(r.activity==='weightless-cam')assert.equal(await get('hold'),'2');
        if(r.activity==='darkroom-minute')assert.equal(await control('time').inputValue(),'35');
        if(r.activity==='fabric-wind')assert.equal(await control('frame').inputValue(),'4.8');
      }
      await p.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('storage denied');};});
      await enter('fabric-wind');await click('save');assert.ok(await p.locator('.night-notice').isVisible());
      assert.equal(await p.locator('.sim-confirm').count(),0);await download();
      assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
    }finally{await ctx.close();}
  });
});
