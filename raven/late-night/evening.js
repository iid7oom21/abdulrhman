import {mount,element as el,action,link} from './night-shell.js';
import {deletePiece,download,loadDraft,saveDraft} from './night-store.js';
import {activities,extras} from './catalog.js';
import {items as inkActivities} from './ink/catalog.js';
const id=document.querySelector('#night-app').dataset.room;
const labels=extras.find(a=>a[0]===id) || ['coast-map','خريطة الساحل والسينما القديمة','The coast and the old cinema'];
const isImage=value=>typeof value==='string' && /^data:image\/(png|jpeg|webp);base64,/.test(value);
const params=new URLSearchParams(location.search);
function workURL(ui,p) {
  if(p.activity==='titles')return ui.url('../after-show/?activity=titles&nightPiece='+encodeURIComponent(p.id));
  const known=[...activities,...extras].some(s=>s[0]===p.activity) || inkActivities.some(s=>s.page===p.activity);
  return known ? ui.url(p.activity+'.html?piece='+encodeURIComponent(p.id)) : null;
}
function portfolio(ui) {
  const {root,t}=ui;
  const paint=()=>{
    root.replaceChildren();
    const shelf=el('div',null,'night-shelf'),items=ui.pieces();
    root.append(el('p',t('القطع التي اخترت حفظها على هذا الجهاز.','Work you chose to keep on this device.')),shelf);
    if(!items.length)shelf.append(link(t('اصنع أول مشهد','Create your first scene'),ui.url('director-sentence.html'),'night-cta'));
    for(const p of items){
      const card=el('article',null,'night-item'),name=el('h3',p.title),thumb=el('img');
      const active=activities.find(a=>a[0]===p.activity);
      const img=isImage(p.thumbnail);
      if(img || active){thumb.src=img?p.thumbnail:'./thumbs/'+p.activity+'.webp?v=cinema';thumb.alt=img?p.title:t('غلاف النشاط','Activity cover');thumb.loading='lazy';card.append(thumb);}
      const date=new Date(p.at);
      const info=el('p',(!Number.isNaN(date.valueOf()) ? date.toLocaleDateString(ui.lang) : '')+' · JSON');
      const row=el('div',null,'night-row'),target=workURL(ui,p);
      if(target)row.append(link(t('افتح للتعديل','Open to edit'),target));
      row.append(action(t('تنزيل JSON','Download JSON'),()=>download(p.activity+'.json',p)));
      if(img){const image=link(t('تنزيل الصورة','Download image'),p.thumbnail);image.download=p.activity+'.'+p.thumbnail.match(/^data:image\/(\w+)/)[1];row.append(image);}
      const remove=action(t('حذف القطعة','Delete piece'),()=>{
        row.replaceChildren(el('span',t('تحذف هذه القطعة؟','Delete this piece?')),action(t('حذف','Delete'),()=>{if(deletePiece(p.id))paint();}),action(t('رجوع','Cancel'),paint));
      });
      row.append(remove);card.append(name,info,row);shelf.append(card);
    }
  };paint();
}

const festivalChoices=[
  {group:'old',id:'titles',name:['الاسم يعبر الشاشة','A title crosses the screen'],min:5,mood:'quiet'},
  {group:'old',id:'forced-scale',name:['فنجان بحجم عمارة','A building-sized cup'],min:3,mood:'play'},
  {group:'old',id:'duo',name:['المخرج والمونتير','Director and editor'],min:5,mood:'play',two:true},
  ...['dome-sky','echo-two','seven-windows','station-shadow','darkroom-minute'].map(slug=>{
    const a=activities.find(r=>r[0]===slug);
    return {group:'new',id:slug,name:a.slice(1,3),min:a[3],mood:['dome-sky','darkroom-minute','seven-windows'].includes(slug)?'quiet':'play',two:slug==='echo-two'};
  })
];
const oldUrl=(ui,activity)=>ui.url('../after-show/?activity='+activity);
let program=loadDraft('festival-chair') || {};
function plan(ui) {
  const {root,t}=ui;
  root.replaceChildren();
  const controls=el('div',null,'night-row');
  function choose(title,key,opts,defaultValue){
    const label=el('label',title),s=el('select');
    for(const [value,ar,en] of opts)s.append(new Option(t(ar,en),value));
    s.value=opts.some(x=>x[0]===program[key])?program[key]:defaultValue;
    s.addEventListener('change',()=>{program={...program,[key]:s.value,old:null,new:null};saveDraft('festival-chair',program);plan(ui);});
    label.append(s);controls.append(label);
  }
  choose(t('الجو','Mood'),'mood',[['quiet','هادئ','Quiet'],['play','حركي','Playful']],'quiet');
  choose(t('المشاركون','Visitors'),'party',[['one','شخص واحد','One person'],['two','شخصان','Two people']],'one');
  choose(t('الصوت','Sound'),'sound',[['off','بدون صوت','Sound off'],['on','الصوت اختياري','Optional sound']],'off');
  root.append(controls);
  const isDuo=program.party==='two',mood=program.mood==='play'?'play':'quiet';
  const options=group=>festivalChoices.filter(row=>row.group===group&&(isDuo||!row.two));
  const pick=group=>options(group).find(row=>row.id===program[group]) ||
    [...options(group)].sort((a,b)=>rank(b)-rank(a))[0];
  const rank=a=>(a.mood===mood?2:0)+(isDuo&&a.two?3:0);
  const old=pick('old'),fresh=pick('new');
  root.append(el('h2',t('برنامجك','Your programme')),el('p',t('نشاط من «بعد العرض» وآخر من «آخر الليل». المجموع التقريبي ','One After the Show workshop and one Late Night activity. About ')+(old.min+fresh.min)+t(' من ١٥ دقيقة.',' of 15 minutes.')+' '+(program.sound==='on'?t('تقدر تترك الصوت مكتومًا.','Sound is optional.'):t('الفقرتان تكتملان بالصورة والنص.','Both can be completed visually.'))));
  for(const item of [old,fresh]){
    const box=el('article',null,'night-chapter'),siblings=options(item.group);
    box.append(el('h3',t(...item.name)),el('p',item.min+' '+t('دقائق','min')+' · '+(item.two?t('تبادل الأدوار على جهاز واحد','Pass one device between players'):item.mood==='quiet'?t('اختيارات هادئة ووقت للمراجعة','Quiet decisions with time to review'):t('قرار يتبعه أثر مرئي','A decision with a visible result'))));
    const row=el('div',null,'night-row');
    row.append(link(t('افتح الفقرة','Open activity'),item.group==='old'?oldUrl(ui,item.id):ui.url(item.id+'.html'),'night-cta'),action(t('استبدل الفقرة','Swap activity'),()=>{
      program={...program,[item.group]:siblings[(siblings.indexOf(item)+1)%siblings.length].id};
      saveDraft('festival-chair',program);plan(ui);
    }));box.append(row);root.append(box);
  }
  root.append(link(t('أمسية من ثلاثة فصول','A three-chapter evening'),ui.url('three-evening.html')));
}

let chapterState=null;
function three(ui) {
  const {root,t}=ui;
  const snapshot=ui.editData || chapterState || loadDraft('three-evening') || {};
  const all=ui.pieces();
  const requestedTitle=all.find(p=>p.id===params.get('titlePiece') && p.activity==='titles');
  const requestedShot=all.find(p=>p.id===params.get('shotPiece') && p.activity==='seven-windows');
  const title=requestedTitle || all.find(p=>p.id===snapshot.titleId && p.activity==='titles');
  const previousShot=title?.id===snapshot.titleId && all.find(p=>p.id===snapshot.shotId && p.activity==='seven-windows');
  const matches=piece=>Boolean(title && piece && piece.data?.titlePiece===title.id);
  const shot=matches(requestedShot)?requestedShot:matches(previousShot)?previousShot:null;
  let n=title?(shot?3:2):1;
  if(chapterState?.view && !requestedShot && !requestedTitle)n=Math.min(n,chapterState.view);
  const data={titleId:title?.id || null,shotId:shot?.id || null};
  // Consume transfer identifiers once. Refresh resumes only a confirmed local checkpoint.
  if(requestedTitle || matches(requestedShot)){
    if(saveDraft('three-evening',data)){
      params.delete('titlePiece');params.delete('shotPiece');
      const u=new URL(location.href);u.searchParams.delete('titlePiece');u.searchParams.delete('shotPiece');history.replaceState(history.state,'',u);
    }
  }
  chapterState=data;
  function draw(step) {
    chapterState={...data,view:step};
    root.replaceChildren();
    const box=el('section',null,'night-chapter'),part=[['ورشة العنوان','Title workshop'],['سبع نوافذ مضاءة','Seven lit windows'],['بطاقة النهاية','End card']][step-1];
    box.append(el('h2',step+' / 3 · '+t(...part)));root.append(box);
    if(step===1){
      box.append(el('p',t('اكتب كلمتي العنوان في ورشة «بعد العرض»، ثم اختر نقلهما إلى أمسيتك.','Write two title words in the After the Show workshop, then choose to bring them here.')),link(t('افتح ورشة العنوان','Open the title workshop'),ui.url('../after-show/?activity=titles&nightEvening=1'),'night-cta'));
      if(title)box.append(action(t('تابع بعنواني','Continue with my title'),()=>draw(2)));
    } else if(step===2){
      box.append(el('p',t('العنوان الذي سينتقل','Title to carry over')+' · '+title.title),link(t('اختر لقطة من النوافذ','Choose a window shot'),ui.url('seven-windows.html?evening=1&titlePiece='+encodeURIComponent(title.id)),'night-cta'));
      box.append(action(t('ارجع للعنوان','Review the title'),()=>draw(1)));
      if(shot)box.append(action(t('راجع بطاقة النهاية','Review end card'),()=>draw(3)));
    } else {
      box.append(el('p',t('تجمع البطاقة عنوانك ولقطتك المختارة.','Your end card combines your title and chosen shot.')));
      const canvas=el('canvas',null,'night-poster');canvas.width=700;canvas.height=860;canvas.setAttribute('aria-label',title.title+' · '+shot.title);box.append(canvas);
      const c=canvas.getContext('2d'),img=new Image();
      function drawCard(){
        c.fillStyle='#17262b';c.fillRect(0,0,700,860);
        if(img.naturalWidth){
          const scale=Math.min(628/img.naturalWidth,400/img.naturalHeight);
          const width=img.naturalWidth*scale,height=img.naturalHeight*scale;
          c.drawImage(img,(canvas.width-width)/2,38+(400-height)/2,width,height);
        }
        c.fillStyle='#dcc799';c.fillRect(36,466,628,2);c.textAlign='center';
        c.direction=ui.lang==='ar'?'rtl':'ltr';c.font='bold 49px NightPlex, sans-serif';c.fillText(title.title,350,610,620);
        c.font='28px NightPlex, sans-serif';c.fillText(shot.title,350,685,620);
        c.font='22px Georgia';c.fillText('RAVEN  /  LATE NIGHT',350,808);
      }

      const row=el('div',null,'night-row');
      const png=action(t('تنزيل البطاقة PNG','Download card PNG'),()=>canvas.toBlob(blob=>{if(blob)download('late-night-end-card.png',blob);},'image/png'));
      const save=action(t('احفظ في دفتر أعمالي','Keep in my portfolio'),()=>{
        if(ui.savePiece({title:title.title,type:'end-card',data,thumbnail:canvas.toDataURL('image/webp',.75)}))message.textContent=t('حُفظت البطاقة في دفتر أعمالي.','Card saved in My notebook.');
      });
      const message=el('p');message.setAttribute('role','status');
      const missing=()=>{message.textContent=t('تعذّر فتح صورة اللقطة. ارجع إلى النوافذ واختر لقطة محفوظة أخرى.','The shot image could not be opened. Return to the windows and choose another saved shot.');};
      png.disabled=save.disabled=true;drawCard();
      if(isImage(shot.thumbnail)){img.onload=()=>{drawCard();png.disabled=save.disabled=false;};img.onerror=missing;img.src=shot.thumbnail;}else missing();
      row.append(png,save,action(t('ارجع للّقطة','Review shot'),()=>draw(2)));box.append(message);
      box.append(row);
    }
  }
  draw(n);
}
function quick(ui) {
  ui.root.append(link(ui.t('سجّل عشر ثوانٍ في المحطّة','Record ten seconds at the station'),ui.url('station-shadow.html'),'night-cta'),
    document.createTextNode(' · '),link(ui.t('أبي أمسية كاملة','Plan a full evening'),ui.url('festival-chair.html')));
}
function coast(ui) {
  const sites=[['station-shadow','محطّة البريد','The mail station'],['echo-last-seat','الصالة القديمة','The old auditorium'],['tide-harbor','المرفأ','The harbour'],['dome-sky','القبة','The dome'],['seven-windows','عمارة النوافذ','The seven-window building']];
  const routes=el('nav',null,'night-links');
  for(const [slug,ar,en] of sites)routes.append(link(ui.t(ar,en),ui.url(slug+'.html')));
  ui.root.append(routes);
}
mount({id,title:labels.slice(1),render:{'coast-map':coast,'time-door':quick,'three-evening':three,'my-notebook':portfolio,'festival-chair':plan}[id]});
