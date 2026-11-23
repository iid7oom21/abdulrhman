import {mount} from '../night-shell.js';
import {el,button,field,select,range,words,row,output,surface,stage,clock,choose,link} from './kit.js';
import {places,lights,motions,promptSetting,buildScene,retime,describe,validScene,paintScene,sceneThumbnails} from './scene.js';

const example=['انتظار عند رصيف بعد انطفاء اللوحة','Waiting on a pier after the sign goes dark'];
let scene=null,prompt='',languageOfPrompt='',feeding=false,wantsPlace=false,lastPlace='pier',time=0,timer,saved;
function unsupported(s){return /تنين|طائرة|فيل|قمر صناعي|صاروخ|نمر|حصان|سفينة فضاء|spaceship|satellite|dragon|elephant|plane|rocket|horse|tiger/iu.test(s);}
mount({id:'director-sentence',title:['مخرج من جملة','One-sentence director'],intro:['اكتب فكرة قصيرة وصوّرها بلقطات من مكتبة الساحل.','Turn a short idea into shots from the coastal set library.'],render(ui){
  const {t,lang}=ui;timer?.stop();
  if(!feeding){feeding=true;if(validScene(ui.editData)){scene=structuredClone(ui.editData);prompt=scene.prompt;lastPlace=scene.setting;}else{languageOfPrompt=lang;prompt=t(...example);}}
  else if(languageOfPrompt&&languageOfPrompt!==lang&&prompt===example[languageOfPrompt==='ar'?0:1]){
    prompt=t(...example);languageOfPrompt=lang;
  }
  const desk=surface(ui),body=el('section',null,'cr-desk'),choice=el('div',null,'cr-paper'),status=output();
  const idea=words('prompt',prompt,t(...example),160,v=>{prompt=v;languageOfPrompt='';wantsPlace=false;choice.hidden=true;status.textContent='';});
  const generate=button('generate',t('حوّلها إلى مشهد','Build my scene'),()=>{
    if(!prompt.trim()){status.textContent=t('أضف جملة قصيرة أولًا.','Write a short sentence first.');idea.focus();return;}
    const place=promptSetting(prompt);
    if(!place||unsupported(prompt)){lastPlace=place||'pier';wantsPlace=true;renderChoice();status.textContent='';return;}
    compose(place);
  });
  desk.append(field(t('فكرة المشهد','Scene idea'),idea),row(generate),choice,body,status);
  if(!scene){const preview=stage(t('الرصيف من كتالوج مواقع التصوير','Pier from the set library'));paintScene(preview,buildScene(example[0],'pier'),1);body.append(preview,el('p',t('من مكتبة التصوير المحلية · الرصيف','Local set library · Pier'),'cr-caption'));}
  function renderChoice(){
    choice.hidden=!wantsPlace;if(!wantsPlace)return;
    const set=select('substitute',Object.entries(places).map(([id,n])=>[id,t(...n)]),lastPlace,v=>{lastPlace=v;});
    choice.replaceChildren(el('p',t('هذه الفكرة تحتاج عنصرًا خارج المكتبة. اختر ديكورًا بديلًا؛ تظهر فيه شخصية ولوحة ومصباح.','This idea calls for something outside the library. Pick a replacement set with a figure, sign and lamp.')),field(t('الديكور البديل','Replacement set'),set),button('accept-set',t('ركّب البديل','Use this set'),()=>compose(lastPlace)));
  }
  function compose(id){
    const next=buildScene(prompt,id);if(!validScene(next))return;
    timer?.stop();scene=next;time=0;wantsPlace=false;saved=null;lastPlace=id;renderChoice();renderScene();
    status.textContent=t('المشهد جاهز للمراجعة.','The scene is ready to review.');
  }
  function renderScene(){
    if(!validScene(scene))return;body.replaceChildren();
    const s=scene,can=stage(t(...places[s.setting])),caption=el('p',null,'cr-caption'),read=el('output',null,'cr-meter');
    const scrub=range('seek',time,0,s.duration,.1,v=>timer.seek(v));
    const run=button('play',t('شغّل فكرتي','Play my idea'),()=>{if(validScene(scene))timer.play();});
    body.append(can,caption,row(run,read),field(t('ثانية المشهد','Scene second'),scrub));
    timer=clock(()=>s.duration,(sec,on)=>{
      time=sec;scrub.value=sec;read.value=sec.toFixed(1)+' / '+s.duration+' s';
      const shot=paintScene(can,s,sec),i=s.shots.indexOf(shot);caption.textContent=(i+1)+' / 3 · '+choose(t,describe(s,i))+' · '+t(...lights[shot.lighting])+' · '+t(...motions[shot.motion]);
      run.textContent=on?t('جمّد المشهد','Freeze scene'):sec>=s.duration?t('أعد مشاهدة فكرتي','Replay my scene'):t('شغّل فكرتي','Play my idea');
      can.dataset.shot=shot.id;can.dataset.seconds=sec.toFixed(1);
    },()=>{
      ui.recordEvent({ar:'وصل عرض مشهد '+places[s.setting][0]+' إلى اللقطة الأخيرة بعد '+s.duration+' ثوانٍ.',en:'The '+places[s.setting][1].toLowerCase()+' scene reached its last shot at '+s.duration+' seconds.',data:{kind:'night-scene-screening',setting:s.setting,seconds:s.duration,blackout:s.blackout}});
      status.textContent=t('اكتمل العرض. غيّر لحظة انطفاء اللوحة لتجرب قطعًا آخر.','Screening complete. Retime the blackout to try a different cut.');
    });
    const cutOut=el('output',String(s.blackout));const cutoff=range('blackout',s.blackout,2,s.duration-3,1,v=>{
      saved=null;s.blackout=v;retime(s);cutOut.value=String(v);drawShots();timer.seek(time);refreshLinks();
    });
    const length=select('duration',Array.from({length:8},(_,i)=>[i+8,(i+8)+' '+t('ث','s')]),s.duration,v=>{
      timer.stop();s.duration=+v;s.blackout=Math.min(s.blackout,s.duration-3);time=Math.min(s.duration,time);retime(s);saved=null;renderScene();
    });
    body.append(row(field(t('طول المشهد','Scene length'),length),field(t('ثانية انطفاء اللوحة','Blackout second'),cutoff),cutOut));
    const shotList=el('div',null,'cr-desk');body.append(shotList);
    function drawShots(){
      shotList.replaceChildren(...s.shots.map((shot,i)=>{
        const item=el('div',null,'cr-paper');item.append(el('b',(i+1)+' · '+choose(t,describe(s,i))+' · '+shot.start+'–'+(shot.start+shot.seconds)+' '+t('ث','s')));
        const model=(key,opts)=>select(key+i,Object.entries(opts).map(([id,n])=>[id,t(...n)]),shot[key],val=>{shot[key]=val;saved=null;refreshLinks();timer.seek(time);});
        item.append(row(field(t('الضوء','Lighting'),model('lighting',lights)),field(t('الحركة','Movement'),model('motion',motions))));return item;
      }));
    }
    function store(){
      if(!validScene(s))return null;
      const rec=ui.savePiece({title:s.prompt,type:'night-scene',data:structuredClone(s),thumbnail:sceneThumbnails(s)[0]});
      if(rec){saved=rec;status.textContent=t('أُضيف المشهد إلى دفتر أعمالك.','The scene was added to your notebook.');}
      else status.textContent=t('تعذّر تأكيد الحفظ. يظل المشهد متاحًا هنا.','Saving could not be confirmed. The scene remains open here.');
      return rec;
    }
    const links=row();function refreshLinks(){
      links.replaceChildren(button('save',t('احفظ المشهد في دفتري','Save scene to notebook'),()=>{store();refreshLinks();}));
      if(saved?.id)links.append(link('./idea-to-studio.html?'+new URLSearchParams({lang,piece:saved.id}),t('عاين نقله إلى الاستوديو','Preview studio handoff')));
    }
    body.append(links);drawShots();refreshLinks();timer.seek(time);
  }
  renderChoice();renderScene();
}});
window.addEventListener('pagehide',()=>timer?.stop());
