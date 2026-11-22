const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..'), prefix='/abdulrhman/';
const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp'};

test('four screen workshops react to mobile edits, playback and reopening',async t=>{
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost'), name=path.resolve(root,'.'+url.pathname.slice(prefix.length-1));
    if(!url.pathname.startsWith(prefix)||!name.startsWith(root+path.sep)){res.writeHead(404).end();return;}
    try{const bytes=await fs.readFile(name);res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream'}).end(bytes);}
    catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());
  const base='http://127.0.0.1:'+server.address().port+prefix+'raven/after-show/content.html';
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  for(const [lang,width] of [['ar',320],['en',390]])await t.test(lang+' '+width,async()=>{
    const ctx=await browser.newContext({viewport:{width,height:840},reducedMotion:'reduce'});
    try{
      const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      const handle=id=>page.locator('[data-sc="'+id+'"]'), frame=()=>handle('frame').evaluate(c=>c.toDataURL());
      const open=async id=>{await page.goto(base+'?activity='+id+'&lang='+lang);await handle('frame').waitFor();};
      async function capture(id){
        if(!process.env.CAPTURE_DIR||lang!=='ar')return;
        const uri=await handle('frame').evaluate(c=>c.toDataURL('image/webp',.90));
        await fs.writeFile(path.join(process.env.CAPTURE_DIR,'preview-'+id+'.webp'),Buffer.from(uri.split(',')[1],'base64'));
      }
      const fits=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      const select=(key,value)=>handle(key).selectOption(value);
      const report=()=>handle('report').innerText();
      await open('titles');
      await handle('scrub').fill('3');const back=await frame(),obscured=await report();
      await select('plane','front');assert.notEqual(await frame(),back);assert.notEqual(await report(),obscured);
      await handle('first').fill(lang==='ar'?'شارع':'Street');await select('reflection','on');
      await handle('scrub').fill('1.7');await capture('titles');
      await handle('take-B').click();assert.equal(await handle('first').inputValue(),'');
      await handle('take-A').click();assert.ok(await handle('first').inputValue());await fits();
      await page.reload();assert.equal(await handle('plane').inputValue(),'front');
      await page.locator('#as-language').click();await page.waitForFunction(l=>document.documentElement.lang!==l,lang);
      assert.equal(await handle('plane').inputValue(),'front');assert.ok(await handle('first').inputValue());
      await open('parallax');await capture('parallax');const natural=await report();
      await select('layer0','columns');await handle('speed0').fill('-45');
      await handle('speed2').fill('135');await handle('crossing').click();
      assert.notEqual(await report(),natural);assert.ok(Number(await handle('scrub').inputValue())>0);
      await handle('pass-dream').click();assert.notEqual(await handle('speed0').inputValue(),'-45');
      await handle('pass-street').click();assert.equal(await handle('speed0').inputValue(),'-45');
      const still=await frame();await handle('play').click();await page.waitForTimeout(650);await handle('play').click();
      assert.notEqual(await frame(),still);await fits();
      await open('subtitles');await capture('subtitles');const clean=await report(),warm=await frame();
      await select('tone','plain');assert.notEqual(await frame(),warm);await select('tone','warm');
      await select('position','high');assert.match(await report(),lang==='ar'?/الاسم مغطّى/:/shop name covered/);
      await select('part1','off');assert.notEqual(await report(),clean);
      await handle('subtitle-1').click();await handle('hold').fill('1.2');await select('width','phone');
      await handle('screen-all').click();await page.waitForTimeout(650);await handle('play').click();
      assert.ok(Number(await handle('scrub').inputValue())>0);
      await page.reload();assert.equal(await handle('hold').inputValue(),'1.2');await fits();
      await open('blocking');const good=await report();assert.match(good,lang==='ar'?/التسليم مرئي/:/visible from the house/);
      await handle('handoff0').click();await capture('blocking');
      const plan=await frame();await select('view','house');assert.notEqual(await frame(),plan);
      await handle('clear-path').click();assert.match(await report(),lang==='ar'?/يتوقف المفتاح/:/Key waits/);
      await handle('mark4').focus();await page.keyboard.press('Enter');assert.equal(await report(),good);
      await handle('actor-1').click();await handle('undo').click();assert.notEqual(await report(),good);
      await page.reload();assert.equal(await handle('view').inputValue(),'house');await fits();
      assert.deepEqual(errors,[]);
    }finally{await ctx.close();}
  });
});
