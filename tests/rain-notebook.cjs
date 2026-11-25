const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');

test('portfolio validates editable work, imports as a copy and keeps independent local state', async t => {
  const root=path.resolve(__dirname,'../raven/late-night'), prefix='/abdulrhman/raven/late-night/';
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost'), file=path.resolve(root,url.pathname.slice(prefix.length));
    if(!url.pathname.startsWith(prefix)||!file.startsWith(root+path.sep))return res.writeHead(404).end();
    try {const data=await fs.readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.end(data);}
    catch {res.writeHead(404).end();}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>server.close());
  const base='http://127.0.0.1:'+server.address().port+prefix;
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport:{width:320,height:720},reducedMotion:'reduce',acceptDownloads:true});
  const p=await context.newPage(),tab=await context.newPage();
  p.setDefaultTimeout(9000);
  const book=base+'my-notebook.html?lang=en',pick=p.locator('#night-work-import');
  await p.goto(book);await pick.waitFor();
  const packet=await p.evaluate(async()=>{
    const {portableWork}=await import('./work-file.js'),{MANGA_FORMAT}=await import('./ink/courier-rules.js');
    const {writePiece}=await import('./night-store.js');
    localStorage.setItem('raven.case.test','private sentinel');
    const work=writePiece('ink-courier',{title:'Harbour letter',type:MANGA_FORMAT,data:{
      format:MANGA_FORMAT,path:[15,10,5,0,1,2,3,4,9,14,19,24],order:['end','departure','middle'],weather:{rain:42,wind:-10}
    }});
    return portableWork(work);
  });
  assert.ok(packet);
  await p.reload();
  const jsonEvent=p.waitForEvent('download');
  await p.getByRole('button',{name:'Download JSON',exact:true}).click();
  assert.deepEqual(JSON.parse(await fs.readFile(await (await jsonEvent).path(),'utf8')),packet);
  async function upload(value){await pick.setInputFiles({name:'work.json',mimeType:'application/json',buffer:Buffer.from(value)});}
  await upload(JSON.stringify(packet));
  assert.equal(await p.locator('.night-item').count(),1);
  await p.getByRole('button',{name:'Add to my portfolio'}).click();
  assert.equal(await p.locator('.night-item').count(),2);
  const href=await p.getByRole('link',{name:'Open to edit'}).first().getAttribute('href');
  assert.ok(new URL(href).pathname.endsWith('/ink-courier.html'));
  const values=await p.evaluate(async()=>{const {pieces}=await import('./night-store.js');return pieces();});
  assert.notEqual(values[0].id,values[1].id);assert.deepEqual(values[0].data,values[1].data);
  for(const bad of [
    {...packet,version:4},
    {...packet,data:{...packet.data,path:[500]}},
    {...packet,data:{...packet.data,thumbnail:'https://invalid.example/private'}},
    {...packet,activity:'../deleted-name/play'}
  ]){
    await upload(JSON.stringify(bad));await p.waitForFunction(()=>!document.querySelector('#night-work-import').value);
    assert.equal(await p.getByRole('button',{name:'Add to my portfolio'}).count(),0);
  }
  await upload(' '.repeat(65537));await p.getByText('Work files can be up to 64 KiB.').waitFor();
  await p.getByRole('button',{name:'Delete piece'}).first().click();
  await p.getByRole('button',{name:'Delete',exact:true}).click();
  assert.equal(await p.locator('.night-item').count(),1);
  assert.equal(await p.evaluate(()=>localStorage.getItem('raven.case.test')),'private sentinel');
  await tab.goto(book);
  await p.evaluate(async()=>{const {saveDraft}=await import('./night-store.js');saveDraft('test-rain',{turn:1});});
  await tab.evaluate(async()=>{const {loadDraft}=await import('./night-store.js');loadDraft('test-rain');});
  await p.evaluate(async()=>{const {saveDraft}=await import('./night-store.js');saveDraft('test-rain',{turn:2});});
  assert.equal(await tab.evaluate(async()=>{const {saveDraft}=await import('./night-store.js');return saveDraft('test-rain',{turn:3});}),false);
  assert.equal(await p.evaluate(async()=>{const {loadDraft}=await import('./night-store.js');return loadDraft('test-rain').turn;}),2);
  assert.deepEqual(await p.evaluate(async()=>{
    const s=await import('./night-store.js');
    const corrupt='raven.late-night.v1.draft.broken-rain';localStorage.setItem(corrupt,'{broken');
    const before=s.saveDraft('broken-rain',{});const after=localStorage.getItem(corrupt);
    const thumb=s.writePiece('ink-page',{title:'Proof',type:'ink-page',data:{},thumbnail:'data:image/png;base64,'+'A'.repeat(225000)});
    const replaced=s.saveDraft('broken-rain',{turn:0},{replace:true});
    return [before,after,Boolean(thumb),Boolean(thumb.thumbnail),replaced,s.loadDraft('broken-rain')];
  }),[false,'{broken',true,false,true,{turn:0}]);
  const balances=await p.evaluate(async()=>{
    const s=await import('./night-store.js'),types=await import('./work-file.js');
    const scene=await import('./creative/scene.js'),camera=await import('./sims/camera-rules.js');
    const variants=[
      {activity:'ink-camera',type:'ink-camera',data:{version:1,mode:'free',travel:65,spacing:24,seek:50}},
      {activity:'director-sentence',type:'night-scene',data:scene.buildScene('wait on the pier','pier')},
      {activity:'weightless-cam',type:'camera-run',data:camera.cameraRun([{t:0,dv:1}],12)}
    ];
    const match=variants.map(x=>{const p={...x,title:'Testing'};return JSON.stringify(types.portableWork(types.readWork(JSON.stringify(types.portableWork(p)))))===JSON.stringify(types.portableWork(p));});
    const restore=Storage.prototype.setItem;let error;
    Storage.prototype.setItem=()=>{throw new DOMException('Full','QuotaExceededError');};
    try{window.addEventListener('night:storage',e=>error=e.detail,{once:true});const item=s.writePiece('ink-page',{title:'Unsaved',type:'ink-page',data:{}});return {match,saved:!!item,reason:error.reason,title:error.value.title};}
    finally{Storage.prototype.setItem=restore;}
  });
  assert.deepEqual(balances,{match:[true,true,true],saved:false,reason:'quota',title:'Unsaved'});
  await t.test('a complete silent evening carries the actual courier manga and print-shop page into its closing piece',async()=>{
    await p.goto(base+'three-evening.html?programme=coast&lang=en');
    await p.locator('[data-chapter-choice="finish"]').selectOption('postcard');
    await p.getByRole('button',{name:'Start the evening'}).click();
    const go=p.getByRole('link',{name:'Open chapter'});
    await go.click();
    for(const step of packet.data.path){
      await p.locator('[data-cell="'+step+'"]').click();
      await p.locator('#confirm').click();
    }
    await p.locator('#see-manga').click();
    await p.locator('#save-manga').click();
    const back=p.getByRole('link',{name:'Review this work for your evening'});
    await back.click();await p.getByRole('button',{name:'Use this work and continue'}).click();
    await go.click();
    for(const id of ['type','press','window'])await p.locator('[data-page="pick-'+id+'"]').click();
    await p.locator('[data-page=preview]').click();await p.locator('[data-page=save]').click();
    await back.click();await p.getByRole('button',{name:'Use this work and continue'}).click();
    await p.goto(base+'three-evening.html?lang=en');
    await p.getByRole('heading',{name:'3 / 3 · Screening card'}).waitFor();
    const file=p.waitForEvent('download');
    await p.getByRole('button',{name:'Download screening card PNG'}).click();
    const bytes=await fs.readFile(await (await file).path());assert.equal(bytes.subarray(1,4).toString(),'PNG');
    await p.getByRole('button',{name:'Finish the evening'}).click();
    await p.getByRole('button',{name:'Keep the programme in my portfolio'}).click();
    const checkpoint=await p.evaluate(async()=>(await import('./night-store.js')).loadDraft('coastal-evening'));
    assert.equal(checkpoint.earned.length,2);assert.ok(checkpoint.finished);
    await p.goto(book);
    const saved=p.locator('.night-item').filter({hasText:'Screening card'});
    await saved.getByRole('link',{name:'Open to edit'}).click();
    await p.getByRole('heading',{name:'Your evening is complete'}).waitFor();
    await p.goto(book);
    await p.locator('a[href*="ink-courier.html?piece='+checkpoint.earned[0]+'"]').click();
    assert.equal(await p.locator('#panels [data-panel]').count(),3);
    assert.equal(await p.locator('#save-manga').isEnabled(),true);
  });

});
