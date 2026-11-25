const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const {chromium, expect} = require('playwright/test');

async function setup(t) {
  const root=path.resolve(__dirname,'..'), prefix='/abdulrhman/';
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp'};
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const file=path.resolve(root,url.pathname.slice(prefix.length));
    if(!url.pathname.startsWith(prefix)||!file.startsWith(root+path.sep))return res.writeHead(404).end();
    try {
      const data=await fs.readFile(file);
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);
    } catch {res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>server.close());
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
  t.after(()=>browser.close());
  const url='http://127.0.0.1:'+server.address().port+prefix+'raven/late-night/ink-page.html';
  return {browser,url};
}

// Decode the downloaded print in the browser. Match both small panels to their
// individually decoded originals at their actual reader-facing left/right positions.
async function expectPrintedArt(page, bytes, [left,right]) {
  const matches=await page.evaluate(async ({base64,left,right})=>{
    const print=new Image();print.src='data:image/png;base64,'+base64;await print.decode();
    const canvas=document.createElement('canvas');
    canvas.width=880;canvas.height=984;
    const c=canvas.getContext('2d');c.drawImage(print,0,0);
    const equal=[];
    for(const [slot,id] of [left,right].entries()){
      const image=new Image();image.src=new URL('ink/art/panel-'+id+'.webp',location.href);await image.decode();
      const expected=document.createElement('canvas');expected.width=400;expected.height=400;
      const e=expected.getContext('2d');e.drawImage(image,0,0,400,400);
      const patch=e.getImageData(100,126,35,35).data;
      const actual=c.getImageData((slot?448:32)+100,533+126,35,35).data;
      const mae=patch.reduce((s,x,i)=>s+Math.abs(x-actual[i]),0)/patch.length;
      // Scaling in the export canvas and the independent canvas can round a
      // small number of channel values differently during rasterisation.
      equal.push(mae<1);
    }
    return [print.naturalWidth, print.naturalHeight, ...equal];
  },{base64:bytes.toString('base64'),left,right});
  assert.deepEqual(matches,[880,984,true,true]);
}

test('a visitor orders and prints their own three panels in either reading direction',async t=>{
  const {browser,url}=await setup(t);
  for(const [lang,width] of [['ar',320],['en',390],['en',1280]]) {
    await t.test(lang+' '+width,async()=>{
      const page=await browser.newPage({viewport:{width,height:844},hasTouch:width<500,reducedMotion:'reduce'});
      try {
        const key=id=>page.locator('[data-page="'+id+'"]'), errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(url+'?lang='+lang);
        await expect(key('preview')).toBeDisabled();
        const tap=id=>width<500?key(id).tap():key(id).press('Enter');
        for(const id of ['press','window','drying'])await tap('pick-'+id);
        await expect(key('pick-type')).toBeDisabled();
        await tap('pick-window');await tap('pick-type');
        const rtl=lang==='ar';await tap(rtl?'rtl':'ltr');
        await tap('caption');await tap('preview');
        await expect(key('sheet')).toHaveAttribute('data-panels','press,drying,type');
        await expect(key('sheet')).toHaveAttribute('data-direction',rtl?'rtl':'ltr');
        await expect(key('png')).toBeEnabled();
        await page.locator('.night-lang').press('Enter');
        await expect(key('sheet')).toHaveAttribute('data-direction',rtl?'rtl':'ltr');
        const pending=page.waitForEvent('download');await tap('png');
        const result=await pending;assert.equal(result.suggestedFilename(),'raven-before-dawn.png');
        const bytes=await fs.readFile(await result.path());
        await expectPrintedArt(page,bytes,rtl?['type','drying']:['drying','type']);
        if(process.env.INK_QA_DIR&&width===320) {
          await fs.mkdir(process.env.INK_QA_DIR,{recursive:true});
          await page.locator('.night-lang').press('Enter');
          await key('sheet').scrollIntoViewIfNeeded();
          await page.screenshot({path:path.join(process.env.INK_QA_DIR,'ink-page-ar-320.png')});
          await fs.writeFile(path.join(process.env.INK_QA_DIR,'raven-before-dawn.png'),bytes);
        }
        await tap('save');
        await expect(key('save')).toBeDisabled();
        const record=await page.evaluate(()=>{
          const key=Object.keys(localStorage).find(key=>key.startsWith('raven.late-night.v1.piece.'));
          return JSON.parse(localStorage[key]).value;
        });
        assert.deepEqual(record.data,{panels:['press','drying','type'],direction:rtl?'rtl':'ltr',caption:true});
        await page.goto(new URL('my-notebook.html',url).href);
        await page.locator('a[href*="ink-page.html?piece='+record.id+'"]').click();
        await expect(key('sheet')).toHaveAttribute('data-panels','press,drying,type');
        await tap('edit');await tap(rtl?'ltr':'rtl');await tap('silent');await tap('preview');
        await expect(key('sheet')).toHaveAttribute('data-direction',rtl?'ltr':'rtl');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.deepEqual(errors,[]);
      } finally {await page.close();}
    });
  }
});

test('retries just the missing drawing and keeps the selected page intact',async t=>{
  const {browser,url}=await setup(t);
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const key=id=>page.locator('[data-page="'+id+'"]');
  const pattern='**/ink/art/panel-type.webp*';
  await page.route(pattern,route=>route.abort());
  await page.goto(url+'?lang=en');
  for(const id of ['window','type','press'])await key('pick-'+id).click();
  await key('preview').click();
  await expect(key('png')).toBeDisabled();
  await expect(key('retry-type')).toBeVisible();
  await expect(key('sheet')).toHaveAttribute('aria-label',/metal blocks/);
  await page.unroute(pattern);
  await key('retry-type').press('Enter');
  await expect(key('png')).toBeEnabled();
  await expect(key('sheet')).toHaveAttribute('data-panels','window,type,press');
  await page.close();
});
