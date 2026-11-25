import {element as el,action,link} from './night-shell.js';
import {nowId,loadDraft,saveDraft,download,isThumbnail} from './night-store.js';
import {activities} from './catalog.js';

const key='coastal-evening';
let proposed=null;
const choices={
  game:[
    ['ink-courier','ساعي المطر','Rain Courier',4],
    ['last-minute-auction','مزاد الدقيقة الأخيرة','Last-minute auction',4]
  ],
  scene:[
    ['ink-page','صفحة قبل الفجر','A page before dawn',4],
    ['director-sentence','مخرج من جملة','One-sentence director',4],
    ...activities.filter(a=>a[0]==='nightshift-seat').map(a=>a.slice(0,4))
  ],
  finish:[
    ['programme','برنامج مكتوب','Written programme',1],
    ['postcard','بطاقة عرض','Screening card',2]
  ]
};
const chapterNames={game:['اللعبة','Game'],scene:['المشهد','Scene'],finish:['القطعة الختامية','Closing piece']};
const order=Object.keys(choices);
const get=(chapter,id)=>choices[chapter].find(x=>x[0]===id);
const defaults=()=>Object.fromEntries(order.map(k=>[k,choices[k][0][0]]));
export const isProgramme=s=>s?.version===1 && typeof s.run==='string' && /^[a-z0-9-]{1,90}$/i.test(s.run) &&
  order.every(k=>get(k,s.picks?.[k])) && Array.isArray(s.earned) && s.earned.length<=2 &&
  s.earned.every(id=>typeof id==='string' && /^[a-z0-9-]{1,90}$/i.test(id)) && new Set(s.earned).size===s.earned.length &&
  typeof s.finished==='boolean' && (!s.finished || s.earned.length===2);

export function hasProgramme(){return isProgramme(loadDraft(key));}
export function renderProgramme(ui){
  const {root,t}=ui,params=new URLSearchParams(location.search);
  let current=isProgramme(ui.editData)?ui.editData:loadDraft(key);
  let picks=proposed || (isProgramme(current)?{...current.picks}:defaults());
  const works=()=>ui.pieces();
  function remember(next){
    if(!saveDraft(key,next))return false;
    current=next;
    return true;
  }
  const heading=el('h2',t('برنامج أمسيتك','Your evening programme'));
  const region=el('section',null,'night-chapter');
  root.append(heading,region);
  const total=()=>order.reduce((sum,k)=>sum+get(k,picks[k])[3],0);
  function stageTitle(k){const row=get(k,picks[k]);return t(row[1],row[2]);}
  function showPiece(work){
    const article=el('figure'),caption=el('figcaption',work.title);article.style.margin='0';
    if(isThumbnail(work.thumbnail)){const image=el('img');image.src=work.thumbnail;image.alt='';image.width=220;image.style.maxWidth='100%';article.append(image);}
    article.append(caption);return article;
  }
  function preview(){
    proposed=picks;
    region.replaceChildren();
    const opts=el('div',null,'night-programme-options');
    for(const k of order){
      const label=el('label',t(...chapterNames[k])),sel=el('select');sel.dataset.chapterChoice=k;
      for(const [id,ar,en,min] of choices[k])sel.append(new Option(t(ar,en)+' · '+min+' '+t('د','min'),id));
      sel.value=picks[k];sel.onchange=()=>{picks[k]=sel.value;timing.textContent=duration();};
      label.append(sel);opts.append(label);
    }
    const duration=()=>t('المدة التقريبية ','About ')+total()+t(' دقائق. تكتمل الفصول والصوت مكتوم.',' minutes. Every chapter works with sound off.');
    const timing=el('p',duration());
    region.append(opts,timing,action(t('ابدأ الأمسية','Start the evening'),()=>{
      if(remember({version:1,run:nowId(),picks:{...picks},earned:[],finished:false})){proposed=null;show();}
    },'night-cta'),document.createTextNode(' · '),link(t('ورشة العنوان والنوافذ','Title and window workshop'),ui.url('three-evening.html?programme=titles')));
  }
  const labelFor=(work)=>work===null?t('قطعة محذوفة','Removed work'):work.title;
  function finish(rows){
    const card=picks.finish==='postcard';
    const group=el('div',null,'night-row');
    for(const piece of rows)group.append(showPiece(piece));
    const title=stageTitle('finish')+' · '+rows.map(x=>x.title).join(' / ');
    const credits={version:1,title,entries:rows.map((piece,i)=>({chapter:order[i],title:piece.title,activity:piece.activity})),minutes:total()};
    region.append(group);
    if(card){
      const canvas=el('canvas',null,'night-poster');canvas.width=760;canvas.height=820;
      canvas.setAttribute('aria-label',title);region.append(canvas);
      const c=canvas.getContext('2d');
      if(c) {
        c.fillStyle='#1b2526';c.fillRect(0,0,760,820);
        c.textAlign='center';c.fillStyle='#ecd9b9';c.font='30px Tahoma, sans-serif';c.fillText(t('برنامج أمسيتك','Your evening programme'),380,65);
        const ready=rows.map((work,i)=>new Promise(done=>{
          const y=100+i*344;
          c.fillStyle='#c4a67c';c.font='22px Tahoma, sans-serif';c.fillText(t(...chapterNames[order[i]]),380,y+22);
          c.fillStyle='#eee7d9';c.font='26px Tahoma, sans-serif';c.fillText(work.title,380,y+304,686);
          if(!isThumbnail(work.thumbnail)){done();return;}
          const img=new Image();img.onload=()=>{const r=Math.min(680/img.width,235/img.height);c.drawImage(img,380-img.width*r/2,y+38,img.width*r,img.height*r);done();};img.onerror=done;img.src=work.thumbnail;
        }));
        const getImage=action(t('نزّل بطاقة العرض PNG','Download screening card PNG'),()=>canvas.toBlob(b=>{if(b)download('raven-evening.png',b);},'image/png'));
        getImage.disabled=true;Promise.all(ready).then(()=>getImage.disabled=false);region.append(getImage);
      }
    }
    region.append(action(t('نزّل البرنامج JSON','Download programme JSON'),()=>download('raven-evening-programme.json',credits)));
    if(current.finished){
      const keep=action(t('احفظ برنامج الأمسية في دفتري','Keep the programme in my portfolio'),()=>{
        if(ui.savePiece({title,type:'evening-programme',data:current}))keep.disabled=true;
      });
      region.append(keep);
    }else region.append(action(t('اختم الأمسية','Finish the evening'),()=>{
      if(remember({...current,finished:true}))show();
    },'night-cta'));
  }
  function show(){
    region.replaceChildren();
    const found=works(),rows=current.earned.map(id=>found.find(w=>w.id===id)||null);
    const chapter=rows.length,k=order[chapter];
    region.append(el('h3',current.finished?t('اكتملت أمسيتك','Your evening is complete'):(chapter+1)+' / 3 · '+stageTitle(k)));
    if(rows.includes(null)){
      region.append(el('p',t('حُذفت إحدى قطع الأمسية من دفترك.','One of the evening’s works was removed from your portfolio.')));
    }else if(chapter===2)finish(rows);
    else {
      if(chapter===1){region.append(el('p',t('من فصل اللعبة','From your game chapter')),showPiece(rows[0]));}
      const work=params.get('run')===current.run ? found.find(p=>p.id===params.get('earned')&&p.activity===picks[k]):null;
      if(work){
        region.append(el('p',t('القطعة التي ستنتقل إلى برنامجك','The work you’ll carry into your programme')),showPiece(work),
          action(t('أضف هذه القطعة وتابع','Use this work and continue'),()=>{
            if(remember({...current,earned:[...current.earned,work.id]})){
              const url=new URL(location.href);for(const key of ['earned','run']){url.searchParams.delete(key);params.delete(key);}
              history.replaceState(history.state,'',url);show();
            }
          },'night-cta'));
      }
      const destination=new URL(picks[k]+'.html',location.href);
      destination.searchParams.set('nightProgramme',current.run);
      region.append(el('p',t('احفظ قطعة من هذا الفصل في دفترك، ثم اختر مراجعتها لأمسيتك.','Save your work in this chapter, then choose to review it for your evening.')),
        link(t('افتح الفصل','Open chapter'),ui.url(destination),'night-cta'));
    }
    const summary=el('ol');
    for(const [i,k] of order.entries()){
      const picked=get(k,picks[k]),entry=el('li',stageTitle(k)+' · '+picked[3]+' '+t('د','min'));
      if(i<rows.length)entry.append(document.createTextNode(' · '+labelFor(rows[i])));
      summary.append(entry);
    }
    region.append(summary);
    const again=action(t('حضّر برنامجًا جديدًا','Prepare another programme'),preview);
    region.append(again,document.createTextNode(' · '),link(t('دفتر أعمالي','My portfolio'),ui.url('my-notebook.html')));
  }
  if(isProgramme(current) && !proposed)show();else preview();
}
