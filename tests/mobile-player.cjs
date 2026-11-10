// Local browser regression for touch targets and episode/case actions beside the persistent player.
// CHROMIUM_PATH=/usr/bin/chromium node --test tests/mobile-player.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_TEST_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');

test('mobile player leaves episode and case controls reachable in both orientations and languages',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'raven-player-test-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const fixture=path.join(directory,'episode.mp4');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=black:s=160x90:r=2','-t','4','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',fixture]);
  const video=fs.readFileSync(fixture);
  const server=http.createServer((req,res)=>{
    let pathname=new URL(req.url,'http://local').pathname;if(pathname.endsWith('/'))pathname+='index.html';
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
    try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
    catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));});
  const sizes=[{width:320,height:844},{width:390,height:844},{width:844,height:320},{width:844,height:390}];
  const intersects=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));

  for(const size of sizes)for(const language of ['ar','en'])await t.test(language+' '+size.width+'×'+size.height,async()=>{
    const context=await browser.newContext({viewport:size,reducedMotion:'reduce'});t.after(()=>context.close());
    await context.addInitScript(()=>{
      sessionStorage.setItem('raven_studio_ident_v1','1');
      sessionStorage.setItem('raven_music_enabled_v2','off');
      localStorage.setItem('other_app_preferences','mobile-player-keep');
    });
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      if(/\/episode-\d\.mp4(?:\?|$)/.test(route.request().url()))return route.fulfill({contentType:'video/mp4',body:video});
      return route.request().url().startsWith(base+'/')?route.continue():route.abort();
    });
    await page.goto(base+'/raven/?lang='+language,{waitUntil:'domcontentloaded'});
    const frame=page.frameLocator('#site-content');
    await frame.locator('[data-dn-k="enter"]').waitFor();
    const controls=await page.locator('#music-prev,#music-toggle,#music-next,#music-settings > summary').evaluateAll(elements=>elements.map(el=>{
      const b=el.getBoundingClientRect();return{id:el.id,x:b.x,y:b.y,width:b.width,height:b.height};
    }));
    for(const control of controls){
      assert.ok(control.width>=44&&control.height>=44,control.id+' meets a 44×44 CSS-pixel target');
      assert.ok(control.x>=0&&control.x+control.width<=size.width+1,control.id+' fits horizontally');
    }
    if(size.width<=390){
      assert.ok(Math.max(...controls.map(c=>c.y))-Math.min(...controls.map(c=>c.y))<2,'the compact controls stay on one row');
      assert.ok((await page.locator('.site-player').boundingBox()).height<=46,'closed portrait dock stays compact');
    }
    assert.equal(await page.locator('#music-track-picker option').count(),26);
    assert.equal(await frame.locator('[data-rvn-episode]').count(),3);
    async function reachable(selector){
      const target=frame.locator(selector);await target.click({trial:true});
      const targetBox=await target.boundingBox(),playerBox=await page.locator('.site-player').boundingBox();
      assert.ok(intersects(targetBox,playerBox)<=targetBox.width,selector+' is not covered by the sound player beyond subpixel edge rounding');
      const surface=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,{x:targetBox.x+targetBox.width/2,y:targetBox.y+targetBox.height/2});
      assert.equal(surface,'site-content',selector+' has a reachable center in the content frame');
      assert.ok(targetBox.y>=-1&&targetBox.y+targetBox.height<=size.height+1,selector+' is inside the visible viewport');
      return target;
    }
    await reachable('[data-dn-k="enter"]');
    await page.locator('#music-settings > summary').click();
    // Expanded settings intentionally use reading space. Their close control must
    // remain operable before the player returns to the compact dock.
    await page.locator('#music-settings > summary').click({trial:true});
    const expanded=await page.locator('.site-player').boundingBox();
    assert.ok(expanded.y>=-1&&expanded.y+expanded.height<=size.height+1,'expanded sound settings fit the screen height');
    for(const selector of ['#music-track-picker','#music-volume','#music-mute','#music-cinematic','.music-download']){
      const control=page.locator(selector);await control.click({trial:true});
      const box=await control.boundingBox();
      assert.ok(box.x>=-1&&box.x+box.width<=size.width+1&&box.y>=-1&&box.y+box.height<=size.height+1,selector+' stays inside the expanded settings viewport');
    }
    assert.equal(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1),true);
    assert.ok((await page.locator('#music-mute').boundingBox()).height>=44);
    await page.locator('#music-settings > summary').click();
    await (await reachable('.rvnHeroWatch')).click();
    await frame.locator('#episodeModal.open').waitFor();
    await (await reachable('#rvnNextEpisode')).click();
    await frame.locator('#ravenEpisodePlayer[src$="episode-2.mp4"]').waitFor();
    await (await reachable('#rvnPrevEpisode')).click();
    await frame.locator('#ravenEpisodePlayer[src$="episode-1.mp4"]').waitFor();
    await reachable('#rvnShareEpisode');
    await frame.locator('#ravenEpisodePlayer').evaluate(async media=>{await media.play();media.currentTime=media.duration-.1;});
    await frame.locator('#rvnAfterCredits').waitFor({state:'visible'});
    await (await reachable('#rvnAfterNext')).click();
    await frame.locator('#ravenEpisodePlayer[src$="episode-2.mp4"]').waitFor();
    await (await reachable('.episodeClose')).click();
    await (await reachable('[data-dn-k="enter"]')).click();
    await (await reachable('[data-hook-action="open"]')).click();
    await (await reachable('[data-hook-action="enter"]')).click();
    await (await reachable('[data-hook-action="continue"]')).click();
    await (await reachable('[data-hook-action="wait"]')).click();
    await (await reachable('[data-hook-action="confirm"]')).click();
    await (await reachable('[data-hook-action="record"]')).click();
    await (await reachable('[data-hook-action="replay"]')).click();
    assert.equal(await frame.locator('#hook').getAttribute('data-phase'),'start');
    assert.equal(await frame.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1),true);
    assert.equal(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1),true);
    assert.equal(await page.locator('#site-soundtrack').evaluate(media=>media.paused),true);
    assert.equal(await page.evaluate(()=>localStorage.getItem('other_app_preferences')),'mobile-player-keep');
    assert.deepEqual(errors,[]);await context.close();
  });
});
