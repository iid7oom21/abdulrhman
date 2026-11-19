/* Homepage presentation only. Existing player owns episodes; no game/save state. */
(() => {
  'use strict';
  const words = {
    world:['من عالم RAVEN','From the world of RAVEN'],
    choose:['اختر كيف تدخل الحكاية.','Choose your way into the story.'],
    filmType:['للمشاهدة · ثلاث حلقات','Watch · Three episodes'],
    filmIntro:['خذ مقعدك. ابدأ من الحلقة الأولى، أو اختر حلقتك.','Take a seat. Start with episode one, or choose an episode.'],
    episodeList:['تصفح الحلقات الثلاث','Browse the three episodes'],
    caseType:['للّعب · قضية تفاعلية','Play · An interactive case'],
    caseTitle:['الاسم المحذوف','The Deleted Name'],
    caseDetails:['تعرّف إلى تجربة القضية','Explore the case experience'],
    episode1:['الحلقة الأولى','Episode one'],episode2:['الحلقة الثانية','Episode two'],episode3:['الحلقة الثالثة','Episode three'],
    watchEpisode:['شاهد الحلقة ←','Watch episode →'],
    episodesLabel:['حلقات RAVEN 17','RAVEN 17 episodes'],
    stills:['صور الحلقات من مواد الأفلام الأصلية.','Episode images are from the original film materials.'],
    artCaption:['تصور بصري، ليس دليلًا','Visual concept, not evidence'],
    startLine:['ابدأ من السطر.','Start with a line.'],
    caseHow:['افتح الورقة، اقرأ النصين، ثم اختر كيف ترد.','Open the paper, read both texts, then choose your reply.'],
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
    document.querySelectorAll('[data-visual-episode]').forEach(node => { node.href = './?episode=' + node.dataset.visualEpisode + (language() ? '&lang=en' : ''); });
    document.querySelectorAll('.rvnVisualRetry').forEach(node => { node.textContent = text(node.dataset.retrying === 'true' ? 'loading' : 'retry'); });
  }
  document.querySelectorAll('[data-visual-episode]').forEach(link => {
    link.addEventListener('click',event => {
      if(event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if(typeof window.openEpisodes === 'function') window.openEpisodes(event,Number(link.dataset.visualEpisode));
    });
  });
  document.querySelectorAll('[data-rvn-visual-image]').forEach(image => {
    const frame = image.parentElement;
    const retry = document.createElement('button');
    retry.type='button';retry.className='rvnVisualRetry';retry.hidden=true;
    // Keep retry independent of the episode link; nested interactive controls are invalid.
    const episode = frame.closest('.rvnVisualEpisode');
    if(episode){episode.style.position='relative';episode.append(retry);}else frame.append(retry);
    let timer;
    function failed(){clearTimeout(timer);frame.classList.add('is-image-unavailable');retry.hidden=false;retry.dataset.retrying='false';retry.removeAttribute('aria-disabled');retry.textContent=text('retry');}
    image.addEventListener('error',failed);
    image.addEventListener('load',() => {
      if(!image.naturalWidth)return;
      clearTimeout(timer);frame.classList.remove('is-image-unavailable');
      if(document.activeElement === retry) (episode?.querySelector('a') || document.getElementById('rvnEnterDeletedName'))?.focus({preventScroll:true});
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
  const atmosphere=new Image();
  atmosphere.onload=()=>{const hero=document.getElementById('top');hero.style.setProperty('--rvn-visual-atmosphere','url("'+atmosphere.src+'")');hero.classList.add('has-visual-atmosphere');};
  atmosphere.src='./assets/visual-20261119/cinema-atmosphere'+(mobileCrop?'-mobile':'')+'.webp';
  translate();
  window.RavenI18n?.subscribe?.(translate);
  document.addEventListener('raven:language',translate);
})();
