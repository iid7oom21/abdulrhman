const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {chromium, expect} = require('playwright/test');

async function serve(t) {
  const root = path.resolve(__dirname,'..');
  const prefix = '/abdulrhman/';
  const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.woff2':'font/woff2'};
  const server = http.createServer(async (req,res) => {
    const {pathname} = new URL(req.url,'http://localhost');
    const file = path.resolve(root,pathname.slice(prefix.length));
    if (!pathname.startsWith(prefix) || !file.startsWith(root+path.sep)) return res.writeHead(404).end();
    try {
      const bytes = await fs.readFile(file);
      res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream'}).end(bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return 'http://127.0.0.1:'+server.address().port+prefix+'raven/late-night/';
}

test('auction vouchers and ambiguous lost-property claims survive translation and notebook editing', async t => {
  const base = await serve(t);
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium'});
  t.after(() => browser.close());
  for (const [lang,width] of [['ar',320],['en',390]]) {
    await t.test(lang+' at '+width+'px', async t => {
      const p = await browser.newPage({viewport:{width,height:844},locale:lang,hasTouch:true,reducedMotion:'reduce'});
      t.after(()=>p.close());
      const errors=[];
      p.on('pageerror',e=>errors.push(e.message));
      const go=slug=>p.goto(base+slug+'.html?lang='+lang);
      const key=id=>p.locator('[data-game="'+id+'"]');
      async function bid(value) {
        await key('bid').selectOption(String(value));
        await key('close-round').click();
      }

      async function showsPlate(filename, frame) {
        await expect.poll(() => p.locator('.game-art').evaluate(async (screen, {filename, frame}) => {
          const art = new Image();
          art.src = new URL('assets/photo/' + filename + '.webp', location.href);
          await art.decode();
          const expected = document.createElement('canvas').getContext('2d');
          const x = 275, y = 111;
          expected.drawImage(art, (frame % 2) * 640 + x, Math.floor(frame / 2) * 320 + y, 12, 12, 0, 0, 12, 12);
          const pixels = expected.getImageData(0,0,12,12).data;
          const displayed = screen.getContext('2d').getImageData(x,y,12,12).data;
          return pixels.every((v, i) => v === displayed[i]);
        }, {filename, frame})).toBe(true);
      }
      await go('last-minute-auction');
      await showsPlate('auction-lots',0);
      await bid(4);
      await showsPlate('auction-lots',1);
      await expect(p.locator('[data-balance]')).toHaveAttribute('data-balance','8');
      await key('bid').selectOption('4');
      await p.locator('.night-lang').click();
      await expect(key('bid')).toHaveValue('4');
      await p.locator('.night-lang').click();
      await key('close-round').click();
      await bid(0);
      await expect(p.locator('[data-outcome]')).toHaveAttribute('data-outcome','assembled');
      await key('save').click();
      await go('my-notebook');
      await p.locator('a[href*="last-minute-auction.html?piece="]').click();
      await p.locator('summary').click();
      await key('edit-lot').selectOption('1');
      await key('edit-bid').click();
      await expect(key('bid')).toHaveValue('4');
      await bid(0);
      await bid(0);
      await expect(p.locator('[data-outcome]')).toHaveAttribute('data-outcome','shadow');
      await key('replay').click();
      await bid(0);
      await bid(0);
      await bid(9);
      await expect(p.locator('[data-outcome]')).toHaveAttribute('data-outcome','machine');
      await expect(p.locator('[data-balance]')).toHaveAttribute('data-balance','3');

      await go('lost-and-found');
      await showsPlate('lost-items',0);
      await key('inspect').click();
      await key('return-item').click();
      await key('claim-2').click();
      await key('next-item').click();
      await showsPlate('lost-items',1);
      await key('inspect').click();
      await key('return-item').click();
      await expect(key('claim-state')).toContainText(lang==='ar'?'مظلتين':'Two umbrellas');
      await key('ask-detail').click();
      await key('finish').click();
      const result=p.locator('[data-verdict]');
      await expect(result.nth(0)).toHaveAttribute('data-verdict','returned');
      await expect(result.nth(1)).toHaveAttribute('data-verdict','pending');
      await key('save').click();
      await go('my-notebook');
      await p.locator('a[href*="lost-and-found.html?piece="]').click();
      await key('claim-2').click();
      await key('read-reply').click();
      await expect(key('request')).toContainText(lang==='ar'?'خيط أزرق':'blue thread');
      await key('return-item').click();
      await key('finish').click();
      await expect(result.nth(1)).toHaveAttribute('data-verdict','returned');
      await key('replay').click();
      await key('belt-toggle').click();
      await expect(key('current-item')).toContainText(lang==='ar'?'مظلة بنية':'Brown umbrella',{timeout:6500});
      await key('belt-toggle').click();
      assert.ok(await p.locator('html').evaluate(el=>el.scrollWidth<=innerWidth));
      if (lang === 'ar') {
        await p.route('**/assets/photo/*.webp', route=>route.abort());
        await go('lost-and-found');
        await key('inspect').click();
        await expect(key('inspection')).toContainText('زر معدني');
        await key('return-item').click();
        await key('finish').click();
        await expect(p.locator('[data-verdict]').first()).toHaveAttribute('data-verdict','returned');
        await go('last-minute-auction');
        await bid(0); await bid(0); await bid(9);
        await expect(p.locator('[data-outcome]')).toHaveAttribute('data-outcome','machine');
      }
      assert.deepEqual(errors,[]);
    });
  }
});
