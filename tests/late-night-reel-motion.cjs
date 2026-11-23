const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');

test('a reel and its painted trail follow the rail in both directions through a bend', async t => {
  const root = path.resolve(__dirname, '..'), prefix = '/abdulrhman/';
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
  t.after(()=>browser.close());
  const p = await browser.newPage({viewport:{width:390,height:844}, hasTouch:true});
  await p.route('http://reel.test/**', async r => {
    const pathname = new URL(r.request().url()).pathname;
    if(!pathname.startsWith(prefix)) return r.abort();
    const file = path.resolve(root, pathname.slice(prefix.length));
    try {
      const type = {'.js':'text/javascript','.html':'text/html','.css':'text/css','.woff2':'font/woff2'}[path.extname(file)];
      await r.fulfill({body:await fs.readFile(file),contentType:type});
    } catch {await r.fulfill({status:404,body:''});}
  });
  await p.addInitScript(()=>{
    const proto = CanvasRenderingContext2D.prototype, arc = proto.arc, lineTo = proto.lineTo;
    window.framesOfReel = []; let trailEnd;
    proto.lineTo = function(x,y){
      if(this.strokeStyle === '#c6bfa1') trailEnd = [x,y];
      return lineTo.apply(this,arguments);
    };
    proto.arc = function(x,y,r){
      if(r === 18 && this.fillStyle === '#242a2b' && trailEnd){
        window.framesOfReel.push({x,y,trailEnd}); trailEnd=undefined;
      }
      return arc.apply(this,arguments);
    };
  });
  const errors=[]; p.on('pageerror', e=>errors.push(e.message));
  await p.goto('http://reel.test/abdulrhman/raven/late-night/reel-run.html?lang=en');
  const control = id=>p.locator('[data-game="'+id+'"]');
  const rotations=[0,0,0];
  async function place(i,name,rotation){
    await control('piece-'+i).tap(); await control('cell-'+name).tap();
    while(rotations[i] !== rotation){await control('rotate').tap(); rotations[i]=(rotations[i]+1)%4;}
  }
  async function run(expect){
    await p.evaluate(()=>{window.framesOfReel.length=0;});
    // A virtual animation clock samples the whole bend even on a busy CI runner.
    await control('roll').press('Enter'); await p.clock.runFor(1552);
    assert.equal(await p.locator('.game-readout').getAttribute('data-result'),expect);
  }
  async function verifyBend(midpoint,centre){
    const frames=await p.evaluate(()=>window.framesOfReel);
    assert.ok(frames.length>15);
    // Frames near the middle of the bend leave both centre lines. The previous
    // straight path went through the grid centre and missed this point.
    assert.ok(frames.some(f=>Math.hypot(f.x-midpoint[0], f.y-midpoint[1])<4), 'reel takes the curve');
    assert.ok(frames.every(f=>Math.hypot(f.x-f.trailEnd[0], f.y-f.trailEnd[1])<0.001),'trail meets the reel');
    const hasTrailNear = point=>p.locator('canvas').evaluate((canvas,[x,y])=>{
      const ctx=canvas.getContext('2d');
      const rgba=ctx.getImageData(Math.floor(x)-1,Math.floor(y)-1,3,3).data;
      for(let i=0;i<rgba.length;i+=4){
        if(Math.abs(rgba[i]-198)+Math.abs(rgba[i+1]-191)+Math.abs(rgba[i+2]-161)<12)return true;
      }
      return false;
    },point);
    assert.equal(await hasTrailNear(midpoint),true,'finished trail paints the rail');
    assert.equal(await hasTrailNear(centre),false,'finished trail avoids the grid corner');
  }
  await p.clock.install();
  await place(0,'C3',3); await place(1,'C2',1); await place(2,'F2',2);
  await run('won'); await verifyBend([240.75,153],[248,159]);
  const short = await control('reel-view').getAttribute('data-route');
  assert.equal(short,'A3,B3,C3,C2,D2,E2,F2,F3');
  await control('keep').tap();
  const piece=await p.evaluate(()=>JSON.parse(localStorage[Object.keys(localStorage).find(k=>k.includes('.piece.'))]).value);
  assert.equal(piece.data.round,1); assert.equal(piece.data.path.length,8); assert.deepEqual(piece.data.path[2],[2,2]);

  await control('long').tap(); await place(0,'B3',2); await place(1,'B5',0); await place(2,'F5',3);
  await run('won'); await verifyBend([166.75,165],[174,159]);
  assert.match(await control('reel-view').getAttribute('data-route'),/D5/);
  await control('piece-0').tap(); await control('rotate').tap(); await control('rotate').tap();
  await run('retry'); assert.equal(await control('reel-view').getAttribute('data-route'),'A3,B3');
  // With the bend facing away, the reel stops at the near end instead of crossing the tile.
  const end=await p.evaluate(()=>window.framesOfReel.at(-1));
  assert.equal(end.x,145); assert.equal(end.y,159);
  assert.deepEqual(errors,[]);
});
