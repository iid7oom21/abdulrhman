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
  const lo=Math.min(-2,...r.frames.map(f=>f.x)),hi=Math.max(15,...r.frames.map(f=>f.x)),x=m=>32+(m-lo)/(hi-lo)*576;
  const bg=c.createLinearGradient(0,0,640,300);bg.addColorStop(0,'#294552');bg.addColorStop(1,'#101f2b');c.fillStyle=bg;c.fillRect(0,0,640,300);
  c.fillStyle='#9cae8c45';c.fillRect(x(8),33,x(12)-x(8),190);c.strokeStyle='#72a6a0';c.lineWidth=1;c.strokeRect(x(8),32,x(12)-x(8),190);
  c.strokeStyle='#6b8085';c.beginPath();c.moveTo(32,174);c.lineTo(608,174);c.stroke();
  for(let i=Math.ceil(lo/2)*2;i<=hi;i+=Math.max(2,Math.ceil((hi-lo)/14))){c.strokeStyle='#879997';c.beginPath();c.moveTo(x(i),174);c.lineTo(x(i),181);c.stroke();}
  for(const p of r.pushes){const f=r.frames[Math.round(p.t*4)];c.fillStyle='#d29e6b';c.fillRect(x(f.x)-1,174,2,15);}
  c.fillStyle='#ecc391';c.fillRect(x(frame.x)-17,122,34,23);c.beginPath();c.moveTo(x(frame.x)+16,128);c.lineTo(x(frame.x)+29,122);c.lineTo(x(frame.x)+29,143);c.lineTo(x(frame.x)+16,137);c.fill();
  c.fillStyle='#c0d2c0';c.font='18px system-ui';c.textAlign='center';c.direction='ltr';c.fillText('8–12 m',x(10),62);c.fillText('x '+frame.x.toFixed(1)+' m    v '+frame.v.toFixed(1)+' m/s',320,248);
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
