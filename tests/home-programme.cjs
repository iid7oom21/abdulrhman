// HOME_QA_DIR=/tmp/home node --test tests/home-programme.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium, expect} = require('playwright/test');

async function serve(t) {
  if (process.env.RAVEN_QA_HOME) return process.env.RAVEN_QA_HOME;
  const prefix = '/abdulrhman/', root = path.resolve(__dirname,'..');
  const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2',
    '.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png',
    '.svg':'image/svg+xml','.mp4':'video/mp4','.mp3':'audio/mpeg'};
  const server = http.createServer(async (request,response)=>{
    const route = new URL(request.url,'http://localhost').pathname;
    if (!route.startsWith(prefix)) return response.writeHead(404).end();
    const file = path.resolve(root,route.slice(prefix.length),route.endsWith('/')?'index.html':'');
    if (!file.startsWith(root+path.sep)) return response.writeHead(404).end();
    try {response.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');response.end(await fs.readFile(file));}
    catch {response.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return 'http://127.0.0.1:'+server.address().port+prefix+'raven/';
}

const links = [
  {id:'after-show',source:'#after-show-title a', target:'/raven/after-show/', framed:true, ready:'#as-view .as-tile', name:['بعد العرض','After the Show']},
  {id:'late-night',source:'#late-night-title a',target:'/raven/late-night/',ready:'[data-ink-program]',name:['آخر الليل','Late Night']},
  {id:'ink',source:'#ink-title a',target:'/raven/late-night/ink-studio.html',ready:'[data-ink-route=courier]',name:['ليالي الحبر','Ink Nights']},
  {id:'edit',source:'[data-after-show-play]',target:'/raven/after-show/',framed:true,ready:'[data-shot=exterior]',name:['العب آخر إرسال','Play Last Transmission']},
  {id:'films',source:'.rvnHeroWatch',target:'/raven/episodes/',framed:true,ready:'[data-visual-episode="1"]'},
  {id:'case',source:'#rvnHeroEnterDeletedName',target:'/raven/deleted-name/',framed:true,ready:'#task-message-preview'},
  {id:'studio',source:'[data-home-studio]',target:'/studio/',ready:'#root button'},
  {id:'backstage',source:'[data-home-backstage]',target:'/raven/',framed:true,ready:'#behind-paper-phone [data-atmosphere-play]'}
];

test('the bilingual homepage exposes the three playable worlds and leads to every published destination', {timeout:360000}, async t=>{
  const home = await serve(t), out = process.env.HOME_QA_DIR, report = [];
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium'});
  t.after(()=>browser.close());
  if(out) await fs.mkdir(out,{recursive:true});
  for(const width of [320,390,1280]) for(const lang of ['ar','en']) await t.test(lang+' at '+width+' px',async()=>{
    const touch=width<600,height=touch?844:900;
    const ctx=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,locale:lang,reducedMotion:'reduce'});
    try{
      const page=await ctx.newPage();page.setDefaultTimeout(12000);page.setDefaultNavigationTimeout(30000);
      await page.route('**/*',r=>new URL(r.request().url()).origin===new URL(home).origin?r.continue():r.abort());
      await page.goto(home+'?lang='+lang,{waitUntil:'domcontentloaded'});
      const gate = page.locator('#archive-entry-gate[open]');
      await expect(gate).toBeVisible();
      const posterURL = new URL('terminal-preview/assets/hero-poster.jpg',home).href;
      const welcomePoster = gate.locator('img.archive-entry-art');
      await expect(welcomePoster).toBeVisible();
      const welcome = await welcomePoster.evaluate(async image=>{
        await image.decode();
        return {url:image.currentSrc, size:[image.naturalWidth,image.naturalHeight], fit:getComputedStyle(image).objectFit};
      });
      assert.equal(welcome.url,posterURL);
      assert.deepEqual(welcome.size,[910,512]);
      assert.equal(welcome.fit,'contain','the reduced-motion arrival preserves the full gold RAVEN artwork');
      if(out)await page.screenshot({path:path.join(out,'arrival-'+lang+'-'+width+'.png')});
      await gate.locator('#archive-skip').click();
      const frame=page.frameLocator('#site-content'), entry=frame.locator('.rvnHeroWatch');
      await expect(entry).toBeVisible();
      await expect(frame.locator('html')).toHaveAttribute('dir',lang==='en'?'ltr':'rtl');
      await frame.locator('html').evaluate(async html=>{await html.ownerDocument.fonts.ready;
        await Promise.all([...html.querySelectorAll('.homePoster img')].map(img=>img.decode()));});
      await expect(frame.locator('#ravenHeroMotion')).toHaveCount(1);
      const film = frame.locator('header#top #ravenHeroMotion');
      await expect(film).toBeInViewport({ratio:1});
      const masthead = await film.evaluate(video=>{
        const rect=video.getBoundingClientRect(), nav=video.ownerDocument.querySelector('.ravenNav');
        const cards=[...video.ownerDocument.querySelectorAll('.homePoster')];
        return {poster:video.poster, source:video.querySelector('source').src, muted:video.muted, paused:video.paused,
          fit:getComputedStyle(video).objectFit, top:rect.top, bottom:rect.bottom, navigationBottom:nav.getBoundingClientRect().bottom,
          precedesCards:cards.length===2 && cards.every(card=>Boolean(video.compareDocumentPosition(card)&Node.DOCUMENT_POSITION_FOLLOWING)),
          firstCardTop:Math.min(...cards.map(card=>card.getBoundingClientRect().top))};
      });
      assert.equal(masthead.poster,posterURL);
      assert.equal(masthead.source,new URL('terminal-preview/assets/hero-loop.mp4',home).href);
      assert.equal(masthead.fit,'contain');
      assert.ok(masthead.muted && masthead.paused,'reduced motion shows the original still without starting the loop');
      assert.ok(masthead.precedesCards && masthead.top>=masthead.navigationBottom-1,'the brand appears below the menu, before the film and case');
      if(touch)assert.ok(masthead.bottom<=masthead.firstCardTop+1,'both mobile cards follow the full masthead');
      assert.ok(await frame.locator('html').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'home must fit the viewport');
      const measurements=[];
      for(const world of links.slice(0,3)){
        const link=frame.locator(world.source);
        await expect(link).toHaveText(world.name[lang==='en'?1:0]);
        await expect(link).toBeInViewport();
        const rect=await link.boundingBox();
        assert.ok(rect.x>=0 && rect.x+rect.width<=width+1 && rect.y>=0 && rect.y+rect.height<=height,
          world.id+' must be fully visible without scrolling on first home entry');
        measurements.push({id:world.id,y:Math.round(rect.y),height:Math.round(rect.height)});
      }
      if(out)await page.screenshot({path:path.join(out,'home-'+lang+'-'+width+'.png')});
      const visited=[];
      for(const link of links) {
        const launch=frame.locator(link.source);
        if(link.name) await expect(launch).toHaveText(link.name[lang==='en'?1:0]);
        const href=await launch.evaluate(a=>a.href);
        if(link.id!=='backstage') assert.ok(new URL(href).pathname.endsWith(link.target),link.id);
        if(touch)await launch.tap();else await launch.press('Enter');
        const surface=link.framed?page.frameLocator('#site-content'):page;
        await expect(surface.locator(link.ready).first()).toBeVisible();
        if(link.id==='backstage'){
          await expect.poll(()=>new URL(page.url()).hash).toBe('#behind-paper-phone');
          const video=surface.locator('#atmosphere-paper-detail');
          assert.match(await video.getAttribute('src'),/paper-detail\.mp4/);
          assert.equal(await video.evaluate(v=>v.paused),true);
          await surface.locator(link.ready).click();
          await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(0);
        } else {
          assert.ok(new URL(page.url()).pathname.endsWith(link.target),link.id+' opened '+page.url());
        }
        visited.push({id:link.id,route:new URL(page.url()).pathname+new URL(page.url()).search+new URL(page.url()).hash});
        await page.goto(home+'?lang='+lang,{waitUntil:'domcontentloaded'});
        await expect(entry).toBeVisible();await expect(gate).toHaveCount(0);
      }
      report.push({width,height,lang,input:touch?'tap':'keyboard',welcome,masthead,firstViewport:measurements,visited});
    }finally{await ctx.close();}
  });
  if(out)await fs.writeFile(path.join(out,'home-journeys.json'),JSON.stringify({home,checks:report},null,2)+'\n');
});

test('the original silent loop starts after entry and pauses outside the viewport', async t=>{
  const home = await serve(t);
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium'});
  t.after(()=>browser.close());
  const page = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'no-preference'});
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(home).origin?route.continue():route.abort());
  await page.goto(home,{waitUntil:'domcontentloaded'});
  const frame = page.frameLocator('#site-content'), masthead = frame.locator('#ravenHeroMotion');
  const gate = page.locator('#archive-entry-gate[open]');
  await expect(gate).toBeVisible();
  await expect(masthead).toHaveJSProperty('paused',true);
  await gate.locator('#archive-skip').tap();
  await expect.poll(()=>masthead.evaluate(video=>video.currentTime)).toBeGreaterThan(0);
  await expect(masthead).toHaveJSProperty('muted',true);
  await frame.locator('#behind-paper-phone').scrollIntoViewIfNeeded();
  await expect(masthead).toHaveJSProperty('paused',true);
  await masthead.scrollIntoViewIfNeeded();
  await expect(masthead).toHaveJSProperty('paused',false);
});

test('a failed masthead video leaves its original poster and the episode entrance available', async t=>{
  const home = await serve(t), out = process.env.HOME_QA_DIR;
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium'});
  t.after(()=>browser.close());
  const page = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'no-preference'});
  const loop = new URL('terminal-preview/assets/hero-loop.mp4',home).href;
  await page.route('**/*',route=>{
    const url = route.request().url();
    if(url===loop || new URL(url).origin!==new URL(home).origin) return route.abort();
    return route.continue();
  });
  const failed = page.waitForEvent('requestfailed',request=>request.url()===loop);
  await page.goto(home,{waitUntil:'domcontentloaded'});
  await page.locator('#archive-skip').tap();
  await failed;
  const frame = page.frameLocator('#site-content'), masthead = frame.locator('#ravenHeroMotion');
  await expect(masthead).toBeInViewport({ratio:1});
  assert.equal(await masthead.evaluate(async video=>{
    const poster = new Image();poster.src=video.poster;await poster.decode();return poster.naturalWidth;
  }),910);
  const episodes = frame.locator('.rvnHeroWatch');
  if(out) await masthead.screenshot({path:path.join(out,'blocked-video-poster.png')});
  await episodes.tap();
  await expect(frame.locator('[data-visual-episode="1"]').first()).toBeVisible();
});
