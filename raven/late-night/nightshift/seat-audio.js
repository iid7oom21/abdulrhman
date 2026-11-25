import {element as el,action} from '../night-shell.js';
import {passage} from './seat-script.js';

export function excerpt(ui,container) {
  const {t}=ui;
  const list=el('ol',null,'seat-cues');
  const marks=passage.map(row=>{
    const li=el('li'),time=el('time',row.start+'–'+row.end+' s');time.dir='ltr';
    li.append(time,el('span',t(...row.cue)));list.append(li);return li;
  });
  const audio=new Audio();
  audio.preload='none';
  const src=new URL('./art/seat-passage.ogg',import.meta.url).href;
  const label=t('اسمع أصوات المقتطف · ٨ ثوانٍ','Hear the excerpt · 8 seconds');
  const status=el('p',null,'seat-status');status.setAttribute('role','status');
  let closed=false,failed=false;
  const btn=action(label,async()=>{
    if(!audio.paused){audio.pause();return;}
    if(!audio.src || failed){audio.src=src;audio.load();failed=false;}
    if(audio.ended)audio.currentTime=0;
    try{await audio.play();}
    catch{if(!closed) showFailure();}
  });
  btn.dataset.excerpt='';
  function showFailure(){
    failed=true;btn.textContent=t('أعد تحميل المقتطف','Retry the excerpt');
    status.textContent=t('تعذّر تشغيل الصوت. نص المقتطف كاملًا أمامك.','The audio could not play. The full transcript is here.');
  }
  audio.onplay=()=>{
    btn.textContent=t('أوقف الصوت مؤقتًا','Pause the excerpt');status.textContent='';
  };
  audio.onpause=()=>{if(!failed)btn.textContent=label;};
  const clear=()=>marks.forEach(li=>li.removeAttribute('aria-current'));
  audio.onended=()=>{clear();btn.textContent=t('اسمع المقتطف مجددًا','Hear the excerpt again');};
  audio.ontimeupdate=()=>{clear();if(!audio.ended){const i=passage.findIndex(r=>audio.currentTime>=r.start && audio.currentTime<r.end);if(i>=0)marks[i].setAttribute('aria-current','time');}};
  audio.onerror=()=>{if(!closed)showFailure();};
  container.append(el('h4',t('نص المقتطف المأذون','Transcript of the approved excerpt')),list,btn,status);
  return ()=>{closed=true;audio.onplay=audio.onpause=audio.ontimeupdate=audio.onended=audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load();};
}
