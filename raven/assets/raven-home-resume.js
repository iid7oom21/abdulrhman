/* Read-only case availability and device-local viewing choices. */
(() => {
  'use strict';
  const galleryPage=document.body.hasAttribute('data-screening-gallery');
  const ravenRoot=new URL('../',document.currentScript.src);
  const english=()=>document.documentElement.lang==='en';
  const words={
    caseKicker:['جلسة قضية متاحة','A case session is available'],caseTitle:['ارجع للقضية','Return to the case'],caseAction:['ارجع للقضية','Return to the case'],
    confirmed:['الجلسة متاحة للمتابعة.','Your session is available to continue.'],
    memory:['الجلسة الحالية متاحة؛ الحفظ الدائم غير مؤكّد.','The current session is available; lasting storage is not confirmed.'],
    browser:['ستتحقق شاشة اللعب من نسخة هذا المتصفح قبل المتابعة.','The play screen will check this browser’s copy before continuing.'],
    resume:['أكمل من ','Continue from '],start:['ابدأ من أول','Start from the beginning'],
    stored:['آخر موضع محفوظ على هذا الجهاز: ','Last position stored on this device: '],
    unavailable:['تعذر تأكيد حفظ موضع المشاهدة على هذا الجهاز.','The viewing position could not be confirmed as saved on this device.'],
    later:['للمشاهدة لاحقًا','Watch later'],
    laterFailed:['تعذّر تأكيد تغيير قائمة المشاهدة على هذا الجهاز.','Could not confirm the watch-later change on this device.'],
    backstage:['خلف الكادر','Behind the Frame'],back:['العودة للحلقات','Back to episodes']
  };
  const text=key=>words[key][english()?1:0];
  const time=seconds=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
  const caseCard=document.getElementById('rvnCaseResume');
  const saveStatus=document.getElementById('rvnFilmSaveStatus');
  const controls=[];let summary=null,currentEpisode=1;
  const afterLater=document.getElementById('rvnAfterLater');
  const afterFeedback=document.getElementById('rvnAfterLaterFeedback');
  const laterKey=id=>'raven17_watch_later_'+id;
  const laterFailed=new Set();
  function readLater(id){
    try { return localStorage.getItem(laterKey(id))==='1'; }
    catch { return null; }
  }
  function toggleLater(id){
    const saved=readLater(id);
    let confirmed=false;
    if(saved!==null){
      const wanted=!saved;
      try {
        if(wanted)localStorage.setItem(laterKey(id),'1');
        else localStorage.removeItem(laterKey(id));
        confirmed=readLater(id)===wanted;
      } catch { /* Keep the last confirmed marker visible on failure. */ }
    }
    if(confirmed)laterFailed.delete(id);
    else laterFailed.add(id);
    renderLater();
  }
  function paintLater(button,feedback,id,inCredits){
    const episode=english()?'Episode '+id:'الحلقة '+id;
    const label=inCredits ? (english()?'Watch episode '+id+' later':'الحلقة '+id+' للمشاهدة لاحقًا') : text('later');
    const saved=readLater(id);
    button.textContent=label;
    button.setAttribute('aria-label',inCredits ? label : episode+' — '+label);
    if(saved===null)button.removeAttribute('aria-pressed');
    else button.setAttribute('aria-pressed',String(saved));
    feedback.hidden=!laterFailed.has(id);
    feedback.textContent=feedback.hidden?'':text('laterFailed');
  }
  function renderLater(){
    for(const {id,later,feedback} of controls)paintLater(later,feedback,id,false);
    if(!afterLater||!afterFeedback)return;
    const next=currentEpisode+1;
    afterLater.hidden=!controls.some(control=>control.id===next);
    afterFeedback.hidden=true;
    if(!afterLater.hidden)paintLater(afterLater,afterFeedback,next,true);
  }
  afterLater?.addEventListener('click',()=>{if(!afterLater.hidden)toggleLater(currentEpisode+1);});
  function read(id){return window.RavenEpisodeProgress?.read(id)||{available:false,seconds:0,status:'unavailable'};}
  document.querySelectorAll('[data-visual-episode]').forEach(link=>{
    const id=Number(link.dataset.visualEpisode),card=link.closest('.rvnVisualEpisode');
    if(!card||!window.ravenStartEpisode||!window.ravenResumeEpisode)return;
    const group=document.createElement('div');group.className='rvnEpisodeResumeControls';
    const status=document.createElement('p');status.className='rvnEpisodeProgress';
    const resume=document.createElement('button'),start=document.createElement('button');
    resume.type=start.type='button';resume.dataset.filmResume=String(id);start.dataset.filmStart=String(id);
    resume.addEventListener('click',event=>{window.ravenResumeEpisode(event,id);render();});
    start.addEventListener('click',event=>{window.ravenStartEpisode(event,id);render();});
    const later=document.createElement('button');
    later.type='button';later.dataset.filmLater=String(id);
    later.addEventListener('click',()=>toggleLater(id));
    const feedback=document.createElement('p');
    feedback.className='rvnWatchLaterFeedback';feedback.hidden=true;feedback.setAttribute('role','status');
    group.append(status,resume,start,later,feedback);card.append(group);
    controls.push({id,status,resume,start,later,feedback});
  });
  // The activity opens only on request after the current episode.
  const workshop = document.createElement('a');
  workshop.id = 'rvnAfterWorkshop'; workshop.target = '_top';
  document.querySelector('#rvnAfterCredits .rvnAfterActions')?.append(workshop);
  const concepts = {
    1: ['camera','جرّب تأطير اللقطة','Try shot composition'],
    2: ['sound','جرّب توقيت الصوت','Try sound timing'],
    3: ['free','جرّب ترتيب اللقطات','Try sequencing a cut']
  };
  const paperCard = document.querySelector('[data-atmosphere-card="paper-detail"]');
  const exercise = document.createElement('details');
  exercise.className='rvnFramingExercise';
  const exerciseTitle=document.createElement('summary'), question=document.createElement('p');
  const choiceBox=document.createElement('div'), comparison=document.createElement('div');
  choiceBox.className='rvnFrameChoices';comparison.className='rvnFrameCrops';comparison.hidden=true;
  const images=['paper','phone'].map((name,i)=>{
    const button=document.createElement('button');button.type='button';button.dataset.frameChoice=name;
    const figure=document.createElement('figure'),crop=document.createElement('div'),image=document.createElement('img'),label=document.createElement('figcaption');
    crop.className='rvnFrameCrop '+name;image.loading='lazy';image.alt='';
    if(paperCard)image.src=new URL('assets/atmosphere-v1/paper-detail.webp',ravenRoot).href;
    crop.append(image);figure.append(crop,label);comparison.append(figure);choiceBox.append(button);
    button.setAttribute('aria-pressed','false');
    button.onclick=()=>{comparison.hidden=false;images.forEach((x,j)=>x.button.setAttribute('aria-pressed',String(i===j)));};
    return {button,label};
  });
  exercise.append(exerciseTitle,question,choiceBox,comparison);paperCard?.append(exercise);
  function updateWorkshop(){
    const language=english()?'en':'ar',concept=concepts[currentEpisode]||concepts[1];
    workshop.href=new URL('after-show/?'+new URLSearchParams({activity:concept[0],lang:language}),ravenRoot).href;
    workshop.textContent=concept[english()?2:1];
    exerciseTitle.textContent=english()?'Try two framings':'جرّب تأطيرين';
    question.textContent=english()?'What caught your eye first, the phone or the paper?':'عينك راحت أولًا للهاتف أو للورقة؟';
    images.forEach(({button,label},i)=>{
      button.textContent=english()?['Paper','Phone'][i]:['الورقة','الهاتف'][i];
      label.textContent=english()?['Paper fills the frame','Phone fills the frame'][i]:['الورقة تملأ الكادر','الهاتف يملأ الكادر'][i];
    });
  }
  function render(){
    updateWorkshop();
    document.querySelectorAll('[data-home-resume]').forEach(node=>{if(words[node.dataset.homeResume])node.textContent=text(node.dataset.homeResume);});
    if(caseCard){
      caseCard.hidden=!summary;
      if(summary){
        document.getElementById('rvnCaseResumeStatus').textContent=text(summary);
        document.getElementById('rvnCaseResumeLink').href='./deleted-name/play/'+(english()?'?lang=en':'');
      }
    }
    controls.forEach(({id,status,resume,start})=>{
      const progress=read(id);resume.hidden=!progress.available;
      if(galleryPage)start.hidden=!progress.available;
      resume.textContent=text('resume')+time(progress.seconds);start.textContent=text('start');
      const episode=english()?'Episode '+id:'الحلقة '+id;
      resume.setAttribute('aria-label',episode+' — '+resume.textContent);start.setAttribute('aria-label',episode+' — '+start.textContent);
      status.hidden=!progress.available&&progress.status!=='unavailable';
      status.textContent=progress.available?text('stored')+time(progress.seconds):progress.status==='unavailable'?text('unavailable'):'';
    });
    if(saveStatus){const progress=read(currentEpisode);saveStatus.hidden=progress.status!=='unavailable';saveStatus.textContent=progress.status==='unavailable'?text('unavailable'):'';}
  }
  async function checkSession(){
    if(!caseCard)return;
    summary=null;render();const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5000);
    try{
      const response=await fetch('/api/case/resume-summary',{method:'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal});
      if(!response.ok)return;
      const data=await response.json();
      if(data.schemaVersion!==1||data.caseId!=='deleted-name'||typeof data.contentVersion!=='string'||data.resumable!==true)return;
      const modes={'disk-file:confirmed':'confirmed','process-memory:memory':'memory','browser-checkpoint:browser-required':'browser'};
      summary=modes[data.persistence+':'+data.saveStatus]||null;
    }catch(_){/* No API or no confirmed session means no resume claim. */}
    finally{clearTimeout(timeout);render();}
  }
  document.addEventListener('raven:episode',event=>{currentEpisode=Number(event.detail.id)||1;render();renderLater();});
  document.addEventListener('raven:progress',render);
  document.addEventListener('raven:ended',event=>{currentEpisode=Number(event.detail.id)||currentEpisode;render();renderLater();});
  window.addEventListener('storage',event=>{
    if(event.key===null||event.key?.startsWith('raven17_episode_'))render();
    if(event.key===null||controls.some(({id})=>event.key===laterKey(id))){
      for(const {id} of controls)if(event.key===null||event.key===laterKey(id))laterFailed.delete(id);
      renderLater();
    }
  });
  window.addEventListener('pageshow',event=>{if(event.persisted){checkSession();renderLater();}});
  const retryButton=document.getElementById('rvnRetryVideo'),filmPlayer=document.getElementById('ravenEpisodePlayer');
  retryButton?.addEventListener('click',()=>{
    if(document.activeElement!==retryButton)return;
    // The existing retry handler hides its own focused control while loading.
    requestAnimationFrame(()=>{
      if(!document.getElementById('episodeModal')?.classList.contains('open'))return;
      if(document.activeElement!==retryButton&&document.activeElement!==document.body)return;
      (retryButton.getClientRects().length?retryButton:filmPlayer)?.focus({preventScroll:true});
    });
  },true);
  document.getElementById('rvnAfterBack')?.addEventListener('click',()=>{
    window.closeEpisodes?.();
    requestAnimationFrame(()=>{const target=document.querySelector('#films h2');if(target){target.tabIndex=-1;target.focus();}});
  });
  document.getElementById('rvnAfterBackstage')?.addEventListener('click',()=>{
    if(galleryPage){
      const home=new URL(ravenRoot);if(english())home.searchParams.set('lang','en');home.hash='studio';
      if(!window.ravenNavigate?.(home.href))location.assign(home.href);
      return;
    }
    window.closeEpisodes?.();
    requestAnimationFrame(()=>{const section=document.getElementById('studio'),heading=section?.querySelector('h2');section?.scrollIntoView({behavior:'auto',block:'start'});if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}});
  });
  window.RavenI18n?.subscribe?.(render);document.addEventListener('raven:language',render);
  document.addEventListener('raven:language',renderLater);
  renderLater();render();checkSession();
})();
