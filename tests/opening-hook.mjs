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
  const focusForState=()=> 'hook-step-heading';
  // Copy below follows the owner's explicit 2026-11-05 revision.
  const lockedCopy={
    ar:{precise:'توضيح دقيق: أرسلت ملاحظة عن نقص الصورة. ما فحصت الأصل، وما اعتمدت النتيجة.',wait:'أحتفظ بالرد لين أشوف المراسلة والنسخة.',refuse:'ما أسجل توضيح قبل ما أعرف مين يستلمه.',draft:'تبقى مسودة. ما توصل أحد.',who:'قبل ترسله، مين بيستلمه؟',badge:'كذب صريح',order:['أنا ما راجعت الأصل.','لكنك كتبت إن الصورة ما تكفي.','وهذا مو نفس الشي.','الجملة اللي فوق منك؟','مني. النتيجة اللي تحت مو مني.','صحح النتيجة. لا تنفي الرسالة.']},
    en:{precise:'Precise: I sent a note that the picture was not enough. I did not examine the original, and I did not approve the conclusion.',wait:'I hold the reply until I see the correspondence and the copy.',refuse:'I will not record a clarification before I know who receives it.',draft:'Keep it as a draft. It reaches no one.',who:'Before you send it, who will receive it?',badge:'Explicit lie',order:['I did not review the original.','But you wrote that the picture is not enough.','That is not the same thing.','Is the sentence above yours?','It is mine. The conclusion under it is not.','Correct the conclusion. Do not deny the message.']}
  };
  const click=async(id,nextPhase)=>{
    await action(id).click();
    if(nextPhase)assert.equal(await phase(),nextPhase);
    const active=await page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id}));
    assert.notEqual(active.tag,'BODY','focus must survive removal of the action button');
    if(nextPhase)assert.equal(active.id,focusForState(await state()),'focus must start at the newly revealed content');
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
    for(const lang of ['ar','en']){
    await fresh(lang);await click('open','invite');await click('enter','compare');
    assert.equal(await page.locator('#hook-document [data-part="original"]').innerText(),await page.locator('[data-k="m2"]').innerText());
    assert.ok((await page.locator('#hook-document [data-part="conclusion"]').innerText()).length>0);
    assert.match(await page.locator('#hook-document [data-part="signature"]').innerText(),/غير موقّع|unsigned/);
    assert.ok(!(await page.locator('#hook-log').innerText()).includes('صحح النتيجة. لا تنفي الرسالة.'));
    assert.deepEqual(await page.locator('#hook').evaluate(el=>JSON.parse(el.dataset.layers).spokenAloud),[]);
    for(const part of ['original','conclusion','signature']){await action('source-'+part).click();assert.ok((await page.locator('#hook-source-note').innerText()).length>20);}
    const before=await state();await action('compare-toggle').click();assert.equal(await action('compare-toggle').getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#hook-comparison').isVisible(),true);assert.deepEqual(await state(),before);
    await action('compare-toggle').click();assert.equal(await page.locator('#hook-comparison').isVisible(),false);
    await click('continue','respond');assert.equal(await page.locator('#hook-actions [data-hook-action]').count(),4);
    assert.equal(await action('lie').locator('.tag').innerText(),lockedCopy[lang].badge);
    assert.equal(await action('lie').locator('.tag').isVisible(),true);
    const spoken=await page.locator('#hook-log > li[data-kind="spoken"] > p').allTextContents();
    assert.deepEqual(spoken.slice(-6),lockedCopy[lang].order,'the locked dialogue order must stay intact');
    await click('precise','share');
    assert.equal(await page.locator('#hook-choice-start > p').innerText(),lang==='ar'?'تكتب توضيحك في المسودة.':'You write your clarification in the draft.');
    assert.equal(await page.locator('#hook-choice-start').getAttribute('data-kind'),'narrative');
    assert.equal(await page.locator('#hook-draft').getAttribute('data-kind'),'written-draft');
    assert.equal(await action('recipient-draft').innerText(),lockedCopy[lang].draft);
    assert.equal((await page.locator('#hook-log > li[data-kind="spoken"] > p').allTextContents()).at(-1),lockedCopy[lang].who);
    for(const choice of ['wait','refuse']){
      await reachRespond(lang);await click(choice,'review');await click('confirm','after');
      assert.equal(await page.locator('#hook-choice-start > p').innerText(),lockedCopy[lang][choice]);
      assert.equal(await page.locator('#hook-choice-start').getAttribute('data-kind'),'spoken');
    }
    }
  });

  for(const choice of ['precise','wait','refuse','lie']) for(const recipient of ['jonas','both','draft'])
  await run('branch matrix '+choice+' / '+recipient,async()=>{
    const written=['precise','lie'].includes(choice);
    for(const lang of ['ar','en']) {
      await reachRespond(lang);await click(choice,written?'share':'review');
      if(written){
        assert.equal(await page.locator('#hook-draft').isVisible(),true);
        assert.equal(await page.locator('#hook-draft').evaluate(el=>Boolean(el.closest('.you'))),false);
        await click('recipient-'+recipient,'review');
      } else {
        assert.equal(await action('recipient-'+recipient).count(),0,'defer/refuse must not invent a written material or a recipient');
        assert.equal(await page.locator('#hook-draft').count(),0);
      }
      const layers=()=>page.locator('#hook').evaluate(el=>JSON.parse(el.dataset.layers));
      const before=await layers();assert.equal(before.sceneShared,null);
      assert.deepEqual(before.recipientKnowledge,{jonas:[],claire:[],elena:[]});
      assert.equal(await page.locator('#hook-share-review').isVisible(),true);
      assert.ok((await page.locator('#hook-share-review [data-part="private"]').innerText()).length>10);
      await click('confirm','after');
      const after=await layers();const expected=written?({jonas:['jonas'],both:['jonas','claire'],draft:[]})[recipient]:[];
      assert.deepEqual(after.sceneShared?.recipients||[],expected);
      for(const id of ['jonas','claire','elena']) assert.deepEqual(after.recipientKnowledge[id],expected.includes(id)?['opening-draft']:[]);
      assert.equal(after.spokenAloud[0].lineId,'L10');assert.equal(after.spokenAloud[1].lineId,'L14');
      assert.deepEqual(after.spokenAloud[0].listeners,['jonas','claire','elena']);
      const status=await page.locator('#hook-state-status').innerText();
      if(!written)assert.equal(status,lang==='ar'?'لم تُسجّل توضيحًا.':'You did not record a clarification.');
      if(written&&recipient==='draft')assert.equal(status,lang==='ar'?'احتفظت بمسودة.':'You kept a draft.');
      await click('record','done');
      assert.match(await page.locator('#hook-register').innerText(),/سجل استقبال بلاغات المراجعة|Review Reports Intake Log/);
      assert.equal(await page.locator('#hook-log [data-line-id="L20"] > p').innerText(),lang==='ar'?'طيب ليش المسودة تقول إن اختلاف النسخ ما يغير نتيجة الملف؟':'Then why does the draft say that differences between copies do not change the file’s result?');
      assert.equal(await page.locator('#hook-log > li:last-child > p').innerText(),lang==='ar'?'إيلينا ما تجاوب.':'Elena does not answer.');
      assert.equal(await page.locator('#hook-ending').isVisible(),true);assert.equal(await action('replay').isVisible(),true);
      if(written){const ids=await page.locator('[data-line-id]').evaluateAll(es=>[...new Set(es.map(e=>e.dataset.lineId))].sort());assert.deepEqual(ids,Array.from({length:21},(_,i)=>'L'+String(i+1).padStart(2,'0')));}
      await page.locator('#hook-summary summary').click();assert.equal(await page.locator('[data-layer]').count(),4);
      const stable=await layers();await page.click('#lang-switch');assert.deepEqual(await layers(),stable);
      await page.click('#lang-switch');assert.deepEqual(await layers(),stable);await preservedStorage();
    }
    return {choice,recipient,written};
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
      const readingTarget=focusForState(before);
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
    assert.equal(await phase(),'invite');assert.equal(await page.evaluate(()=>document.activeElement.id),'hook-step-heading');
    assert.equal(await page.locator('#hook-log').getAttribute('aria-live'),null);
    assert.equal(await page.locator('#hook-announcement').getAttribute('role'),'status');
    assert.ok((await page.locator('#hook-announcement').innerText()).length<260);
    assert.equal(await page.locator('#hook-log').evaluate(el=>el.tagName),'OL');
    const style=await page.locator('#hook-step-heading').evaluate(el=>({outline:getComputedStyle(el).outlineStyle,tabindex:el.tabIndex}));
    assert.notEqual(style.outline,'none');assert.equal(style.tabindex,-1);
    return style;
  });

  await run('new dialogue stays at the reading start in portrait and landscape',async()=>{
    const evidence=[];
    for(const [width,height] of [[390,844],[844,390]]){
      await page.setViewportSize({width,height});await fresh();
      for(const [id,next] of [['open','invite'],['enter','compare'],['continue','respond'],['precise','share'],['recipient-both','review'],['confirm','after'],['record','done']]){
        await click(id,next);
        const position=await page.locator('#'+focusForState(await state())).evaluate(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,height:innerHeight,id:el.id}));
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
    assert.equal(await page.locator('#hook-document img').count(),1);assert.equal(await page.locator('#hook-document img').getAttribute('src'),'./assets/scenes/case-scenes-v1.webp');assert.equal(await page.evaluate(()=>window.openingInjected),undefined);
    await page.setViewportSize({width:320,height:844});
    assert.ok(await page.locator('#hook-document').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'long source text must wrap within the actual comparison card');
    assert.deepEqual(writeRequests,[]);assert.deepEqual(pageErrors,[]);await preservedStorage();
  });


  await run('private notebook anchors observations to visible text without sharing or creating evidence',async()=>{
    await fresh();await click('open','invite');await click('enter','compare');await action('source-conclusion').click();
    assert.equal(await page.locator('#reading-source').inputValue(),'document-conclusion');
    const before=await page.locator('#hook').getAttribute('data-layers');
    const text='<img src=x onerror="window.notebookInjected=1"> هذه فرضيتي الخاصة';
    await page.selectOption('#reading-kind','hypothesis');await page.fill('#reading-note',text);await page.click('#reading-add');
    assert.equal(await page.locator('#reading-notes li').count(),1);assert.equal(await page.locator('#reading-notes img').count(),0);
    assert.equal(await page.evaluate(()=>window.notebookInjected),undefined);assert.equal(await page.locator('#hook').getAttribute('data-layers'),before);
    const note=await page.locator('#reading-tools').evaluate(el=>JSON.parse(el.dataset.notes).entries[0]);
    assert.equal(note.sourceId,'document-conclusion');assert.equal(note.kind,'hypothesis');assert.equal(note.text,text);
    await click('continue','respond');await click('precise','share');await click('recipient-jonas','review');await click('confirm','after');await click('record','done');
    assert.deepEqual(await page.locator('#hook').evaluate(el=>JSON.parse(el.dataset.layers).recipientKnowledge),{jonas:['opening-draft'],claire:[],elena:[]});
    assert.equal(await page.locator('#reading-notes li').count(),1);
    const visibleIds=await page.locator('#hook-log li[data-kind="spoken"][data-line-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.lineId));
    assert.deepEqual(await page.locator('#reading-quotes li').evaluateAll(nodes=>nodes.map(n=>n.dataset.sourceId)),visibleIds);
    assert.deepEqual(writeRequests,[]);await preservedStorage();
  });

  await run('notebook preserves a private draft and source IDs across language, exports a version and resets only on replay',async()=>{
    await fresh();await click('open','invite');await click('enter','compare');await action('source-original').click();
    await page.fill('#reading-note','سؤالي الخاص');await page.locator('#reading-note').focus();
    await page.evaluate(()=>{document.documentElement.lang='en';document.dispatchEvent(new CustomEvent('raven:language'));});
    assert.equal(await page.inputValue('#reading-note'),'سؤالي الخاص');assert.equal(await page.inputValue('#reading-source'),'document-original');assert.equal(await page.evaluate(()=>document.activeElement.id),'reading-note');
    await page.click('#reading-add');const promise=page.waitForEvent('download');await page.click('#reading-download');const download=await promise;
    const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.contentVersion,'paper-opening-2026-11-05-r2');assert.equal(exported.scope,'private-scene-notes');assert.equal(exported.entries[0].sourceId,'document-original');assert.equal(exported.entries[0].text,'سؤالي الخاص');
    await click('continue','respond');await click('refuse','review');await click('confirm','after');await click('record','done');
    await click('replay','start');assert.deepEqual(await page.locator('#reading-tools').evaluate(el=>JSON.parse(el.dataset.notes).entries),[]);await preservedStorage();
  });

  await run('notebook keyboard labels and long private text fit a 390px screen in both languages',async()=>{
    for(const language of ['ar','en']){
      await fresh(language);await page.setViewportSize({width:390,height:844});await click('open','invite');await click('enter','compare');await action('source-signature').click();
      await page.fill('#reading-note','LONG_UNBROKEN_'.repeat(60));await page.locator('#reading-add').focus();await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'reading-note');
      assert.ok(await page.locator('#reading-tools').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
      for(const id of ['reading-note','reading-source','reading-kind'])assert.equal(await page.locator('label[for="'+id+'"]').count(),1);
      assert.equal(await page.locator('#reading-status').getAttribute('aria-live'),'polite');
      if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.locator('#reading-tools').screenshot({path:path.join(process.env.SCREENSHOT_DIR,'private-notebook-'+language+'.png')});}
    }
    assert.deepEqual(pageErrors,[]);
  });

  await run('notebook disclosure focus and expanded statements survive language changes and note edits',async()=>{
    for(const language of ['ar','en']){
      await reachRespond(language);await page.locator('#reading-details > summary').click();
      await page.locator('#reading-quotes > summary').click();
      await page.evaluate(()=>{
        // Make disclosure and language changes in the same task, before toggle fires.
        for(const isOpen of [false,true]){
          document.getElementById('reading-details').open=isOpen;
          document.getElementById('reading-quotes').open=isOpen;
          document.dispatchEvent(new CustomEvent('raven:language'));
          if(document.getElementById('reading-details').open!==isOpen || document.getElementById('reading-quotes').open!==isOpen)throw new Error('disclosure state lost before toggle event');
        }
      });
      for(const selector of ['#reading-details > summary','#reading-quotes > summary']){
        await page.locator(selector).focus();
        await page.evaluate(()=>{document.documentElement.lang=document.documentElement.lang==='ar'?'en':'ar';document.dispatchEvent(new CustomEvent('raven:language'));});
        assert.equal(await page.locator(selector).evaluate(el=>el===document.activeElement),true,'the focused disclosure must survive the shell language event');
        assert.equal(await page.locator('#reading-details').evaluate(el=>el.open),true);
        assert.equal(await page.locator('#reading-quotes').evaluate(el=>el.open),true);
      }
      await page.selectOption('#reading-source','document-conclusion');await page.fill('#reading-note','FIXTURE سؤال عن الاستنتاج');await page.click('#reading-add');
      assert.equal(await page.locator('#reading-quotes').evaluate(el=>el.open),true,'adding a note must not close the statements being reviewed');
      await page.click('#remove-note-1');assert.equal(await page.locator('#reading-quotes').evaluate(el=>el.open),true);
      await click('refuse','review');await click('confirm','after');await click('record','done');
      assert.equal(await page.locator('#reading-quotes').evaluate(el=>el.open),true);
      await click('replay','start');await click('open','invite');await click('enter','compare');
      assert.equal(await page.locator('#reading-details').evaluate(el=>el.open),false);
      assert.equal(await page.locator('#reading-quotes').evaluate(el=>el.open),false);
    }
    await preservedStorage();
  });

  await run('reviewing a note returns to its exact passage without replacing a private draft or sharing it',async()=>{
    for(const language of ['ar','en']){
      await reachRespond(language);await page.locator('#reading-details > summary').click();
      await page.selectOption('#reading-source','document-original');await page.fill('#reading-note','FIXTURE مراجعة رسالة التكليف');await page.click('#reading-add');
      await page.selectOption('#reading-source','L10');await page.selectOption('#reading-kind','hypothesis');
      const draft='PRIVATE_DRAFT <img src=x onerror="window.reviewInjected=1">';await page.fill('#reading-note',draft);
      const layers=await page.locator('#hook').getAttribute('data-layers');
      assert.equal(await page.locator('#passage-note-1').count(),0);
      await page.locator('#review-note-1').focus();await page.keyboard.press('Enter');
      assert.equal(await page.inputValue('#reading-source'),'L10','reviewing another source must not reassign the note being drafted');assert.equal(await page.inputValue('#reading-note'),draft);
      assert.equal(await page.inputValue('#reading-kind'),'hypothesis');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'passage-note-1');
      assert.equal(await page.locator('#passage-note-1').innerText(),await page.locator('#hook-document [data-part="original"] .hook-part').innerText());
      assert.equal(await page.locator('#hook').getAttribute('data-layers'),layers);
      const position=await page.locator('#passage-note-1').evaluate(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,height:innerHeight}));
      assert.ok(position.bottom>0&&position.top<position.height,'the reviewed passage must be visible');
      await page.locator('#lang-switch').click();
      assert.equal(await page.locator('#passage-note-1').innerText(),await page.locator('#hook-document [data-part="original"] .hook-part').innerText());
      assert.equal(await page.inputValue('#reading-note'),draft);assert.equal(await page.inputValue('#reading-source'),'L10');
      assert.equal(await page.locator('#reading-notes li').count(),1);assert.equal(await page.locator('#reading-tools img').count(),1);assert.equal(await page.locator('#reading-tools img').getAttribute('src'),'./assets/scenes/investigation-scenes-v1.webp');
      assert.equal(await page.evaluate(()=>window.reviewInjected),undefined);
    }
    assert.deepEqual(writeRequests,[]);assert.deepEqual(pageErrors,[]);await preservedStorage();
  });

  await run('inspecting another document part preserves a typed private note and its source',async()=>{
    for(const language of ['ar','en']){
      await fresh(language);await click('open','invite');await click('enter','compare');
      await action('source-original').focus();await page.keyboard.press('Enter');
      assert.equal(await page.inputValue('#reading-source'),'document-original');
      await page.selectOption('#reading-kind','hypothesis');
      const draft='PRIVATE_ORIGINAL_NOTE <img src=x onerror="window.inspectInjected=1">';
      await page.fill('#reading-note',draft);
      const layers=await page.locator('#hook').getAttribute('data-layers'),before=await state();
      await action('source-conclusion').focus();await page.keyboard.press('Enter');
      assert.equal(await action('source-conclusion').evaluate(el=>el===document.activeElement),true,'inspection keeps keyboard focus on the document');
      assert.equal(await page.inputValue('#reading-source'),'document-original');
      assert.equal(await page.inputValue('#reading-kind'),'hypothesis');
      assert.equal(await page.inputValue('#reading-note'),draft);
      const inspected=await page.locator('#hook-document [data-part="conclusion"] .hook-part').innerText();
      assert.ok((await page.locator('#reading-status').innerText()).includes(inspected),'the inspected quote is shown separately from the draft source');
      assert.equal(await page.locator('#reading-source-preview').innerText(),await page.locator('#hook-document [data-part="original"] .hook-part').innerText());
      await page.locator('#reading-note').focus();
      await page.evaluate(()=>{document.documentElement.lang=document.documentElement.lang==='ar'?'en':'ar';document.dispatchEvent(new CustomEvent('raven:language'));});
      assert.equal(await page.evaluate(()=>document.activeElement.id),'reading-note');
      assert.equal(await page.inputValue('#reading-note'),draft);assert.equal(await page.inputValue('#reading-source'),'document-original');
      assert.equal(await page.inputValue('#reading-kind'),'hypothesis');
      // An explicit source selection still changes which passage the note belongs to.
      await page.selectOption('#reading-source','document-signature');
      await action('source-original').click();
      assert.equal(await page.inputValue('#reading-source'),'document-signature');
      await page.click('#reading-add');
      const entry=await page.locator('#reading-tools').evaluate(el=>JSON.parse(el.dataset.notes).entries[0]);
      assert.equal(entry.sourceId,'document-signature');assert.equal(entry.kind,'hypothesis');assert.equal(entry.text,draft);
      assert.equal(await page.locator('#hook').getAttribute('data-layers'),layers);assert.deepEqual(await state(),before);
      // With no draft, selecting a document part continues to start a note for that part.
      await action('source-conclusion').click();assert.equal(await page.inputValue('#reading-source'),'document-conclusion');
      assert.equal(await page.locator('#reading-tools img').count(),1);assert.equal(await page.locator('#reading-tools img').getAttribute('src'),'./assets/scenes/investigation-scenes-v1.webp');assert.equal(await page.evaluate(()=>window.inspectInjected),undefined);
    }
    assert.deepEqual(writeRequests,[]);assert.deepEqual(pageErrors,[]);await preservedStorage();
  });

  const report={node:process.version,browser:await browser.version(),source:base,scope:'Actual static case page in desktop Chromium, controlled viewport/text sizes; no physical mobile device, screen-reader speech, provider or backend integration',results};
  if(process.env.RAVEN_OPENING_REPORT)fs.writeFileSync(process.env.RAVEN_OPENING_REPORT,JSON.stringify(report,null,2));
  console.log(JSON.stringify({browser:report.browser,node:report.node,scenarios:results.length,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length}));
});
