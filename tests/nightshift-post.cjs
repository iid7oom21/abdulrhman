const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const {chromium,expect} = require('playwright/test');

const solution = ['up','unload:film','load:keys','load:slides','down','deliver:keys',
  'up','up','deliver:slides','down','load:film','up','up','deliver:film'];

test('three windows, one platform, capacity, travel and end-of-shift accounting',async()=>{
  const {perform,restoreShift,elapsedByUse,finished} = await import('../raven/late-night/nightshift/post-rules.js');
  const run = commands => restoreShift({version:1,commands});
  const completed = run(solution);
  assert.deepEqual(completed.delivered,[21,8,13]);
  assert.equal(completed.minute,21);
  assert.equal(finished(completed),true);
  assert.deepEqual(elapsedByUse(completed),{travel:14,emptyTravel:2,wait:0,transfer:2,handling:5});
  assert.equal(perform(run(['up','load:keys']),'load:slides').error,'capacity');
  assert.equal(perform(run(['up','unload:film','load:keys']),'unload:keys').error,'platform');
  assert.equal(perform(run(['up','load:keys','down']),'deliver:keys').error,'early');
  assert.equal(perform(run([]),'down').error,'floor');
  assert.equal(run(['up','deliver:film']),null);
  assert.equal(run(['up','load:keys','load:slides']),null);
  assert.equal(perform(run(Array(31).fill('wait')),'up').error,'closing');
  assert.equal(finished(run(Array(32).fill('wait'))),true);
  assert.equal(perform(completed,'wait').error,'finished');
  const late = run(['wait','wait','wait',...solution]);
  assert.deepEqual(late.delivered,[24,11,16]);
});

test('mobile operator stages, collects and delivers three parcels across a language switch and reload',async t=>{
  const prefix='/abdulrhman/',root=path.resolve(__dirname,'..');
  let base=process.env.RAVEN_QA_HOME;
  if(!base){
    const server=http.createServer(async(req,res)=>{
      const route=new URL(req.url,'http://fixture').pathname,file=path.resolve(root,route.slice(prefix.length));
      if(!route.startsWith(prefix)||!file.startsWith(root+path.sep))return res.writeHead(404).end();
      try{const bytes=await fs.readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(bytes);}
      catch{res.writeHead(404).end();}
    });
    await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>server.close());
    base='http://127.0.0.1:'+server.address().port+prefix+'raven/';
  }
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  for(const [width,lang] of [[320,'ar'],[390,'en'],[1280,'ar']]){
    const p=await browser.newPage({viewport:{width,height:820},hasTouch:width!==1280,reducedMotion:'reduce'});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(new URL('late-night/nightshift-post.html?lang='+lang,base).href);
    const command=id=>p.locator('[data-post="'+id+'"]');
    const activate=async b=>width===1280?b.press('Enter'):b.tap();
    await expect(command('down')).toBeDisabled();await expect(command('clock')).toHaveAttribute('data-minute','0');
    for(const [i,cmd] of solution.entries()){
      const b=command(cmd);if(width===1280)await b.focus();
      await activate(b);
      if(i===2){
        await activate(p.locator('[data-night-language]'));await p.reload();
        await expect(command('clock')).toHaveAttribute('data-minute','4');
        await expect(command('unload:keys')).toBeDisabled();
      }
    }
    await expect(command('result')).toHaveAttribute('data-on-time','3');
    await expect(command('result')).toBeFocused();await expect(command('clock')).toHaveAttribute('data-minute','21');
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await p.locator('.post-history summary').click();await expect(p.locator('.post-history li')).toHaveCount(solution.length);
    if(process.env.INK_QA_DIR){
      await fs.mkdir(process.env.INK_QA_DIR,{recursive:true});
      await p.screenshot({path:path.join(process.env.INK_QA_DIR,'elevator-mail-'+width+'.png'),animations:'disabled',fullPage:true});
    }
    await command('undo').click();await expect(command('result')).toBeHidden();await expect(command('deliver:film')).toBeEnabled();
    await command('reset').click();await expect(command('clock')).toHaveAttribute('data-minute','0');
    assert.deepEqual(errors,[]);await p.close();
  }
});
