const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),origin='http://raven.test',prefix='/abdulrhman/';
const base=origin+prefix+'raven/after-show/content.html';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp'};

test('hand-built film, scenic materials, matte timing and reachability',async()=>{
  const m=await import('../raven/after-show/filmlab-model.js');
  const ink=m.inkSettings({points:[0,7,7,14],masks:Array(16).fill(1)});
  assert.deepEqual(m.inkPoint(ink.points,5),m.gridPoint(7));
  assert.ok(m.inkScene(ink,8).hidden);
  assert.notDeepEqual(m.inkPoint(ink.points,7),m.inkPoint([0,4,7,14],7));
  const regular=m.stoneRecipe({repeat:4});
  assert.equal(m.stoneReadings(regular).duplicates,7);
  assert.ok(m.stoneReadings({...regular,stagger:1}).duplicates<7);
  assert.ok(m.stoneReadings(regular).seam>0);
  assert.equal(m.stoneReadings({...regular,repeat:1}).seam,0);
  const split=m.splitSettings({});
  assert.equal(m.splitReadings({...split,offset:0}).gaps.length,0);
  assert.equal(m.splitReadings({...split,offset:0}).duplicates.length,0);
  assert.equal(m.splitReadings({...split,offset:3}).gaps.length,3);
  assert.equal(m.splitReadings({...split,offset:-3}).duplicates.length,3);
  const map=m.branchSettings(null);
  assert.deepEqual(m.examineMap(map).endings.sort(),[0,1]);
  map.doors[0]=[0,0];assert.deepEqual(m.examineMap(map).trapped,[0]);assert.deepEqual(m.examineMap(map).endings,[]);
});

test('four film workshops, mobile, independent saves and an audience handoff',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  for(const [lang,width,motion] of [['ar',320,'reduce'],['en',390,'no-preference']])await t.test(lang+' '+width,async()=>{
    const ctx=await browser.newContext({viewport:{width,height:820},reducedMotion:motion});const errors=[];
    try {
      await ctx.route('**/*',async r=>{const u=new URL(r.request().url()), f=path.resolve(root,u.pathname.slice(prefix.length));
        if(u.origin!==origin||!u.pathname.startsWith(prefix)||!f.startsWith(root+path.sep))return r.abort();
        try{return r.fulfill({body:await fs.readFile(f),contentType:types[path.extname(f)]||'application/octet-stream'});}
        catch{return r.fulfill({status:404,body:''});}
      });
      const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
      const el=id=>p.locator('[data-film="'+id+'"]'),visit=async id=>{await p.goto(base+'?activity='+id+'&lang='+lang);await p.locator('.film-stage canvas').waitFor();};
      const frame=()=>p.locator('.film-stage canvas').evaluate(c=>c.toDataURL());
      const fit=async()=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await visit('film-ink');
      await el('key-1').click();await el('cell-7').click();await el('key-2').click();await el('cell-7').click();
      await el('frame').fill('9');const front=await frame();await el('mask').click();
      assert.notEqual(await frame(),front);assert.equal(await el('mask').getAttribute('aria-pressed'),'true');
      await p.reload();await el('mask').waitFor();assert.equal(await el('mask').getAttribute('aria-pressed'),'true');
      assert.equal(await el('play').isHidden(),motion==='reduce');
      await el('next').focus();await p.keyboard.press('Enter');assert.equal(await el('frame').inputValue(),'10');
      if(motion!=='reduce'){await el('play').click();await p.waitForFunction(()=>Number(document.querySelector('[data-film=frame]').value)>1);await el('play').click();}
      await fit();
      await visit('scenic-texture');
      await el('repeat').fill('4');await el('print-0').click();const before=await frame();
      await el('base').selectOption('2');assert.notEqual(await frame(),before);await el('stagger').selectOption('1');await el('print-1').click();
      await el('choose-0').click();assert.equal(await frame(),before);await el('distance').click();assert.notEqual(await frame(),before);
      await p.reload();await el('distance').waitFor();assert.equal(await el('base').inputValue(),'0');assert.equal(await el('choose-1').isEnabled(),true);await fit();
      await visit('split-screen');
      const composite=await frame();await el('view-1').click();assert.notEqual(await frame(),composite);
      await el('view-2').click();await el('offset').fill('-3');await el('inspect').click();assert.ok((await p.locator('.film-result').innerText()).includes(' · 0'));
      await el('offset').fill('0');assert.equal((await p.locator('.film-result').innerText()).match(/· 0/g).length,2);
      const fixed=await frame();await el('seam').fill('56');assert.notEqual(await frame(),fixed);await fit();
      await visit('branch-film');
      await el('door-0-0').selectOption('0');await el('door-0-1').selectOption('0');await el('map-check').click();
      assert.ok((await p.locator('.film-reading[role=status]').innerText()).includes(lang==='en'?'Vestibule':'الردهة'));
      await el('door-0-0').selectOption('1');await el('door-0-1').selectOption('2');
      await el('ending-1').selectOption('2');await el('screen').click();const opening=await frame();
      assert.ok(await el('door-0-0').isHidden());await el('watch-left').click();assert.notEqual(await frame(),opening);await el('watch-left').click();
      assert.ok(await el('screen-again').isVisible());await el('screen-again').click();assert.equal(await frame(),opening);
      await el('watch-right').click();await p.reload();await el('watch-right').click();assert.ok((await p.locator('.film-stage figcaption').innerText()).includes(lang==='en'?'Last lanterns':'فوانيس'));
      await el('edit-map').click();assert.ok((await p.locator('.film-editor .film-reading').last().innerText()).includes(' | '));await fit();
      await p.locator('#as-language').click();await el('door-0-0').waitFor();assert.equal(await el('ending-1').inputValue(),'2');
      const keys=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('raven.after-show.v1.')));
      for(const key of ['film-ink','scenic-texture','split-screen','branch-film'])assert.ok(keys.includes('raven.after-show.v1.'+key));
      assert.deepEqual(errors,[]);
    }finally{await ctx.close();}
  });
});
