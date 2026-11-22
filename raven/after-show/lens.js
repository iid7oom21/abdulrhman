import {SHOTS} from './edit-rules.js';

function el(tag, text, css) {
  const item=document.createElement(tag);
  if(text!==null && text!==undefined) item.textContent=text;
  if(css) item.className=css;
  return item;
}
function control(key,label,action) {
  const button=el('button',label);
  button.type='button';button.dataset.lens=key;
  button.addEventListener('click',action);
  return button;
}
function picker(label,items,key,select) {
  const group=el('fieldset',null,'lens-group');
  group.append(el('legend',label));
  const controls=[];
  for(const [value,title] of items) {
    const button=control(key+'-'+value,title,()=>select(value));
    button.dataset.value=value;controls.push(button);group.append(button);
  }
  return {group,update:current=>controls.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===current)))};
}
function slider(label,key,min,max,step,apply) {
  const wrap=el('label',null,'lens-slider');
  const input=el('input');input.type='range';input.min=min;input.max=max;input.step=step;input.dataset.lens=key;
  const out=el('output');
  input.addEventListener('input',()=>apply(input.valueAsNumber));
  wrap.append(el('span',label),input,out);
  return {wrap,update(v){input.value=v;out.value=String(v);}};
}
function start(ui,title,intro) {
  const section=el('section',null,'lens-panel');
  section.append(el('h1',title),el('p',intro,'lens-intro'));
  ui.root.replaceChildren(section);
  return section;
}
const clamp=(v,min,max,defaultValue)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):defaultValue;

const looks={
  original:{words:['الأصل','Original'],exposure:0,contrast:100,saturation:100},
  print:{words:['طباعة باهتة','Faded print'],exposure:.3,contrast:78,saturation:63},
  silver:{words:['فضة أحادية','Silver monochrome'],exposure:.2,contrast:132,saturation:0},
  vivid:{words:['لون كثيف','Rich colour'],exposure:-.1,contrast:110,saturation:148},
};

function grading(ui) {
  const {t,lang}=ui;
  const old=ui.load('grade',null)||{};
  const state={shot:Object.hasOwn(SHOTS,old.shot)?old.shot:'lamp',exposure:clamp(old.exposure,-2,2,0),
    contrast:clamp(old.contrast,50,160,100),saturation:clamp(old.saturation,0,180,100),split:clamp(old.split,0,100,50)};
  let request=0,raw=null,buffer=null;
  const area=start(ui,t('غرفة التلوين','Colour grading suite'),t('قارن الأصل مع معالجتك على الصورة نفسها. اسحب حدّ المقارنة لرؤية أثر التعديل.','Compare the original and your grade on the same frame. Move the split to see the change.'));
  const figure=el('figure',null,'lens-figure');
  const canvas=el('canvas');canvas.width=640;canvas.height=360;
  canvas.setAttribute('role','img');
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const tag=el('figcaption',null,'lens-legend');
  tag.append(el('span',t('الأصل','Original')),el('span',t('المعالجة','Grade')));
  const status=el('p','', 'lens-status');status.setAttribute('role','status');
  const retry=control('retry-grade',t('أعد تحميل هذه اللقطة','Retry this shot'),acquire);retry.hidden=true;
  figure.append(canvas,tag);area.append(figure,status,retry);
  const shotSelect=picker(t('مصدر اللقطة','Source shot'),Object.entries(SHOTS).map(([id,v])=>[id,v.name[lang]]),'source',id=>{
    state.shot=id;save();acquire();
  });
  const presets=picker(t('نسخ التلوين','Grade presets'),Object.entries(looks).map(([id,v])=>[id,t(...v.words)]),'look',id=>{
    for(const field of ['exposure','contrast','saturation']) state[field]=looks[id][field];update();
  });
  const settings={};
  for(const [field,label,min,max,step] of [
    ['exposure',t('تعريض · EV','Exposure · EV'),-2,2,.1],
    ['contrast',t('تباين %','Contrast %'),50,160,1],
    ['saturation',t('تشبّع %','Saturation %'),0,180,1],
    ['split',t('حصة الأصل %','Original coverage %'),0,100,1],
  ]) settings[field]=slider(label,field,min,max,step,v=>{state[field]=v;update();});
  area.append(shotSelect.group,presets.group,...Object.values(settings).map(x=>x.wrap));
  function save(){ui.save('grade',state);}
  function sync() {
    shotSelect.update(state.shot);
    const selected=Object.entries(looks).find(([,v])=>v.exposure===state.exposure&&v.contrast===state.contrast&&v.saturation===state.saturation);
    presets.update(selected?.[0]);
    for(const [k,item] of Object.entries(settings)) item.update(state[k]);
    canvas.setAttribute('aria-label',SHOTS[state.shot].name[lang]+' · '+t('تعريض ','Exposure ')+state.exposure+' EV · '+t('حصة الأصل ','Original coverage ')+state.split+'%');
  }
  function draw() {
    if(!raw || !ctx || !buffer)return;
    const gain=2**state.exposure, contrast=state.contrast/100, sat=state.saturation/100;
    const split=Math.round(canvas.width*state.split/100);
    buffer.data.set(raw.data);
    for(let y=0;y<canvas.height;y++) for(let x=split;x<canvas.width;x++){
      const i=(y*canvas.width+x)*4;
      const l=.2126*raw.data[i]+.7152*raw.data[i+1]+.0722*raw.data[i+2];
      for(let c=0;c<3;c++) buffer.data[i+c]=(((l+(raw.data[i+c]-l)*sat)*gain)-127.5)*contrast+127.5;
    }
    ctx.putImageData(buffer,0,0);
    if(split>0 && split<canvas.width){ctx.fillStyle='#ffeed0';ctx.fillRect(split-1,0,2,canvas.height);}
  }
  function update(){sync();draw();save();}
  async function acquire() {
    sync();const token=++request;
    raw=null;buffer=null;retry.hidden=true;ctx?.clearRect(0,0,canvas.width,canvas.height);
    if(!ctx){status.textContent=t('الرسم غير متاح على هذا الجهاز.','Canvas is unavailable on this device.');return;}
    status.textContent=t('جارٍ فتح اللقطة…','Loading the shot…');
    const img=new Image();img.src=new URL(SHOTS[state.shot].image,import.meta.url).href;
    try {
      await img.decode();if(request!==token)return;
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      raw=ctx.getImageData(0,0,canvas.width,canvas.height);buffer=ctx.createImageData(raw.width,raw.height);
      draw();status.textContent='';
    } catch {
      if(request!==token)return;
      status.textContent=t('تعذّر تحميل اللقطة. إعدادات التلوين متاحة.','Shot unavailable. Your grade controls are available.');retry.hidden=false;
    }
  }
  ui.onCleanup(()=>{request++;raw=null;buffer=null;});
  acquire();
}

const cameraAngles={low:{words:['منخفضة','Low'],y:1.38},level:{words:['مستوى النظر','Eye level'],y:2.8},high:{words:['مرتفعة','High'],y:6.0}};
const shotSizes={wide:{words:['واسعة','Wide'],focal:420},medium:{words:['متوسطة','Medium'],focal:720},close:{words:['قريبة','Close'],focal:1340}};

// Project the same fixed set for every camera position; all geometry uses world units.
function projectSet(ctx,w,h,state) {
  const eye=[1.4,cameraAngles[state.angle].y,5.8],look=[0,1.07,0];
  function norm(v){const len=Math.hypot(...v);return v.map(n=>n/len);}
  function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function dot(a,b){return a.reduce((sum,n,i)=>sum+n*b[i],0);}
  const f=norm(look.map((a,i)=>a-eye[i])),r=norm(cross(f,[0,1,0])),u=cross(r,f);
  const focal=shotSizes[state.size].focal*(w/640);
  function point(p){
    const q=p.map((n,i)=>n-eye[i]),z=dot(q,f);
    return [w*(.5+state.shift/100)+focal*dot(q,r)/z,h*.50-focal*dot(q,u)/z,z];
  }
  const faces=[];
  function poly(points,color) {
    const pp=points.map(point);
    if(pp.every(v=>v[2]>.2)) faces.push({pp,color,z:pp.reduce((a,v)=>a+v[2],0)/pp.length});
  }
  function box(x,y,z,dx,dy,dz,palette) {
    const p=[[x,y,z],[x+dx,y,z],[x+dx,y,z+dz],[x,y,z+dz]];
    const top=p.map(([a,b,c])=>[a,b+dy,c]);
    poly(top,palette[0]);
    // Eye is on the positive x/z side of every object.
    poly([p[2],p[3],top[3],top[2]],palette[1]);
    const side=eye[0]>=x+dx?[1,2]:eye[0]<x?[3,0]:null;
    if(side) poly([p[side[0]],p[side[1]],top[side[1]],top[side[0]]],palette[2]);
  }
  const bg=ctx.createLinearGradient(0,0,w*.8,h);
  bg.addColorStop(0,'#293f42');bg.addColorStop(.55,'#596560');bg.addColorStop(1,'#253331');
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  box(-1.8,.72,-1.03,3.6,.23,2.06,['#77654d','#514433','#584b39']);
  for(const [x,z] of [[-1.55,-.78],[1.39,-.78],[-1.55,.68],[1.39,.68]]) box(x,-.8,z,.16,1.52,.16,['#655944','#433b2e','#544a37']);
  // Lamp in the background provides a second depth cue beside the envelope.
  box(-1.4,.95,-.88,.45,.06,.45,['#5b6352','#373c33','#434b3c']);
  box(-1.20,1,-.68,.06,.63,.06,['#beb8a1','#777863','#8e8d74']);
  box(-1.44,1.61,-.91,.55,.27,.49,['#d1b88c','#bfa57e','#8e8067']);
  const paper=[[-.54,.977,-.25],[.65,.977,-.25],[.65,.977,.46],[-.54,.977,.46]];
  // Draw the desk and props first, then the envelope and its folded flap on top.
  faces.sort((a,b)=>b.z-a.z);
  function fill(pp,color) {
    ctx.beginPath();ctx.moveTo(pp[0][0],pp[0][1]);pp.slice(1).forEach(v=>ctx.lineTo(v[0],v[1]));ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  faces.forEach(({pp,color})=>fill(pp,color));
  const pp=paper.map(point);
  fill(pp,'#d9c5a0');
  fill([pp[0],pp[1],point([.055,.98,.20])],'#f0dcba');
  const xs=pp.map(v=>v[0]);const coverage=(Math.max(...xs)-Math.min(...xs))/w;
  const centre=xs.reduce((sum,x)=>sum+x,0)/(xs.length*w);
  if(state.grid) {
    ctx.strokeStyle='rgba(247,244,219,0.62)';ctx.lineWidth=1;ctx.setLineDash([5,5]);
    for(let i=1;i<3;i++){
      ctx.beginPath();ctx.moveTo(w*i/3,0);ctx.lineTo(w*i/3,h);ctx.moveTo(0,h*i/3);ctx.lineTo(w,h*i/3);ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  return {coverage:Math.round(coverage*100),centre};
}

function camera(ui) {
  const {t}=ui;
  const old=ui.load('camera',null)||{};
  const state={angle:Object.hasOwn(cameraAngles,old.angle)?old.angle:'level',size:Object.hasOwn(shotSizes,old.size)?old.size:'medium',
    shift:clamp(old.shift,-29,29,0),grid:old.grid!==false};
  const area=start(ui,t('مصمّم اللقطة','Camera shot designer'),t('حرّك الكاميرا حول مجسّم الطاولة. راقب عرض الظرف داخل الكادر وموقعه بالنسبة إلى خطوط الثلث.','Frame a tabletop model. Watch how much width the envelope occupies and where it sits across the thirds.'));
  const canvas=el('canvas',null,'lens-scene');canvas.width=640;canvas.height=360;canvas.setAttribute('role','img');
  const ctx=canvas.getContext('2d');
  const feedback=el('p','', 'lens-reading');feedback.setAttribute('aria-live','polite');
  const angle=picker(t('ارتفاع الكاميرا','Camera height'),Object.entries(cameraAngles).map(([k,v])=>[k,t(...v.words)]),'angle',key=>{state.angle=key;update();});
  const size=picker(t('حجم اللقطة','Shot size'),Object.entries(shotSizes).map(([k,v])=>[k,t(...v.words)]),'size',key=>{state.size=key;update();});
  const shift=slider(t('إزاحة الكادر %','Frame offset %'),'shift',-29,29,1,v=>{state.shift=v;update();});
  const grid=control('thirds',t('خطوط الأثلاث','Thirds grid'),()=>{state.grid=!state.grid;update();});
  area.append(canvas,feedback,angle.group,size.group,shift.wrap,grid);
  function render(){
    angle.update(state.angle);size.update(state.size);shift.update(state.shift);grid.setAttribute('aria-pressed',String(state.grid));
    if(!ctx){feedback.textContent=t('الرسم غير متاح على هذا الجهاز.','Canvas is unavailable on this device.');return;}
    const measured=projectSet(ctx,canvas.width,canvas.height,state);
    const third=measured.centre<1/3?t('الثلث الأيسر','left third'):measured.centre>2/3?t('الثلث الأيمن','right third'):t('الثلث الأوسط','middle third');
    feedback.textContent=t('عرض الظرف ','Envelope width ')+measured.coverage+t('٪ من الكادر. مركزه في ','% of the frame. Its centre sits in the ')+third+'.';
    canvas.setAttribute('aria-label',t(...cameraAngles[state.angle].words)+' · '+t(...shotSizes[state.size].words)+' · '+feedback.textContent);
    canvas.dataset.coverage=String(measured.coverage);
  }
  function update(){render();ui.save('camera',state);}
  render();
}

export default function mount(ui) {
  if(ui.route==='grade') grading(ui);
  else if(ui.route==='camera') camera(ui);
}
