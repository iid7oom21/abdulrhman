import {pulse} from './models.js';
import {surface,select,slider,action,shade,line,dot,ink,archive,output,playFrames} from './kit.js';
let sx=3,seat=0,curtain=false;
function knocks(r){
  const rate=16000,n=Math.ceil((r.echoMs/1000+.18)*rate),b=new ArrayBuffer(44+n*2),d=new DataView(b);
  const txt=(o,s)=>{for(let i=0;i<s.length;i++)d.setUint8(o+i,s.charCodeAt(i));};
  txt(0,'RIFF');d.setUint32(4,b.byteLength-8,true);txt(8,'WAVE');txt(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);
  d.setUint16(22,1,true);d.setUint32(24,rate,true);d.setUint32(28,rate*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);txt(36,'data');d.setUint32(40,n*2,true);
  for(let i=0;i<n;i++){
    const click=ms=>{const t=i/rate-ms/1000;return t<0?0:Math.exp(-110*t)*(Math.sin(2*Math.PI*t*700)+.3*Math.sin(2*Math.PI*t*1250));};
    d.setInt16(44+i*2,Math.round(16000*(click(r.directMs)+r.ratio*click(r.echoMs))),true);
  }
  return URL.createObjectURL(new Blob([b],{type:'audio/wav'}));
}
export default function echo(ui){
  const e=ui.editData;if(e&&Number.isFinite(e.sx)){sx=Math.min(21,Math.max(1,e.sx));seat=[0,1,2].includes(e.seat)?e.seat:0;curtain=e.curtain===true;}
  const {t}=ui,w=surface(ui),audio=document.createElement('audio');w.box.append(audio);let sound=false,url='',stop=()=>{},played=false;
  const convert=([x,y])=>[42+x*22,47+y*12];
  function paint(progress=1){
    const r=pulse(sx,seat,curtain),c=w.c;shade(c,'#293938','#132d31');
    c.fillStyle='#52615a';c.fillRect(32,31,560,154);c.fillStyle='#384b46';c.fillRect(39,39,546,139);
    for(let row=0;row<3;row++)for(let i=0;i<8;i++){c.fillStyle=row===seat?'#b2a17c':'#69746a';c.fillRect(134+i*43,61+row*35,16,12);c.fillRect(132+i*43,70+row*35,20,5);}
    const source=convert([r.sx,r.sy]),at=convert(r.receiver),ref=convert([24,r.wallY]);line(c,570,31,570,185,curtain?'#9c645c':'#cbb17e',curtain?13:4);
    const draw=(p,q,col)=>line(c,...p,...q,col,2);
    draw(source,at,'#ebd6a7');draw(source,ref,'#74c3bb');draw(ref,at,'#74c3bb');
    dot(c,...source,6,'#f4cf85');dot(c,...at,6,'#e9ead5');
    const ms=progress*170;
    const follow=(points,total,col)=>{let dist=Math.min(1,ms/total);const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));let remaining=dist*lengths.reduce((a,b)=>a+b,0);for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]||i===lengths.length-1){const n=Math.min(1,remaining/(lengths[i]||1));dot(c,...points[i].map((v,j)=>v+(points[i+1][j]-v)*n),4,col);break;}remaining-=lengths[i];}};
    follow([source,at],r.directMs,'#fff5d6');follow([source,ref,at],r.echoMs,'#9aeae0');
    const x=ms=>43+ms/170*540;line(c,43,268,583,268,'#adbaa8');
    for(const [ms,amp,col] of [[r.directMs,1,'#e7bf82'],[r.echoMs,r.ratio,'#6bc1b7']]){const xx=x(ms);line(c,xx-9,268,xx,268-48*amp,col,2.5);line(c,xx,268-48*amp,xx+8,276,col,2.5);line(c,xx+8,276,xx+13,268,col,2);}
    for(let i=0;i<=150;i+=25)ink(c,i+'',x(i),294,'#d9dbc8',13,'center');ink(c,'ms',610,294,'#d9dbc8',13);
    w.describe(t('الخط الذهبي للمباشر والفيروزي للانعكاس.','Gold shows the direct path and turquoise the reflection.'));
    w.canvas.dataset.gap=r.gap.toFixed(2);w.read.textContent=t('المباشر ','Direct ')+r.direct.toFixed(1)+' m / '+r.directMs.toFixed(0)+' ms · '+t('المنعكس ','Reflected ')+r.reflected.toFixed(1)+' m / '+r.echoMs.toFixed(0)+' ms · Δ '+r.gap.toFixed(0)+' ms · '+t('شدة الانعكاس ','Echo level ')+Math.round(r.ratio*100)+'%'+(played?' · '+(r.success?t('تميزت الطرقتان','Two distinct knocks'):t('لم يتحقق الفصل','Separation target missed')):'');
    return r;
  }
  function halt(){stop();audio.pause();if(url){URL.revokeObjectURL(url);url='';}}
  function change(){halt();played=false;paint();}
  const enable=action('sound',t('فعّل الصوت','Enable sound'),()=>{sound=!sound;if(!sound)halt();enable.textContent=sound?t('اكتم الصوت','Mute sound'):t('فعّل الصوت','Enable sound');enable.setAttribute('aria-pressed',String(sound));});enable.setAttribute('aria-pressed','false');
  w.controls.append(slider('source',t('المصدر · متر','Source position · m'),1,21,1,sx,v=>{sx=v;change();}),
    select('seat',t('مقعد الاستماع','Listener seat'),[[0,t('الأول','Front')],[1,t('الوسط','Middle')],[2,t('الأخير','Back')]],seat,v=>{seat=+v;change();}),
    select('curtain',t('ستارة الجدار','Wall curtain'),[[0,t('مفتوحة','Open')],[1,t('مغلقة','Closed')]],+curtain,v=>{curtain=!!+v;change();}));
  w.actions.append(action('run',t('أرسل طرقة','Send a knock'),()=>{
    halt();played=true;const r=paint(0);if(sound){url=knocks(r);audio.src=url;audio.play().catch(()=>{w.read.append(' '+t('تعذّر تشغيل الصوت.','Audio unavailable.'));});}
    ui.recordEvent({ar:'قيس فرق وصول الطرقتين عند '+Math.round(r.gap)+' ملي ثانية.',en:'Knock arrivals differed by '+Math.round(r.gap)+' ms.',data:{kind:'echo',gap:r.gap}});
    stop=playFrames(1050,paint);
  }),enable,action('save',t('احفظ خط الوصول','Save arrival line'),()=>archive(ui,w,'echo',t('اختبار الصدى','Echo test'),{sx,seat,curtain})),
    action('export',t('نزّل المخطط','Download diagram'),()=>output(w.canvas,'echo-arrivals')));
  paint();return halt;
}
