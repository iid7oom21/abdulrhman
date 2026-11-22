// CHROMIUM_PATH=/usr/bin/chromium node --test tests/after-show-illusions.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium,expect}=require('playwright/test');
const root=path.resolve(__dirname,'..'),origin='http://raven.test',prefix='/abdulrhman/';
const contentType={'.js':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.woff2':'font/woff2','.webp':'image/webp','.svg':'image/svg+xml'};
test('forced perspective, matte, zoetrope and costume matching through the real workshop',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  for(const [lang,width] of [['ar',320],['en',390]])await t.test(lang+' '+width,async()=>{
    const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
    await ctx.route('**/*',async route=>{
      const u=new URL(route.request().url());
      if(u.origin!==origin || !u.pathname.startsWith(prefix))return route.abort();
      const filename=path.resolve(root,u.pathname.slice(prefix.length));
      if(!filename.startsWith(root+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile())return route.fulfill({status:404,body:''});
      return route.fulfill({path:filename,contentType:contentType[path.extname(filename)]||'application/octet-stream'});
    });
    const page=await ctx.newPage(),errors=[];
    page.setDefaultTimeout(6000);page.on('pageerror',err=>errors.push(err.message));
    const ar=lang==='ar';
    const q=id=>page.locator('[data-illusion="'+id+'"]');
    const outcome=page.locator('.il-result');
    const image=()=>q('picture').evaluate(c=>c.toDataURL());
    async function visit(id){await page.goto(origin+prefix+'raven/after-show/content.html?activity='+id+'&lang='+lang);await q('picture').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));}
    try{
      await visit('forced-scale');const initial=await image();
      await q('cup').fill('80');await q('tower').fill('480');await q('capture').click();
      await expect(outcome).toContainText(ar?'تلامس السقف':'Rim and roof align');
      const snap=await q('captured').evaluate(c=>c.toDataURL());await q('reveal').click();
      assert.notEqual(snap,await q('captured').evaluate(c=>c.toDataURL()));
      await q('side').click();assert.notEqual(initial,await image());
      await page.reload();await expect(q('cup')).toHaveValue('80');await expect(q('side')).toHaveAttribute('aria-pressed','true');
      await visit('matte');await q('seam').selectOption('0');await q('position').fill('25');
      await expect(outcome).toContainText(ar?'الجزء المخفي':'currently hidden');
      await q('grid-x').fill('300');await q('grid-y').fill('146');await q('grid-size').fill('60');await q('seam').selectOption('2');
      await expect(outcome).toContainText(ar?'تطابقت الشبكتان':'Grids aligned');
      await expect(outcome).toContainText(ar?'حتى العمود الأخير':'reaches the last column');
      await q('cart-run').click();await expect(q('position')).toHaveValue('35');
      await q('matte-inspect').click();await q('curtain').fill('13');const one=await image();await q('curtain').fill('81');assert.notEqual(one,await image());
      await visit('zoetrope');await q('frame-7').click();await q('fold').fill('-25');await q('review').click();
      await expect(outcome).toContainText(ar?'اتصلت النهاية':'Loop seam accepted');
      await expect(outcome).toContainText('17°');await q('fold').fill('-24');
      await expect(outcome).toContainText(ar?'ما زالت كبيرة':'still jumps');await q('slow-compare').click();
      await expect(page.locator('.il-frame figcaption')).toContainText(ar?'يسارًا البداية':'Original at left');
      await q('play').click();await expect(q('frame-1')).toHaveAttribute('aria-pressed','true');
      await page.waitForTimeout(290);await expect(q('frame-1')).toHaveAttribute('aria-pressed','true');
      await visit('costume');await q('scan').click();await expect(outcome).toContainText('100%');
      await q('length').selectOption('0');await q('prop').selectOption('3');await q('shoulder').selectOption('2');
      const look=await image();await q('mono').click();await q('distance').click();assert.notEqual(look,await image());
      await q('quiz').click();
      for(const [i,key] of ['1','2','0'].entries())await q('match-'+i).selectOption(key);
      await q('score').click();await expect(page.locator('.il-note').last()).toContainText(ar?'نقارن':'sample');
      await expect(page.locator('.il-workshop')).toContainText('3/3');
      await q('quiz').click();await expect(q('length')).toHaveValue('0');
      assert.deepEqual(errors,[]);
    }finally{await ctx.close();}
  });
});
