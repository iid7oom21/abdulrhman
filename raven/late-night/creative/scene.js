export const places={pier:['الرصيف','Pier'],cinema:['السينما','Cinema'],square:['الساحة','Square']};
export const lights={dusk:['ضوء الغروب','Dusk'],dim:['ضوء خافت','Dim'],amber:['مصباح كهرماني','Amber lamp']};
export const motions={still:['لقطة ثابتة','Locked shot'],walk:['خطوات عابرة','Walk through'],pan:['حركة أفقية','Tracking shot']};
const cues=['arrival','blackout','departure'];
const objectWords={ar:['تدخل الشخصية','تخفت اللوحة','تغادر الشخصية'],en:['The figure arrives','The sign goes dark','The figure departs']};
const phrases={pier:['عند الرصيف','on the pier'],cinema:['أمام شباك السينما','outside the box office'],square:['في ساحة الساعة','in the clock square']};
export function describe(s,i){return {ar:objectWords.ar[i]+' '+phrases[s.setting][0],en:objectWords.en[i]+' '+phrases[s.setting][1]};}
export function validScene(s){
  if(!s||s.version!==1||!Object.hasOwn(places,s.setting)||typeof s.prompt!=='string'||s.prompt.length>160||
    !Number.isInteger(s.duration)||s.duration<8||s.duration>15||!Number.isInteger(s.blackout)||s.blackout<2||s.blackout>s.duration-3||!Array.isArray(s.shots)||s.shots.length!==3)return false;
  let n=0;
  return s.shots.every((p,i)=>{
    if(!p||p.id!==cues[i]||p.start!==n||!Number.isInteger(p.seconds)||p.seconds<1||!Object.hasOwn(lights,p.lighting)||!Object.hasOwn(motions,p.motion))return false;
    n+=p.seconds;return true;
  })&&n===s.duration&&s.shots[1].start===s.blackout;
}
export function retime(s){
  const last=s.duration-s.blackout,middle=Math.max(1,Math.floor(last/2));
  const lengths=[s.blackout,middle,last-middle];let start=0;
  for(const [i,p] of s.shots.entries()){p.start=start;p.seconds=lengths[i];p.description=describe(s,i);start+=lengths[i];}
}
export function promptSetting(p){
  if(/رصيف|قطار|محطة|مرفأ|pier|train|station|harbou?r|dock/iu.test(p))return 'pier';
  if(/سينما|شباك|ستارة|سينم|cinema|screen|theat|ticket/iu.test(p))return 'cinema';
  if(/ساعة|ساح|نافورة|square|tower|clock|fountain/iu.test(p))return 'square';
  return null;
}
export function buildScene(input,setting){
  const p=String(input).trim().slice(0,160);if(!p||!Object.hasOwn(places,setting))return null;
  let seed=0;for(const ch of p)seed=(seed*31+ch.codePointAt(0))>>>0;
  const dim=/عتمة|خافت|dark|shadow|dim/iu.test(p),warm=/ذهبي|كهرماني|فانوس|golden|amber|lantern/iu.test(p);
  const walking=/يسير|يمشي|يمر|خطو|walk|cross/iu.test(p);
  const s={version:1,prompt:p,setting,duration:8+seed%8,blackout:3+(seed>>>3)%3,
    shots:cues.map((id,i)=>({id,lighting:[warm?'amber':dim?'dim':'dusk','dim',dim?'dusk':'amber'][i],motion:[walking?'walk':'pan','still','walk'][i]}))};retime(s);return s;
}
const paint=(c,col,x,y,w,h)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
function line(c,col,w,x,y,X,Y){c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.stroke();}
function circle(c,col,x,y,r){c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
export function paintScene(canvas,s,time){
  const c=canvas.getContext('2d');if(!c||!validScene(s))return null;
  const i=s.shots.findLastIndex(k=>time>=k.start),shot=s.shots[Math.max(0,i)],p=Math.max(0,Math.min(1,(time-shot.start)/shot.seconds));
  const shift=shot.motion==='pan'?p*42:0;
  c.save();c.scale(canvas.width/640,canvas.height/300);
  const bg=c.createLinearGradient(0,0,0,300),dim=shot.lighting==='dim',warm=shot.lighting==='amber';
  bg.addColorStop(0,dim?'#223644':warm?'#46454c':'#466675');bg.addColorStop(.72,dim?'#5c7379':warm?'#d0a271':'#f0c48e');bg.addColorStop(1,'#536d70');paint(c,bg,0,0,640,300);
  c.save();c.translate(-shift,0);const base=s.setting==='square'?165:180;
  for(let k=0;k<18;k++){const x=k*44-20,y=117+Math.sin(k*1.5)*22;
    paint(c,dim?'#48595b':'#677574',x,y,39,base-y);
    for(let j=0;j<3;j++)for(let h=0;h<4;h++)paint(c,(k+j+h)%5?'#8b9489':'#d7b685',x+4+j*11,y+6+h*10,4,4);}
  if(s.setting==='pier'){
    paint(c,'#6b8588',0,167,720,42);
    for(let k=0;k<17;k++)line(c,'#a1b1a1',1,k*41,178+k%5,k*41+21,178+k%5);
    paint(c,'#3f5150',0,202,720,9);
    for(let k=0;k<10;k++){paint(c,'#354749',k*85,169,4,70);line(c,'#4e5e59',2,k*85,181,k*85+85,181);}
  }else if(s.setting==='cinema'){
    paint(c,'#3f494c',67,77,500,127);paint(c,'#917c6a',59,82,522,8);paint(c,'#455255',138,114,347,91);
    for(let k=0;k<5;k++){paint(c,'#708282',151+k*65,131,53,61);line(c,'#a8a796',2,163+k*65,177,190+k*65,134);}
    paint(c,'#af8d69',52,199,531,6);
  }else{
    paint(c,'#6e6860',305,75,45,116);paint(c,'#8a8170',299,78,57,7);paint(c,'#777669',315,52,26,30);circle(c,'#dac9a0',328,103,13);
    line(c,'#4d5853',2,328,103,328,94);line(c,'#4d5853',2,328,103,336,106);
    for(let k=0;k<4;k++)line(c,'#c4b699',2,0,210+k*19,690,200+k*19);
  }
  paint(c,'#4c4b46',0,230,720,70);
  for(let k=0;k<15;k++)line(c,'#857860',1,k*63-90,300,k*49,232);
  const glow=c.createRadialGradient(132,96,2,132,96,93);glow.addColorStop(0,warm?'#ffc96aa0':'#dfb57c60');glow.addColorStop(1,'#dfb57c00');paint(c,glow,30,15,203,167);
  paint(c,'#303d40',129,95,5,135);circle(c,'#efe0ae',132,96,7);paint(c,'#303d40',112,86,40,5);
  const sx=s.setting==='cinema'?228:383;
  paint(c,'#2a393e',sx,81,137,39);paint(c,time>=s.blackout?'#314049':'#edca88',sx+5,86,127,29);
  if(time<s.blackout){for(let k=0;k<9;k++)paint(c,'#796e58',sx+15+k*12,97,6,7);}
  const x=shot.motion==='walk'?(i===0?140:370)+p*105:shot.motion==='pan'?331:361;
  const step=shot.motion==='walk'?Math.sin(p*Math.PI*8)*8:0;
  circle(c,'#2d393c',x,163,10);paint(c,'#2c3b40',x-11,174,23,38);
  line(c,'#29383c',6,x-6,208,x-10-step,235);line(c,'#29383c',6,x+5,208,x+9+step,235);
  c.restore();paint(c,'#121e26',0,0,640,13);paint(c,'#121e26',0,281,640,19);c.restore();return shot;
}
export function sceneThumbnails(s){
  if(!validScene(s))return [];
  return s.shots.map(p=>{const c=document.createElement('canvas');c.width=384;c.height=180;paintScene(c,s,p.start+p.seconds/2);return c.toDataURL('image/webp',.74);});
}
