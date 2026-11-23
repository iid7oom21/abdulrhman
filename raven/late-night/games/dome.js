import {start,keepButton,el,button,group,canvas,output,box,dot,line,gradient} from './tools.js';
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
function disc(c,x,y,r,open,col){
  dot(c,'#534737',x,y,r+3);dot(c,col,x,y,r);circle(c,x,y,r-5,'#93866d');dot(c,'#bd9c63',x,y,3);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.strokeStyle='#c5b690';c.moveTo(x+Math.sin(a)*(r-5),y+Math.cos(a)*(r-5));c.lineTo(x+Math.sin(a)*(r-9),y+Math.cos(a)*(r-9));c.stroke();}
  for(const n of open){const [sx,sy]=spot(n,x,y,r);dot(c,'#282e2e',sx,sy,6);dot(c,'#ddc483',sx+1,sy,3.6);}
}
function visual(c,a,b,free){
  const lights=projection(a,b);gradient(c,'#111f30','#33484b');
  for(let i=0;i<46;i++)dot(c,'#71828866',(i*137+21)%640,13+(i*31)%161,0.9);
  c.save();c.translate(323,235);c.scale(1,.6);for(let i=0;i<3;i++)circle(c,0,0,208+i*9,'#536267');c.restore();
  for(let i=0;i<16;i++){const [x,y]=spot(i,318,123,110);dot(c,lights.includes(i)?'#eedb9f':'#6d8291',x,y,lights.includes(i)?4.5:2);
    if(lights.includes(i)){line(c,'#d5bd7d',1,[[x-8,y],[x+8,y]]);line(c,'#d5bd7d',1,[[x,y-8],[x,y+8]]);}
  }
  box(c,'#273537',0,232,640,88);for(let n=0;n<13;n++)line(c,'#4b514b',1,[[n*52,233],[n*49,319]]);
  disc(c,124,245,57,holes[0].map(v=>shift(v,a)),'#7e6950');disc(c,285,245,57,holes[1].map(v=>shift(v,b)),'#606a67');
  if(!free){
    box(c,'#ded1ad',459,191,138,101);for(let i=0;i<16;i++){const [x,y]=spot(i,529,240,47);dot(c,target.includes(i)?'#364750':'#b2ac96',x,y,target.includes(i)?3:1);}
    line(c,'#9b8e72',1,[[468,282],[583,282]]);
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
  }
  root.replaceChildren(view,req,map,board,tools,read);paint();
}
start(5,'dome-sky',['القبة ذات السماء الناقصة','The unfinished sky'],['أدر القرصين. يمر شعاع الضوء في المواضع التي تلتقي فيها فتحتان.','Rotate two punched discs. Light passes where two holes meet.'],render);
