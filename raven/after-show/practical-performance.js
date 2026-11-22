import {el,button,select,range,number,setIn,path,line,ground,text,studio,resetControls} from './practical-tools.js';

const actions=[['النظرة','Gaze'],['الإشارة','Hand gesture'],['الخطوة','Step']];
const targets=[['المقعد','Chair'],['الساعة','Clock']];
const intentions=[['إتاحة المقعد','Offer a seat'],['طلب الانتظار','Ask to wait']];
const angles=[['من الصف الأول','Front row'],['من الممر','Side aisle']];
function circle(c,x,y,r,color){c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.fillStyle=color;c.fill();}
function layout(side){
  return side?{body:325,chair:247,clock:481,post:[252,294]}:{body:294,chair:143,clock:497,post:[574,615]};
}
function pose(s,time,side){
  const shot=layout(side),points=[shot.chair,shot.clock],toward=i=>Math.sign(points[s.targets[i]]-shot.body)||1;
  const progress=i=>Math.min(1,Math.max(0,(time-s.cues[i])/8));
  const body=shot.body+progress(2)*toward(2)*35,arm=progress(1),dx=toward(1);
  const hand=[body+dx*(14+arm*(side?52:69)),178-arm*(s.targets[1]?35:15)];
  const look=progress(0)*toward(0)*5;
  const x=points[s.targets[1]],visible=v=>v<shot.post[0]||v>shot.post[1];
  return {body,look,hand,arm,leg:progress(2),shot,points,handVisible:visible(hand[0]),propVisible:visible(x)};
}
function drawStage(c,s,time,view,t){
  ground(c,'#bab9a7','#9a9b89');const p=pose(s,time,view);
  for(let i=0;i<3;i++){c.fillStyle=['#a5a796','#979b8c','#747f73'][i];c.fillRect(0,122+i*21,640,19);line(c,0,141+i*21,640,141+i*21,'#c9c6af',1);}
  path(c,[[0,188],[640,188],[640,310],[0,310]],'#b9a68b');
  for(let i=-1;i<8;i++)line(c,225+i*35,188,i*121,310,'#967f68',1);
  const [cx,kx]=p.points;
  c.save();c.fillStyle='rgba(64,54,39,.14)';c.beginPath();c.ellipse(cx+9,207,35,5,0,0,Math.PI*2);c.fill();c.beginPath();c.ellipse(p.body+8,219,38,5,0,0,Math.PI*2);c.fill();c.restore();
  c.fillStyle='#665440';c.fillRect(cx-20,173,42,9);c.fillRect(cx-20,141,6,36);c.fillRect(cx-19,143,33,8);
  line(c,cx-17,181,cx-22,207,'#655341',5);line(c,cx+16,181,cx+22,207,'#655341',5);
  line(c,kx,139,kx,194,'#565d51',4);circle(c,kx,123,19,'#404c43');circle(c,kx,123,15,'#e7dabc');
  line(c,kx,123,kx-6,116,'#65472e',2.7);line(c,kx,123,kx+8,121,'#65472e',2.7);
  const x=p.body;
  line(c,x,137,x,152,'#8c7356',6);circle(c,x,181,8,'#50594a');
  path(c,[[x-14,150],[x-7,146],[x+8,146],[x+15,152],[x+9,180],[x-9,180]],'#385447','#243b31',2);
  path(c,[[x-9,149],[x-6,147],[x-1,178],[x-8,178]],'#526b55');
  line(c,x-7,184,x-16-p.leg*8,216,'#37443e',7);line(c,x+7,184,x+17+p.leg*12,215,'#37443e',7);
  line(c,x-13,152,x-15,179,'#70513b',6);
  const elbow=[(x+p.hand[0])/2,164+(1-p.arm)*9];
  line(c,x+2,154,...elbow,'#395548',8);line(c,...elbow,...p.hand,'#987555',6);circle(c,...p.hand,4.5,'#c5a27d');
  circle(c,...elbow,3.7,'#ae936e');circle(c,x+2,154,4.3,'#748169');
  line(c,p.hand[0],p.hand[1],p.hand[0]+Math.sign(p.hand[0]-x)*7,p.hand[1]-1,'#a88a68',3);
  circle(c,x+p.look,131,14,'#9b7958');circle(c,x+p.look+(p.look<0?-5:5),129,2.2,'#3a392e');
  c.fillStyle='#7a8173';c.fillRect(p.shot.post[0],32,p.shot.post[1]-p.shot.post[0],185);
  c.fillStyle='#abb09e';c.fillRect(p.shot.post[0]+3,34,5,181);
  c.fillStyle='#34423b';c.fillRect(0,254,640,56);line(c,46,280,595,280,'#a9ac95',2);
  for(let i=0;i<3;i++){const at=46+s.cues[i]/60*548;circle(c,at,280,5+i,'#d7ae80');}
  const now=46+time/60*548;line(c,now,263,now,296,'#fff0cb',2);
  text(c,t(...angles[view]),607,25,15,'#344138','right');
}
export default function performanceRoom(ui){
  const {t}=ui,old=ui.load(ui.route,{})||{};
  const s={cues:[4,21,38].map((n,i)=>number(old.cues?.[i],0,50,n)),targets:[0,0,0].map((n,i)=>number(old.targets?.[i],0,1,n)),
    goal:number(old.goal,0,1,0),reading:number(old.reading,0,1,0),phase:setIn(old.phase,['edit','pass','viewer','done'],'edit'),view:number(old.view,0,1,0)};
  let selected=0,time=number(old.time,0,60,29),playing=false;
  const w=studio(ui,t('بروفة بلا حوار','Rehearsal without words'),t('أخرج نظرةً وإشارةً وخطوةً على خشبة صغيرة. شاهد الإشارة من مقعدين قبل أن تسلّم الجهاز ليقرأ مشاهد آخر قصدك.','Direct a gaze, a hand gesture and a step on a small stage. Check the gesture from two seats, then pass the device to a second viewer.'));
  const save=()=>ui.save(ui.route,{...s,time:Math.round(time)});
  function draw(){if(w.ctx)drawStage(w.ctx,s,time,s.view,t);w.canvas.dataset.time=String(Math.round(time));}
  function report(){
    if(s.phase==='pass'){w.describe(t('سلّم الجهاز للمشاهد. افتح البروفة عندما تكون جاهزًا.','Pass the device to the viewer. Open the rehearsal when ready.'));return;}
    if(s.phase==='done'){w.describe(t('قصد المخرج · ','Director’s intention · ')+t(...intentions[s.goal])+t(' / قراءة المشاهد · ',' / Viewer’s reading · ')+t(...intentions[s.reading]));return;}
    const p=pose(s,s.cues[1]+8,s.view);
    w.describe(t('عند اكتمال الإشارة · ','At the completed gesture · ')+(p.handVisible?t('الكف ظاهرة','hand visible'):t('القائم يحجب الكف','the column blocks the hand'))+' · '+(p.propVisible?t('الغرض ظاهر','prop visible'):t('الغرض محجوب','prop obscured'))+'.');
  }
  function change(){playing=false;w.stop();save();draw();controls();report();}
  function run(){
    if(playing){change();return;}
    playing=true;controls();w.play(6000,v=>{time=Math.round(v*60);draw();const input=w.controls.querySelector('[data-practical=time]');if(input){input.value=time;input.nextSibling.value=time;}},
      ()=>{playing=false;save();controls();report();});
  }
  function syncTime(){const e=w.controls.querySelector('[data-practical=time]');if(e){e.value=time;e.nextSibling.value=time;}}
  function controls(){
    const rows=[],primary=el('div',null,'pra-row');
    w.canvas.hidden=s.phase==='pass';w.canvas.parentElement.hidden=s.phase==='pass';
    if(s.phase==='pass'){
      const start=button('watch',t('افتح العرض للمشاهد','Open the viewer’s screening'),()=>{s.phase='viewer';time=0;change();});start.className='pra-main';
      resetControls(w.controls,start);return;
    }
    if(s.phase==='edit'){
      const aim=select('intent',t('قصد المخرج','Director’s intention'),intentions.map((n,i)=>[i,t(...n)]),s.goal,v=>{s.goal=+v;change();});
      const acts=el('div',null,'pra-row');
      actions.forEach((a,i)=>{const b=button('action-'+i,t(...a),()=>{selected=i;time=s.cues[i]+8;change();});b.setAttribute('aria-pressed',String(selected===i));acts.append(b);});
      rows.push(aim,acts,select('target',t('اتجاه الفعل','Action directed toward'),targets.map((n,i)=>[i,t(...n)]),s.targets[selected],v=>{s.targets[selected]=+v;time=s.cues[selected]+8;change();}),
        range('cue',t('موعد الحركة · عُشر ثانية','Cue in tenths of a second'),0,50,s.cues[selected],v=>{s.cues[selected]=v;time=v+8;playing=false;w.stop();save();draw();report();syncTime();}));
    }
    rows.push(select('angle',t('مقعد المشاهد','Audience seat'),angles.map((v,i)=>[i,t(...v)]),s.view,v=>{s.view=+v;change();}),
      range('time',t('إطار البروفة · عُشر ثانية','Playhead in tenths of a second'),0,60,time,v=>{time=v;playing=false;w.stop();save();draw();}));
    const play=button('replay',playing?t('أوقف العرض','Stop playback'):t('شغّل البروفة','Screen rehearsal'),run);play.className='pra-main';primary.append(play);
    if(s.phase==='edit')primary.append(button('pass',t('سلّم الجهاز','Pass the device'),()=>{s.phase='pass';time=0;change();}));
    if(s.phase==='viewer')intentions.forEach((g,i)=>primary.append(button('read-'+i,t(...g),()=>{s.reading=i;s.phase='done';change();})));
    if(s.phase==='done')primary.append(button('edit',t('عدّل الأداء','Revise performance'),()=>{s.phase='edit';change();}));
    resetControls(w.controls,...rows,primary);
  }
  controls();draw();report();
}
