const {test}=require('node:test');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),prefix='/abdulrhman/';
test('old title workshop, three windows, portfolio, two-person planner and quick entry',async t=>{
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix))return res.writeHead(404).end();
  const name=path.resolve(root,'.'+url.pathname.slice(prefix.length-1)+(url.pathname.endsWith('/')?'index.html':''));
  if(!name.startsWith(root+path.sep))return res.writeHead(404).end();
  try{const bytes=await fs.readFile(name);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'})[path.extname(name)]||'application/octet-stream'}).end(bytes);}catch{res.writeHead(404).end();}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>server.close());
 const host='http://127.0.0.1:'+server.address().port+prefix+'raven/',base=host+'late-night/';
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',acceptDownloads:true});t.after(()=>ctx.close());
 const p=await ctx.newPage(),errors=[];p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));
 const visit=slug=>p.goto(base+slug+'.html?lang=en');
 const back=p.locator('.night-wing'),heading=()=>p.locator('.night-chapter h2').first().innerText();
 const titleFrame=p.frameLocator('#site-content'),q=id=>titleFrame.locator('[data-sc="'+id+'"]'),win=id=>p.locator('[data-scene="'+id+'"]');
 const items=()=>p.locator('.night-item');
 // The coastal still is a single wide image, unlike the adjacent three-shot montage.
 for (const [width, lang] of [[320,'en'],[390,'ar'],[1280,'en']]) {
   await p.setViewportSize({width,height:844});
   await p.goto(host+'?lang='+lang+'#late-night');
   const feature = titleFrame.locator('#late-night');
   await feature.scrollIntoViewIfNeeded();
   assert.match(await feature.locator('img').getAttribute('src'), /late-night\/assets\/photo\/harbour-cinema\.webp$/);
   const loaded = await feature.locator('img').evaluate(async image => {await image.decode(); return new URL(image.currentSrc).pathname;});
   assert.equal(loaded.split('/').pop(),width <= 640 ? 'harbour-cinema-mobile.webp' : 'harbour-cinema.webp');
   const fits = await feature.locator('img').evaluate(async image => {
     await image.decode();
     return Math.abs(image.clientWidth - image.parentElement.clientWidth) <= 1
       && Math.abs(image.clientWidth / image.clientHeight - image.naturalWidth / image.naturalHeight) < 0.02;
   });
   assert.ok(fits, width+'px: the coastal artwork fills its frame at its original proportions');
   await feature.locator('.afterShowPlay').click();
   await p.waitForURL(base+'?lang='+lang);
   await p.locator('.night-grid a').first().waitFor();
 }
 await p.setViewportSize({width:390,height:844});
 await p.goto(host+'?lang=en');await p.locator('#archive-night-short').click();await p.waitForURL('**/station-shadow.html?lang=en');
 await p.locator('[data-game="record"]').click();assert.equal(await p.locator('.night-bench canvas[data-phase="record"]').count(),1);
 await visit('time-door');assert.equal(await p.locator('.night-bench a').count(),2);await p.locator('a[href*="festival-chair"]').click();
 await p.getByLabel('Visitors').selectOption('two');await p.getByLabel('Sound').selectOption('off');const old=p.locator('.night-chapter').nth(0),fresh=p.locator('.night-chapter').nth(1);
 assert.ok((await old.locator('h3').innerText()).includes('Director'));assert.ok((await fresh.locator('h3').innerText()).includes('Echo')||(await fresh.locator('a').getAttribute('href')).includes('echo-two'));
 const prev=await fresh.locator('h3').innerText(),oldID=await old.locator('a').getAttribute('href');
 await fresh.getByRole('button',{name:'Swap activity'}).click();assert.notEqual(await fresh.locator('h3').innerText(),prev);assert.equal(await old.locator('a').getAttribute('href'),oldID);
 await p.reload();assert.equal(await p.getByLabel('Visitors').inputValue(),'two');assert.equal(await p.getByLabel('Sound').inputValue(),'off');
 await p.getByRole('link',{name:'A three-chapter evening',exact:true}).click();await p.getByRole('link',{name:'Open the title workshop'}).click();
 await q('first').fill('Midnight');await q('second').fill('Glass');await titleFrame.locator('#as-language').click();await q('night-title').waitFor();assert.equal(await q('first').inputValue(),'Midnight');
 await titleFrame.locator('#as-language').click();await q('night-title').click();
 assert.equal(await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('raven.late-night.v1.piece.')).length),0);
 await q('night-title-confirm').click();await titleFrame.getByRole('link',{name:'Continue to the windows chapter'}).click();
 assert.match(await heading(),/2 \/ 3/);assert.match(await p.locator('.night-chapter').innerText(),/Midnight Glass/);
 await p.getByRole('link',{name:'Choose a window shot'}).click();for(const i of [2,1,5])await win('window-'+i).click();await win('screen').click();await win('play').click();
 await win('feature-1').click({timeout:13000});await win('save').click();await p.getByRole('link',{name:'Review transfer to chapter three'}).click();
 assert.match(await heading(),/3 \/ 3/);const png=p.getByRole('button',{name:'Download card PNG'});
 const transfer=p.waitForEvent('download');await png.click();const bytes=await fs.readFile(await (await transfer).path());
 assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(bytes.readUInt32BE(16),700);assert.equal(bytes.readUInt32BE(20),860);
 // Open the exported PNG and compare its framed image to the selected window still.
 const frame=await p.evaluate(async pngBytes=>{
   const {pieces,loadDraft}=await import('./night-store.js');
   const selected=pieces().find(piece=>piece.id===loadDraft('three-evening').shotId);
   const shot=new Image();shot.src=selected.thumbnail;await shot.decode();
   const poster=await createImageBitmap(new Blob([new Uint8Array(pngBytes)],{type:'image/png'}));
   const sample=document.createElement('canvas');sample.width=628;sample.height=400;
   const c=sample.getContext('2d',{willReadFrequently:true});
   c.drawImage(poster,-36,-38);poster.close();
   const actual=c.getImageData(0,0,628,400).data;
   const ratio=shot.naturalWidth/shot.naturalHeight,w=Math.min(628,400*ratio),h=w/ratio;
   c.fillStyle='#17262b';c.fillRect(0,0,628,400);
   c.drawImage(shot,(628-w)/2,(400-h)/2,w,h);
   const expected=c.getImageData(0,0,628,400).data;
   let difference=0;
   for(let i=0;i<actual.length;i+=4)difference+=Math.abs(actual[i]-expected[i])+Math.abs(actual[i+1]-expected[i+1])+Math.abs(actual[i+2]-expected[i+2]);
   return {width:w,height:h,meanDifference:difference/(628*400*3)};
 },[...bytes]);
 assert.ok((frame.width<628 || frame.height<400) && frame.meanDifference<1,'The exported card preserves the complete selected shot and its original proportions: '+JSON.stringify(frame));
 await p.getByRole('button',{name:'Keep in my portfolio'}).click();await back.click();await visit('three-evening');assert.match(await heading(),/3 \/ 3/);
 await visit('my-notebook');assert.equal(await items().count(),3);
 await p.evaluate(()=>localStorage.setItem('raven.case.sentinel-evening','untouched'));
 const book=await p.evaluate(async()=>{const {pieces}=await import('./night-store.js');return pieces();});
 const title=book.find(p=>p.activity==='titles'),shot=book.find(p=>p.activity==='seven-windows');assert.equal(shot.data.titlePiece,title.id);assert.deepEqual(shot.data.windows,[3,2,6]);assert.equal(shot.data.feature,1);
 const titleCard=items().filter({has:p.locator('a[href*="nightPiece"]')});await titleCard.getByRole('link',{name:'Open to edit'}).click();
 assert.equal(await q('first').inputValue(),'Midnight');await q('second').fill('Water');await titleFrame.locator('#as-language').click();assert.equal(await q('second').inputValue(),'Water');
 await q('night-title').click();await q('night-title-confirm').click();await titleFrame.locator('a[href*="my-notebook.html"]').click();assert.equal(await items().count(),4);
 const edited=items().filter({hasText:'Midnight Water'});assert.equal(await edited.count(),1);
 const copy=await p.evaluate(async()=>{const {pieces}=await import('./night-store.js');return pieces().find(r=>r.title==='Midnight Water');});
 await p.goto(base+'three-evening.html?lang=en&titlePiece='+copy.id+'&shotPiece='+shot.id);assert.match(await heading(),/2 \/ 3/);
 await p.reload();assert.match(await heading(),/2 \/ 3/);assert.equal(await p.locator('canvas.night-poster').count(),0);
 await visit('my-notebook');await edited.getByRole('button',{name:'Delete piece',exact:true}).click();await edited.getByRole('button',{name:'Delete',exact:true}).click();
 assert.equal(await items().count(),3);assert.equal(await p.evaluate(()=>localStorage.getItem('raven.case.sentinel-evening')),'untouched');
 const remain=await p.evaluate(async()=>{const {pieces}=await import('./night-store.js');return pieces().map(p=>p.id).sort();});assert.deepEqual(remain,book.map(p=>p.id).sort());
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
});
