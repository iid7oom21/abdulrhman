const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium,expect}=require('playwright/test');

const repository=path.resolve(__dirname,'..');
const site='http://raven.test/abdulrhman/';
const route=site+'raven/late-night/ink-ferry.html';
const types={'.js':'application/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.woff2':'font/woff2'};
async function fixture(t,viewport,language){
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport,hasTouch:viewport.width<600,reducedMotion:'reduce'});
  const errors=[],images=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async r=>{
    const u=new URL(r.request().url());
    if(!u.href.startsWith(site))return r.abort();
    const file=path.resolve(repository,u.pathname.slice('/abdulrhman/'.length));
    if(!file.startsWith(repository+path.sep))return r.abort();
    if(file.endsWith('.webp'))images.push(path.basename(file));
    try{return await r.fulfill({contentType:types[path.extname(file)],body:await fs.readFile(file)});}
    catch{return r.fulfill({status:404,body:''});}
  });
  await page.goto(route+'?lang='+language);
  const stage=page.locator('.ink-stage img');
  await expect(stage).toHaveAttribute('data-plate','pier');
  await stage.evaluate(img=>img.decode());
  await page.clock.install({time:new Date('2026-07-13T20:00:00Z')});
  return {page,stage,errors,images};
}

test('choose a shore or deck ending, pause, switch language and replay from the quay',async t=>{
  const {page,stage,errors,images}=await fixture(t,{width:320,height:760},'ar');
  assert.deepEqual(images,['ferry-pier.webp']);
  await page.getByRole('button',{name:'ابقَ على الرصيف'}).tap();
  await page.clock.runFor(3300);
  await expect(stage).toHaveAttribute('data-plate','signal');
  await page.getByRole('button',{name:'أوقف مؤقتًا'}).tap();
  const paused=await page.locator('progress').getAttribute('value');
  await page.clock.runFor(5000);
  assert.equal(await page.locator('progress').getAttribute('value'),paused);
  await page.getByRole('button',{name:'English'}).click();
  await expect(stage).toHaveAttribute('alt',/attendant holds a lit lantern/);
  await expect(page.getByRole('button',{name:'Resume'})).toBeVisible();
  await page.getByRole('button',{name:'Resume'}).click();await page.clock.runFor(5100);
  await expect(page.getByRole('status').filter({hasText:'lantern held over the pier'})).toBeVisible();
  assert.ok(!images.includes('ferry-deck.webp'));
  await page.getByRole('button',{name:'Replay scene'}).click();
  await expect(stage).toHaveAttribute('data-plate','pier');
  await page.getByRole('button',{name:'Choose another viewpoint'}).click();
  await page.getByRole('button',{name:'Follow the traveller'}).press('Enter');
  await page.getByRole('button',{name:'Next shot'}).press('Enter');
  await expect(stage).toHaveAttribute('data-plate','deck');
  await page.getByRole('button',{name:'Go to ending'}).press('Enter');
  await expect(page.locator('.ink-result')).toContainText('cabin door');
  await expect(page.getByRole('link',{name:'Back to Ink Nights'})).toHaveAttribute('href',/ink-studio\.html\?lang=en$/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
});

test('missing boarding frame preserves the chosen perspective, timing and ending',async t=>{
  const {page,stage,errors}=await fixture(t,{width:390,height:844},'en');
  const missing='**/ferry-deck.webp';
  await page.route(missing,r=>r.abort());
  await page.getByRole('button',{name:'Follow the traveller'}).tap();
  await page.clock.runFor(3400);
  await expect(page.getByRole('button',{name:'Reload frame'})).toBeVisible();
  await expect(stage).toHaveAttribute('alt',/steps along the ferry deck/);
  await page.getByRole('button',{name:'Pause'}).tap();
  const paused=await page.locator('progress').getAttribute('value');
  await page.unroute(missing);
  await page.getByRole('button',{name:'Reload frame'}).tap();
  await stage.evaluate(img=>img.decode());
  assert.equal(await stage.evaluate(img=>img.naturalWidth/img.naturalHeight),16/9);
  assert.equal(await page.locator('progress').getAttribute('value'),paused);
  await page.getByRole('button',{name:'Go to ending'}).tap();
  await expect(page.locator('.ink-result')).toContainText('cabin door');
  assert.deepEqual(errors,[]);
});
