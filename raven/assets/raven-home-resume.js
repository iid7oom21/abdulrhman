/* Read-only case availability + existing film progress. No story data or new sessions. */
(() => {
  'use strict';
  const english=()=>document.documentElement.lang==='en';
  const words={
    caseKicker:['جلسة قضية متاحة','A case session is available'],caseTitle:['ارجع للقضية','Return to the case'],caseAction:['ارجع للقضية','Return to the case'],
    confirmed:['الجلسة متاحة للمتابعة.','Your session is available to continue.'],
    memory:['الجلسة الحالية متاحة؛ الحفظ الدائم غير مؤكّد.','The current session is available; lasting storage is not confirmed.'],
    browser:['ستتحقق شاشة اللعب من نسخة هذا المتصفح قبل المتابعة.','The play screen will check this browser’s copy before continuing.'],
    resume:['أكمل من ','Continue from '],start:['ابدأ من أول','Start from the beginning'],
    stored:['آخر موضع محفوظ على هذا الجهاز: ','Last position stored on this device: '],
    unavailable:['تعذر تأكيد حفظ موضع المشاهدة على هذا الجهاز.','The viewing position could not be confirmed as saved on this device.'],
    backstage:['خلف الكادر','Behind the Frame'],back:['العودة للحلقات','Back to episodes']
  };
  const text=key=>words[key][english()?1:0];
  const time=seconds=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
  const caseCard=document.getElementById('rvnCaseResume');
  const saveStatus=document.getElementById('rvnFilmSaveStatus');
  const controls=[];let summary=null,currentEpisode=1;
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
    group.append(status,resume,start);card.append(group);controls.push({id,status,resume,start});
  });
  function render(){
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
      resume.textContent=text('resume')+time(progress.seconds);start.textContent=text('start');
      const episode=english()?'Episode '+id:'الحلقة '+id;
      resume.setAttribute('aria-label',episode+' — '+resume.textContent);start.setAttribute('aria-label',episode+' — '+start.textContent);
      status.hidden=!progress.available&&progress.status!=='unavailable';
      status.textContent=progress.available?text('stored')+time(progress.seconds):progress.status==='unavailable'?text('unavailable'):'';
    });
    if(saveStatus){const progress=read(currentEpisode);saveStatus.hidden=progress.status!=='unavailable';saveStatus.textContent=progress.status==='unavailable'?text('unavailable'):'';}
  }
  async function checkSession(){
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
  document.addEventListener('raven:episode',event=>{currentEpisode=Number(event.detail.id)||1;render();});
  document.addEventListener('raven:progress',render);
  document.addEventListener('raven:ended',render);
  window.addEventListener('storage',event=>{if(event.key===null||event.key?.startsWith('raven17_episode_'))render();});
  window.addEventListener('pageshow',event=>{if(event.persisted)checkSession();});
  document.getElementById('rvnAfterBack')?.addEventListener('click',()=>window.closeEpisodes?.());
  document.getElementById('rvnAfterBackstage')?.addEventListener('click',()=>{
    window.closeEpisodes?.();
    requestAnimationFrame(()=>{const section=document.getElementById('studio'),heading=section?.querySelector('h2');section?.scrollIntoView({behavior:'auto',block:'start'});if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}});
  });
  window.RavenI18n?.subscribe?.(render);document.addEventListener('raven:language',render);
  render();checkSession();
})();
