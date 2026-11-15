/* Presentation-only tools for a projected case view. No story rules, provider
   credentials, case writes, hidden materials or actor knowledge live here. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const WORDS = {
    ar:{eyebrow:'مساحة مراجعة خاصة',title:'غرفة التحقيق',lead:'اقرأ المصدر. اختبر العلاقة. واترك مكانًا لما لم يُحسم.',draft:'واجهة أدوات محلية للمراجعة. النصوص من خادم القضية، والحوار المعروض مكتوب.',back:'العودة إلى القضية',toolsEyebrow:'أدوات القراءة',boardTitle:'مساحة ربط الأدلة',boardScope:'الروابط أسئلتك وفرضياتك الخاصة. لا تثبت تناقضًا، ولا تمنح دليلًا أو إذنًا، ولا تصل إلى الشخصيات.',inspectTitle:'افحص مادة',inspectSelect:'مادة وصلت إليك',inspectOpen:'افتح عدسة القراءة',inspectChoose:'اختر مادة للفحص أولًا.',inspectScope:'تكبير النص والتباين فقط؛ لا تكشف العدسة معلومات مخفية.',hintTitle:'تحليل RAVEN',hintScope:'إرشاد مكتوب من الخيارات المتاحة الآن، بلا توليد حي أو كشف للحل.',hintButton:'أرني نقطة متابعة',first:'المصدر الأول',second:'المصدر الثاني',kind:'نوع الرابط الذي تكتبه',question:'سؤال مفتوح',hypothesis:'فرضية',observation:'ملاحظة',note:'ما العلاقة التي تريد اختبارها؟',add:'أضف رابطًا خاصًا',export:'نزّل لوحتي',reload:'أعد قراءة اللوحة المحفوظة',close:'إغلاق',zoom:'تكبير القراءة',scan:'زيادة التباين',source:'المصدر',choose:'اختر مادة',count:'مادة مكتسبة',empty:'ابدأ بسؤال بين مصدرين فحصتهما. لا توجد روابط خاصة بعد.',same:'اختر مصدرين مختلفين واكتب العلاقة التي تريد اختبارها.',limit:'بلغت اللوحة حدها: 24 رابطًا. نزّل نسختك أو احذف رابطًا قبل الإضافة.',saved:'حُفظت لوحتك في هذا المتصفح فقط؛ لا تُرسل إلى الخادم أو الشخصيات.',unidentified:'تعذّر تحديد هوية الجلسة؛ كتابة اللوحة وتنزيلها متوقفان لحماية ملاحظاتك. يمكنك فحص المواد وقراءة الإرشاد.',memory:'اللوحة في ذاكرة هذه الصفحة فقط. نزّلها قبل إغلاق الصفحة؛ لم نؤكد حفظًا دائمًا.',unsaved:'تعذر تأكيد الحفظ. تبقى الروابط في هذه الصفحة؛ نزّلها قبل المغادرة.',protected:'النسخة المحفوظة غير قابلة للقراءة أو لا تطابق النطاق. أبقيناها دون تغيير؛ الإضافة متوقفة.',conflict:'تغيّرت اللوحة في تبويب آخر. نزّل نسختك الحالية ثم أعد قراءة اللوحة المحفوظة قبل التحرير.',remove:'حذف الرابط',missing:'رابط لمادة غير معروضة في هذه الجلسة؛ لا نستعيد مضمونها من التخزين.',hint:'نقطة متابعة متاحة الآن: ',hintEnd:'لا توجد خطوة متابعة معروضة الآن. يمكنك مراجعة مصادرك وملاحظاتك دون استنتاج جديد.',hintLimit:'اختيار المتابعة لا يثبت نتيجة التحقيق.',noSources:'لم تصل مواد قابلة للفحص بعد.',sessionChanged:'تغيّر نطاق الجلسة. اللوحة المعروضة تخص النطاق الحالي فقط.'},
    en:{eyebrow:'Private review workspace',title:'The investigation room',lead:'Read the source. Test the connection. Leave room for what remains unresolved.',draft:'Local tools for review. Text comes from the case server; the displayed dialogue is written.',back:'Return to the case',toolsEyebrow:'Reading tools',boardTitle:'Evidence connections',boardScope:'Connections are your private questions and hypotheses. They prove no contradiction, grant no evidence or permission, and do not reach characters.',inspectTitle:'Inspect a material',inspectSelect:'A material you received',inspectOpen:'Open reading lens',inspectChoose:'Choose a material to inspect first.',inspectScope:'Text magnification and contrast only; the lens reveals no hidden information.',hintTitle:'RAVEN analysis',hintScope:'Written guidance from actions available now, without live generation or solution spoilers.',hintButton:'Show a follow-up',first:'First source',second:'Second source',kind:'Your connection type',question:'Open question',hypothesis:'Hypothesis',observation:'Observation',note:'Which connection do you want to test?',add:'Add a private connection',export:'Download my board',reload:'Reload the saved board',close:'Close',zoom:'Reading magnification',scan:'Increase contrast',source:'Source',choose:'Choose a material',count:'earned materials',empty:'Start with a question between two examined sources. No private connections yet.',same:'Choose two different sources and write the connection you want to test.',limit:'The board holds 24 connections. Download your copy or remove a connection before adding another.',saved:'Your board was saved in this browser only; it is not sent to the server or characters.',unidentified:'The session identity is unavailable. Board editing and download are paused to protect your notes; inspection and written guidance remain available.',memory:'The board exists only in this page’s memory. Download it before closing; durable saving is not confirmed.',unsaved:'Saving could not be confirmed. Connections remain in this page; download them before leaving.',protected:'The saved copy is unreadable or does not match this scope. It was preserved unchanged; adding is paused.',conflict:'The board changed in another tab. Download your current copy, then reload the saved board before editing.',remove:'Remove connection',missing:'A connection refers to material not displayed in this session; its contents are not restored from storage.',hint:'A follow-up currently available: ',hintEnd:'No follow-up action is displayed now. You can review sources and notes without adding a conclusion.',hintLimit:'Choosing a follow-up does not establish an investigation result.',noSources:'No inspectable materials have arrived yet.',sessionChanged:'The session scope changed. This board belongs only to the current scope.'},
  };
  let view = null, locale = document.documentElement.lang === 'en' ? 'en' : 'ar', scope = '', key = null;
  let links = [], observedRaw = null, saveStatus = 'memory', locked = false, hintIndex = 0, activeMaterial = null;
  let opener = null, pulseTimer = null;
  const t = k => WORDS[locale][k] || k;
  const localized = x => typeof x === 'string' ? x : x?.[locale] || x?.ar || x?.en || '';
  const text = (tag,value,className) => {const n=document.createElement(tag);n.textContent=value;if(className)n.className=className;return n;};
  const material = id => view?.materials.find(m => m.id === id);
  const safeId = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/.test(x);
  const boardObject = () => ({schemaVersion:1,caseId:view.caseId,sessionTag:view.sessionId,contentVersion:view.contentVersion,links});
  function validBoard(data) {
    return data && Object.getPrototypeOf(data) === Object.prototype && data.schemaVersion === 1 && data.caseId === view.caseId && data.sessionTag === view.sessionId && data.contentVersion === view.contentVersion && Array.isArray(data.links) && data.links.length <= 24 && new Set(data.links.map(x=>x.id)).size === data.links.length && data.links.every(x=>x && safeId(x.id) && safeId(x.a) && safeId(x.b) && x.a !== x.b && ['question','hypothesis','observation'].includes(x.kind) && typeof x.note === 'string' && x.note.trim().length > 0 && x.note.length <= 800);
  }
  function readBoard() {
    links=[];observedRaw=null;locked=false;saveStatus='memory';
    if (!key) {locked=true;saveStatus='unidentified';return;}
    try {
      observedRaw=localStorage.getItem(key);
      if (observedRaw !== null) {
        if (observedRaw.length > 60000) throw new Error('large');
        const data=JSON.parse(observedRaw);if (!validBoard(data)) throw new Error('scope');
        links=data.links;saveStatus='saved';
      }
    } catch {locked=true;saveStatus='protected';}
  }
  function saveBoard() {
    if (!key) {locked=true;saveStatus='unidentified';return;}
    const value=JSON.stringify(boardObject());
    try {
      const current=localStorage.getItem(key);
      // A failed readback may still have written this exact board.
      if (current !== observedRaw && current !== value) {locked=true;saveStatus='conflict';return;}
      localStorage.setItem(key,value);
      if (localStorage.getItem(key) !== value) throw new Error('readback');
      observedRaw=value;saveStatus='saved';
    } catch {saveStatus='unsaved';}
  }
  function setStatus(code) {$('lab-board-status').textContent=t(code || saveStatus);}
  function renderLinks() {
    const focused=document.activeElement?.id;
    $('lab-links').replaceChildren();
    if (!links.length) $('lab-links').append(text('li',t('empty'),'muted'));
    links.forEach(link=>{
      const item=text('li','','lab-link'),header=text('div','','lab-link-header');
      header.append(text('span',t(link.kind),'lab-link-kind'));
      const remove=text('button',t('remove'));remove.type='button';remove.id='lab-remove-'+link.id;remove.disabled=locked;
      remove.addEventListener('click',()=>{if(locked)return;links=links.filter(x=>x.id!==link.id);saveBoard();renderLinks();$('lab-link-add').focus({preventScroll:true});});
      header.append(remove);item.append(header);
      const a=material(link.a),b=material(link.b);
      if (a&&b) {const pair=text('div','','lab-link-sources');pair.append(text('span',localized(a.title)),text('span','↔'),text('span',localized(b.title)));item.append(pair,text('p',link.note));}
      else item.append(text('p',t('missing'),'muted'));
      $('lab-links').append(item);
    });
    $('lab-link-add').disabled=locked || !view?.sessionId || view.materials.length<2;
    for (const id of ['lab-link-a','lab-link-b','lab-link-kind','lab-link-note','lab-board-export']) $(id).disabled=!view?.sessionId;
    $('lab-board-reload').hidden=!key || !locked;
    setStatus();
    if(focused?.startsWith('lab-remove-')) {
      const replacement=$(focused),recovery=$('lab-board-reload');
      if(replacement && !replacement.disabled) replacement.focus({preventScroll:true});
      else if(locked && !recovery.hidden) recovery.focus({preventScroll:true});
    }
  }
  function fillSelect(id) {
    const el=$(id),value=el.value;
    el.replaceChildren(new Option(t('choose'),''));
    for(const m of view?.materials || [])el.append(new Option(localized(m.title),m.id));
    if(material(value))el.value=value;
  }
  function renderInspector() {
    const m=material(activeMaterial);if(!m){if($('lab-inspector').open)$('lab-inspector').close();return;}
    $('lab-inspector-title').textContent=localized(m.title);$('lab-inspector-body').textContent=localized(m.body);$('lab-inspector-source').textContent=localized(m.source);
  }
  function renderText() {
    for(const el of document.querySelectorAll('[data-lab]'))el.textContent=t(el.dataset.lab);
    document.title='RAVEN — '+t('title');
    const home='../'+(locale==='en'?'?lang=en':'');$('home-link').href=home;$('case-link').href='../deleted-name/play/'+(locale==='en'?'?lang=en':'');
    $('lab-case-id').textContent=view?.caseId || '';
    $('lab-material-count').textContent=(view?.materials.length || 0)+' '+t('count');
    for(const id of ['lab-inspect-select','lab-link-a','lab-link-b'])fillSelect(id);
    $('lab-inspect-open').disabled=!view?.materials.length;
    $('lab-hint-output').textContent='';renderLinks();renderInspector();
  }
  function receive(event) {
    const next=event.detail;locale=next?.locale==='en'?'en':document.documentElement.lang==='en'?'en':'ar';
    const valid=next && safeId(next.caseId) && safeId(next.contentVersion) && Number.isSafeInteger(next.revision) && Array.isArray(next.materials) && next.materials.every(x=>safeId(x.id)) && Array.isArray(next.actions);
    if (!valid) {view=null;scope='';key=null;links=[];for(const id of ['lab-link-a','lab-link-b','lab-link-note'])$(id).value='';$('lab-link-kind').value='question';if($('lab-inspector').open)$('lab-inspector').close();$('lab-workbench').hidden=true;renderText();return;}
    const tag=typeof next.sessionId==='string' && /^[A-Za-z0-9_-]{1,200}$/.test(next.sessionId)?next.sessionId:null;
    const nextScope=JSON.stringify([next.caseId,next.contentVersion,tag]);
    view={caseId:next.caseId,contentVersion:next.contentVersion,sessionId:tag,revision:next.revision,materials:next.materials,actions:next.actions};
    if(!tag || nextScope!==scope){scope=nextScope;key=tag?'raven.investigation.board.v1.'+encodeURIComponent(scope):null;readBoard();for(const id of ['lab-link-a','lab-link-b','lab-link-note'])$(id).value='';$('lab-link-kind').value='question';hintIndex=0;activeMaterial=null;if($('lab-inspector').open)$('lab-inspector').close();}
    $('lab-workbench').hidden=false;renderText();
  }
  $('lab-link-form').addEventListener('submit',event=>{
    event.preventDefault();if(!view?.sessionId||locked)return;
    const a=$('lab-link-a').value,b=$('lab-link-b').value,kind=$('lab-link-kind').value,note=$('lab-link-note').value.trim();
    if(!material(a)||!material(b)||a===b||!note||note.length>800||!['question','hypothesis','observation'].includes(kind)){setStatus('same');return;}
    if(links.length>=24){setStatus('limit');return;}
    links.push({id:crypto.randomUUID(),a,b,kind,note});saveBoard();$('lab-link-note').value='';renderLinks();
  });
  $('lab-board-reload').addEventListener('click',()=>{
    if(!view)return;
    const recovery=$('lab-board-reload'),wasFocused=document.activeElement===recovery;
    readBoard();renderLinks();
    if(wasFocused && recovery.hidden) {
      const next=$('lab-links').querySelector('button:not(:disabled)') || (!$('lab-link-note').disabled ? $('lab-link-note') : null);
      next?.focus({preventScroll:true});
    }
  });
  $('lab-board-export').addEventListener('click',()=>{
    if(!view?.sessionId)return;const blob=new Blob([JSON.stringify({...boardObject(),scope:'private-player-hypotheses-not-evidence'},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='raven-private-board.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('lab-inspect-open').addEventListener('click',()=>{
    const id=$('lab-inspect-select').value;if(!material(id)){setStatus('inspectChoose');return;}
    activeMaterial=id;opener=document.activeElement;renderInspector();$('lab-inspector').showModal();$('lab-inspector-close').focus();
  });
  $('lab-inspector-close').addEventListener('click',()=>$('lab-inspector').close());
  $('lab-inspector').addEventListener('close',()=>{opener?.focus({preventScroll:true});});
  $('lab-zoom').addEventListener('input',()=>{const value=Number($('lab-zoom').value);$('lab-inspector-body').style.setProperty('--lab-zoom',String(value/100));$('lab-zoom-value').textContent=value+'%';});
  $('lab-scan').addEventListener('click',()=>{
    const dialog=$('lab-inspector'),enabled=dialog.classList.toggle('lab-contrast');$('lab-scan').setAttribute('aria-pressed',String(enabled));
    clearTimeout(pulseTimer);dialog.classList.remove('lab-pulse');
    if(enabled&&!matchMedia('(prefers-reduced-motion: reduce)').matches){void dialog.offsetWidth;dialog.classList.add('lab-pulse');pulseTimer=setTimeout(()=>dialog.classList.remove('lab-pulse'),600);}
  });
  $('lab-hint-button').addEventListener('click',()=>{
    const actions=(view?.actions || []).filter(a=>a.id!=='case.note' && typeof a.id==='string' && localized(a.label));
    $('lab-hint-output').textContent=actions.length?t('hint')+localized(actions[hintIndex++%actions.length].label)+'\n'+t('hintLimit'):t('hintEnd');
  });
  window.addEventListener('storage',event=>{if(key && (event.key===key || event.key===null)){locked=true;saveStatus='conflict';renderLinks();}});
  document.addEventListener('raven:case-view',receive);renderText();
})();
