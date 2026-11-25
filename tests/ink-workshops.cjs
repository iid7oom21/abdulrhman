// The two drawn Ink Nights workshops: animation timing (ink-lines) and manga lettering (ink-letters).
// Run from a Pages checkout: node --test tests/ink-workshops.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),base='http://workshops.test/abdulrhman/',room=base+'raven/late-night/';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp'};

test('Ink Nights drawing workshops under the production prefix',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  for(const [lang,width] of [['ar',320],['en',390],['ar',1024]])await t.test(lang+' '+width,async suite=>{
    const ctx=await browser.newContext({viewport:{width,height:830},reducedMotion:'reduce',hasTouch:width<500,acceptDownloads:true});
    const errors=[],outside=[],missing=[];
    await ctx.route('**/*',async r=>{
      const u=new URL(r.request().url());if(!u.href.startsWith(base)){outside.push(u.href);return r.abort();}
      const f=path.resolve(root,decodeURIComponent(u.pathname.slice('/abdulrhman/'.length)),u.pathname.endsWith('/')?'index.html':'');
      try {return await r.fulfill({contentType:mime[path.extname(f)],body:await fs.readFile(f)});}catch{missing.push(u.pathname);return r.fulfill({status:404,body:''});}
    });
    const p=await ctx.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));
    const open=(id,query='')=>p.goto(room+id+'.html?lang='+lang+query).then(()=>p.locator('.night-bench button').first().waitFor());
    const field=k=>p.locator('[data-scene="'+k+'"]');
    const tap=k=>width<500?field(k).tap():field(k).click();
    const fits=async()=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll');
    const result=()=>p.locator('.manga-result');
    const verdict=async()=>{await p.locator('.manga-result[data-ok]').waitFor();return result().getAttribute('data-ok');};
    const passes=()=>p.waitForFunction(()=>document.querySelector('.manga-result')?.dataset.ok==='true');
    const pieces=()=>p.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.includes('late-night.v1.piece.')).map(([,v])=>JSON.parse(v).value));
    const mod=(file,code)=>p.evaluate(async([file,code])=>{const m=await import(new URL('./manga/'+file,location.href).href);return new Function('m','return ('+code+')(m)')(m);},[file,code]);
    const back=async()=>{
      const home=p.locator('.night-bench a.ink-back');
      assert.equal(await home.count(),1);
      assert.match(await home.getAttribute('href'),new RegExp('ink-studio\\.html\\?lang='+lang+'$'));
    };
    try {
      await suite.test('each workshop loads only its own module and the shared drawing helpers',async()=>{
        for(const [id,own] of [['ink-lines','speed.js'],['ink-letters','bubbles.js']]){
          await open(id);
          const modules=await p.evaluate(()=>performance.getEntriesByType('resource').map(e=>new URL(e.name).pathname).filter(n=>n.includes('/late-night/manga/')&&n.endsWith('.js')).map(n=>n.split('/').at(-1)));
          assert.deepEqual([...new Set(modules)].sort(),['art.js','start.js',own].sort(),id);
          assert.equal(await p.locator('html').getAttribute('dir'),lang==='en'?'ltr':'rtl');
          await back();await fits();
        }
      });
      if(width===320)await suite.test('timing and lettering rules',async()=>{
        await open('ink-lines');
        const speed=await mod('speed.js',`m=>[m.analyse({step:1,lines:12,smear:false,budget:0}),m.analyse({step:2,lines:12,smear:false,budget:0}),
          m.analyse({step:2,lines:12,smear:true,budget:18}),m.analyse({step:1,lines:12,smear:false,budget:18}),m.analyse({step:1,lines:2,smear:false,budget:0}),m.analyse({step:1,lines:34,smear:false,budget:0})]`);
        assert.deepEqual(speed.map(r=>r.drawings),[36,18,18,36,36,36]);
        assert.deepEqual(speed.map(r=>r.ok),[true,false,true,false,false,false]);
        assert.ok(speed[1].maxJump>70&&!speed[1].steady,'drawing on twos without a smear jumps');
        assert.equal(speed[3].affordable,false);assert.equal(speed[4].felt,false);assert.equal(speed[5].readable,false);
        const bubbles=await mod('bubbles.js',`m=>[m.judge([0,1,2]),m.judge([1,0,2]),m.judge([0,2,1]),m.judge([0,-1,2])]`);
        assert.deepEqual(bubbles.map(v=>v.ok),[true,false,false,false]);
        assert.equal(bubbles[1].ordered,false);assert.equal(bubbles[2].tails,false);assert.equal(bubbles[3].complete,false);
      });
      await suite.test('speed lines: twos jump until the smear frame, then fit the budget, play and save',async()=>{
        await open('ink-lines');
        await field('step').selectOption('2');await tap('check');
        assert.equal(await verdict(),'false');
        await tap('smear');assert.equal(await field('smear').getAttribute('aria-pressed'),'true');
        await field('mode').selectOption('budget');await tap('check');await passes();
        assert.equal(await result().locator('li[data-ok="false"]').count(),0);
        await tap('play');
        await p.waitForFunction(()=>/✓/.test(document.querySelector('.manga-result')?.innerText||''),null,{timeout:6000});
        await tap('save');
        const entry=(await pieces()).find(e=>e.activity==='ink-lines');
        assert.equal(entry.data.step,2);assert.equal(entry.data.smear,true);assert.ok(entry.thumbnail.startsWith('data:image/'));
        await fits();
      });
      await suite.test('speech bubbles: misplaced lines are read back, the right layout passes and reopens from the notebook',async()=>{
        await open('ink-letters');
        await tap('read');assert.match(await p.locator('.night-bench .ns-status').first().innerText(),/الجمل الثلاث|all three/);
        for(const [line,spot] of [[0,1],[1,0],[2,2]]){await tap('line-'+line);await tap('spot-'+spot);}
        await tap('read');assert.equal(await verdict(),'false');
        assert.ok((await result().locator('li').count())>=2,'the reading explains each problem');
        for(const [line,spot] of [[0,0],[1,1],[2,2]]){await tap('line-'+line);await tap('spot-'+spot);}
        await tap('read');await passes();
        assert.match(await field('spot-3').innerText(),/فارغ|empty/);
        await p.locator('[data-night-language]').click();await p.locator('.night-bench button').first().waitFor();
        assert.match(await field('spot-0').innerText(),lang==='en'?/آخر تذكرة/:/last ticket/i,'the layout survives the language switch');
        await p.locator('[data-night-language]').click();await p.locator('.night-bench button').first().waitFor();
        await tap('read');await passes();await tap('save');
        const entry=(await pieces()).find(e=>e.activity==='ink-letters');
        assert.deepEqual(entry.data.spots,[0,1,2]);
        await p.evaluate(()=>{for(const k of Object.keys(localStorage))if(k.includes('draft'))localStorage.removeItem(k);});
        await open('ink-letters','&piece='+entry.id);
        assert.match(await field('spot-1').innerText(),/طارت مع الريح|flew off/,'the notebook piece reopens with its own layout');
        await p.goto(room+'my-notebook.html?lang='+lang);
        const reopen=p.locator('a[href*="ink-letters.html?piece="]');await reopen.first().waitFor();
        assert.ok(await reopen.count()>=1,'the portfolio links back to the workshop');
        await fits();
      });
      await suite.test('the Ink Nights programme lists both workshops with their covers',async()=>{
        await p.goto(room+'ink-studio.html?lang='+lang);
        const cards=p.locator('.ink-listing');await cards.first().waitFor();
        for(const [route,cover,name] of [['lines','workshop-lines','خطوط السرعة|Speed lines'],['letters','workshop-letters','فقاعات الحوار|Speech bubbles']]){
          const card=p.locator('.ink-listing[data-ink-route="'+route+'"]');
          assert.equal(await card.count(),1,route);
          assert.match(await card.getAttribute('href'),new RegExp('ink-'+route+'\\.html\\?lang='+lang+'$'));
          assert.match(await card.locator('h2').innerText(),new RegExp(name));
          const art=await card.locator('img').evaluate(async img=>{img.loading='eager';await img.decode();return [new URL(img.currentSrc).pathname.split('/').pop(),img.naturalWidth,img.naturalHeight];});
          assert.deepEqual(art,[cover+'.webp',960,540]);
        }
        await p.locator('.ink-listing[data-ink-route="letters"]').click();
        await p.locator('[data-scene="line-0"]').waitFor();
        await fits();
      });
      assert.deepEqual(errors,[],'script exceptions');
      assert.deepEqual(outside,[],'no request leaves the site');
      assert.deepEqual(missing,[],'no missing project files');
    } finally {await ctx.close();}
  });
});
