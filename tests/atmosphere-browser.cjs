// Real local media playback. No providers, production API or author-story data.
// NODE_PATH=<existing Playwright installation> node --test tests/atmosphere-browser.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
const ROOT = path.resolve(__dirname,'..');
const ARTIFACTS = process.env.RAVEN_ATMOSPHERE_ARTIFACTS;
const SLUGS = ['archive-opening','paper-detail','over-shoulder'];
const VIDEO_PATH = /\/raven\/assets\/atmosphere-v1\/([^/]+)\.mp4$/;

async function eventually(predicate,message) {
  const end=Date.now()+10000;
  while(Date.now()<end) {if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}
  assert.fail(message);
}

test('published atmosphere derivatives contain playable video and no audio track',()=>{
  for(const slug of SLUGS) {
    const result=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height','-show_entries','format=duration','-of','json',path.join(ROOT,'raven/assets/atmosphere-v1',slug+'.mp4')],{encoding:'utf8'}));
    assert.deepEqual(result.streams.map(stream=>stream.codec_type),['video'],slug+' cannot emit a hidden soundtrack');
    assert.equal(result.streams[0].codec_name,'h264');
    assert.deepEqual([result.streams[0].width,result.streams[0].height],[1280,720]);
    assert.ok(Number(result.format.duration)>9&&Number(result.format.duration)<11,slug+' retains the selected ten-second clip');
    assert.ok(fs.statSync(path.join(ROOT,'raven/assets/atmosphere-v1',slug+'.webp')).size>0);
  }
});

test('atmosphere gallery remains optional, silent and independent of case state',async t=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const results=[];
  if(ARTIFACTS)fs.mkdirSync(ARTIFACTS,{recursive:true,mode:0o700});
  t.after(async()=>{
    if(ARTIFACTS)fs.writeFileSync(path.join(ARTIFACTS,'atmosphere-results.json'),JSON.stringify({browser:browser.version(),media:'actual local silent derivatives',externalRequests:'blocked',results},null,2),{mode:0o600});
    await browser.close();
  });
  async function withPage(options,run) {
    const fixture={failSlug:options.failSlug,failPoster:options.failPoster,holdSlug:options.holdSlug,held:[],requests:[]};
    const server=http.createServer((req,res)=>{
      let pathname=new URL(req.url,'http://local').pathname;
      fixture.requests.push({method:req.method,path:pathname});
      if(pathname.startsWith('/abdulrhman/'))pathname=pathname.slice('/abdulrhman'.length);
      if(pathname.endsWith('/'))pathname+='index.html';
      const video=pathname.match(VIDEO_PATH);
      if(video&&video[1]===fixture.failSlug){res.writeHead(503,{'Cache-Control':'no-store'});return res.end('Synthetic media failure');}
      if(pathname.endsWith('/'+fixture.failPoster+'.webp')){res.writeHead(503);return res.end();}
      const file=path.resolve(ROOT,'.'+pathname);
      if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}
      const send=()=>{
        if(res.destroyed||res.writableEnded)return;
        try {
          const data=fs.readFileSync(file),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.mp4':'video/mp4','.mp3':'audio/mpeg','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
          res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Accept-Ranges','bytes');
          const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
          if(range){const start=Number(range[1]),end=Math.min(range[2]?Number(range[2]):data.length-1,data.length-1);if(start>=data.length||end<start){res.writeHead(416,{'Content-Range':'bytes */'+data.length});return res.end();}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1});return res.end(data.subarray(start,end+1));}
          res.setHeader('Content-Length',data.length);res.end(data);
        }catch{res.writeHead(404);res.end();}
      };
      if(video&&video[1]===fixture.holdSlug){fixture.held.push(send);return;}
      send();
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const context=await browser.newContext({viewport:{width:options.width||390,height:844},reducedMotion:options.reducedMotion||'no-preference'});
    await context.addInitScript(()=>{
      sessionStorage.setItem('raven_studio_ident_v1','1');sessionStorage.setItem('raven_music_enabled_v2','off');
      localStorage.setItem('other_app_preferences','atmosphere-keep');
      localStorage.setItem('raven_deleted_name_preview_v2','{"synthetic":"keep byte-for-byte"}');
    });
    const page=await context.newPage(),errors=[],requests=[];
    page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{requests.push({url:route.request().url(),method:route.request().method()});return route.request().url().startsWith(base+'/')?route.continue():route.abort();});
    try{
      await page.goto(base+'/abdulrhman/raven/?lang='+(options.language||'ar'),{waitUntil:'load'});
      const scope=page.frameLocator('#site-content');await scope.locator('#raven-atmosphere').waitFor();
      await run({page,scope,fixture,requests});
      assert.deepEqual(requests.filter(request=>{const pathname=new URL(request.url).pathname;return !['GET','HEAD'].includes(request.method)||(/\/api\//.test(pathname)&&!(pathname==='/api/case/resume-summary'&&request.method==='GET'));}),[],'homepage may read its minimal resume summary; gallery starts no session and performs no other API call or mutation');
      assert.equal(await page.evaluate(()=>localStorage.getItem('other_app_preferences')),'atmosphere-keep');
      assert.equal(await page.evaluate(()=>localStorage.getItem('raven_deleted_name_preview_v2')),'{"synthetic":"keep byte-for-byte"}');
      assert.deepEqual(errors,[],'no runtime page errors');
    }finally{await context.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  }
  const card=(scope,slug)=>scope.locator(`[data-atmosphere-card="${slug}"]`);
  const mediaRequests=fixture=>fixture.requests.filter(request=>VIDEO_PATH.test(request.path));
  const snapshot=page=>page.evaluate(()=>JSON.stringify({local:Object.entries(localStorage).sort(),session:Object.entries(sessionStorage).sort()}));
  async function plays(video) {
    await eventually(()=>video.evaluate(media=>!media.paused&&!media.error&&media.readyState>=2&&media.videoWidth===1280&&media.currentTime>0.03),'real video must decode and advance after explicit play');
  }
  async function fits(scope,width) {
    assert.equal(await scope.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1),true,'page has no horizontal overflow');
    const boxes=await scope.locator('[data-atmosphere-play]:visible,[data-atmosphere-retry]:visible').evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return{width:b.width,height:b.height,left:b.left,right:b.right};}));
    for(const box of boxes){assert.ok(box.width>=44&&box.height>=44,'manual controls meet 44px targets');assert.ok(box.left>=-1&&box.right<=width+1,'controls fit horizontally');}
    for(const box of await scope.locator('[data-atmosphere-video]').evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return{width:b.width,height:b.height};})))assert.ok(Math.abs(box.width/box.height-16/9)<0.04,'original landscape composition is retained');
  }
  async function localized(scope,language) {
    assert.equal(await scope.locator('#raven-atmosphere-title').innerText(),language==='ar'?'أجواء RAVEN':'RAVEN atmosphere');
    assert.match(await scope.locator('#raven-atmosphere-note').innerText(),language==='ar'?/ليست أدلة/:/not evidence/);
    for(const title of await scope.locator('[data-atmosphere-play]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label'))))assert.ok(language==='ar'?/[\u0600-\u06ff]/.test(title):!/[؀-ۿ]/.test(title),'control labels use the selected language');
  }

  for(const width of [320,390,1440])for(const language of ['ar','en'])await t.test(`${language} ${width}: manual playback, one clip at a time and unchanged case entry`,async()=>{
    await withPage({width,language},async({page,scope,fixture})=>{
      await localized(scope,language);await fits(scope,width);
      assert.equal(await scope.locator('[data-atmosphere-video]').count(),3);
      assert.equal(await page.locator('#music-track-picker option').count(),13);
      assert.equal(await scope.locator('#ravenHeroMotion').getAttribute('poster'),'./terminal-preview/assets/hero-poster.jpg');
      assert.equal(await scope.locator('#raven-atmosphere').evaluate(el=>Boolean(document.querySelector('#dialogue-preview').compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)&&Boolean(el.compareDocumentPosition(document.querySelector('#archive-experience'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
      await scope.locator('#raven-atmosphere').scrollIntoViewIfNeeded();
      const initial=await scope.locator('[data-atmosphere-video]').evaluateAll(nodes=>nodes.map(media=>({paused:media.paused,muted:media.muted,auto:media.autoplay,loop:media.loop,preload:media.preload,currentTime:media.currentTime})));
      assert.ok(initial.every(media=>media.paused&&media.muted&&!media.auto&&!media.loop&&media.preload==='none'&&media.currentTime===0));
      const backstageLink = scope.locator('#studio').getByRole('link', {
        name: language === 'ar' ? 'افتح مقطع «الورق والهاتف»' : 'Open the Paper and phone clip',
        exact: true
      });
      await backstageLink.press('Enter');
      const selectedCard = scope.locator('[data-atmosphere-card]').last();
      const selectedTitle = selectedCard.getByRole('heading', {name: language === 'ar' ? 'الورق والهاتف' : 'Paper and phone', exact: true});
      await eventually(() => selectedTitle.evaluate(el => el === document.activeElement && el.matches(':target')), 'backstage link focuses the selected clip in its original slot');
      assert.equal(await selectedCard.locator('video').getAttribute('src'), './assets/atmosphere-v1/paper-detail.mp4');
      assert.equal(mediaRequests(fixture).length,0,'scrolling to the gallery does not fetch MP4s');
      const before=await snapshot(page);
      if(ARTIFACTS&&width!==320){
        const filename=path.join(ARTIFACTS,`gallery-${language}-${width}.png`);
        // Capture the real viewport: a tall iframe-element screenshot clips its fixed chrome.
        await scope.locator('#raven-atmosphere').evaluate(el=>window.scrollTo({top:scrollY+el.getBoundingClientRect().top-82,behavior:'instant'}));
        await page.waitForTimeout(1800); // Let native preload=none control animations settle, without fetching video.
        assert.equal(mediaRequests(fixture).length,0);
        await page.mouse.move(1,1);await page.screenshot({path:filename});fs.chmodSync(filename,0o600);
      }
      for(const slug of SLUGS){const entry=card(scope,slug),video=entry.locator('video');await entry.locator('[data-atmosphere-play]').focus();await page.keyboard.press('Enter');await plays(video);assert.equal(await scope.locator('[data-atmosphere-video]').evaluateAll(nodes=>nodes.filter(media=>!media.paused).length),1);assert.equal(await video.evaluate(media=>media.muted),true);}
      const last=card(scope,'over-shoulder');await last.locator('[data-atmosphere-play]').click();assert.equal(await last.locator('video').evaluate(media=>media.paused),true);
      assert.deepEqual([...new Set(mediaRequests(fixture).map(request=>request.path.match(VIDEO_PATH)[1]))].sort(),[...SLUGS].sort(),'all three real files were decoded');
      assert.equal(await snapshot(page),before,'gallery does not write browser storage');
      assert.equal(await page.locator('#site-soundtrack').evaluate(media=>media.paused),true,'gallery does not start music');
      await scope.locator('#rvnHeroEnterDeletedName').click();await scope.locator('[data-hook-action="open"]').waitFor();
      assert.equal(await scope.locator('#hook').getAttribute('data-phase'),'start');assert.equal(await scope.locator('html').getAttribute('lang'),language);
      assert.equal(await page.locator('#site-soundtrack').count(),1);
    });
    results.push({name:`manual ${language} ${width}`,result:'PASS'});
  });

  for(const language of ['ar','en'])await t.test(`${language}: failed media retries only on request, with language and keyboard focus preserved`,async()=>{
    await withPage({language,failSlug:'paper-detail',failPoster:'archive-opening'},async({page,scope,fixture})=>{
      const failed=card(scope,'paper-detail');await failed.locator('[data-atmosphere-play]').focus();await page.keyboard.press('Enter');
      await failed.locator('[data-atmosphere-retry]').waitFor({state:'visible'});
      assert.equal(await failed.locator('[data-atmosphere-retry]').evaluate(el=>document.activeElement===el),true,'failure moves keyboard focus to retry');
      assert.match(await failed.locator('[data-atmosphere-status]').innerText(),language==='ar'?/تعذّر/:/could not play/);
      const failedCount=mediaRequests(fixture).length;
      const other=language==='ar'?'en':'ar';await scope.locator(`[data-raven-language="${other}"]`).click();await localized(scope,other);
      assert.equal(await failed.locator('[data-atmosphere-retry]').isVisible(),true);
      assert.match(await failed.locator('[data-atmosphere-status]').innerText(),other==='ar'?/تعذّر/:/could not play/);
      assert.equal(mediaRequests(fixture).length,failedCount,'language rendering never retries a failed file');
      const before=await snapshot(page);fixture.failSlug=null;
      await failed.locator('[data-atmosphere-retry]').focus();await page.keyboard.press('Enter');await plays(failed.locator('video'));
      assert.equal(await failed.locator('[data-atmosphere-play]').evaluate(el=>document.activeElement===el&&!el.hidden),true,'successful retry returns keyboard focus to a visible playback button');
      assert.equal(await snapshot(page),before);
      const brokenPoster=card(scope,'archive-opening');await brokenPoster.locator('[data-atmosphere-play]').click();await plays(brokenPoster.locator('video'));
      assert.equal(await failed.locator('video').evaluate(media=>media.paused),true);
      await fits(scope,390);await scope.locator('#rvnHeroEnterDeletedName').click();await scope.locator('#hook').waitFor();
      assert.equal(await scope.locator('html').getAttribute('lang'),other);
    });
    results.push({name:`media recovery ${language}`,result:'PASS'});
  });

  await t.test('reduced motion waits for a gesture and preserves a playing clip across language rendering',async()=>{
    await withPage({reducedMotion:'reduce',language:'ar'},async({page,scope,fixture})=>{
      await scope.locator('#raven-atmosphere').scrollIntoViewIfNeeded();assert.equal(mediaRequests(fixture).length,0);
      const entry=card(scope,'archive-opening'),video=entry.locator('video'),handle=await video.elementHandle();
      await entry.locator('[data-atmosphere-play]').click();await plays(video);const time=await video.evaluate(media=>media.currentTime);
      await scope.locator('[data-raven-language="en"]').click();await localized(scope,'en');
      assert.equal(await handle.evaluate(media=>media.isConnected),true,'language change retains the media element');
      assert.ok(await video.evaluate((media,before)=>media.currentTime>=before,time));await plays(video);
      await scope.locator('.rvnHeroWatch').click();
      await page.waitForURL(url => url.pathname.endsWith('/raven/episodes/'));
      assert.equal(await scope.locator('[data-atmosphere-card] video').count(),0,'leaving the homepage unloads its clips');
      await scope.locator('[data-visual-episode="1"]').click();
      await scope.locator('#episodeModal.open').waitFor();
      assert.equal(await scope.locator('[data-rvn-episode]').count(),3);
      await page.keyboard.press('Escape');await scope.locator('#episodeModal.open').waitFor({state:'hidden'});
    });
    results.push({name:'reduced motion, language and original-film handoff',result:'PASS'});
  });

  await t.test('a delayed earlier play cannot interrupt the newly selected real clip',async()=>{
    await withPage({holdSlug:'archive-opening'},async({scope,fixture})=>{
      const first=card(scope,'archive-opening'),last=card(scope,'paper-detail');
      await first.locator('[data-atmosphere-play]').click();await eventually(()=>fixture.held.length>0,'first real media request must be held');
      await last.locator('[data-atmosphere-play]').click();await plays(last.locator('video'));
      fixture.holdSlug=null;fixture.held.splice(0).forEach(release=>release());
      await eventually(()=>last.locator('video').evaluate(media=>media.currentTime>0.3&&!media.paused),'last selection remains playing after the earlier request resolves');
      assert.equal(await first.locator('video').evaluate(media=>media.paused),true);
    });
    results.push({name:'late earlier media request',result:'PASS'});
  });

  await t.test('a silent atmosphere clip does not pause user-started background music',async()=>{
    await withPage({reducedMotion:'reduce'},async({page,scope})=>{
      await page.locator('#music-toggle').click();
      await eventually(()=>page.locator('#site-soundtrack').evaluate(media=>!media.paused&&media.currentTime>0.03),'original local soundtrack starts from its own control');
      const before=await page.locator('#site-soundtrack').evaluate(media=>media.currentTime);
      await card(scope,'archive-opening').locator('[data-atmosphere-play]').click();await plays(card(scope,'archive-opening').locator('video'));
      await eventually(()=>page.locator('#site-soundtrack').evaluate((media,time)=>!media.paused&&media.currentTime>time,before),'silent gallery preserves continuous background music');
      await page.locator('#music-toggle').click();assert.equal(await page.locator('#site-soundtrack').evaluate(media=>media.paused),true);
    });
    results.push({name:'continuous user-started music',result:'PASS'});
  });
});
