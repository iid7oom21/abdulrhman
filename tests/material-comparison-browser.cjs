// Comparison is local reading UI: it must not become an evidence grant or filing action.
// All materials and API replies below are synthetic, never the private author pack.
// NODE_PATH=<existing Playwright installation> node --test tests/material-comparison-browser.cjs
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const ARTIFACTS = process.env.RAVEN_COMPARISON_ARTIFACTS;
const VERSION = 'synthetic-comparison-v1';
const localized = (ar, en) => ({ar,en});
const clone = value => JSON.parse(JSON.stringify(value));

function fixtureState() {
  const materials = [
    {id:'alpha', type:'document', title:localized('ورقة اختبار أولى','First fixture sheet'), body:localized('ملاحظة غير حاسمة. <img src=x onerror="window.comparisonInjected=true">','An inconclusive note. <img src=x onerror="window.comparisonInjected=true">'), source:localized('أصل اختبار واحد','One fixture original')},
    {id:'beta', type:'document', title:localized('مقتطف اختبار','Fixture excerpt'), body:localized('مقتطف من المصدر نفسه؛ ليس شاهدًا مستقلًا.','An excerpt of the same source; not an independent witness.'), source:localized('أصل اختبار واحد','One fixture original')},
    {id:'gamma', type:'recording', title:localized('نطاق اختبار 00:20–00:40','Fixture range 00:20–00:40'), body:localized('وصف نصي اصطناعي فقط، لا تصوير لفعل.','Synthetic text description only, not footage of an act.'), source:''}
  ];
  const capture = {actionId:'capture-fixture', revision:1, label:localized('مسودة اختبار سابقة','Earlier fixture draft'), fields:[{id:'statement',type:'textarea',label:localized('قول اللاعب','Player statement')},{id:'sources',type:'materialRefs',label:localized('مصادر المسودة','Draft sources')}], values:{statement:'A synthetic statement, not an established fact.',sources:['beta','not-earned']}};
  const actions = [0,1,2,3].map(mask => {
    const attached = [materials[0], ...(mask & 1 ? [materials[1]] : []), ...(mask & 2 ? [materials[2]] : [])].map(({id,title}) => ({id,title}));
    return {id:'file-'+mask,label:localized('معاينة حزمة اختبار '+mask,'Review fixture bundle '+mask),receiptPreview:{kind:'synthetic-filing',title:localized('إيداع اختبار اصطناعي','Synthetic fixture filing'),scope:'story-only',fromCapture:'draft-v1',capture:clone(capture),materials:attached,shares:attached.map(material=>({materialId:material.id,recipient:'fixture-archive'}))}};
  });
  actions.push({id:'draft-report',label:localized('اكتب مسودة اختبار','Write a fixture draft'),fields:[{id:'text',type:'textarea',label:localized('مسودة خاصة','Private draft'),required:true,maxLength:800},{id:'sources',type:'materialRefs',label:localized('مصادر مختارة','Chosen sources'),options:materials.map(material=>({value:material.id,label:material.title}))}]});
  return {caseId:'synthetic-comparison',contentVersion:VERSION,revision:4,saveStatus:'confirmed',persistence:'disk-file',scene:{id:'fixture-desk',title:localized('مكتب اختبار اصطناعي','Synthetic test desk'),body:localized('الاختبار لا يحتوي وقائع القضية.','This test contains no case facts.')},materials,actions,notes:[{id:'saved-note',text:'Synthetic private observation.',sourceId:'beta'},{id:'unknown-note',text:'Unknown reference must not acquire content.',sourceId:'not-earned'}],captures:{'draft-v1':capture},shares:[{materialId:'alpha',recipient:'fixture-reader',revision:2}],receipts:[]};
}

test('pinning acquired materials preserves reading, drafts and authority boundaries', async t => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  const results = [];
  if (ARTIFACTS) fs.mkdirSync(ARTIFACTS,{recursive:true,mode:0o700});
  t.after(async () => {
    if (ARTIFACTS) fs.writeFileSync(path.join(ARTIFACTS,'comparison-results.json'),JSON.stringify({browser:browser.version(),fixtures:'synthetic only',results},null,2),{mode:0o600});
    await browser.close();
  });

  async function withCase(options, run) {
    const state={...fixtureState(),...(options.state || {})}, original=clone(state), api=[];
    const server=http.createServer((req,res)=>{
      const pathname=new URL(req.url,'http://local').pathname;
      const json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
      if (pathname.startsWith('/api/')) {
        api.push({method:req.method,path:pathname});
        if (req.method==='GET' && pathname==='/api/case/config') return json({enabled:true,caseId:state.caseId,contentVersion:VERSION,locales:['ar','en'],defaultLocale:'ar',scope:'written-story',persistence:'disk-file'});
        if (req.method==='GET' && pathname==='/api/case/state') return json(state);
        res.writeHead(409);return res.end('{}');
      }
      const file=path.resolve(ROOT,'.'+pathname);
      if (!file.startsWith(ROOT+path.sep)) {res.writeHead(403);return res.end();}
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'};
      try {res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
      catch {res.writeHead(404);res.end();}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const context=await browser.newContext({viewport:{width:options.width || 390,height:844},reducedMotion:'reduce'});
    await context.addInitScript(()=>{
      localStorage.setItem('other_app_preferences','keep-unchanged');
      window.__comparisonStorage=[];
      for (const method of ['setItem','removeItem','clear']) {
        const original=Storage.prototype[method];
        Storage.prototype[method]=function(...args){window.__comparisonStorage.push({method,args});return original.apply(this,args);};
      }
    });
    const page=await context.newPage(),requests=[],errors=[];
    page.setDefaultTimeout(10000);
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      requests.push(route.request().url());
      return route.request().url().startsWith(base+'/')?route.continue():route.abort();
    });
    try {
      await page.goto(base+'/raven/deleted-name/play/content.html?lang='+(options.language || 'ar'),{waitUntil:'load'});
      await page.locator('#case-app').waitFor();
      const requestsBefore=requests.length,apiBefore=clone(api);
      await page.evaluate(()=>{window.__comparisonStorage=[];});
      await run({page,state,api,requests});
      assert.deepEqual(api,apiBefore,'pinning/reading/language/preview must not fetch state or send actions');
      assert.equal(requests.length,requestsBefore,'comparison must not request more resources');
      assert.deepEqual(state,original,'server projection and story facts remain unchanged');
      assert.deepEqual(await page.evaluate(()=>window.__comparisonStorage),[],'local comparison creates no storage writes');
      assert.equal(await page.evaluate(()=>localStorage.getItem('other_app_preferences')),'keep-unchanged');
      assert.deepEqual(errors,[],'no runtime page errors');
      assert.equal(await page.evaluate(()=>window.comparisonInjected),undefined,'untrusted material is inert text');
    } finally {await context.close();await new Promise(resolve=>server.close(resolve));}
  }
  const pinned=page=>Promise.all(['a','b'].map(slot=>page.locator('#compare-'+slot).inputValue()));
  const pin=(scope,id,slot)=>scope.locator(`[data-compare-material="${id}"][data-compare-slot="${slot}"]`);
  async function openPin(scope,id,slot) {
    const selector=`[data-compare-material="${id}"][data-compare-slot="${slot}"]`;
    const tools=scope.locator('.comparison-source-tools:has('+selector+')');
    if (!await tools.evaluate(el=>el.open)) await tools.locator(':scope > summary').click();
    return scope.locator(selector);
  }
  const previewContent=page=>page.locator('#review-body').evaluate(el=>{
    const copy=el.cloneNode(true);copy.querySelectorAll('.comparison-source-tools').forEach(node=>node.remove());return copy.textContent;
  });
  const active=page=>page.evaluate(()=>document.activeElement.id);
  async function returnTo(page,button,slot='',offset) {
    const id=await button.getAttribute('id');
    await page.locator('#comparison-return'+(slot?'-'+slot:'')).click();
    assert.equal(await active(page),id,'return restores focus to the exact reading control');
    const bounds=await button.boundingBox();assert.ok(bounds.y>=-1 && bounds.y+bounds.height<=844+1,'reading control is visible after return');
    if (offset!==undefined) assert.ok(Math.abs(bounds.y-offset)<3,'return restores the original position within the viewport');
  }
  async function fits(page) {
    assert.equal(await page.locator('html').evaluate(el=>el.scrollWidth<=innerWidth+1),true,'no horizontal overflow');
    for (const box of await page.locator('[data-compare-material]:visible').evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return {width:b.width,height:b.height,left:b.left,right:b.right};}))) {
      assert.ok(box.width>=44&&box.height>=44,'pin targets have at least 44 CSS pixels');
      assert.ok(box.left>=-1&&box.right<=await page.evaluate(()=>innerWidth)+1,'pin controls stay in the viewport width');
    }
  }

  for (const width of [320,390,768,1440]) for (const language of ['ar','en']) await t.test(`${language} ${width}: pin at the reading source, compare and return`,async()=>{
    await withCase({width,language},async({page,state})=>{
      const alpha=page.locator('[data-material-id="alpha"]');
      await alpha.locator(':scope > summary').click();
      const first=await openPin(alpha,'alpha','a');
      assert.match(await first.innerText(),language==='ar'?/الأولى/:/first/i,'the empty first-slot control uses the current language');
      await first.focus();await first.scrollIntoViewIfNeeded();
      const firstOffset=(await first.boundingBox()).y;
      await first.press('Enter');
      assert.deepEqual(await pinned(page),['alpha',''],'first pin does not guess a second material');
      assert.equal(await page.locator('#comparison').evaluate(el=>el.open),true);
      assert.equal(await page.locator('#comparison-body img').count(),0);
      assert.match(await page.locator('#comparison-body').innerText(),/<img src=x/);
      await returnTo(page,first,'',firstOffset);
      await page.locator('#notebook > summary').click();
      const noteSecond=await openPin(page.locator('#notes-list'),'beta','b');
      await noteSecond.click({trial:true});const secondOffset=(await noteSecond.boundingBox()).y;
      await noteSecond.click();assert.deepEqual(await pinned(page),['alpha','beta']);
      await fits(page);
      assert.equal(await page.locator('#comparison-body > section').count(),2);
      assert.equal(await pin(page,'not-earned','a').count(),0,'unknown reference cannot pin or reveal unearned material');
      assert.equal(await page.locator('#compare-a option[value="not-earned"]').count(),0);
      assert.deepEqual(await page.locator('#comparison-body blockquote').allTextContents(),state.materials.slice(0,2).map(material=>material.body[language]),'comparison preserves the exact received text');
      assert.deepEqual(await page.locator('#comparison-body section > p').allTextContents(),state.materials.slice(0,2).map(material=>material.source[language]),'two excerpts retain their common source without being relabeled as independent');
      if (ARTIFACTS && width<=390) {
        const filename=path.join(ARTIFACTS,`comparison-${language}-${width}.png`);
        await page.screenshot({path:filename});fs.chmodSync(filename,0o600);
      }
      await returnTo(page,first,'a',firstOffset);
      await returnTo(page,noteSecond,'b',secondOffset);
      await returnTo(page,noteSecond,'',secondOffset);
      assert.deepEqual(await pinned(page),['alpha','beta']);
      await page.locator('#comparison > summary').click();
      if (await page.locator('#comparison').evaluate(el=>el.open)) await page.locator('#comparison > summary').click();
      assert.deepEqual(await pinned(page),['alpha','beta'],'closing comparison retains both selected IDs');
    });
    results.push({name:`reading journey ${language} ${width}`,result:'PASS'});
  });

  for (const language of ['ar','en']) await t.test(`${language}: report preview, attachments and draft survive explicit slot replacement and language rendering`,async()=>{
    await withCase({language,width:390},async({page})=>{
      const draft=page.locator('form[data-action-id="draft-report"]');
      await draft.locator('textarea').fill('Unsent synthetic report draft.');
      await draft.locator('input[type="checkbox"][value="gamma"]').check();
      const bundle=page.locator('.receipt-bundle');
      const optional=bundle.locator('[data-attachment-group]');assert.equal(await optional.count(),2);
      await optional.nth(0).check();
      const action=await bundle.getAttribute('data-action-id');
      await bundle.locator('button[type="submit"]').click();
      await page.locator('#review-panel').waitFor({state:'visible'});
      const beforePreview=await previewContent(page);
      const previewFirst=await openPin(page.locator('#review-body .receipt-attachments'),'alpha','a');
      await previewFirst.click();await returnTo(page,previewFirst);
      assert.equal(await previewContent(page),beforePreview,'pinning does not rewrite the receipt preview');
      const reportSecond=await openPin(page.locator('#reports-body'),'beta','b');
      await reportSecond.click();await returnTo(page,reportSecond);
      assert.deepEqual(await pinned(page),['alpha','beta']);
      await page.locator('#timeline-range').selectOption('gamma');
      const replaceFirst=await openPin(page.locator('#timeline-inspection'),'gamma','a');
      assert.match(await replaceFirst.innerText(),language==='ar'?/استبد/:/Replace/i,'occupied slot explicitly says replacement');
      assert.ok((await replaceFirst.innerText()).includes(language==='ar'?'ورقة اختبار أولى':'First fixture sheet'),'replacement names the current occupant');
      await replaceFirst.click();
      assert.deepEqual(await pinned(page),['gamma','beta'],'explicit first-slot replacement preserves the second slot');
      assert.doesNotMatch(await page.locator('#comparison-body section').first().locator('p').innerText(),/أصل اختبار واحد|One fixture original/,'missing source is not filled from the previously selected material');
      const nextLanguage=language==='ar'?'en':'ar';
      await page.locator('#language-'+nextLanguage).click();
      assert.deepEqual(await pinned(page),['gamma','beta']);
      assert.equal(await draft.locator('textarea').inputValue(),'Unsent synthetic report draft.');
      assert.equal(await draft.locator('input[type="checkbox"][value="gamma"]').isChecked(),true);
      assert.equal(await optional.nth(0).isChecked(),true);
      assert.equal(await optional.nth(1).isChecked(),false);
      assert.equal(await bundle.getAttribute('data-action-id'),action);
      assert.equal(await page.locator('#review-panel').isVisible(),true,'language and pins preserve the unconfirmed preview');
      assert.match(await page.locator('#review-body').innerText(),/A synthetic statement, not an established fact/);
      await returnTo(page,pin(page.locator('#timeline-inspection'),'gamma','a'));
      assert.equal(await page.locator('#timeline-range').inputValue(),'gamma');
      await fits(page);
      await page.locator('#review-edit').click();
      assert.equal(await optional.nth(0).isChecked(),true,'canceling preview keeps attachment choices');
      assert.deepEqual(await pinned(page),['gamma','beta']);
    });
    results.push({name:`draft/preview ${language}`,result:'PASS'});
  });

  await t.test('read-only case allows comparing receipt attachments while every filing and draft control stays locked',async()=>{
    await withCase({state:{readOnly:true},language:'en'},async({page})=>{
      async function writesRemainLocked() {
        const controls=await page.locator('#actions input,#actions textarea,#actions select,#actions button:not([data-compare-material])').evaluateAll(nodes=>nodes.map(node=>({tag:node.tagName,type:node.type,disabled:node.disabled})));
        assert.ok(controls.some(control=>control.type==='submit'),'fixture exposes real filing controls');
        assert.ok(controls.some(control=>control.type==='checkbox'),'fixture exposes actual attachment choices');
        assert.ok(controls.every(control=>control.disabled),'comparison never unlocks filing, attachment or draft inputs');
      }
      await writesRemainLocked();
      const attachmentPin=await openPin(page.locator('.receipt-bundle'),'alpha','a');
      assert.equal(await attachmentPin.isEnabled(),true,'read-only attachment can still be selected for reading');
      await attachmentPin.click();
      assert.deepEqual(await pinned(page),['alpha','']);
      await returnTo(page,attachmentPin,'a');
      const card=page.locator('[data-material-id="beta"]');await card.locator(':scope > summary').click();
      const cardPin=await openPin(card,'beta','b');assert.equal(await cardPin.isEnabled(),true);
      await cardPin.click();assert.deepEqual(await pinned(page),['alpha','beta']);
      await page.locator('#language-ar').click();
      await writesRemainLocked();
      const rebuilt=await openPin(page.locator('.receipt-bundle'),'alpha','a');
      assert.equal(await rebuilt.isEnabled(),true,'read-only pin stays enabled after a full language render');
      await rebuilt.click();assert.deepEqual(await pinned(page),['alpha','beta']);
      assert.equal(await page.locator('#review-panel').isVisible(),false,'reading does not create a filing preview');
      assert.equal(await page.locator('#receipts-panel').isVisible(),false,'reading does not create a receipt');
      await writesRemainLocked();
    });
    results.push({name:'read-only attachment comparison with filing lock',result:'PASS'});
  });
});
