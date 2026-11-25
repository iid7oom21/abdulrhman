import {el,board,actions,button,status,file,indices,transport,bound,onLeave,begin} from './ui.js';
import {windows} from './art.js';
import {scene,recall,record} from './scene-piece.js';

const title=['سبع نوافذ مضاءة', 'Seven lit windows'];
const intro=['أمامك ثلاثون ثانية لاختيار ثلاث نوافذ وترتيبها. تستطيع إيقاف الساعة لتقرأ.', 'Choose and order three windows in thirty seconds. Pause the clock to read.'];
const stories=[
  [['العازف','The musician'],['يتمرّن عازف على جملة قصيرة.','A violinist repeats a short phrase.']],
  [['الطائرة الورقية','Paper plane'],['يطوي طفل طرف الورقة ويطلق طائرته.','A child folds a wing and launches a paper plane.']],
  [['المكتبة الصغيرة','Little library'],['ترتّب أمينة الكتب الرف الأخير.','A librarian lines up the final shelf.']],
  [['مشغّل الأسطوانات','Record player'],['تدور أسطوانة في غرفة الطابق العلوي.','A record turns in the upstairs room.']],
  [['حديقة الشرفة','Balcony garden'],['تميل أوراق الريحان نحو النافذة.','Basil leaves lean toward the window.']],
  [['صانع الساعات','Clock repairer'],['يراقب صانع الساعات عقرب الدقائق.','A clock repairer watches the minute hand.']],
  [['مسار الطائرة','Flight path'],['تمرّ طائرة النافذة الثانية أمام الزجاج.','The paper plane from window two glides past.']]
];
function aperture(ui){
  const {root,t}=ui,params=new URLSearchParams(location.search);
  const s=recall(ui,d=>({order:indices(d.windows,8,3).filter(v=>v>0).map(v=>v-1),phase:'choose',remaining:30,at:0,missed:-1,completed:false,started:false,feature:Math.round(bound(d.feature,0,0,2))}));
  const titlePiece=params.has('evening')?ui.pieces().find(p=>p.id===params.get('titlePiece')&&p.activity==='titles'):null;
  const actualTitle=titlePiece?String(titlePiece.title).slice(0,100):t('ليلتي من ثلاث نوافذ','My night in three windows');
  if(titlePiece)root.append(el('p',t('عنوانك المختار · ','Your selected title · ')+actualTitle));
  const view=board(root,...title,t),clock=el('output'),pick=actions(root),list=el('ol',null,'ns-list'),menu=actions(root),screen=el('div'),extras=el('div'),msg=status(root);
  root.append(clock,list,screen,extras);
  const label=i=>t(...stories[i][0]),story=i=>t(...stories[i][1]);
  let interval=0,latest=0,player;
  function pause(){if(interval){s.remaining=Math.max(0,s.remaining-(performance.now()-latest)/1000);clearInterval(interval);interval=0;}timeText();}
  function timeText(){clock.value=t('الوقت المتاح ','Time available ')+Math.ceil(s.remaining)+t(' ث',' s');toggle.textContent=interval?t('أوقف ساعة الاختيار','Pause selection clock'):t('شغّل ساعة الاختيار','Run selection clock');}
  function start(){if(interval||s.remaining<=0)return;latest=performance.now();interval=setInterval(()=>{const now=performance.now();s.remaining=Math.max(0,s.remaining-(now-latest)/1000);latest=now;if(s.remaining===0){pause();sync();}else{timeText();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)windows(view.ctx,-1,30-s.remaining);}},150);timeText();}
  const toggle=button('',()=>interval?pause():start(),'clock');
  const launch=button(t('اعرض نوافذي الثلاث','Screen my three windows'),()=>{pause();s.phase='screen';s.at=0;s.completed=false;render();},'screen');
  const reset=button(t('اختيار جديد','New selection'),()=>{pause();s.remaining=30;s.started=false;s.phase='choose';s.order=[];s.missed=-1;s.completed=false;s.feature=0;render();},'retry');
  function sync(){
    timeText();launch.disabled=s.order.length!==3;toggle.disabled=s.remaining<=0;
    list.replaceChildren(...s.order.map(i=>el('li',label(i))));
    pick.querySelectorAll('button').forEach((b,i)=>{b.setAttribute('aria-pressed',String(s.order.includes(i)));b.disabled=(s.remaining<=0||s.order.length===3)&&!s.order.includes(i);});
    if(s.phase==='choose'){windows(view.ctx,-1,30-s.remaining);view.caption.textContent=s.remaining===0?t('انتهى وقت الاختيار. اعرض ترتيبًا مكتملًا أو أعد المحاولة.','Selection time has ended. Screen a complete list or try again.'):t('اختر النافذة الأولى ثم الثانية ثم الثالثة. اضغط الاختيار مجددًا لإزالته.','Choose the first window, then the second and third. Select again to remove it.');}
  }
  function render(){
    begin(ui);aperture(ui);
  }
  function visibility(){if(document.hidden)pause();}
  document.addEventListener('visibilitychange',visibility);
  onLeave(()=>{pause();document.removeEventListener('visibilitychange',visibility);});
  if(s.phase==='choose'){
    stories.forEach((v,i)=>pick.append(button(label(i),()=>{if(!s.started){s.started=true;start();}if(s.order.includes(i))s.order=s.order.filter(n=>n!==i);else if(s.remaining>0&&s.order.length<3)s.order.push(i);sync();},'window-'+i)));
    menu.append(toggle,launch,reset);sync();return;
  }
  clock.hidden=true;list.replaceChildren(...s.order.map(i=>el('li',label(i))));
  if(s.order.length!==3){s.phase='choose';render();return;}
  function output(){
    const data={windows:s.order.map(i=>i+1),feature:s.feature,seconds:9};
    if(titlePiece)data.titlePiece=titlePiece.id;
    return data;
  }
  player=transport(screen,ui,9,seconds=>{s.at=seconds;const n=Math.min(2,Math.floor(seconds/3)),id=s.order[n];windows(view.ctx,id,seconds%3);view.caption.textContent=label(id)+' · '+story(id);},()=>{s.completed=true;showEnd();},s.at);
  player.update();menu.append(reset);
  function showEnd(){
    extras.replaceChildren();if(!s.completed)return;
    extras.append(el('h2',actualTitle),el('p',t('أي لقطة تختارها لغلاف العرض؟','Which shot should appear on the cover?')));
    const stills=actions(extras);
    function feature(k){s.feature=k;const id=s.order[k];windows(view.ctx,id,1.5);view.caption.textContent=label(id)+' · '+story(id);stills.querySelectorAll('button').forEach((b,n)=>b.setAttribute('aria-pressed',String(n===k)));}
    s.order.forEach((id,k)=>stills.append(button(label(id),()=>feature(k),'feature-'+k)));
    feature(s.feature);const bar=actions(extras);
    bar.append(button(t('احفظ ليلتي','Save my night'),()=>{feature(s.feature);const p=record(ui,label(s.order[s.feature]),'scene',output(),view.canvas,msg,{ar:'عُرضت ثلاث نوافذ من العمارة.',en:'Three apartment windows were screened.',data:output()});
      if(p&&titlePiece){const a=el('a',t('عاين ما ينتقل إلى الفصل الثالث','Review transfer to chapter three'));const url=new URL('./three-evening.html',location.href);url.search=new URLSearchParams({titlePiece:titlePiece.id,shotPiece:p.id,lang:ui.lang});a.href=url;bar.append(a);}},'save'),
      button(t('نزّل ترتيب النوافذ','Download window order'),()=>file('raven-windows.json',JSON.stringify(output(),null,2)),'export'));
    extras.append(el('h3',t('النوافذ التي فاتتك','Windows you missed')));const omitted=actions(extras);
    stories.forEach((_,i)=>{if(!s.order.includes(i))omitted.append(button(label(i),()=>{player.stop();s.missed=i;windows(view.ctx,i,1.5);view.caption.textContent=label(i)+' · '+story(i);},'missed-'+i));});
  }
  showEnd();
}

export default scene('seven-windows',title,intro,aperture);
