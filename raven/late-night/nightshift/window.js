import {mount, element} from '../night-shell.js';

const length = 12;
const crossingSeconds = 3;
const cues = [
  {id:'curtain', label:['ترتفع الستارة','Curtain lifts'], max:11, initial:1.5},
  {id:'gaze', label:['ترفع نظرها','She looks up'], max:12, initial:4},
  {id:'boat', label:['يبدأ عبور القارب','Boat begins to cross'], max:length - crossingSeconds, initial:5.5},
];
const timed = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const state = {time:0, running:false, completed:false, cues:null};
const asset = (id) => new URL('./art/window-' + id + '.webp', import.meta.url).href;

mount({
  id:'nightshift-window',
  title:['نافذة فوق البحر','Window above the sea'],
  intro:['امرأة تنتظر فوق المرفأ. اختر متى ترفع نظرها ومتى يمرّ القارب، ثم شاهد الثواني الاثنتي عشرة.','A woman waits above the harbour. Set her glance and the boat’s crossing, then screen the twelve-second take.'],
  render,
});

function render(ui) {
  const {root,t} = ui;
  if (!state.cues) {
    const saved = ui.load();
    state.cues = Object.fromEntries(cues.map(({id,initial,max}) => [id,
      saved?.schema === 1 && timed(saved.cues?.[id],max) ? saved.cues[id] : initial]));
    if (saved?.schema === 1 && timed(saved.time,length)) {
      state.time = saved.time;
      state.completed = saved.completed === true;
    }
  }
  root.append(document.getElementById('window-view').content.cloneNode(true));
  const node = id => root.querySelector('#window-' + id);
  const frame = node('frame'), seek = node('time'), play = node('play'), replay = node('replay');
  const reduction = matchMedia('(prefers-reduced-motion: reduce)');
  const num = new Intl.NumberFormat(ui.lang,{maximumFractionDigits:1});
  const seconds = v => num.format(v) + t(' ث',' s');
  const save = () => ui.save({schema:1,cues:{...state.cues},time:Math.round(state.time*10)/10,completed:state.completed});
  const failure = node('failure');
  const images = Object.fromEntries([...frame.querySelectorAll('img[data-layer]')].map(img => [img.dataset.layer,img]));
  const unavailable = new Set();
  let active = true, frameRequest = 0, anchor = performance.now()-state.time*1000;

  function refreshMissing() {
    failure.hidden = !unavailable.size;
    failure.querySelector('span').textContent = t('تعذّر عرض جزء من المشهد. وصف اللقطة يتبع التوقيت.','Part of the scene could not be shown. The shot description follows the timing.');
  }
  function loadLayer(id) {
    const img=images[id];
    img.src=asset(id==='reflection'?'boat':id);
  }
  for (const [id,img] of Object.entries(images)) {
    img.onload=()=>{if(!active)return; unavailable.delete(id);refreshMissing();};
    img.onerror=()=>{if(!active)return; unavailable.add(id);refreshMissing();};
    loadLayer(id);
  }
  node('retry').textContent=t('أعد تحميل الرسم','Reload artwork');
  node('retry').onclick=()=>{for(const id of unavailable)loadLayer(id);};
  root.querySelector('label[for="window-time"]').textContent=t('موضع العرض','Playhead');
  replay.textContent=t('من البداية','Replay from start');
  node('cues').querySelector('legend').textContent=t('إشارات المشهد','Scene cues');
  for (const {id,label,max} of cues) {
    const line=element('div',null,'window-cue-line');
    const text=element('label',t(...label));
    const input=element('input'), value=element('output');
    input.type='range'; input.id='window-'+id; input.dir='ltr';
    input.min='0'; input.max=String(max); input.step='0.5'; input.value=String(state.cues[id]);
    text.htmlFor=input.id; value.setAttribute('for',input.id); value.textContent=seconds(state.cues[id]);
    input.setAttribute('aria-valuetext',value.textContent);
    input.oninput=()=>{
      pause();
      state.cues[id]=Number(input.value); state.completed=false;
      value.textContent=seconds(state.cues[id]);
      input.setAttribute('aria-valuetext',value.textContent);
      draw();
    };
    input.onchange=save;
    line.append(text,value); node('cues').append(line,input);
  }

  function describeReading() {
    const {boat,gaze,curtain}=state.cues;
    let glance;
    if(gaze===boat) glance=t('رفعت نظرها مع دخول القارب.','Her gaze lifted as the boat entered.');
    else if(gaze<boat) glance=t('رفعت نظرها قبل دخول القارب بـ','Her gaze lifted before the boat entered by ')+seconds(boat-gaze)+'.';
    else if(gaze<boat+crossingSeconds) glance=t('رفعت نظرها والقارب في النافذة، بعد دخوله بـ','She looked up while the boat was in view, ')+seconds(gaze-boat)+t('.',' after it entered.');
    else glance=t('رفعت نظرها عند خروج القارب أو بعده.','She looked up as the boat left or after it had passed.');
    const cloth=curtain >= boat+crossingSeconds ? t('بقيت الستارة ساكنة طوال العبور.','The curtain stayed still throughout the crossing.')
      : curtain<=boat ? t('بدأت الستارة ترتفع قبل العبور أو معه.','The curtain began to lift by the time the boat crossed.')
      : t('ارتفعت الستارة أثناء العبور.','The curtain lifted during the crossing.');
    return glance+' '+cloth;
  }
  function draw() {
    const {time,cues:marks}=state;
    const gaze=time>=marks.gaze, open=time>=marks.curtain;
    const crossing=time<marks.boat ? 'outside' : time>=marks.boat+crossingSeconds ? 'past' : 'passing';
    const progress=Math.max(0,Math.min(1,(time-marks.boat)/crossingSeconds));
    const passagePose=reduction.matches ? Math.min(.95,.15+Math.floor(progress*3)*.34) : progress;
    const lift=Math.max(0,Math.min(1,(time-marks.curtain)/1.2));
    const drape=reduction.matches ? Number(open) : lift*lift*(3-2*lift);
    const clip=frame.querySelector('.window-crossing');
    clip.hidden=crossing!=='passing';
    clip.style.left=(-23+passagePose*123)+'%';
    images.wait.hidden=gaze; images.gaze.hidden=!gaze;
    images.curtain.style.transform='scale('+ (1-.56*drape) +','+ (1-.13*drape) +') skewX('+ (-6*drape) +'deg)';
    frame.dataset.gaze=gaze?'sea':'lap'; frame.dataset.boat=crossing; frame.dataset.curtain=open?'lifting':'still';
    frame.dataset.motion=reduction.matches?'poses':'continuous';
    const parts=[
      gaze?t('تنظر نحو المرفأ.','She looks towards the harbour.'):t('نظرها إلى يديها.','Her eyes rest on her hands.'),
      open?t('طرف الستارة مرفوع.','The curtain is drawn back.'):t('الستارة ساكنة.','The curtain hangs still.'),
      crossing==='passing'?t('قارب وانعكاسه يعبران النافذة.','A boat and its reflection cross the window.')
        :crossing==='past'?t('خرج القارب من الكادر.','The boat has left the frame.'):t('الماء خالٍ أمام النافذة.','Open water fills the window.'),
    ];
    const caption=parts.join(' ');
    if(node('description').textContent!==caption)node('description').textContent=caption;
    frame.setAttribute('aria-label',t('لقطة من داخل الغرفة','View from inside the room'));
    const timeText=seconds(Math.floor((time+.00001)*10)/10);
    const label=timeText+' / '+seconds(length);
    if (node('clock').textContent!==label) {
      seek.value=String(Math.round(time*10)/10); seek.setAttribute('aria-valuetext',label);
      node('clock').textContent=label;
    }
    play.textContent=state.running?t('إيقاف مؤقت','Pause')
      :time>=length?t('شغّل مجددًا','Play again'):t('شغّل المشهد','Play scene');
    node('reading').hidden=!state.completed;
    if(state.completed)node('reading').textContent=describeReading();
  }
  function pause() {
    if (state.running) state.time=Math.min(length,(performance.now()-anchor)/1000);
    state.running=false;
    cancelAnimationFrame(frameRequest);
  }
  function tick(now) {
    if(!state.running || !active)return;
    state.time=Math.min(length,Math.max(0,(now-anchor)/1000));
    if(state.time>=length){state.running=false;state.completed=true;save();}
    draw();
    if(state.running)frameRequest=requestAnimationFrame(tick);
  }
  function start(fromStart) {
    cancelAnimationFrame(frameRequest);
    if(fromStart || state.time>=length){state.time=0;state.completed=false;}
    anchor=performance.now()-state.time*1000;
    state.running=true;draw();frameRequest=requestAnimationFrame(tick);
  }
  play.onclick=()=>{if(state.running){pause();draw();save();}else start(false);};
  replay.onclick=()=>start(true);
  seek.oninput=()=>{
    const time=Number(seek.value);
    pause();state.time=time;draw();
  };
  seek.onchange=save;
  const onMotion=()=>draw();
  const onHidden=()=>{if(document.hidden && state.running){pause();draw();save();}};
  reduction.addEventListener('change',onMotion);
  document.addEventListener('visibilitychange',onHidden);
  draw();
  if(state.running)frameRequest=requestAnimationFrame(tick);
  return ()=>{
    if(state.running) state.time=Math.min(length,(performance.now()-anchor)/1000);
    active=false;cancelAnimationFrame(frameRequest);
    reduction.removeEventListener('change',onMotion);
    document.removeEventListener('visibilitychange',onHidden);
  };
}
