import {mount,element as el,action} from '../night-shell.js';
import {title,stills,pages,objects,endings} from './seat-script.js';
import {beats,options,event,validCheckpoint,validPiece,approachEvents} from './seat-rules.js';
import {excerpt} from './seat-audio.js';

const initial=()=>({scene:'ticket',ending:null,events:[event('read','ticket')]});
let current=initial(),initialised=false,savedMark=null,invalidMark=false,missingPiece=false,kept=false;
function control(text,handler,key,value='',cls='') {
  const button=action(text,handler,cls);
  button.dataset[key]=value;return button;
}
function still(ui,key,time) {
  const spec=stills[key],figure=el('figure',null,'seat-photo'),img=el('img'),caption=el('figcaption',time);
  caption.dir='ltr';
  const description=ui.t(...spec.description),url=new URL('./art/'+spec.file,import.meta.url).href;
  img.alt=description;img.width=960;img.height=540;img.decoding='async';
  const fallback=el('span',description),retry=action(ui.t('أعد تحميل الصورة','Retry image'),()=>{
    figure.replaceChildren(img,caption);figure.classList.remove('is-missing');img.src=url;
  });
  img.onerror=()=>{figure.classList.add('is-missing');figure.replaceChildren(fallback,retry,caption);};
  figure.append(img,caption);img.src=url;
  return {figure,img};
}
function thumbnail(img) {
  if(!img.complete || !img.naturalWidth)return null;
  try{
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
    const ctx=canvas.getContext('2d');if(!ctx)return null;
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',.72);
  }catch{return null;}
}

mount({id:'nightshift-seat',title,intro:['قصة تفاعلية في السينما الساحلية. وقت القراءة والاختيار المقدّر ٨–١٢ دقيقة.','An interactive story in the coastal cinema. Allow about 8–12 minutes to read and choose.'],
render:ui=>{
  const {t,root}=ui;
  let stopAudio;
  if(!initialised){
    initialised=true;
    const stored=ui.load();
    if(validCheckpoint(stored))savedMark=stored;
    else if(stored!==null)invalidMark=true;
    if(validPiece(ui.editData)){
      current={scene:'result',ending:ui.editData.ending,events:[...ui.editData.events]};kept=true;
    }else if(new URL(location.href).searchParams.has('piece'))missingPiece=true;
  }
  function paint(focus=false) {
    stopAudio?.();stopAudio=null;
    const {scene,ending}=current;
    const branch=ending && endings[ending],page=pages[scene];
    const reader=el('article',null,'seat-reader');reader.dataset.scene=scene;
    const {figure,img}=still(ui,page?.still || (scene==='result'?'aisle':'booth'),page?.time || (scene==='result'?'20:00':'19:59'));
    const body=el('div',null,'seat-text'),heading=el('h2',t(...(page?.title || branch.title)));
    heading.tabIndex=-1;body.append(heading);
    if(scene==='result')reader.dataset.ending=ending;
    reader.append(figure,body);root.replaceChildren(reader);
    if(focus)heading.focus();
    const text=rows=>{for(const row of rows)body.append(el('p',t(...row)));};
    const buttons=el('div',null,'seat-row');
    if(scene==='ticket'){
      if(missingPiece)body.append(el('p',t('لم نجد النهاية المطلوبة على هذا الجهاز. يمكنك قراءة القصة من البداية.','This ending could not be opened on this device. You can read the story from the beginning.'),'seat-status'));
      if(savedMark){
        const summary=el('aside',null,'seat-checkpoint');
        summary.append(el('p',t('موضع محفوظ عند الدقيقة التي تسبق العرض.','A bookmark is waiting in the minute before the feature.')),
          control(t('استأنفي من قبل القرار','Resume just before the choice'),()=>{
            current={scene:'interval',ending:null,events:[...savedMark.events]};paint(true);
          },'restore'));
        body.append(summary);
      }else if(invalidMark)body.append(el('p',t('تعذّرت قراءة علامة القصة المحفوظة. يمكنك القراءة من هنا.','The saved story bookmark could not be read. You can start here.'),'seat-status'));
    }
    if(page){
      text(page.paragraphs);
      const idx=beats.findIndex(b=>b.id===scene),objectID=beats[idx].object;
      if(objectID){
        const object=objects[objectID];
        const seen=current.events.some(e=>e.kind==='inspect' && e.id===objectID);
        if(!seen){
          buttons.append(control(t(...object.button),()=>{
            current.events.push(event('inspect',objectID));paint();bodyFocus('[data-object]');
          },'inspect',objectID,'night-cta'));
        }else{
          const artifact=el('section',null,'seat-artifact'),name=el('h3',t(...object.heading));
          name.tabIndex=-1;name.dataset.object=objectID;
          artifact.append(name,el('p',t(...object.text)));
          if(objectID==='tape')stopAudio=excerpt(ui,artifact);
          body.append(artifact);
          buttons.append(control(t(...pages[beats[idx+1].id].title),()=>{
            current.scene=beats[idx+1].id;
            current.events.push(event('read',current.scene));paint(true);
          },'next',beats[idx+1].id,'night-cta'));
        }
      }else{
        const checkpoint=el('section',null,'seat-checkpoint');
        checkpoint.append(el('p',t('ضعي علامة هنا إن أردتِ الرجوع قبل اتخاذ القرار.','Bookmark this point if you want to come back before deciding.')));
        const save=control(t('احفظي موضع القراءة على هذا الجهاز','Save this place on this device'),()=>{
          const mark={version:1,scene:'interval',events:current.events.map(e=>({...e}))};
          const ok=invalidMark?ui.replaceDraft(mark):ui.save(mark);
          if(ok){savedMark=mark;invalidMark=false;paint();bodyFocus('[data-checkpoint-status]');}
        },'checkpoint');
        if(savedMark) {
          const state=el('p',t('موضع القراءة محفوظ عند هذه الدقيقة.','This minute is bookmarked on this device.'),'seat-status');
          state.tabIndex=-1;state.dataset.checkpointStatus='';checkpoint.append(state);
        }else{
          if(invalidMark)save.textContent=t('استبدلي علامة القراءة غير المقروءة','Replace the unreadable bookmark');
          checkpoint.append(save);
        }
        body.append(checkpoint);
        const choices=el('div',null,'seat-choices');
        for(const key of options)choices.append(control(t(...endings[key].choice),()=>{
          current.ending=key;current.scene='outcome';current.events.push(event('choose',key));kept=false;paint(true);
        },'choice',key));
        body.append(choices);
      }
    }else if(scene==='outcome'){
      text(branch.before);
      if(ending==='play'){
        const artifact=el('section',null,'seat-artifact');stopAudio=excerpt(ui,artifact);body.append(artifact);
      }
      buttons.append(control(t(...branch.action),()=>{
        current.events.push(event('perform',ending),event('finish',ending));current.scene='result';paint(true);
      },'perform',ending,'night-cta'));
    }else{
      text(branch.after);
      const save=control(t('احتفظي بهذه النهاية في دفتر أعمالي','Keep this ending in my portfolio'),()=>{
        if(kept)return;
        const data={version:1,ending,events:current.events.map(row=>({...row}))};
        if(!validPiece(data))return;
        const preview=thumbnail(img);
        const piece={title:t(...title)+' · '+t(...branch.title),type:'seat-ending',data};
        if(preview)piece.thumbnail=preview;
        if(ui.savePiece(piece)){kept=true;save.disabled=true;save.textContent=t('النهاية محفوظة في الدفتر','Ending kept in your portfolio');}
      },'keep','','night-cta');
      if(kept){save.disabled=true;save.textContent=t('النهاية محفوظة في الدفتر','Ending kept in your portfolio');}
      buttons.append(save,control(t('ارجعي إلى اختيار سلمى','Revisit Salma’s choice'),()=>{
        current={scene:'interval',ending:null,events:approachEvents()};kept=false;paint(true);
      },'revisit'),control(t('اقرئي القصة من البداية','Read again from the beginning'),()=>{
        current=initial();kept=false;missingPiece=false;paint(true);
      },'replay'));
    }
    if(buttons.childElementCount)body.append(buttons);
  }
  function bodyFocus(selector){root.querySelector(selector)?.focus();}
  paint();
  return ()=>stopAudio?.();
}});
