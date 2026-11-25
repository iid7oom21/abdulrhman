import {surface,action,slider,element,output,archive,playFrames,quantity,isolate,updateReading} from './kit.js';
const W=580,H=254,win=[42,28,188,182],face=[371,61,89,92];
const studio='window-studio-v1',study='window-drawing-v1';
async function loadStudioNegative(){
  const stop=new AbortController();
  const timer=setTimeout(()=>stop.abort(),3500);
  let bitmap;
  try{
    const reply=await fetch(new URL('../assets/photo/darkroom-minute.webp',import.meta.url),{signal:stop.signal});
    if(!reply.ok) return null;
    bitmap=await createImageBitmap(await reply.blob());
    const film=document.createElement('canvas');film.width=W;film.height=H;
    const c=film.getContext('2d',{willReadFrequently:true}),scale=Math.max(W/bitmap.width,H/bitmap.height);
    const width=bitmap.width*scale,height=bitmap.height*scale;
    c.drawImage(bitmap,(W-width)/2,(H-height)/2,width,height);
    return c.getImageData(0,0,W,H);
  }catch{return null;}
  finally{clearTimeout(timer);bitmap?.close();}
}
let photograph=await loadStudioNegative();
let art=null,s={exposure:13,x:73,y:45,strength:0,negative:studio},pins=[null,null],view='live';
function drawing(){
  if(art)return art;
  const paper=document.createElement('canvas');paper.width=W;paper.height=H;const c=paper.getContext('2d',{willReadFrequently:true});
  const grad=c.createLinearGradient(0,0,W,H);grad.addColorStop(0,'#a09e91');grad.addColorStop(.54,'#595850');grad.addColorStop(1,'#302e2d');
  c.fillStyle=grad;c.fillRect(0,0,W,H);c.fillStyle='#46463e';c.fillRect(30,15,214,211);
  const glass=c.createLinearGradient(39,24,224,209);glass.addColorStop(0,'#f2f1db');glass.addColorStop(1,'#b1aca2');c.fillStyle=glass;c.fillRect(39,23,196,194);
  for(let i=0;i<15;i++){c.fillStyle=i%2?'#e0dfce':'#c1bfb0';const h=12+(i*27)%58;c.fillRect(42+i*13,182-h,12,h);}
  c.fillStyle='#66675b';c.fillRect(128,23,7,194);c.fillRect(38,106,197,6);
  c.fillStyle='#44433d';c.fillRect(18,216,234,8);c.fillStyle='#373733';c.fillRect(0,231,W,25);
  c.fillStyle='#55544b';c.beginPath();c.ellipse(415,215,91,53,0,0,7);c.fill();
  const head=c.createRadialGradient(390,83,9,423,119,68);head.addColorStop(0,'#aaa595');head.addColorStop(.46,'#777264');head.addColorStop(1,'#393a34');
  c.fillStyle=head;c.beginPath();c.ellipse(413,112,49,65,-.07,0,7);c.fill();
  c.fillStyle='#646358';c.fillRect(398,165,31,22);
  c.strokeStyle='#505046';c.lineWidth=3;
  for(const [x,y,l] of [[378,98,19],[417,98,20],[396,143,22]]){c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+l/2,y-3,x+l,y);c.stroke();}
  c.beginPath();c.moveTo(407,104);c.lineTo(401,127);c.lineTo(413,129);c.stroke();
  for(let i=0;i<11;i++){c.strokeStyle='rgba(36,39,33,.24)';c.lineWidth=1;c.beginPath();c.moveTo(376+i*5,63+i%3);c.quadraticCurveTo(365+i*8,115,384+i*5,155);c.stroke();}
  art=c.getImageData(0,0,W,H);return art;
}
function histogram(data,roi){
  const [lx,ly,w,h]=roi;let visible=0,min=255,max=0,edges=0;
  for(let y=ly;y<ly+h;y++)for(let x=lx;x<lx+w;x++){
    const i=(y*W+x)*4,n=data[i];if(n>12&&n<244)visible++;
    min=Math.min(min,n);max=Math.max(max,n);if(x>lx&&Math.abs(n-data[i-4])>=7)edges++;
  }
  return {range:max-min,detail:Math.round(100*visible/(w*h)),edges};
}
function print(cfg){
  const usePhoto=cfg.negative===studio&&photograph;
  const photo=usePhoto||drawing(),frame=new ImageData(W,H);const maskX=cfg.x/100*W,maskY=cfg.y/100*H;
  const exposure=cfg.exposure/13;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4,lum=photo.data[i]/255,noise=(((x*1297+y*3167+(x*y)%523)%13)-6)*.6;
    const mask=Math.max(0,1-((x-maskX)/96)**2-((y-maskY)/84)**2);
    const transmission=(1-lum*.92)**1.58,paper=Math.max(0,Math.min(255,325*Math.exp(-exposure*(1-mask*cfg.strength*.008)*3.3*transmission)-29+noise));
    frame.data[i]=paper;frame.data[i+1]=paper*.985;frame.data[i+2]=paper*.93;frame.data[i+3]=255;
  }
  return {frame,window:histogram(frame.data,win),face:histogram(frame.data,face),negative:usePhoto?studio:study};
}
const valid=data=>data&&Number.isFinite(data.exposure)?{exposure:Math.max(3,Math.min(45,data.exposure)),x:Math.max(0,Math.min(100,data.x??73)),y:Math.max(0,Math.min(100,data.y??45)),strength:Math.max(0,Math.min(100,data.strength??0)),negative:data.negative===studio?studio:study}:null;
export default function darkroom(ui){
  const {t}=ui,w=surface(ui);let cancel=()=>{},last;
  const pinnedFrames=new WeakMap();
  function readFrame(p){if(p===s)return print(s);if(!pinnedFrames.has(p))pinnedFrames.set(p,print(p));return pinnedFrames.get(p);}
  if(ui.editData?.print){s=valid(ui.editData.print)||s;view='live';}
  function display(){return view==='0'||view==='1'?(pins[+view]||s):s;}
  const compare=element('p',null,'sim-read sim-comparison'),pair=element('div',null,'sim-edit');w.box.append(compare,pair);
  const locale = t('ar-u-nu-arab', 'en');
  const percentage = new Intl.NumberFormat(locale, {style:'percent'});
  const percent = value => isolate(percentage.format(value/100));
  const range = value => isolate(value.toLocaleString(locale) + t(' من ٢٥٥',' of 255'));
  const exposure = value => isolate(quantity(ui.lang,value,0,t('ث','s')));
  function gallery(){
    pair.replaceChildren();
    if(!pins.every(Boolean))return;
    for(let i=0;i<2;i++){
      const fig=element('figure'),pic=element('canvas'),tag=element('figcaption',isolate(i?'B':'A')+' · '+exposure(pins[i].exposure));
      pic.width=W;pic.height=H;pic.setAttribute('role','img');pic.setAttribute('aria-label',t('النسخة ','Print ')+(i?'B':'A'));
      pic.getContext('2d').putImageData(readFrame(pins[i]).frame,0,0);fig.append(pic,tag);pair.append(fig);
    }
  }
  function paint(progress=1){
    const c=w.c;const f=last.frame;
    const tray=c.createLinearGradient(0,0,160,320);
    tray.addColorStop(0,'#61574a');tray.addColorStop(.22,'#272826');tray.addColorStop(1,'#161716');
    c.fillStyle=tray;c.fillRect(0,0,640,320);
    c.fillStyle='#111513';c.fillRect(14,13,612,293);
    c.fillStyle='#e4dfd2';c.fillRect(24,23,592,274);
    c.putImageData(f,30,31);if(progress<1){c.fillStyle='rgba(230,224,204,'+(1-progress)+')';c.fillRect(30,31,W,H);}
    updateReading(w.read, [
      t('مدى النافذة ', 'Window tonal span ') + range(last.window.range),
      t('بكسلاتها ذات تفصيل ', 'Unclipped window pixels ') + percent(last.window.detail),
      t('مدى الوجه ', 'Face tonal span ') + range(last.face.range),
      t('بكسلاته ذات تفصيل ', 'Unclipped face pixels ') + percent(last.face.detail)
    ].join(' · '));
    w.canvas.dataset.win=last.window.range;w.canvas.dataset.face=last.face.range;w.canvas.dataset.negative=last.negative;
    w.describe(last.negative===studio
      ? t('طبعة رأس جبسي قرب نافذة الميناء. القياسان من بكسلات النافذة والوجه.','A plaster head beside the harbour window. The two readings sample the window and face pixels.')
      : t('طبعة من الرسم التدريبي للنافذة والدمية.','A print from the illustrated window and mannequin study.'));
  }
  function refresh(){last=readFrame(display());paint();comp();}
  function comp(){
    const parts = pins.map((pin,i)=>{
      const label = t('الطبعة ', 'Print ') + isolate(i?'B':'A');
      if (!pin) return label+' —';
      const result = readFrame(pin);
      return [label, exposure(pin.exposure), t('النافذة ', 'Window ')+percent(result.window.detail),
        t('الوجه ', 'Face ')+percent(result.face.detail)].join(' · ');
    });
    compare.textContent=parts.join('\n');
    for(let i=0;i<2;i++){const b=w.actions.querySelector('[data-sim="see'+i+'"]');if(b){b.disabled=!pins[i];b.setAttribute('aria-pressed',String(view===String(i)));}}
  }
  function adjust(k,v){cancel();s[k]=v;view='live';refresh();}
  w.controls.append(slider('time',t('تعريض الورقة · ث','Paper exposure · s'),3,45,1,s.exposure,v=>adjust('exposure',v)),
    slider('mask',t('تخفيف التعريض تحت القناع %','Mask reduction %'),0,100,1,s.strength,v=>adjust('strength',v)),
    slider('x',t('أفقي القناع %','Mask across %'),0,100,1,s.x,v=>adjust('x',v)),slider('y',t('رأسي القناع %','Mask down %'),0,100,1,s.y,v=>adjust('y',v)));
  const act=(id,a,b,fn)=>action(id,t(a,b),fn);
  w.actions.append(act('develop','حمّض الورقة','Develop print',()=>{cancel();view='live';last=print(s);const seconds=s.exposure;
      cancel=playFrames(1600,paint,()=>ui.recordEvent({
        ar:'حُمّضت طبعة النافذة والدمية بتعريض '+seconds+' ثانية.',
        en:'The window and mannequin print developed at '+seconds+' seconds.',
        data:{kind:'darkroom',exposure:seconds,window:last.window.detail,face:last.face.detail}
      }));comp();}),
    ...[0,1].flatMap(i=>[action('pin'+i,t('ثبّت ','Pin ')+(i?'B':'A'),()=>{pins[i]={...display(),negative:last.negative};comp();gallery();}),
      action('see'+i,t('اعرض ','View ')+(i?'B':'A'),()=>{cancel();view=String(i);refresh();})]),
    act('live','الطبعة الجارية','Working print',()=>{cancel();view='live';refresh();}),
    act('save','احفظ الطبعة المعروضة','Save displayed print',()=>archive(ui,w,'print',t('طبعة غرفة التحميض','Darkroom print'),{print:{...display(),negative:last.negative}})),
    act('export','نزّل الطبعة المعروضة','Download displayed print',()=>{const p=document.createElement('canvas');p.width=W;p.height=H;p.getContext('2d').putImageData(last.frame,0,0);output(p,'darkroom-print');}));
  if(!photograph&&s.negative===studio){
    const info=element('p',t('تعذّر تحميل صورة الاستوديو. يمكنك متابعة التحميض بالرسم التدريبي.','The studio still could not load. You can develop the illustrated study.'));
    info.setAttribute('role','status');
    const retry=act('retry-photo','أعد تحميل الصورة','Retry still',async()=>{
      retry.disabled=true;const loaded=await loadStudioNegative();
      if(loaded&&w.box.isConnected){photograph=loaded;cancel();view='live';refresh();info.remove();retry.remove();}
      retry.disabled=false;
    });
    w.actions.before(info);w.actions.prepend(retry);
  }
  refresh();gallery();return ()=>cancel();
}
