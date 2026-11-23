import {dailyRound,duration,score,SHOTS} from '../../after-show/edit-rules.js';
import {begin,board,button,actions,el,transport,status,downloadCanvas,thumbnail,indices} from './ui.js';
import {museum,theaterCard} from './art.js';
const version='coastal-weekend-v1',key='raven.late-night.weekend.v1';
const options=[['آلة التذاكر','Ticket punch'],['طاحونة اللعبة','Toy mill'],['جرس المتجر','Shop bell']];
const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
function validDate(d){return typeof d==='string'&&/^\d{4}-\d\d-\d\d$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;}
export function assignment(date){
  let hash=0;for(const letter of version+date)hash=(Math.imul(hash,31)+letter.codePointAt(0))>>>0;
  return {round:dailyRound(date),order:permutations[hash%permutations.length]};
}
const utc=()=>new Date().toISOString().slice(0,10);
function initial(date){return {version,date,step:1,shots:[],order:[],practice:false};}
function restore(raw){
  if(!raw||!validDate(raw.date)||raw.version!==version)return null;
  const {round,order}=assignment(raw.date),shots=Array.isArray(raw.shots)?[...new Set(raw.shots.filter(id=>round.library.includes(id)))].slice(0,round.slots):[];
  const chosen=indices(raw.order,3,3),rating=score(round,shots),valid=raw.practice===true?rating.structure:rating.pass;
  return {...initial(raw.date),shots,order:chosen,practice:raw.practice===true,
    step:raw.step>=2&&valid?(raw.step===3&&chosen.length===3&&(raw.practice||chosen.join()===order.join())?3:2):1};
}
let s;
function load(){
  if(s)return;
  const query=new URLSearchParams(location.search).get('date');
  try{s=restore(JSON.parse(sessionStorage.getItem(key)));}catch{}
  if(!s)s=initial(validDate(query)?query:utc());
}
function write(){try{sessionStorage.setItem(key,JSON.stringify(s));return true;}catch{return false;}}
const title=['تحدّي نهاية الأسبوع','Weekend double feature'];
export const weekend={id:'weekend',title,intro:['أنجز مونتاج اليوم ثم صمّم ترتيب بطاقة بريدية. يرتبط التكليف بتاريخ بدء الجولة.','Complete the daily cut, then compose a postcard. Your assignment is pinned to the date you start.'],render};
function render(ui){
  begin(ui);
  if(!s&&ui.editData){const piece=restore({...ui.editData,step:3});if(piece)s=piece;}
  load();
  const {root,t}=ui,{round,order}=assignment(s.date);
  root.append(el('p',s.date+' UTC · '+version+' · '+(s.practice?t('تدريب مفتوح','Open practice'):t('تحدي المادتين','Two-part challenge'))));
  const msg=status(root),slot=el('div');root.append(slot);
  function restart(practice=false,date=s.date){s=initial(date);s.practice=practice;write();render(ui);}
  const retry=()=>actions(root,button(t('أعد هذه الجولة','Restart this round'),()=>restart(s.practice),'retry'));
  function remember(){if(!write())msg.textContent=t('التكليف باقٍ في هذه النافذة. تعذّر استئنافه بعد إغلاقها.','This window keeps your round. Storage could not preserve it after closing.');}
  if(s.step===1){
    slot.append(el('h2',t('١ · مونتاج اليوم','1 · Daily cut')+' — '+round.title[ui.lang]),el('p',s.practice?t('اختر أي ترتيب من مكتبة اليوم. عدد اللقطات ','Choose any order from today’s library. Shots required: ')+round.slots:round.brief[ui.lang]));
    const palette=actions(slot),list=el('ol',null,'ns-list'),buttons=actions(slot),screen=el('div');slot.append(list,screen);
    let player;
    function sync(){
      list.replaceChildren(...s.shots.map(id=>el('li',SHOTS[id].name[ui.lang]+' · '+SHOTS[id].seconds+' s')));
      palette.querySelectorAll('button').forEach((b,i)=>{b.disabled=s.shots.length>=round.slots||s.shots.includes(round.library[i]);});
      undo.disabled=!s.shots.length;watch.disabled=s.shots.length!==round.slots;
    }
    round.library.forEach(id=>palette.append(button(SHOTS[id].name[ui.lang]+' · '+SHOTS[id].seconds+' s',()=>{player?.stop();screen.replaceChildren();s.shots.push(id);remember();sync();},'shot-'+id)));
    const undo=button(t('ارفع آخر لقطة','Remove last shot'),()=>{player?.stop();screen.replaceChildren();s.shots.pop();remember();sync();},'undo');
    const watch=button(t('اعرض المونتاج','Screen the cut'),()=>{
      player?.stop();screen.replaceChildren();
      const img=el('img',null,'ns-still'),cap=el('p'),result=el('div');screen.append(img,cap);
      let previous=null;
      const retryImage=button(t('أعد تحميل صورة هذه اللقطة','Retry this shot image'),()=>{if(previous){img.hidden=false;img.src='../after-show/assets/'+previous+'.webp';}},'retry-image');
      retryImage.hidden=true;screen.append(retryImage);
      img.onerror=()=>{img.hidden=true;retryImage.hidden=false;};img.onload=()=>{retryImage.hidden=true;};
      player=transport(screen,ui,duration(s.shots),sec=>{
        let sum=0;const id=s.shots.find(k=>{sum+=SHOTS[k].seconds;return sec<sum;})||s.shots.at(-1);
        if(id!==previous){previous=id;img.hidden=false;retryImage.hidden=true;img.alt=SHOTS[id].description[ui.lang];img.src='../after-show/assets/'+id+'.webp';cap.textContent=img.alt;}
      },()=>{
        result.replaceChildren();
        const rating=score(round,s.shots);
        const passes=s.practice?rating.structure:rating.pass;
        result.append(el('p',s.practice?t('اكتملت نسخة التدريب.','Your practice cut is ready.'):passes?t('اكتمل المونتاج ضمن التكليف.','Your cut meets the brief.'):t('راجع ترتيب اللقطات وحد الوقت.','Review the shot order and time limit.')));
        if(passes)result.append(button(t('انتقل إلى البطاقة','Continue to postcard'),()=>{s.step=2;remember();render(ui);},'next'));
      });screen.append(result);player.update();
    },'screen');buttons.append(undo,watch);sync();retry();
  }else if(s.step===2){
    slot.append(el('h2',t('٢ · بطاقة ست ثوانٍ','2 · Six-second postcard')),
      el('p',s.practice?t('رتّب آلات المتحف الثلاث كما تشاء.','Choose any museum sequence.'):t('من البداية إلى النهاية · ','From beginning to end · ')+order.map(i=>t(...options[i])).join(' / ')));
    const v=board(slot,...title,t),buttons=actions(slot),list=el('ol',null,'ns-list'),screen=el('div');
    slot.append(list,screen);
    let player;
    function sync(){
      museum(v.ctx,s.order.at(-1)??0,0);v.caption.textContent=t('كل معروض يظهر لمدة ثانيتين.','Each exhibit appears for two seconds.');
      list.replaceChildren(...s.order.map((id,i)=>el('li',i*2+'–'+(i+1)*2+' s · '+t(...options[id]))));
      buttons.querySelectorAll('button').forEach((b,i)=>b.disabled=s.order.includes(i));undo.disabled=!s.order.length;watch.disabled=s.order.length!==3;
    }
    options.forEach((v,i)=>buttons.append(button(t(...v),()=>{player?.stop();screen.replaceChildren();s.order.push(i);remember();sync();},'post-'+i)));
    const undo=button(t('ارفع آخر آلة','Remove last exhibit'),()=>{player?.stop();screen.replaceChildren();s.order.pop();remember();sync();},'undo');
    const watch=button(t('اختبر البطاقة','Test the postcard'),()=>{
      player?.stop();screen.replaceChildren();const result=el('div');
      player=transport(screen,ui,6,sec=>{const i=s.order[Math.min(2,Math.floor(sec/2))];museum(v.ctx,i,sec%2);v.caption.textContent=t(...options[i]);},()=>{
        result.replaceChildren();
        if(s.practice||s.order.join()===order.join())result.append(button(t('أصدر بطاقة التحدي','Make challenge card'),()=>{s.step=3;remember();render(ui);},'finish'));
        else result.append(el('p',t('ترتيب البطاقة مختلف عن تكليف هذا التاريخ. أعد ترتيبها.','The card order differs from the brief for this date. Rearrange the cues.')));
      });screen.append(result);player.update();
    },'screen');actions(slot,undo,watch);sync();retry();
  }else{
    const v=board(slot,...title,t);
    theaterCard(v.ctx,t(...title),[s.date+' UTC',s.shots.map(id=>SHOTS[id].name[ui.lang]).join(' · '),s.order.map(i=>t(...options[i])).join(' · ')]);
    v.caption.textContent=t('بطاقة عرضك · ','Your screening card · ')+duration(s.shots)+' + 6 s';
    const data={version,date:s.date,practice:s.practice,shots:[...s.shots],order:[...s.order],seconds:duration(s.shots)+6};
    actions(slot,button(t('نزّل بطاقة العرض PNG','Download screening card PNG'),()=>downloadCanvas(v.canvas,'raven-weekend-'+s.date+'.png'),'export'),
      button(t('أضف البطاقة إلى دفتري','Save card to notebook'),()=>{
        const p=ui.savePiece({title:t(...title)+' · '+s.date,type:'postcard',data,thumbnail:thumbnail(v.canvas)});
        msg.textContent=p?t('حُفظت البطاقة.','Card saved.'):t('تعذّر الحفظ. يمكنك تنزيل البطاقة.','Could not save. You can download the card.');
        if(p)ui.recordEvent({ar:'اكتمل تحدي المونتاج والبطاقة.',en:'The cut and postcard challenge was completed.',data:{date:s.date,seconds:data.seconds}});
      },'save'),button(t('افتح التدريب','Open practice'),()=>restart(true),'practice'));
  }
  if(utc()!==s.date)actions(root,button(t('ابدأ تكليف اليوم الجديد','Start the current UTC assignment'),()=>restart(false,utc()),'new-date'));
}
