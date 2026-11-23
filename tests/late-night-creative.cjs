const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),prefix='/abdulrhman/';
test('generated puzzles are unique and editing a constraint recounts possibilities',async()=>{
  const {generate,solutions,orders}=await import('../raven/late-night/creative/puzzle-rules.js');
  assert.equal(orders.length,24);
  for(const difficulty of ['simple','hard'])for(let seed=0;seed<150;seed++){
    const rules=generate(seed,difficulty);assert.equal(solutions(rules).length,1);
    assert.ok(solutions(rules.slice(0,-1)).length>1);
  }
});
test('director validates set, shot order and duration',async()=>{
  const {buildScene,validScene,matchCatalog}=await import('../raven/late-night/creative/scene.js');
  for(const known of ['انتظار عند رصيف بعد انطفاء اللوحة','Waiting on a pier after the sign goes dark'])assert.deepEqual(matchCatalog(known),{setting:'pier',unknown:[],ready:true});
  for(const [mixed,noun] of [['مصوّر عند رصيف مع زرافة','زرافة'],['Waiting on a pier with a giraffe','giraffe'],['A violin on the pier','violin'],['عازف كمان على الرصيف','كمان']]){
    const match=matchCatalog(mixed);assert.equal(match.setting,'pier');assert.equal(match.ready,false);assert.ok(match.unknown.includes(noun));
  }
  for(const place of ['pier','cinema','square']){
    const s=buildScene('The sign at dusk',place);assert.ok(validScene(s));assert.deepEqual(s.shots.map(x=>x.start),[0,s.blackout,s.blackout+s.shots[1].seconds]);
    for(const key of ['duration','blackout'])assert.equal(validScene({...s,[key]:99}),false);
    const copy=structuredClone(s);copy.shots[0].id='unlisted';assert.equal(validScene(copy),false);
  }
  assert.equal(buildScene('Unlisted prop','void'),null);
});
test('five creative routes work on Arabic and English mobile with real event sources',async t=>{
  const server=http.createServer(async(req,res)=>{
    const u=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+u.pathname.slice(prefix.length-1));
    if(!u.pathname.startsWith(prefix)||!p.startsWith(root+path.sep))return res.writeHead(404).end();
    try{const bytes=await fs.readFile(p);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2'})[path.extname(p)]||'application/octet-stream'}).end(bytes);}catch{res.writeHead(404).end();}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>server.close());
  const base='http://127.0.0.1:'+server.address().port+prefix+'raven/late-night/';
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  await Promise.all([['ar',320],['en',390]].map(async([lang,width])=>{
    const ctx=await browser.newContext({viewport:{width,height:828},reducedMotion:'reduce'});
    try{
      const p=await ctx.newPage(),errors=[];p.setDefaultTimeout(6500);p.on('pageerror',e=>errors.push(e.message));
      const q=id=>p.locator('[data-creative="'+id+'"]'),sim=id=>p.locator('[data-sim="'+id+'"]');
      const open=async id=>{await p.goto(base+id+'.html?lang='+lang);await p.locator('.night-bench h2, .night-bench a, .night-bench button').first().waitFor();};
      const fit=()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
      await open('city-radio');assert.equal(await q('clip').count(),0);
      await open('replay-caller');assert.equal(await q('explain').count(),0);
      await open('director-sentence');await q('prompt').fill(lang==='ar'?'مصوّر عند رصيف مع زرافة':'Waiting on a pier with a giraffe');
      await q('generate').click();assert.equal(await q('play').count(),0);assert.equal(await q('substitute').inputValue(),'pier');assert.ok((await p.locator('.night-bench').innerText()).includes(lang==='ar'?'زرافة':'giraffe'));await q('substitute').selectOption('cinema');await q('accept-set').click();
      await q('prompt').fill(lang==='ar'?'انتظار عند رصيف بعد انطفاء اللوحة':'Waiting on a pier after the sign goes dark');await q('generate').click();
      await q('duration').selectOption('8');await q('blackout').fill('3');
      await q('lighting1').selectOption('amber');await q('motion1').selectOption('pan');
      await p.locator('[data-night-language]').click();assert.match(await q('prompt').inputValue(),/رصيف|pier/i);assert.equal(await q('lighting1').inputValue(),'amber');
      await p.locator('[data-night-language]').click();await q('seek').fill('0');
      await q('play').focus();await p.keyboard.press('Enter');
      await p.waitForFunction(()=>document.querySelector('canvas[data-shot]')?.dataset.shot==='blackout');
      if(process.env.NIGHT_CREATIVE_SHOTS){await fs.mkdir(process.env.NIGHT_CREATIVE_SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.NIGHT_CREATIVE_SHOTS,'director-'+lang+'-'+width+'.png')});}
      await p.waitForFunction(()=>document.querySelector('canvas[data-shot]')?.dataset.seconds==='8.0');
      await q('save').click();const href=await p.locator('a[href*="idea-to-studio"]').getAttribute('href');assert.ok(new URL(href,base).searchParams.get('piece'));assert.ok(await fit());
      await open('city-radio');assert.equal(await q('clip').count(),1);assert.equal(await q('seek').getAttribute('max'),'10');await q('source0').click();
      await open('reading-actor');await q('custom').fill('My bag under the last chair');await q('send-custom').click();
      for(const id of ['time','door','check']){await q('line').selectOption(id);await q('speak').click();}
      assert.ok((await p.locator('.cr-columns').innerText()).includes('My bag under the last chair'));
      await q('alternate').selectOption('door');await q('turn3').click();
      assert.match(await p.locator('.cr-columns .cr-read').first().innerText(),lang==='ar'?/مرافقتك في الدور 3/:/escort you on turn 3/);
      assert.match(await p.locator('.cr-columns .cr-read').last().innerText(),lang==='ar'?/دون اتفاق/:/without an agreed escort/);assert.ok(await fit());
      await open('city-radio');assert.equal(await q('clip').count(),2);assert.equal(await q('seek').getAttribute('max'),'20');
      await q('source1').click();assert.equal(await p.locator('.cr-status').getAttribute('data-source'),'director-sentence');
      await q('clip').first().uncheck();assert.equal(await q('seek').getAttribute('max'),'10');assert.ok(await fit());
      await open('puzzle-owner');await q('difficulty').selectOption('hard');await q('hint').click();
      const solution=await p.evaluate(async()=>{const {generate,solutions}=await import('./creative/puzzle-rules.js');return solutions(generate(118,'hard'))[0];});
      for(let i=0;i<3;i++)await q('slot'+i).selectOption(String(solution[i]));await q('verify').click();
      const choices=await q('edit-rule').locator('option').count();await q('edit-rule').selectOption(String(choices-1));assert.ok(Number(await p.locator('[data-count]').getAttribute('data-count'))>1);assert.ok(await fit());
      await open('weightless-cam');await sim('push4').click();
      for(let i=0;i<10;i++)await sim('step').click();await sim('push-4').click();
      for(let i=0;i<9;i++)await sim('step').click();await sim('finish').click();
      await open('replay-caller');await q('explain').click();await q('cue1').click();assert.equal(await q('seek').inputValue(),'2.5');
      await q('try').click();assert.equal(await q('versionB').getAttribute('aria-pressed'),'true');assert.match(await p.locator('.cr-read').last().innerText(),/Δ \+0.00/);assert.ok(await fit());
      assert.deepEqual(errors,[]);
    }finally{await ctx.close();}
  }));
});
