const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const vm=require('node:vm');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'assets/texts');
const pack=JSON.parse(fs.readFileSync(path.join(dir,'raven_all_texts_bilingual_merged_v1.0.1.json'),'utf8'));

test('approved merged JSON, each standalone section and the bracket-access browser bundle match',()=>{
  for(const key of ['player_help_texts_bilingual_v1.0.0','music_player_texts_bilingual_v1.0.0_8songs','dialogue_status_texts_bilingual_v1.0.1']) {
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,key+'.json'),'utf8')),pack[key]);
  }
  const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(dir,'raven-texts.js'),'utf8'),context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.RAVEN_ALL_TEXTS_BILINGUAL_MERGED)),pack);
});

test('approved labels through actual static dialogue and the single soundtrack UI in AR and EN',async t=>{
  const server=http.createServer((req,res)=>{
    let pathname=new URL(req.url,'http://local').pathname;if(pathname.endsWith('/'))pathname+='index.html';
    const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    try{const mime={'.js':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.m4a':'audio/mp4','.jpg':'image/jpeg','.webp':'image/webp'};
      res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}
    catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(async()=>{await browser.close();await new Promise(r=>server.close(r));});
  for(const lang of ['ar','en']) {
    const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(12000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    await page.goto(base+'/raven/dialogue/?lang='+lang);
    await page.locator('#status').filter({hasText:/دُمج|merged/}).waitFor();
    assert.equal(await page.locator('#player-help-title').innerText(),pack['player_help_texts_bilingual_v1.0.0'].help_title[lang]);
    assert.equal(await page.locator('#check').innerText(),pack['dialogue_status_texts_bilingual_v1.0.1'].check_request[lang]);
    await page.fill('#input','fixture');await page.click('#send');
    await page.locator('#status').filter({hasText:pack['dialogue_status_texts_bilingual_v1.0.1'].save_confirmed[lang]}).waitFor();
    assert.match(await page.locator('#mode-badge').innerText(),/محاكاة|simulation/);
    await page.goto(base+'/raven/?lang='+lang);
    await page.waitForFunction(()=>document.querySelectorAll('#music-track-picker option').length===26);
    assert.equal(await page.locator('audio').count(),1);
    assert.equal(await page.locator('#music-track-picker').getAttribute('aria-label'),pack['music_player_texts_bilingual_v1.0.0_8songs'].choose_song[lang]);
    assert.equal(await page.locator('#music-prev').innerText(),pack['music_player_texts_bilingual_v1.0.0_8songs'].previous[lang]);
    assert.equal(await page.locator('#music-next').innerText(),pack['music_player_texts_bilingual_v1.0.0_8songs'].next[lang]);
    assert.deepEqual(errors,[]);await context.close();
  }
});
