/* Homepage presentation only. Existing player owns episodes; no game/save state. */
(() => {
  'use strict';
  const words = {
    caseName:['الاسم المحذوف','The Deleted Name'],creativeStudio:['الاستوديو','Studio'],playAndMake:['العب واصنع','Play and create'],
    exploreNight:['الألعاب والمحاكاة','Games and simulations'],animeManga:['الأنمي والمانجا','Anime and manga'],
    lateNight:['آخر الليل','Late Night'],twoMinutes:['عندي دقيقتين','I have two minutes'],fullEvening:['أبي أمسية كاملة','Plan a full evening'],
    nightPitch:['سجّل مسارك في المحطّة أو اصنع مشهدًا عند الرصيف.','Record your route at the station or stage a scene on the pier.'],enterNight:['ادخل آخر الليل','Enter Late Night'],
    inkTitle:['ليالي الحبر','Ink Nights'],inkPitch:['ركّب مشهد أنمي أو اطبع صفحة مانغا من لقطات المرفأ.','Cut an anime scene or print a manga page from the harbour.'],enterInk:['ادخل ليالي الحبر','Enter Ink Nights'],
    workshops:['ورش وتجارب','Workshops and games'],behind:['خلف الكادر','Behind the frame'],notes:['ملاحظات الإنتاج','Production notes'],explore:['اختر تجربة','Choose an experience'],
    afterShow:['بعد العرض','After the Show'],
    afterShowPitch:['عندك ١٢ ثانية وثلاث لقطات. بأي لقطة تفتتح المشهد؟','You have twelve seconds and three shots. Which one opens your scene?'],
    afterShowPlay:['العب آخر إرسال','Play Last Transmission'],
    afterShowAll:['كل التجارب','All activities'],
    filmType:['سلسلة سينمائية · ثلاث حلقات','Original series · Three episodes'],
    episodeList:['تصفّح الحلقات','Browse episodes'],
    openPaperClip:['افتح مقطع «الورق والهاتف»','Open the Paper and phone clip'],
    artCaption:['تصور بصري، ليس دليلًا','Visual concept, not evidence'],
    scope:['الافتتاح متاح هنا. متابعة القضية الكاملة تعتمد على اتصال الخدمة، وتوضح شاشة المتابعة ما يمكن نقله.','The opening is available here. Continuing the full case depends on service availability; the continuation screen explains what can carry over.'],
    castReference:['وجوه وأماكن من عالم القضية','Faces and places from the case'],
    castContext:['هذا مرجع بصري؛ وجود البطاقة لا يعني حضور الشخصية في الافتتاح.','This is a visual reference; a character card does not imply presence in the opening.'],
    retry:['أعد تحميل الصورة','Retry image'],loading:['جارٍ تحميل الصورة…','Loading image…']
  };
  const language = () => document.documentElement.lang === 'en' ? 1 : 0;
  const text = key => words[key]?.[language()] || '';
  function translate() {
    document.querySelectorAll('[data-rvn-visual]').forEach(node => { if(words[node.dataset.rvnVisual]) node.textContent = text(node.dataset.rvnVisual); });
    document.querySelectorAll('[data-rvn-visual-label]').forEach(node => node.setAttribute('aria-label',text(node.dataset.rvnVisualLabel)));
    for (const link of document.querySelectorAll('[data-after-show-play],[data-after-show-hub]')) {
      const activity = link.hasAttribute('data-after-show-play') ? 'activity=edit&' : '';
      link.setAttribute('href', './after-show/?' + activity + 'lang=' + (language() ? 'en' : 'ar'));
    }
    document.querySelectorAll('[data-night-route]').forEach(link => {
      const target=new URL(link.dataset.nightRoute,location.href);
      target.searchParams.set('lang',language() ? 'en' : 'ar');
      link.setAttribute('href',target.pathname+target.search+target.hash);
    });
    document.querySelectorAll('[data-raven-route="./episodes/"]').forEach(link => {
      link.href = './episodes/?lang=' + (language() ? 'en' : 'ar');
    });
    document.querySelectorAll('.rvnVisualRetry').forEach(node => { node.textContent = text(node.dataset.retrying === 'true' ? 'loading' : 'retry'); });
  }
  document.querySelectorAll('[data-rvn-visual-image]').forEach(image => {
    const frame = image.parentElement;
    const retry = document.createElement('button');
    retry.type='button';retry.className='rvnVisualRetry';retry.hidden=true;
    frame.append(retry);
    let timer;
    function failed(){clearTimeout(timer);frame.classList.add('is-image-unavailable');retry.hidden=false;retry.dataset.retrying='false';retry.removeAttribute('aria-disabled');retry.textContent=text('retry');}
    image.addEventListener('error',failed);
    image.addEventListener('load',() => {
      if(!image.naturalWidth)return;
      clearTimeout(timer);frame.classList.remove('is-image-unavailable');
      if(document.activeElement === retry) document.getElementById('rvnEnterDeletedName')?.focus({preventScroll:true});
      retry.hidden=true;retry.dataset.retrying='false';
    });
    retry.addEventListener('click',() => {
      if(retry.dataset.retrying==='true')return;
      retry.dataset.retrying='true';retry.setAttribute('aria-disabled','true');retry.textContent=text('loading');
      const url=new URL(image.currentSrc || image.src,location.href);url.searchParams.set('visual-retry',String(Date.now()));image.src=url.href;
      timer=setTimeout(failed,20000);
    });
    if(image.complete && !image.naturalWidth)failed();
  });
  // Enhancement only: approved local artwork remains visible if a new atmosphere fails.
  const caseImage=document.querySelector('[data-rvn-visual-enhance="case-entry"]');
  const mobileCrop=window.matchMedia('(max-width:650px)').matches;
  if(caseImage){const enhanced=new Image();enhanced.onload=()=>{caseImage.src=enhanced.src;caseImage.width=enhanced.naturalWidth;caseImage.height=enhanced.naturalHeight;};enhanced.src='./assets/visual-20261119/case-entry'+(mobileCrop?'-mobile':'')+'.webp';}
  translate();
  window.RavenI18n?.subscribe?.(translate);
  document.addEventListener('raven:language',translate);
})();
