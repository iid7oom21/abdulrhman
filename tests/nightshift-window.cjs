const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {chromium,expect} = require('playwright/test');

async function serve(t) {
  if(process.env.RAVEN_QA_HOME)return new URL('late-night/nightshift-window.html',process.env.RAVEN_QA_HOME).href;
  const root=path.resolve(__dirname,'..'), prefix='/abdulrhman/';
  const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp'};
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const file=path.resolve(root,url.pathname.slice(prefix.length));
    if(!url.pathname.startsWith(prefix)||!file.startsWith(root+path.sep))return res.writeHead(404).end();
    try{const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);}
    catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  return 'http://127.0.0.1:'+server.address().port+prefix+'raven/late-night/nightshift-window.html';
}

// Range keys exercise the same controls a viewer can operate with a keyboard.
async function range(page,id,value) {
  const input=page.locator('#window-'+id);
  await input.press('Home');
  const step=Number(await input.getAttribute('step'));
  for(let i=0;i<Math.round(value/step);i++)await input.press('ArrowRight');
  await expect(input).toHaveValue(String(value));
}
async function scrub(page,time) {
  await page.locator('#window-time').evaluate((e,v)=>{
    e.value=String(v);
    e.dispatchEvent(new Event('input',{bubbles:true}));
    e.dispatchEvent(new Event('change',{bubbles:true}));
  },time);
}
async function screenshot(page,name) {
  if(!process.env.INK_QA_DIR)return;
  await fs.mkdir(process.env.INK_QA_DIR,{recursive:true});
  await page.locator('#window-frame').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(process.env.INK_QA_DIR,name+'.png')});
}

test('the glance, curtain and reflected boat follow the edited take',async t=>{
  const url=await serve(t),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
  t.after(()=>browser.close());
  for(const [lang,width,reduce] of [['ar',320,true],['en',390,false],['en',1180,true]]) {
    await t.test(lang+' '+width,async()=>{
      const page=await browser.newPage({viewport:{width,height:820},reducedMotion:reduce?'reduce':'no-preference',hasTouch:width<500});
      try {
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.clock.install();
        await page.goto(url+'?lang='+lang);
        const act=id=>width<500?page.locator('#window-'+id).tap():page.locator('#window-'+id).press('Enter');
        const frame=page.locator('#window-frame');
        await expect(frame).toHaveAttribute('data-gaze','lap');
        await expect(frame).toHaveAttribute('data-motion',reduce?'poses':'continuous');
        await page.locator('[data-layer]').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
        await range(page,'curtain',1);await range(page,'gaze',2);await range(page,'boat',4);
        await scrub(page,4.6);
        await expect(frame).toHaveAttribute('data-gaze','sea');
        await expect(frame).toHaveAttribute('data-boat','passing');
        await expect(page.locator('[data-layer=reflection]')).toBeVisible();
        const pos=()=>page.locator('.window-crossing').evaluate(n=>n.style.left);
        const p=await pos();await scrub(page,4.7);
        assert.equal(p===await pos(),reduce,'discrete pose in reduced motion, continuous position otherwise');
        await scrub(page,5.5);await screenshot(page,'window-crossing-'+lang+'-'+width);await scrub(page,4.7);
        // Move only the look. Hull position and curtain stay in the same place.
        const boatBefore=await pos(),curtainBefore=await page.locator('[data-layer=curtain]').getAttribute('style');
        await range(page,'gaze',5);
        await expect(frame).toHaveAttribute('data-gaze','lap');
        assert.equal(await pos(),boatBefore);assert.equal(await page.locator('[data-layer=curtain]').getAttribute('style'),curtainBefore);
        await page.locator('.night-lang').press('Enter');
        await expect(page.locator('#window-gaze')).toHaveValue('5');
        await expect(page.locator('#window-time')).toHaveValue('4.7');
        await expect(frame).toHaveAttribute('data-boat','passing');
        await act('replay');
        await page.clock.fastForward(1800);await act('play');
        const paused=await page.locator('#window-time').inputValue();
        await page.clock.fastForward(3000);
        assert.equal(await page.locator('#window-time').inputValue(),paused);
        await act('play');await page.clock.fastForward(12200);
        await expect(page.locator('#window-time')).toHaveValue('12');
        await expect(frame).toHaveAttribute('data-boat','past');
        const reading=page.locator('#window-reading');
        await expect(reading).toBeVisible();
        await expect(reading).toContainText(lang==='ar'?'while the boat was in view':'والقارب في النافذة');
        await range(page,'gaze',1);await expect(reading).toBeHidden();
        await act('replay');await page.clock.fastForward(12300);
        await expect(reading).toContainText(lang==='ar'?'before the boat':'قبل دخول القارب');
        await page.reload();await expect(page.locator('#window-gaze')).toHaveValue('1');
        await expect(reading).toBeVisible();
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.deepEqual(errors,[]);
      }finally{await page.close();}
    });
  }
  await t.test('a failed boat image and denied storage preserve the silent scene',async()=>{
    const page=await browser.newPage({viewport:{width:320,height:780}});
    try {
      await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Denied','SecurityError');};});
      await page.route('**/window-boat.webp',r=>r.abort());
      await page.goto(url+'?lang=en');await expect(page.locator('#window-retry')).toBeVisible();
      await range(page,'boat',3);await scrub(page,4);
      await expect(page.locator('#window-description')).toContainText('boat and its reflection');
      await expect(page.locator('.night-notice')).toContainText('Saving could not be confirmed');
      await page.unroute('**/window-boat.webp');await page.locator('#window-retry').click();
      await expect(page.locator('#window-retry')).toBeHidden();
      assert.equal(await page.locator('[data-layer=boat]').evaluate(e=>e.naturalWidth),280);
      await expect(page.locator('#window-time')).toHaveValue('4');
    }finally{await page.close();}
  });
});
