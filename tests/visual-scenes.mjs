// Check the published homepage and studio at the real GitHub Pages path prefix.
// RAVEN_VISUAL_URL=http://127.0.0.1:3120/abdulrhman/ node tests/visual-scenes.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_TEST_MODULE || 'playwright');
const base=(process.env.RAVEN_VISUAL_URL || 'http://127.0.0.1:3120/abdulrhman/').replace(/\/?$/,'/');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
await context.addInitScript(()=>{sessionStorage.setItem('raven_studio_ident_v1','1');sessionStorage.setItem('raven_music_enabled_v2','off');});
const page=await context.newPage(),errors=[],missing=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400 && /visual-lab|raven-visual-scenes|\/studio\/assets\//.test(r.url())) missing.push(`${r.status()} ${r.url()}`);});
// External legacy providers are unrelated to these local assets and can be offline.
await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
try {
 await page.goto(base+'raven/#studio',{waitUntil:'domcontentloaded'});
 const skip=page.locator('#archive-skip');
 if(await skip.count())await skip.click();
 const frame=page.frameLocator('#site-content');
 const study=frame.locator('#raven-visual-scenes');
 await study.waitFor({timeout:20000});
 await study.scrollIntoViewIfNeeded();
 await study.locator('img').evaluateAll(async imgs=>{for(const img of imgs)img.loading='eager';await Promise.all(imgs.map(img=>img.decode()));});
 assert.equal(await study.locator('img').count(),4);
 const ratios=await study.locator('img').evaluateAll(imgs=>imgs.map(img=>{const r=img.getBoundingClientRect();return r.width/r.height;}));
 assert.ok(ratios.every(ratio=>Math.abs(ratio-16/9)<0.01),'Scene thumbnails keep their landscape aspect ratio.');
 assert.equal(await frame.locator('[data-rvn-episode]').count(),3);
 const film=study.locator('video');
 assert.equal(await film.evaluate(v=>v.paused),true);
 for(const [name,time] of [['manor',1],['archive',6.75],['desk',12.5],['corridor',18.25]]){
   await study.locator(`[data-visual-name="${name}"]`).click();
   await page.waitForFunction(({time})=>{const v=document.querySelector('#site-content').contentDocument.querySelector('#ravenVisualFilm');return Math.abs(v.currentTime-time)<0.1 && !v.seeking;},{time});
   assert.equal(await study.locator(`[data-visual-name="${name}"]`).getAttribute('aria-pressed'),'true');
 }
 await film.evaluate(v=>v.play());
 await page.waitForFunction(()=>document.querySelector('#site-content').contentDocument.querySelector('#ravenVisualFilm').currentTime>18.5);
 await study.locator('[data-visual-format="portrait"]').click();
 await page.waitForFunction(()=>{const v=document.querySelector('#site-content').contentDocument.querySelector('#ravenVisualFilm');return v.videoWidth===1080 && v.currentTime>18.5 && !v.paused;});
 await film.evaluate(v=>v.pause());
 await study.locator('[data-visual-sound]').click();
 assert.equal(await film.evaluate(v=>v.muted),false);
 await study.locator('[data-visual-sound]').click();
 assert.equal(await film.evaluate(v=>v.muted),true);
 await study.locator('[data-visual-format="landscape"]').click();
 await study.locator('[data-visual-name="archive"]').click();
 await page.waitForFunction(()=>{const v=document.querySelector('#site-content').contentDocument.querySelector('#ravenVisualFilm');return v.videoWidth===1920 && Math.abs(v.currentTime-6.75)<0.1 && !v.seeking;});
 await study.locator('.rvnVisualHeading').scrollIntoViewIfNeeded();
 if(process.env.RAVEN_VISUAL_SCREENSHOTS)await page.screenshot({path:process.env.RAVEN_VISUAL_SCREENSHOTS+'/home-desktop.png'});
 for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   assert.equal(await frame.locator('html').evaluate(el=>el.scrollWidth===el.clientWidth),true);
   await study.locator('.rvnVisualHeading').scrollIntoViewIfNeeded();
   if(process.env.RAVEN_VISUAL_SCREENSHOTS)await page.screenshot({path:process.env.RAVEN_VISUAL_SCREENSHOTS+`/home-${width}.png`});
 }
 await page.setViewportSize({width:1440,height:1100});
 await frame.locator('[data-raven-language="en"]').click();
 await study.locator('[data-visual-text="title"]').filter({hasText:'Scenes from RAVEN'}).waitFor();
 await study.locator('.rvnVisualStudioLink').click();
 await page.waitForURL(url=>url.pathname.endsWith('/studio/') && url.searchParams.get('lang')==='en');
 await page.locator('#project-preview').waitFor();
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 assert.equal(await page.locator('#project-preview img').count(),4);
 assert.match(await page.locator('video').getAttribute('src'),/\/abdulrhman\/studio\/visual-lab\/media\/raven-landscape.mp4$/);
 await page.locator('video').evaluate(v=>v.play());
 await page.waitForFunction(()=>document.querySelector('video').currentTime>0.5);
 await page.locator('video').evaluate(v=>v.pause());
 await page.getByRole('button',{name:'Scene library',exact:true}).click();
 assert.equal(await page.locator('article').count(),4);
 await page.locator('article').nth(2).getByRole('button').click();
 await page.waitForFunction(()=>Math.abs(document.querySelector('video').currentTime-12.5)<0.1);
 if(process.env.RAVEN_VISUAL_SCREENSHOTS)await page.screenshot({path:process.env.RAVEN_VISUAL_SCREENSHOTS+'/studio.png'});
 const home=page.getByRole('link',{name:'Open RAVEN Archive'});
 assert.equal(await home.getAttribute('href'),'/abdulrhman/raven/index.html?lang=en');
 await home.click();
 await page.waitForURL(url=>url.pathname.endsWith('/raven/index.html'));
 await page.frameLocator('#site-content').locator('#raven-visual-scenes').waitFor();
 assert.deepEqual(errors,[]);
 assert.deepEqual(missing,[]);
 console.log('PASS: homepage film, four scenes, format/position/playback, sound, AR/EN, mobile 390/320, published studio paths, image library and return to RAVEN. Existing three episode entries preserved.');
}finally{await browser.close();}
