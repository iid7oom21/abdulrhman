// NODE_PATH=<playwright modules> CHROMIUM_PATH=/usr/bin/chromium node --test tests/ink-cut.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFile, mkdir} = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const {chromium, expect} = require('playwright/test');

const prefix = '/abdulrhman/';
const directory = path.resolve(__dirname, '..');
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.woff2':'font/woff2'};

async function fixture(t) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) return res.writeHead(404).end();
    const file = path.resolve(directory, url.pathname.slice(prefix.length));
    if (!file.startsWith(directory + path.sep)) return res.writeHead(404).end();
    try {
      const bytes = await readFile(file);
      res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'}).end(bytes);
    } catch {res.writeHead(404).end();}
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve=>server.close(resolve)));
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  const url = 'http://127.0.0.1:' + server.address().port + prefix + 'raven/late-night/ink-cut.html';
  return {browser,url};
}

test('The Final Cut plays the visitor’s ferry sequence, measures its cuts, and restores the revision', async t => {
  const {browser, url} = await fixture(t);
  const ctx = await browser.newContext({viewport:{width:320,height:812},hasTouch:true,reducedMotion:'reduce'});
  t.after(()=>ctx.close());
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', error=>errors.push(error.message));
  const key = id => page.locator('[data-cut-action="' + id + '"]');
  const stage = page.locator('.ink-stage');
  const signal = '**/ink/art/ferry-signal.webp';
  await page.route(signal, route=>route.abort());
  await page.goto(url + '?lang=ar');
  await expect(key('play')).toBeDisabled();
  await expect(page.getByRole('heading', {name:'القطع الأخير'})).toBeVisible();
  await expect(page.getByRole('link', {name:'العودة إلى ليالي الحبر'})).toHaveAttribute('href', /ink-studio\.html\?lang=ar$/);
  for (const id of ['deck','signal','pier']) await key('add-' + id).tap();
  await page.locator('[data-duration="deck"]').selectOption('1');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
  const time = new Date('2026-11-25T20:00:00Z');
  await page.clock.install({time});
  await page.clock.pauseAt(new Date(time.getTime()+1000));
  await key('play').press('Enter');
  await expect(stage).toHaveAttribute('data-shot','deck');
  await page.clock.fastForward(1016);
  await expect(stage).toHaveAttribute('data-shot','signal');
  await key('pause').press('Enter');
  await expect(key('retry-art')).toBeVisible();
  await page.locator('.night-lang').press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(stage.locator('figcaption')).toContainText('lantern');
  await page.clock.fastForward(8000);
  await expect(stage).toHaveAttribute('data-shot','signal');
  await page.unroute(signal);
  await key('retry-art').press('Enter');
  await expect.poll(()=>stage.locator('img').evaluate(img=>img.naturalWidth)).toBeGreaterThan(0);
  await key('resume').press('Enter');
  await page.clock.fastForward(2000);
  await expect(stage).toHaveAttribute('data-shot','pier');
  await page.clock.fastForward(2016);
  await expect(page.locator('.ink-result')).toHaveAttribute('data-passed','false');
  await expect(page.locator('.ink-result')).toContainText('5 s');
  await expect(page.locator('.ink-result')).toContainText('one more second');
  await key('revise').press('Enter');
  await key('earlier-pier').press('Enter'); await key('earlier-pier').press('Enter');
  await key('earlier-signal').press('Enter');
  await page.locator('[data-duration="deck"]').selectOption('2');
  await key('play').press('Enter');
  await expect(stage).toHaveAttribute('data-shot','pier');
  await page.clock.fastForward(2000);await expect(stage).toHaveAttribute('data-shot','signal');
  await page.clock.fastForward(2000);await expect(stage).toHaveAttribute('data-shot','deck');
  await page.clock.fastForward(2016);
  await expect(page.locator('.ink-result')).toHaveAttribute('data-passed','true');
  await key('keep').press('Enter');
  const piece = await page.evaluate(()=>{
    const key = Object.keys(localStorage).find(key => key.startsWith('raven.late-night.v1.piece.'));
    return JSON.parse(localStorage.getItem(key)).value;
  });
  assert.equal(piece.activity, 'ink-cut');
  assert.deepEqual(piece.data.cut.map(shot => shot.id), ['pier','signal','deck']);
  await page.reload();
  await expect(page.locator('.ink-result')).toHaveAttribute('data-passed','true');
  await expect(page.locator('.ink-result li').last()).toContainText('4–6');
  if(process.env.INK_QA_DIR){
    await mkdir(process.env.INK_QA_DIR,{recursive:true});
    await page.screenshot({path:path.join(process.env.INK_QA_DIR,'ink-cut-complete-320.png')});
  }
  assert.deepEqual(errors,[]);
});

test('a malformed private draft and blocked storage leave the silent editing round playable', async t => {
  const {browser,url} = await fixture(t);
  const page = await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const key = 'raven.late-night.v1.draft.ink-cut';
  await page.addInitScript(key=>{
    localStorage.setItem(key, JSON.stringify({version:1,value:{version:1,cut:[null]}}));
    Storage.prototype.setItem = () => {throw new Error('Storage denied');};
  },key);
  await page.goto(url+'?lang=en');
  const add = id => page.locator('[data-cut-action="add-'+id+'"]');
  await expect(add('pier')).toBeEnabled();
  for(const id of ['pier','signal','deck']) await add(id).click();
  await expect(page.locator('.night-notice')).toContainText('Saving could not be confirmed');
  await expect(page.locator('[data-cut-action=play]')).toBeEnabled();
  assert.equal(await page.locator('audio,video').count(),0);
  assert.equal(await page.locator('.ink-timeline li').count(),3);
});
