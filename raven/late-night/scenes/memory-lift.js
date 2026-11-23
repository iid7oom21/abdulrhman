import {el,board,actions,button,status,file,indices,bound} from './ui.js';
import {lobby} from './art.js';
import {scene,recall,record} from './scene-piece.js';

const title=['المصعد الذي يتذكّر', 'The lift that remembers'];
const intro=['في بهو ١٩٧٨ غيّر موضع قطعة، ثم اركب المصعد لترى أثرها في زمنين.', 'Move an object in the 1978 lobby, then visit two later versions of the room.'];
const objectNames=[['الكرسي','Chair'],['المصباح','Lamp'],['السجادة','Rug']];
const eraNames=[['١٩٧٨','1978'],['٢٠٠٤','2004'],['الليلة','Tonight']];
const originals=[['الكرسي بجوار باب المصعد.','The chair stands near the lift.'],['المصباح عند الجدار الأيسر.','The lamp is against the left wall.'],['السجادة وسط البهو.','The rug lies in the middle of the lobby.']];
const traces=[
  [['نقلت الكرسي إلى النافذة.','You moved the chair to the window.'],['على المقعد عند النافذة غطاء خفيف.','A thin cover lies on the chair by the window.'],['تحت النافذة بقي الكرسي بوسادة جديدة.','The window chair has a new cushion.']],
  [['نقلت المصباح إلى باب المصعد.','You moved the lamp to the lift.'],['بقي المصباح عند باب المصعد.','The lamp remains beside the lift.'],['ينير المصباح باب المصعد.','The lamp now lights the lift door.']],
  [['مددت السجادة أمام المصعد.','You laid the rug outside the lift.'],['خط إصلاح على سجادة المصعد.','A repair seam crosses the lift rug.'],['خياطة ثانية تعبر طرف سجادة المصعد.','Another seam crosses the edge of the lift rug.']]
];
function lift(ui){
  const {root,t}=ui,s=recall(ui,d=>({era:Math.round(bound(d.era,0,0,2)),changes:indices(d.changes,3,3)}));
  const b=board(root,...title,t),eras=actions(root),moves=actions(root),map=el('ol',null,'ns-list');root.append(map);
  const msg=status(root),name=i=>t(...eraNames[i]);
  function update(){
    const changed=objectNames.map((_,i)=>s.changes.includes(i));lobby(b.ctx,s.era,changed);
    b.caption.textContent=name(s.era)+' · '+objectNames.map((_,i)=>t(...(changed[i]?traces[i][s.era]:originals[i]))).join(' ');
    eras.querySelectorAll('button').forEach((x,i)=>x.setAttribute('aria-pressed',String(s.era===i)));
    moves.hidden=s.era!==0;moves.querySelectorAll('button').forEach((x,i)=>x.setAttribute('aria-pressed',String(changed[i])));
    map.replaceChildren(...s.changes.map(i=>el('li',name(0)+' — '+t(...traces[i][0])+(s.era?' · '+name(s.era)+' — '+t(...traces[i][s.era]):''))));
    if(!s.changes.length)map.append(el('li',t('خريطة التغيير فارغة.','No changes on the map.')));
    msg.textContent='';
  }
  eraNames.forEach((v,i)=>eras.append(button(name(i),()=>{s.era=i;update();},'era-'+i)));
  const verbs=[['ضع الكرسي عند النافذة','Place chair at window'],['قرّب المصباح من المصعد','Move lamp to lift'],['مدّ السجادة عند المصعد','Move rug to lift']];
  verbs.forEach((v,i)=>moves.append(button(t(...v),()=>{s.changes=s.changes.includes(i)?s.changes.filter(v=>v!==i):[...s.changes,i];update();},'move-'+i)));
  const data=()=>({era:s.era,changes:[...s.changes],seconds:6});
  actions(root,button(t('احفظ خريطة البهو','Save lobby map'),()=>record(ui,t(...title),'scene',data(),b.canvas,msg,{ar:'جرى توثيق خريطة البهو.',en:'A lobby map was recorded.',data:{era:s.era,moved:s.changes.length}}),'save'),
    button(t('نزّل الخريطة','Download map'),()=>file('raven-lobby.json',JSON.stringify(data(),null,2)),'export'),
    button(t('ابدأ ببهو ١٩٧٨','Reset to 1978'),()=>{s.era=0;s.changes=[];update();},'retry'));update();
}

export default scene('memory-lift',title,intro,lift);
