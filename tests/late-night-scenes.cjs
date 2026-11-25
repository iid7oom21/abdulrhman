const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),base='http://night.test/abdulrhman/',room=base+'raven/late-night/';
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp','.wav':'audio/wav'};
test('interactive scenes and the screening room under the production prefix',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  for(const [lang,width] of [['ar',320],['en',390],['en',1024]])await t.test(lang+' '+width,async suite=>{
    const ctx=await browser.newContext({viewport:{width,height:830},reducedMotion:'reduce',hasTouch:width<500});
    let deniedFile='';
    const errors=[],outside=[];
    await ctx.route('**/*',async r=>{
      const u=new URL(r.request().url());if(!u.href.startsWith(base)){outside.push(u.href);return r.abort();}
      if(deniedFile&&u.pathname.endsWith(deniedFile))return r.abort();
      const f=path.resolve(root,u.pathname.slice('/abdulrhman/'.length));
      try {return await r.fulfill({contentType:mime[path.extname(f)],body:await fs.readFile(f)});}catch{return r.fulfill({status:404,body:''});}
    });
    await ctx.addInitScript(()=>{if(location.search.includes('storage-denied'))Storage.prototype.setItem=function(){throw Error('denied for fixture');};});
    const p=await ctx.newPage();p.setDefaultTimeout(4000);p.on('pageerror',e=>errors.push(e.message));
    const open=(id,query='')=>p.goto(room+id+'.html?lang='+lang+query);
    const field=k=>p.locator('[data-scene="'+k+'"]');
    const click=k=>field(k).click(),fill=(k,v)=>field(k).fill(String(v));
    const fits=async()=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const cap=()=>p.locator('.ns-stage figcaption').innerText();
    const image=()=>p.locator('canvas').first().evaluate(c=>c.toDataURL());
    const pieces=()=>p.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.includes('late-night.v1.piece.')).map(([,v])=>JSON.parse(v).value));
    const download=async id=>{const [e]=await Promise.all([p.waitForEvent('download'),click(id)]);return {name:e.suggestedFilename(),body:await fs.readFile(await e.path())};};
    try {
      await suite.test('each standalone scene loads only the requested activity and shared drawing helpers',async()=>{
        for(const route of ['memory-lift','seven-windows','curtain-party','sound-museum']){
          await open(route);const negative=p.locator('.ns-stage canvas[data-art="photo"]');await negative.waitFor();
          assert.equal(await negative.evaluate(c=>c.width/c.height),1.5);
          const modules=await p.evaluate(()=>performance.getEntriesByType('resource').map(e=>new URL(e.name).pathname).filter(n=>n.includes('/late-night/scenes/')&&n.endsWith('.js')).map(n=>n.split('/').at(-1)));
          assert.deepEqual([...new Set(modules)].sort(),[route+'.js','scene-piece.js','start.js','art.js','ui.js'].sort());
        }
      });
      await suite.test('a missing stage plate keeps the cue sheet, audience view and save available',async()=>{
        deniedFile='curtain-closed.webp';
        try {
          await open('curtain-party');await p.locator('.ns-stage canvas[data-art="diagram"]').waitFor();
          await fill('seek',8);await click('backstage');await click('save');await fits();
          assert.deepEqual(JSON.parse((await download('export')).body).times,[1,3,4]);
          deniedFile='';await click('retry-scene-photo');
          await p.locator('.ns-stage canvas[data-art="photo"]').waitFor();
          assert.equal(await field('seek').inputValue(),'8');
        } finally { deniedFile=''; }
      });
      await suite.test('edits from 1978 leave distinct later visual and textual traces',async()=>{
        await open('memory-lift');await field('move-0').waitFor();const before=await image();
        await click('move-1');await click('move-2');assert.notEqual(await image(),before);
        await click('era-1');assert.match(await cap(),/repair seam|خط إصلاح/);await click('era-2');assert.match(await cap(),/now lights|ينير المصباح/);
        await p.locator('[data-night-language]').click();assert.equal(await field('era-2').getAttribute('aria-pressed'),'true');
        const result=await download('export');assert.deepEqual(JSON.parse(result.body).changes,[1,2]);
        await click('save');const entry=(await pieces()).find(e=>e.activity==='memory-lift');
        assert.ok(entry.thumbnail.startsWith('data:image/webp'));await open('memory-lift','&piece='+entry.id);assert.equal(await field('era-2').getAttribute('aria-pressed'),'true');
        await fits();
      });
      await suite.test('window selection, actual playback, missed stories, confirmed title-to-shot handoff',async()=>{
        await open('seven-windows');
        const title=await p.evaluate(async()=>{const {writePiece}=await import('./night-store.js');return writePiece('titles',{title:'Luminous Jetty',type:'title',data:{words:['Luminous','Jetty']}}).id;});
        await open('seven-windows','&evening=1&titlePiece='+title);
        await click('window-2');await click('clock');await click('window-1');await click('window-6');await click('screen');
        const start=await image();await click('play');
        await p.waitForFunction(()=>+document.querySelector('[data-scene=seek]').value>.1);
        await click('play');await fill('seek',3.5);assert.notEqual(await image(),start);
        await fill('seek',9);await click('feature-1');const chosen=await image();
        await click('missed-4');assert.notEqual(await image(),chosen);await click('save');
        const arr=(await pieces()).filter(e=>e.activity==='seven-windows');const stored=arr.at(-1);
        assert.deepEqual(stored.data.windows,[3,2,7]);assert.equal(stored.data.feature,1);assert.equal(stored.data.titlePiece,title);assert.equal(await image(),chosen);
        const link=p.locator('a[href*="shotPiece"]');assert.ok((await link.getAttribute('href')).includes('titlePiece='+title));await fits();
        const exp=await download('export');assert.deepEqual(JSON.parse(exp.body).windows,[3,2,7]);
      });
      await suite.test('one plane folds, launches and later reaches window seven in the wide scene',async()=>{
        await open('seven-windows');await p.locator('.ns-stage canvas[data-art="photo"]').waitFor();
        const trace=await p.evaluate(async()=>{
          const {windows,paperFlight}=await import('./scenes/art.js');
          const canvas=document.createElement('canvas');canvas.width=720;canvas.height=330;
          const c=canvas.getContext('2d'),original=c.fill.bind(c);
          let count;
          c.fill=(...args)=>{if(c.fillStyle==='#f6e4bd')count.folded++;if(c.fillStyle==='#f6e5b5')count.airborne++;return original(...args);};
          return [1,4.9,5,7,9.4,12].map(time=>{count={folded:0,airborne:0};windows(c,-1,time);return {...count,point:paperFlight(time)};});
        });
        assert.deepEqual(trace.map(f=>[f.folded,f.airborne]),[[1,0],[1,0],[0,1],[0,1],[0,1],[0,0]]);
        assert.ok(trace[2].point.x>215&&trace[2].point.x<317&&trace[2].point.y>39&&trace[2].point.y<125);
        assert.ok(trace[4].point.x>455&&trace[4].point.x<557&&trace[4].point.y>160&&trace[4].point.y<246);
      });
      await suite.test('audience opening measures cues, backstage after screening',async()=>{
        await open('curtain-party');await fill('cue-0',4);await fill('cue-1',2);await fill('cue-2',1);
        assert.equal(await field('backstage').count(),0);await fill('seek',2);const closed=await image();
        await fill('seek',8);assert.notEqual(await image(),closed);await click('backstage');
        assert.match(await p.locator('.night-bench').innerText(),/2 s before|2 ث قبل/);
        assert.match(await p.locator('.ns-list li').first().innerText(),/^1 s/);
        assert.deepEqual(JSON.parse((await download('export')).body).times,[4,2,1]);await click('save');await fits();
      });
      await suite.test('six-second silent postcard uses three chosen machines and degrades on missing audio',async()=>{
        await open('sound-museum');deniedFile='museum-bell.wav';await click('sound');await click('machine-2');
        await p.waitForFunction(()=>document.querySelector('[data-scene=sound]').getAttribute('aria-pressed')==='false');
        deniedFile='';await click('collect');await click('machine-0');await click('collect');await click('machine-1');await click('collect');
        await click('postcard');let readings=[];for(const sec of [.4,2.2,4.3]){await fill('seek',sec);readings.push(await cap());}
        assert.equal(new Set(readings).size,3);await click('save');const file=JSON.parse((await download('export')).body);assert.deepEqual(file.order,[2,0,1]);assert.equal(file.seconds,6);
        await fits();await open('sound-museum','&storage-denied=1');
        for(const i of [1,2,0]){await click('machine-'+i);await click('collect');}await click('postcard');await click('save');
        assert.match(await p.locator('.night-notice').innerText(),/Saving could not|لم يتأكد الحفظ/);assert.ok((await download('export')).body.length>50);
      });
      await suite.test('UTC-pinned two-activity challenge honors shared daily rules and produces actual PNG',async()=>{
        await p.clock.setSystemTime(new Date('2026-11-18T23:59:00Z'));await open('weekend');
        const setup=await p.evaluate(async()=>{
          const {assignment}=await import('./scenes/weekend.js'),{solutions}=await import('../after-show/edit-rules.js'),a=assignment('2026-11-18');
          return {shots:solutions(a.round)[0],order:a.order};
        });
        for(const id of setup.shots)await click('shot-'+id);
        deniedFile='/'+setup.shots[0]+'.webp';await click('screen');await field('retry-image').waitFor();
        deniedFile='';await click('retry-image');await p.waitForFunction(()=>document.querySelector('.ns-still')?.naturalWidth>0);
        if(width===1024){await click('play');await field('next').waitFor({timeout:20000});}
        else await field('seek').fill(await field('seek').getAttribute('max'));
        await click('next');
        await p.clock.setSystemTime(new Date('2026-11-19T00:05:00Z'));await p.reload();
        assert.match(await p.locator('.night-bench').innerText(),/2026-11-18 UTC/);
        for(const id of setup.order)await click('post-'+id);await click('screen');if(width===1024){await click('play');await field('finish').waitFor({timeout:9500});}else await fill('seek',6);await click('finish');
        const png=await download('export');assert.ok(png.name.endsWith('.png'));assert.equal(png.body.toString('hex',0,8),'89504e470d0a1a0a');
        await click('save');await click('practice');assert.match(await p.locator('.night-bench').innerText(),/Open practice|تدريب مفتوح/);await fits();
      });
      await suite.test('same-device presentation hides settings and notes until maker reveal; program excludes private notes',async()=>{
        await open('screening-room');for(const i of ['lobby','plane','stage'])await click('pick-sample-'+i);await click('start');
        for(let i=0;i<3;i++){assert.equal(await p.locator('pre').count(),0);await field('runtime').selectOption({value:'12'});
          await click('pass');assert.equal(await p.locator('canvas').count(),0);await click('handoff');assert.equal(await p.locator('pre').count(),0);
          await field('note').fill('Local viewer reading '+i);await click('return');assert.equal(await p.getByText('Local viewer reading '+i,{exact:true}).count(),0);
          await click('handoff');assert.equal(await p.locator('pre').count(),0);await click('reveal');assert.equal(await p.locator('pre').count(),1);
          assert.equal(await p.getByText('Local viewer reading '+i,{exact:true}).count(),1);await click('next');}
        const prog=(await download('export')).body.toString();assert.match(prog,/36 s/);assert.ok(!prog.includes('Local viewer reading'));await fits();
      });
      if(width===320)await suite.test('original director duration survives notebook presentation, private reveal and TXT export',async()=>{
        await open('director-sentence');
        const ctl=k=>p.locator('[data-creative="'+k+'"]'),title='انتظار عند رصيف السينما';
        await ctl('prompt').fill(title);await ctl('generate').click();
        await ctl('substitute').waitFor();assert.equal(await ctl('duration').count(),0);
        await ctl('substitute').selectOption('pier');await ctl('accept-set').click();
        await ctl('duration').selectOption({value:'15'});await ctl('save').click();
        const director=(await pieces()).find(item=>item.activity==='director-sentence'&&item.title===title);
        assert.equal(director.data.duration,15);
        await open('screening-room');for(const id of [director.id,'sample-plane','sample-stage'])await click('pick-'+id);
        assert.match(await p.locator('.ns-list').innerText(),/15 s/);await click('start');
        assert.equal(await field('runtime').inputValue(),'15');assert.equal(await field('runtime').isDisabled(),true);
        const first=await image();await fill('seek',8);assert.notEqual(await image(),first);assert.equal(await p.locator('pre').count(),0);
        for(let i=0;i<3;i++){await click('pass');await click('handoff');await field('reading').selectOption({value:'0'});await click('return');await click('handoff');await click('reveal');await click('next');}
        const program=(await download('export')).body.toString();assert.ok(program.includes(title+' · 15 s'));assert.match(program,/26 s/);
      });
      if(width===390)await suite.test('completed original daily enters the pinned weekend; failed cut cannot advance; practice accepts an independent order',async()=>{
        const date='2026-11-21';
        await p.clock.install({time:new Date(date+'T18:00:00Z')});
        await p.goto(base+'raven/after-show/content.html?activity=daily&lang=en');
        const plan=await p.evaluate(async date=>{
          const {solutions,dailyRound,duration,score}=await import('./edit-rules.js');
          const r=dailyRound(date),valid=solutions(r)[0],all=[];
          function build(ids){if(ids.length===r.slots){all.push(ids);return;}for(const k of r.library)if(!ids.includes(k))build([...ids,k]);}
          build([]);return {valid,bad:all.find(i=>!score(r,i).pass),duration:duration(valid)};
        },date);
        assert.ok(plan.bad);
        for(const [index,id] of plan.valid.entries()){await p.locator('[data-shot="'+id+'"]').click();await p.locator('[data-slot="'+index+'"]').click();}
        await p.locator('[data-edit-action=play]').click();await p.clock.fastForward((plan.duration+1)*1000);
        const href=p.locator('[data-edit-result] a[href*="weekend.html"]');assert.ok((await href.getAttribute('href')).includes('date='+date));
        await href.click();await field('retry').waitFor();
        // This tab still has the previous pinned practice. Explicitly choose the new UTC assignment.
        await click('new-date');assert.match(await p.locator('.night-bench').innerText(),/2026-11-21 UTC/);
        for(const id of plan.bad)await click('shot-'+id);await click('screen');await field('seek').fill(await field('seek').getAttribute('max'));
        assert.equal(await field('next').count(),0);
        await click('retry');for(const id of plan.valid)await click('shot-'+id);await click('screen');await field('seek').fill(await field('seek').getAttribute('max'));await click('next');
        const order=await p.evaluate(async date=>(await import('./scenes/weekend.js')).assignment(date).order,date);
        for(const id of [...order].reverse())await click('post-'+id);
        await click('screen');await fill('seek',6);assert.equal(await field('finish').count(),0);
        for(let i=0;i<3;i++)await click('undo');
        for(const id of order)await click('post-'+id);await click('screen');await fill('seek',6);await click('finish');await click('practice');
        for(const id of plan.bad)await click('shot-'+id);await click('screen');await field('seek').fill(await field('seek').getAttribute('max'));await click('next');
        for(const id of [...order].reverse())await click('post-'+id);await click('screen');await fill('seek',6);await click('finish');
        assert.ok((await download('export')).body.length>1000);
      });
      assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
    }finally{await ctx.close();}
  });
});
