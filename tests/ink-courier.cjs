/* Chromium acceptance on the Pages project prefix, or a started main export.
 * RAVEN_QA_HOME=http://127.0.0.1:10000/abdulrhman/raven/ RAVEN_QA_RENDER=1
 * INK_QA_DIR=/tmp/raven-courier CHROMIUM_PATH=/usr/bin/chromium node --test tests/ink-courier.cjs
 */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {chromium, expect} = require('playwright/test');

const root = path.resolve(__dirname, '..');
const output = process.env.INK_QA_DIR;
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2',
  '.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml',
  '.json':'application/json','.mp3':'audio/mpeg','.mp4':'video/mp4'};
const victory = [15,10,5,0,1,2,3,4,9,14,19,24];
const lastStepVictory = [15,10,5,0,1,0,1,2,3,2,3,4,9,14,19,24];
const soaked = [21,16,11,6,1];
const wetLimit = [15,10,5,0,1,6,1,6];
const parked = Array.from({length:16},(_,i)=>i%2 ? 20 : 15);
const draftKey = 'raven.late-night.v1.draft.ink-courier';
const projectPath = '/abdulrhman/';
const activities = {
  cut:'[data-cut-action=add-pier]', camera:'[data-camera=travel]', ferry:'[data-viewpoint=shore]',
  page:'[data-page=pick-window]', beacon:'[data-beacon=step]', courier:'[data-cell="15"]',
  lines:'[data-scene=smear]', letters:'[data-scene=line-0]'
};

async function site(t) {
  if (process.env.RAVEN_QA_HOME) return new URL(process.env.RAVEN_QA_HOME).href;
  const server = http.createServer(async (request,response)=>{
    const route = new URL(request.url,'http://fixture').pathname;
    if (!route.startsWith(projectPath)) return response.writeHead(404).end();
    const file = path.resolve(root,route.slice(projectPath.length),route.endsWith('/')?'index.html':'');
    if (!file.startsWith(root+path.sep)) return response.writeHead(404).end();
    try {response.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');
      response.end(await fs.readFile(file));} catch {response.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return 'http://127.0.0.1:'+server.address().port+projectPath+'raven/';
}

const cell = (page,n)=>page.locator('[data-cell="'+n+'"]');
const status = page=>page.locator('#status');
const action = (field,touch)=>touch ? field.tap() : field.press('Enter');
async function moves(page,route,touch) {
  let position = Number(await page.locator('[data-cell][aria-current=true]').getAttribute('data-cell'));
  const confirm = page.locator('#confirm');
  for (const destination of route) {
    if (touch) await cell(page,destination).tap();
    else {
      const key = {[-5]:'ArrowUp',[5]:'ArrowDown',[-1]:'ArrowLeft',[1]:'ArrowRight'}[destination-position];
      assert.ok(key,'fixture must move exactly one square');
      await cell(page,position).focus();
      await page.keyboard.press(key);
      await expect(cell(page,destination)).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(confirm).toBeFocused();
    }
    await expect(confirm).toBeEnabled();
    await action(confirm,touch);
    await expect(cell(page,destination)).toHaveAttribute('aria-current','true');
    position = destination;
  }
}

async function snapshot(page,name) {
  if (!output) return;
  await fs.mkdir(output,{recursive:true});
  await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});
}
async function readDownload(page,button) {
  const event = page.waitForEvent('download');
  await button.click();
  const download = await event;
  assert.equal(await download.failure(),null);
  return {name:download.suggestedFilename(),bytes:await fs.readFile(await download.path())};
}

test('Ink Nights programme and the Rain Courier round', {timeout:240000}, async t=>{
  const home = await site(t);
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium'});
  t.after(()=>browser.close());
  const room = new URL('late-night/',home).href;
  const rows = [];
  for (const lang of ['ar','en']) await t.test('visitors can enter each approved workshop in '+lang,async()=>{
    const context = await browser.newContext({locale:lang,viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
    try {
      const page=await context.newPage();
      await page.goto(home+'?lang='+lang);
      await page.locator('#archive-night-hub').tap();
      await page.locator('[data-ink-program]').tap();
      const cards = page.locator('[data-ink-route]');
      await expect(cards).toHaveCount(Object.keys(activities).length);
      const links = await cards.evaluateAll(nodes=>nodes.map(a=>[a.dataset.inkRoute,a.href]));
      assert.deepEqual(links.map(([id])=>id).sort(),Object.keys(activities).sort());
      for (const [id,url] of links) {
        const response = await page.goto(url);
        assert.equal(response.status(),200,id);
        if(process.env.RAVEN_QA_RENDER) {
          const csp = response.headers()['content-security-policy'] || '';
          const scriptPolicy = csp.split(';').find(rule=>rule.trim().startsWith('script-src '));
          assert.ok(scriptPolicy?.includes("'self'"),id+' should authorize its local module');
          assert.doesNotMatch(scriptPolicy,/'unsafe-inline'|'unsafe-eval'|https?:/);
        }
        await expect(page.locator('html')).toHaveAttribute('lang',lang);
        const work=page.locator(activities[id]);
        if(id==='camera')await work.fill('61');else await work.tap();
        if(id==='courier'){await page.locator('#confirm').tap();await expect(cell(page,15)).toHaveAttribute('aria-current','true');}
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id+' fits the screen');
      }
      if(process.env.RAVEN_QA_RENDER) for(const file of ['ink/art/private-reference.webp','author-notes.json','manga/owner-notes.js']) {
        const response=await context.request.get(new URL(file,room).href);
        assert.equal(response.status(),404,file);
      }
    } finally {await context.close();}
  });

  for (const width of [320,390,1280]) for(const lang of ['ar','en']) {
    const touch = width<600, label = lang+'-'+width;
    await t.test(label+' from departure to an editable, downloadable manga',async()=>{
      const context = await browser.newContext({viewport:{width,height:844},hasTouch:touch,isMobile:touch,
        locale:lang,reducedMotion:'reduce',acceptDownloads:true});
      try{
        const page=await context.newPage(),errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(room+'ink-courier.html?lang='+lang);
        await expect(status(page)).toHaveAttribute('data-outcome','playing');
        await expect(page.locator('html')).toHaveAttribute('dir',lang==='ar'?'rtl':'ltr');
        // Inspecting a blocked, non-neighbour or current cell never spends a step.
        for (const n of [7,4,20]) {
          await action(cell(page,n),touch);
          await expect(page.locator('#confirm')).toBeDisabled();
          await expect(cell(page,20)).toHaveAttribute('aria-current','true');
        }
        await moves(page,victory.slice(0,2),touch);
        const head = await page.locator('#steps-meter').innerText();
        for(let i=0;i<10;i++) await action(page.locator('[data-night-language]'),touch);
        await expect(page.locator('html')).toHaveAttribute('lang',lang);
        await expect(page.locator('#steps-meter')).toHaveText(head);
        await expect(cell(page,10)).toHaveAttribute('aria-current','true');
        // Leave via the actual return control, then restore with the browser Back button.
        await action(page.locator('#back'),touch);await expect(page.locator('[data-ink-route=courier]')).toBeVisible();
        await page.goBack();await expect(cell(page,10)).toHaveAttribute('aria-current','true');
        await expect(page.locator('#steps-meter')).toHaveText(head);
        await moves(page,victory.slice(2),touch);
        await expect(status(page)).toHaveAttribute('data-outcome','delivered');
        await expect(page.locator('#wet-meter')).toContainText(/55|٥٥/);
        await expect(page.locator('#stage-art')).toHaveAttribute('src',/arrival\.webp$/);
        await page.locator('#stage-art').evaluate(img=>img.decode());
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        if(width===390){await page.locator('#stage-art').scrollIntoViewIfNeeded();await snapshot(page,'courier-arrival-'+label);}
        await action(page.locator('#see-manga'),touch);
        const panels=page.locator('#panels .panel');await expect(panels).toHaveCount(3);
        const art=()=>panels.locator('img').evaluateAll(images=>images.map(img=>new URL(img.src).pathname.split('/').at(-1)));
        assert.deepEqual(await art(),['print-departure.webp','print-letter.webp','print-arrival.webp']);
        let prior=await art();
        for(let i=0;i<4;i++){
          const swaps=panels.locator('.move-earlier:enabled,.move-later:enabled');
          await swaps.nth(i%2).press('Enter');
          assert.notDeepEqual(await art(),prior);
          assert.ok(await page.evaluate(()=>!!document.activeElement?.matches('#panels button:not(:disabled)')));
          prior=await art();
        }
        await action(page.locator('#save-manga'),touch);
        await expect(page.locator('.night-notice a[href*="my-notebook"]')).toBeVisible();
        const data=await readDownload(page,page.locator('#export'));
        assert.match(data.name,/\.json$/);
        const exported=JSON.parse(data.bytes.toString());
        assert.equal(exported.activity,'ink-courier');assert.equal(exported.format,'raven-late-night-work');
        const settings=exported.data;
        assert.deepEqual(settings.path,victory);assert.equal(new Set(settings.order).size,3);
        if(width===390){await panels.first().scrollIntoViewIfNeeded();await snapshot(page,'courier-manga-'+label);}
        await page.locator('.night-notice a[href*="my-notebook"]').click();
        await page.locator('a[href*="ink-courier.html?piece="]').first().click();
        await expect(page.locator('#manga')).toBeVisible();
        assert.deepEqual(await art(),prior);
        await action(page.locator('#weatherTab'),touch);
        await page.locator('#rain').fill('70');await page.locator('#wind').fill('-30');
        await expect(page.locator('#measure')).toBeVisible();
        const png=await readDownload(page,page.locator('#print'));
        assert.match(png.name,/\.png$/);assert.deepEqual([...png.bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
        const dims=await page.evaluate(async base64=>{const image=new Image();image.src='data:image/png;base64,'+base64;
          await image.decode();return [image.naturalWidth,image.naturalHeight];},png.bytes.toString('base64'));
        assert.deepEqual(dims,[800,450]);
        assert.deepEqual(errors,[]);
        if(output && lang==='ar' && width===390){await fs.writeFile(path.join(output,data.name),data.bytes);await fs.writeFile(path.join(output,png.name),png.bytes);}
        rows.push({width,lang,touch,wetness:55,steps:victory.length,order:settings.order,decodedPNG:dims,json:data.name});
      }finally{await context.close();}
    });
  }
  if(output){await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'courier-browser.json'),JSON.stringify({base:home,verifiedWins:rows},null,2)+'\n');}

  await t.test('keyboard boundaries, wetness, the final move, loss, undo and restart',async()=>{
    const page=await browser.newPage({viewport:{width:320,height:800},reducedMotion:'reduce'});
    try{
      await page.goto(room+'ink-courier.html?lang=en');
      await cell(page,20).focus();for(const key of ['ArrowLeft','ArrowDown']) {
        await page.keyboard.press(key);await expect(cell(page,20)).toBeFocused();await expect(page.locator('#confirm')).toBeDisabled();
      }
      for(const [route,outcome,ending,wetness] of [
        [soaked,'soaked','shelter',110], [wetLimit,'soaked','shelter',100],
        [parked,'out-of-time','shelter',48], [lastStepVictory,'delivered','arrival',86]
      ]){
        await moves(page,route,false);
        await expect(status(page)).toHaveAttribute('data-outcome',outcome);
        await expect(page.locator('#wet-meter')).toContainText(wetness+' / 100');
        await expect(page.locator('#stage-art')).toHaveAttribute('src',new RegExp(ending+'\\.webp$'));
        await page.locator('#see-manga').press('Enter');
        const manga=page.locator('#panels');
        await expect(manga.locator('img[src$="/print-arrival.webp"]')).toHaveCount(outcome==='delivered'?1:0);
        await expect(manga.locator('img[src$="/print-shelter.webp"]')).toHaveCount(outcome==='delivered'?0:1);
        await page.locator('#gameTab').press('Enter');await page.locator('#undo').press('Enter');
        await expect(status(page)).toHaveAttribute('data-outcome','playing');
        await expect(cell(page,route.at(-2))).toBeFocused();
        await moves(page,[route.at(-1)],false);
        await expect(status(page)).toHaveAttribute('data-outcome',outcome);
        await page.locator('#reset').press('Enter');
        await expect(cell(page,20)).toBeFocused();await expect(page.locator('#undo')).toBeDisabled();
      }
    }finally{await page.close();}
  });
});

test('courier survives missing scripts, failed art and unavailable device storage', {timeout:90000}, async t=>{
  const room = new URL('late-night/',await site(t)).href;
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium'});
  t.after(()=>browser.close());
  await t.test('a blocked entry module provides bilingual retry and an exit',async()=>{
    for(const lang of ['ar','en']){
      const page=await browser.newPage({viewport:{width:320,height:800}});
      try{
        const script='**/ink/courier.js';
        await page.route(script,r=>r.abort());
        await page.goto(room+'ink-courier.html?lang='+lang);
        const retry=page.getByRole('button',{name:lang==='ar'?'أعد تحميل التجربة':'Retry loading'});
        await expect(retry).toBeVisible();await expect(page.getByRole('link',{name:lang==='ar'?'كل التجارب':'All experiences'})).toBeVisible();
        await expect(page.locator('#board')).toHaveCount(0);
        await page.unroute(script);await retry.press('Enter');
        await expect(status(page)).toHaveAttribute('data-outcome','playing');await moves(page,[15],false);
      }finally{await page.close();}
    }
  });
  await t.test('reload only the selected image and retain the confirmed move and weather choices',async()=>{
    const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
    try{
      const shot='**/ink/art/courier/crossing.webp', weather='**/ink/art/courier/route.webp';
      let denied=0;
      await page.route(shot,r=>{denied++;return r.abort();});
      await page.goto(room+'ink-courier.html?lang=en');
      await moves(page,[15],true);
      const before=await page.locator('#steps-meter').innerText();
      await expect(page.locator('#retry-stage')).toBeVisible();await expect(page.locator('#caption')).not.toBeEmpty();
      assert.ok(denied>0);await page.unroute(shot);await page.locator('#retry-stage').tap();
      await page.locator('#stage-art').evaluate(img=>img.decode());await expect(page.locator('#steps-meter')).toHaveText(before);
      await page.route(weather,r=>r.abort());await page.locator('#weatherTab').tap();
      await expect(page.locator('#retry-weather')).toBeVisible();
      await page.locator('#rain').fill('70');await page.locator('#wind').fill('20');
      await expect(page.locator('#print')).toBeDisabled();await expect(page.locator('#measure')).not.toBeEmpty();
      await page.unroute(weather);await page.locator('#retry-weather').tap();await expect(page.locator('#print')).toBeEnabled();
      assert.equal(await page.locator('#rain').inputValue(),'70');assert.equal(await page.locator('#wind').inputValue(),'20');
      await page.locator('#gameTab').tap();await expect(cell(page,15)).toHaveAttribute('aria-current','true');
    } finally {await page.close();}
  });
  await t.test('the wet route can finish in memory, export valid JSON and report denied saving',async()=>{
    const page=await browser.newPage({viewport:{width:320,height:800},reducedMotion:'reduce'});
    try{
      await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Disabled for test','SecurityError');};});
      await page.goto(room+'ink-courier.html?lang=en');await moves(page,soaked,false);
      await expect(status(page)).toHaveAttribute('data-outcome','soaked');await page.locator('#mangaTab').press('Enter');
      await page.locator('#save-manga').press('Enter');
      await expect(page.locator('#manga-status')).toContainText(/not be saved/i);
      await expect(page.locator('.night-notice')).toContainText(/Saving could not be confirmed/);
      const file=await readDownload(page,page.locator('#export'));assert.deepEqual(JSON.parse(file.bytes).data.path,soaked);
      assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('.piece.'))),[]);
    } finally {await page.close();}
  });
  await t.test('an unreadable record and a well-formed but impossible trajectory are retained for recovery',async()=>{
    for(const raw of ['{torn',JSON.stringify({version:1,value:{format:'raven-rain-round-2',
      path:[24],order:['departure','middle','end'],tab:'game',weather:{rain:60,wind:15}}})]){
      const page=await browser.newPage({viewport:{width:320,height:800}});
      try{
        await page.addInitScript(([key,raw])=>localStorage.setItem(key,raw),[draftKey,raw]);
        await page.goto(room+'ink-courier.html?lang=en');
        await expect(status(page)).toHaveAttribute('data-outcome','playing');
        await expect(page.locator('#recovery:visible,.night-notice:visible').first()).toBeVisible();
        await moves(page,[15],false);
        assert.equal(await page.evaluate(k=>localStorage.getItem(k),draftKey),raw);
      }finally{await page.close();}
    }
  });
});

// The fixed map has no live path that first hits 100 wetness on the cinema square.
// Exercise the precedence rule directly with an explicitly synthetic penultimate state.
test('a letter arriving on the boundary is soaked even on the last move', async()=>{
  const {advance,CINEMA}=await import('../raven/late-night/ink/courier-rules.js');
  const prior={cell:19,steps:15,wetness:97,pickup:7,outcome:'playing'};
  const result=advance(prior,CINEMA);
  assert.equal(result.outcome,'soaked');assert.equal(result.steps,16);assert.equal(result.wetness,100);
  assert.equal(advance(result,19),null);
  assert.equal(advance({...prior,wetness:96},CINEMA).outcome,'delivered');
});
