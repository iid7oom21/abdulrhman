import {start,keepButton,el,button,group,canvas,output,box,dot,line,gradient} from './tools.js';
import {LENGTH,ORIGIN,PLATE,onPlate,positionAt,move,firstOpening} from './station-model.js';
let phase='idle',trace=[],runner={...ORIGIN},clock=0,started=0,raf=0,paintActive=null;
let outcome='',crossedAt=null,reviewing=false,restored=false;
const poi=(x,y)=>[66+85*x,158+47*y];
function station(c,player,ghost,open,showBag){
  gradient(c,'#132530','#43545a');dot(c,'#ebdeb3',515,38,18);
  for(let i=0;i<25;i++){const x=(i*73)%640,y=51+(i*17)%36;box(c,'#253941',x,y,31,68);box(c,'#e1bd72',x+7,y+8,3,6);}
  box(c,'#22363c',0,83,640,48);box(c,'#d7ab73',0,114,640,3);
  for(let x=15;x<640;x+=46){box(c,'#111f27',x,88,35,18);box(c,'#969f94',x+21,89,1,16);}
  box(c,'#5a5c56',0,131,640,9);box(c,'#373c3c',0,140,640,164);
  for(let i=0;i<8;i++)line(c,'#5c6059',1,[[24+i*85,141],[1+i*88,300]]);
  for(let i=0;i<4;i++)line(c,'#68685d',1,[[0,135+i*48],[640,135+i*48]]);
  for(let x=0;x<650;x+=12)box(c,'#bd985d',x,137,8,3);
  for(let x=-10;x<650;x+=150){
    line(c,'#1b2c30',6,[[x,134],[x,26],[x+42,9]]);line(c,'#26363a',4,[[x,47],[x+45,10]]);
    box(c,'#182b31',x+34,9,37,6);box(c,'#e2ca94',x+37,14,31,2);
  }
  const [px,py]=poi(PLATE.x,PLATE.y);
  box(c,'#182729',px-28,py-7,56,17);box(c,open?'#9ddebb':'#d9bb6a',px-25,py-6,50,12);
  for(let i=0;i<7;i++)line(c,'#536656',2,[[px-22+i*7,py+4],[px-17+i*7,py-4]]);
  const [doorX]=poi(5,1);
  box(c,'#263d40',doorX-13,139,26,161);box(c,'#bba87a',doorX-13,185,3,45);
  box(c,open?'#6b817b':'#b48662',doorX-12,open?179:185,24,open?5:46);
  if(!open)for(let y=188;y<230;y+=6)line(c,'#473c31',1,[[doorX-11,y],[doorX+11,y]]);
  const [ex,ey]=poi(6,1);box(c,'#242d30',ex-25,ey+4,50,10);
  line(c,'#c7b890',2,[[ex-16,ey+8],[ex+15,ey+8],[ex+8,ey+2]]);
  const person=(p,color,shadow,bag)=>{
    const [x,y]=poi(p.x,p.y);c.save();if(shadow)c.globalAlpha=.77;
    c.fillStyle='rgba(8,15,15,.4)';c.beginPath();c.ellipse(x+2,y+8,18,5,0,0,Math.PI*2);c.fill();
    line(c,color,4,[[x-1,y-2],[x-5,y+7]]);line(c,color,4,[[x+4,y-2],[x+7,y+7]]);
    box(c,color,x-6,y-17,14,17);dot(c,shadow?'#b6dcd4':'#cbad8c',x+1,y-22,5);
    if(bag){box(c,'#d39452',x+9,y-2,14,10);line(c,'#b47f4c',1,[[x+12,y-2],[x+12,y-5],[x+18,y-5],[x+18,y-2]]);}
    c.restore();
  };
  if(ghost)person(ghost,'#7bb3af',true,false);if(player)person(player,'#ebc785',false,showBag);
  for(let i=0;i<2;i++)line(c,'#152529',3,[[0,304+i*9],[640,304+i*9]]);
}
function render(ui){
  const {t,root}=ui;
  if(!restored){
    restored=true;const saved=ui.editData?.trace;
    if(Array.isArray(saved)&&saved.length>0&&saved.length<=10000&&saved.every((p,i)=>p&&Number.isInteger(p.ms)&&p.ms>=0&&p.ms<=LENGTH&&(!i||p.ms>=saved[i-1].ms)&&Number.isInteger(p.x)&&p.x>=0&&p.x<=6&&Number.isInteger(p.y)&&p.y>=0&&p.y<=2)){
      trace=saved.map(({x,y,ms})=>({x,y,ms}));phase='ready';reviewing=true;
    }
  }
  const view=canvas(t('محطة البريد. الدواسة في الخط العلوي والباب في الخط الأوسط.','Mail platform. Pedal on the upper lane, door on the middle lane.'));
  view.dataset.game='station-view';
  const c=view.getContext('2d'),read=output(),timer=el('output'),meter=el('progress'),clockBox=el('div',null,'game-clock');
  meter.max=LENGTH;clockBox.append(timer,meter);
  const row=el('div',null,'game-controls'),directions=el('div',null,'game-controls station-movement'),details=el('div');
  const positions=[['left','←',-1,0],['up','↑',0,-1],['down','↓',0,1],['right','→',1,0]];
  directions.dir='ltr';
  function step(dx,dy){
    if(!['record','play'].includes(phase))return;
    const now=Math.min(LENGTH,Math.round(performance.now()-started));
    if(now>=LENGTH){tick();return;}
    const p=move(runner,dx,dy,phase==='play'&&onPlate(positionAt(trace,now)));
    if(p===runner)return;
    runner=p;if(phase==='record')trace.push({...p,ms:now});
    if(phase==='play'&&p.x===6&&p.y===1){
      crossedAt=now;clock=now;phase='won';outcome='win';cancelAnimationFrame(raf);
      ui.recordEvent({ar:'عبرت حقيبة البريد مع ظلك.',en:'You crossed with the mailbag and your shadow.',data:{seconds:+(now/1000).toFixed(2),steps:trace.length}});
      controls();
    }
    paint();
  }
  const keyhandler=e=>{if(e.target.matches('input,select,textarea'))return;const d=positions.find(([k])=>e.key.toLowerCase()==='arrow'+k);if(d&&['play','record'].includes(phase)){e.preventDefault();step(d[2],d[3]);}};
  if(render.keys)document.removeEventListener('keydown',render.keys);render.keys=keyhandler;document.addEventListener('keydown',keyhandler);
  positions.forEach(([key,label,x,y])=>{const b=button(key,label,()=>step(x,y));b.setAttribute('aria-label',t({left:'يسار',up:'فوق',down:'تحت',right:'يمين'}[key],key));directions.append(b);});
  function begin(next){
    cancelAnimationFrame(raf);clock=0;runner={...ORIGIN};reviewing=false;crossedAt=null;outcome='';
    if(next==='record')trace=[{...ORIGIN,ms:0}];phase=next;started=performance.now();controls();tick();
  }
  function tick(){
    if(phase!=='record'&&phase!=='play'&&phase!=='watch')return;
    clock=Math.min(LENGTH,performance.now()-started);
    if(clock>=LENGTH){
      if(phase==='play')outcome='timeout';phase='ready';controls();paint();return;
    }
    paint();raf=requestAnimationFrame(()=>paintActive.tick());
  }
  function paint(){
    const ghost=['play','watch','won'].includes(phase)||reviewing?positionAt(trace,clock):null;
    const door=!!ghost&&onPlate(ghost);view.dataset.phase=phase;view.dataset.door=door?'open':'closed';view.dataset.player=runner.x+','+runner.y;
    view.dataset.shadow=ghost?ghost.x+','+ghost.y:'';meter.value=clock;timer.textContent=(clock/1000).toFixed(1)+' / 10 s';
    station(c,phase==='watch'||reviewing?null:runner,ghost,door,phase==='play'||phase==='won');
    const msg=phase==='record'?t('يجري التسجيل. اصعد خطًا واحدًا ثم تحرّك يمينًا خانتين إلى الدواسة.','Recording. Move up one lane, then right two spaces to the pedal.'):phase==='play'?t('اعبر الخط الأوسط إلى اليمين عندما يقف الظل على الدواسة.','Cross the middle lane to the right when the shadow reaches the pedal.'):phase==='won'?t('وصلت الحقيبة عبر الباب في ','The mailbag crossed in ')+(crossedAt/1000).toFixed(1)+t(' ث.',' s.'):phase==='watch'?t('مراجعة حركة الظل المسجّلة.','Reviewing the recorded shadow.'):outcome==='timeout'?t('انتهت العشر ثوانٍ والحقيبة في المحطة. أعد العبور أو غيّر التسجيل.','Ten seconds passed with the bag still on the platform. Retry the crossing or replace the recording.'):trace.length?t('تسجيلك جاهز. اعبر بالحقيبة أو افحص الخط الزمني.','Your recording is ready. Cross with the bag or inspect the timeline.'):t('ابدأ تسجيل عشر ثوانٍ. الدواسة في الصف البعيد، والباب عند نهاية الصف الأوسط.','Record ten seconds. The pedal is on the far lane and the door ends the middle lane.');
    if(read.textContent!==msg)read.textContent=msg;
  }
  function controls(){
    row.replaceChildren();details.replaceChildren();directions.hidden=!['play','record'].includes(phase);
    if(phase==='record')return;
    if(phase==='play'||phase==='watch'){row.append(button('stop',t('أوقف المحاولة','Stop attempt'),()=>{cancelAnimationFrame(raf);phase='ready';outcome='';controls();paint();}));return;}
    if(trace.length){
      row.append(button('cross',t('اعبر مع الحقيبة','Cross with the bag'),()=>begin('play')),button('review',t('راجع التسجيل','Review timeline'),()=>{
        reviewing=!reviewing;clock=0;controls();paint();
      }));
      if(reviewing){
        const range=el('input');range.type='range';range.min=0;range.max=LENGTH;range.step=50;range.value=clock;range.dataset.game='scrub';range.setAttribute('aria-label',t('زمن المراجعة','Review time'));range.dir='ltr';
        range.oninput=()=>{clock=+range.value;paint();};
        const first=firstOpening(trace);
        const cue=el('p',first===null?t('التسجيل لا يلامس الدواسة.','The recording never touches the pedal.'):t('أول فتح عند ','First opening at ')+(first/1000).toFixed(2)+' s');
        cue.dataset.game='first-open';cue.dataset.ms=first??'';details.append(range,cue,button('watch',t('شغّل التسجيل','Replay recording'),()=>begin('watch')));
      }
    }
    row.append(button('record',trace.length?t('استبدل التسجيل','Replace recording'):t('سجّل عشر ثوانٍ','Record ten seconds'),()=>begin('record')));
    if(phase==='won')row.append(keepButton(ui,t('احتفظ ببطاقة العبور','Keep crossing card'),()=>({title:t('بطاقة عبور البريد','Mail crossing card'),type:'station-shadow',data:{crossedMs:crossedAt,trace:trace.map(v=>({...v}))}})));
  }
  root.replaceChildren(view,clockBox,read,row,directions,details);paintActive={tick};
  controls();paint();
}
start(1,'station-shadow',['عشر ثوانٍ في المحطّة','Ten seconds at the station'],['سجّل طريقًا لظلك ثم خذ حقيبة البريد عبر باب العربة.','Record a path for your shadow, then carry the mailbag through the carriage door.'],render);
