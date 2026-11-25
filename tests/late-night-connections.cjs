const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
// Uses RAVEN_NIGHT_SITE when set; otherwise serves this checkout on a loopback port.
let base=process.env.RAVEN_NIGHT_SITE;
async function serveCheckout(t){
 if(base)return;
 const http=require('node:http'),prefix='/abdulrhman/';
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.mp4':'video/mp4','.wav':'audio/wav','.mp3':'audio/mpeg','.jpg':'image/jpeg'};
 const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix))return res.writeHead(404).end();
  const name=path.resolve(root,'.'+decodeURIComponent(url.pathname).slice(prefix.length-1)+(url.pathname.endsWith('/')?'index.html':''));
  if(!name.startsWith(root+path.sep))return res.writeHead(404).end();
  try{res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream'}).end(await fs.readFile(name));}catch{res.writeHead(404).end();}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>{server.closeAllConnections?.();server.close();base=undefined;});
 base='http://127.0.0.1:'+server.address().port+prefix;
}
const target=(p)=>new URL(p,base).href;
const fit=async p=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'fits mobile viewport');

test('night connections at 320px',async t=>{
 await serveCheckout(t);
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 async function open(lang,storageFailure=false){
  const context=await browser.newContext({viewport:{width:320,height:800},acceptDownloads:true,reducedMotion:'reduce'});
  if(storageFailure)await context.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.includes('dialogue'))throw new Error('storage unavailable');return set.call(this,key,value);};});
  await context.route(/^https?:\/\//,async r=>{if(new URL(r.request().url()).origin!==new URL(base).origin)return r.abort();return r.continue();});
  const p=await context.newPage();p.setDefaultTimeout(5500);return {context,p,go:(path)=>p.goto(target(path+(path.includes('?')?'&':'?')+'lang='+lang),{waitUntil:'domcontentloaded'})};
 }
 await t.test('one real director scene, two named boards, editable descriptions and readable files',async()=>{
  const {context,p,go}=await open('en');
  try{
   await go('raven/late-night/director-sentence.html');await p.locator('[data-creative=generate]').click();await p.locator('[data-creative=save]').click();
   await p.getByRole('link',{name:'Preview studio handoff'}).click();await p.locator('#board-name').waitFor();
   const firstPage=p.url();assert.equal(await p.locator('.connect-shots img').count(),3);await fit(p);
   const studioButton=p.getByRole('button',{name:'Create draft and open studio'});await p.locator('#board-name').fill('First cut');await studioButton.click();
   const edit=p.getByRole('textbox',{name:'Shot direction 1'});await edit.fill('Stay on the sign');await p.getByRole('button',{name:'Save draft edits'}).click();
   await p.reload();await edit.waitFor();assert.equal(await edit.inputValue(),'Stay on the sign');
   await fit(p);
   await p.waitForFunction(()=>[...document.querySelectorAll('img[data-storyboard-shot]')].every(i=>i.complete&&i.naturalWidth>0));
   const dir=await fs.mkdtemp(path.join(os.tmpdir(),'raven-named-board-'));
   try{
    for(const ext of ['json','pdf']){
     const pending=p.waitForEvent('download');await p.getByRole('button',{name:'Export '+ext.toUpperCase()}).click();
     await (await pending).saveAs(path.join(dir,'board.'+ext));
    }
    const json=JSON.parse(await fs.readFile(path.join(dir,'board.json'),'utf8'));assert.equal(json.project.name,'First cut');assert.equal(json.scenes.length,3);assert.equal(json.scenes[0].prompt,'Stay on the sign');assert.match(json.scenes[0].thumbnail,/^data:image/);
    const info=execFileSync('pdfinfo',[path.join(dir,'board.pdf')],{encoding:'utf8'});assert.match(info,/Pages:\s+[1-9]/);
    execFileSync('pdftoppm',['-f','1','-l','1','-scale-to','480','-png','-singlefile',path.join(dir,'board.pdf'),path.join(dir,'opened')]);
    assert.ok((await fs.stat(path.join(dir,'opened.png'))).size>8000);
   }finally{await fs.rm(dir,{recursive:true,force:true});}
   await p.getByRole('link',{name:'Return to my scene'}).click();await p.locator('[data-creative=play]').waitFor();assert.ok(p.url().includes('piece='));
   await p.goto(firstPage);await p.locator('#board-name').fill('Second cut');await studioButton.click();const menu=p.getByRole('combobox',{name:'Named drafts'});await menu.waitFor();
   const firstId=await menu.locator('option').filter({hasText:'First cut'}).getAttribute('value');await menu.selectOption(firstId);await edit.waitFor();assert.equal(await edit.inputValue(),'Stay on the sign');
  }finally{await context.close();}
 });

 await t.test('a saved press page and a courier ending reach a separate Studio draft and return to the same edition',async()=>{
  const {context,p,go}=await open('ar');
  const output=process.env.RAVEN_MANGA_BOARD_PROOF || await fs.mkdtemp(path.join(os.tmpdir(),'raven-manga-board-'));
  await fs.mkdir(output,{recursive:true});
  try{
   await go('raven/late-night/ink-page.html');
   for(const id of ['drying','window','press'])await p.locator('[data-page="pick-'+id+'"]').click();
   await p.locator('[data-page="preview"]').click();await p.locator('[data-page="save"]').click();
   await go('raven/late-night/my-notebook.html');
   let missingPanel=true;
   await p.route('**/ink/art/panel-press.webp*',route=>missingPanel?route.abort():route.continue());
   await p.getByRole('link',{name:'عاين لوحة اللقطات'}).first().click();
   await p.getByRole('button',{name:'أعد تحميل اللوحات'}).waitFor();
   assert.equal(await p.locator('.connect-form button[type="submit"]').isEnabled(),false);
   await p.locator('[data-board-duration="1"]').fill('4');
   await p.locator('#board-name').fill('بروفة المرفأ');
   missingPanel=false;await p.getByRole('button',{name:'أعد تحميل اللوحات'}).click();
   await p.locator('[data-night-language]').click();await p.getByRole('button',{name:'Create draft and open studio'}).waitFor();
   assert.equal(await p.locator('#board-name').inputValue(),'بروفة المرفأ');assert.equal(await p.locator('[data-board-duration="1"]').inputValue(),'4');
   await p.locator('[data-night-language]').click();
   const preview=p.locator('.connect-shots img');
   assert.deepEqual(await preview.evaluateAll(imgs=>imgs.map(i=>i.src.split('/').pop())),['panel-drying.webp','panel-window.webp','panel-press.webp']);
   await fit(p);
   await p.locator('#board-name').fill('بروفة المرفأ');await p.locator('.connect-form button').click();
   const stills=p.locator('[data-storyboard-shot]');await stills.first().waitFor();
   await stills.evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
   assert.equal(await p.getByRole('spinbutton').first().inputValue(),'4');
   await p.getByRole('spinbutton').nth(1).fill('3');
   await p.getByRole('textbox',{name:'وصف حركة اللقطة 2'}).fill('تتوقف الكاميرا عند زجاج النافذة.');
   await p.getByRole('button',{name:'احفظ تعديلات المسودة'}).click();
   await p.reload();await stills.first().waitFor();await stills.evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
   for(const ext of ['json','pdf']){
    const pending=p.waitForEvent('download');await p.getByRole('button',{name:new RegExp('^تنزيل '+ext.toUpperCase()+'$')}).click();
    await (await pending).saveAs(path.join(output,'manga-board.'+ext));
   }
   const json=JSON.parse(await fs.readFile(path.join(output,'manga-board.json'),'utf8'));
   assert.equal(json.language,'ar');assert.equal(json.project.name,'بروفة المرفأ');
   assert.deepEqual(json.scenes.map(s=>s.durationSec),[4,3,2]);
   assert.deepEqual(json.scenes.map(s=>s.thumbnail.split('/').pop()),['panel-drying.webp','panel-window.webp','panel-press.webp']);
   assert.equal(json.scenes[1].prompt,'تتوقف الكاميرا عند زجاج النافذة.');
   execFileSync('pdftoppm',['-scale-to','1150','-f','1','-l','1','-png','-singlefile',path.join(output,'manga-board.pdf'),path.join(output,'manga-board-opened')]);
   assert.ok((await fs.stat(path.join(output,'manga-board-opened.png'))).size>30000);
   await p.getByRole('link',{name:'ارجع إلى مشهدي'}).click();
   await p.locator('[data-page=sheet]').waitFor();assert.equal(await p.locator('[data-page=sheet]').getAttribute('data-panels'),'drying,window,press');

   const edition=await p.evaluate(async()=>{
    const s=await import('./night-store.js'),f='raven-rain-manga-2';
    return s.writePiece('ink-courier',{title:'نهاية المرفأ',type:f,data:{format:f,
      path:[15,10,5,0,1,2,3,4,9,14,19,24],order:['end','departure','middle'],weather:{rain:55,wind:14}}}).id;
   });
   await go('raven/late-night/idea-to-studio.html?piece='+edition);
   await preview.first().waitFor();assert.deepEqual(await preview.evaluateAll(imgs=>imgs.map(i=>i.src.split('/').pop())),['print-arrival.webp','print-departure.webp','print-letter.webp']);
   await p.locator('#board-name').fill('الرسالة');await p.locator('.connect-form button').click();
   const drafts=p.getByRole('combobox',{name:'المسودات المسماة'});await drafts.waitFor();assert.equal(await drafts.locator('option').count(),2);
   await p.getByRole('link',{name:'ارجع إلى مشهدي'}).click();await p.locator('#save-manga').waitFor();
   assert.equal(new URL(p.url()).searchParams.get('piece'),edition);assert.equal(await p.locator('#panels [data-panel]').first().getAttribute('data-panel'),'end');
  }finally{await context.close();if(!process.env.RAVEN_MANGA_BOARD_PROOF)await fs.rm(output,{recursive:true,force:true});}
 });

 await t.test('a real story ending transfers its actual title and thumbnail into the confirmed evening',async()=>{
  const {context,p,go}=await open('en');
  try{
    await go('raven/late-night/three-evening.html?programme=coast');
    await p.locator('[data-chapter-choice=scene]').selectOption('nightshift-seat');
    await p.getByRole('button',{name:'Start the evening'}).click();
    // The game-to-evening handoff is covered by rain-notebook. Enter chapter two with a confirmed game.
    await p.evaluate(async()=>{
      const store=await import('./night-store.js'),run=store.loadDraft('coastal-evening');
      const first=store.writePiece('ink-courier',{title:'First chapter',type:'raven-rain-manga-2',
        data:{format:'raven-rain-manga-2',path:[15,10,5,0,1,2,3,4,9,14,19,24],order:['departure','middle','end'],weather:{rain:60,wind:10}}});
      store.saveDraft('coastal-evening',{...run,earned:[first.id]});
    });
    await p.reload();await p.getByRole('link',{name:'Open chapter'}).click();
    for(const object of ['ticket','seat','tape','line']){
      await p.locator('[data-inspect="'+object+'"]').click();await p.locator('[data-next]').click();
    }
    await p.locator('[data-choice=hold]').click();await p.locator('[data-perform=hold]').click();
    await p.locator('.seat-photo img').evaluate(img=>img.decode());await p.locator('[data-keep]').click();
    const work=await p.evaluate(async()=>{
      const {pieces}=await import('./night-store.js'),{portableWork,readWork}=await import('./work-file.js');
      const item=pieces().find(row=>row.activity==='nightshift-seat');
      if(readWork(JSON.stringify(portableWork(item))).data.ending!=='hold')throw new Error('story round-trip');
      return item;
    });
    await p.getByRole('link',{name:'Review this work for your evening'}).click();
    assert.equal(await p.locator('.night-chapter figure').last().locator('figcaption').innerText(),work.title);
    assert.equal(await p.locator('.night-chapter figure').last().locator('img').getAttribute('src'),work.thumbnail);
    await p.getByRole('button',{name:'Use this work and continue'}).click();await p.reload();
    await p.getByRole('heading',{name:/3 \/ 3/}).waitFor();
    assert.equal(await p.locator('.night-chapter figure').last().locator('figcaption').innerText(),work.title);
  }finally{await context.close();}
 });
 await t.test('explicitly import a real Studio board, project ordered frames, export its own duration',async()=>{
  const {context,p,go}=await open('en');
  try{
   await go('raven/late-night/idea-to-studio.html?shots=exterior,hand,envelope&from=free');
   await p.locator('#board-name').fill('Night projection');await p.locator('.connect-form button').click();
   await p.getByRole('textbox',{name:'Shot direction 1'}).fill('Private director cue');
   await p.getByRole('button',{name:'Save draft edits'}).click();
   await go('raven/late-night/screening-room.html');const scene=id=>p.locator('[data-scene="'+id+'"]');
   assert.equal(await p.getByText('Night projection',{exact:true}).count(),0);
   await scene('studio-picker').click();await scene('studio-list').selectOption({label:'Night projection'});await scene('studio-add').click();
   await scene('pick-sample-plane').click();await scene('pick-sample-stage').click();await scene('start').click();
   assert.equal(await scene('runtime').inputValue(),'12');assert.equal(await scene('runtime').isDisabled(),true);
   const image=p.locator('img.ns-still');await image.waitFor();
   assert.match(await image.getAttribute('src'),/exterior\.webp$/);await scene('seek').fill('5.2');assert.match(await image.getAttribute('src'),/hand\.webp$/);
   await scene('seek').fill('9.1');assert.match(await image.getAttribute('src'),/envelope\.webp$/);
   for(let i=0;i<3;i++){
    await scene('pass').click();assert.equal(await p.locator('img.ns-still').count(),0);
    await scene('handoff').click();assert.equal(await p.getByText('Private director cue',{exact:false}).count(),0);
    await scene('reading').selectOption('0');await scene('return').click();await scene('handoff').click();await scene('reveal').click();
    if(i===0)assert.ok((await p.locator('pre').innerText()).includes('Private director cue'));
    await scene('next').click();
   }
   const downloaded=p.waitForEvent('download');await scene('export').click();const d=await downloaded;
   const txt=await fs.readFile(await d.path(),'utf8');assert.match(txt,/Night projection · 12 s/);assert.match(txt,/23 s/);assert.ok(!txt.includes('Private director cue'));await fit(p);
  }finally{await context.close();}
 });
 await t.test('real local interview, repeated operations and uncertain save',async()=>{
  for(const failure of [false,true]){
   const {context,p,go}=await open('ar',failure);
   try{
    await go('raven/late-night/dialogue-preview.html');await p.getByRole('link',{name:'ادخل غرفة الحوار'}).click();await p.locator('#new-question').click();
    assert.equal(await p.evaluate(()=>document.activeElement.id),'input');
    for(const msg of ['سؤال عن السجل','سؤال عن الورقة']){
     await p.locator('#input').fill(msg);await p.locator('#send').click();
     await p.waitForFunction(()=>!document.getElementById('send').disabled&&document.querySelector('#log .them:not(.operation)'));
    }
    assert.equal(await p.locator('#log .me').count(),2);assert.equal(await p.locator('#log .them').count(),2);
    assert.ok(await p.locator('#character-portrait').evaluate(i=>i.complete&&i.naturalWidth>0));
    await p.locator('#operation-summary').click();assert.equal(await p.locator('#operation-list li').count(),1);assert.ok((await p.locator('#operation-list').innerText()).includes('× 2'));
    if(failure)assert.match(await p.locator('#operation-list').innerText(),/غير مؤكد/);
    await fit(p);
   }finally{await context.close();}
  }
 });
 await t.test('episode choices are scoped, failed source retry and two framing crops of approved clip',async()=>{
  const {context,p,go}=await open('en');
  try{
   await go('raven/late-night/episode-ends.html');assert.equal(await p.locator('.connect-sources a').count(),3);
   // Intercept external episode sources with a small, seekable training film.
   const directory=await fs.mkdtemp(path.join(os.tmpdir(),'raven-episode-fixture-'));
   let film;
   try{
    const file=path.join(directory,'test.webm');
    execFileSync('ffmpeg',['-loglevel','error','-f','lavfi','-i','color=c=navy:s=160x96:r=5:d=24','-c:v','libvpx','-g','5','-y',file]);
    film=await fs.readFile(file);
   }finally{await fs.rm(directory,{recursive:true,force:true});}
   let fail=true;
   await context.route('**/raven17/episode-*.mp4*',async r=>{
    if(fail)return r.abort('failed');
    const range=r.request().headers().range?.match(/^bytes=(\d+)-(\d*)/);
    const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(film.length-1,Number(range[2])):film.length-1;
    return r.fulfill({status:range?206:200,contentType:'video/webm',headers:{'Accept-Ranges':'bytes',...(range?{'Content-Range':'bytes '+start+'-'+end+'/'+film.length}:{})},body:film.subarray(start,end+1)});
   });
   async function savedPosition(player,n){
    await player.evaluate(async(v,n)=>{v.pause();const seeked=new Promise(resolve=>v.addEventListener('seeked',resolve,{once:true}));v.currentTime=n;await seeked;v.dispatchEvent(new Event('timeupdate'));},n);
   }
   for(const [n,activity] of [[1,'camera'],[2,'sound'],[3,'free']]){
    fail=true;await go('raven/episodes/content.html?episode='+n);
    const player=p.locator('#ravenEpisodePlayer');await player.waitFor();
    const src=await player.getAttribute('src');assert.ok(src.includes('episode-'+n+'.mp4'));
    await player.evaluate(v=>{v.muted=true;v.load();});await p.locator('#rvnRetryVideo').waitFor();
    fail=false;await p.locator('#rvnRetryVideo').click();await p.waitForFunction(()=>document.querySelector('#ravenEpisodePlayer').readyState>=2);
    assert.equal(await player.getAttribute('src'),src);
    await savedPosition(player,7+n);
    assert.equal(await p.evaluate(n=>Number(localStorage.getItem('raven17_episode_'+n+'_progress')),n),7+n);
    if(n>1)assert.equal(await p.evaluate(n=>Number(localStorage.getItem('raven17_episode_'+(n-1)+'_progress')),n),6+n);
    await player.evaluate(async v=>{v.muted=true;v.currentTime=v.duration-.55;await v.play();});
    await p.locator('#rvnAfterCredits').waitFor();
    assert.equal(await p.locator('#rvnAfterNext').isVisible(),n<3);
    assert.match(await p.locator('#rvnAfterWorkshop').getAttribute('href'),new RegExp('activity='+activity));
    assert.equal(await player.getAttribute('src'),src);
    // Keep a partial rewatch to check that opening the next episode preserves it.
    await savedPosition(player,7+n);
   }
   await go('raven/content.html');const details=p.locator('.rvnFramingExercise'),clip=p.locator('#atmosphere-paper-detail');const before=await clip.getAttribute('src');await details.locator('summary').click();
   await p.locator('[data-frame-choice=phone]').click();assert.equal(await details.locator('figure:visible').count(),2);assert.equal(await clip.getAttribute('src'),before);
   assert.match(before,/paper-detail\.mp4$/);assert.equal(await clip.evaluate(v=>v.paused),true);assert.equal(await details.locator('.phone img').evaluate(image=>image.src),new URL('./assets/atmosphere-v1/paper-detail.webp',p.url()).href);
   await go('raven/late-night/behind-frame.html');assert.ok((await p.locator('[href*="#behind-paper-phone"]').getAttribute('href')).includes('lang=en'));
  }finally{await context.close();}
 });
});
