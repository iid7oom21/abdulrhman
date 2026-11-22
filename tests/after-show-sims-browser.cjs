const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {chromium,expect}=require('playwright/test');
const base='http://raven.test/abdulrhman/';
const website=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.wav':'audio/wav'};
test('four interactive simulators use actual resources, visible records, measured light and timed sound',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  for(const [lang,width] of [['en',390],['ar',320]]) await t.test(lang+' '+width,async()=>{
    const ctx=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
    const errors=[],media=[];
    await ctx.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(!url.href.startsWith(base))return route.abort();
      let name=url.pathname.slice('/abdulrhman/'.length);
      if(name.endsWith('/'))name+='index.html';
      const file=path.resolve(website,name);
      if(!file.startsWith(website+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      if(name.endsWith('.wav'))media.push(name);
      return route.fulfill({path:file,contentType:types[path.extname(file)]||'application/octet-stream'});
    });
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    function txt(ar,en){return lang==='ar'?ar:en;}
    const press=(ar,en)=>page.getByRole('button',{name:txt(ar,en),exact:true}).click();
    const visit=async id=>{
      await page.goto(base+'raven/after-show/content.html?activity='+id+'&lang='+lang);
      await expect(page.locator('.sim-title')).toBeVisible();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    };
    try{
      await visit('projection');
      await expect(page.locator('.sim-clock')).toHaveText(txt('١٩:٥٤','19:54'));
      for(let i=0;i<7;i++)await press('تقديم دقيقة','Step one minute');
      await expect(page.locator('.sim-result')).toContainText(txt('٢٠:٠١','20:01'));
      await page.reload();await expect(page.locator('.sim-clock')).toHaveText(txt('٢٠:٠١','20:01'));
      await page.getByLabel(txt('الوردية','Shift'),{exact:true}).selectOption('parallel');
      await page.locator('.sim-booking').filter({hasText:txt('تجهيز قائمة العرض','Prepare playlist')}).locator('select').last().selectOption('1');
      await expect(page.locator('.sim-booking')).toHaveCount(4);
      await expect(page.locator('.sim-schedule-row').filter({hasText:txt('البروفة النهائية','Final rehearsal')})).toContainText(txt('٢٠:٠١ – ٢٠:٠٣','20:01 – 20:03'));
      await expect(page.locator('.sim-result')).toContainText(txt('٢٠:٠٣','20:03'));
      await press('شغّل الوردية','Run shift');await press('وقّف البروفة','Pause rehearsal');
      await visit('light');
      await page.getByLabel(txt('التعريض','Exposure'),{exact:true}).fill('60');
      await expect(page.locator('.sim-meters')).toContainText(txt('١٠٠','100'));
      await press('احفظ لقطة للمقارنة','Capture comparison frame');
      await page.getByLabel(txt('التعريض','Exposure'),{exact:true}).fill('0');
      await expect(page.locator('.sim-meter bdi').first()).toHaveText(txt('٠٫٠%','0.0%'));
      assert.notEqual(await page.locator('.sim-pairs figure').first().locator('canvas').evaluate(c=>c.toDataURL()),await page.locator('.sim-pairs figure').last().locator('canvas').evaluate(c=>c.toDataURL()));
      await page.reload();await expect(page.locator('.sim-pairs figure').first()).toBeVisible();
      await ctx.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='2d'?null:get.call(this,type,...args);};});
      await page.reload();
      await page.getByLabel(txt('لقطات إضاءة بديلة','Lighting stills')).selectOption('2');
      await expect(page.locator('.sim-note')).toContainText([txt('الرسم المباشر','Live rendering'),txt('الملمس','Texture')]);
      await expect(page.locator('.sim-meter bdi').first()).toHaveText(txt('١٠٠٫٠%','100.0%'));
      await page.locator('.sim-pairs figure').last().locator('img').evaluate(i=>i.decode());
      await visit('archive');
      for(const [i,[a,e]] of [['معلومات ناقصة','Request missing details'],['اطلب النسخة الصحيحة','Request a replacement'],['اعتمد للاستعراض','Approve for screening'],['اطلب النسخة الصحيحة','Request a replacement']].entries()){
        await press(a,e);
        await expect(page.locator('.sim-verdict')).toContainText(txt('ما يدعمه الطلب','Supported by the order'));
        await press(i===3?'اعرض سجل الوردية':'افتح الشحنة التالية',i===3?'View shift log':'Open next delivery');
      }
      await expect(page.locator('.sim-archive')).toContainText(txt('٤ / ٤','4 / 4'));
      await visit('sound');
      await expect(page.getByRole('button',{name:txt('تفعيل المؤثرات الصوتية','Enable sound effects')})).toHaveAttribute('aria-pressed','false');
      await press('شغّل البروفة','Run rehearsal');
      await expect(page.locator('.sim-verdict-row').first()).toContainText(txt('بعد الحركة بـ ٠٫٤ ث','after motion by 0.4 s'),{timeout:15000});
      assert.equal(media.length,0);
      await page.getByLabel(txt('تقليب الورقة','Paper turn'),{exact:true}).fill('2');
      await expect(page.locator('.sim-verdict-row').first()).toContainText(txt('متزامن تمامًا','In sync'));
      await page.evaluate(()=>{window.playedCue=false;document.addEventListener('playing',e=>{if(e.target instanceof HTMLAudioElement)window.playedCue=true;},true);});
      await press('تفعيل المؤثرات الصوتية','Enable sound effects');await press('شغّل البروفة','Run rehearsal');
      await expect.poll(()=>page.evaluate(()=>window.playedCue),{timeout:6500}).toBe(true);
      assert.ok(media.length>0);
      await press('إيقاف مؤقت','Pause rehearsal');
      assert.equal(await page.locator('.as-sim audio').evaluateAll(els=>els.every(el=>el.paused)),true);
      assert.deepEqual(errors,[]);
    }finally{await ctx.close();}
  });
});
