const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_TEST_MODULE||'playwright');

test('the first visit opens the episode gallery and keeps the soundtrack independent',async t=>{
  const root=path.resolve(__dirname,'..');
  const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.mp4':'video/mp4','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(!url.pathname.startsWith('/abdulrhman/'))return res.writeHead(404).end();
    const suffix=url.pathname.endsWith('/')?'index.html':'';
    const file=path.resolve(root,url.pathname.slice('/abdulrhman/'.length)+suffix);
    if(!file.startsWith(root+path.sep))return res.writeHead(404).end();
    try{const contents=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'}).end(contents);}
    catch{res.writeHead(404).end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));t.after(()=>server.close());
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  for(const [lang,width] of [['ar',320],['en',390]]){
    const ctx=await browser.newContext({viewport:{width,height:760},hasTouch:true,reducedMotion:'reduce'});
    try{
      const page=await ctx.newPage();
      await page.route('https://**/*',r=>r.abort());
      await page.goto(origin+'/abdulrhman/raven/?lang='+lang,{waitUntil:'domcontentloaded'});
      const entry=page.locator('dialog[open] #archive-episodes');
      await entry.waitFor();
      assert.equal(await page.locator('dialog').getAttribute('dir'),lang==='ar'?'rtl':'ltr');
      assert.equal(await entry.getAttribute('href'),origin+'/abdulrhman/raven/episodes/?lang='+lang);
      assert.equal(await page.locator('#archive-case').getAttribute('href'),origin+'/abdulrhman/raven/deleted-name/?lang='+lang);
      assert.equal(await page.locator('.archive-intro').getAttribute('src'),null);
      assert.equal(await page.locator('#archive-episodes').evaluate(a=>a===document.activeElement),true);
      await entry.tap();await page.waitForURL('**/episodes/?lang='+lang);
      await page.frameLocator('#site-content').locator('main h1').first().waitFor();
      assert.equal(await page.locator('#site-soundtrack').evaluate(a=>a.paused),true);
      assert.equal(await page.locator('#music-track-picker option').count(),13);
      const dock=await page.locator('.site-player').boundingBox();assert.ok(dock.height<=46);
      await page.locator('#music-settings-label').focus();await page.keyboard.press('Enter');
      await page.locator('#music-volume').focus();await page.keyboard.press('Escape');
      assert.equal(await page.locator('#music-settings').evaluate(e=>e.open),false);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'music-settings-label');
      await page.goBack();await page.waitForURL('**/raven/?lang='+lang);
      assert.equal(await page.locator('dialog[open]').count(),0);
    }finally{await ctx.close();}
  }
});
