const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..'),base='http://night.test/abdulrhman/',q=base+'raven/late-night/';
const type={'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2','.webp':'image/webp','.json':'application/json'};

function play(R,scenario,plan){
  const s=R.create(scenario),orders=plan.slice().sort((a,b)=>a[0]-b[0]);
  while(!s.over){
    while(orders.length&&orders[0][0]<=s.time+1e-9){const [,id,order]=orders.shift();R.instruct(s,id,order);}
    R.step(s);
  }
  return s;
}
const kinds=s=>s.events.map(e=>e.type+':'+e.ids.join('/'));

test('radar rules: vectors, closest approach, reaction time and the two watches',async()=>{
  const R=await import('../raven/late-night/sims/vts-rules.js');
  assert.equal(R.clock(0),'03:10:00');
  assert.equal(R.clock(36),'03:46:00');
  // Two ships closing head-on at six knots each meet in five minutes; a three-cable offset is the passing distance.
  const a={x:0,y:0,heading:0,speed:6},b={x:0,y:1,heading:180,speed:6},c={...b,x:.3};
  assert.ok(R.cpa(a,b).cpa<1e-9);assert.ok(Math.abs(R.cpa(a,b).tcpa-5)<1e-9);
  assert.ok(Math.abs(R.cpa(a,c).cpa-.3)<1e-9);
  // An opening pair has already passed its closest point.
  assert.equal(R.cpa(a,{x:0,y:-1,heading:180,speed:6}).tcpa,0);
  // A one-knot set to the east moves every echo east by a sixtieth of a mile a minute.
  const drift=R.velocity({heading:0,speed:0},{set:90,drift:1});
  assert.ok(Math.abs(drift.x-1/60)<1e-9&&Math.abs(drift.y)<1e-9);
  assert.equal(R.bearing(0,0,1,0),90);assert.equal(R.norm(-10),350);

  // An order is acknowledged now and felt after the ship's reaction time.
  const s=R.create('fog'),safa=s.vessels.find(v=>v.id==='safa');
  assert.equal(R.instruct(s,'safa','slow').reply,'ack');
  assert.equal(safa.pending[0].at,safa.k.delay);
  assert.equal(safa.ordered,12);
  R.advance(s,1);assert.equal(safa.ordered,safa.k.slow);
  // Only the inbound ship has a berth to wait for; the departing one cannot anchor.
  assert.equal(R.instruct(s,'dana','anchor').reply,'unable');

  // Left alone, the fog watch ends with both large ships inside the one-way channel.
  const fog=play(R,'fog',[]);
  assert.equal(fog.result.verdict,'incident');
  assert.ok(kinds(fog).includes('meeting:dana/safa'));
  // With the current setting the fishing boat down, the same night ends in a collision.
  const current=play(R,'current',[]);
  assert.equal(current.result.verdict,'casualty');
  assert.ok(kinds(current).includes('collision:dana/najm'));

  // Slow the inbound ship, then the outbound one: every passage completes without a close-quarters situation.
  const sequence=play(R,'fog',[[0,'safa','slow'],[8,'dana','half']]);
  assert.equal(sequence.result.verdict,'clean');
  assert.deepEqual(kinds(sequence).sort(),['arrived:safa','cleared:dana','crossed:najm']);
  assert.ok(sequence.result.closest[0].d>=R.CLOSE);
  // The judgement window is wide enough for a person: any second order from minute 7 to 11 also works.
  for(const at of [7,9,11])assert.equal(play(R,'fog',[[0,'safa','slow'],[at,'dana','half']]).result.verdict,'clean',String(at));

  // The fishing boat misses the first call; a repeated call is answered.
  const repeat=play(R,'current',[[0,'safa','slow'],[10,'najm','stop'],[11,'najm','stop'],[16,'safa','full'],[17,'najm','resume']]);
  assert.deepEqual(repeat.calls.filter(x=>x.id==='najm').map(x=>x.reply),['silent','ack','ack']);
  assert.equal(repeat.result.verdict,'clean');

  // Sending the inbound ship to the anchorage keeps it off the banks.
  const anchored=play(R,'fog',[[0,'safa','anchor']]);
  assert.ok(!anchored.events.some(e=>e.type==='grounding'));
  assert.ok(!anchored.vessels.find(v=>v.id==='safa').grounded);
});

test('stand the harbour watch at the project mount',async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  t.after(()=>browser.close());
  for(const [lang,width] of [['ar',320],['en',390],['ar',1024]])await t.test(lang+' '+width,async()=>{
    const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:width<600,acceptDownloads:true});
    try{
      const outside=[],missing=[],errors=[];
      await ctx.route('**/*',async r=>{
        const url=r.request().url();if(!url.startsWith(base)){outside.push(url);return r.abort();}
        const file=path.resolve(root,new URL(url).pathname.slice('/abdulrhman/'.length));
        try{await r.fulfill({body:await fs.readFile(file),contentType:type[path.extname(file)]||'application/octet-stream'});}
        catch{missing.push(url);await r.fulfill({status:404,body:''});}
      });
      const p=await ctx.newPage();p.setDefaultTimeout(5000);p.on('pageerror',e=>errors.push(e.message));
      const control=id=>p.locator('[data-sim="'+id+'"]');
      const press=id=>width<600?control(id).tap():control(id).click();
      const time=()=>p.evaluate(()=>Number(document.querySelector('[data-sim=radar]').dataset.time||0));
      const replies=()=>control('radio').locator('li').evaluateAll(items=>items.map(li=>li.dataset.reply));
      const fits=async()=>assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));

      await p.goto(q+'harbour-watch.html?lang='+lang);await control('run').waitFor();
      assert.equal(await control('clock').textContent(),'03:10:00');
      assert.equal(await p.locator('h1').textContent(),lang==='ar'?'نوبة برج المرفأ':'Harbour tower watch');
      assert.equal(await control('radar').getAttribute('role'),'img');
      assert.match(await control('threat').textContent(),lang==='ar'?/تقارب/:/Approach/);
      await fits();

      // Paused at 03:10: slow the inbound container ship.
      await press('pick-safa');await press('order-slow');
      assert.deepEqual(await replies(),['ack']);
      assert.equal(await control('clock').textContent(),'03:10:00');

      // Compress time, watch the picture move, then stop the clock to give the next order.
      await press('pace-60');assert.equal(await control('pace-60').getAttribute('aria-pressed'),'true');
      await press('run');
      await p.waitForFunction(()=>Number(document.querySelector('[data-sim=radar]').dataset.time||0)>=8,null,{timeout:30000});
      await press('run');
      const paused=await time();await p.waitForTimeout(400);assert.equal(await time(),paused);
      assert.ok(paused<11,'the second order still falls inside the safe window');
      await press('pick-dana');await press('order-half');
      assert.deepEqual(await replies(),['ack','ack']);

      await press('finish');
      const report=control('report');
      await report.locator('h2').waitFor();
      assert.equal(await report.getAttribute('data-verdict'),'clean');
      assert.deepEqual((await report.locator('[data-event]').evaluateAll(items=>items.map(li=>li.dataset.event))).sort(),['arrived','cleared','crossed']);
      await fits();

      await press('save');await p.locator('.sim-confirm').waitFor();
      const saved=await p.evaluate(()=>{
        const key=Object.keys(localStorage).find(k=>k.startsWith('raven.late-night.v1.piece.'));
        return key&&JSON.parse(localStorage.getItem(key)).value;
      });
      assert.equal(saved.activity,'harbour-watch');
      assert.equal(saved.data.scenario,'fog');assert.equal(saved.data.verdict,'clean');
      assert.deepEqual(saved.data.calls.map(c=>c.id+':'+c.order),['safa:slow','dana:half']);
      assert.equal(saved.data.calls[0].at,0);

      const pending=p.waitForEvent('download');await press('export');const out=await pending;
      assert.ok(out.suggestedFilename().endsWith('.png'));
      assert.equal((await fs.readFile(await out.path())).toString('ascii',1,4),'PNG');

      // The notebook link reopens the same watch and the same verdict from the saved calls.
      await p.goto(q+'harbour-watch.html?lang='+lang+'&piece='+saved.id);
      await control('report').locator('h2').waitFor();
      assert.equal(await control('report').getAttribute('data-verdict'),'clean');
      assert.deepEqual(await replies(),['ack','ack']);

      // A fresh watch in the current: the fishing boat misses the first call.
      await press('restart');
      assert.equal(await control('clock').textContent(),'03:10:00');
      assert.equal(await control('report').locator('h2').count(),0);
      await control('scenario').selectOption('current');
      await press('pick-najm');await press('order-stop');
      assert.deepEqual(await replies(),['silent']);
      assert.match(await control('radio').innerText(),lang==='ar'?/لا رد/:/no reply/);
      await press('order-stop');
      assert.deepEqual(await replies(),['ack','silent']);

      // Switching language keeps the watch in progress.
      await p.locator('.night-lang').click();await control('run').waitFor();
      assert.equal(await p.evaluate(()=>document.documentElement.lang),lang==='ar'?'en':'ar');
      assert.equal(await control('scenario').inputValue(),'current');
      assert.deepEqual(await replies(),['ack','silent']);
      await fits();

      assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);assert.deepEqual(missing,[]);
    }finally{await ctx.close();}
  });
});
