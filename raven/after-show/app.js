import {activityStore} from './state.js';

const catalog = {
  edit: ['آخر إرسال','Last Transmission','عرّف بالمكان والفعل والأثر في مونتاج من ثلاث لقطات.','Introduce a place, an action and its trace in three shots.','ركّب اللقطات','Make the cut',3,'hand','edit'],
  projection: ['وردية غرفة العرض','Projection shift','وزّع الفنيين والشاشة قبل الافتتاح.','Schedule the crew and the screen before opening.','شغّل الوردية','Run the shift',4,'preview-projection','sims'],
  light: ['طاولة الضوء','The light table','حرّك الظل وصوّر ملمس الورق.','Move the shadow and photograph the paper.','اضبط الضوء','Set the light',3,'preview-light','sims'],
  sound: ['خارج الكادر','Offscreen sound','ركّب صوت الحركة في اللحظة المناسبة.','Place each sound at the instant of the action.','اضبط التوقيت','Set the cues',2,'preview-sound','sims'],
  archive: ['نقطة تفتيش الأرشيف','Archive check','طابق الشحنة مع طلب العرض.','Match the delivery against its screening order.','افحص الشحنة','Check a delivery',2,'preview-archive','sims'],
  continuity: ['عين الاستمرارية','Continuity eye','قارن ديكور اللقطتين وابحث عمّا تحرّك.','Compare two setups and spot what moved.','قارن اللقطتين','Compare the shots',2,'preview-continuity','events'],
  budget: ['ميزانية اللقطة','Shot budget','اختر كيف تصرف عشر وحدات إنتاج.','Decide how to spend ten production units.','وزّع الميزانية','Build a budget',3,'preview-budget','events'],
  grade: ['غرفة التلوين','Colour grading suite','لوّن لقطة وحرّك الفاصل لتقارنها بالأصل.','Grade a frame and slide the divider to compare it with the original.','لوّن اللقطة','Grade a shot',3,'preview-grade','lens'],
  camera: ['مصمّم اللقطة','Camera shot designer','اتخذ موقعك حول الطاولة واضبط حجم الظرف في الكادر.','Choose a camera height and frame the envelope on the table.','اضبط الكادر','Frame the shot',2,'preview-camera','lens'],
  festival: ['ليلة العرض','Screening night','اختر المونتاج والضوء والصوت ثم اعرض نسختك.','Cut, light and score a scene, then watch your version.','ابدأ الأمسية','Start the night',10,'lamp','events'],
  daily: ['تحدّي اليوم','Daily assignment','مواد اليوم وتكليفه واحدة لكل اللاعبين.','Everyone gets the same materials and brief today.','افتح تكليف اليوم','Open today’s brief',3,'exterior','edit'],
  duo: ['المخرج والمونتير','Director and editor','شخصان، جهاز واحد، وطلب ينتظر تفسيره.','Two people share one device and interpret a brief.','سلّم الدور','Pass the director’s brief',5,'hand','edit'],
  free: ['مونتاج حر','Open cutting room','غيّر لقطة بين نسختين وشاهد الفرق.','Change one shot between two cuts and compare.','افتح الطاولة','Open the bench',5,'envelope','edit'],
  brief: ['مولّد التكليفات','Director’s briefs','اختر إيقاعًا وقيدًا واحصل على جولة قابلة للعب.','Pick a pace and a constraint to get a playable brief.','أنشئ تكليفًا','Generate a brief',2,'lamp','edit'],
  custom: ['اصنع تحدّيك','Build a challenge','حدّد قواعد جولتك وجرّبها قبل تنزيلها.','Set the rules and play your round before exporting.','صمّم الجولة','Design a round',5,'exterior','edit'],
  card: ['بطاقة العرض','Screening card','عاين بطاقتك واحفظ صورة منها.','Preview your card and save an image.','افتح البطاقة','Open the card',1,'envelope','events']
};
const loaders = {
  edit: () => import('./edit.js'), sims: () => import('./sims.js'), events: () => import('./events.js'),
  lens: () => import('./lens.js')
};
const root = document.querySelector('#as-view');
const notice = document.querySelector('#as-status');
const sessionControls = document.querySelector('#as-session');
let lang = 'ar', route = 'hub', signature = '', revision = 0;
let cleanups = [], lastNotice = null;
const t = (ar,en) => lang === 'en' ? en : ar;
const store = activityStore(() => window.localStorage, showIssue);
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function button(text, fn) {
  const b = node('button',text); b.type='button'; b.addEventListener('click',fn); return b;
}
function routeUrl(id, language=lang) {
  const target = new URL(location.href);
  target.hash = ''; target.search = '';
  if (id !== 'hub') target.searchParams.set('activity',id);
  target.searchParams.set('lang',language);
  return target;
}
function link(id, label, className) {
  const a=node('a',label,className);
  a.href=routeUrl(id).href;
  a.dataset.asRoute=id;
  return a;
}
function go(id, language=lang) {
  if (id !== 'hub' && !Object.hasOwn(catalog,id)) return;
  const target=routeUrl(id,language);
  if (target.href!==location.href) history.pushState(null,'',target);
  draw();
}
function showIssue(issue, key) {
  lastNotice={issue,key};
  notice.replaceChildren();
  if (issue === 'conflict') {
    notice.append(t('هناك نسخة أحدث في تبويب آخر. تعديلك مفتوح هنا.','Another tab saved a newer copy. Your edit is open here.'));
  } else if (issue === 'incompatible') {
    notice.append(t('تعذّر فتح الحفظ السابق. الجولة الحالية مؤقتة.','The previous save could not be opened. This round is temporary.'));
  } else {
    notice.append(t('تعذّر تأكيد الحفظ. تبقى هذه الجولة في الصفحة المفتوحة.','Saving could not be confirmed. This round stays in the open page.'));
  }
  if (issue==='conflict' && key===route) {
    notice.append(button(t('افتح نسخة التبويب الآخر','Use the other tab’s copy'),()=>{
      store.refresh(key); lastNotice=null; notice.hidden=true; draw(true);
    }));
  }
  notice.hidden=false;
}
function updateShell() {
  document.documentElement.lang=lang; document.documentElement.dir=lang==='en'?'ltr':'rtl';
  const name=route==='hub'?t('بعد العرض','After the Show'):t(...catalog[route].slice(0,2));
  document.title=name+' · RAVEN';
  const home=new URL('../',location.href);home.searchParams.set('lang',lang);
  for(const id of ['as-back','as-home']) document.getElementById(id).href=home.href;
  document.getElementById('as-back').textContent=t('العودة إلى RAVEN','Return to RAVEN');
  const all=document.getElementById('as-all');all.textContent=t('بعد العرض','After the Show');all.href=routeUrl('hub').href;all.dataset.asRoute='hub';
  const language=document.getElementById('as-language');
  language.textContent=t('EN','عربي');language.lang=t('en','ar');language.setAttribute('aria-label',t('Switch to English','اعرض بالعربية'));
  const size=document.getElementById('as-size');
  size.textContent=t('ع+','A+');size.setAttribute('aria-label',t('تكبير النص','Enlarge text'));
  const large=Boolean(store.load('large-type',false));size.setAttribute('aria-pressed',String(large));
  document.documentElement.classList.toggle('large-type',large);
  document.dispatchEvent(new CustomEvent('raven:language',{detail:{lang}}));
}
function tile(id) {
  const [ar,en,da,de,aa,ae,minutes,image]=catalog[id];
  const name=t(ar,en),a=link(id,'','as-tile'),figure=node('figure'),img=node('img');
  img.src='./assets/'+image+'.webp';img.alt='';img.loading='lazy';img.decoding='async';figure.append(img);
  const copy=node('div',null,'caption');
  copy.append(node('small',new Intl.NumberFormat(lang).format(minutes)+t(' د',' min')),node('h3',name),node('p',t(da,de)),node('span',t(aa,ae),'action'));
  a.append(figure,copy);return a;
}
function hub() {
  const hero=node('div',null,'as-hero'),lead=node('div',null,'as-hero-copy'),img=node('img');
  img.src='./assets/hand.webp';img.alt='';img.width=832;img.height=468;
  lead.append(node('h1',t('بعد العرض','After the Show')),node('p',t('ثلاث لقطات واثنتا عشرة ثانية. اختر البداية، ركّب مشهدك، ثم شاهد ما صنعته.','Three shots. Twelve seconds. Choose the opening, cut the scene and watch what you made.')),link('edit',t('العب آخر إرسال','Play Last Transmission'),'as-play'));
  hero.append(lead,img);root.append(hero);
  const last=store.load('last-activity',null);
  if (typeof last==='string' && Object.hasOwn(catalog,last) && store.saved(last))
    root.append(link(last,t('أكمل · ','Continue · ')+t(...catalog[last].slice(0,2)),'as-continue'));
  const picks=node('section',null,'as-choices'),result=node('p',null,'as-pick');result.setAttribute('aria-live','polite');
  picks.append(node('h2',t('اختَر لي تجربة','Pick an activity for me')));
  const choices=[
    ['عندي دقيقتين','Two minutes','sound','تقدر تضبط حركة واحدة وتسمع أثرها في دقيقتين.','Place one cue and hear the change in two minutes.'],
    ['على راحتي','At my own pace','free','طاولة مفتوحة، تقدر تقارن نسختين بدون مؤقت.','Compare two cuts at your own pace.'],
    ['معي شخص','There are two of us','duo','تتبادلون دور المخرج والمونتير على نفس الجهاز.','Pass one device between the director and the editor.']
  ];
  for (const [ar,en,id,ra,re] of choices) picks.append(button(t(ar,en),()=>{
    result.replaceChildren(document.createTextNode(t(ra,re)+' '),link(id,t(...catalog[id].slice(4,6))));
  }));
  picks.append(result);root.append(picks);
  for (const [ar,en,ids] of [
    ['فعاليات العرض','Screening events',['daily','festival','duo']],
    ['على طاولة العمل','On the workbench',['projection','light','sound','archive','continuity','budget','grade','camera']],
    ['غرفة المونتاج','The cutting room',['edit','free','brief','custom']]
  ]) {
    const section=node('section',null,'as-section'),grid=node('div',null,'as-grid');
    section.append(node('h2',t(ar,en)),grid);grid.append(...ids.map(tile));root.append(section);
  }
}
function resetControls(id) {
  sessionControls.replaceChildren();
  if (id==='hub'||id==='card') return;
  const reset=button(t('ابدأ هذه التجربة من جديد','Restart this activity'),()=>{
    const ask=node('div',null,'as-reset');
    ask.append(node('span',t('تمسح اختيارات هذه التجربة؟','Clear choices for this activity?')),button(t('امسح وابدأ','Clear and restart'),()=>{
      if (store.clear(id)) {lastNotice=null;notice.hidden=true;draw(true);}
    }),button(t('رجوع','Cancel'),()=>{resetControls(id);sessionControls.querySelector('button')?.focus();}));
    sessionControls.replaceChildren(ask);ask.querySelector('button').focus();
  });sessionControls.append(reset);
}
const cssLoads=new Map();
function sheet(name) {
  if(cssLoads.has(name))return cssLoads.get(name);
  const el=node('link');el.rel='stylesheet';el.href='./'+name+'.css';
  const ready=new Promise((ok,fail)=>{
    el.onload=ok;el.onerror=()=>{el.remove();cssLoads.delete(name);fail(new Error('stylesheet'));};
  });cssLoads.set(name,ready);document.head.append(el);return ready;
}
function isArOrEn(value) {return value==='ar'||value==='en';}
async function draw(force=false) {
  const params=new URLSearchParams(location.search),requested=params.get('activity');
  const id=Object.hasOwn(catalog,requested)?requested:'hub';
  let language=params.get('lang');
  if(!isArOrEn(language)) {try {language=localStorage.getItem('raven_language');}catch{}}
  if(!isArOrEn(language))language='ar';
  const next=id+'/'+language;
  if(next===signature&&!force)return;
  const sameRoute=id===route&&signature!=='',scroll=window.scrollY;
  const keepFocus=document.activeElement?.id;
  signature=next;const renderId=++revision;
  for(const clean of cleanups.splice(0)) clean();
  lang=language;route=id;lastNotice=null;notice.hidden=true;root.replaceChildren();
  const related=document.getElementById('as-related'); related.replaceChildren(); related.hidden=true;
  updateShell();resetControls(id);
  if(id==='hub') hub();
  else{
    const group=catalog[id][8];
    const busy=node('p',t('جارٍ فتح طاولة العمل…','Opening the workbench…'));busy.setAttribute('role','status');root.append(busy);
    try {
      const [module]=await Promise.all([loaders[group](),sheet(group)]);
      if(renderId!==revision)return;
      root.replaceChildren();
      module.default({
        root,lang,t,route:id,params,go,
        load:store.load,save(key,data) {
          const saved=store.save(key,data);
          if(saved && key===id && id!=='card') store.save('last-activity',id);
          return saved;
        },
        onCleanup(fn) {cleanups.push(fn);}
      });
      const nextActivity={edit:'light',light:'sound',sound:'festival',projection:'budget',festival:'free'}[id] || 'edit';
      related.setAttribute('aria-label',t('تجارب أخرى','Other activities'));
      related.append(link('hub',t('كل التجارب','All activities')),node('span','·'),link(nextActivity,t(...catalog[nextActivity].slice(4,6))));related.hidden=false;
    }catch(error){
      if(renderId!==revision)return;
      const retry=button(t('أعد فتح التجربة','Retry activity'),()=>draw(true));
      root.replaceChildren(node('p',t('تعذّر فتح موارد التجربة.','The activity resources could not be opened.')),retry,link('hub',t('كل التجارب','All activities')));
      console.error('After the Show activity could not load',error);
    }
  }
  if (sameRoute) {if(keepFocus)document.getElementById(keepFocus)?.focus({preventScroll:true});window.scrollTo(0,scroll);}
  else {window.scrollTo(0,0);}
  const currentIssue = id === 'hub' ? null : store.issue(id);
  if (currentIssue) showIssue(currentIssue,id);
  else if(lastNotice)showIssue(lastNotice.issue,lastNotice.key);
}
document.addEventListener('click',event=>{
  const a=event.target.closest('a[data-as-route]');
  if(!a || event.defaultPrevented || event.button!==0 || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey)return;
  event.preventDefault();go(a.dataset.asRoute);
});
document.getElementById('as-language').onclick=()=>{
  const next=lang==='en'?'ar':'en';try{localStorage.setItem('raven_language',next);}catch{}
  go(route,next);
};
document.getElementById('as-size').onclick=()=>{
  const next=!document.documentElement.classList.contains('large-type');
  store.save('large-type',next);
  document.documentElement.classList.toggle('large-type',next);
  document.getElementById('as-size').setAttribute('aria-pressed',String(next));
};
window.addEventListener('popstate',()=>draw());
window.addEventListener('pagehide',()=>{for(const clean of cleanups.splice(0))clean();});
window.addEventListener('pageshow',event=>{if(event.persisted)draw(true);});
draw();
