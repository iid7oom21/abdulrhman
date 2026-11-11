// Rendered-scene checks: real local atlases, decorative semantics and unchanged play state.
// CHROMIUM_PATH=/usr/bin/chromium node --test tests/scene-art.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_TEST_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const artwork = {
  'case-cover': {file:'case-scenes-v1.webp', row:0, cover:true},
  'doorway-threshold': {file:'case-scenes-v1.webp', row:1},
  'unsigned-paper': {file:'case-scenes-v1.webp', row:2},
  'private-notebook': {file:'investigation-scenes-v1.webp', row:0},
  'materials-before-sharing': {file:'investigation-scenes-v1.webp', row:1},
  'quiet-ending': {file:'investigation-scenes-v1.webp', row:2}
};

test('scene illustrations load, crop correctly and remain separate from player evidence', async t => {
  const server = http.createServer((req,res) => {
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405);return res.end();}
    let pathname = new URL(req.url,'http://local').pathname;
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root,'.'+pathname);
    if (!file.startsWith(root+path.sep)) {res.writeHead(403);return res.end();}
    const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg'};
    try {res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');res.end(fs.readFileSync(file));}
    catch {res.writeHead(404);res.end();}
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:'+server.address().port;
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));});

  const art = (view,id) => view.locator('[data-scene-art="'+id+'"]');
  async function checkArt(view,id) {
    const container = art(view,id), expected = artwork[id];
    assert.equal(await container.count(),1,id+' is placed once in this scene');
    await container.scrollIntoViewIfNeeded();
    assert.equal(await container.isVisible(),true,id+' is visible at its intended stage');
    await container.locator('img').evaluate(async image => {
      if (!image.complete) await new Promise((resolve,reject)=>{
        image.addEventListener('load',resolve,{once:true});
        image.addEventListener('error',()=>reject(new Error('Scene image failed: '+image.src)),{once:true});
      });
    });
    const geometry = await container.evaluate(el=>{
      const img=el.querySelector('img'),box=el.getBoundingClientRect(),image=img.getBoundingClientRect(),style=getComputedStyle(el);
      return {src:img.currentSrc || img.src,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,alt:img.getAttribute('alt'),
        width:box.width,height:box.height,imageWidth:image.width,imageHeight:image.height,offsetY:image.top-box.top,offsetX:image.left-box.left,
        overflow:style.overflow,viewport:innerWidth,interactive:el.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])').length,
        sourceMetadata:el.querySelectorAll('[data-line-id],[data-source-id],[data-part]').length};
    });
    assert.ok(geometry.naturalWidth>0 && geometry.naturalHeight>0,id+' loaded the real atlas');
    assert.ok(new URL(geometry.src).pathname.endsWith('/'+expected.file),id+' uses its designated atlas');
    assert.equal(geometry.alt,'',id+' is decorative, not a newly readable document');
    assert.equal(geometry.interactive,0,id+' adds no player action');
    assert.equal(geometry.sourceMetadata,0,id+' adds no evidence/source identifiers');
    assert.ok(['hidden','clip'].includes(geometry.overflow),id+' clips the other atlas rows');
    assert.ok(Math.abs(geometry.width/geometry.height-2)<0.03,id+' displays one 2:1 scene');
    assert.ok(Math.abs(geometry.imageWidth-geometry.width)<2,id+' fills the intended width');
    assert.ok(Math.abs(geometry.imageHeight-geometry.height*3)<3,id+' retains exactly three atlas rows');
    assert.ok(Math.abs(geometry.offsetY+expected.row*geometry.height)<2,id+' shows the intended physical row in either writing direction');
    assert.ok(Math.abs(geometry.offsetX)<2,id+' stays horizontally aligned in RTL and LTR');
    if (!expected.cover) assert.ok(geometry.width<=361,id+' remains compact beside the reading content');
    assert.ok(geometry.width<=geometry.viewport,id+' fits this viewport');
  }
  const layers = view => view.locator('#hook').getAttribute('data-layers');
  const sources = view => view.locator('#reading-source option').evaluateAll(options=>options.map(option=>option.value));

  for (const width of [320,390,1280]) for (const language of ['ar','en']) {
    await t.test(language+' at '+width+'px: six scene placements and unchanged investigation boundaries',async()=>{
      const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      t.after(()=>context.close());
      await context.addInitScript(()=>{
        sessionStorage.setItem('raven_studio_ident_v1','1');
        sessionStorage.setItem('raven_music_enabled_v2','off');
        localStorage.setItem('other_app_preferences','scene-art-keep');
      });
      const page=await context.newPage(),errors=[],writes=[];
      page.setDefaultTimeout(15000);
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>{
        if (!['GET','HEAD'].includes(route.request().method())) writes.push(route.request().url());
        return route.request().url().startsWith(base+'/') ? route.continue() : route.abort();
      });

      await page.goto(base+'/raven/?lang='+language,{waitUntil:'domcontentloaded'});
      const home=page.frameLocator('#site-content');
      await checkArt(home,'case-cover');
      assert.equal(await page.locator('#music-track-picker option').count(),13);
      assert.equal(await home.locator('[data-rvn-episode]').count(),3);
      await home.locator('[data-dn-k="enter"]').click();
      const opening=page.frameLocator('#site-content');
      await opening.locator('#hook').waitFor();
      const storedBefore=await opening.locator('html').evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
      assert.equal(await opening.locator('html').getAttribute('lang'),language);
      await checkArt(opening,'case-cover');
      assert.equal(await art(opening,'doorway-threshold').isVisible(),false);
      assert.equal(await art(opening,'unsigned-paper').isVisible(),false);
      assert.equal(await art(opening,'quiet-ending').isVisible(),false);
      const action=id=>opening.locator('[data-hook-action="'+id+'"]');
      await action('open').click();
      await checkArt(opening,'doorway-threshold');
      await action('enter').click();
      assert.equal(await art(opening,'doorway-threshold').isVisible(),false,'the threshold belongs only to the invitation stage');
      assert.equal(await art(opening,'quiet-ending').isVisible(),false,'the ending must not appear while comparing the paper');
      await checkArt(opening,'unsigned-paper');
      const before=await layers(opening),sourceIds=await sources(opening);
      const spokenIds=await opening.locator('#hook-log li[data-kind="spoken"][data-line-id]').evaluateAll(rows=>rows.map(row=>row.dataset.lineId));
      assert.deepEqual(sourceIds,['','document-original','document-conclusion','document-signature',...spokenIds]);
      assert.equal(await opening.locator('#hook-document [data-part="original"] .hook-part').innerText(),await opening.locator('[data-k="m2"]').innerText());
      assert.equal(await opening.locator('#hook-document [data-part="conclusion"] .hook-part').innerText(),language==='ar'
        ? 'وبناءً على هذه المراجعة، اختلاف النسخ لا يغير نتيجة الملف.'
        : 'Based on this review, the difference between copies does not change the file’s result.');
      assert.match(await opening.locator('#hook-document [data-part="signature"] .hook-part').innerText(),/غير موقّع|unsigned/);
      // Clicking decorative art must not select a source, reveal dialogue or change a choice.
      const paperBox=await art(opening,'unsigned-paper').boundingBox();
      await page.mouse.click(paperBox.x+paperBox.width/2,paperBox.y+paperBox.height/2);
      assert.equal(await opening.locator('#hook').getAttribute('data-phase'),'compare');
      assert.equal(await layers(opening),before);
      await opening.locator('#reading-details > summary').click();
      await checkArt(opening,'private-notebook');
      assert.deepEqual(await sources(opening),sourceIds,'notebook art does not become a source');
      await opening.locator('#reading-source').selectOption('document-original');
      await opening.locator('#reading-note').fill('PRIVATE_SCENE_ART_TEST');
      await opening.locator('#reading-add').click();
      assert.equal(await layers(opening),before,'private notes do not share scene illustrations or materials');
      await action('continue').click();
      assert.equal(await opening.locator('#hook-actions [data-hook-action]').count(),4);
      assert.equal(await art(opening,'quiet-ending').isVisible(),false);
      await action('wait').click();await action('confirm').click();await action('record').click();
      await checkArt(opening,'quiet-ending');
      assert.equal(await opening.locator('#hook-log [data-line-id="L20"] > p').innerText(),language==='ar'
        ? 'طيب ليش المسودة تقول إن اختلاف النسخ ما يغير نتيجة الملف؟'
        : 'Then why does the draft say that differences between copies do not change the file’s result?');
      assert.deepEqual(JSON.parse(await layers(opening)).recipientKnowledge,{jonas:[],claire:[],elena:[]});
      assert.equal(await opening.locator('#hook').getAttribute('data-phase'),'done');
      assert.deepEqual(await opening.locator('html').evaluate(()=>Object.fromEntries(Object.entries(localStorage))),storedBefore,'decorative art and private notes do not write or erase local data');
      assert.equal(await opening.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1),true);

      await page.goto(base+'/raven/dialogue/?lang='+language,{waitUntil:'domcontentloaded'});
      await page.locator('#materials-panel summary').click();
      await checkArt(page,'materials-before-sharing');
      assert.equal(await page.locator('#materials-list .material').count(),0);
      const received=await page.evaluate(async()=>await (await fetch('/api/knowledge?characterId=jonas')).json());
      assert.deepEqual(received.materials,[],'the illustration never creates a received material');
      assert.equal(await page.evaluate(()=>localStorage.getItem('other_app_preferences')),'scene-art-keep');
      assert.equal(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1),true);
      assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
      await context.close();
    });
  }
});
