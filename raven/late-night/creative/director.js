import {mount} from '../night-shell.js';
import {el,button,field,select,range,words,row,output,surface,stage,clock,choose,link} from './kit.js';
import {places,lights,motions,matchCatalog,buildScene,retime,describe,validScene,paintScene,sceneThumbnails,retrySceneImages} from './scene.js';

const example=['انتظار عند رصيف بعد انطفاء اللوحة','Waiting on a pier after the sign goes dark'];
let scene=null,prompt='',languageOfPrompt='',feeding=false,wantsPlace=false,lastPlace='pier',time=0,timer,saved;
mount({id:'director-sentence',title:['مخرج من جملة','One-sentence director'],intro:['اكتب فكرة قصيرة. يرتّبها قالب محلي من ديكورات الساحل وحركات الكاميرا.','Write a short idea. A local template stages it with coastal sets and camera moves.'],render(ui){
  const {t,lang}=ui;timer?.stop();
  if(!feeding){feeding=true;if(validScene(ui.editData)){scene=structuredClone(ui.editData);prompt=scene.prompt;lastPlace=scene.setting;}else{languageOfPrompt=lang;prompt=t(...example);}}
  else if(languageOfPrompt&&languageOfPrompt!==lang&&prompt===example[languageOfPrompt==='ar'?0:1]){
    prompt=t(...example);languageOfPrompt=lang;
  }
  const desk=surface(ui),body=el('section',null,'cr-desk'),choice=el('div',null,'cr-paper'),status=output();
  if(new URL(location.href).searchParams.has('piece')&&!validScene(ui.editData))status.textContent=t('تعذّرت قراءة إعدادات المشهد المحفوظ. اكتب فكرة جديدة أو جرّب المثال.','This saved scene has unsupported settings. Write another idea or use the example.');
  const idea=words('prompt',prompt,t(...example),160,v=>{prompt=v;languageOfPrompt='';wantsPlace=false;choice.hidden=true;status.textContent='';if(scene){timer?.stop();body.hidden=scene.prompt!==prompt;}});
  const generate=button('generate',t('حوّلها إلى مشهد','Build my scene'),()=>{
    if(!prompt.trim()){status.textContent=t('أضف جملة قصيرة أولًا.','Write a short sentence first.');idea.focus();return;}
    const match=matchCatalog(prompt);
    if(!match.ready){lastPlace=match.setting||'pier';wantsPlace=true;renderChoice();status.textContent='';return;}
    compose(match.setting);
  });
  desk.append(field(t('فكرة المشهد','Scene idea'),idea),row(generate),choice,body,status);
  function retryControl(canvas,s,frame){
    const retry=button('retry-image',t('أعد تحميل صورة المشهد','Retry scene photography'),()=>{
      retrySceneImages(s.setting);paintScene(canvas,s,frame());
    });
    const update=()=>{retry.hidden=canvas.dataset.visual!=='movement-plan';};
    canvas.addEventListener('visualchange',update);update();
    return retry;
  }
  if(!scene){
    const preview=stage(t('الرصيف من كتالوج مواقع التصوير','Pier from the set library')),sample=buildScene(example[0],'pier');
    body.append(preview,el('p',t('من مكتبة التصوير المحلية · الرصيف','Local set library · Pier'),'cr-caption'),retryControl(preview,sample,()=>1));
    paintScene(preview,sample,1);
  }
  function renderChoice(){
    choice.hidden=!wantsPlace;body.hidden=wantsPlace||Boolean(scene&&scene.prompt!==prompt);if(!wantsPlace)return;timer?.stop();
    const set=select('substitute',Object.entries(places).map(([id,n])=>[id,t(...n)]),lastPlace,v=>{lastPlace=v;});
    const missing=matchCatalog(prompt).unknown;
    const detail=missing.length?t('لم أجد في وصف المكتبة «','The set library does not recognise “')+missing.join('، ')+t('».','”.'):t('اختر مكانًا واحدًا لتصوير هذه اللقطة.','Choose one place to film this shot.');
    choice.replaceChildren(el('p',detail+' '+t('اختر ديكورًا بديلًا؛ تظهر فيه شخصية ولوحة ومصباح.','Choose a stand-in set with a figure, sign and lamp.')),field(t('الديكور البديل','Replacement set'),set),button('accept-set',t('ركّب البديل','Use this set'),()=>compose(lastPlace)));
  }
  function compose(id){
    const next=buildScene(prompt,id);
    if(!validScene(next)){status.textContent=t('تعذّر تركيب هذه الإعدادات. اختر ديكورًا من المكتبة واكتب جملة قصيرة.','These settings cannot be staged. Pick a library set and enter a short sentence.');return;}
    timer?.stop();scene=next;time=0;wantsPlace=false;saved=null;lastPlace=id;renderChoice();renderScene();
    status.textContent=t('المشهد جاهز للمراجعة.','The scene is ready to review.');
  }
  function renderScene(){
    if(!validScene(scene))return;body.hidden=wantsPlace||scene.prompt!==prompt;body.replaceChildren();
    const s=scene,can=stage(t(...places[s.setting])),caption=el('p',null,'cr-caption'),read=el('output',null,'cr-meter');
    const scrub=range('seek',time,0,s.duration,.1,v=>timer.seek(v));
    const run=button('play',t('شغّل فكرتي','Play my idea'),()=>{if(validScene(scene))timer.play();});
    body.append(can,caption,retryControl(can,s,()=>time),row(run,read),field(t('ثانية المشهد','Scene second'),scrub));
    timer=clock(()=>s.duration,(sec,on)=>{
      time=sec;scrub.value=sec;read.value=sec.toFixed(1)+' / '+s.duration+t(' ث',' s');
      const shot=paintScene(can,s,sec)||s.shots.findLast(shot=>sec>=shot.start),i=s.shots.indexOf(shot);caption.textContent=(i+1)+' / 3 · '+choose(t,describe(s,i))+' · '+t(...lights[shot.lighting])+' · '+t(...motions[shot.motion]);
      run.textContent=on?t('جمّد المشهد','Freeze scene'):sec>=s.duration?t('أعد مشاهدة فكرتي','Replay my scene'):t('شغّل فكرتي','Play my idea');
      can.dataset.shot=shot.id;can.dataset.seconds=sec.toFixed(1);
    },()=>{
      if(can.dataset.visual!=='photograph'){status.textContent=t('اكتمل مخطط الحركة. أعد تحميل الصورة لعرض المشهد وحفظه.','The movement plan has finished. Retry the artwork to screen and save the film.');return;}
      ui.recordEvent({ar:'وصل عرض مشهد '+places[s.setting][0]+' إلى اللقطة الأخيرة بعد '+s.duration+' ثوانٍ.',en:'The '+places[s.setting][1].toLowerCase()+' scene reached its last shot at '+s.duration+' seconds.',data:{kind:'night-scene-screening',setting:s.setting,seconds:s.duration,blackout:s.blackout}});
      status.textContent=t('اكتمل العرض. غيّر لحظة انطفاء اللوحة لتجرب قطعًا آخر.','Screening complete. Retime the blackout to try a different cut.');
    });
    const cutOut=el('output',String(s.blackout));const cutoff=range('blackout',s.blackout,2,s.duration-3,1,v=>{
      saved=null;s.blackout=v;retime(s);cutOut.value=String(v);drawShots();timer.seek(time);refreshLinks();
    });
    const length=select('duration',Array.from({length:8},(_,i)=>[i+8,(i+8)+' '+t('ث','s')]),s.duration,v=>{
      if(!Number.isInteger(+v)||+v<8||+v>15){length.value=String(s.duration);status.textContent=t('اختر مدة بين ٨ و١٥ ثانية.','Choose a length between 8 and 15 seconds.');return;}
      timer.stop();s.duration=+v;s.blackout=Math.min(s.blackout,s.duration-3);time=Math.min(s.duration,time);retime(s);saved=null;renderScene();
    });
    body.append(row(field(t('طول المشهد','Scene length'),length),field(t('ثانية انطفاء اللوحة','Blackout second'),cutoff),cutOut));
    const shotList=el('div',null,'cr-desk');body.append(shotList);
    function drawShots(){
      shotList.replaceChildren(...s.shots.map((shot,i)=>{
        const item=el('div',null,'cr-paper');item.append(el('b',(i+1)+' · '+choose(t,describe(s,i))+' · '+shot.start+'–'+(shot.start+shot.seconds)+' '+t('ث','s')));
        const model=(key,opts)=>select(key+i,Object.entries(opts).map(([id,n])=>[id,t(...n)]),shot[key],val=>{if(!Object.hasOwn(opts,val)){drawShots();status.textContent=t('اختر إعدادًا من مكتبة التصوير.','Choose a setting from the shot library.');return;}shot[key]=val;saved=null;refreshLinks();timer.seek(time);});
        item.append(row(field(t('الضوء','Lighting'),model('lighting',lights)),field(t('الحركة','Movement'),model('motion',motions))));return item;
      }));
    }
    let saving=false;
    const links=row();
    async function store(){
      if(saving||saved||!validScene(s))return;
      const snapshot=structuredClone(s);
      saving=true;refreshLinks();
      try{
        const frames=await sceneThumbnails(snapshot);
        if(!can.isConnected||scene!==s||prompt!==s.prompt||JSON.stringify(snapshot)!==JSON.stringify(s))return;
        if(frames.length!==s.shots.length){
          status.textContent=can.dataset.visual==='movement-plan'
            ?t('تعذّر تجهيز صور المشهد للحفظ. تستطيع مراجعة التوقيت وإعادة تحميل الصورة.','The scene images could not be prepared for saving. You can review the timing and retry the artwork.')
            :t('تعذّر تكوين صورة للحفظ. المشهد متاح للمراجعة، ويمكن إعادة محاولة الحفظ.','A saved frame could not be produced. You can review the scene and try saving again.');
          return;
        }
        const rec=ui.savePiece({title:snapshot.prompt,type:'night-scene',data:snapshot,thumbnail:frames[0]});
        if(rec){saved=rec;status.textContent=t('أُضيف المشهد إلى دفتر أعمالك.','The scene was added to your notebook.');}
        else status.textContent=t('تعذّر تأكيد الحفظ. يظل المشهد متاحًا هنا.','Saving could not be confirmed. The scene remains open here.');
      }finally{saving=false;if(can.isConnected)refreshLinks();}
    }
    function refreshLinks(){
      const save=button('save',saved?t('حُفظ المشهد','Scene saved'):t('احفظ المشهد في دفتري','Save scene to notebook'),store);
      save.disabled=saving||Boolean(saved);
      links.replaceChildren(save);
      if(saved?.id)links.append(link('./idea-to-studio.html?'+new URLSearchParams({lang,piece:saved.id}),t('عاين نقله إلى الاستوديو','Preview studio handoff')));
    }
    body.append(links);drawShots();refreshLinks();timer.seek(time);
  }
  renderChoice();renderScene();
}});
window.addEventListener('pagehide',()=>timer?.stop());
