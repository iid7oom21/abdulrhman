const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..'),base='http://camera.test/abdulrhman/';
const url=base+'raven/late-night/ink-camera.html';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp'};
test('multiplane camera plays and prints the measured two-plane shot',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  for(const [width,language] of [[320,'ar'],[390,'en'],[1280,'en']]){
    await t.test(language+' '+width,async()=>{
      const ctx=await browser.newContext({viewport:{width,height:820},hasTouch:width<600,reducedMotion:width===320?'reduce':'no-preference',acceptDownloads:true});
      try{
        const page=await ctx.newPage(),errors=[],requests={}; let broken=width===320;
        page.on('pageerror',e=>errors.push(e.message));
        await page.route('**/*',async route=>{
          const request=route.request().url();
          if(!request.startsWith(base))return route.abort();
          const file=path.join(root,new URL(request).pathname.slice('/abdulrhman/'.length));
          if(file.includes('camera-')&&file.endsWith('.webp'))requests[path.basename(file)]=(requests[path.basename(file)]||0)+1;
          if(broken&&file.endsWith('camera-window.webp'))return route.abort();
          try{await route.fulfill({contentType:mime[path.extname(file)],body:await fs.readFile(file)});}
          catch{await route.fulfill({status:404,body:''});}
        });
        await page.goto(url+'?lang='+language);
        const q=id=>page.locator('[data-camera="'+id+'"]');
        const press=id=>width<600?q(id).tap():q(id).press('Enter');
        await q('frame').waitFor();
        if(broken){
          await q('retry').waitFor();assert.ok(await q('download').isDisabled());await press('check');
          assert.equal(await q('result').getAttribute('data-met'),'false');
          broken=false;await press('retry');await q('retry').waitFor({state:'hidden'});
          assert.equal(requests['camera-harbour.webp'],1);assert.equal(requests['camera-window.webp'],2);
        }
        await page.waitForFunction(()=>document.querySelector('[data-camera="frame"]').dataset.art==='ready');
        await q('travel').fill('60');await q('spacing').fill('80');
        await q('seek').fill('100');await press('check');
        assert.equal(await q('frame').getAttribute('data-near'),'51');
        assert.equal(await q('frame').getAttribute('data-far'),'15');
        assert.equal(await q('frame').getAttribute('data-difference'),'36');
        assert.equal(await q('result').getAttribute('data-met'),'true');
        const png=()=>q('frame').evaluate(c=>c.toDataURL());
        const finish=await png();await press('compare');const start=await png();assert.notEqual(start,finish);
        // Track actual moving detail in the clear upper pane as well as the opaque wooden mullion.
        const measured=await q('frame').evaluate(async(canvas,finish)=>{
          const final=new Image();final.src=finish;await final.decode();
          const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
          const c=copy.getContext('2d');c.drawImage(final,0,0);
          const after=c.getImageData(0,0,canvas.width,canvas.height).data;
          const before=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          function matching(left,right,dx){
            let matches=0,points=0,variation=new Set();
            for(let y=70;y<150;y+=2)for(let x=left;x<right;x+=2){
              const a=(y*canvas.width+x)*4,b=(y*canvas.width+x+dx)*4;
              if([0,1,2].every(i=>Math.abs(after[a+i]-before[b+i])<=2))matches++;
              variation.add(before[b]);points++;
            }
            return [matches/points,variation.size];
          }
          return {harbour:matching(440,540,15),wood:matching(104,121,51)};
        },finish);
        assert.ok(measured.harbour[0]>.98&&measured.harbour[1]>15,JSON.stringify(measured));
        assert.ok(measured.wood[0]>.95&&measured.wood[1]>15,JSON.stringify(measured));
        await press('compare');assert.equal(await png(),finish);
        await page.locator('[data-night-language]').click();
        assert.equal(await q('result').getAttribute('data-met'),'true');assert.equal(await png(),finish);
        await q('spacing').fill('0');await press('check');assert.equal(await q('frame').getAttribute('data-difference'),'0');
        assert.equal(await q('result').getAttribute('data-met'),'false');
        await q('mode').selectOption('free');await q('travel').fill('-64');
        await q('spacing').fill('100');await q('seek').fill('50');assert.equal(await q('frame').getAttribute('data-difference'),'24');
        await q('travel').focus();await page.keyboard.press('End');assert.equal(await q('travel').inputValue(),'80');
        await press('restart');await press('play');await page.waitForFunction(()=>Number(document.querySelector('[data-camera="frame"]').dataset.near)>0);await press('play');
        const held=await q('frame').getAttribute('data-near');await page.waitForTimeout(160);assert.equal(await q('frame').getAttribute('data-near'),held);
        const frame=await png();await press('save');
        const saved=await page.evaluate(async()=>{const {pieces}=await import('./night-store.js');return pieces()[0];});
        assert.equal(saved.activity,'ink-camera');assert.equal(saved.data.mode,'free');
        const downloaded=page.waitForEvent('download');await press('download');const file=await downloaded;
        assert.equal(file.suggestedFilename(),'raven-ink-camera.png');const data=await fs.readFile(await file.path());
        assert.equal(data.readUInt32BE(16),960);assert.equal(data.readUInt32BE(20),480);
        assert.equal('data:image/png;base64,'+data.toString('base64'),frame);
        await page.goto(url+'?piece='+saved.id+'&lang='+language);
        await page.waitForFunction(()=>document.querySelector('[data-camera="frame"]')?.dataset.art==='ready');
        assert.equal(await png(),frame);assert.equal(await q('mode').inputValue(),'free');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        assert.equal(await page.locator('.night-bench a[href*="ink-studio.html"]').count(),1);
        assert.deepEqual(errors,[]);
      }finally{await ctx.close();}
    });
  }
});
