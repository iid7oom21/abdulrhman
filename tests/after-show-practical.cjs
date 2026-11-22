const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(__dirname,'..');
const prefix = '/abdulrhman/';
const origin = 'http://practical.test';
const base = origin+prefix+'raven/after-show/content.html';
const mime = {'.js':'text/javascript','.html':'text/html','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp','.svg':'image/svg+xml'};

test('four practical workshops with real scenes and explicit optional audio',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  for(const [lang,width] of [['ar',320],['en',390]])await t.test(lang+' '+width,async()=>{
    const c=await browser.newContext({viewport:{width,height:840},reducedMotion:'reduce'});
    try{
      const errors=[],outside=[];
      await c.addInitScript(()=>{window.hostCalls=[];window.RavenSite={setMediaActive(child,source,active){if(child===window&&source===document)hostCalls.push(active);}};});
      await c.route('**/*',async r=>{
        const u=new URL(r.request().url());
        if(u.origin!==origin||!u.pathname.startsWith(prefix)){outside.push(u.href);return r.abort();}
        const file=path.resolve(root,u.pathname.slice(prefix.length));
        if(!file.startsWith(root+path.sep))return r.abort();
        try{return await r.fulfill({body:await fs.readFile(file),contentType:mime[path.extname(file)]||'application/octet-stream'});}
        catch{return r.fulfill({status:404,body:''});}
      });
      const p=await c.newPage();p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(e.message));
      const enter=async id=>{await p.goto(base+'?activity='+id+'&lang='+lang);await p.locator('.pra-workshop h1').waitFor();};
      const key=id=>p.locator('[data-practical="'+id+'"]'),sel=(id,v)=>key(id).selectOption(String(v)),
        set=(id,v)=>key(id).fill(String(v)),click=id=>key(id).click(),canvas=p.locator('.pra-frame canvas');
      const fit=async()=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      const pixels=()=>canvas.evaluate(x=>x.toDataURL());
      await enter('leitmotif');assert.equal(await key('mute').getAttribute('aria-pressed'),'false');
      await sel('beats',2);assert.match(await p.locator('.pra-status').innerText(),/8\/8/);
      await click('scene-1');await sel('voice','sawtooth');assert.match(await p.locator('.pra-status').innerText(),lang==='ar'?/حُفظ الاتجاه/:/Contour retained/);
      await click('mute');assert.equal(await key('mute').getAttribute('aria-pressed'),'true');
      assert.deepEqual(await p.evaluate(()=>hostCalls),[]);
      await click('replay');await p.waitForFunction(()=>hostCalls.at(-1)===true);
      await click('mute');assert.equal(await key('mute').getAttribute('aria-pressed'),'false');
      assert.deepEqual(await p.evaluate(()=>hostCalls),[true,false]);
      await click('mute');await sel('tempo',140);await click('replay');
      await p.waitForFunction(()=>hostCalls.length===4&&hostCalls.at(-1)===false);
      await click('replay');await p.locator('#as-language').click();await key('mute').waitFor();
      assert.equal(await p.evaluate(()=>hostCalls.at(-1)),false);
      await p.locator('#as-language').click();await key('mute').waitFor();
      await click('scene-2');await sel('tempo',120);await p.reload();assert.equal(await key('tempo').inputValue(),'120');
      await click('scene-1');assert.equal(await key('voice').inputValue(),'sawtooth');await fit();

      await enter('shadows');const initial=Number(await canvas.getAttribute('data-cover'));assert.ok(initial<100);
      const solution=[[320,170,0,165],[260,191,0,85],[380,191,0,85],[320,133,0,90]];
      for(let i=0;i<4;i++){
        await click('piece-'+i);
        for(const [k,n] of ['x','y','rotate','scale'].entries())await set(n,solution[i][k]);
      }
      assert.equal(await canvas.getAttribute('data-cover'),'100');assert.equal(await canvas.getAttribute('data-spill'),'0');
      const combined=await pixels();await click('reveal');assert.notEqual(await pixels(),combined);
      await p.reload();assert.equal(await key('reveal').getAttribute('aria-pressed'),'true');await sel('subject',1);
      assert.ok(Number(await canvas.getAttribute('data-cover'))<100);await fit();

      await enter('performance');await click('action-1');await sel('target',0);await set('cue',25);
      const front=await pixels();await sel('angle',1);assert.notEqual(await pixels(),front);
      const otherView=await p.locator('.pra-status').innerText();await sel('angle',0);
      assert.notEqual(await p.locator('.pra-status').innerText(),otherView);
      await click('replay');assert.equal(await canvas.getAttribute('data-time'),'60');
      await click('pass');assert.equal(await canvas.isVisible(),false);
      await p.reload();await click('watch');assert.equal(await key('intent').count(),0);
      await click('replay');await click('read-1');assert.match(await p.locator('.pra-status').innerText(),lang==='ar'?/قراءة المشاهد/:/Viewer’s reading/);
      await click('edit');await fit();

      await enter('popup');await click('replay');assert.equal(await canvas.getAttribute('data-cycle'),'blocked');
      await click('piece-1');await sel('hinge',1);await click('replay');assert.equal(await canvas.getAttribute('data-cycle'),'clear');
      assert.equal(await canvas.getAttribute('data-angle'),'0');
      const closed=await pixels();await set('angle',120);assert.notEqual(await pixels(),closed);
      await p.reload();assert.equal(await key('angle').inputValue(),'120');assert.equal(await key('hinge').inputValue(),'1');
      await fit();assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);
    }finally{await c.close();}
  });
});
