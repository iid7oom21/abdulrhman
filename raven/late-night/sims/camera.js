import {cameraRun,cameraStep} from './camera-rules.js';
import {surface,action,shade,line,dot,poly,ink,archive,output} from './kit.js';
let pushes=[],time=0,running=false,finished=false,timer=0,latest=null;
function stop(){running=false;clearInterval(timer);timer=0;}
export default function camera(ui){
  stop();const w=surface(ui),{t}=ui;
  if(Array.isArray(ui.editData?.pushes)){
    latest=cameraRun(ui.editData.pushes,ui.editData.duration);pushes=latest.pushes.slice();time=latest.duration;finished=true;
  }
  function paint(){
    const r=cameraRun(pushes,time),f=r.frames.at(-1),c=w.c;
    shade(c,'#14232f','#35464b');
    for(let i=0;i<60;i++)dot(c,(i*119+23)%640,(i*61+13)%182,i%3===0?1.4:.75,'#d5dacd');
    for(let i=0;i<5;i++)line(c,i*145-26,168,i*145+32,61,'#4e5e61',5);
    c.fillStyle='#c3a77e';c.fillRect(0,183,640,3);const xx=x=>Math.max(13,Math.min(627,76+x*28));
    c.strokeStyle='#e9c88d';c.lineWidth=2;c.setLineDash([6,5]);c.strokeRect(xx(8),69,xx(12)-xx(8),94);c.setLineDash([]);
    const pos=xx(f.x);poly(c,[[pos-15,105],[pos+13,105],[pos+13,131],[pos-15,131]],'#d8c8a6','#262a29');
    poly(c,[[pos+13,113],[pos+24,108],[pos+24,128],[pos+13,124]],'#899a93');
    if(f.v!==0)line(c,pos,141,Math.min(635,Math.max(5,pos+f.v*6)),141,'#ef9b71',3);
    ink(c,t('الموضع مع الزمن','Position over time'),604,214,'#e1d2b6',13,'right');
    line(c,33,288,605,288,'#758782');line(c,33,218,33,288,'#758782');
    const xs=a=>33+a.t/12*570,lo=Math.min(0,...r.frames.map(a=>a.x)),hi=Math.max(14,...r.frames.map(a=>a.x)),ys=a=>284-(a.x-lo)/(hi-lo)*60;
    for(let i=1;i<r.frames.length;i++)line(c,xs(r.frames[i-1]),ys(r.frames[i-1]),xs(r.frames[i]),ys(r.frames[i]),'#efc68e',2.5);
    if(r.brakeAt!==null){const b=r.frames.find(v=>v.t===r.brakeAt);dot(c,xs(b),ys(b),4,'#ef9b71');}
    w.describe(t('الكادر بين ٨ و١٢ مترًا. أقصى سرعة للاستقرار ٢ م/ث.','Target frame 8–12 m. Maximum stable speed 2 m/s.'));
    w.read.textContent=t('الزمن ','Time ')+time.toFixed(2)+' s · x '+f.x.toFixed(2)+' m · v '+f.v+' m/s · '+t('أطول ثبات ','Longest hold ')+r.best.toFixed(2)+' s'
      +(finished?' · '+(r.success?t('اكتمل ثبات الثانيتين','Two-second hold met'):t('لم يكتمل ثبات الثانيتين','Two-second hold missed'))+' · '+(r.brakeAt===null?t('بلا فرملة','No braking'):t('أول فرملة ','First braking ')+r.brakeAt+' s'):'');
    w.canvas.dataset.x=f.x;w.canvas.dataset.hold=r.best;
    return r;
  }
  function end(){
    if(finished)return;stop();finished=true;latest=paint();
    ui.recordEvent({ar:'انتهت رحلة الكاميرا بثبات '+latest.best.toFixed(2)+' ثانية.',en:'The camera held its frame for '+latest.best.toFixed(2)+' s.',data:{kind:'camera-run',...latest}});buttons();
  }
  function step(){if(finished)return;time=Math.min(12,time+cameraStep);if(time>=12)end();else{paint();const b=w.actions.querySelector('[data-sim=finish]');if(b)b.disabled=false;}}
  function pulse(v){if(finished)return;pushes.push({t:time,dv:v});paint();}
  function buttons(){
    const focus=w.actions.contains(document.activeElement)?document.activeElement.dataset.sim:null;
    const add=(id,ar,en,fn,disabled=false)=>{const b=action(id,t(ar,en),fn);b.disabled=disabled;return b;};
    const replay=document.createElement('a');replay.href='./replay-caller.html?lang='+ui.lang;replay.textContent=t('فسّر لي آخر محاولة','Explain my last take');
    w.actions.replaceChildren(add('run',running?'إيقاف مؤقت':'شغّل الكاميرا',running?'Pause':'Run camera',()=>{if(running)stop();else{running=true;timer=setInterval(step,250);}buttons();},finished),
      add('step','تقدم ٠٫٢٥ ث','Step 0.25 s',()=>{stop();step();buttons();},finished),
      ...[4,-4,1,-1].map(v=>add('push'+v,(v>0?'دفعة +':'دفعة ')+v,'Push '+(v>0?'+':'')+v,()=>pulse(v),finished)),
      add('finish','أنهِ المحاولة','Finish take',end,finished||time===0),
      add('again','محاولة جديدة','New take',()=>{stop();time=0;pushes=[];finished=false;paint();buttons();}));
    if(finished)w.actions.append(replay,add('save','احفظ مسار الرحلة','Save path',()=>archive(ui,w,'camera-run',t('مسار الكاميرا','Camera path'),latest)),
      add('export','نزّل الرسم','Download path',()=>output(w.canvas,'camera-path')));
    if(focus){const target=[...w.actions.querySelectorAll('button')].find(b=>b.dataset.sim===focus&&!b.disabled);(target||w.actions.querySelector('a'))?.focus({preventScroll:true});}
  }
  function hide(){if(document.hidden&&running){stop();buttons();}}
  document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',stop);
  paint();buttons();
  return ()=>{stop();document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',stop);};
}
