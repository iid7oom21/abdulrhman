import {el,board,actions,button,status,file,indices,transport,onLeave} from './ui.js';
import {museum} from './art.js';
import {scene,recall,record} from './scene-piece.js';

const title=['متحف الأصوات المنسيّة', 'Museum of forgotten sounds'];
const intro=['اجمع ثلاث آلات على بطاقة صوتية من ست ثوانٍ. تبدأ الزيارة صامتة.', 'Collect three machines on a six-second postcard. Your visit starts silent.'];
const machines=[['آلة التذاكر','Ticket punch'],['طاحونة لعبة','Toy windmill'],['جرس المتجر','Shop bell']];
const soundWords=[['تهبط الذراع فتطقطق أسنان آلة التذاكر.','The handle drops and the punch teeth click.'],['تدور الشفرات فتصدر التروس أزيزًا قصيرًا.','The blades turn and the gears hum.'],['يتأرجح جسم الجرس وتطرق المطرقة حافته.','The bell swings and the clapper strikes its rim.']];
const wav=['ticket','mill','bell'];
function soundMuseum(ui){
  const {root,t}=ui,s=recall(ui,d=>({id:0,order:indices(d.order,3,3),at:0,seen:false}));
  const view=board(root,...title,t),exhibits=actions(root),edit=actions(root),queue=el('ol',null,'ns-list'),screen=el('div'),out=el('div'),msg=status(root);
  root.append(queue,screen,out);
  let audible=false,player,previous=-1,active=null;
  const allow=button('',()=>{audible=!audible;stopAudio();previous=-1;refresh();},'sound');
  function stopAudio(){if(active){active.pause();active=null;}}
  function cue(id){if(!audible)return;stopAudio();const a=el('audio');active=a;a.src='./assets/museum-'+wav[id]+'.wav';a.hidden=true;root.append(a);
    const forget=()=>{a.remove();if(active===a)active=null;};a.onended=forget;a.onpause=forget;
    a.play().catch(()=>{forget();audible=false;refresh();msg.textContent=t('تعذّر الصوت. الحركة والتوقيت متاحان.','Sound is unavailable. Motion and timing remain available.');});}
  onLeave(stopAudio);
  function detail(){museum(view.ctx,s.id,.6);view.caption.textContent=t(...machines[s.id])+' · '+t(...soundWords[s.id]);}
  function refresh(){allow.textContent=audible?t('اكتم الصوت','Mute sound'):t('فعّل الصوت','Enable sound');allow.setAttribute('aria-pressed',String(audible));exhibits.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===s.id)));
    write.disabled=s.order.includes(s.id)||s.order.length>=3;undo.disabled=!s.order.length;show.disabled=s.order.length!==3;
    queue.replaceChildren(...s.order.map((id,i)=>el('li',i*2+'–'+(i+1)*2+' s · '+t(...machines[id])+' · '+t(...soundWords[id]))));}
  function change(){player?.stop();stopAudio();screen.replaceChildren();out.replaceChildren();s.at=0;s.seen=false;refresh();detail();}
  const write=button(t('خذ لحظة من هذه الآلة','Collect this machine'),()=>{if(!s.order.includes(s.id)&&s.order.length<3)s.order.push(s.id);change();},'collect');
  const undo=button(t('ارفع آخر لحظة','Remove last moment'),()=>{s.order.pop();change();},'undo');
  const show=button(t('افتح البطاقة ذات الست ثواني','Open six-second postcard'),()=>{
    player?.stop();s.at=0;s.seen=true;playback();
  },'postcard');
  machines.forEach((pair,i)=>exhibits.append(button(t(...pair),()=>{player?.stop();s.id=i;detail();cue(i);refresh();},'machine-'+i)));
  edit.append(allow,write,undo,show);
  function playback(){screen.replaceChildren();out.replaceChildren();previous=-1;
    player=transport(screen,ui,6,(sec,running)=>{s.at=sec;const slot=Math.min(2,Math.floor(sec/2)),id=s.order[slot];museum(view.ctx,id,sec%2);view.caption.textContent=t(...machines[id])+' · '+t(...soundWords[id]);
      if(running&&slot!==previous)cue(id);if(!running)stopAudio();previous=running?slot:-1;},null,s.at);
    player.update();
    const data=()=>({order:[...s.order],seconds:6,timeline:s.order.map((id,i)=>({instrument:wav[id],start:i*2,end:i*2+2}))});
    actions(out,button(t('احفظ البطاقة','Save postcard'),()=>record(ui,t(...title),'postcard',data(),view.canvas,msg,{ar:'اكتملت بطاقة بريدية من ثلاث آلات.',en:'A three-machine postcard was assembled.',data:data()}),'save'),
      button(t('نزّل ترتيب البطاقة','Download postcard timeline'),()=>file('raven-museum-postcard.json',JSON.stringify(data(),null,2)),'export'),
      button(t('ابدأ بطاقة أخرى','New postcard'),()=>{s.order=[];change();},'retry'));
  }
  refresh();detail();if(s.seen&&s.order.length===3)playback();
}

export default scene('sound-museum',title,intro,soundMuseum);
