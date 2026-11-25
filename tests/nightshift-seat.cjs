const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const prefix='/abdulrhman/',basePath=prefix+'raven/late-night/';
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.ogg':'audio/ogg','.woff2':'font/woff2'};

test('the bilingual screenplay has a reachable ending for every choice and an explicit checkpoint',async()=>{
  const {pages,stills,objects,endings,passage}=await import('../raven/late-night/nightshift/seat-script.js');
  const {beats,options,validCheckpoint,validPiece,approachEvents,endingEvents}=await import('../raven/late-night/nightshift/seat-rules.js');
  assert.deepEqual(Object.keys(pages),beats.map(row=>row.id));assert.deepEqual(Object.keys(endings),options);
  for(const beat of beats){
    const page=pages[beat.id];assert.ok(stills[page.still]);assert.ok(page.paragraphs.length>=2);
    for(const pair of [page.title,...page.paragraphs]){assert.match(pair[0],/\p{Script=Arabic}/u);assert.match(pair[1],/[a-z]/i);}
    if(beat.object){const obj=objects[beat.object];assert.ok(obj.text[0] && obj.text[1]);}
  }
  assert.deepEqual(passage.map(p=>[p.start,p.end]),[[0,2],[2,5],[5,7],[7,8]]);
  assert.ok(validCheckpoint({version:1,scene:'interval',events:approachEvents()}));
  assert.equal(validCheckpoint({version:1,scene:'interval',events:[]}),false);
  for(const ending of options){
    const data={version:1,ending,events:endingEvents(ending)};assert.ok(validPiece(data));
    assert.equal(validPiece({...data,events:data.events.slice(0,-1)}),false);
    assert.equal(validPiece({...data,ending:'unwritten'}),false);
    assert.equal(validPiece({...data,events:endingEvents(options.find(key=>key!==ending))}),false);
    assert.ok(endings[ending].before.every(p=>p.length===2) && endings[ending].after.every(p=>p.length===2));
  }
});

test('a visitor can read, listen, save at the interval, and complete/reopen every ending in either language',async t=>{
  const server=http.createServer(async(req,res)=>{
    const {pathname}=new URL(req.url,'http://localhost');
    const file=path.resolve(root,pathname.slice(prefix.length));
    if(!pathname.startsWith(prefix) || !file.startsWith(root+path.sep))return res.writeHead(404).end();
    try{const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);}
    catch{res.writeHead(404).end();}
  });
  await new Promise(ready=>server.listen(0,'127.0.0.1',ready));t.after(()=>server.close());
  const base='http://127.0.0.1:'+server.address().port+basePath,route=base+'nightshift-seat.html';
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  const {validPiece}=await import('../raven/late-night/nightshift/seat-rules.js');
  await Promise.all([['ar',320],['en',390]].map(async ([lang,width])=>{
    const ctx=await browser.newContext({viewport:{width,height:780},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
    const page=await ctx.newPage(),problems=[],audioRequests=[];
    page.on('pageerror',e=>problems.push(e.message));
    page.on('request',r=>{if(r.url().endsWith('.ogg'))audioRequests.push(r.url());});
    try{
      await page.goto(route+'?lang='+lang);
      await page.locator('[data-scene=ticket]').waitFor();
      assert.equal(await page.locator('html').getAttribute('dir'),lang==='ar'?'rtl':'ltr');
      assert.equal(await page.locator('[data-next]').count(),0);
      if(process.env.RAVEN_SEAT_CAPTURES){
        await fs.mkdir(process.env.RAVEN_SEAT_CAPTURES,{recursive:true});
        await page.locator('.seat-photo img').evaluate(i=>i.decode());
        await page.screenshot({path:path.join(process.env.RAVEN_SEAT_CAPTURES,'seat-opening-'+lang+'-'+width+'.png')});
      }
      for(const cue of ['ticket','seat','tape','line']){
        await page.locator('[data-inspect='+cue+']').tap();await page.locator('[data-object='+cue+']').waitFor();
        if(cue==='tape'){
          assert.equal(audioRequests.length,0);
          assert.equal(await page.locator('.seat-cues li').count(),4);
          await page.locator('[data-night-language]').tap();
          assert.equal(await page.locator('[data-object=tape]').count(),1);
          await page.locator('[data-night-language]').tap();
          if(lang==='en'){
            await page.locator('[data-excerpt]').tap();await page.locator('li[aria-current=time]').first().waitFor();
            assert.ok(audioRequests.length>0);await page.locator('[data-excerpt]').tap();
          }
        }
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.locator('[data-next]').focus();await page.keyboard.press('Enter');
      }
      await page.locator('[data-checkpoint]').tap();await page.locator('[data-checkpoint-status]').waitFor();
      await page.reload();await page.locator('[data-restore]').tap();await page.locator('[data-scene=interval]').waitFor();
      for(const choice of ['play','hold','ask']){
        await page.locator('[data-choice='+choice+']').tap();
        await page.locator('[data-perform='+choice+']').tap();
        await page.locator('[data-ending='+choice+']').waitFor();
        await page.locator('.seat-photo img').evaluate(i=>i.decode());
        await page.locator('[data-keep]').tap();assert.ok(await page.locator('[data-keep]').isDisabled());
        const item=await page.evaluate(ending=>Object.keys(localStorage).filter(k=>k.startsWith('raven.late-night.v1.piece.')).map(k=>JSON.parse(localStorage.getItem(k)).value).find(x=>x.data.ending===ending),choice);
        assert.equal(item.activity,'nightshift-seat');assert.equal(item.type,'seat-ending');assert.ok(validPiece(item.data));
        assert.ok(item.thumbnail.startsWith('data:image/jpeg;'));
        await page.goto(route+'?piece='+item.id+'&lang='+lang);
        await page.locator('[data-ending='+choice+']').waitFor();assert.ok(await page.locator('[data-keep]').isDisabled());
        await page.locator('[data-revisit]').tap();
      }
      await page.locator('[data-choice=ask]').tap();await page.locator('[data-perform=ask]').tap();
      await page.locator('[data-replay]').tap();await page.locator('[data-scene=ticket]').waitFor();
      assert.deepEqual(problems,[]);
    }finally{await ctx.close();}
  }));
  const ctx=await browser.newContext({viewport:{width:1280,height:800}});
  try{
    const page=await ctx.newPage();
    await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('no storage','QuotaExceededError');};});
    await page.route('**/nightshift/art/*.webp',r=>r.abort());await page.route('**/nightshift/art/*.ogg',r=>r.abort());
    await page.goto(route+'?lang=en');await page.locator('.seat-photo.is-missing').waitFor();
    for(let i=0;i<4;i++){
      await page.locator('[data-inspect]').click();
      if(i===2){await page.locator('[data-excerpt]').click();await page.getByText('The audio could not play.',{exact:false}).waitFor();assert.equal(await page.locator('.seat-cues li').count(),4);}
      await page.locator('[data-next]').click();
    }
    await page.locator('[data-checkpoint]').click();assert.equal(await page.locator('[data-checkpoint-status]').count(),0);
    await page.locator('[data-choice=hold]').click();await page.locator('[data-perform]').click();
    await page.locator('[data-keep]').click();assert.equal(await page.locator('[data-keep]').isDisabled(),false);
    assert.ok(await page.getByText('Device storage is full.',{exact:false}).isVisible());
    await page.locator('[data-replay]').click();assert.equal(await page.locator('[data-restore]').count(),0);
  }finally{await ctx.close();}
});
