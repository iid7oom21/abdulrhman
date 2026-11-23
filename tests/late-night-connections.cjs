const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const base=process.env.RAVEN_NIGHT_SITE || 'http://127.0.0.1:7761/abdulrhman/';
const target=(p)=>new URL(p,base).href;
const fit=async p=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'fits mobile viewport');

test('night connections at 320px',async t=>{
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
    fail=true;await go('raven/content.html?episode='+n);
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
   assert.match(before,/paper-detail\.mp4$/);assert.equal(await clip.evaluate(v=>v.paused),true);assert.equal(await details.locator('.phone img').getAttribute('src'),'./assets/atmosphere-v1/paper-detail.webp');
   await go('raven/late-night/behind-frame.html');assert.ok((await p.locator('[href*="#behind-paper-phone"]').getAttribute('href')).includes('lang=en'));
  }finally{await context.close();}
 });
});
