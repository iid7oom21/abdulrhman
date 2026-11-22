// Original tabletop, laundry and theatre-plan exercises. Coordinates use a 640 × 340 stage.
const W=640,H=340;
const bounded=(value,fallback,min,max)=>Number.isFinite(value)?Math.round(Math.max(min,Math.min(max,value))):fallback;
function node(tag,text,cls) {
  const e=document.createElement(tag);
  if(text!==null && text!==undefined)e.textContent=text;
  if(cls)e.className=cls;
  return e;
}
function button(key,label,fn) {
  const b=node('button',label);b.type='button';b.dataset.sc=key;b.addEventListener('click',fn);return b;
}
function range(key,label,min,max,value,fn,step=1) {
  const box=node('label',null,'sc-range'),input=node('input'),out=node('output');
  input.type='range';input.min=min;input.max=max;input.step=step;input.value=value;input.dataset.sc=key;out.value=value;
  input.addEventListener('input',()=>{out.value=input.value;fn(input.valueAsNumber);});
  box.append(node('span',label),input,out);return box;
}
function menu(key,label,items,value,fn) {
  const box=node('label',null,'sc-menu'),select=node('select');
  select.dataset.sc=key;
  for(const [id,name] of items){const op=node('option',name);op.value=id;select.append(op);}
  select.value=value;select.addEventListener('change',()=>fn(select.value));box.append(node('span',label),select);return box;
}
function setup(ui,title,brief) {
  const panel=node('section',null,'sc-panel');
  const view=node('canvas',null,'sc-view');view.width=W;view.height=H;view.setAttribute('role','img');view.setAttribute('aria-label',title);
  const metrics=node('p',null,'sc-read');metrics.setAttribute('role','status');
  const actions=node('div',null,'sc-actions');
  panel.append(node('h1',title),node('p',brief,'sc-brief'),view,metrics,actions);ui.root.replaceChildren(panel);
  return {panel,view,c:view.getContext('2d'),metrics,actions,save:v=>ui.save(ui.route,v)};
}
function text(c,s,x,y,size,color,align='center'){
  c.save();c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.font=size+'px RavenArabic, sans-serif';c.fillText(s,x,y);c.restore();
}
function line(c,x1,y1,x2,y2,color,width=1) {c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineWidth=width;c.strokeStyle=color;c.stroke();}
function circle(c,x,y,r,color) {c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
// Stable canvas grain keeps paper, paint and glass consistent when a frame is revisited.
let grainTile;
function finishSurface(c,width,height) {
  if (!grainTile) {
    grainTile=document.createElement('canvas');grainTile.width=64;grainTile.height=64;
    const g=grainTile.getContext('2d'),tile=g.createImageData(64,64);
    let bits=1753;
    for(let i=0;i<tile.data.length;i+=4){
      bits=(Math.imul(bits,1664525)+1013904223)>>>0;
      const shade=bits>>>24;
      tile.data.set([shade,shade,shade,24],i);
    }
    g.putImageData(tile,0,0);
  }
  c.save();c.fillStyle=c.createPattern(grainTile,'repeat');c.fillRect(0,0,width,height);
  const falloff=c.createRadialGradient(width*.48,height*.48,width*.17,width*.5,height*.5,width*.76);
  falloff.addColorStop(0,'rgba(18,29,28,0)');falloff.addColorStop(1,'rgba(18,29,28,.25)');
  c.fillStyle=falloff;c.fillRect(0,0,width,height);c.restore();
}
function ellipse(c,x,y,rx,ry,color){
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();
}
function transport(ui,position,last,fps,paint,persist) {
  const {t}=ui,bar=node('div',null,'sc-transport');
  let frame=bounded(position,0,0,last),speed=1,timer=0,disposed=false;
  const stamp=node('output'),previous=button('previous',t('السابق','Previous'),()=>set(frame-1));
  const next=button('next',t('التالي','Next'),()=>set(frame+1));
  const play=button('play','',()=>{
    if(timer) {stop();return;}
    if(frame===last) frame=0;
    paint(frame);timer=window.setInterval(()=>{
      frame++;paint(frame);sync();
      if(frame===last)stop();
    },1000/(fps*speed));sync();
  });
  const scrub=node('input');scrub.type='range';scrub.min=0;scrub.max=last;scrub.step=1;scrub.dataset.sc='seek';
  scrub.setAttribute('aria-label',t('موضع المعاينة','Preview position'));
  scrub.addEventListener('input',()=>set(scrub.valueAsNumber));
  const rate=menu('speed',t('السرعة','Speed'),[['1','1×'],['0.35','0.35×']],'1',v=>{stop();speed=Number(v);});
  function sync(){stamp.value=(frame+1)+' / '+(last+1);scrub.value=frame;play.textContent=timer?t('أوقف مؤقتًا','Pause'):t('شغّل المعاينة','Play preview');previous.disabled=frame===0;next.disabled=frame===last;}
  function stop(){if(timer){clearInterval(timer);timer=0;if(!disposed)persist(frame);}sync();}
  function set(v){stop();frame=bounded(v,0,0,last);persist(frame);paint(frame);sync();}
  const onHide=()=>{if(document.hidden) stop();};
  document.addEventListener('visibilitychange',onHide);
  window.addEventListener('pagehide',stop);
  ui.onCleanup(()=>{stop();disposed=true;document.removeEventListener('visibilitychange',onHide);window.removeEventListener('pagehide',stop);});
  sync();bar.append(previous,play,next,rate,scrub,stamp);
  return {bar,get frame(){return frame;},set,stop};
}
const zone={x:258,y:178,w:170,h:65};
function droplets(state,frame) {
  const drops=[];
  const depth=state.depth/100;
  for(let i=0;i<state.count;i++) {
    let seed=(i+1)>>>0;
    seed=Math.imul(seed^(seed>>>16),0x45d9f3b)>>>0;
    seed=Math.imul(seed^(seed>>>16),0x45d9f3b)>>>0;
    seed^=seed>>>16;seed>>>=0;
    const phase=frame/10;
    const speed=20+((seed>>>11)%31)+18*depth;
    const y=((seed%390)+phase*speed)%390-18;
    const x=(((seed>>>4)%646+(state.slant/100)*y+660)%660)-8;
    drops.push({x,y,r:(2.4+((seed>>>14)%6))*(.58+1.65*depth)});
  }
  // One identifiable drop crosses the marked pane at frame 40 with a neutral wind.
  drops.push({x:192+state.slant*.65,y:110+(frame-40)*2.8,r:6+depth*6});
  return drops;
}
function rainVerdict(drops) {
  let covered=0,total=0;
  for(let y=zone.y+2;y<zone.y+zone.h;y+=4)for(let x=zone.x+2;x<zone.x+zone.w;x+=4){
    total++;if(drops.some(d=>((x-d.x)/d.r)**2+((y-d.y)/(d.r*1.35))**2<=1))covered++;
  }
  return {blocked:Math.round(covered/total*100),hit:drops.some(d=>Math.hypot(d.x-192,d.y-110)<=Math.max(10,d.r))};
}
function rainbox(ui){
  const {t}=ui,old=ui.load('rainbox',null)||{};
  const state={depth:bounded(old.depth,44,0,100),count:bounded(old.count,30,8,100),slant:bounded(old.slant,0,-55,55),frame:bounded(old.frame,0,0,80),capture:old.capture||null};
  const {panel,view,c,metrics,actions,save}=setup(ui,t('المطر داخل صندوق','Rain in a box'),t('التقط قطرة وسط الحلقة، مع بقاء ٨٥٪ من نافذة المرور مكشوفًا.','Capture a drop in the ring and keep at least 85% of the traffic window clear.'));
  const shot=node('p',null,'sc-result');shot.setAttribute('role','status');
  const backToCapture=button('revisit-capture',t('استعد إعدادات هذه اللقطة','Restore captured setup'),()=>{
    const r=state.capture;if(!r)return;
    for(const [key,min,max] of [['depth',0,100],['slant',-55,55],['count',8,100]]){
      state[key]=bounded(r[key],state[key],min,max);const input=actions.querySelector('[data-sc='+key+']');input.value=state[key];input.nextElementSibling.value=String(state[key]);
    }
    clock.set(r.frame);
  });
  function captureResult(){const r=state.capture;backToCapture.hidden=!r;if(!r||!Number.isInteger(r.frame)||!Number.isFinite(r.blocked)) {shot.textContent='';return;}
    shot.textContent=t('التقاط عند ','Capture at ')+(r.frame/10).toFixed(1)+t(' ث · حجب ',' s · covered ')+r.blocked+'% · '+(r.hit?t('قطرة داخل الحلقة','Drop in the ring'):t('الحلقة فارغة','Ring empty'))+' · '+(r.hit&&r.blocked<=15?t('اللقطة جاهزة','Shot approved'):t('جرّب لحظة أخرى','Try another instant'));}
  function paint(frame){
    const drops=droplets(state,frame);if(c){
    const grad=c.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#121f27');grad.addColorStop(1,'#53625b');c.fillStyle=grad;c.fillRect(0,0,W,H);
    // Painted shop fronts and traffic sit behind the glass and rain.
    for(let i=0;i<9;i++){const x=i*76-12;const top=45+(i*37)%76;c.fillStyle=['#283f43','#3d4842','#494b43'][i%3];c.fillRect(x,top,66,228-top);
      c.fillStyle='#dbc39a';for(let j=0;j<3;j++)if((i+j)%3)c.fillRect(x+9+j*15,top+14,8,15);}
    for(let i=0;i<9;i++){
      const x=i*76-12,top=45+(i*37)%76;
      line(c,x-2,top,x+68,top,'#778078',2);
      for(let j=0;j<3;j++){const wx=x+9+j*15;line(c,wx+4,top+14,wx+4,top+29,'#667069');}
      c.fillStyle=i%3===0?'#6e5542':'#525d50';c.fillRect(x+2,161,62,36);
      c.fillStyle=i%3===0?'#b09364':'#778675';c.fillRect(x+6,168,22,25);c.fillRect(x+33,168,24,25);
      line(c,x-1,164,x+65,164,'#b3b39a',3);
    }
    c.fillStyle='#1e302f';c.fillRect(0,228,W,112);
    for(let i=0;i<34;i++){const x=(i*121)%W;line(c,x,242+(i*13)%83,x+8+i%31,242+(i*13)%83,i%3?'#37504b':'#6e7058',1);}
    for(const x of [115,472]){
      line(c,x,194,x,131,'#172929',3);line(c,x,131,x+14,131,'#223331',3);
      const glow=c.createRadialGradient(x+14,133,1,x+14,133,30);
      glow.addColorStop(0,'#dcc08e99');glow.addColorStop(1,'#c1ad7400');
      c.fillStyle=glow;c.fillRect(x-16,103,60,60);ellipse(c,x+14,133,4,2,'#f1dcb7');
    }
    for(let k=0;k<3;k++){const x=(frame*4+k*235)%750-78;const y=210+k*6;c.fillStyle='#74857c';c.fillRect(x,y,68,19);c.fillRect(x+12,y-10,32,12);circle(c,x+12,y+18,6,'#111d21');circle(c,x+53,y+18,6,'#111d21');c.fillStyle='#f1dda4';c.fillRect(x+60,y+3,9,5);}
    for(const x of [15,512]){c.fillStyle='#192b2c';c.fillRect(x,0,10,H);}
    for(const d of drops){c.beginPath();c.ellipse(d.x,d.y,d.r,d.r*1.35,0,0,Math.PI*2);c.fillStyle='rgba(125,170,169,.48)';c.fill();c.strokeStyle='#adc8bf';c.lineWidth=.9;c.stroke();circle(c,d.x-d.r*.27,d.y-d.r*.58,Math.max(1,d.r*.18),'#fae2af');}
    finishSurface(c,W,H);c.setLineDash([7,5]);c.strokeStyle='#e7c686';c.lineWidth=2;c.strokeRect(zone.x,zone.y,zone.w,zone.h);c.beginPath();c.arc(192,110,15,0,Math.PI*2);c.stroke();c.setLineDash([]);}
    const r=rainVerdict(drops);metrics.textContent=t('نافذة المرور مكشوفة بنسبة ','Traffic window clear ')+(100-r.blocked)+'% · '+(r.hit?t('قطرة في الحلقة','Drop in ring'):t('الحلقة فارغة','Ring empty'));
    view.setAttribute('aria-label',metrics.textContent);
  }
  const clock=transport(ui,state.frame,80,10,paint,f=>{state.frame=f;save(state);});
  for(const [id,label,min,max] of [['depth',t('عمق المطر','Rain depth'),0,100],['slant',t('ميل المطر','Drift'),-55,55],['count',t('كثافة القطرات','Drop count'),8,100]]){
    actions.append(range(id,label,min,max,state[id],v=>{state[id]=v;save(state);paint(clock.frame);}));
  }
  const snap=button('capture',t('التقط هذه اللحظة','Capture this instant'),()=>{clock.stop();state.capture={frame:clock.frame,depth:state.depth,count:state.count,slant:state.slant,...rainVerdict(droplets(state,clock.frame))};save(state);captureResult();});
  panel.append(clock.bar,snap,shot,backToCapture);paint(state.frame);captureResult();
}

const basePoses=[{stride:-16,lift:0},{stride:10,lift:16},{stride:32,lift:0}];
function poses(value){
  return basePoses.map((p,i)=>({stride:bounded(value?.[i]?.stride,p.stride,-40,40),lift:bounded(value?.[i]?.lift,p.lift,0,38)}));
}
function holds(value){const a=bounded(value?.[0],4,1,10),b=bounded(value?.[1],4,1,11-a);return [a,b,12-a-b];}
function poseIndex(frame,counts){return frame<counts[0]?0:frame<counts[0]+counts[1]?1:2;}
function foot(pose,index){const bodyX=75+index*17;
  return [{x:bodyX-22+pose.stride,y:pose.lift},{x:bodyX+24-pose.stride*.3,y:Math.max(0,12-pose.lift)}];}
function gaitReview(ps){
  let sliding=0,air=0;
  for(let i=0;i<3;i++){
    const current=foot(ps[i],i);if(current.every(p=>p.y>0))air++;
    if(i===0)continue;
    const prev=foot(ps[i-1],i-1);
    sliding+=current.filter((p,k)=>!p.y&&!prev[k].y&&Math.abs(p.x-prev[k].x)>4).length;
  }
  return {sliding,air};
}
function chair(c,x,y,w,h,frame,ps,counts,label){
  const i=poseIndex(frame,counts),p=ps[i],feet=foot(p,i),cx=75+i*17;
  c.save();c.translate(x,y);c.scale(w/200,h/170);
  const back=c.createLinearGradient(0,0,200,170);back.addColorStop(0,'#243a3b');back.addColorStop(1,'#617268');c.fillStyle=back;c.fillRect(0,0,200,170);
  c.fillStyle='#b4a68c';c.fillRect(0,129,200,41);for(let n=0;n<200;n+=16)line(c,n,135,n+5,135,'#ddd2b9',1);
  for(let k=0;k<7;k++)line(c,0,133+k*6,200,134+k*6,k%2?'#a4997e':'#c1b49a',.35);
  ellipse(c,cx+6,130,43,3.2,'#746b5666');
  // The rear pair is farther from the camera and moves with the front joints.
  line(c,cx-17,84,feet[0].x+6,125-feet[0].y,'#9a8161',3.4);
  line(c,cx+27,85,feet[1].x+6,125-feet[1].y,'#846e51',3.4);
  line(c,cx-23,56,cx+11,57,'#9a7856',4.4);
  line(c,cx-24,70,cx+13,70,'#a58662',4.4);
  line(c,cx-24,91,cx-28,42,'#573e2c',6);line(c,cx-28,45,cx+13,45,'#b49670',8);line(c,cx+13,45,cx+16,85,'#654c36',5);
  line(c,cx-21,89,feet[0].x,129-feet[0].y,'#68482e',6);line(c,cx+22,89,feet[1].x,129-feet[1].y,'#8c6141',6);
  line(c,cx-24,88,cx+25,88,'#d0a87d',9);
  line(c,cx-22,85,cx+23,86,'#e2c29a',1.3);
  line(c,cx-28,43,cx+12,44,'#d3ae7f',1.3);
  line(c,cx-21,89,feet[0].x+.7,128-feet[0].y,'#9d7350',1);
  line(c,cx+22,89,feet[1].x+.7,128-feet[1].y,'#b88a59',1);
  for(const dx of [-21,21])circle(c,cx+dx,88,1.3,'#68523b');
  finishSurface(c,200,170);
  feet.forEach(p=>{circle(c,p.x,129,p.y===0?3:1.6,p.y===0?'#204837':'#d3ceba');});
  text(c,label,100,153,9,'#253d36');c.restore();
}
function stopmotion(ui){
  const {t}=ui,o=ui.load('stopmotion',null)||{};
  const state={poses:poses(o.poses),holds:holds(o.holds),selected:bounded(o.selected,0,0,2),frame:bounded(o.frame,0,0,11),ref:o.ref?{poses:poses(o.ref.poses),holds:holds(o.ref.holds)}:null};
  const {panel,c,view,metrics,actions,save}=setup(ui,t('خطوة من اثنتي عشرة صورة','The twelve-frame step'),t('حرّك رجلَي الكرسي ثم وزّع ١٢ إطارًا على ثلاث وضعيات. النقطة الداكنة تعني تماس القدم بالأرض.','Pose the chair legs, then split twelve frames across three poses. A dark dot marks a planted foot.'));
  const editor=node('div',null,'sc-fields'),timeline=node('div',null,'sc-frames');
  function paint(f){const i=poseIndex(f,state.holds);
    if(c&&state.ref){chair(c,0,0,317,H,f,state.ref.poses,state.ref.holds,t('الأداء أ','Take A'));chair(c,323,0,317,H,f,state.poses,state.holds,t('الأداء ب','Take B'));c.fillStyle='#e6ddc5';c.fillRect(317,0,6,H);}
    else if(c)chair(c,0,0,W,H,f,state.poses,state.holds,t('الإطار ','Frame ')+(f+1));
    const audit=gaitReview(state.poses);
    metrics.textContent=t('الوضع ','Pose ')+(i+1)+' · '+t('انزلاقات قدم مثبتة ','planted-foot slips ')+audit.sliding+' · '+t('أوضاع بلا ارتكاز ','unsupported poses ')+audit.air;
    view.setAttribute('aria-label',metrics.textContent);
    for(let k=0;k<12;k++){const b=timeline.children[k];b.dataset.pose=poseIndex(k,state.holds);b.setAttribute('aria-pressed',String(f===k));}
  }
  const clock=transport(ui,state.frame,11,4,paint,f=>{state.frame=f;save(state);});
  function edit(){const i=state.selected;editor.replaceChildren();
    const initial=state.poses[i];for(const [id,label,min,max] of [['stride',t('امتداد الرجل','Leg reach'),-40,40],['lift',t('ارتفاع القدم','Foot height'),0,38]]){
      editor.append(range(id,label,min,max,initial[id],v=>{initial[id]=v;save(state);paint(clock.frame);}));}
    if(i<2) editor.append(range('hold',t('عدد إطارات الوضع','Pose holds'),1,i===0?10:11-state.holds[0],state.holds[i],v=>{
      state.holds[i]=v;state.holds=holds(state.holds);save(state);paint(clock.frame);holdLabel();
    }));
    holdLabel();
  }
  const distribution=node('output',null,'sc-dist');
  function holdLabel(){distribution.value=state.holds.join(' + ')+' = 12';}
  actions.append(menu('pose',t('الوضع الرئيسي','Key pose'),[0,1,2].map(i=>[i,String(i+1)]),state.selected,v=>{
    state.selected=Number(v);clock.set(state.holds.slice(0,state.selected).reduce((a,n)=>a+n,0));edit();
  }));
  for(let k=0;k<12;k++)timeline.append(button('frame-'+k,String(k+1),()=>clock.set(k)));
  panel.append(editor,distribution,timeline,clock.bar,button('keep-take',t('ثبّت هذا الأداء أ وقارنه بتعديلك','Keep take A and compare your edit'),()=>{
    state.ref={poses:structuredClone(state.poses),holds:[...state.holds]};save(state);paint(clock.frame);
  }));edit();paint(state.frame);
}

const spoken=[
  {start:0,end:2,ar:'ندى: تبغين الصندوق؟',en:'Nada: Do you want the box?'},
  {start:5,end:7,ar:'ليلى: خليه جنبي.',en:'Leila: Leave it beside me.'},
  {start:11,end:13,ar:'ندى: صار جاهز.',en:'Nada: It is ready.'},
];
const descriptions=[
  {action:'scarf',seen:2,ar:'الشال',en:'The scarf',options:[
    {id:'off',time:0,ar:'اترك فجوة',en:'Leave a gap'},
    {id:'short',time:1.5,ar:'تطوي ندى الشال.',en:'Nada folds the scarf.'},
    {id:'long',time:3,ar:'تطوي ندى الشال الأزرق على طاولة الفرز.',en:'Nada folds the blue scarf on the sorting table.'}
  ]},
  {action:'tag',seen:7,ar:'البطاقة',en:'The tag',options:[
    {id:'off',time:0,ar:'اترك فجوة',en:'Leave a gap'},
    {id:'short',time:2,ar:'تعلّق ليلى البطاقة.',en:'Leila attaches the tag.'},
    {id:'long',time:3.5,ar:'تعلّق ليلى بطاقة ورقية على سلة الملابس.',en:'Leila attaches a paper tag to the laundry basket.'}
  ]},
];
function cueAt(i,value){return descriptions[i].options.find(v=>v.id===value)||descriptions[i].options[0];}
function overlap(a,b){return Math.max(0,Math.min(a.end,b.end)-Math.max(a.start,b.start));}
function laundry(c,seconds){
  const g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,'#6b8581');g.addColorStop(.58,'#445754');g.addColorStop(1,'#344448');c.fillStyle=g;c.fillRect(0,0,W,H);
  for(const x of [70,214,358,502]){
    c.fillStyle='#81918a';c.fillRect(x-54,45,108,123);circle(c,x,107,39,'#c9d3bd');circle(c,x,107,33,'#304449');circle(c,x,107,25,'#566f70');
    c.beginPath();c.arc(x,107,19,seconds*1.2,seconds*1.2+Math.PI);c.strokeStyle='#889c94';c.lineWidth=3;c.stroke();
    line(c,x-43,62,x-16,62,'#b7c4af',3);
    c.strokeStyle='#9aaba0';c.strokeRect(x-52,47,104,119);
    line(c,x-50,71,x+50,71,'#9ba99c');
    line(c,x-49,158,x+49,158,'#b5c0a9',2);
    circle(c,x+37,58,3,'#d9d6bb');circle(c,x+26,58,2,'#4b6663');
    c.beginPath();c.arc(x,107,30,-Math.PI*.91,-Math.PI*.15);c.strokeStyle='#acc1ba';c.lineWidth=2.5;c.stroke();
    for(let k=0;k<6;k++)line(c,x-43+k*4,150,x-41+k*4,150,'#536963',1);
  }
  c.fillStyle='#3e4941';c.fillRect(0,198,W,142);c.fillStyle='#bbad90';c.fillRect(0,204,W,14);
  c.fillStyle='#92acaf';c.fillRect(105,seconds>=2?218:208,seconds>=2?64:145,seconds>=2?23:11);
  c.fillStyle='#896d4c';c.fillRect(294,164,117,61);c.strokeStyle='#bc9f73';c.lineWidth=3;c.strokeRect(294,164,117,61);
  for(let x=306;x<409;x+=17)line(c,x,167,x,224,'#c6ad84',2);
  for(let y=170;y<224;y+=9)line(c,295,y,409,y+1,'#9f845f',2);
  for(let x=305;x<400;x+=17)line(c,x,207,x+9,207,'#d0b581',1.4);
  for(let j=0;j<4;j++)line(c,109,seconds>=2?221+j*4:211+j,seconds>=2?162:244,seconds>=2?222+j*4:211+j,'#778f92',1);
  finishSurface(c,W,H);
  if(seconds>=7){c.fillStyle='#f1d49b';c.fillRect(373,159,25,39);circle(c,386,165,2.5,'#596758');}
}
function description(ui){
  const {t,lang}=ui,o=ui.load('description',null)||{};
  const state={cues:descriptions.map((_,i)=>cueAt(i,o.cues?.[i]).id),
    starts:[0,1].map(i=>bounded((o.starts?.[i]??[2.5,8][i])*2,[5,16][i],0,25)/2),frame:bounded(o.frame,0,0,26)};
  const {panel,c,view,metrics,actions,save}=setup(ui,t('بين جملتين','Between the lines'),t('وزّع وصف فعلين في مغسلة الملابس بين ثلاث جمل. مدة كل صيغة محددة. تُشغَّل هذه النسخة كتفريغ نصي موقّت.','Place two laundry actions between three lines of dialogue. Each phrase has a fixed reading time. This version plays as a timed text transcript.'));
  const transcript=node('ol',null,'sc-transcript'),verdict=node('p',null,'sc-result');
  verdict.setAttribute('role','status');
  const cues=()=>state.cues.map((opt,i)=>{const v=cueAt(i,opt);return {id:v.id,index:i,start:state.starts[i],end:state.starts[i]+v.time,words:v[lang]};}).filter(v=>v.id!=='off');
  function rows(){return [...spoken.map(x=>({start:x.start,end:x.end,words:x[lang],type:'dialogue'})),...cues().map(x=>({...x,type:'description'}))].sort((a,b)=>a.start-b.start);}
  function paint(f){const sec=f/2;if(c)laundry(c,sec);
    const list=rows(),current=list.filter(v=>sec>=v.start&&sec<v.end);
    const status=t('عند ','At ')+sec+t(' ث · ',' s · ')+(current.length?current.map(v=>v.words).join(' / '):t('فجوة صامتة','Silent gap'));
    metrics.textContent=status;view.setAttribute('aria-label',status);
    for(let i=0;i<list.length;i++){const row=transcript.children[i];if(row)row.dataset.active=String(current.includes(list[i]));}
    if(!c)return;
    c.fillStyle='#172a2be8';c.fillRect(0,257,W,83);
    current.slice(0,2).forEach((q,i)=>text(c,q.words,320,278+i*28,16,q.type==='dialogue'?'#e5e9da':'#e9c486'));
    if(!current.length)text(c,t('فجوة صامتة','Silent gap'),320,298,18,'#bdc7b7');
  }
  const clock=transport(ui,state.frame,26,2,paint,f=>{state.frame=f;save(state);});
  function sync(){
    transcript.replaceChildren();
    for(const q of rows()){
      const li=node('li');li.dataset.track=q.type;li.append(node('time',q.start+'–'+q.end),node('span',q.words));transcript.append(li);
    }
    paint(clock.frame);verdict.textContent='';
  }
  for(let i=0;i<2;i++){
    const block=node('fieldset',null,'sc-track');block.append(node('legend',descriptions[i][lang]+' · '+t('يظهر عند ','visible at ')+descriptions[i].seen+t(' ث',' s')));
    block.append(menu('line-'+i,t('الصياغة','Phrase'),descriptions[i].options.map(x=>[x.id,x[lang]+(x.time?' · '+x.time+t(' ث',' s'):'')]),state.cues[i],v=>{state.cues[i]=v;save(state);sync();}),
      range('start-'+i,t('ابدأ عند الثانية','Start at second'),0,12.5,state.starts[i],v=>{state.starts[i]=v;save(state);sync();},.5));
    actions.append(block);
  }
  function judge(){const chosen=cues();let intrusion=0;const missing=[];
    for(let i=0;i<2;i++){const record=chosen.find(x=>x.index===i);if(!record||record.start<descriptions[i].seen||record.end>13)missing.push(descriptions[i][lang]);}
    chosen.forEach(cue=>spoken.forEach(line=>{intrusion+=overlap(cue,line);}));
    const collision=chosen.length===2?overlap(chosen[0],chosen[1]):0;
    verdict.textContent=t('تداخل مع الحوار ','Dialogue overlap ')+intrusion+t(' ث · تداخل بين الوصفين ',' s · between descriptions ')+collision+t(' ث · ',' s · ')+
      (missing.length?t('فعل بلا وصف مكتمل بعد ظهوره: ','Action missing a complete description after it appears: ')+missing.join(' / '):t('وُصف الفعلان بعد ظهورهما.','Both actions described after appearing.'));
  }
  panel.append(clock.bar,transcript,button('check-description',t('راجع التفريغ','Review transcript'),judge),verdict);sync();
}

const locations={
  F:{words:['البهو','Lobby'],xy:[64,164],edges:['C','V']},
  V:{words:['ملتقى الممرات','Crossing'],xy:[211,164],edges:['T','R','F']},
  T:{words:['السلالم','Stairs'],xy:[371,77],edges:['U','V']},
  R:{words:['المنحدر','Ramp'],xy:[371,237],edges:['U','V']},
  U:{words:['ردهة القاعة','Vestibule'],xy:[490,164],edges:['T','R','H']},
  H:{words:['قاعة العرض','Auditorium'],xy:[593,164],edges:[]},
  C:{words:['الاستراحة','Lounge'],xy:[86,266],edges:['F']},
};
const junctions=['F','V','T','R','U'];
const symbols=['all','access','standard'];
function cleanSigns(map){
  const result={};
  for(const id of junctions){const s=map?.[id];if(Object.keys(result).length<4&&s&&locations[id].edges.includes(s.to)&&symbols.includes(s.symbol))result[id]={to:s.to,symbol:s.symbol};}return result;
}
function trip(signs,profile){
  const trail=['F'],reasons=[],used=new Set();let returns=0;
  for(let i=0;i<18;i++){
    const here=trail.at(-1);if(here==='H')break;
    const opts=locations[here].edges.filter(x=>!(profile==='access'&&x==='T'));
    const sign=signs[here],visible=sign&&(sign.symbol==='all'||sign.symbol===profile);
    let to=visible&&opts.includes(sign.to)?sign.to:null;
    let reason=to?'sign':visible?'blocked':'none';
    if(!to)to=opts.find(x=>!used.has(here+':'+x)&&x!==trail.at(-2))||opts.find(x=>!used.has(here+':'+x));
    if(!to){reasons.push({reason:'stop',opts});break;}
    if(used.has(here+':'+to)){reasons.push({reason:'loop',opts});break;}
    if(trail.includes(to))returns++;
    used.add(here+':'+to);reasons.push({reason,opts});trail.push(to);
  }
  return {trail,reasons,returns,complete:trail.at(-1)==='H'};
}
function wayfinding(ui){
  const {t,lang}=ui,o=ui.load('wayfinding',null)||{};
  const state={signs:cleanSigns(o.signs),profile:o.profile==='access'?'access':'standard',
    junction:junctions.includes(o.junction)?o.junction:'V',step:bounded(o.step,0,0,18)};
  const {panel,c,view,metrics,actions,save}=setup(ui,t('آخر باب إلى الصالة','The last door to the screen'),t('عندك أربع لافتات لدليل زائر إلى القاعة. الزائر الذي لا يرى لافتة يجرّب أول ممر متاح لم يسلكه. صاحب الكرسي يتجنب السلالم.','Guide a visitor with four signs. A visitor who sees no sign tries the first available unexplored passage. A wheelchair user avoids the stairs.'));
  let plan=trip(state.signs,state.profile),timer=0;
  const edit=node('div',null,'sc-fields'),info=node('p',null,'sc-result');info.setAttribute('role','status');
  const spokenLayout=node('ol',null,'sc-itinerary');
  const profileLabel={all:t('القاعة · للجميع','Auditorium · everyone'),access:t('القاعة · مدخل ميسّر','Auditorium · accessible'),standard:t('القاعة · طريق المشاة','Auditorium · pedestrians')};
  const name=id=>locations[id].words[lang==='ar'?0:1];
  function stop(){clearInterval(timer);timer=0;}
  function changed(){stop();state.step=0;plan=trip(state.signs,state.profile);save(state);draw();}
  function paintMap(here){
    c.fillStyle='#dce0ce';c.fillRect(0,0,W,H);
    for(let x=0;x<W;x+=21)line(c,x,0,x,H,'#c7cebd');for(let y=0;y<H;y+=21)line(c,0,y,W,y,'#c7cebd');
    const seen=new Set();
    for(const [id,p] of Object.entries(locations)){for(const to of p.edges){
      const k=[id,to].sort().join(':');if(seen.has(k))continue;seen.add(k);
      const [x,y]=p.xy,[xx,yy]=locations[to].xy;line(c,x,y,xx,yy,'#76847b',12);line(c,x,y,xx,yy,'#e8eadc',7);
    }}
    for(let i=0;i<state.step;i++){const a=locations[plan.trail[i]],b=locations[plan.trail[i+1]];if(a&&b)line(c,...a.xy,...b.xy,'#a2693e',4);}
    for(const [id,p] of Object.entries(locations)){
      const [x,y]=p.xy,active=id===here;circle(c,x,y,active?17:11,active?'#a85632':'#415749');circle(c,x,y,active?7:4,'#e4e6d6');
      text(c,name(id),x,y-26,13,'#193e32');
      const s=state.signs[id];if(s){
        const [tx,ty]=locations[s.to].xy,rot=Math.atan2(ty-y,tx-x);
        c.save();c.translate(x,y+25);c.fillStyle='#1f3a32';c.fillRect(-16,-9,32,17);
        c.rotate(rot);line(c,-7,0,7,0,'#faf2d1',2);line(c,7,0,3,-3,'#faf2d1',2);line(c,7,0,3,3,'#faf2d1',2);c.restore();
      }
    }
  }
  function draw(){
    state.step=Math.min(state.step,plan.trail.length-1);const here=plan.trail[state.step],step=plan.reasons[state.step];
    if(c)paintMap(here);metrics.textContent=t('موقع الزائر: ','Visitor at ')+name(here)+' · '+Object.keys(state.signs).length+t(' / ٤ لافتات',' / 4 signs');view.setAttribute('aria-label',metrics.textContent);
    const why={sign:t('اتّبع سهمًا مقروءًا.','A matching sign directs the next step.'),none:t('لا توجد لافتة تخص هذا الزائر هنا.','No matching sign at this point.'),blocked:t('السهم يوجّه إلى ممر لا يستطيع الزائر دخوله.','The sign points to a passage unavailable to this visitor.'),loop:t('أعاد السهم الزائر إلى مسار مكرّر.','The sign repeats an earlier path.'),stop:t('استنفد الزائر الممرات المتاحة.','No unexplored route remains.')};
    const note=step?why[step.reason]+t(' الخيارات: ',' Options: ')+step.opts.map(name).join(' / '):t('وصل الزائر إلى القاعة.','The visitor has arrived.');
    const repeats=plan.trail.slice(0,state.step+1).filter((id,i)=>plan.trail.indexOf(id)<i).length;
    info.textContent=note+' · '+t('مرات الرجوع ','Revisits ')+repeats;
    spokenLayout.replaceChildren(...plan.trail.slice(0,state.step+1).map(id=>node('li',name(id))));
  }
  function editor(){
    edit.replaceChildren();
    const current=state.signs[state.junction];
    let dest=current?.to||locations[state.junction].edges[0],symbol=current?.symbol||'all';
    const place=menu('junction',t('موضع اللافتة','Sign location'),junctions.map(x=>[x,name(x)]),state.junction,v=>{state.junction=v;save(state);editor();});
    const toward=menu('direction',t('السهم نحو','Arrow towards'),locations[state.junction].edges.map(x=>[x,name(x)]),dest,v=>{dest=v;});
    const kind=menu('symbol',t('رمز اللافتة','Sign symbol'),symbols.map(s=>[s,profileLabel[s]]),symbol,v=>{symbol=v;});
    const write=button('place-sign',t('ضع اللافتة','Install sign'),()=>{
      if(!state.signs[state.junction]&&Object.keys(state.signs).length>=4){info.textContent=t('استُخدمت اللافتات الأربع. ارفع إحداها أولًا.','All four signs are installed. Remove one first.');return;}
      state.signs[state.junction]={to:dest,symbol};changed();editor();
    });
    const erase=button('remove-sign',t('ارفع اللافتة','Remove sign'),()=>{delete state.signs[state.junction];changed();editor();});erase.disabled=!current;
    const installed=node('ul',null,'sc-installed');Object.entries(state.signs).forEach(([id,s])=>installed.append(node('li',name(id)+' → '+name(s.to)+' · '+profileLabel[s.symbol])));
    edit.append(place,toward,kind,write,erase,installed);
  }
  function forward(){
    if(state.step>=plan.trail.length-1){stop();return;}
    state.step++;save(state);draw();if(state.step===plan.trail.length-1)stop();
  }
  actions.append(menu('visitor',t('الزائر','Visitor'),[['standard',t('مشاة','Pedestrian')],['access',t('كرسي متحرك','Wheelchair user')]],state.profile,v=>{state.profile=v;changed();}));
  panel.append(edit,button('walk',t('شغّل الرحلة','Walk the route'),()=>{stop();state.step=0;draw();timer=setInterval(forward,450);}),
    button('advance',t('مفترق واحد','Next junction'),()=>{stop();forward();}),button('pause-route',t('أوقف الزائر','Pause visitor'),stop),
    info,spokenLayout);
  const hide=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hide);
  ui.onCleanup(()=>{stop();document.removeEventListener('visibilitychange',hide);});editor();draw();
}
export default function mount(ui){
  const activities={rainbox,stopmotion,description,wayfinding};
  if(Object.hasOwn(activities,ui.route)) activities[ui.route](ui);
}
