import {start,keepButton,el,button,group,canvas,output,box,dot,line,gradient,loadPhoto,redrawWhenLoaded} from './tools.js';
const domePhoto = loadPhoto('dome-sky');
const brassDisc = loadPhoto('dome-disc');
const holes=[[0,1,4,5,7,12,13,14,15],[0,1,2,3,4,5,7,10,15]],target=[1,2,5,6];
const shift=(v,angle)=>Math.floor(v/8)*8+(v%8+angle)%8;
function projection(a,b){
  const front=new Set(holes[0].map(v=>shift(v,a)));
  return holes[1].map(v=>shift(v,b)).filter(v=>front.has(v)).sort((a,b)=>a-b);
}
const label=i=>(i<8?'A':'B')+(i%8+1);
function spot(n,cx,cy,r){
  const angle=n%8*Math.PI/4-Math.PI/2,rad=r*(n<8?.56:.85);return[cx+rad*Math.cos(angle),cy+rad*Math.sin(angle)];
}
function circle(c,x,y,r,color){
  c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.strokeStyle=color;c.lineWidth=1;c.stroke();
}
function disc(c, x, y, r, open, angle) {
  c.save();
  c.shadowOffsetY = 3;
  c.shadowBlur = 6;
  c.shadowColor = '#070605';
  dot(c, '#382e26', x, y, r+2);
  c.restore();
  c.save();
  c.translate(x,y);
  c.rotate(angle * Math.PI / 4);
  if (brassDisc.naturalWidth) {
    c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.clip();
    c.drawImage(brassDisc,0,0,192,192,-r,-r,r*2,r*2);
  } else {
    const metal = c.createLinearGradient(-r,-r,r,r);
    metal.addColorStop(0,'#aaa393'); metal.addColorStop(.32,'#685a47');
    metal.addColorStop(.58,'#9b8867'); metal.addColorStop(1,'#463f33');
    dot(c,metal,0,0,r);
    for (let n=2;n<r;n+=3) circle(c,0,0,n,'#ede0ba14');
    dot(c,'#4c4539',0,0,3);
  }
  c.restore();
  circle(c,x,y,r-2,'#f4dcac80');
  for (const n of open) {
    const [sx,sy]=spot(n,x,y,r);
    dot(c,'#dac395',sx+.6,sy+1,3.9);
    dot(c,'#171c19',sx,sy,3.6);
  }
}
function visual(c,a,b,free){
  const lights=projection(a,b);
  if (domePhoto.naturalWidth) c.drawImage(domePhoto,0,0,640,320);
  else gradient(c,'#11191e','#45433b');
  for(let i=0;i<16;i++){
    const [x,y]=spot(i,318,115,106);
    if(lights.includes(i)){
      const glow=c.createRadialGradient(x,y,0,x,y,12);
      glow.addColorStop(0,'#fff2c6');glow.addColorStop(.2,'#ffe5ab');
      glow.addColorStop(.42,'#efcc7366');glow.addColorStop(1,'#d0ac5d00');
      dot(c,glow,x,y,12);
    } else dot(c,'#89989b',x,y,1.4);
  }
  if(brassDisc.naturalWidth) c.drawImage(brassDisc,0,192,640,80,0,225,640,95);
  else box(c,'#46392f',0,225,640,95);
  const edge=c.createLinearGradient(0,225,0,251);
  edge.addColorStop(0,'#100c0bb3');edge.addColorStop(1,'#100c0b00');
  box(c,edge,0,225,640,26);
  c.save();c.translate(0,264);c.scale(1,.72);
  disc(c,150,0,49,holes[0].map(v=>shift(v,a)),a);
  disc(c,280,0,49,holes[1].map(v=>shift(v,b)),b);
  c.restore();
  c.fillStyle='#eee4d2';c.font='13px monospace';c.textAlign='center';
  c.fillText('A',150,313);c.fillText('B',280,313);
  if(!free){
    c.save(); c.translate(503,265); c.scale(1,.72); c.rotate(-.065);
    const stock=c.createLinearGradient(-64,-49,64,49);
    stock.addColorStop(0,'#d3c9b6');stock.addColorStop(1,'#aa9a7d');
    box(c,'#161711aa',-61,-42,126,92);box(c,stock,-63,-45,126,92);
    for(let i=0;i<16;i++){
      const [x,y]=spot(i,0,0,43);
      dot(c,target.includes(i)?'#383c3c':'#978d7e',x,y,target.includes(i)?2.8:1);
    }
    c.restore();
  }
}
let a=0,b=0,free=false,checked=false,restored=false;
function render(ui){
  const {t,root}=ui;
  if(!restored){restored=true;const d=ui.editData;if(d&&[d.a,d.b].every(n=>Number.isInteger(n)&&n>=0&&n<=7)){a=d.a;b=d.b;free=d.free===true;}}
  const view=canvas(t('إسقاط السماء والقرصان وبطاقة الطلب','Sky projection, two discs and target card'));
  view.dataset.game='sky';const c=view.getContext('2d'),board=group(),tools=group(),map=el('p'),req=el('p',null,'game-note'),read=output();
  const eq=()=>projection(a,b).join()===target.join();
  function paint(){
    const focused=board.contains(document.activeElement)||tools.contains(document.activeElement)
      ? document.activeElement.dataset.game : null;
    const lit=projection(a,b);visual(c,a,b,free);
    view.dataset.lit=lit.map(label).join(',');view.dataset.a=a;view.dataset.b=b;
    map.textContent=t('الخانات المضاءة: ','Lit cells: ')+(lit.length?lit.map(label).join(' · '):t('لا شيء','None'));
    req.textContent=free?t('سماء حرّة. اختر إسقاطك ثم نزّله.','Free sky. Choose your projection and download it.'):t('بطاقة الطلب: ','Target card: ')+target.map(label).join(' · ');
    read.textContent=checked?(eq()?t('تطابقت الخانات مع بطاقة الكوكبة.','The illuminated cells match the constellation card.'):t('تختلف الخانات المضاءة عن البطاقة. أدر أحد القرصين وأعد الفحص.','The lit cells differ from the card. Rotate a disc and check again.')):'';
    read.dataset.result=checked?(eq()?'match':'different'):'';
    board.replaceChildren();
    [[0,'A'],[1,'B']].forEach(([i,key])=>{
      for(const [amount,sign] of [[-1,'−'],[1,'+']])board.append(button(key+(amount<0?'-minus':'-plus'),key+' '+sign+' 45°',()=>{
        if(i===0)a=(a+amount+8)%8;else b=(b+amount+8)%8;checked=false;paint();
      }));
    });
    tools.replaceChildren();
    if(!free)tools.append(button('check',t('افحص الإسقاط','Check projection'),()=>{checked=true;paint();ui.recordEvent({ar:'فحصت إسقاط القبة.',en:'You checked the dome projection.',data:{a,b,match:eq(),lit:projection(a,b)}});}));
    tools.append(button('mode',free?t('ارجع للطلب','Return to the brief'):t('ارسم سماء حرّة','Make a free sky'),()=>{free=!free;checked=false;paint();}));
    if(free)tools.append(button('png',t('نزّل السماء PNG','Download sky PNG'),()=>{
      const image=el('canvas');image.width=640;image.height=320;const g=image.getContext('2d');gradient(g,'#101b29','#243c47');
      for(let n=0;n<16;n++){const [x,y]=spot(n,320,160,170);if(lit.includes(n)){dot(g,'#ffe1a2',x,y,5);line(g,'#e5c673',1,[[x-10,y],[x+10,y]]);line(g,'#e5c673',1,[[x,y-10],[x,y+10]]);}}
      image.toBlob(blob=>{if(!blob)return;const u=URL.createObjectURL(blob),link=el('a');link.href=u;link.download='raven-night-sky.png';link.click();setTimeout(()=>URL.revokeObjectURL(u),1000);},'image/png');
    }));
    if(free||(checked&&eq()))tools.append(keepButton(ui,t('احتفظ بإسقاطك','Keep this projection'),()=>({title:t('إسقاط القبة','Dome projection'),type:'dome-sky',data:{a,b,free,lit:projection(a,b)},thumbnail:view.toDataURL('image/webp',.45)})));
    tools.append(button('reset',t('أعد ضبط القرصين','Reset the discs'),()=>{a=0;b=0;checked=false;paint();}));
    if(focused) root.querySelector('[data-game="'+focused+'"]')?.focus({preventScroll:true});
  }
  root.replaceChildren(view,req,map,board,tools,read);paint();
  for(const image of [domePhoto,brassDisc]) redrawWhenLoaded(image,view,()=>visual(c,a,b,free));
}
start(5,'dome-sky',['القبة ذات السماء الناقصة','The unfinished sky'],['أدر القرصين. يمر شعاع الضوء في المواضع التي تلتقي فيها فتحتان.','Rotate two punched discs. Light passes where two holes meet.'],render);
