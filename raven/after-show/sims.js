import {clampInt, projectionTasks, tasksForShift, scheduleShift, lightDefault, validatedLight, drawLight, foley, cueResult, shipments, inspectShipment} from './sim-rules.js';

function node(tag, text, cls) {
  const el = document.createElement(tag);
  if (text != null) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function button(text, onClick, kind='') {
  const el = node('button', text, 'sim-button '+kind);
  el.type='button'; el.addEventListener('click',onClick);
  return el;
}
function select(items, value, onChange) {
  const el=node('select');
  for (const [key,label] of items) {
    const option=node('option',label);option.value=key;el.append(option);
  }
  el.value=value;el.addEventListener('change',()=>onChange(el.value));return el;
}
function field(text, control) {
  const el=node('label',null,'sim-field');control.setAttribute('aria-label',text);el.append(node('span',text),control);return el;
}
function group(cls,...items) {
  const wrapper=node('div',null,cls);wrapper.append(...items);return wrapper;
}
function range(min,max,step,value,onInput) {
  const input=node('input');input.type='range';Object.assign(input,{min,max,step,value});
  input.addEventListener('input',()=>onInput(Number(input.value)));return input;
}
function number(lang, value, digits=0) {
  return value.toLocaleString(lang==='ar'?'ar-u-nu-arab':lang,{minimumFractionDigits:digits,maximumFractionDigits:digits,useGrouping:false});
}
function clock(lang, offset) {
  const min=19*60+54+offset;
  return number(lang,Math.floor(min/60))+':'+(min%60).toLocaleString(lang==='ar'?'ar-u-nu-arab':lang,{minimumIntegerDigits:2,useGrouping:false});
}
function panel(title,inside) {
  const wrap=node('section',null,'sim-panel');wrap.append(node('h3',title),inside);return wrap;
}
function mountProjection(ui,box) {
  const {t,lang}=ui;
  const stored=ui.load('projection',{}) || {};
  const plans={};
  for (const task of projectionTasks) {
    const saved=stored.plans?.[task.id] || {};
    plans[task.id]={start:clampInt(saved.start,0,15,task.id==='mix'?2:0),tech:saved.tech===1?1:0};
  }
  let scenario=['basic','parallel','practice'].includes(stored.scenario)?stored.scenario:'basic';
  let tick=clampInt(stored.tick,0,scheduleShift(plans,scenario==='parallel').opens,0),timer=null;
  const save=()=>ui.save('projection',{plans,scenario,tick});
  function stop(){clearInterval(timer);timer=null;}
  ui.onCleanup(stop);
  const form=node('div',null,'sim-shift-form'),rows=node('div',null,'sim-rows');
  const result=node('p',null,'sim-result'),clockFace=node('bdi',null,'sim-clock');
  const play=button('',()=>{
    if (timer!==null) {stop();save();update();return;}
    if(tick>=scheduleShift(plans,scenario==='parallel').opens) tick=0;
    tick++;
    if(tick<scheduleShift(plans,scenario==='parallel').opens) timer=setInterval(advance,700);
    save();update();
  },'sim-primary');
  function advance(){
    const plan=scheduleShift(plans,scenario==='parallel');
    tick=Math.min(tick+1,plan.opens);
    if(tick>=plan.opens) stop();
    save();update();
  }
  function reset(){stop();tick=0;save();update();}
  function edit(){reset();}
  const step=button(t('تقديم دقيقة','Step one minute'),()=>{stop();advance();});
  const replay=button(t('أعد البروفة','Rewind rehearsal'),reset);
  const mode=select([
    ['basic',t('موعد الثامنة','Eight o’clock show')],
    ['parallel',t('قائمة العرض والبروفة النهائية','Playlist and final rehearsal')],
    ['practice',t('تدريب مفتوح','Open rehearsal')]
  ],scenario,v=>{scenario=v;stop();tick=0;save();makeForm();update();});
  const intro=node('p',t('يفتح الستار الساعة ٢٠:٠٠. لديك شاشة وفنيّان من ١٩:٥٤. اضبط حجز كل مهمة ثم شغّل البروفة.','Curtain at 20:00. One screen and two technicians arrive at 19:54. Book each check, then run the rehearsal.'),'sim-lead');
  const rule=node('p',null,'sim-note');
  function makeForm(){
    form.replaceChildren();
    rule.textContent=t('إذا تزامن طلبان تُنفّذ المهمة الأعلى في القائمة أولًا. تحتاج كل مهمة فنيًا واحدًا طوال مدتها.','Equal-time requests follow the order below. Each task needs one technician for its full duration.');
    if(scenario==='parallel') rule.textContent+=' '+t('تبدأ البروفة النهائية بعد اكتمال الفحصين وتجهيز القائمة. تحتاج الشاشة وفنيًا لدقيقتين.','The final rehearsal begins after both checks and the playlist are ready. It needs the screen and a technician for two minutes.');
    for(const task of tasksForShift(scenario==='parallel')){
      const name=task[lang], assignment=plans[task.id];
      const item=group('sim-booking',node('strong',name),
        node('small',number(lang,task.minutes)+t(' د · ',' min · ')+(task.screen?t('يحتاج الشاشة','needs screen'):t('يعمل خارج الشاشة','off-screen preparation'))));
      item.append(field(t('طلب البدء','Requested start'),select(Array.from({length:16},(_,i)=>[i,clock(lang,i)]),assignment.start,v=>{assignment.start=Number(v);edit();})),
        field(t('الفني','Technician'),select([[0,t('الفني أ','Technician A')],[1,t('الفني ب','Technician B')]],assignment.tech,v=>{assignment.tech=Number(v);edit();})));
      form.append(item);
    }
  }
  function update(){
    const plan=scheduleShift(plans,scenario==='parallel');
    const frame=Math.max(9,plan.opens);
    rows.replaceChildren();
    for(const job of plan.scheduled){
      const line=node('div',null,'sim-schedule-row');
      const state=tick>=job.end?t('اكتمل','Done'):tick>=job.start?t('قيد التنفيذ','Running'):t('في الانتظار','Waiting');
      const caption=group('sim-row-caption',node('span',job[lang]),node('bdi',clock(lang,job.start)+' – '+clock(lang,job.end)),node('small',state));
      const track=node('div',null,'sim-track');track.dir='ltr';track.setAttribute('aria-hidden','true');
      const bar=node('i');bar.style.left=100*job.start/frame+'%';bar.style.width=100*job.minutes/frame+'%';track.append(bar);
      const head=node('em');head.style.left=100*tick/frame+'%';track.append(head);
      line.append(caption,track);
      if(job.conflicts.length){
        const reasons={tech:t('الفني','technician'),screen:t('الشاشة','screen'),checks:t('اكتمال الفحصين والقائمة','checks and playlist to finish')};
        const resources=job.conflicts.map(k=>reasons[k]).join(t(' و',' and '));
        line.append(node('small',t('انتظر','Waited for')+' '+resources+' · '+number(lang,job.start-job.requested)+t(' د',' min')));
      }
      rows.append(line);
    }
    clockFace.textContent=clock(lang,tick);
    play.textContent=timer!==null?t('وقّف البروفة','Pause rehearsal'):tick>=plan.opens?t('شغّل من البداية','Run from start'):t('شغّل الوردية','Run shift');
    step.disabled=tick>=plan.opens;
    result.textContent=tick>=plan.opens
      ? t('جاهز للعرض عند ','Ready to screen at ')+clock(lang,plan.opens)+(scenario==='practice'?'':t('، تأخّر ',' · delay ')+number(lang,plan.delay)+t(' د',' min'))
      : t('موعد الجاهزية حسب جدولك ','Your plan is ready at ')+clock(lang,plan.end);
  }
  makeForm();
  const stage=group('sim-projection',group('sim-dial',node('span',t('ساعة غرفة العرض','Projection booth clock')),clockFace),rows);
  box.append(intro,field(t('الوردية','Shift'),mode),panel(t('جدول الحجوزات','Screen bookings'),form),rule,stage,
    group('sim-actions',play,step,replay),result);update();
}
const presets=[
  {key:'soft',ar:'ضوء ناعم',en:'Soft light',settings:{angle:0,spread:94,exposure:-25}},
  {key:'raking',ar:'ضوء جانبي',en:'Raking light',settings:{angle:-90,spread:12,exposure:0}},
  {key:'bright',ar:'تعريض مرتفع',en:'High exposure',settings:{angle:45,spread:55,exposure:60}}
];
function mountLight(ui,box){
  const {t,lang}=ui, stored=ui.load('light',{})||{};
  let settings=validatedLight(stored), capture=stored.captured && typeof stored.captured==='object'?validatedLight(stored.captured):null;
  let goal=['texture','highlights','free'].includes(stored.goal)?stored.goal:'highlights';
  const save=()=>ui.save('light',{...settings,goal,captured:capture}), metrics=node('div',null,'sim-meters'), report=node('p',null,'sim-result');
  const controls=node('div',null,'sim-lights'), compare=node('div',null,'sim-pairs'), status=node('p',null,'sim-note');
  const mainCanvas=node('canvas'), before=node('canvas');
  const size=c=>{c.width=400;c.height=226;c.setAttribute('aria-hidden','true');};
  size(mainCanvas);size(before);
  const img=node('img'),prevImg=node('img');img.alt=t('لقطة ورقة التدريب','Training paper still');prevImg.alt=img.alt;
  let fallback=false, currentPreset=0, frozenPreset=null;
  function frame(visual,label,metered){
    const field=node('div',null,'sim-picture');field.append(visual);
    if(metered) field.append(node('span',null,'sim-roi'));
    const f=node('figure');f.append(field,node('figcaption',label));return f;
  }
  let ref=frame(before,t('لقطة المقارنة','Captured frame'),false);
  let live=frame(mainCanvas,t('المعاينة الحالية · القياس داخل الإطار','Live view · measurement inside the outline'),true);
  compare.append(ref,live);
  function present(m){
    metrics.replaceChildren();
    for(const [value,label] of [[m.high,t('فاتح جدًا','Near white')],[m.low,t('داكن جدًا','Near black')]]){
      metrics.append(group('sim-meter',node('small',label),node('bdi',number(lang,value,1)+'%')));
    }
    metrics.append(group('sim-meter',node('small',t('تباين الملمس','Texture contrast')),node('bdi',number(lang,m.texture,1))));
    if(goal==='free'){report.textContent='';return;}
    const pass=goal==='texture'?m.texture>=12:m.high<=2&&m.low<=2;
    report.textContent=(pass?t('تحقّق الشرط. ','Target met. '):t('جرّب ضبط الضوء. ','Adjust the light. '))+
      (goal==='texture'?t('المطلوب تباين ملمس ١٢ فأكثر.','Aim for a texture contrast of 12 or higher.'):t('المطلوب ٢٪ أو أقل في كل من المناطق الفاتحة جدًا والداكنة جدًا.','Keep both the near-white and near-black patches at 2% or less.'));
  }
  function closest(values){
    const distances=presets.map(({settings:s})=>Math.abs(s.angle-values.angle)+Math.abs(s.exposure-values.exposure)+Math.abs(s.spread-values.spread));
    return distances.indexOf(Math.min(...distances));
  }
  function showReference(){
    ref.hidden=!capture;
    compare.classList.toggle('sim-pair-active',!!capture);
    if(!capture)return;
    if(fallback){
      frozenPreset=closest(capture);prevImg.src='./assets/light-'+presets[frozenPreset].key+'.png';
      const exact=Object.keys(capture).every(k=>capture[k]===presets[frozenPreset].settings[k]);
      ref.querySelector('figcaption').textContent=exact?t('لقطة المقارنة','Captured frame'):t('أقرب لقطة ثابتة للمرجع','Closest still to the captured lighting');
    }else drawLight(before,capture);
  }
  function render(){
    let m;
    if(!fallback){
      try{m=drawLight(mainCanvas,settings);}
      catch{
        fallback=true;
        status.textContent=t('الرسم المباشر غير متاح. اختر لقطة ثابتة من نفس المحاكاة واقرأ قياسها المسجّل.','Live rendering is unavailable. Choose a still from the same simulation with its recorded measurements.');
        mainCanvas.replaceWith(img);before.replaceWith(prevImg);currentPreset=closest(settings);settings={...presets[currentPreset].settings};fallbackControls();showReference();
      }
    }
    if(fallback){
      const selected=presets[currentPreset];img.src='./assets/light-'+selected.key+'.png';
      m=lightStillMetrics[selected.key];
    }
    present(m);
  }
  function fallbackControls(){
    controls.replaceChildren(field(t('لقطات إضاءة بديلة','Lighting stills'),select(presets.map((p,i)=>[i,p[lang]]),currentPreset,v=>{currentPreset=Number(v);settings={...presets[currentPreset].settings};save();render();})));
  }
  const label=t('احفظ لقطة للمقارنة','Capture comparison frame');
  const snap=button(label,()=>{capture={...settings};save();showReference();},'sim-primary');
  const goalSelect=select([['highlights',t('احتفظ بتفاصيل الضوء','Preserve highlight detail')],['texture',t('أبرز ملمس الورق','Reveal the paper texture')],['free',t('تصوير حر','Free photography')]],goal,v=>{goal=v;save();render();});
  for(const [id,min,max,ar,en] of [['angle',-100,100,'موضع المصباح','Lamp position'],['spread',0,100,'اتساع الضوء','Light spread'],['exposure',-60,60,'التعريض','Exposure']]){
    const amount=node('bdi',number(lang,settings[id]));
    const input=range(min,max,1,settings[id],v=>{settings[id]=v;amount.textContent=number(lang,v);render();});
    input.setAttribute('aria-label',t(ar,en));
    input.addEventListener('change',save);
    const wrap=field(t(ar,en),input);wrap.append(amount);controls.append(wrap);
  }
  box.append(node('p',t('ورقة قطنية مضغوطة. غيّر اتجاه المصباح ثم التقط مرجعًا قبل الإضاءة الثانية.','A pressed cotton sheet. Set your lamp and capture a reference before the second exposure.'),'sim-lead'),
    field(t('التكليف','Assignment'),goalSelect),compare,metrics,controls,group('sim-actions',snap),report,status,
    node('small',t('يُقاس الملمس بمتوسط فرق السطوع بين بكسلات متجاورة داخل الإطار المحدد.','Texture measures the average brightness difference between neighboring pixels inside the outlined patch.'),'sim-note'));
  render();showReference();
}
// Recorded from the corresponding uncompressed 400 × 226 stills during export.
const lightStillMetrics = {
  soft:{high:0,low:0,texture:1.3085},
  raking:{high:0,low:0,texture:19.7244},
  bright:{high:100,low:0,texture:0}
};
function mountSound(ui,box){
  const {t,lang}=ui, saved=ui.load('sound',{})||{};
  const offsets={};
  const defaults={paper:2.4,chair:3.2,key:4.6};
  for(const cue of foley){
    const raw=saved.offsets?.[cue.id];
    offsets[cue.id]=clampInt(typeof raw==='number'?raw*10:null,0,60,defaults[cue.id]*10)/10;
  }
  let enabled=false, playing=false, auditioned=saved.auditioned===true;
  let elapsed=0,started=0,raf=0;
  const total=7, players={}, fired=new Set(), labels={}, markers={}, cueLines={};
  const save=()=>ui.save('sound',{offsets:{...offsets},auditioned});
  const stage=node('div',null,'sim-foley-stage');
  const prop=node('span',null,'sim-foley-prop');prop.setAttribute('aria-hidden','true');
  const sceneText=node('b',t('المشهد جاهز','Set ready'));
  const timer=node('bdi',null,'sim-foley-time');
  const tracks=node('div',null,'sim-sound-tracks');
  const sceneLabel=node('small',t('حركة المشهد','On-screen action'));
  stage.append(prop,group('sim-action-readout',sceneLabel,sceneText),timer);
  const message=node('p',null,'sim-note');message.setAttribute('role','status');
  const playback=button('',()=>{if(playing) pause();else start();},'sim-primary');
  const reset=button(t('إرجاع المؤشر','Rewind'),()=>rewind());
  const audioToggle=button('',()=>{
    enabled=!enabled;
    for(const [id,player] of Object.entries(players)){
      player.muted=!enabled;
      if(enabled && !player.src){player.preload='auto';player.src='./assets/foley-'+id+'.wav';player.load();}
      if(!enabled)player.pause();
    }
    message.textContent=enabled?t('ستسمع المؤثرات عند تشغيل البروفة.','You will hear the cues during rehearsal.'):'';
    paint();
  });
  const details=node('div',null,'sim-cue-fields'), verdict=group('sim-verdict');
  const secs=v=>number(lang,v,1)+t(' ث',' s');
  function explain(){
    verdict.replaceChildren();
    for(const cue of foley){
      const result=cueResult(offsets[cue.id],cue.target);
      const txt=result.delta===0?t('متزامن تمامًا','In sync'):
        (result.delta>0?t('الصوت بعد الحركة بـ ','Sound after motion by '):t('الصوت قبل الحركة بـ ','Sound before motion by '))+secs(Math.abs(result.delta));
      verdict.append(group('sim-verdict-row',node('strong',cue[lang]),node('span',txt),node('small',result.matched?t('ضمن الهامش','Within tolerance'):t('خارج الهامش','Outside tolerance'))));
    }
  }
  function markCue(cue){
    const player=players[cue.id];
    if(!enabled||!player||elapsed-offsets[cue.id]>=cue.duration)return;
    try{player.currentTime=Math.max(0,elapsed-offsets[cue.id]);}catch{}
    player.muted=false;
    player.play().catch(()=>{
      if(enabled&&playing)message.textContent=t('تعذّر تشغيل المؤثر. تابع توقيته على المسار المرئي.','This cue could not play. Its timing remains visible on the track.');
    });
  }
  function paint(){
    timer.textContent=secs(elapsed)+' / '+secs(total);
    playback.textContent=playing?t('إيقاف مؤقت','Pause rehearsal'):elapsed>=total?t('اعرض النسخة مجددًا','Replay your mix'):t('شغّل البروفة','Run rehearsal');
    audioToggle.textContent=enabled?t('كتم المؤثرات','Mute effects'):t('تفعيل المؤثرات الصوتية','Enable sound effects');
    audioToggle.setAttribute('aria-pressed',String(enabled));
    const active=foley.find(c=>elapsed>=c.target && elapsed<=c.target+c.duration);
    stage.dataset.action=active?.id||'idle';
    sceneText.textContent=active?active[lang]:t('المشهد ساكن','Set at rest');
    tracks.style.setProperty('--playhead',100*elapsed/total+'%');
    for(const cue of foley){
      const isPlaying=elapsed>=offsets[cue.id]&&elapsed<offsets[cue.id]+cue.duration;
      cueLines[cue.id]?.classList.toggle('sim-sounding',isPlaying);
    }
  }
  function frame(now){
    if(!playing)return;
    elapsed=Math.min(total,(now-started)/1000);
    for(const cue of foley){
      if(!fired.has(cue.id)&&elapsed>=offsets[cue.id]){fired.add(cue.id);markCue(cue);}
    }
    if(elapsed>=total){
      playing=false;auditioned=true;save();explain();
      for(const player of Object.values(players))player.pause();
      paint();return;
    }
    paint();raf=requestAnimationFrame(frame);
  }
  function pause(){
    if(playing)elapsed=Math.min(total,(performance.now()-started)/1000);
    playing=false;cancelAnimationFrame(raf);
    for(const player of Object.values(players))player.pause();
    paint();
  }
  function rewind(){pause();elapsed=0;fired.clear();paint();}
  function start(){
    if(elapsed>=total)rewind();
    const now=performance.now();started=now-elapsed*1000;playing=true;
    // Rejoin an unfinished cue on resuming, using its real offset in the sample.
    for(const cue of foley)if(elapsed>=offsets[cue.id]&&elapsed<offsets[cue.id]+cue.duration)fired.delete(cue.id);
    frame(now);
  }
  function onHidden(){if(document.hidden)pause();}
  document.addEventListener('visibilitychange',onHidden);
  ui.onCleanup(()=>{document.removeEventListener('visibilitychange',onHidden);pause();});
  for(const cue of foley){
    const player=node('audio');player.preload='none';player.muted=true;player.hidden=true;players[cue.id]=player;box.append(player);
    const readout=node('bdi',secs(offsets[cue.id]));labels[cue.id]=readout;
    const rail=node('div',null,'sim-cue-rail');rail.dir='ltr';rail.setAttribute('aria-hidden','true');
    const mark=node('i'),target=node('em');
    mark.style.width=100*cue.duration/total+'%';mark.style.left=100*offsets[cue.id]/total+'%';
    target.style.left=100*cue.target/total+'%';markers[cue.id]=mark;
    rail.append(mark,target,node('b'));
    const line=group('sim-cue-track',group('sim-cue-title',node('strong',cue[lang]),node('small',t('الحركة عند ','Motion at ')+secs(cue.target))),rail);
    tracks.append(line);cueLines[cue.id]=line;
    const adjust=v=>{
      rewind();offsets[cue.id]=Math.max(0,Math.min(6,Math.round(v*10)/10));
      slider.value=offsets[cue.id];labels[cue.id].textContent=secs(offsets[cue.id]);
      markers[cue.id].style.left=100*offsets[cue.id]/total+'%';save();
      if(auditioned)explain();
    };
    const slider=range(0,6,.1,offsets[cue.id],adjust);
    const early=button('−',()=>adjust(offsets[cue.id]-.1)), late=button('+',()=>adjust(offsets[cue.id]+.1));
    early.setAttribute('aria-label',cue[lang]+' · '+t('أبكر بعُشر ثانية','one tenth earlier'));
    late.setAttribute('aria-label',cue[lang]+' · '+t('أبعد بعُشر ثانية','one tenth later'));
    const row=group('sim-cue-control',field(cue[lang],slider),group('sim-nudge',early,readout,late));
    details.append(row);
  }
  box.append(node('p',t('ركّب ثلاثة مؤثرات على مشهد مدته سبع ثوانٍ. اضبط بداية كل مؤثر في حدود ربع ثانية من الحركة.','Mix three cues against seven seconds of action. Place each sound within a quarter second of its movement.'),'sim-lead'),
    stage,tracks,node('small',t('الخط الثابت للحركة، والشريط لمدة المؤثر.','The fixed mark is the movement; the bar spans your sound.'),'sim-note'),
    details,group('sim-actions',playback,reset,audioToggle),message,verdict);
  paint();if(auditioned)explain();
}
function mountArchive(ui,box){
  const {t,lang}=ui,stored=ui.load('archive',{})||{};
  const decisions=['approve','replace','missing'];
  let round=clampInt(stored.round,0,shipments.length,0);
  const answers=Array.isArray(stored.answers)?stored.answers.slice(0,shipments.length).map(v=>decisions.includes(v)?v:null):[];
  // Keep only the uninterrupted review history if an older save contains a gap.
  const gap=answers.findIndex(v=>!v);
  if(gap!==-1) answers.length=gap;
  round=Math.min(round,answers.length);
  const save=()=>ui.save('archive',{round,answers:[...answers]});
  const main=node('section',null,'sim-archive');
  const title=node('h3');title.tabIndex=-1;
  const progress=node('p',null,'sim-note');
  const fields=[t('الصيغة','Format'),t('الإصدار','Version'),t('اللغة','Language')];
  const names={approve:t('اعتمد للاستعراض','Approve for screening'),replace:t('اطلب النسخة الصحيحة','Request a replacement'),missing:t('معلومات ناقصة','Request missing details')};
  function value(v){return v==null?t('غير مذكور','Unspecified'):typeof v==='number'?number(lang,v):v;}
  function render(moveFocus){
    main.replaceChildren(title,progress);
    if(round===shipments.length){
      title.textContent=t('اكتملت مراجعة الشحنات','Shipment review complete');
      const total=shipments.filter((s,i)=>inspectShipment(s.request,s.item).decision===answers[i]).length;
      progress.textContent=t('قرارات مدعومة بالبطاقات ','Decisions supported by the manifests ')+number(lang,total)+' / '+number(lang,shipments.length);
      const list=node('ul');
      shipments.forEach((s,i)=>{
        const expected=inspectShipment(s.request,s.item);
        list.append(node('li',s[lang]+' · '+names[answers[i]]+' · '+t('قرار المطابقة ','Manifest decision ')+names[expected.decision]));
      });
      main.append(list,button(t('ابدأ وردية جديدة','Start another shift'),()=>{round=0;answers.length=0;save();render(true);},'sim-primary'));
    }else{
      const item=shipments[round];
      title.textContent=item[lang];
      progress.textContent=t('الشحنة ','Delivery ')+number(lang,round+1)+' / '+number(lang,shipments.length);
      const table=node('table');table.className='sim-manifest';const h=node('thead'),b=node('tbody'),line=node('tr');
      for(const label of [t('الحقل','Field'),t('الطلب','Order'),t('الوارد','Received')]){
        const th=node('th',label);th.scope='col';line.append(th);
      }
      h.append(line);
      fields.forEach((f,i)=>{
        const tr=node('tr'),th=node('th',f);th.scope='row';
        tr.append(th,node('td',value(item.request[i])),node('td',value(item.item[i])));b.append(tr);
      });
      table.append(h,b);main.append(table);
      if(answers[round]){
        const result=inspectShipment(item.request,item.item);
        const rationale=result.fields.map(i=>fields[i]+t(' المطلوب ',' wanted ')+value(item.request[i])+t(' والوارد ',' / received ')+value(item.item[i])).join(t('، ',', '));
        const q=node('div',null,'sim-verdict');
        q.append(node('p',t('قرارك ','Your decision ')+names[answers[round]]),node('strong',t('ما يدعمه الطلب ','Supported by the order ')+names[result.decision]),node('p',rationale));
        main.append(q,button(round===shipments.length-1?t('اعرض سجل الوردية','View shift log'):t('افتح الشحنة التالية','Open next delivery'),()=>{round++;save();render(true);},'sim-primary'));
      }else{
        const actions=node('div',null,'sim-actions');
        for(const decision of decisions)actions.append(button(names[decision],()=>{answers[round]=decision;save();render(true);}));
        main.append(actions);
      }
    }
    if(moveFocus)title.focus({preventScroll:true});
  }
  box.append(node('p',t('وصلت ملفات أمسية سينمائية. راجع طلب البرمجة وشحنة المورّد ثم اختر الإجراء الذي تسانده الحقول.','The evening programme has arrived. Compare the booking with each delivery and select the action supported by its fields.'),'sim-lead'),main);
  render(false);
}
export default function mount(ui){
  const names={
    projection:['وردية غرفة العرض','Projection shift'],light:['طاولة الضوء','The light table'],
    sound:['خارج الكادر','Offscreen sound'],archive:['نقطة تفتيش الأرشيف','Archive check']
  };
  const box=node('div',null,'as-sim');ui.root.append(box);
  box.append(node('h1',ui.t(...names[ui.route]),'sim-title'));
  ({projection:mountProjection,light:mountLight,sound:mountSound,archive:mountArchive})[ui.route](ui,box);
}
