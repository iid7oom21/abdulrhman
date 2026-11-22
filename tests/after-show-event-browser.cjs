const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(__dirname,'..');
const host = 'http://raven.test';
const prefix = '/abdulrhman/';
const entry = host+prefix+'raven/after-show/content.html';
const mime = {'.css':'text/css','.js':'text/javascript','.html':'text/html','.wav':'audio/wav','.woff2':'font/woff2','.webp':'image/webp','.svg':'image/svg+xml'};
const ns='raven.after-show.v1.';

test('screening events run at the project path using only local files', async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  async function session(width,lang) {
    const context=await browser.newContext({viewport:{width,height:840},reducedMotion:'reduce'});
    const failed=new Set(),requests=[],errors=[];
    await context.route('**/*',async route=>{
      const req=route.request(),u=new URL(req.url());
      if(u.origin!==host || !u.pathname.startsWith(prefix) || req.method()!=='GET') return route.abort();
      requests.push(u.pathname);
      if(failed.has(path.basename(u.pathname))) return route.abort('failed');
      const rel=u.pathname.slice(prefix.length);
      const local=path.resolve(root,rel);
      if(!local.startsWith(root+path.sep)) return route.abort();
      try {return await route.fulfill({body:await fs.readFile(local),contentType:mime[path.extname(local)]||'application/octet-stream'});}
      catch {return route.fulfill({status:404,body:''});}
    });
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    const open=async id=>{await page.goto(entry+'?activity='+id+'&lang='+lang);await page.locator('.evt-heading').waitFor();};
    const el=id=>page.locator('[data-event="'+id+'"]');
    const click=id=>el(id).click();
    const adjust=async (id,val)=>{await el(id).fill(String(val));};
    const fits=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
    const data=key=>page.evaluate(k=>JSON.parse(localStorage.getItem(k))?.data,ns+key);
    return {context,page,open,el,click,adjust,fits,data,errors,requests,failed};
  }

  for(const [width,lang] of [[320,'ar'],[390,'en'],[1180,'en']]) await t.test('continuity and budgets '+lang+' '+width,async()=>{
    const {context,page,open,el,click,fits,data,errors}=await session(width,lang);
    try {
      await open('continuity'); await fits();
      const pair=page.locator('.evt-set');
      assert.equal(await pair.count(),2);
      assert.equal(await pair.first().getAttribute('data-cup'),'0');assert.equal(await pair.last().getAttribute('data-cup'),'1');
      await click('text'); assert.equal(await page.locator('.evt-observations li').count(),6);
      await click('switch');await click('swap-frame');
      assert.equal(await page.locator('.evt-set').getAttribute('data-cup'),'1');
      for(const prop of ['cup','folder','light']) {
        await click('pick-'+prop);await click('judge');assert.ok(await el('next').isVisible());
        await click('next');
      }
      await open('budget');await click('buy-boom');await click('buy-room');await click('review-budget');
      assert.equal(await page.locator('.evt-receipt strong').innerText(),'10 / 10');
      assert.ok((await page.locator('.evt-feedback').innerText()).includes('0'));
      await click('buy-detail');await click('review-budget');
      assert.equal(await page.locator('.evt-receipt strong').innerText(),'12 / 10');
      assert.ok((await page.locator('.evt-feedback').innerText()).includes('2'));
      await page.reload();await page.locator('.evt-feedback').waitFor();assert.ok((await data('budget')).submitted);
      await fits();await click('rebudget');assert.deepEqual((await data('budget')).picks,[]);
      assert.deepEqual(errors,[]);
    } finally {await context.close();}
  });

  for(const [lang,width,fail] of [['ar',320,false],['en',390,true]]) await t.test('three-chapter screening, pause and actual PNG '+lang,async()=>{
    const {context,page,open,el,click,adjust,fits,data,errors,requests,failed}=await session(width,lang);
    try {
      await open('card');assert.ok(await el('make-cut').isVisible());
      await open('festival');await fits();
      const reel=['envelope','exterior','hand'];
      for(const id of reel) await click('shot-'+id);
      await click('cut-next');
      await adjust('festival-angle',57);await adjust('festival-exposure',18);await click('light-next');
      await page.reload();await el('cue-key').waitFor();
      assert.equal((await data('festival')).stage,2);
      await click('cue-key');await adjust('festival-time',1.4);
      if(fail) failed.add('envelope.webp');
      await click('cue-next');assert.equal(await page.locator('.evt-frame').getAttribute('data-shot'),'envelope');
      if(fail) {
        await el('retry-shot').waitFor();
        failed.delete('envelope.webp');
        await click('retry-shot');
        await page.locator('.evt-frame img:not([hidden])').evaluate(im=>im.decode());
      }
      assert.equal((await data('festival')).angle,57);
      assert.ok(await el('festival-card').isDisabled());
      if(fail) {failed.add('foley-key.wav');await click('festival-sound');}
      await click('festival-play');
      await page.waitForFunction(()=>!document.querySelector('.evt-cue-caption').hidden);
      if(fail) {
        await page.waitForFunction(()=>document.querySelector('audio').error!==null);
        assert.ok(requests.some(s=>s.endsWith('/foley-key.wav')));
        await el('retry-cue').waitFor();
        failed.delete('foley-key.wav');
        await click('retry-cue');
        await page.waitForFunction(()=>document.querySelector('audio').readyState>=2);
        assert.equal(await page.locator('.evt-frame').getAttribute('data-shot'),'envelope');
      } else assert.ok(!requests.some(s=>s.endsWith('.wav')));
      await click('festival-play');
      const head=(await data('festival')).head;
      assert.ok(head>=1.4&&head<3);
      await page.reload();await el('festival-play').waitFor();assert.equal((await data('festival')).head,head);
      await click('festival-play');await page.waitForFunction(()=>document.querySelector('.evt-frame')?.dataset.shot==='exterior');
      await el('festival-card').waitFor();
      await page.waitForFunction(()=>document.querySelector('[data-event="festival-card"]')?.disabled===false,{},{timeout:18000});
      assert.equal((await data('festival')).head,12);
      assert.equal(await page.locator('.evt-frame').getAttribute('data-shot'),'hand');
      await click('festival-card'); await el('download-png').waitFor();
      const card=await data('shareCut');
      assert.equal(card.source,'festival');assert.deepEqual(card.shots,reel);assert.equal(card.seconds,12);
      await page.waitForFunction(()=>!document.querySelector('[data-event="download-png"]').disabled);
      const grab=async()=>{
        const ready=page.waitForEvent('download');await click('download-png');const dl=await ready;
        const png=await fs.readFile(await dl.path());
        assert.equal(png.readUInt32BE(16),720);assert.equal(png.readUInt32BE(20),1280);
        assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(png.length>5000);return png;
      };
      const p1=await grab();await click('poster-hand');
      await page.waitForFunction(()=>!document.querySelector('[data-event="download-png"]').disabled);
      const p2=await grab();assert.notDeepEqual(p1,p2);
      if(fail) {
        // A separate browser profile guarantees no previously decoded shot can satisfy the blocked image.
        const fresh=await session(width,lang);
        try {
          fresh.failed.add('envelope.webp');
          await fresh.context.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify({v:1,data:value})),{key:ns+'shareCut',value:card});
          await fresh.open('card');
          await fresh.page.waitForFunction(()=>!document.querySelector('[data-event="download-png"]').disabled);
          assert.ok((await fresh.page.locator('.evt-feedback').innerText()).includes('unavailable'));
          const fallback=await fresh.page.locator('canvas').evaluate(c=>c.toDataURL('image/png'));
          assert.notDeepEqual(Buffer.from(fallback.split(',')[1],'base64'),p2);
        } finally {await fresh.context.close();}
      }
      await fits();assert.deepEqual(errors,[]);
    } finally {await context.close();}
  });
});
