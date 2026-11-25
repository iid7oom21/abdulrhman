import {mount,element,action,link} from './night-shell.js';
import {nowId} from './night-store.js';
import {SHOTS} from '../after-show/edit-rules.js';
import {validScene,sceneThumbnails,describe,retrySceneImages} from './creative/scene.js';

import {ending,findPanel,checkedSelection} from './ink/print-panels.js';
import {validateCourierManga,MANGA_FORMAT,panelEvents} from './ink/courier-rules.js';

function mangaPanels(piece,t){
  if(piece.activity==='ink-page' && piece.type==='ink-page' && checkedSelection(piece.data)){
    return piece.data.panels.map((id,index)=>{
      const art=findPanel(id);
      const caption=piece.data.caption && index===2?' '+t(...ending):'';
      return {id,title:t(...art.title),prompt:t(...art.alt)+caption,asset:'panel-'+id};
    });
  }
  if(piece.activity==='ink-courier' && piece.type===MANGA_FORMAT && validateCourierManga(piece.data)){
    const events=panelEvents(piece.data.path);
    const titles={departure:['المغادرة','Departure'],letter:['الرسالة','The letter'],crossing:['الطريق','The route'],arrival:['الوصول','Arrival'],shelter:['نهاية المحاولة','End of the attempt']};
    return piece.data.order.map(id=>{
      const event=events.find(row=>row.id===id);
      const title=t(...titles[event.art]);
      const location=t('الخانة ','Cell ')+(event.cell+1);
      const prompt=id==='departure'?t('غادر الساعي المحطة.','The courier left the station.'):
        title+' · '+t('الخطوة ','Step ')+event.step;
      return {id,title,prompt:prompt+' · '+location,asset:'courier/print-'+event.art};
    });
  }
  return null;
}

const slug=document.body.dataset.activity;
const titles={
  'idea-to-studio':['من فكرتي إلى الاستوديو','From idea to studio'],
  'dialogue-preview':['معاينة حوار الاسم المحذوف','The Deleted Name conversation room'],
  'episode-ends':['نهاية كل حلقة من RAVEN 17','After a RAVEN 17 episode'],
  'behind-frame':['خلف الكادر · الورق والهاتف','Behind the frame · Paper and phone']
};
const draftPrefix='raven.studio.named-board.v1.';
const editorRoutes=['edit','free','custom','duo','daily','brief'];
const handoffForms=new Map();
let lastSource=null;
function usefulLink(ui,ar,en,path){const a=link(ui.t(ar,en),ui.url(path),'connect-link');a.target='_top';return a;}
function renderBoard(ui){
  const {t,root,lang}=ui,params=new URL(location.href).searchParams;
  const records=ui.pieces().filter(p=>p.activity==='director-sentence'&&p.type==='night-scene'&&validScene(p.data) || mangaPanels(p,t));
  const requested=params.get('piece'),raw=params.get('shots')?.split(',')||[];
  const ids=raw.length>0&&raw.length<=4&&raw.every(id=>Object.hasOwn(SHOTS,id))?raw:null;
  let selected=records.find(p=>p.id===requested)||(!requested&&!ids?records[0]:null),fromCut=!!ids&&!requested;
  if(lastSource==='cut' && ids){fromCut=true;selected=null;}
  else if(lastSource && records.some(p=>p.id===lastSource)){selected=records.find(p=>p.id===lastSource);fromCut=false;}
  const cut=editorRoutes.includes(params.get('from'))?params.get('from'):'edit';
  const panel=element('section'),sources=element('div',null,'connect-sources');
  const select=element('select');select.id='board-source';const label=element('label',t('اختر مصدر اللوحة','Choose your shot source'));label.htmlFor=select.id;
  function option(value,text){const o=element('option',text);o.value=value;select.append(o);}
  if(ids)option('cut',t('مونتاجي','My cut'));
  if(requested&&!selected)option('',t('المشهد المطلوب غير متاح هنا','Requested scene unavailable on this device'));
  for(const p of records)option(p.id,p.title);
  if(select.options.length){select.value=fromCut?'cut':selected?.id||'';sources.append(label,select);}
  const maker=usefulLink(ui,'افتح مخرج من جملة','Open the scene director','./director-sentence.html');
  const bench=usefulLink(ui,'افتح لوحة المونتاج','Open the cutting room','../after-show/?activity=edit');sources.append(maker,bench);
  select.onchange=()=>{lastSource=select.value;selected=records.find(p=>p.id===select.value);fromCut=select.value==='cut';paint();};
  let paintVersion=0;
  async function paint(){
    const version=++paintVersion;
    panel.replaceChildren();let scenes=[],source=null;
    if(fromCut&&ids){
      scenes=ids.map((id,index)=>({id:'cut-'+(index+1),sceneNumber:index+1,title:SHOTS[id].name[lang],prompt:SHOTS[id].description[lang],duration:SHOTS[id].seconds,camera:'static-tripod',transition:'cut',thumbnail:'../raven/after-show/assets/'+id+'.webp'}));source={kind:'cut',route:cut,shots:ids};
    }else if(selected && selected.activity!=='director-sentence'){
      const panels=mangaPanels(selected,t);
      if(panels){
        source={kind:'manga',activity:selected.activity,piece:selected.id};
        scenes=panels.map((frame,index)=>({id:'panel-'+frame.id,sceneNumber:index+1,title:frame.title,prompt:frame.prompt,
          duration:2,camera:'static-tripod',transition:'cut',thumbnail:'../raven/late-night/ink/art/'+frame.asset+'.webp'}));
      }
    }else if(selected){
      const data=selected.data;
      panel.append(element('p',t('جارٍ تجهيز اللقطات…','Preparing shot frames…')));
      const imgs=await sceneThumbnails(data);
      if(version!==paintVersion||!panel.isConnected)return;
      panel.replaceChildren();
      if(imgs.length!==data.shots.length){
        panel.append(element('p',t('تعذّر تجهيز صور المشهد. يمكنك إعادة تحميلها أو اختيار مصدر آخر.','The scene frames could not be prepared. Retry the artwork or choose another source.')),
          action(t('أعد تحميل الصور','Retry artwork'),()=>{retrySceneImages(data.setting);paint();}));return;
      }
      const labels=[t('وصول','Arrival'),t('انطفاء','Blackout'),t('مغادرة','Departure')];
      scenes=data.shots.map((shot,i)=>({id:'director-'+(i+1),sceneNumber:i+1,title:labels[i],prompt:describe(data,i)[lang],duration:shot.seconds,camera:shot.motion==='pan'?'pan-right':'static-tripod',transition:'cut',thumbnail:imgs[i]}));
      source={kind:'director',piece:selected.id};
    }
    if(!scenes.length||scenes.some(s=>!s.thumbnail)){
      panel.append(element('p',t('كوّن مونتاجًا أو احفظ مشهدًا من «مخرج من جملة» لتعاين لقطاتك هنا.','Create a cut or save a scene in the director to see your shots here.')));return;
    }
    const key=fromCut?'cut:'+ids.join(','):selected.id;
    if(!handoffForms.has(key))handoffForms.set(key,{name:'',seconds:{}});
    const inputs=handoffForms.get(key);
    if(source.kind==='manga')for(const shot of scenes){shot.duration=inputs.seconds[shot.id] || shot.duration;}
    const listing=element('ol',null,'connect-shots');if(source.kind==='manga')listing.classList.add('connect-manga');for(const shot of scenes){
      const li=element('li'),img=element('img');img.src=new URL(shot.thumbnail,new URL('../../studio/',location.href)).href; img.alt='';img.width=320;img.height=160;
      li.append(img,element('strong',shot.title+' · '+shot.duration+t(' ث','s')),element('p',shot.prompt));if(source.kind==='manga'){
        const label=element('label',t('مدة اللوحة بالثواني','Panel duration in seconds')+' '+shot.sceneNumber),input=element('input');
        input.type='number';input.min='1';input.max='120';input.step='1';input.required=true;input.value=String(shot.duration);
        input.setAttribute('form','night-board-new');input.dataset.boardDuration=String(shot.sceneNumber);
        input.oninput=()=>{if(input.validity.valid){shot.duration=input.valueAsNumber;inputs.seconds[shot.id]=shot.duration;li.querySelector('strong').textContent=shot.title+' · '+shot.duration+t(' ث','s');}};
        label.append(input);li.append(label);
      }
      listing.append(li);
    }
    const form=element('form',null,'connect-form');form.id='night-board-new';
    const nameLabel=element('label',t('اسم المسودة الجديدة','New draft name'));const name=element('input');name.type='text';name.id='board-name';name.maxLength=70;name.required=true;nameLabel.htmlFor=name.id;name.value=inputs.name;name.oninput=()=>{inputs.name=name.value;};
    const submit=element('button',t('أنشئ المسودة وافتح الاستوديو','Create draft and open studio'));submit.type='submit';
    const notice=element('p');notice.setAttribute('role','status');
    form.onsubmit=e=>{e.preventDefault();const title=name.value.trim();if(!title){name.focus();return;}
      const id=nowId(),record={version:1,id,name:title,source,scenes};const serialized=JSON.stringify(record);
      try{
        localStorage.setItem(draftPrefix+id,serialized);
        if(localStorage.getItem(draftPrefix+id)!==serialized)throw new Error();
      }catch{notice.textContent=t('لم يتأكد حفظ المسودة. لقطاتك واسمها باقيان هنا.','The draft save could not be confirmed. Its name and shots are still here.');return;}
      const target=new URL('../../studio/',location.href);target.searchParams.set('lang',lang);target.searchParams.set('nightBoard',id);
      window.location.assign(target.href);
    };
    form.append(nameLabel,name,submit,notice);panel.append(listing,form);
    if(source.kind==='manga'){
      const images=[...listing.querySelectorAll('img')];
      async function checkArtwork(retry=false){
        submit.disabled=true;
        notice.textContent=t('جارٍ فتح اللوحات…','Opening the panels…');
        if(retry)for(const image of images){
          if(image.naturalWidth)continue;
          const url=new URL(image.src);url.searchParams.set('retry',String(Date.now()));image.src=url.href;
        }
        const status=await Promise.allSettled(images.map(image=>image.decode()));
        if(version!==paintVersion || !form.isConnected)return;
        if(status.every(result=>result.status==='fulfilled')){
          notice.replaceChildren();submit.disabled=false;
        }else{
          notice.replaceChildren(element('span',t('تعذّر فتح إحدى اللوحات.','A panel could not be opened.')),
            action(t('أعد تحميل اللوحات','Retry panels'),()=>checkArtwork(true)));
        }
      }
      checkArtwork();
    }
  }
  root.append(sources,panel);paint();
  root.append(usefulLink(ui,'مسوداتي المسماة في الاستوديو','My named drafts in the studio','../../studio/?tab=storyboard'));
}
mount({id:slug,title:titles[slug],render:ui=>{
  if(slug==='idea-to-studio')return renderBoard(ui);
  const {t,root}=ui;
  if(slug==='dialogue-preview'){
    root.append(element('p',t('تكلّم مع يوناس أو كلير في غرفة المعاينة. تُعرض حالة حفظ كل سؤال في سجل العمليات.','Speak with Jonas or Claire in the conversation room. Each question’s save status is available in its operation history.')),usefulLink(ui,'ادخل غرفة الحوار','Enter the conversation room','../dialogue/'));
  }
  if(slug==='behind-frame'){
    const img=element('img');img.src='../assets/atmosphere-v1/paper-detail.webp';img.width=640;img.height=360;img.alt='';img.className='connect-poster';
    root.append(img,element('p',t('شغّل المقطع، ثم افتح تمرين التأطير أسفله لمقارنة موضع الورقة والهاتف.','Play the clip, then open the framing exercise beneath it to compare the paper and the phone.')),usefulLink(ui,'افتح المقطع والتمرين','Open the clip and exercise','../#behind-paper-phone'));
  }
  if(slug==='episode-ends'){
    root.append(element('p',t('اختر حلقة. عند نهايتها تقدر ترجع للحلقات أو تدخل الكواليس أو تجرّب ورشة من أدوات الإنتاج.','Choose an episode. Its ending offers the episode list, behind the scenes and a hands-on production workshop.')));
    const labels=[['الحلقة الأولى','Episode one'],['الحلقة الثانية','Episode two'],['الحلقة الثالثة','Episode three']];
    const links=element('div',null,'connect-sources');labels.forEach(([ar,en],i)=>links.append(usefulLink(ui,ar,en,'../episodes/?episode='+(i+1))));root.append(links);
  }
}});
