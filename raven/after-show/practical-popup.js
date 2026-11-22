import {el,button,select,range,number,path,line,ground,text,studio,resetControls} from './practical-tools.js';

const pieces=[['جدار النافذة','Window wall'],['السلم','Steps'],['الفاصل','Partition']];
const colors=['#86a199','#a29275','#6c817c'];
const lengths=[1.43,1.19,1.32],depths=[.78,.61,.72];
const positions=[-1.48,0,1.48];
const settings=old=>[0,1,2].map((_,i)=>({slot:number(old?.[i]?.slot,0,2,[0,0,2][i]),dir:old?.[i]?.dir===-1?-1:1}));
function tip(piece,i,degrees){
  const r=degrees*Math.PI/180*.60;
  return {x:positions[piece.slot],z:0,dx:Math.cos(r)*lengths[i]*piece.dir,dz:Math.sin(r)*lengths[i]};
}
function pointOf(seg,t){return [seg.x+seg.dx*t,seg.dz*t];}
function near(a,b,tol){
  // Thickness is measured on the cross section of two panels on the same page.
  for(let i=2;i<=24;i++)for(let j=2;j<=24;j++){
    const u=pointOf(a,i/24),v=pointOf(b,j/24);
    if(Math.hypot(u[0]-v[0],u[1]-v[1])<tol)return true;
  }
  return false;
}
function check(pieces,deg){
  const v=pieces.map((p,i)=>tip(p,i,deg));
  let collision=false,blocked=false;
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(near(v[i],v[j],.064))collision=true;
  // Inspect the window from the front: front-mounted pieces can cover its opening.
  const [x,z]=pointOf(v[0],.68);
  for(let i=1;i<3;i++)for(let j=1;j<=24;j++){
    const [otherX,otherZ]=pointOf(v[i],j/24);
    if(Math.abs(otherX-x)<.17 && Math.abs(otherZ-z)<.18)blocked=true;
  }
  return {collision,blocked};
}
function mechanism(pieces,angle){
  let hit=null;
  for(let a=4;a<=angle;a+=2)if(check(pieces,a).collision){hit=a;break;}
  const open=check(pieces,angle);return {hit,blocked:open.blocked,ok:hit===null&&!open.blocked};
}
function project(x,y,z){return [320+x*69+y*39,218+y*22-z*70-x*8];}
function draw(c,s,angle,sel,t){
  ground(c,'#45524b','#778076');
  const tilt=angle*Math.PI/180;
  const left=[[-2.9,-1.55,0],[2.9,-1.55,0],[2.9,1.55,0],[-2.9,1.55,0]];
  const top=left.map(([x,y])=>project(x,y,0));path(c,top,'#cfc0a1','#e1d5bc',2);
  const backY=-1.55-Math.sin(tilt)*1.35,backZ=(1-Math.cos(tilt))*1.12;
  path(c,[project(-2.9,-1.55,0),project(2.9,-1.55,0),project(2.9,backY,backZ),project(-2.9,backY,backZ)],'#b6b29e','#ddc5a4',2);
  for(let layer=1;layer<4;layer++)line(c,...project(-2.9,1.55,-layer*.025),...project(2.9,1.55,-layer*.025),'#a79b83',1);
  for(let i=-2;i<=2;i++)line(c,...project(i,-1.4,0),...project(i,1.42,0),'#bcb096',1);
  line(c,...project(-2.9,-1.55,.01),...project(2.9,-1.55,.01),'#8b806b',3);
  for(let i=0;i<50;i++){const x=-2.8+(i*13%50)/9,y=-1.45+(i*17%39)/14;line(c,...project(x,y,0),...project(x+.055,y,0),'#bbad91',.6);}
  for(let i=0;i<3;i++){
    const v=tip(s[i],i,angle),d=depths[i],offset=(i-1)*.16;
    function at(frac,y){const [x,z]=pointOf(v,frac);return project(x,y+offset,z);}
    path(c,[at(0,-d),at(0,d),at(1,d),at(1,-d)],colors[i],sel===i?'#eae1bd':'#48554c',2);
    if(i===0){
      path(c,[at(.48,-.40),at(.48,.40),at(.87,.40),at(.87,-.40)],'#45554c','#ede2c9',2);
      line(c,...at(.67,-.40),...at(.67,.40),'#dcd7be',2);
      line(c,...at(.48,0),...at(.87,0),'#dcd7be',2);
    }
    if(i===1)for(let k=1;k<7;k++)line(c,...at(k/7,-d),...at(k/7,d),'#eee0c7',2);
    if(i===2)for(let k=1;k<5;k++)line(c,...at(.08,-d+2*d*k/5),...at(.92,-d+2*d*k/5),'#85988a',1);
    line(c,...at(0,-d-.12),...at(0,d+.12),'#b25b43',3.5);
  }
  c.fillStyle='#283a32';c.fillRect(0,271,640,39);
  text(c,t('الكتاب مفتوح','Book opening'),600,298,15,'#e7d9be','right');
  text(c,Math.round(angle)+'°',37,297,19,'#e7d9be');
}
export default function popup(ui){
  const {t}=ui,raw=ui.load(ui.route,{})||{};
  const parts=settings(raw.pieces);let selected=number(raw.selected,0,2,0),goal=[90,120,150].includes(raw.goal)?raw.goal:120,angle=number(raw.angle,0,165,75);
  let result=raw.finished===true?mechanism(parts,goal):null,playing=false;
  const w=studio(ui,t('الغرفة التي تخرج من الكتاب','A room inside a book'),t('ركّب النافذة والسلم والفاصل على مفاصل الصفحة. اختبر فتح الكتاب للزاوية المطلوبة ثم إغلاقه، وراقب ممر الأجزاء وفتحة النافذة.','Fit a window, steps and partition on page hinges. Test the full opening and closing cycle at the requested angle and check the window’s aperture.'));
  function save(){ui.save(ui.route,{pieces:parts,selected,goal,angle:Math.round(angle),finished:!!result});}
  function paint(){if(w.ctx)draw(w.ctx,parts,angle,selected,t);w.canvas.dataset.angle=Math.round(angle);}
  function status(){
    const report=result||check(parts,angle),a=result?goal:angle;
    let s=t('زاوية ','Angle ')+Math.round(a)+'° · ';
    if(result)s+=result.hit==null?t('المسار حر عند الفتح والطي','Clear through opening and closing'):t('أول تلامس عند ','First contact at ')+result.hit+'°';
    else s+=report.collision?t('قطعتان تتلامسان','Two pieces touch'):t('المفاصل متباعدة','Panels are separated');
    s+=' · '+(report.blocked?t('قطعة تحجب فتحة النافذة','A panel covers the window opening'):t('فتحة النافذة ظاهرة','Window aperture visible'))+'.';
    w.canvas.dataset.cycle=result?(result.ok?'clear':'blocked'):'pending';w.describe(s);
  }
  function change(){playing=false;w.stop();result=null;save();paint();status();controls();}
  function cycle(){
    if(playing){change();return;}
    playing=true;result=null;controls();
    w.play(3600,v=>{
      angle=goal*(v<=.5?v*2:(1-v)*2);paint();
      const input=w.controls.querySelector('[data-practical=angle]');if(input){input.value=Math.round(angle);input.nextSibling.value=Math.round(angle);}
    },()=>{playing=false;angle=0;result=mechanism(parts,goal);save();paint();status();controls();});
  }
  function controls(){
    const selectPart=el('div',null,'pra-row'),options=el('div',null,'pra-row');
    pieces.forEach((name,i)=>{const b=button('piece-'+i,t(...name),()=>{selected=i;playing=false;w.stop();save();paint();controls();});b.setAttribute('aria-pressed',String(i===selected));selectPart.append(b);});
    const p=parts[selected];
    options.append(select('hinge',t('موضع المفصل','Hinge position'),[[0,t('الأيسر','Left')],[1,t('الوسط','Centre')],[2,t('الأيمن','Right')]],p.slot,v=>{p.slot=+v;change();}),
      select('fold',t('اتجاه الطي','Fold direction'),[[-1,t('نحو اليسار','Leftward')],[1,t('نحو اليمين','Rightward')]],p.dir,v=>{p.dir=+v;change();}),
      select('goal',t('زاوية التكليف','Required angle'),[90,120,150].map(x=>[x,x+'°']),goal,v=>{goal=+v;change();}));
    const scrub=range('angle',t('افتح الغلاف °','Open the cover °'),0,165,Math.round(angle),v=>{angle=v;playing=false;w.stop();result=null;save();paint();status();const b=w.controls.querySelector('[data-practical=replay]');if(b)b.textContent=t('اختبر الفتح والطي','Test open and close');});
    const play=button('replay',playing?t('أوقف الحركة','Stop cycle'):t('اختبر الفتح والطي','Test open and close'),cycle);play.className='pra-main';resetControls(w.controls,selectPart,options,scrub,play);
  }
  paint();status();controls();
}
