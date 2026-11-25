import {makeStationScene} from './station-scene.js';
import {start,keepButton,el,button,canvas,output} from './tools.js';
import {LENGTH,ORIGIN,onPlate,positionAt,move,firstOpening} from './station-model.js';
let phase='idle',trace=[],runner={...ORIGIN},clock=0,started=0,raf=0;
let outcome='',crossedAt=null,reviewing=false,restored=false;
function render(ui){
  const {t,root}=ui;
  if(!restored){
    restored=true;const saved=ui.editData?.trace;
    if(Array.isArray(saved)&&saved.length>0&&saved.length<=10000&&saved.every((p,i)=>p&&Number.isInteger(p.ms)&&p.ms>=0&&p.ms<=LENGTH&&(!i||p.ms>=saved[i-1].ms)&&Number.isInteger(p.x)&&p.x>=0&&p.x<=6&&Number.isInteger(p.y)&&p.y>=0&&p.y<=2)){
      trace=saved.map(({x,y,ms})=>({x,y,ms}));phase='ready';reviewing=true;
    }
  }
  const platformLabel=t('محطّة البريد. الدواسة في الصف البعيد والباب في الصف الأوسط.','Mail platform. Pedal on the far lane and gate on the middle lane.');
  const view=canvas(platformLabel);
  view.dataset.game='station-view';
  const read=output(),timer=el('output'),meter=el('progress'),clockBox=el('div',null,'game-clock');
  const retryArt=button('station-retry-image',t('أعد تحميل صورة المحطّة','Reload station artwork'),()=>scene.retry());
  const scene=makeStationScene(view,()=>{
    retryArt.hidden=!scene.failed();paint();
  });
  retryArt.hidden=true;
  meter.max=LENGTH;clockBox.append(timer,meter);
  const row=el('div',null,'game-controls'),directions=el('div',null,'game-controls station-movement'),details=el('div');
  const positions=[['left','←',-1,0],['up','↑',0,-1],['down','↓',0,1],['right','→',1,0]];
  directions.dir='ltr';
  function step(dx,dy){
    if(document.hidden||!['record','play'].includes(phase))return;
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
  document.addEventListener('keydown',keyhandler);
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
    paint();raf=requestAnimationFrame(tick);
  }
  function paint(){
    const ghost=['play','watch','won'].includes(phase)||reviewing?positionAt(trace,clock):null;
    const door=!!ghost&&onPlate(ghost);view.dataset.phase=phase;view.dataset.door=door?'open':'closed';view.dataset.player=runner.x+','+runner.y;
    view.dataset.shadow=ghost?ghost.x+','+ghost.y:'';meter.value=clock;timer.textContent=(clock/1000).toFixed(1)+' / 10'+t(' ث',' s');
    const player=phase==='watch'||reviewing?null:runner;
    scene.draw(player,ghost,door,phase==='play'||phase==='won');
    const describe=p=>t('الخانة '+(p.x+1)+' من اليسار، الصف '+(p.y+1)+' من الخلف','column '+(p.x+1)+' from the left, lane '+(p.y+1)+' from the back');
    const label=[platformLabel,player&&t('موقعك ','Your position, ')+describe(player)+'.',
      ghost&&t('موقع الظل ','Shadow, ')+describe(ghost)+'.',door?t('الباب مفتوح.','Gate open.'):t('الباب مغلق.','Gate closed.')].filter(Boolean).join(' ');
    if(view.getAttribute('aria-label')!==label)view.setAttribute('aria-label',label);
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
        const cue=el('p',first===null?t('التسجيل لا يلامس الدواسة.','The recording never touches the pedal.'):t('أول فتح عند ','First opening at ')+(first/1000).toFixed(2)+t(' ث',' s'));
        cue.dataset.game='first-open';cue.dataset.ms=first??'';details.append(range,cue,button('watch',t('شغّل التسجيل','Replay recording'),()=>begin('watch')));
      }
    }
    row.append(button('record',trace.length?t('استبدل التسجيل','Replace recording'):t('سجّل عشر ثوانٍ','Record ten seconds'),()=>begin('record')));
    if(phase==='won')row.append(keepButton(ui,t('احتفظ ببطاقة العبور','Keep crossing card'),()=>({title:t('بطاقة عبور البريد','Mail crossing card'),type:'station-shadow',data:{crossedMs:crossedAt,trace:trace.map(v=>({...v}))}})));
  }
  const active = () => ['record','play','watch'].includes(phase);
  function suspend() {
    cancelAnimationFrame(raf);
    if (active()) clock = Math.min(LENGTH, performance.now() - started);
  }
  function resume() {
    if (document.hidden || !active()) return;
    cancelAnimationFrame(raf);
    started = performance.now() - clock;
    tick();
  }
  function visibility() { if (document.hidden) suspend(); else resume(); }
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('pageshow',resume);
  root.replaceChildren(view,clockBox,read,row,directions,details,retryArt);
  controls();paint();scene.load();resume();
  return () => {
    if (!document.hidden) suspend();
    document.removeEventListener('keydown',keyhandler);
    document.removeEventListener('visibilitychange',visibility);
    window.removeEventListener('pageshow',resume);
  };
}
start(1,'station-shadow',['عشر ثوانٍ في المحطّة','Ten seconds at the station'],['سجّل طريقًا لظلك ثم خذ حقيبة البريد عبر باب العربة.','Record a path for your shadow, then carry the mailbag through the carriage door.'],render);
