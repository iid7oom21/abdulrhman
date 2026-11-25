import {el,button,status,actions,board,onLeave} from '../scenes/ui.js';
import {scene,record} from '../scenes/scene-piece.js';
import {link} from '../night-shell.js';
import {INK,paper,screentone,frame,person,bubble} from './art.js';

const title=['فقاعات الحوار','Speech bubbles'];
const intro=['سالم وليان عند نافذة التذاكر. ضع كل جملة في فقاعة بحيث تُقرأ بالترتيب ويشير ذيلها إلى من قالها.','Salem and Layan at the ticket window. Put each line in a bubble so they read in order and each tail points at its speaker.'];
export const LINES=[{speaker:'salem',ar:'آخر تذكرة؟',en:'The last ticket?'},{speaker:'layan',ar:'طارت مع الريح.',en:'It flew off with the wind.'},{speaker:'salem',ar:'إذن نعرض للنوارس.',en:'Then we screen for the gulls.'}];
// Spots in manga reading order (right to left, top to bottom). A spot's tail reaches the character on its side.
export const SPOTS=[{x:404,y:12,side:'salem'},{x:96,y:12,side:'layan'},{x:404,y:116,side:'salem'},{x:96,y:116,side:'layan'}];
const BW=220,BH=96;
const SPOT_NAMES=[['أعلى اليمين','top right'],['أعلى اليسار','top left'],['وسط اليمين','middle right'],['وسط اليسار','middle left']];
const SPEAKERS={salem:{x:668,y:150,ar:'سالم',en:'Salem'},layan:{x:52,y:150,ar:'ليان',en:'Layan'}};
// The tail stops short of the head so it never crosses another bubble.
const tailTip=(p,who)=>{const cx=p.x+BW/2,cy=p.y+BH/2,d=Math.hypot(who.x-cx,who.y-cy);return [who.x-(who.x-cx)*34/d,who.y-(who.y-cy)*34/d];};

export function judge(spots){
  const notes=[];
  if(spots.some(v=>v<0))return {complete:false,ok:false,notes:[['ضع الجمل الثلاث أولًا.','Place all three lines first.']]};
  let ordered=true;
  for(let i=1;i<spots.length;i++)if(spots[i]<spots[i-1]){ordered=false;notes.push(['«'+LINES[i].ar+'» تُقرأ قبل «'+LINES[i-1].ar+'» لأن فقاعتها أسبق في اتجاه القراءة.','“'+LINES[i].en+'” is read before “'+LINES[i-1].en+'” because its bubble comes earlier in reading order.']);}
  let tails=true;
  spots.forEach((spot,i)=>{if(SPOTS[spot].side!==LINES[i].speaker){tails=false;notes.push(['ذيل «'+LINES[i].ar+'» يشير إلى '+SPEAKERS[SPOTS[spot].side].ar+' مع أن '+SPEAKERS[LINES[i].speaker].ar+' هو من قالها.','The tail of “'+LINES[i].en+'” points at '+SPEAKERS[SPOTS[spot].side].en+', but '+SPEAKERS[LINES[i].speaker].en+' says it.']);}});
  if(ordered&&tails)notes.push(['الحوار يُقرأ بترتيبه، وكل ذيل يعود إلى قائله.','The dialogue reads in order and every tail returns to its speaker.']);
  return {complete:true,ok:ordered&&tails,ordered,tails,notes};
}

function draw(ui){
  const {root,t}=ui;
  const saved=ui.editData||ui.load?.()||{};
  const s={spots:LINES.map((_,i)=>Number.isInteger(saved.spots?.[i])&&saved.spots[i]>=0&&saved.spots[i]<4?saved.spots[i]:-1),picked:null,shown:3};
  if(new Set(s.spots.filter(v=>v>=0)).size!==s.spots.filter(v=>v>=0).length)s.spots=LINES.map(()=>-1);
  const stage=board(root,...title,t),msg=status(root),lines=el('div',null,'manga-library'),spots=el('div',null,'manga-slots'),result=el('div',null,'manga-result');
  result.setAttribute('aria-live','polite');root.append(lines,spots);
  let timer=0;onLeave(()=>clearTimeout(timer));
  const persist=()=>ui.save?.({spots:s.spots});
  const ctl=actions(root,button(t('ابدأ من جديد','Start over'),()=>{s.spots=LINES.map(()=>-1);s.picked=null;result.replaceChildren();persist();paint();},'reset'),button(t('اقرأ المشهد','Read the scene'),read,'read'));
  root.append(result,link(t('العودة إلى ليالي الحبر','Back to Ink Nights'),ui.url('ink-studio.html'),'ink-back'));
  function placeAt(spot){
    if(s.picked===null){msg.textContent=t('اختر جملة ثم اختر مكان فقاعتها.','Choose a line, then where its bubble goes.');return;}
    const other=s.spots.indexOf(spot);if(other>=0)s.spots[other]=s.spots[s.picked];
    s.spots[s.picked]=spot;s.picked=null;result.replaceChildren();persist();paint();
  }
  stage.canvas.addEventListener('click',event=>{
    const r=stage.canvas.getBoundingClientRect(),x=(event.clientX-r.left)*720/r.width,y=(event.clientY-r.top)*330/r.height;
    const i=SPOTS.findIndex(p=>x>=p.x&&x<=p.x+BW&&y>=p.y&&y<=p.y+BH);if(i>=0)placeAt(i);
  });
  function read(){
    clearTimeout(timer);const verdict=judge(s.spots);
    if(!verdict.complete){msg.textContent=t(...verdict.notes[0]);return;}
    const order=SPOTS.map((_,spot)=>s.spots.indexOf(spot)).filter(i=>i>=0);
    s.shown=0;paint();
    const step=()=>{s.shown++;paint();const line=LINES[order[s.shown-1]];msg.textContent=s.shown+' · '+t(SPEAKERS[SPOTS[s.spots[order[s.shown-1]]].side].ar,SPEAKERS[SPOTS[s.spots[order[s.shown-1]]].side].en)+': '+t(line.ar,line.en);
      if(s.shown<order.length)timer=setTimeout(step,matchMedia('(prefers-reduced-motion: reduce)').matches?400:1000);else timer=setTimeout(()=>finish(verdict),700);};
    timer=setTimeout(step,300);
  }
  function finish(verdict){
    result.dataset.ok=String(verdict.ok);
    result.replaceChildren(el('h2',verdict.ok?t('يُقرأ الحوار كما كُتب','The dialogue reads as written'):t('هكذا قرأ القارئ مشهدك','This is how a reader took your scene')));
    const list=el('ul',null,'ns-list');verdict.notes.forEach(n=>list.append(el('li',t(...n))));result.append(list);
    actions(result,button(t('احفظ المشهد في دفتري','Save scene to my notebook'),()=>record(ui,t('فقاعات الحوار','Speech bubbles'),'ink-letters',{spots:s.spots,ok:verdict.ok},stage.canvas,msg,{ar:'وزّعت فقاعات حوار',en:'Placed speech bubbles',data:{kind:'manga-bubbles',ok:verdict.ok}}),'save'));
    msg.textContent=t('انتهت القراءة.','Reading finished.');
  }
  function paint(){
    const c=stage.ctx;paper(c,720,330);screentone(c,0,250,720,80,7,1.4);
    c.fillStyle='#e9dfc9';c.fillRect(320,226,80,104);frame(c,320,226,80,104,3);c.fillStyle=INK;c.font='700 16px system-ui';c.textAlign='center';c.fillText(t('تذاكر','TICKETS'),360,250);
    person(c,'layan',52,150,.95,'side');person(c,'salem',668,150,.95,'side');
    const order=SPOTS.map((_,spot)=>s.spots.indexOf(spot)).filter(i=>i>=0);
    order.forEach((line,rank)=>{if(rank>=s.shown)return;const p=SPOTS[s.spots[line]],who=SPEAKERS[p.side];const [tx,ty]=tailTip(p,who);bubble(c,p.x,p.y,BW,BH,tx,ty,t(LINES[line].ar,LINES[line].en),ui.lang!=='en',ui.lang==='en'?22:26);});
    SPOTS.forEach((p,i)=>{if(s.spots.includes(i))return;c.save();c.setLineDash([6,6]);c.strokeStyle='#8a8577';c.lineWidth=2;c.beginPath();c.ellipse(p.x+BW/2,p.y+BH/2,BW/2,BH/2,0,0,7);c.stroke();c.fillStyle='#8a8577';c.font='600 24px system-ui';c.textAlign='center';c.fillText(String(i+1),p.x+BW/2,p.y+BH/2+8);c.restore();});
    frame(c,6,6,708,318,5);
    stage.caption.textContent=t('تُقرأ الفقاعات من اليمين لليسار ومن أعلى لأسفل. ','Bubbles read right to left, top to bottom. ')+LINES.map((l,i)=>t(l.ar,l.en)+' → '+(s.spots[i]>=0?t(...SPOT_NAMES[s.spots[i]]):t('لم توضع','not placed'))).join(' · ');
    lines.replaceChildren(el('h2',t('الجمل','Lines')),...LINES.map((l,i)=>{const b=button(t(SPEAKERS[l.speaker].ar,SPEAKERS[l.speaker].en)+': '+t(l.ar,l.en),()=>{s.picked=s.picked===i?null:i;paint();msg.textContent=s.picked===null?'':t('اختر مكان الفقاعة.','Choose where the bubble goes.');},'line-'+i);b.setAttribute('aria-pressed',String(s.picked===i));return b;}));
    spots.replaceChildren(el('h2',t('أماكن الفقاعات بترتيب القراءة','Bubble spots in reading order')),...SPOTS.map((p,i)=>{const at=s.spots.indexOf(i);return button((i+1)+' · '+t(...SPOT_NAMES[i])+t(' (ذيل إلى ',' (tail to ')+t(SPEAKERS[p.side].ar,SPEAKERS[p.side].en)+') — '+(at>=0?t(LINES[at].ar,LINES[at].en):t('فارغ','empty')),()=>placeAt(i),'spot-'+i);}));
  }
  paint();
}
export default scene('ink-letters',title,intro,draw);
