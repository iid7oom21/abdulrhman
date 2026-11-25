import {action, element, link, mount} from '../night-shell.js';

const pier = {
  plate: 'pier',
  seconds: 3,
  alt: ['مسافر بمعطف أخضر ينتظر على رصيف مبتل. خلف الجسر القصير عبّارة مضاءة.', 'A traveller in a green coat waits on the wet pier. A lit ferry lies beyond the gangway.'],
  caption: ['من آخر الرصيف، تبدو نوافذ العبّارة أدفأ من مصابيح الميناء.', 'From the end of the pier, the ferry windows look warmer than the harbour lights.'],
};
const paths = {
  shore: {
    button: ['ابقَ على الرصيف','Stay on the pier'],
    shot: {
      plate: 'signal', seconds: 5,
      alt: ['عامل المرفأ يرفع فانوسًا مضاءً فوق رأسه بجانب العبّارة.', 'The harbour attendant holds a lit lantern above his head beside the ferry.'],
      caption: ['ترتفع يد العامل. ضوء الفانوس هو إشارة الصعود.', 'The attendant raises his hand. The lantern is the signal to board.'],
    },
    ending: ['بقيتَ مع العامل عند الإشارة. آخر ما رأيتَه الفانوس فوق الرصيف.', 'You stayed with the attendant. Your last image is the lantern held over the pier.'],
  },
  passenger: {
    button: ['رافق المسافر','Follow the traveller'],
    shot: {
      plate: 'deck', seconds: 5,
      alt: ['المسافر نفسه يتقدّم على سطح العبّارة. تنعكس نوافذ المقصورة على ألواح الخشب.', 'The same traveller steps along the ferry deck. Cabin light reflects on the wooden planks.'],
      caption: ['تترك يدُه حاجز الجسر عند باب المقصورة. صار الميناء خلف كتفه.', 'His hand leaves the gangway rail at the cabin door. The harbour is over his shoulder now.'],
    },
    ending: ['عبرتَ مع المسافر. ينتهي مشهدك عند باب المقصورة، والميناء خلفك.', 'You crossed with the traveller. Your scene ends at the cabin door, with the harbour behind you.'],
  },
};
const sequence = {path: null, elapsed: 0, playing: false};

function render(ui) {
  const {root,t}=ui;
  const occupied=()=>sequence.path !== null;
  const total=()=>occupied() ? pier.seconds+paths[sequence.path].shot.seconds : 0;
  const finished=()=>occupied() && sequence.elapsed>=total();
  const now=()=>performance.now()/1000;
  let timer, anchor=now()-sequence.elapsed, lastPlate, failed=false;

  const stage=element('figure',null,'ink-stage');
  const image=element('img');
  image.width=896;image.height=504;
  const caption=element('figcaption');
  const recovery=element('div',null,'ink-controls');recovery.hidden=true;
  const retry=action(t('أعد تحميل اللقطة','Reload frame'),()=>{
    failed=false; recovery.hidden=true;
    // Reload the same file. The playhead and selected viewpoint stay in place.
    const url=new URL(image.src);url.searchParams.set('retry',String(Date.now()));image.src=url.href;
  });
  recovery.append(retry);
  image.addEventListener('error',()=>{failed=true;recovery.hidden=false;});
  image.addEventListener('load',()=>{failed=false;recovery.hidden=true;});
  stage.append(image,caption);
  const choices=element('div',null,'ink-controls');
  const optionButtons=Object.entries(paths).map(([id,path])=>{
    const button=action(t(...path.button),()=>begin(id));button.dataset.viewpoint=id;return button;
  });
  choices.append(...optionButtons);
  const controls=element('div',null,'ink-controls');
  const toggle=action('',()=>{
    if(sequence.playing) pause();
    else if (finished()) begin(sequence.path);
    else resume();
  });
  toggle.dataset.ferry='play';
  const next=action('',()=>{
    sequence.elapsed=sequence.elapsed<pier.seconds ? pier.seconds : total();
    anchor=now()-sequence.elapsed;
    sync();
  });
  next.dataset.ferry='next';
  const reset=action(t('اختَر زاوية أخرى','Choose another viewpoint'),()=>{
    stopTimer();Object.assign(sequence,{path:null,elapsed:0,playing:false});
    sync();optionButtons[0].focus();
  });
  controls.append(toggle,next,reset);
  const clock=element('div',null,'ink-controls');
  const meter=element('progress');meter.max=8;meter.value=0;
  meter.setAttribute('aria-label',t('موضع العرض','Playback position'));
  const time=element('span');time.dir='ltr';clock.append(meter,time);
  const result=element('p',null,'ink-result');result.setAttribute('role','status');
  const shelf=link(t('العودة إلى ليالي الحبر','Back to Ink Nights'),ui.url('./ink-studio.html'));
  root.append(stage,recovery,choices,clock,controls,result,shelf);

  function stopTimer(){clearInterval(timer);timer=undefined;}
  function resume(){sequence.playing=true;anchor=now()-sequence.elapsed;startTimer();sync();}
  function begin(id){
    Object.assign(sequence,{path:id,elapsed:0,playing:true});
    anchor=now();startTimer();sync();toggle.focus({preventScroll:true});
  }
  function pause(){
    if(sequence.playing)sequence.elapsed=Math.min(total(),Math.max(0,now()-anchor));
    sequence.playing=false;stopTimer();sync();
  }
  function startTimer(){stopTimer();timer=setInterval(sync,100);}
  function sync() {
    if(sequence.playing)sequence.elapsed=Math.min(total(),Math.max(0,now()-anchor));
    if(finished()){sequence.playing=false;stopTimer();}
    const shot=occupied() && sequence.elapsed>=pier.seconds ? paths[sequence.path].shot : pier;
    if(lastPlate!==shot.plate){
      lastPlate=shot.plate;failed=false;recovery.hidden=true;
      image.src=new URL('./art/ferry-'+shot.plate+'.webp',import.meta.url).href;
      image.dataset.plate=shot.plate;image.alt=t(...shot.alt);
      caption.textContent=t(...shot.caption);
    }
    choices.hidden=occupied();
    clock.hidden=!occupied();controls.hidden=!occupied();
    next.hidden=finished();
    toggle.textContent=finished()?t('أعد عرض المشهد','Replay scene'):sequence.playing?t('أوقف مؤقتًا','Pause'):t('أكمل العرض','Resume');
    next.textContent=sequence.elapsed<pier.seconds?t('اللقطة التالية','Next shot'):t('إلى النهاية','Go to ending');
    meter.value=sequence.elapsed;
    time.textContent=Math.floor(sequence.elapsed)+' / '+total()+t(' ث',' s');
    result.hidden=!finished();
    if(finished())result.textContent=t(...paths[sequence.path].ending);
    recovery.hidden=!failed;
  }
  function visibility(){if(document.hidden && sequence.playing)pause();}
  document.addEventListener('visibilitychange',visibility);
  if(sequence.playing)startTimer();
  sync();
  return ()=>{
    if(sequence.playing)sequence.elapsed=Math.min(total(),Math.max(0,now()-anchor));
    stopTimer();document.removeEventListener('visibilitychange',visibility);
  };
}

mount({
  id:'ink-ferry',title:['آخر عبّارة','The Last Ferry'],
  intro:['العبّارة تستعد للمغادرة. اختر أين تبقى الكاميرا عند إشارة الصعود.','The ferry is about to leave. Choose where the camera stays when boarding begins.'],
  render,
});
