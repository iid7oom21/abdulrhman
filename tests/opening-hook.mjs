// Browser regression checks for the written opening, against the actual site files.
// node --test tests/opening-hook.mjs
// Optional: CHROMIUM_PATH, RAVEN_REDESIGN_URL, SCREENSHOT_DIR, RAVEN_OPENING_REPORT.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_TEST_MODULE||'playwright');
const repo=fileURLToPath(new URL('../',import.meta.url));

test('written opening: choices, display boundaries, language and access',async t=>{
  let server;
  let base=process.env.RAVEN_REDESIGN_URL;
  if(!base){
    server=http.createServer((req,res)=>{
      if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;return res.end();}
      let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname.endsWith('/'))pathname+='index.html';
      const filename=path.resolve(repo,'.'+pathname);
      if(!filename.startsWith(repo)){res.statusCode=403;return res.end();}
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
      try{res.setHeader('Content-Type',mime[path.extname(filename)]||'application/octet-stream');res.end(fs.readFileSync(filename));}
      catch{res.statusCode=404;res.end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    base='http://127.0.0.1:'+server.address().port+'/';
  }
  base=base.replace(/\/?$/,'/');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(async()=>{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));});
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.addInitScript(()=>{
    const originalSet=Storage.prototype.setItem;
    const seeds={other_app_preferences:'keep',raven_music_volume_v1:'0.37',raven_music_track_v1:'4',raven_music_muted_v1:'on',raven_dialogue_static_backend_v2:'UNTOUCHED_FIXTURE'};
    for(const [key,value] of Object.entries(seeds))originalSet.call(localStorage,key,value);
    window.__openingStorageCalls=[];
    for(const name of ['setItem','removeItem','clear']){
      const original=Storage.prototype[name];
      Storage.prototype[name]=function(...args){if(this===localStorage)window.__openingStorageCalls.push({method:name,args});return original.apply(this,args);};
    }
  });
  const page=await context.newPage();
  const pageErrors=[],writeRequests=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.route('**/*',route=>{
    const request=route.request();
    if(!['GET','HEAD'].includes(request.method())){writeRequests.push({method:request.method(),url:request.url()});return route.abort();}
    // Fonts do not affect the interaction checks; no external provider is called.
    if(!request.url().startsWith(base))return route.abort();
    return route.continue();
  });
  const results=[];
  const run=async(name,fn)=>t.test(name,async()=>{
    try{const evidence=await fn();results.push({name,status:'PASS',evidence});}
    catch(error){results.push({name,status:'FAIL',error:error.message});throw error;}
  });
  const phase=()=>page.locator('#hook').getAttribute('data-phase');
  const state=()=>page.locator('#hook').evaluate(el=>({phase:el.dataset.phase,choice:el.dataset.choice||'',recipient:el.dataset.recipient||'',share:el.dataset.share||''}));
  const action=id=>page.locator('[data-hook-action="'+id+'"]');
  const focusForPhase={start:'hook-step-heading',invite:'hook-invite-start',compare:'hook-paper-start',respond:'hook-response-start',share:'hook-draft',review:'hook-share-review',after:'hook-step-heading',done:'hook-register'};
  const click=async(id,nextPhase)=>{
    await action(id).click();
    if(nextPhase)assert.equal(await phase(),nextPhase);
    const active=await page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id}));
    assert.notEqual(active.tag,'BODY','focus must survive removal of the action button');
    if(nextPhase)assert.equal(active.id,focusForPhase[nextPhase],'focus must start at the newly revealed content');
  };
  const fresh=async(lang='ar')=>{
    await page.goto(base+'raven/deleted-name/content.html?lang='+lang,{waitUntil:'domcontentloaded'});
    await action('open').waitFor();assert.equal(await phase(),'start');
  };
  const reachRespond=async(lang='ar')=>{await fresh(lang);await click('open','invite');await click('enter','compare');await click('continue','respond');};
  const preservedStorage=async()=>{
    const values=await page.evaluate(()=>({other:localStorage.getItem('other_app_preferences'),volume:localStorage.getItem('raven_music_volume_v1'),track:localStorage.getItem('raven_music_track_v1'),muted:localStorage.getItem('raven_music_muted_v1'),backend:localStorage.getItem('raven_dialogue_static_backend_v2'),writes:window.__openingStorageCalls}));
    assert.deepEqual({...values,writes:undefined},{other:'keep',volume:'0.37',track:'4',muted:'on',backend:'UNTOUCHED_FIXTURE',writes:undefined});
    assert.ok(values.writes.every(x=>x.method==='setItem'&&x.args[0]==='raven_language'),'the opening must not store progress, migrate data or clear storage');
    return values;
  };

  await run('the document is visible before the explanatory dialogue, with exact source text',async()=>{
    await fresh();await click('open','invite');await click('enter','compare');
    assert.equal(await page.locator('#hook-document [data-part="original"]').innerText(),await page.locator('[data-k="m2"]').innerText());
    assert.ok((await page.locator('#hook-document [data-part="conclusion"]').innerText()).includes('اختلاف النسخ'));
    assert.equal(await page.locator('#hook-document [data-part="signature"]').innerText(),'');
    assert.ok(!(await page.locator('#hook-log').innerText()).includes('صحح النتيجة. لا تنفي الرسالة.'));
    const before=await state();await action('compare-toggle').click();assert.equal(await action('compare-toggle').getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#hook-comparison').isVisible(),true);assert.deepEqual(await state(),before);
    await action('compare-toggle').click();assert.equal(await page.locator('#hook-comparison').isVisible(),false);
    await click('continue','respond');assert.equal(await page.locator('#hook-actions [data-hook-action]').count(),4);
    assert.match(await action('lie').innerText(),/كذب|أكذب/);
  });

  for(const route of [
    {choice:'precise',recipient:'jonas'}, {choice:'precise',recipient:'both'}, {choice:'precise',recipient:'draft'},
    {choice:'wait'}, {choice:'refuse'}, {choice:'lie'}
  ])await run('branch '+route.choice+(route.recipient?' / '+route.recipient:''),async()=>{
    await reachRespond();
    await click(route.choice,route.recipient?'share':'after');
    if(route.recipient){
      assert.equal(await page.locator('#hook-draft').isVisible(),true);
      assert.equal(await page.locator('#hook-actions [data-hook-action]').count(),3);
      assert.equal(await page.locator('#hook-draft').evaluate(el=>Boolean(el.closest('.you'))),false,'private draft is not rendered as a spoken player message');
      await click('recipient-'+route.recipient,'review');
      assert.equal(await page.locator('#hook-share-review').isVisible(),true);
      assert.equal((await state()).share,'','selecting a candidate does not confirm the action');
      assert.ok((await page.locator('#hook-share-review [data-part="scope"]').innerText()).length>0);
      await click('confirm','after');
      assert.equal((await state()).share,route.recipient);
    }
    const status=await page.locator('#hook-state-status').innerText();
    assert.ok(status.length>0);assert.ok(!status.includes('وصل ليوناس'),'do not claim a real dialogue share');
    if(route.choice==='lie')assert.notEqual(await page.locator('#hook-log > li').filter({hasText:'اخترت إنكار الرسالة داخل المشهد.'}).getAttribute('data-kind'),'spoken','a description of the selected action is not a spoken claim');
    await click('record','done');
    assert.match(await page.locator('#hook-log').innerText(),/سجل استقبال بلاغات المراجعة/);
    assert.notEqual(await page.locator('#hook-log > li').filter({hasText:'إيلينا ما تجاوب.'}).getAttribute('data-kind'),'spoken','silence is narration, not a spoken statement');
    assert.equal(await page.locator('#hook-ending').isVisible(),true);
    assert.equal(await action('replay').isVisible(),true);
    assert.equal(await page.locator('#hook-back-case').getAttribute('href'),'#title');
    assert.equal(await page.locator('#hook-preview').getAttribute('target'),'_blank');
    assert.match(await page.locator('#hook-preview').innerText(),/مستقل|مستقلة/);
    await page.locator('#hook-summary summary').click();
    const summary=await page.locator('#hook-summary').innerText();
    assert.ok(summary.length>30);await preservedStorage();
    return {route,status,summary};
  });

  await run('candidate recipients can be reviewed and changed without a second event',async()=>{
    await reachRespond();await click('precise','share');await click('recipient-jonas','review');
    const first=await page.locator('#hook-share-review [data-part="recipient"]').innerText();
    assert.match(first,/يوناس/);assert.ok(!first.includes('كلير'));
    await click('edit-recipient','share');await click('recipient-both','review');
    assert.match(await page.locator('#hook-share-review [data-part="recipient"]').innerText(),/كلير/);
    assert.equal((await state()).share,'');await click('confirm','after');
    assert.equal((await state()).share,'both');
    assert.equal(await page.locator('#hook-state-status').count(),1);
  });

  await run('language changes at every phase preserve choices, candidate and confirmed recipient',async()=>{
    await fresh();
    const check=async()=>{
      const before=await state();
      const rowsBefore=await page.locator('#hook-log > li').evaluateAll(nodes=>nodes.map(n=>n.dataset.kind||''));
      const readingTarget=focusForPhase[before.phase];
      await page.locator('#'+readingTarget).focus();
      await page.evaluate(()=>document.dispatchEvent(new CustomEvent('raven:language',{detail:{language:document.documentElement.lang}})));
      assert.equal(await page.evaluate(()=>document.activeElement.id),readingTarget,'language rendering must preserve focus on new content, not only buttons');
      const summaryOpen=await page.locator('#hook-summary').count()?await page.locator('#hook-summary').evaluate(el=>el.open):null;
      const focused=page.locator('#hook-actions [data-hook-action]').first();
      if(await focused.count())await focused.focus();
      const focusedAction=await page.evaluate(()=>document.activeElement.dataset.hookAction||'');
      // The user-facing language control changes both the copy and locale event.
      await page.locator('#lang-switch').click();
      assert.deepEqual(await state(),before);assert.equal(await page.evaluate(()=>document.activeElement.id),'lang-switch');
      assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
      assert.ok(!/[\u0600-\u06ff]/.test(await page.locator('#hook').innerText()),'all visible opening copy must be translated');
      const rowsAfter=await page.locator('#hook-log > li').evaluateAll(nodes=>nodes.map(n=>n.dataset.kind||''));
      assert.deepEqual(rowsAfter,rowsBefore,'translations must preserve the number and order of actual dialogue and material rows');
      await page.locator('#lang-switch').click();assert.deepEqual(await state(),before);
      if(summaryOpen!==null)assert.equal(await page.locator('#hook-summary').evaluate(el=>el.open),summaryOpen,'language must preserve the expanded review');
      // Also exercise a shell language event while focus remains in the scene.
      if(focusedAction){await action(focusedAction).focus();await page.evaluate(()=>document.dispatchEvent(new CustomEvent('raven:language',{detail:{language:document.documentElement.lang}})));assert.equal(await page.evaluate(()=>document.activeElement.dataset.hookAction),focusedAction);}
      return before;
    };
    const states=[await check()];
    for(const [id,next] of [['open','invite'],['enter','compare'],['continue','respond'],['precise','share'],['recipient-jonas','review'],['confirm','after'],['record','done']]){await click(id,next);if(next==='done')await page.locator('#hook-summary summary').click();states.push(await check());}
    return states;
  });

  await run('replay clears this isolated scene while reload returns to its disclosed start',async()=>{
    await reachRespond();await click('precise','share');await click('recipient-both','review');await click('confirm','after');await click('record','done');
    await click('replay','start');assert.deepEqual(await state(),{phase:'start',choice:'',recipient:'',share:''});
    assert.equal(await page.locator('#hook-log li').count(),0);await preservedStorage();
    await click('open','invite');await page.reload();await action('open').waitFor();assert.equal(await phase(),'start');
    const note=await page.locator('[data-k="hookNote"]').innerText();assert.match(note,/تحديث|إعادة تحميل/);assert.match(note,/مستقل/);
  });

  await run('keyboard steps keep focus and only a short status region announces changes',async()=>{
    await fresh();await action('open').focus();await page.keyboard.press('Enter');
    assert.equal(await phase(),'invite');assert.equal(await page.evaluate(()=>document.activeElement.id),'hook-invite-start');
    assert.equal(await page.locator('#hook-log').getAttribute('aria-live'),null);
    assert.equal(await page.locator('#hook-announcement').getAttribute('role'),'status');
    assert.ok((await page.locator('#hook-announcement').innerText()).length<260);
    assert.equal(await page.locator('#hook-log').evaluate(el=>el.tagName),'OL');
    const style=await page.locator('#hook-invite-start').evaluate(el=>({outline:getComputedStyle(el).outlineStyle,tabindex:el.tabIndex}));
    assert.notEqual(style.outline,'none');assert.equal(style.tabindex,-1);
    return style;
  });

  await run('new dialogue stays at the reading start in portrait and landscape',async()=>{
    const evidence=[];
    for(const [width,height] of [[390,844],[844,390]]){
      await page.setViewportSize({width,height});await fresh();
      for(const [id,next] of [['open','invite'],['enter','compare'],['continue','respond'],['precise','share'],['recipient-both','review'],['confirm','after'],['record','done']]){
        await click(id,next);
        const position=await page.locator('#'+focusForPhase[next]).evaluate(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,height:innerHeight,id:el.id}));
        assert.ok(position.top>=-1&&position.top<position.height,`new content start was skipped: ${JSON.stringify(position)}`);
        evidence.push({width,phase:next,...position});
      }
    }
    return evidence;
  });

  await run('mobile widths, both languages, long text and 200% text enlargement remain usable',async()=>{
    const evidence=[];
    for(const lang of ['ar','en']){
      await reachRespond(lang);await click('precise','share');await click('recipient-both','review');
      for(const [width,height,scale] of [[320,844,1],[375,844,1],[390,844,1],[844,390,1],[390,844,2]]){
        await page.setViewportSize({width,height});
        if(scale===2)await page.locator('#hook, #hook *').evaluateAll(nodes=>{
          const sizes=nodes.map(el=>parseFloat(getComputedStyle(el).fontSize));
          nodes.forEach((el,index)=>{el.style.fontSize=(sizes[index]*2)+'px';});
        });
        const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('#hook button,#hook a')].filter(el=>el.getClientRects().length).filter(el=>{const b=el.getBoundingClientRect();return b.left<0||b.right>innerWidth+1||el.scrollWidth>el.clientWidth+1;}).map(el=>el.dataset.hookAction||el.id)}));
        assert.ok(layout.scroll<=layout.width+1,`${lang} ${width} @${scale} has horizontal overflow`);assert.deepEqual(layout.controls,[]);
        evidence.push({lang,width,height,scale,...layout});
      }
      if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.locator('#hook-share-review').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`opening-review-${lang}-390.png`),fullPage:false});}
    }
    return evidence;
  });

  await run('comparison displays its source as text and makes no external write',async()=>{
    await fresh();
    const payload='<img src=x onerror="window.openingInjected=true">'+' UNBROKEN_'.repeat(200);
    // This exercises the actual comparison renderer reading its existing source node.
    await page.locator('[data-k="m2"]').evaluate((el,text)=>{el.textContent=text;},payload);
    await click('open','invite');await click('enter','compare');
    assert.equal(await page.locator('#hook-document [data-part="original"]').innerText(),payload);
    assert.equal(await page.locator('#hook-document img').count(),0);assert.equal(await page.evaluate(()=>window.openingInjected),undefined);
    await page.setViewportSize({width:320,height:844});
    assert.ok(await page.locator('#hook-document').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'long source text must wrap within the actual comparison card');
    assert.deepEqual(writeRequests,[]);assert.deepEqual(pageErrors,[]);await preservedStorage();
  });

  const report={node:process.version,browser:await browser.version(),source:base,scope:'Actual static case page in desktop Chromium, controlled viewport/text sizes; no physical mobile device, screen-reader speech, provider or backend integration',results};
  if(process.env.RAVEN_OPENING_REPORT)fs.writeFileSync(process.env.RAVEN_OPENING_REPORT,JSON.stringify(report,null,2));
  console.log(JSON.stringify({browser:report.browser,node:report.node,scenarios:results.length,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length}));
});
