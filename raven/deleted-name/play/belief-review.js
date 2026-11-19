/* A private reflection editor. The existing case.note preview owns confirmation
   and persistence. This component never posts, edits a saved note or shares it. */
(() => {
  'use strict';
  const app = document.getElementById('case-app');
  if (!app || document.getElementById('belief-review')) return;
  const PREFIX = 'مراجعة اعتقاد | Belief review';
  const WORDS = {
    ar: {
      title:'كنت أظن / الحين أعرف', scope:'هذه مراجعتك الخاصة، وليست شهادة أو إثباتًا لصحة الاستنتاج. لا تصل إلى الشخصيات.',
      draft:'ما تكتبه هنا مسودة في هذه الصفحة. راجع الملاحظة ثم أكّدها في معاينة القضية لحفظها.',
      before:'كنت أظن', after:'الحين أعرف — بحسب قراءتي', source:'المادة التي جعلتني أراجع اعتقادي', choose:'اختر مادة وصلت إليك',
      add:'راجع الحفظ', fresh:'ابدأ مراجعة أخرى', history:'تاريخ المراجعات', empty:'لا مراجعات مؤكدة بعد. عند التأكيد تضاف المراجعة كملاحظة جديدة؛ لا تستبدل السابقة.',
      saved:'المراجعات المعروضة محفوظة في جلسة القضية على الخادم. لا تصل إلى الشخصيات تلقائيًا.',
      memory:'المراجعات المعروضة مضافة إلى ذاكرة جلسة الخادم فقط؛ قد تفقدها إعادة تشغيله. يمكنك تنزيلها من دفتر القضية.',
      browserSaved:'المراجعات المعروضة محفوظة مع تقدم هذه القضية في هذا المتصفح. حذف بياناته يحذف النسخة المحلية.',
      unsaved:'لم يُؤكَّد حفظ آخر حالة. المراجعات المعروضة للقراءة؛ أبقِ الصفحة مفتوحة وراجع تنبيه الحفظ في القضية.',
      initial:'تُضاف المراجعة إلى السجل بعد تأكيد الملاحظة في معاينة القضية.',
      invalid:'اكتب الاعتقاد السابق وقراءتك الجديدة، واختر مادة مكتسبة. يجب أن يختلف النصان؛ الحد 700 حرف لكل حقل.',
      unavailable:'إضافة الملاحظات غير متاحة الآن. أبقينا مسودتك هنا حتى يتاح الفعل في القضية.',
      locked:'تغييرات القضية متوقفة حاليًا. أبقينا مسودتك؛ راجع حالة الحفظ أو الاتصال قبل المحاولة.',
      draftExists:'توجد مسودة أخرى في دفتر القضية. لم نستبدلها. راجعها أولًا؛ مسودة الاعتقاد ما زالت هنا.',
      noteDraft:'اذهب إلى مسودة الدفتر', previewed:'فُتحت معاينة الملاحظة. لم تُحفظ هذه المراجعة بعد؛ أكّدها هناك أو ارجع للتعديل.',
      confirmed:'وصلت المراجعة ضمن ملاحظات الجلسة. بقيت المراجعات السابقة دون تغيير.',
      missing:'مصدر الملاحظة غير معروض حاليًا؛ لا نضيف له محتوى من عندنا.', reviewAgain:'أضف مراجعة مرتبطة', openSource:'ارجع إلى المادة',
      entry:'مراجعة', previous:'المراجعة السابقة — للقراءة فقط', follows:'مرجع المراجعة السابقة', noMaterials:'تظهر المصادر حين تصل إليك مواد. لا تُعرض مواد مقفلة هنا.',
      failed:'تعذّر فتح معاينة الحفظ. مسودتك ما زالت في الحقول؛ لم تُرسل هذه البطاقة أي طلب.'
    },
    en: {
      title:'I thought / Now I understand', scope:'This is your private reflection, not testimony or proof that a conclusion is correct. It does not reach characters.',
      draft:'These fields are a draft on this page. Review the note, then confirm it in the case preview to save it.',
      before:'I thought', after:'Now I understand — my reading', source:'The material that changed my reading', choose:'Choose a material you received',
      add:'Review saving', fresh:'Start another reflection', history:'Reflection history', empty:'No confirmed reflections yet. Confirmation appends a new note; it does not replace the previous one.',
      saved:'The displayed reflections are saved in the case session on the server. They do not automatically reach characters.',
      memory:'The displayed reflections were added only to the server session’s memory; restarting it may lose them. You can download them from the case notebook.',
      browserSaved:'The displayed reflections are saved with this case in this browser. Deleting browser data removes that local copy.',
      unsaved:'Saving the latest state is unconfirmed. The displayed reflections are for reading; keep this page open and check the case save notice.',
      initial:'A reflection enters the history after you confirm the note in the case preview.',
      invalid:'Write the previous belief and your new reading, and choose an earned source. The statements must differ; each field allows 700 characters.',
      unavailable:'Adding notes is not currently available. Your draft remains here until the case makes that action available.',
      locked:'Case changes are currently paused. Your draft remains; check saving or the connection before trying again.',
      draftExists:'Another draft exists in the case notebook. It was not replaced. Review it first; your reflection draft remains here.',
      noteDraft:'Go to the notebook draft', previewed:'The note preview is open. This reflection is not saved yet; confirm it there or return to edit.',
      confirmed:'The reflection arrived in the session notes. Previous reflections remain unchanged.',
      missing:'The note’s source is not currently displayed; no content has been invented for it.', reviewAgain:'Append a linked reflection', openSource:'Return to the material',
      entry:'Reflection', previous:'Previous reflection — read only', follows:'Previous reflection reference', noMaterials:'Source choices appear when materials reach you. Locked materials are not listed here.',
      failed:'The save preview could not open. Your draft remains in the fields; this card sent no request.'
    }
  };
  let locale = document.documentElement.lang === 'en' ? 'en' : 'ar';
  let view = null, scope = '', parentId = null, pending = null, busy = false, messageKey = null;
  const t = key => WORDS[locale][key];
  const local = value => typeof value === 'string' ? value : value?.[locale] || value?.ar || value?.en || '';
  const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,199}$/.test(value);
  const node = (tag, value, className) => {const el=document.createElement(tag);if(value!==undefined)el.textContent=value;if(className)el.className=className;return el;};
  const button = (id,key,handler) => {const el=node('button',t(key));el.type='button';el.id=id;el.dataset.beliefText=key;el.addEventListener('click',handler);return el;};
  const section=node('details',undefined,'panel belief-review');section.id='belief-review';section.hidden=true;
  const summary=node('summary',t('title'));summary.dataset.beliefText='title';section.append(summary);
  for(const key of ['scope','draft']){const p=node('p',t(key),'belief-scope');p.dataset.beliefText=key;section.append(p);}
  const saveStatus=node('p',t('initial'),'belief-save-status');saveStatus.id='belief-save-status';section.append(saveStatus);
  const form=node('form');form.id='belief-form';form.noValidate=true;
  const previous=node('aside',undefined,'belief-linked');previous.id='belief-previous';previous.hidden=true;
  const previousLabel=node('p',t('previous'));previousLabel.dataset.beliefText='previous';
  const previousText=node('blockquote');previousText.id='belief-previous-text';previous.append(previousLabel,previousText);form.append(previous);
  const fields={};
  for(const key of ['before','after','source']){
    const wrap=node('div',undefined,'belief-field'),label=node('label',t(key));label.htmlFor='belief-'+key;label.dataset.beliefText=key;
    const input=node(key==='source'?'select':'textarea');input.id='belief-'+key;input.name=key;input.required=true;
    if(key!=='source'){input.maxLength=700;input.rows=3;input.dir='auto';}fields[key]=input;wrap.append(label,input);form.append(wrap);
  }
  const noMaterials=node('p',t('noMaterials'),'muted');noMaterials.dataset.beliefText='noMaterials';form.append(noMaterials);
  const controls=node('div',undefined,'buttons belief-buttons');
  const add=node('button',t('add'),'primary');add.type='submit';add.id='belief-add';add.dataset.beliefText='add';
  const fresh=button('belief-new','fresh',()=>{parentId=null;pending=null;fields.before.value='';fields.after.value='';fields.source.value='';render();fields.before.focus();});
  controls.append(add,fresh);form.append(controls);section.append(form);
  const status=node('p');status.id='belief-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');section.append(status);
  const announce=key=>{messageKey=key;status.textContent=t(key);};
  const notebookLink=button('belief-notebook-draft','noteDraft',()=>{
    const target=document.querySelector('#notebook-actions textarea') || document.querySelector('#notebook-actions button') || document.getElementById('notebook');
    const notebook=document.getElementById('notebook');if(notebook)notebook.open=true;
    target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest',behavior:'instant'});
  });notebookLink.hidden=true;section.append(notebookLink);
  const historyTitle=node('h3',t('history'));historyTitle.dataset.beliefText='history';section.append(historyTitle);
  const history=node('ol',undefined,'belief-history');history.id='belief-history';section.append(history);
  const notebook=document.getElementById('notebook');if(notebook)notebook.after(section);else app.append(section);
  const material=id=>view?.materials.find(item=>item.id===id);
  const reflections=()=>view?.notes.filter(note=>typeof note.text==='string' && note.text.startsWith(PREFIX+'\n')) || [];
  const matchingParent=()=>reflections().find(note=>note.id===parentId);
  function persistenceText(){
    if(!reflections().length)return t('initial');
    if(view.persistence==='browser-checkpoint')return t(view.checkpointSaved?'browserSaved':'unsaved');
    if(view.saveStatus==='confirmed' && view.persistence==='disk-file')return t('saved');
    if(view.saveStatus==='memory' && view.persistence==='process-memory')return t('memory');
    return t('unsaved');
  }
  function render(){
    for(const el of section.querySelectorAll('[data-belief-text]'))el.textContent=t(el.dataset.beliefText);
    saveStatus.textContent=persistenceText();status.textContent=messageKey?t(messageKey):'';
    const chosen=fields.source.value;fields.source.replaceChildren(new Option(t('choose'),''));
    for(const item of view?.materials || [])fields.source.append(new Option(local(item.title)||item.id,item.id));
    if(material(chosen))fields.source.value=chosen;
    noMaterials.hidden=Boolean(view?.materials.length);add.disabled=busy || Boolean(view?.locked) || !view?.materials.length;
    previous.hidden=!matchingParent();previousText.textContent=matchingParent()?.text || '';
    const opened=new Set([...history.querySelectorAll('details[open]')].map(item=>item.dataset.reflectionId));history.replaceChildren();
    const notes=reflections();if(!notes.length)history.append(node('li',t('empty'),'muted'));
    for(const [index,note] of notes.entries()){
      const li=node('li'),card=node('details',undefined,'belief-record');card.dataset.reflectionId=note.id;card.open=opened.has(note.id);card.id='belief-entry-'+encodeURIComponent(note.id);
      card.append(node('summary',t('entry')+' '+(index+1)),node('p',note.text,'belief-record-text'));
      const source=material(note.sourceId);card.append(node('p',source?local(source.title)||source.id:t('missing'),'belief-record-source'));
      const actions=node('div',undefined,'buttons belief-buttons');
      const revise=node('button',t('reviewAgain'));revise.type='button';revise.dataset.beliefRevise=note.id;
      revise.addEventListener('click',()=>{parentId=note.id;pending=null;fields.before.value='';fields.after.value='';fields.source.value='';render();fields.before.focus();fields.before.scrollIntoView({block:'nearest',behavior:'instant'});});actions.append(revise);
      if(source){const openSource=node('button',t('openSource'));openSource.type='button';openSource.dataset.beliefSource=source.id;
        openSource.addEventListener('click',()=>{if(!material(source.id))return;const target=document.getElementById('material-'+encodeURIComponent(source.id));if(target){if(target instanceof HTMLDetailsElement)target.open=true;target.focus({preventScroll:true});target.scrollIntoView({block:'nearest',behavior:'instant'});}});actions.append(openSource);}
      card.append(actions);li.append(card);history.append(li);
    }
  }
  function formatted(before,after){
    let text=PREFIX+'\n\nكنت أظن | I thought:\n'+before+'\n\nالحين أعرف — بحسب قراءتي | Now I understand — my reading:\n'+after;
    if(matchingParent())text+='\n\nمرجع المراجعة السابقة | Previous reflection: '+parentId;
    return text;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!view || busy)return;
    if(view.locked){announce('locked');return;}
    const before=fields.before.value.trim(),after=fields.after.value.trim(),sourceId=fields.source.value;
    if(!before || !after || before===after || before.length>700 || after.length>700 || !material(sourceId)){announce('invalid');return;}
    const text=formatted(before,after);if(text.length>2000){announce('invalid');return;}
    const prepare=window.RavenBeliefReview?.prepareNote;
    if(typeof prepare!=='function'){announce('unavailable');return;}
    busy=true;add.disabled=true;notebookLink.hidden=true;
    try{
      const outcome=await prepare({text,sourceId,returnFocus:'belief-add'});
      if(!outcome?.ok){
        const reason=outcome?.reason;announce(reason==='draft-exists'?'draftExists':reason==='locked'?'locked':reason==='invalid'?'invalid':'unavailable');notebookLink.hidden=reason!=='draft-exists';return;
      }
      pending={text,sourceId,before,after,parentId,knownIds:new Set(view.notes.map(note=>note.id))};announce('previewed');
    }catch{announce('failed');}
    finally{busy=false;add.disabled=Boolean(view?.locked)||!view?.materials.length;}
  });
  function receive(next){
    locale=next?.locale==='en'?'en':'ar';
    if(!next || !safeId(next.caseId) || !safeId(next.contentVersion) || !Number.isSafeInteger(next.revision) || next.revision<0 || !Array.isArray(next.materials) || !next.materials.every(item=>safeId(item?.id))){section.hidden=true;view=null;return;}
    const nextScope=JSON.stringify([next.caseId,next.contentVersion]);
    view={caseId:next.caseId,contentVersion:next.contentVersion,revision:next.revision,materials:next.materials.map(item=>({id:item.id,title:item.title})),notes:Array.isArray(next.notes)?next.notes.filter(note=>note && typeof note.id==='string' && typeof note.text==='string').map(note=>({id:note.id,text:note.text,sourceId:note.sourceId})):[],locked:Boolean(next.locked),saveStatus:next.saveStatus,persistence:next.persistence,checkpointSaved:next.checkpointSaved===true};
    if(nextScope!==scope){scope=nextScope;parentId=null;pending=null;messageKey=null;fields.before.value='';fields.after.value='';fields.source.value='';}
    let confirmed=false;
    const acknowledged=(view.persistence==='disk-file' && view.saveStatus==='confirmed') || (view.persistence==='process-memory' && view.saveStatus==='memory') || (view.persistence==='browser-checkpoint' && view.checkpointSaved);
    if(pending && acknowledged && view.notes.some(note=>!pending.knownIds.has(note.id) && note.text===pending.text && note.sourceId===pending.sourceId)){
      if(fields.before.value.trim()===pending.before && fields.after.value.trim()===pending.after && fields.source.value===pending.sourceId && parentId===pending.parentId){fields.before.value='';fields.after.value='';fields.source.value='';parentId=null;}
      pending=null;confirmed=true;
    }
    if(parentId && !matchingParent())parentId=null;
    section.hidden=false;render();if(confirmed)announce('confirmed');
  }
  document.addEventListener('raven:belief-view',event=>receive(window.RavenBeliefReview?.getView?.() || event.detail));
  const initial=window.RavenBeliefReview?.getView?.();if(initial)receive(initial);else render();
})();
