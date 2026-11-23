import {chooseStudioBoard,playStudioBoard} from './studio-screening.js';
import {begin,el,board,button,actions,control,select,file,status,transport} from './ui.js';
import {validScene,paintScene,describe} from '../creative/scene.js';
import {lobby,windows,theater} from './art.js';

const studioSelections=new Map();
const practice=[
  {id:'sample-lobby',title:['مقعد عند النافذة','Seat by the window'],seconds:6,settings:['نُقل الكرسي في ١٩٧٨ وبقي عند النافذة الليلة.','The chair was moved in 1978 and remains by the window tonight.'],paint:c=>lobby(c,2,[true,false,false])},
  {id:'sample-plane',title:['آخر ضوء للطائرة','Last light for a paper plane'],seconds:3,settings:['اختار الصانع النافذة السابعة بعد إطلاق الطائرة.','The maker selected the seventh window after the plane was launched.'],paint:c=>windows(c,6,1.2)},
  {id:'sample-stage',title:['دخول على ضوء واحد','Entrance under one lamp'],seconds:8,settings:['أُشعل المصباح في الثانية الأولى، ثم فُتحت الستارة ودخل العازف.','The light came on at one second, then the curtain opened and the musician entered.'],paint:c=>theater(c,[2,1,3],5)}
];
let s={selection:[],index:0,phase:'setup',readings:[],notes:[],lengths:[],input:'',reading:''};
const title=['غرفة المشاهدة على جهاز واحد','One-device screening room'];
export const screening={id:'screening-room',title,intro:['اختارا ثلاث قطع. يقدّم الأول الصورة، يقرأها الثاني، ثم يكشف الصانع إعداداتها.','Pick three pieces. The maker presents each image, the viewer reads it, then the maker reveals the setup.'],render};
function render(ui){
  begin(ui);const {root,t}=ui;
  const library=[...ui.pieces().filter(p=>p.activity!=='screening-room').map(p=>{
    const directorScene=p.activity==='director-sentence' && validScene(p.data)?p.data:null;
    const sourceSeconds=[directorScene?.duration,p.data.seconds,p.data.duration].find(n=>Number.isFinite(n)&&n>0);
    return {id:p.id,title:p.title,thumbnail:p.thumbnail,seconds:sourceSeconds??6,sourceSeconds,directorScene,
      settings:JSON.stringify(p.data,null,2),type:p.type};
  }),...practice.map(p=>({...p,title:t(...p.title),settings:t(...p.settings),type:t('تدريب','Training')}))];
  library.push(...studioSelections.values());
  const selected=s.selection.map(id=>library.find(p=>p.id===id));
  // A piece can be removed in a second tab; keep the other selections.
  if(selected.some(p=>!p)){s.selection=s.selection.filter(id=>library.some(p=>p.id===id));s.phase='setup';s.index=0;}
  const redraw=()=>render(ui);
  const reset=()=>{studioSelections.clear();s={selection:[],index:0,phase:'setup',readings:[],notes:[],lengths:[],input:'',reading:''};redraw();};
  if(s.phase==='setup'){
    if(s.selection.length<3)chooseStudioBoard(ui,root,board=>{
      studioSelections.set(board.id,board);
      if(!s.selection.includes(board.id))s.selection.push(board.id);
      redraw();
    });
    const list=el('ol',null,'ns-list'),choices=actions(root),note=status(root);
    library.forEach(p=>{const i=s.selection.indexOf(p.id);const b=button(p.title,()=>{if(i>=0)s.selection.splice(i,1);else if(s.selection.length<3)s.selection.push(p.id);redraw();},'pick-'+p.id);
      b.setAttribute('aria-pressed',String(i>=0));b.disabled=i<0&&s.selection.length>=3;choices.append(b);});
    selected.filter(Boolean).forEach(p=>list.append(el('li',p.title+' · '+p.seconds+' s')));
    root.append(list);const start=button(t('ابدآ برنامج العرض','Begin screening programme'),()=>{
      if(s.selection.length!==3){note.textContent=t('اختارا ثلاث قطع أولًا.','Choose three pieces first.');return;}
      s.lengths=s.selection.map(id=>library.find(p=>p.id===id).seconds);s.phase='present';s.index=0;redraw();
    },'start');start.disabled=s.selection.length!==3;actions(root,start);return;
  }
  if(s.phase==='program'){
    root.append(el('h2',t('برنامج هذه الأمسية','Tonight’s screening programme')));
    const list=el('ol',null,'ns-list');
    const lines=selected.map((p,i)=>p.title+' · '+s.lengths[i]+' s');lines.forEach(v=>list.append(el('li',v)));root.append(list);
    const total=s.lengths.reduce((v,n)=>v+n,0);
    root.append(el('p',t('زمن البرنامج ','Programme duration ')+total+' s'));
    actions(root,button(t('نزّلا برنامج العرض','Download programme'),()=>file('raven-screening-programme.txt',[t(...title),...lines,t('المدة الكلية ','Total duration ')+total+' s'].join('\n'),'text/plain;charset=utf-8'),'export'),button(t('أمسية جديدة','New screening'),reset,'retry'));
    return;
  }
  const current=selected[s.index];
  if(s.phase==='cover-view' || s.phase==='cover-maker'){
    const mask=el('section',null,'ns-wash');
    const viewer=s.phase==='cover-view';mask.append(el('h2',viewer?t('سلّم الجهاز إلى المشاهد','Hand the device to the viewer'):t('أعد الجهاز إلى الصانع','Hand the device back to the maker')),
      el('p',t('اضغط عندما يصبح الجهاز بيدك.','Continue when you hold the device.')),
      button(viewer?t('أنا المشاهد','I am the viewer'):t('أنا الصانع','I am the maker'),()=>{s.phase=viewer?'read':'reveal-ready';redraw();},'handoff'));root.append(mask);return;
  }
  root.append(el('h2',current.title));
  if(current.directorScene){
    const stage=board(root,...title,t),movie=current.directorScene;
    const player=transport(root,ui,movie.duration,seconds=>{
      const shot=paintScene(stage.canvas,movie,seconds);
      const i=movie.shots.findIndex(item=>item.id===shot?.id);
      stage.caption.textContent=i<0?current.title:describe(movie,i)[ui.lang];
    });
    player.update();
  }
  else if(current.frames)playStudioBoard(ui,root,current);
  else if(current.paint){const v=board(root,...title,t);current.paint(v.ctx);v.caption.textContent=current.title;}
  else if(current.thumbnail && /^data:image\/(png|jpeg|webp);base64,/.test(current.thumbnail)){const img=el('img',null,'ns-still');img.src=current.thumbnail;img.alt=current.title;root.append(img);}
  else root.append(el('p',t('بطاقة عرض نصية · ','Text screening card · ')+current.title));
  if(s.phase==='present'){
    root.append(el('p',t('دور الصانع · قدّم هذه القطعة للمشاهد.','Maker’s turn · introduce this piece to the viewer.')));
    const timing=select([...new Set([s.lengths[s.index],3,6,9,12,15,30])].sort((a,b)=>a-b).map(n=>[String(n),n+' s']),String(s.lengths[s.index]),v=>{s.lengths[s.index]=Number(v);},'runtime');
    // A timed work keeps its source duration. Only a still has an adjustable display hold.
    timing.disabled=!!current.sourceSeconds;
    root.append(control(current.sourceSeconds?t('مدة القطعة الأصلية','Source running time'):t('مدة عرض الصورة في البرنامج','Still display time in programme'),timing));
    actions(root,button(t('غطِّ الشاشة وسلّم الجهاز','Cover screen and pass device'),()=>{s.phase='cover-view';redraw();},'pass'));return;
  }
  if(s.phase==='read'){
    const readings=[['تركّزت عيني على الحركة','My eye followed the movement'],['لاحظتُ ترتيب الأشياء','I noticed the arrangement'],['استوقفني توقيت اللحظة','The timing stood out']];
    root.append(el('p',t('اختر قراءة أو اكتب ملاحظة. يراها الصانع عند الكشف وتُمسح عند إغلاق الصفحة.','Choose a reading or leave a note. The maker sees it at reveal. Closing this page clears it.')));
    const choice=select([['',t('اختر قراءة','Choose a reading')],...readings.map((v,i)=>[String(i),t(...v)])],s.reading,v=>{s.reading=v;check();},'reading');
    const input=el('textarea');input.rows=3;input.maxLength=220;input.dataset.scene='note';input.value=s.input;input.oninput=()=>{s.input=input.value;check();};
    const confirm=button(t('أغلق قراءتي وأعد الجهاز','Close my reading and pass back'),()=>{s.notes[s.index]=s.input.trim();s.readings[s.index]=s.reading!==''?readings[Number(s.reading)]:null;s.phase='cover-maker';redraw();},'return');
    function check(){confirm.disabled=!s.input.trim()&&s.reading==='';}
    root.append(control(t('قراءتي','My reading'),choice),control(t('ملاحظة للمُقدّم','Note to maker'),input),confirm);check();return;
  }
  if(s.phase==='reveal-ready'){
    root.append(button(t('اكشف الإعدادات والقراءة','Reveal setup and reading'),()=>{s.phase='reveal';redraw();},'reveal'));return;
  }
  const kind=typeof current.settings==='string'?current.settings:'';
  root.append(el('h3',t('كيف صُنعت هذه القطعة؟','How was it made?')),el('pre',kind,'ns-settings'),el('h3',t('قراءة المشاهد','Viewer’s reading')));
  if(s.readings[s.index])root.append(el('p',t(...s.readings[s.index])));if(s.notes[s.index])root.append(el('p',s.notes[s.index]));
  actions(root,button(s.index===2?t('اعرض برنامج الأمسية','Show screening programme'):t('قدّم القطعة التالية','Present the next piece'),()=>{s.input='';s.reading='';s.phase=s.index===2?'program':'present';if(s.phase==='present')s.index++;redraw();},'next'));
}
