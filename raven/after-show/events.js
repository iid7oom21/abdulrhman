import {SHOTS, duration} from './edit-rules.js';
import {setup, budgetRounds, budgetResult, continuityRounds, changedProp, furniture, sounds,
  restoreFestival, activeShot, shareSource} from './event-rules.js';

function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function button(key, text, action, primary = false) {
  const result = node('button', primary ? 'evt-button evt-primary' : 'evt-button', text);
  result.type = 'button';
  result.dataset.event = key;
  result.addEventListener('click',action);
  return result;
}

function redraw(root, content) {
  const focused = root.contains(document.activeElement) ? document.activeElement.dataset.event : null;
  root.replaceChildren(content);
  if (focused) Array.from(root.querySelectorAll('[data-event]')).find(el => el.dataset.event === focused)?.focus({preventScroll:true});
}

function actions(...elements) {
  const group = node('div','evt-actions');
  group.append(...elements);
  return group;
}

function stage(title, prompt) {
  const area = node('section','evt-panel');
  area.append(node('h1','evt-heading',title),node('p','evt-prompt',prompt));
  return area;
}

function choice(key, name, on, callback) {
  const item = button(key,name,callback);
  item.setAttribute('aria-pressed',String(on));
  return item;
}

function feedback(text) {
  const item = node('p','evt-feedback',text);
  item.setAttribute('role','status');
  return item;
}

function range(id,label,value,min,max,onChange,step=1) {
  const wrap=node('label','evt-range');
  const text=node('span','',label);
  const control=node('input');
  const output=node('output');
  control.type='range'; control.dataset.event=id; control.min=String(min); control.max=String(max);
  control.step=String(step); control.value=String(value); output.value=String(value);
  control.addEventListener('input',() => {
    output.value=control.value; onChange(control.valueAsNumber);
  });
  wrap.append(text,control,output);
  return wrap;
}

const propText = {
  cup:['الفنجان','Cup'],folder:['الدفتر','Notebook'],light:['الضوء','Light'],
};
const propDetails = {
  cup:[['الفنجان عند يسار الطاولة','Cup on the left'],['الفنجان عند يمين الطاولة','Cup on the right']],
  folder:[['الدفتر موازي لحافة الطاولة','Notebook parallel to the table edge'],['الدفتر مائل عن حافة الطاولة','Notebook angled away from the table edge']],
  light:[['الإضاءة من اليسار','Light from the left'],['الإضاءة من اليمين','Light from the right']],
};

function continuity(ui) {
  const {t,root} = ui;
  const old = ui.load('continuity',null) || {};
  let roundIndex = Number.isInteger(old.roundIndex) && continuityRounds[old.roundIndex] ? old.roundIndex : 0;
  let mode = ['pair','switch','text'].includes(old.mode) ? old.mode : 'pair';
  let frame = old.frame === 'B' ? 'B' : 'A';
  let pick = furniture.includes(old.pick) ? old.pick : null;
  let submitted = !!pick && old.submitted === true;

  function update() {
    ui.save('continuity',{roundIndex,mode,frame,pick,submitted});
    render();
  }

  function render() {
    const round = continuityRounds[roundIndex];
    const n = roundIndex+1;
    const area = stage(t('عين الاستمرارية','Continuity eye'),t('قارن اللقطتين وحدّد ما تغيّر بينهما.','Compare the two takes and identify what moved.'));
    const modes = actions();
    for (const [key,ar,en] of [['pair','جنبًا إلى جنب','Side by side'],['switch','بدّل اللقطة','Switch takes'],['text','وصف اللقطتين','Describe both takes']]) {
      modes.append(choice(key,t(ar,en),mode===key,() => {mode=key;update();}));
    }
    area.append(modes);
    const takes = node('div',mode==='switch'?'evt-takes':'evt-takes evt-pair');
    for (const id of ['A','B']) {
      if (mode==='switch' && id!==frame) continue;
      const config=id==='A'?round.a:round.b;
      const fig=node('figure','evt-take');
      const title=t('لقطة ','Take ')+id;
      fig.append(node('figcaption','',title));
      if (mode==='text') {
        const list=node('ul','evt-observations');
        furniture.forEach(key=>list.append(node('li','',t(...propDetails[key][config[key]]))));
        fig.append(list);
      } else {
        const set=node('div','evt-set');
        set.setAttribute('role','img');
        set.setAttribute('aria-label',title+' — '+furniture.map(key=>t(...propDetails[key][config[key]])).join(' · '));
        set.dataset.cup=config.cup;set.dataset.folder=config.folder;set.dataset.light=config.light;
        set.append(node('span','evt-cover'),node('span','evt-cup'),node('span','evt-beam'));
        fig.append(set);
      }
      takes.append(fig);
    }
    area.append(takes);
    if (mode==='switch') area.append(button('swap-frame',t('عرض اللقطة ','Show take ')+(frame==='A'?'B':'A'),()=>{frame=frame==='A'?'B':'A';update();}));
    const answers=actions();
    for(const key of furniture) answers.append(choice('pick-'+key,t(...propText[key]),pick===key,()=>{pick=key;submitted=false;update();}));
    const check=button('judge',t('تحقّق من ملاحظتي','Check my observation'),()=>{submitted=true;update();},true);
    check.disabled=!pick;
    area.append(node('p','evt-caption',t('المشهد ','Set ')+n+' / '+continuityRounds.length),answers,check);
    if(submitted) {
      const correct=changedProp(round);
      if(pick===correct) {
        area.append(feedback(t(...propDetails[correct][round.a[correct]])+' · '+t(...propDetails[correct][round.b[correct]])));
        area.append(actions(button('next',n===continuityRounds.length?t('العب من جديد','Play again'):t('المشهد التالي','Next set'),()=>{
          roundIndex=n%continuityRounds.length;pick=null;submitted=false;frame='A';update();
        }),button('to-budget',t('جرّب ميزانية اللقطة','Try shot budget'),()=>ui.go('budget'))));
      } else area.append(feedback(t(...propText[pick])+t(' بقي في الوضع نفسه. راجع اللقطتين.',' stayed the same. Compare the takes again.')));
    }
    redraw(root,area);
  }
  render();
}

const costsText = {
  boom:['ميكروفون على حامل','Boom microphone'],lav:['ميكروفون صدري','Lavalier microphone'],
  room:['لقطة متحركة للموقع','Moving location shot'],wide:['لقطة واسعة ثابتة','Static wide shot'],
  detail:['عدسة للتفاصيل','Detail lens'],bounce:['عاكس إضاءة','Light reflector'],
};
const needsText = {speech:['كلام واضح','Clear speech'],place:['تعريف المكان','Establish the location'],detail:['تفصيل مقرّب','A close detail'],light:['ضوء مرتدّ','Reflected light']};

function budget(ui) {
  const {root,t}=ui;
  const draft=ui.load('budget',null)||{};
  let picks=Array.isArray(draft.picks)?Object.keys(setup).filter(k=>draft.picks.includes(k)):[];
  let index=draft.index===1?1:0;
  let submitted=draft.submitted===true;
  const update=()=>{ui.save('budget',{picks,index,submitted});render();};
  function render() {
    const goals=budgetRounds[index],result=budgetResult(picks,goals);
    const area=stage(t('ميزانية اللقطة','Shot budget'),t('معك ١٠ وحدات إنتاج. اختر المعدات التي تحقّق طلب العرض.','Spend up to 10 production units to deliver the brief.'));
    area.append(node('p','evt-needs',goals.map(k=>t(...needsText[k])).join(' + ')));
    const stock=node('div','evt-stock');
    for(const [id,item] of Object.entries(setup)) {
      const selected=picks.includes(id);
      const row=choice('buy-'+id,'',selected,()=>{picks=selected?picks.filter(k=>k!==id):[...picks,id];submitted=false;update();});
      row.append(node('strong','',t(...costsText[id])),node('span','evt-caption',item.provides.map(k=>t(...needsText[k])).join(' + ')),node('span','evt-cost',String(item.cost)));
      stock.append(row);
    }
    const receipt=node('div','evt-receipt');
    receipt.append(node('span','',t('أمر الإنتاج','Production order')),node('strong','',result.spent+' / 10'));
    area.append(stock,receipt,button('review-budget',t('راجع أمر الإنتاج','Review order'),()=>{submitted=true;update();},true));
    if(submitted) {
      const notes=[];
      if(result.spent>10) notes.push(t('تجاوزت الميزانية بمقدار ','Over budget by ')+(result.spent-10));
      if(result.missing.length) notes.push(t('المطلوب المتبقي: ','Still needed: ')+result.missing.map(k=>t(...needsText[k])).join(' / '));
      if(result.valid) notes.push(t('أمر الإنتاج جاهز. المتبقي ','Order ready. Remaining units: ')+(10-result.spent));
      area.append(feedback(notes.join(' · ')));
      const retry=button('rebudget',t('أعد توزيع الميزانية','Reallocate'),()=>{picks=[];submitted=false;update();});
      area.append(actions(retry,button('budget-next',t('التكليف الآخر','Other brief'),()=>{index=1-index;picks=[];submitted=false;update();}),button('to-festival',t('ادخل ليلة العرض','Enter screening night'),()=>ui.go('festival'))));
    }
    redraw(root,area);
  }
  render();
}

const cueLabels={paper:['تقليب ورقة','Paper turn'],chair:['جر كرسي','Chair slide'],key:['طَقّة مفتاح','Key click']};
const chapters=[['المونتاج','The cut'],['الضوء','The light'],['الصوت','The cue'],['العرض','The screening']];
const cueDuration={paper:.36,chair:.6,key:.22};

function setLook(surface,angle,exposure) {
  surface.style.setProperty('--evt-exposure',String(Math.pow(2,exposure/90)));
  surface.style.setProperty('--evt-light',String(90+angle*.9)+'deg');
}

function sceneFrame(lang,id) {
  const frame=node('div','evt-frame');
  const image=node('img');
  const caption=node('span','evt-shot-name');
  const retry=button('retry-shot',lang==='ar'?'أعد تحميل اللقطة':'Retry shot',()=>show(frame.dataset.shot));
  retry.classList.add('evt-shot-retry');retry.hidden=true;
  function show(shotId) {
    const shot=SHOTS[shotId];
    frame.dataset.shot=shotId;retry.hidden=true;
    caption.textContent=shot.name[lang];
    image.alt=shot.description[lang];
    image.hidden=false;
    image.src=new URL(shot.image,import.meta.url).href;
  }
  image.addEventListener('error',()=>{image.hidden=true;caption.textContent=SHOTS[frame.dataset.shot].description[lang];retry.hidden=false;});
  frame.append(image,node('div','evt-light-layer'),caption,retry);
  show(id);
  return {frame,show};
}

function festival(ui) {
  const {root,t,lang}=ui;
  const state=restoreFestival(ui.load('festival',null));
  const save=()=>ui.save('festival',state);
  let stopView=()=>{};
  ui.onCleanup(()=>stopView());
  function changeChapter(target) {
    stopView(); stopView=()=>{};
    state.stage=target; save(); render();
    const heading=root.querySelector('.evt-heading');
    if(heading) {heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
  function invalidate() {
    state.finished=false;state.head=0;
  }
  function render() {
    const total=duration(state.shots);
    const prompts=[
      t('اختر ثلاث لقطات بالترتيب الذي تريده.','Pick three different shots in the order you want to screen them.'),
      t('حرّك الضوء واضبط تعريض النسخة.','Move the key light and set the exposure for your cut.'),
      t('اختر مؤثرًا وحدّد لحظة دخوله في العرض.','Choose a foley cue and place it on your cut.'),
      t('شاهد نسختك بالضوء والقطع وتوقيت المؤثر الذي اخترته.','Screen your cut with your lighting and timed cue.'),
    ];
    const area=stage(t('ليلة العرض','Screening night'),prompts[state.stage]);
    const nav=node('ol','evt-chapters');
    chapters.forEach(([ar,en],i)=>{
      const li=node('li','',t(ar,en));
      if(i===state.stage) li.setAttribute('aria-current','step');
      else if(i<state.stage) li.className='evt-done';
      nav.append(li);
    });
    area.insertBefore(nav,area.children[1]);
    if(state.stage===0) {
      const library=node('div','evt-stock evt-library');
      for(const [id,shot] of Object.entries(SHOTS)) {
        const pos=state.shots.indexOf(id);
        const pick=choice('shot-'+id,'',pos!==-1,()=>{
          state.shots=pos>=0?state.shots.filter(x=>x!==id):[...state.shots,id];
          invalidate();if(state.shots.length) state.at=Math.min(state.at,duration(state.shots)-.1);save();render();
        });
        pick.disabled=pos<0&&state.shots.length===3;
        const pic=node('img');pic.alt='';pic.loading='lazy';pic.src=new URL(shot.image,import.meta.url).href;
        pic.addEventListener('error',()=>{pic.hidden=true;});
        pick.append(pic,node('strong','',shot.name[lang]),node('span','evt-caption',shot.seconds+t(' ث',' s')));
        if(pos>=0) pick.append(node('span','evt-order',String(pos+1)));
        library.append(pick);
      }
      area.append(library,node('p','evt-cut-list',state.shots.map(id=>SHOTS[id].name[lang]).join(' / ') || t('شريطك فارغ','Your reel is empty')));
      const next=button('cut-next',t('انتقل إلى الإضاءة','Set the lighting'),()=>changeChapter(1),true);
      next.disabled=state.shots.length!==3;
      area.append(next);
    } else if(state.stage===1) {
      const {frame}=sceneFrame(lang,state.shots[0]);
      setLook(frame,state.angle,state.exposure);
      function light(prop,value) {state[prop]=value;invalidate();setLook(frame,state.angle,state.exposure);save();}
      area.append(frame,
        range('festival-angle',t('اتجاه الضوء','Light direction'),state.angle,-100,100,v=>light('angle',v)),
        range('festival-exposure',t('التعريض','Exposure'),state.exposure,-60,60,v=>light('exposure',v)),
        actions(button('back-cut',t('راجع المونتاج','Review cut'),()=>changeChapter(0)),button('light-next',t('حدّد المؤثر الصوتي','Place a cue'),()=>changeChapter(2),true)));
    } else if(state.stage===2) {
      const soundsList=actions();
      for (const id of sounds) soundsList.append(choice('cue-'+id,t(...cueLabels[id]),state.cue===id,()=>{state.cue=id;invalidate();save();render();}));
      const strip=node('div','evt-strip');
      const marker=node('span','evt-marker','▾');
      for(const id of state.shots) {
        const block=node('span','',SHOTS[id].name[lang]);block.style.flexGrow=String(SHOTS[id].seconds);
        strip.append(block);
      }
      strip.append(marker); marker.style.left=(state.at/total*100)+'%';
      area.append(soundsList,strip,
        range('festival-time',t('دخول المؤثر بالثواني','Cue start in seconds'),state.at,0,Math.max(0,total-.1),v=>{
          state.at=v;invalidate();marker.style.left=(v/total*100)+'%';save();
        },.1),
        actions(button('back-light',t('راجع الإضاءة','Review light'),()=>changeChapter(1)),button('cue-next',t('افتح غرفة العرض','Open the screening'),()=>changeChapter(3),true)));
    } else {
      screen(area,total);
    }
    redraw(root,area);
  }

  function screen(area,total) {
    let playing=false, epoch=0, startHead=0, timer=0, cueFired=false;
    const {frame,show}=sceneFrame(lang,activeShot(state.shots,state.head));
    setLook(frame,state.angle,state.exposure);
    const subtitle=node('span','evt-cue-caption',t(...cueLabels[state.cue]));
    frame.append(subtitle);
    const media=node('audio');
    media.preload='none'; media.muted=state.muted;
    const timed=node('span','evt-time');
    const cursor=node('progress','evt-progress');cursor.max=total;cursor.value=state.head;cursor.setAttribute('aria-label',t('موضع العرض','Screening progress'));
    const note=node('p','evt-caption');
    note.setAttribute('role','status');
    const play=button('festival-play','',toggle,true);
    const mute=button('festival-sound','',()=>{
      state.muted=!state.muted;media.muted=state.muted;
      if(state.muted) media.pause();
      refresh();save();
    });
    const card=button('festival-card',t('عاين بطاقة نسختي','Preview my screening card'),()=>{
      ui.save('shareCut',{source:'festival',shots:[...state.shots],seconds:total,angle:state.angle,exposure:state.exposure});
      ui.go('card');
    });
    const retryAudio=button('retry-cue',t('أعد تحميل المؤثر','Retry cue audio'),()=>{
      media.preload='auto';media.load();
    });
    retryAudio.hidden=true;
    media.addEventListener('error',()=>{
      retryAudio.hidden=false;
      note.textContent=t('تعذّر تشغيل الصوت. يبقى توقيته ظاهرًا في الصورة.','Cue audio is unavailable. Its timing is shown on screen.');
    });
    media.addEventListener('loadeddata',()=>{
      if(!retryAudio.hidden) note.textContent=t('المؤثر جاهز للعرض.','Cue audio is ready.');
      retryAudio.hidden=true;
    });
    function refresh() {
      const id=activeShot(state.shots,state.head);
      if(id!==frame.dataset.shot) show(id);
      subtitle.hidden=!(state.head>=state.at && state.head<state.at+Math.max(1,cueDuration[state.cue]));
      timed.textContent=state.head.toFixed(1)+' / '+total+t(' ث',' s');
      cursor.value=state.head;
      mute.textContent=state.muted?t('تشغيل صوت المؤثر','Enable cue audio'):t('كتم المؤثر','Mute cue');
      mute.setAttribute('aria-pressed',String(!state.muted));
      play.textContent=playing?t('أوقف مؤقتًا','Pause'):state.head>=total?t('أعد العرض','Replay'):t('اعرض نسختي','Screen my cut');
      card.disabled=!state.finished;
    }
    function fireCue(offset) {
      if(state.muted || offset>=cueDuration[state.cue]) return;
      if(!media.hasAttribute('src')) media.src=new URL('./assets/foley-'+state.cue+'.wav',import.meta.url).href;
      try {
        media.currentTime=Math.max(0,offset);
        media.play().catch(()=>{note.textContent=t('تعذّر تشغيل الصوت. يبقى توقيته ظاهرًا في الصورة.','Cue audio is unavailable. Its timing is shown on screen.');});
      } catch {note.textContent=t('تعذّر تشغيل الصوت.','Audio unavailable.');}
    }
    function step() {
      state.head=Math.min(total,startHead+(performance.now()-epoch)/1000);
      if(!cueFired&&state.head>=state.at) {cueFired=true;fireCue(state.head-state.at);}
      if(state.head>=total) {
        playing=false;state.finished=true;save();
        note.textContent=t('اكتمل عرض نسختك. تقدر الآن تفتح بطاقتها.','Screening complete. Your cut card is ready.');
      }
      refresh();
      if(playing) timer=requestAnimationFrame(step);
    }
    function pause() {
      if(!playing) return;
      state.head=Math.min(total,startHead+(performance.now()-epoch)/1000);
      playing=false;cancelAnimationFrame(timer);media.pause();save();refresh();
    }
    function toggle() {
      if(playing) {pause();return;}
      if(state.head>=total) state.head=0;
      startHead=state.head;epoch=performance.now();playing=true;cueFired=false;
      step();
    }
    function hide(){if(document.hidden)pause();}
    document.addEventListener('visibilitychange',hide);
    window.addEventListener('pagehide',pause);
    stopView=()=>{pause();cancelAnimationFrame(timer);media.pause();document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',pause);};
    refresh();
    const cueSummary=node('p','evt-caption',t(...cueLabels[state.cue])+' · '+state.at.toFixed(1)+t(' ث',' s'));
    area.append(frame,media,cursor,timed,cueSummary,actions(play,mute,retryAudio),note,
      actions(card,button('back-cue',t('عدّل المؤثر','Edit cue'),()=>changeChapter(2)),button('new-night',t('ابدأ ليلة جديدة','Start a new screening'),()=>{
        stopView();stopView=()=>{};Object.assign(state,restoreFestival(null));save();render();
      }),button('to-continuity',t('جرّب عين الاستمرارية','Try continuity eye'),()=>ui.go('continuity'))));
  }
  render();
}

function cardMaker(ui) {
  const {root,t,lang}=ui;
  const cut=shareSource(ui.load('shareCut',null));
  if(!cut) {
    const empty=stage(t('بطاقة العرض','Screening card'),t('بعد مشاهدة نسختك، اختر بطاقة المشاركة من شاشة النتيجة.','Finish screening a cut, then open its card from your result.'));
    empty.append(button('make-cut',t('ابدأ آخر إرسال','Play Last Transmission'),()=>ui.go('edit'),true));redraw(root,empty);return;
  }
  const activity=cut.source==='festival'?t('ليلة العرض','Screening night'):t('آخر إرسال','Last Transmission');
  const area=stage(t('بطاقة العرض','Screening card'),t('اختر لقطة من نسختك لتظهر على البطاقة العمودية.','Pick a shot from your cut for the vertical card.'));
  const canvas=node('canvas','evt-poster');canvas.width=720;canvas.height=1280;
  const choices=actions();
  const msg=feedback('');
  const download=button('download-png',t('نزّل البطاقة PNG','Download PNG card'),()=>{
    canvas.toBlob(blob=>{
      if(!blob) {msg.textContent=t('تعذّر إنشاء الصورة. جرّب مرة أخرى.','Could not create the image. Try again.');return;}
      const link=node('a'); const href=URL.createObjectURL(blob);
      link.href=href;link.download='raven-'+cut.source+'-card.png';document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(href),3000);
    },'image/png');
  },true);
  let request=0;
  ui.onCleanup(()=>{request++;});
  const ids=[...new Set(cut.shots)];
  const label=id=>SHOTS[id].name[lang];
  const frameFallback=t('بطاقة وصف اللقطة','Shot description slate');
  async function paint(id) {
    const token=++request;
    download.disabled=true;msg.textContent='';
    Array.from(choices.children).forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.event==='poster-'+id)));
    const image=new Image();image.src=new URL(SHOTS[id].image,import.meta.url).href;
    let picture=true;
    try {await image.decode();} catch {picture=false;}
    try {await document.fonts.load('32px RavenArabic',label(id));} catch { /* platform Arabic fallback */ }
    if(request!==token) return;
    const ctx=canvas.getContext('2d');
    if(!ctx) {msg.textContent=t('التصميم يحتاج رسم الصور في المتصفح.','This card requires canvas support.');return;}
    ctx.fillStyle='#192724';ctx.fillRect(0,0,720,1280);
    const x=36,y=122,w=648,h=646;
    if(picture) {
      const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);
      ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
      ctx.filter='brightness('+Math.pow(2,cut.exposure/90)+')';
      ctx.drawImage(image,x+(w-image.naturalWidth*scale)/2,y+(h-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);
      ctx.restore();
      if(cut.source==='festival') {
        const tilt=cut.angle/100*Math.PI/2;
        const dx=Math.cos(tilt)*w/2,dy=Math.sin(tilt)*h/2;
        const shade=ctx.createLinearGradient(x+w/2-dx,y+h/2-dy,x+w/2+dx,y+h/2+dy);
        shade.addColorStop(0,'rgba(14,23,27,0.38)');shade.addColorStop(1,'rgba(255,223,169,0.12)');
        ctx.fillStyle=shade;ctx.fillRect(x,y,w,h);
      }
    } else {ctx.fillStyle='#465851';ctx.fillRect(x,y,w,h);}
    const arabic=lang==='ar';const edge=arabic?672:48;
    function type(s,baseline,size,color,bold=false) {
      ctx.direction=arabic?'rtl':'ltr';ctx.textAlign=arabic?'right':'left';
      ctx.fillStyle=color;ctx.font=(bold?'bold ':'')+size+'px RavenArabic, sans-serif';ctx.fillText(s,edge,baseline,624);
    }
    ctx.direction='ltr';ctx.textAlign='left';ctx.font='32px Georgia, serif';ctx.fillStyle='#e9d4a8';ctx.fillText('R A V E N',36,77);
    ctx.fillStyle='#eee7d5';ctx.fillRect(36,768,648,463);
    if(!picture) type(frameFallback,450,30,'#fffaf0');
    type(activity,837,32,'#52645b');type(label(id),920,64,'#152c26',true);
    type(t('نسخة من مونتاجي','My screening cut')+'  ·  '+cut.seconds+t(' ثانية',' seconds'),994,31,'#264b3f');
    cut.shots.forEach((shot,i)=>type((i+1)+'  /  '+label(shot),1060+i*40,26,'#35483f'));
    canvas.setAttribute('aria-label',[activity,label(id),cut.shots.map(label).join(' / '),cut.seconds+t(' ثانية',' seconds')].join(' · '));
    canvas.setAttribute('role','img');download.disabled=false;
    if(!picture) msg.textContent=t('تعذّر تحميل الصورة. تستخدم البطاقة وصف اللقطة.','Image unavailable. The card uses the shot’s text slate.');
  }
  ids.forEach(id=>choices.append(choice('poster-'+id,label(id),false,()=>paint(id))));
  area.append(choices,canvas,msg,actions(download,button('card-back',t('ارجع للتجربة','Return to activity'),()=>ui.go(cut.source==='festival'?'festival':'edit'))));
  redraw(root,area);paint(cut.shots[0]);
}

export default function mount(ui) {
  if(ui.route==='continuity') return continuity(ui);
  if(ui.route==='budget') return budget(ui);
  if(ui.route==='festival') return festival(ui);
  if(ui.route==='card') return cardMaker(ui);
}
