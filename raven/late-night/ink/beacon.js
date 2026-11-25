import {action, element, link, mount} from '../night-shell.js';

const boats = [
  {name:['النورس','Gull'], x:809, dx:-8.5, y:336, dy:1.4, width:116},
  {name:['اللؤلؤة','Pearl'], x:758, dx:-12, y:425, dy:-1.4, width:146},
  {name:['العنبر','Amber'], x:654, dx:-11.5, y:482, dy:1.8, width:161}
];
const lamp = {x:137,y:124};
const radius = 2.5;
const degrees = radians => radians*180/Math.PI;
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const freshRound = () => ({ticks:0,hold:0,best:0,litDuringPass:false,outcome:null});
const freshGame = () => ({version:1,index:0,aim:12,light:false,history:[],round:freshRound()});
let state=freshGame(), restored=false;

function boatPosition(index,ticks) {
  const boat=boats[index],time=ticks/10;
  const x=boat.x+boat.dx*time,y=boat.y+boat.dy*time;
  return {x,y,width:boat.width,angle:degrees(Math.atan2(y-lamp.y,x-lamp.x))};
}
function advance() {
  const r=state.round;
  if (r.outcome) return;
  r.ticks++;
  // Each tick represents the previous tenth of a second. The available signal
  // interval is exactly [2.0,8.0]; an early lamp gets no extra exposure time.
  if (r.ticks>20 && r.ticks<=80 && state.light) {
    r.litDuringPass=true;
    if (Math.abs(state.aim-boatPosition(state.index,r.ticks).angle)<=radius) {
      r.hold++; r.best=Math.max(r.best,r.hold);
    } else r.hold=0;
  } else r.hold=0;
  if (r.hold>=10) r.outcome='acknowledged';
  else if (r.ticks===80) r.outcome='missed';
}

function validDraft(s) {
  const r=s?.round;
  return s?.version===1 && Number.isInteger(s.index) && s.index>=0 && s.index<boats.length &&
    Number.isInteger(s.aim) && s.aim>=4 && s.aim<=58 && typeof s.light==='boolean' &&
    Array.isArray(s.history) && s.history.length===s.index && s.history.every(v=>['acknowledged','missed'].includes(v)) &&
    r && Number.isInteger(r.ticks) && r.ticks>=0 && r.ticks<=80 &&
    Number.isInteger(r.hold) && Number.isInteger(r.best) && r.hold>=0 && r.hold<=r.best && r.best<=10 &&
    typeof r.litDuringPass==='boolean' && (
      r.outcome===null && r.ticks<80 && r.hold<10 || r.outcome==='acknowledged' && r.hold===10 ||
      r.outcome==='missed' && r.ticks===80 && r.best<10
    );
}

const art = new Map();
let refreshArt=()=>{};
function loadAsset(id,retry=false) {
  const image=new Image(),item={image,status:'loading'};
  art.set(id,item);
  image.onload=()=>{item.status='ready';refreshArt();};
  image.onerror=()=>{item.status='failed';refreshArt();};
  const path=new URL('./art/'+id+'.webp',import.meta.url);
  if (retry) path.searchParams.set('retry',String(Date.now()));
  image.src=path;
}

function paint(canvas) {
  const ctx=canvas.getContext('2d');
  if (!ctx) return;
  const place=art.get('beacon-night'),fleet=art.get('beacon-boats'),r=state.round;
  const boat=boatPosition(state.index,r.ticks);
  if (place?.status==='ready') ctx.drawImage(place.image,0,0,900,600);
  else {
    ctx.fillStyle='#273c43';ctx.fillRect(0,0,900,600);
    ctx.fillStyle='#20383b';ctx.fillRect(0,300,900,300);
    ctx.strokeStyle='#738a7e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,300);ctx.lineTo(900,300);ctx.stroke();
  }
  const angle=state.aim*Math.PI/180,spread=radius*Math.PI/180;
  if (state.light) {
    const beam=ctx.createLinearGradient(lamp.x,lamp.y,lamp.x+920*Math.cos(angle),lamp.y+920*Math.sin(angle));
    beam.addColorStop(0,'rgba(255,232,165,.78)');beam.addColorStop(.65,'rgba(255,226,158,.28)');beam.addColorStop(1,'rgba(255,230,165,.04)');
    ctx.fillStyle=beam;ctx.beginPath();ctx.moveTo(lamp.x,lamp.y);
    for (const offset of [-spread,spread]) ctx.lineTo(lamp.x+1040*Math.cos(angle+offset),lamp.y+1040*Math.sin(angle+offset));
    ctx.closePath();ctx.fill();
  } else {
    ctx.save();ctx.strokeStyle='#e4d9af9c';ctx.lineWidth=1.5;ctx.setLineDash([5,9]);ctx.beginPath();
    ctx.moveTo(lamp.x,lamp.y);ctx.lineTo(lamp.x+1040*Math.cos(angle),lamp.y+1040*Math.sin(angle));ctx.stroke();ctx.restore();
  }
  const glow=(x,y,size,colour)=>{
    const g=ctx.createRadialGradient(x,y,1,x,y,size);g.addColorStop(0,colour);g.addColorStop(1,'rgba(255,220,155,0)');
    ctx.fillStyle=g;ctx.fillRect(x-size,y-size,size*2,size*2);
  };
  if (state.light||place?.status!=='ready') glow(lamp.x,lamp.y,19,'#ffe5a7');
  const h=boat.width*180/270;
  if (fleet?.status==='ready') ctx.drawImage(fleet.image,state.index*270,0,270,180,boat.x-boat.width*.17,boat.y-h*.77,boat.width,h);
  else {
    ctx.fillStyle='#b3bcaf';ctx.beginPath();ctx.moveTo(boat.x-16,boat.y+6);
    ctx.lineTo(boat.x+53,boat.y+6);ctx.lineTo(boat.x+42,boat.y+17);ctx.lineTo(boat.x-5,boat.y+17);ctx.closePath();ctx.fill();
  }
  const acknowledged=r.outcome==='acknowledged',lit=acknowledged||r.hold>0;
  glow(boat.x,boat.y,acknowledged?30:lit?18:9,acknowledged?'#d9fff2':'#ffcf7c');
  ctx.fillStyle=acknowledged?'#e1fff0':'#ffe1a5';ctx.beginPath();ctx.arc(boat.x,boat.y,3.5,0,2*Math.PI);ctx.fill();
  if (r.hold>0) {
    ctx.strokeStyle=acknowledged?'#e1fff0':'#f8da99';ctx.lineWidth=2.2;ctx.beginPath();
    ctx.arc(boat.x,boat.y,13,-Math.PI/2,-Math.PI/2+2*Math.PI*r.hold/10);ctx.stroke();
  }
}

mount({
  id:'ink-beacon',title:['حارس المنارة','Lighthouse Keeper'],
  intro:['ثلاثة قوارب تحمل فوانيس المهرجان. وجّه ضوء المنارة إلى كل فانوس حتى يردّ عليك.','Three boats carry lanterns for the harbour festival. Aim the lighthouse at each lantern until the boat answers.'],
  render(ui) {
    const {t,root}=ui;
    if (!restored) {const draft=ui.load();if(validDraft(draft))state=draft;restored=true;}
    let running=false,frame=0,last=0,remainder=0;
    const format=new Intl.NumberFormat(ui.lang,{maximumFractionDigits:1,numberingSystem:ui.lang==='ar'?'arab':'latn'});
    const number=n=>format.format(n);
    const key=(node,id)=>{node.dataset.beacon=id;return node;};
    const btn=(id,ar,en,fn)=>key(action(t(ar,en),fn),id);
    const fig=element('figure',null,'ink-stage'),canvas=element('canvas');
    canvas.width=900;canvas.height=600;canvas.setAttribute('role','img');
    const caption=key(element('figcaption'),'caption');
    fig.append(canvas,caption);
    const result=key(element('p',null,'ink-result'),'result');result.setAttribute('role','status');
    const info=element('p',t('يستقبل القارب الإشارة من الثانية ٢ إلى ٨. شغّل الضوء وأبقه ضمن درجتين ونصف من الفانوس لثانية كاملة.','The boat listens from 2 to 8 seconds. Keep the light on and within 2.5° of its lantern for one full second.'));
    const aim=key(element('input'),'angle');aim.type='range';aim.min='4';aim.max='58';aim.step='1';aim.dir='ltr';aim.id='beacon-aim';
    const aimLabel=element('label');aimLabel.htmlFor=aim.id;
    const bearing=key(element('data'),'bearing'),timeRead=key(element('output'),'time');timeRead.setAttribute('aria-live','off');
    const metrics=element('p');metrics.setAttribute('dir','auto');
    metrics.append(document.createTextNode(t('زاوية الفانوس ','Lantern angle ')),bearing,document.createTextNode(t('° · زمن المرور ','° · Passage time ')),timeRead,document.createTextNode(t(' ث',' s')));
    function setAim(n) {
      if(state.round.outcome)return;
      state.aim=clamp(Math.round(n),4,58);
      if(Math.abs(state.aim-boatPosition(state.index,state.round.ticks).angle)>radius)state.round.hold=0;
      draw();
    }
    aim.oninput=()=>setAim(+aim.value);aim.onchange=()=>checkpoint();
    canvas.onpointerdown=event=>{
      const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*900,y=(event.clientY-rect.top)/rect.height*600;
      if(state.round.outcome)return;
      setAim(degrees(Math.atan2(y-lamp.y,x-lamp.x)));checkpoint();
    };
    const controls=element('div',null,'ink-controls');
    const signal=btn('signal','أشعل الضوء','Turn on light',()=>{
      state.light=!state.light;if(!state.light)state.round.hold=0;checkpoint();draw();
    });
    const play=btn('play','شغّل مرور القارب','Start boat passage',()=>{
      if (running) {stop();checkpoint();draw();return;}
      running=true;last=performance.now();remainder=0;draw();frame=requestAnimationFrame(tick);
    });
    const step=btn('step','تقدّم نصف ثانية','Step half a second',()=>{
      stop();for(let i=0;i<5;i++)advance();checkpoint();draw();
    });
    const next=btn('next','القارب التالي','Next boat',()=>{
      if(!state.round.outcome||state.index>=boats.length-1)return;
      state.history.push(state.round.outcome);state.index++;state.round=freshRound();
      state.light=false;checkpoint();draw();aim.focus();
    });
    const again=btn('restart','أعد الليلة','Replay the night',()=>{
      stop();state=freshGame();checkpoint();draw();aim.focus();
    });
    const retry=btn('retry','أعد تحميل الرسم','Retry artwork',()=>{
      for(const [id,item] of art) if(item.status==='failed')loadAsset(id,true);
      draw();
    });
    const artMessage=element('p');artMessage.setAttribute('role','status');
    const aimRow=element('div',null,'ink-controls');aimRow.append(aimLabel,aim);
    controls.append(signal,play,step,next,again);
    const programme=element('ol');programme.setAttribute('aria-label',t('ترتيب قوارب الليلة','Tonight’s boat order'));
    const returnLink=link(t('العودة إلى ليالي الحبر','Return to Ink Nights'),ui.url('./ink-studio.html'));
    root.append(fig,metrics,aimRow,controls,result,info,artMessage,retry,programme,returnLink);
    function stop(){running=false;cancelAnimationFrame(frame);remainder=0;}
    function checkpoint(){ui.save(state);}
    function tick(now) {
      if(!running)return;
      remainder+=Math.max(0,now-last);last=now;
      if(remainder>=100){
        while(remainder>=100&&!state.round.outcome){advance();remainder-=100;}
        if(state.round.outcome){stop();checkpoint();}
        draw();
      }
      if(running)frame=requestAnimationFrame(tick);
    }
    function draw() {
      const r=state.round,position=boatPosition(state.index,r.ticks),boat=t(...boats[state.index].name);
      const stage=r.outcome==='acknowledged'?t('ردّ الفانوس','Lantern answered'):r.outcome==='missed'?t('انتهى المرور','Passage ended'):r.ticks<20?t('يقترب','Approaching'):t('يستقبل الإشارة','Receiving the signal');
      const status=boat+' · '+stage+' · '+t('ثبات الضوء ','Light held ')+number(r.hold/10)+t(' من ١ ث',' of 1 s');
      caption.textContent=status;canvas.setAttribute('aria-label',status);
      aim.value=state.aim;aimLabel.textContent=t('وجّه الضوء','Aim the light')+' · '+number(state.aim)+'°';
      bearing.value=String(Math.round(position.angle));bearing.textContent=number(Math.round(position.angle));timeRead.value=number(r.ticks/10);
      signal.textContent=state.light?t('أطفئ الضوء','Turn off light'):t('أشعل الضوء','Turn on light');signal.setAttribute('aria-pressed',String(state.light));
      play.textContent=running?t('أوقف المرور مؤقتًا','Pause passage'):r.ticks?t('تابع المرور','Continue passage'):t('شغّل مرور القارب','Start boat passage');
      for(const input of [aim,signal,play,step])input.disabled=!!r.outcome;
      next.hidden=!r.outcome||state.index===2;again.hidden=!r.outcome;
      result.dataset.outcome=r.outcome||'pending';
      const msg=r.outcome==='acknowledged'?t('ردّ قارب ','The lantern aboard ')+boat+t(' بإضاءة فانوسه.',' answered your light.'):
        r.outcome==='missed'?(!r.litDuringPass?t('انقضت مهلة الفانوس والضوء مطفأ.','The lantern’s window closed without receiving any light.'):
          r.best===0?t('ظلّت الحزمة خارج زاوية الفانوس طوال المهلة.','The beam stayed outside the lantern’s angle throughout its window.'):
          t('انقطع الضوء قبل اكتمال الثانية. أطول ثبات ','The light broke off before one full second. Longest hold ')+number(r.best/10)+t(' ث.',' s.')):'';
      const final=state.index===2&&r.outcome;
      const full=final?msg+' '+t('قوارب ردّت الليلة ','Boats that answered tonight ')+number([...state.history,r.outcome].filter(v=>v==='acknowledged').length)+' / '+number(3):msg;
      if(result.textContent!==full)result.textContent=full;result.hidden=!full;
      const failed=[...art.values()].some(a=>a.status==='failed');retry.hidden=!failed;artMessage.hidden=!failed;
      if(failed)artMessage.textContent=t('تعذّر تحميل جزء من الرسم. زاوية الفانوس وتوقيت الإشارة ظاهران هنا.','Part of the artwork could not load. The lantern angle and timing are still available here.');
      const key=state.index+':'+state.history.join(',')+':'+r.outcome;
      if(programme.dataset.state!==key){
        programme.dataset.state=key;programme.replaceChildren(...boats.map((b,i)=>{
          const outcome=state.history[i]||(i===state.index?r.outcome:null);
          const phase=outcome==='acknowledged'?t('ردّ','answered'):outcome==='missed'?t('فاتت الإشارة','missed signal'):i===state.index?t('يمرّ الآن','current passage'):t('ينتظر','waiting');
          return element('li',t(...b.name)+' · '+phase);
        }));
      }
      paint(canvas);
    }
    const suspend=()=>{if(running){stop();checkpoint();draw();}};
    const visibility=()=>{if(document.hidden)suspend();};
    document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',suspend);
    for(const id of ['beacon-night','beacon-boats'])if(!art.has(id))loadAsset(id);
    refreshArt=draw;draw();
    return ()=>{stop();refreshArt=()=>{};window.removeEventListener('pagehide',suspend);document.removeEventListener('visibilitychange',visibility);};
  }
});
