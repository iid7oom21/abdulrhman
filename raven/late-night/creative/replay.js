import {mount} from '../night-shell.js';
import {cameraRun} from '../sims/camera-rules.js';
import {el,button,row,field,select,range,clock,surface,stage,link,output} from './kit.js';

let activeID=null,original=null,alternate=null,side='A',time=0,player,source;
function genuine(e){
  const r=e.data;
  if(e.activity!=='weightless-cam'||r?.kind!=='camera-run'||r.version!==1||!Array.isArray(r.pushes)||r.pushes.length>256||!Number.isFinite(r.duration)||r.duration<=0||r.duration>12||!Array.isArray(r.frames))return false;
  const expected=cameraRun(r.pushes,r.duration);
  return expected.frames.length===r.frames.length&&expected.frames.every((v,i)=>{
    const f=r.frames[i];return f&&['t','x','v','hold'].every(k=>Number.isFinite(f[k])&&Math.abs(f[k]-v[k])<.001);
  })&&Math.abs(expected.best-r.best)<.001;
}
function alternative(r){
  if(r.success)return {pushes:r.pushes.map(p=>({...p})),kind:'keep'};
  let winner={run:r,kind:'repeat'};
  function test(pushes,kind){
    const run=cameraRun(pushes,r.duration);
    if(run.best>winner.run.best+.001)winner={run,kind};
  }
  // First try moving one actual cue so the replay comparison preserves the other inputs.
  r.pushes.forEach((a,i)=>{
    for(let ts=0;ts<=r.duration;ts+=.25)test(r.pushes.map((p,j)=>j===i?{...p,t:ts}:p),'retime');
  });
  if(winner.run===r)for(let ts=.25;ts<=r.duration;ts+=.25){
    const nearest=r.frames[Math.round(ts*4)],dv=nearest.v>0?-4:4;test([...r.pushes,{t:ts,dv}],'add');
  }
  if(winner.run===r&&r.duration>=2.5)test([{t:0,dv:4},{t:2.5,dv:-4}],'pair');
  return {pushes:winner.run.pushes.map(p=>({...p})),kind:winner.kind};
}
function comments(r,t){
  const p=r.pushes[0],first=p?r.frames[Math.round(p.t*4)]:r.frames[0];
  let second=r.brakeAt===null?null:r.frames[Math.round(r.brakeAt*4)];
  if(!second||second.t===first.t)second=r.frames.reduce((a,b)=>b.hold>a.hold?b:a,r.frames[0]);
  if(second.t===first.t)second=r.frames.at(-1);
  const one=p?t('دفعت هنا','A push here')+' · '+(p.dv>0?'+':'')+p.dv+' m/s':t('بدأت الكاميرا بلا دفعة','The camera started without a push');
  const two=r.brakeAt===second.t?t('بدأت الفرملة هنا','Braking began here'):second.hold>0?t('ثبتت الكاميرا داخل الإطار','The camera held inside frame'):t('موضع الكاميرا في نهاية المحاولة','Camera position at the end');
  return [{f:first,label:one},{f:second,label:two}];
}
function drawTrack(canvas,r,sec,t){
  const c=canvas.getContext('2d');if(!c)return;
  const frame=r.frames[Math.min(r.frames.length-1,Math.round(sec*4))];
  const lo=Math.min(-2,...r.frames.map(f=>f.x)),hi=Math.max(15,...r.frames.map(f=>f.x));
  const x=time=>64+time/r.duration*550, y=position=>209-(position-lo)/(hi-lo)*152;
  c.fillStyle='#192020';c.fillRect(0,0,640,300);
  c.direction='ltr';c.textAlign='left';c.font='17px monospace';
  c.fillStyle='#e5dbcb';c.fillText(frame.t.toFixed(2)+' s',20,31);
  c.textAlign='right';c.fillText('x '+frame.x.toFixed(1)+' m    v '+frame.v.toFixed(1)+' m/s',614,31);
  c.fillStyle='#35423e';c.fillRect(x(0),y(12),550,y(8)-y(12));
  const interval=Math.max(2,Math.ceil((hi-lo)/4));
  c.font='15px monospace';
  for(let metres=Math.ceil(lo/interval)*interval;metres<=hi;metres+=interval){
    const line=y(metres);c.fillStyle='#49514e';c.fillRect(x(0),line,550,1);
    c.textAlign='right';c.fillStyle='#b9c1b5';c.fillText(metres+' m',54,line+5);
  }
  for(let tick=0;tick<=4;tick++){
    const seconds=tick*r.duration/4,px=x(seconds);
    c.fillStyle='#4c5651';c.fillRect(px,57,1,152);
    c.textAlign='center';c.fillStyle='#c9c8bc';c.fillText(Number(seconds.toFixed(2))+' s',px,237);
  }
  c.strokeStyle='#91a299';c.lineWidth=2;c.beginPath();
  r.frames.forEach((f,i)=>i?c.lineTo(x(f.t),y(f.x)):c.moveTo(x(f.t),y(f.x)));c.stroke();
  c.strokeStyle='#e1bd81';c.lineWidth=3;c.beginPath();
  for(const f of r.frames){if(f.t>frame.t)break;if(f.t===0)c.moveTo(x(f.t),y(f.x));else c.lineTo(x(f.t),y(f.x));}
  c.stroke();c.fillStyle='#ddbb83';c.fillRect(x(frame.t)-.7,53,1.4,162);
  c.beginPath();c.arc(x(frame.t),y(frame.x),4,0,Math.PI*2);c.fill();
  for(const push of r.pushes){const px=x(push.t);c.fillRect(px-1,204,2,10);}
  const ar=document.documentElement.lang==='ar';c.direction=ar?'rtl':'ltr';c.textAlign=ar?'right':'left';
  c.fillStyle='#c8c6b9';c.font='18px sans-serif';
  c.fillText(t('الشريط المظلل · مجال الثبات ٨–١٢ م','Shaded band · holding zone 8–12 m'),ar?614:64,276);
  canvas.setAttribute('aria-label',t('موضع الكاميرا','Camera position')+' '+frame.x.toFixed(1)+' m');canvas.dataset.time=frame.t;
  return frame;
}
mount({id:'replay-caller',title:['معلّق الإعادة','The replay commentator'],intro:['افتح آخر محاولة من كاميرا بلا وزن، وقف عند دفعاتها، ثم اختبر توقيتًا ثانيًا.','Open your latest weightless-camera run, pause at its cues and try another timing.'],render(ui){
  const {t,lang}=ui;player?.stop();const w=surface(ui);
  const record=ui.events().find(genuine);
  if(!record){w.append(el('p',t('أكمل جولة «كاميرا بلا وزن» أولًا حتى يتوفر سجل تقدر تعيده.','Finish a Weightless Camera run to make a replay available.')),link('./weightless-cam.html?lang='+lang,t('افتح الكاميرا','Open the camera')));return;}
  if(activeID!==record.id){activeID=record.id;original=null;alternate=null;side='A';time=0;}
  function open(){
    source=record;original=cameraRun(record.data.pushes,record.data.duration);build();
  }
  function build(){
    w.replaceChildren();
    if(!original){w.append(el('p',record[lang],'cr-read'),button('explain',t('فسّر لي آخر محاولة','Explain my last attempt'),open));return;}
    const run=side==='A'?original:alternate;
    const can=stage(t('إعادة حركة الكاميرا','Camera motion replay')),read=el('output',null,'cr-meter');
    const scr=range('seek',time,0,run.duration,.25,v=>player.seek(v)),play=button('play',t('شغّل الإعادة','Play replay'),()=>player.play());
    player=clock(()=>run.duration,(sec,on)=>{
      time=sec;scr.value=sec;drawTrack(can,run,sec,t);read.value=sec.toFixed(2)+' / '+run.duration+t(' ث',' s');play.textContent=on?t('توقّف هنا','Pause here'):t('شغّل الإعادة','Play replay');
    });
    w.append(can,row(play,read),field(t('موضع الإعادة','Replay position'),scr));
    if(alternate)w.append(row(...['A','B'].map(id=>{const b=button('version'+id,id==='A'?t('المحاولة المسجلة','Recorded take'):t('المحاولة الثانية','Second take'),()=>{player.stop();side=id;build();});b.setAttribute('aria-pressed',String(side===id));return b;})));
    w.append(el('h2',side==='A'?t('من سجل المحاولة','From the run log'):t('من محاكاة النسخة الثانية','From the second simulation')));
    comments(run,t).forEach((entry,i)=>{
      w.append(button('cue'+i,entry.label+' · '+entry.f.t.toFixed(2)+t(' ث',' s')+' · '+entry.f.x.toFixed(1)+' m',()=>player.seek(entry.f.t)));
    });
    const log=el('details'),summary=el('summary',t('سجل الدفعات والمواقع','Push and position log'));log.append(summary);
    const lines=run.pushes.map(p=>'t '+p.t.toFixed(2)+t(' ث',' s')+' · x '+run.frames[Math.round(p.t*4)].x.toFixed(1)+' m · Δv '+(p.dv>0?'+':'')+p.dv+' m/s');
    log.append(el('p',lines.join('\n')||t('لم تُسجّل دفعات.','No pushes were recorded.'),'cr-read'));w.append(log);
    const proposal=alternative(original);
    const copy={keep:['حافظت على الكاميرا داخل الهدف ثانيتين. كرّر الدفعات لتفهم هذا القرار الناجح.','You held the frame for two seconds. Replay those same pushes to inspect the successful choice.'],repeat:['جرّب الدفعات نفسها في نسخة منفصلة.','Repeat these pushes in a separate take.'],retime:['جرّب تحريك دفعة واحدة في الزمن.','Try moving one push in time.'],add:['جرّب دفعة إضافية لتثبيت الكاميرا.','Try an additional push to steady the camera.'],pair:['جرّب دفعة انطلاق ثم فرملة في نسخة ثانية.','Try a launch followed by braking in a second take.']};
    w.append(el('p',t(...copy[proposal.kind]),'cr-read'),button('try',t('جرّب الاقتراح في نسخة ثانية','Try the suggestion in take B'),()=>{
      player.stop();alternate=cameraRun(proposal.pushes,original.duration);side='B';time=0;
      ui.recordEvent({ar:'قورنت محاولتان للكاميرا، بزمن ثبات '+original.best.toFixed(2)+' و'+alternate.best.toFixed(2)+' ثانية.',en:'Two camera takes were compared, with stable holds of '+original.best.toFixed(2)+' and '+alternate.best.toFixed(2)+' seconds.',data:{kind:'camera-compare',sourceId:source.id,bestA:original.best,bestB:alternate.best}});build();
    }));
    if(alternate){const delta=alternate.best-original.best;w.append(el('p',t('أفضل ثبات','Longest hold')+' · A '+original.best.toFixed(2)+t(' ث',' s')+' / B '+alternate.best.toFixed(2)+t(' ث',' s')+' · Δ '+(delta>=0?'+':'')+delta.toFixed(2)+t(' ث',' s'),'cr-read'));}
    w.append(link('./weightless-cam.html?lang='+lang,t('العودة إلى الكاميرا','Return to camera')));player.seek(Math.min(time,run.duration));
  }
  build();
}});
window.addEventListener('pagehide',()=>player?.stop());
