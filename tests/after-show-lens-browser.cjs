const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');

const root=path.resolve(__dirname,'..'),host='http://raven.test',prefix='/abdulrhman/';
const base=host+prefix+'raven/after-show/content.html';
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};

test('grade and camera on mobile at the project prefix',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  for(const [lang,width] of [['ar',320],['en',390]]) await t.test(lang+' '+width,async()=>{
    const ctx=await browser.newContext({viewport:{width,height:820}});let broken='lamp.webp';
    const outside=[],errors=[];
    try {
      await ctx.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.origin!==host||!url.pathname.startsWith(prefix)) {outside.push(url.origin);return route.abort();}
        if(path.basename(url.pathname)===broken) return route.abort('failed');
        const local=path.resolve(root,url.pathname.slice(prefix.length));
        if(!local.startsWith(root+path.sep))return route.abort();
        try{return await route.fulfill({body:await fs.readFile(local),contentType:types[path.extname(local)]||'application/octet-stream'});}
        catch{return route.fulfill({status:404,body:''});}
      });
      const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
      const handle=id=>page.locator('[data-lens="'+id+'"]');
      const pixels=()=>page.locator('canvas').evaluate(c=>c.toDataURL());
      const fit=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.goto(base+'?activity=grade&lang='+lang);
      await handle('retry-grade').waitFor();broken='';
      await handle('retry-grade').click();await page.waitForFunction(()=>!document.querySelector('.lens-status').textContent);
      await handle('split').fill('100');const original=await pixels();
      await handle('look-silver').click();assert.equal(await pixels(),original);
      await handle('split').fill('0');assert.notEqual(await pixels(),original);
      const chromatic=await page.locator('canvas').evaluate(c=>{
        const {data}=c.getContext('2d').getImageData(0,0,c.width,c.height);
        let colored=0;
        for(let i=0;i<data.length;i+=4)if(data[i]!==data[i+1]||data[i+1]!==data[i+2])colored++;
        return colored;
      });
      assert.equal(chromatic,0);
      await handle('saturation').fill('161');await handle('contrast').fill('94');await handle('exposure').fill('0.6');
      assert.notEqual(await pixels(),original);assert.equal(await handle('look-silver').getAttribute('aria-pressed'),'false');
      await handle('source-envelope').click();await page.waitForFunction(()=>!document.querySelector('.lens-status').textContent);
      const grade=await pixels();await page.reload();
      await handle('exposure').waitFor();await page.waitForFunction(()=>!document.querySelector('.lens-status').textContent);
      assert.equal(await pixels(),grade);assert.equal(await handle('contrast').inputValue(),'94');await fit();
      await page.locator('#as-language').click();
      await page.waitForFunction(()=>document.querySelector('[data-lens="source-envelope"]')?.getAttribute('aria-pressed')==='true'&&!document.querySelector('.lens-status').textContent);
      assert.equal(await pixels(),grade);
      await page.goto(base+'?activity=camera&lang='+lang);
      await handle('thirds').waitFor();const canvas=page.locator('canvas');
      await handle('size-wide').click();const wide=Number(await canvas.getAttribute('data-coverage'));
      const frame=await pixels();await handle('size-close').click();
      assert.ok(Number(await canvas.getAttribute('data-coverage'))>wide);assert.notEqual(await pixels(),frame);
      const close=await pixels();await handle('angle-high').click();assert.notEqual(await pixels(),close);
      const high=await pixels();await handle('thirds').click();assert.notEqual(await pixels(),high);
      await handle('shift').fill('29');assert.ok((await page.locator('.lens-reading').innerText()).includes(lang==='ar'?'الثلث الأيمن':'right third'));
      await page.reload();await handle('thirds').waitFor();assert.equal(await handle('angle-high').getAttribute('aria-pressed'),'true');
      assert.equal(await handle('size-close').getAttribute('aria-pressed'),'true');assert.equal(await handle('shift').inputValue(),'29');
      await page.locator('#as-language').click();await handle('angle-high').waitFor();
      assert.equal(await handle('angle-high').getAttribute('aria-pressed'),'true');
      await fit();assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
    } finally {await ctx.close();}
  });
});
