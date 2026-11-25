const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium,expect}=require('playwright/test');

test('seeded capillary diffusion is local, repeatable, reversible and conserves ink',async()=>{
  const {reload,clone,apply,measures,WIDTH,validCommand}=await import('../raven/late-night/nightshift/paper-rules.js');
  const water={type:'water',points:[[76,41]]};
  const run={type:'spread',seed:41,absorption:75,dryness:15};
  const ink={type:'ink',points:[[3,38],[7,38]]};
  const base=reload([ink,water]).sheet, first=reload([ink,water,run]);
  assert.deepEqual(first.before,base);
  assert.deepEqual(reload([ink,water,run]).sheet,first.sheet);
  assert.notDeepEqual(reload([ink,water,{...run,seed:86}]).sheet.ink,first.sheet.ink);
  assert.deepEqual(reload([ink,water,{...run,dryness:100}]).sheet.ink,base.ink);
  assert.deepEqual(reload([ink,water,{...run,absorption:0}]).sheet.ink,base.ink);
  assert.deepEqual(reload([ink,run]).sheet.ink,reload([ink]).sheet.ink);
  assert.ok(measures(first.sheet).marked>measures(base).marked);
  assert.equal(measures(first.sheet).mass,measures(base).mass);
  assert.equal(first.sheet.ink[38*WIDTH+3],base.ink[38*WIDTH+3]);
  assert.equal(validCommand({type:'water',points:[[-1,0]]}),false);
  const edge=clone(base);apply(edge,{type:'ink',points:[[0,0]]});apply(edge,{type:'water',points:[[0,0]]});
  const mass=measures(edge).mass;apply(edge,run);assert.equal(measures(edge).mass,mass);
});

test('paper workshop accepts touch and keyboard, exports its exact displayed pixels and restores the sheet',async t=>{
  const root=path.resolve(__dirname,'..'),prefix='/abdulrhman/';
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
  for(const [width,lang] of [[320,'ar'],[390,'en'],[1280,'en']]){
    const p=await browser.newPage({viewport:{width,height:800},hasTouch:width<600,reducedMotion:'reduce'});
    const errors=[];p.on('pageerror',e=>errors.push(e.message));
    if(width===320)await p.route('**/paper-grain.webp',r=>r.abort());
    await p.goto(new URL('late-night/nightshift-paper.html?lang='+lang,base).href);
    const field=name=>p.locator('[data-paper="'+name+'"]'), sheet=field('sheet');
    const displayed=()=>sheet.evaluate(c=>c.toDataURL());
    if(width===320) {
      await expect(field('retry-grain')).toBeVisible();await p.unroute('**/paper-grain.webp');await field('retry-grain').click();
    }
    await expect(sheet).toHaveAttribute('data-stock','grain');
    await expect(field('spread')).toBeDisabled();await field('dab').click();
    const before=await displayed();await field('spread').click();
    const after=await displayed();assert.notEqual(after,before);
    assert.equal(await field('before').evaluate(c=>c.toDataURL()),before);
    assert.equal(await field('after').evaluate(c=>c.toDataURL()),after);
    await field('undo').click();assert.equal(await displayed(),before);
    await field('redo').click();assert.equal(await displayed(),after);
    await p.locator('[data-night-language]').click();await expect(sheet).toHaveAttribute('data-stock','grain');
    await p.reload();await expect(sheet).toHaveAttribute('data-stock','grain');assert.equal(await displayed(),after);
    const download=p.waitForEvent('download');await field('png').click();
    const file=await download;
    assert.equal(file.suggestedFilename(),'raven-rain-paper.png');
    const bytes=await fs.readFile(await file.path());
    assert.equal(bytes.readUInt32BE(16),576);assert.equal(bytes.readUInt32BE(20),352);
    const same=await sheet.evaluate(async(c,data)=>{
      const image=await createImageBitmap(await(await fetch('data:image/png;base64,'+data)).blob());
      const copy=document.createElement('canvas');copy.width=image.width;copy.height=image.height;
      const g=copy.getContext('2d');g.drawImage(image,0,0);image.close();
      const pixels=g.getImageData(0,0,c.width,c.height).data,source=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      return pixels.every((v,i)=>v===source[i]);
    },bytes.toString('base64'));assert.equal(same,true);
    if(process.env.INK_QA_DIR){await fs.mkdir(process.env.INK_QA_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.INK_QA_DIR,'paper-'+width+'.png'),fullPage:true,animations:'disabled'});}
    await field('ink').click();const originalMark=Number(await field('measure').getAttribute('data-ink'));
    if(width<600) {
      await sheet.scrollIntoViewIfNeeded();const box=await sheet.boundingBox(),cdp=await p.context().newCDPSession(p);
      const touch=(type,x)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:x===null?[]:[{x:box.x+box.width*x,y:box.y+box.height*.16}]});
      await touch('touchStart',.15);await touch('touchMove',.47);await touch('touchEnd',null);
    }else{
      await sheet.focus();for(let i=0;i<14;i++)await p.keyboard.press('ArrowUp');
      await p.keyboard.press('Space');await p.keyboard.press('Shift+ArrowRight');
    }
    assert.ok(Number(await field('measure').getAttribute('data-ink'))>originalMark);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await field('reset').click();await expect(field('undo')).toBeDisabled();await expect(field('spread')).toBeDisabled();
    assert.deepEqual(errors,[]);await p.close();
  }
});
