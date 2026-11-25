import {mount,element,action,link} from './night-shell.js';
import {nowId} from './night-store.js';
import {SHOTS} from '../after-show/edit-rules.js';
import {validScene,sceneThumbnails,describe} from './creative/scene.js';

const slug=document.body.dataset.activity;
const titles={
  'idea-to-studio':['من فكرتي إلى الاستوديو','From idea to studio'],
  'dialogue-preview':['معاينة حوار الاسم المحذوف','The Deleted Name conversation room'],
  'episode-ends':['نهاية كل حلقة من RAVEN 17','After a RAVEN 17 episode'],
  'behind-frame':['خلف الكادر · الورق والهاتف','Behind the frame · Paper and phone']
};
const draftPrefix='raven.studio.named-board.v1.';
const editorRoutes=['edit','free','custom','duo','daily','brief'];
function usefulLink(ui,ar,en,path){const a=link(ui.t(ar,en),ui.url(path),'connect-link');a.target='_top';return a;}
function renderBoard(ui){
  const {t,root,lang}=ui,params=new URL(location.href).searchParams;
  const records=ui.pieces().filter(p=>p.activity==='director-sentence'&&p.type==='night-scene'&&validScene(p.data));
  const requested=params.get('piece'),raw=params.get('shots')?.split(',')||[];
  const ids=raw.length>0&&raw.length<=4&&raw.every(id=>Object.hasOwn(SHOTS,id))?raw:null;
  let selected=records.find(p=>p.id===requested)||(!requested&&!ids?records[0]:null),fromCut=!!ids&&!requested;
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
  select.onchange=()=>{selected=records.find(p=>p.id===select.value);fromCut=select.value==='cut';paint();};
  let paintVersion=0;
  async function paint(){
    const version=++paintVersion;
    panel.replaceChildren();let scenes=[],source=null;
    if(fromCut&&ids){
      scenes=ids.map((id,index)=>({id:'cut-'+(index+1),sceneNumber:index+1,title:SHOTS[id].name[lang],prompt:SHOTS[id].description[lang],duration:SHOTS[id].seconds,camera:'static-tripod',transition:'cut',thumbnail:'../raven/after-show/assets/'+id+'.webp'}));source={kind:'cut',route:cut,shots:ids};
    }else if(selected){
      const data=selected.data;
      panel.append(element('p',t('جارٍ تجهيز اللقطات…','Preparing shot frames…')));
      const imgs=await sceneThumbnails(data);
      if(version!==paintVersion||!panel.isConnected)return;
      panel.replaceChildren();
      const labels=[t('وصول','Arrival'),t('انطفاء','Blackout'),t('مغادرة','Departure')];
      scenes=data.shots.map((shot,i)=>({id:'director-'+(i+1),sceneNumber:i+1,title:labels[i],prompt:describe(data,i)[lang],duration:shot.seconds,camera:shot.motion==='pan'?'pan-right':'static-tripod',transition:'cut',thumbnail:imgs[i]}));
      source={kind:'director',piece:selected.id};
    }
    if(!scenes.length||scenes.some(s=>!s.thumbnail)){
      panel.append(element('p',t('كوّن مونتاجًا أو احفظ مشهدًا من «مخرج من جملة» لتعاين لقطاتك هنا.','Create a cut or save a scene in the director to see your shots here.')));return;
    }
    const listing=element('ol',null,'connect-shots');for(const shot of scenes){
      const li=element('li'),img=element('img');img.src=shot.thumbnail.startsWith('data:')?shot.thumbnail:'../after-show/assets/'+shot.thumbnail.split('/').at(-1); img.alt='';img.width=320;img.height=160;
      li.append(img,element('strong',shot.title+' · '+shot.duration+t(' ث','s')),element('p',shot.prompt));listing.append(li);
    }
    const form=element('form',null,'connect-form');
    const nameLabel=element('label',t('اسم المسودة الجديدة','New draft name'));const name=element('input');name.type='text';name.id='board-name';name.maxLength=70;name.required=true;nameLabel.htmlFor=name.id;name.value='';
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
    const links=element('div',null,'connect-sources');labels.forEach(([ar,en],i)=>links.append(usefulLink(ui,ar,en,'../?episode='+(i+1))));root.append(links);
  }
}});
