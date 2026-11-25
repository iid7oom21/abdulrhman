import {mount} from '../night-shell.js';
import {activities,extras} from '../catalog.js';
import {el,button,field,row,stage,range,clock,surface,output,link} from './kit.js';

let selected=null,time=0,player=null,heard=null;
function studio(canvas,t,sec,total,active){
  const c=canvas.getContext('2d');if(!c)return;
  const grad=c.createLinearGradient(0,0,640,300);grad.addColorStop(0,'#294653');grad.addColorStop(.7,'#1b3038');grad.addColorStop(1,'#574a40');c.fillStyle=grad;c.fillRect(0,0,640,300);
  c.fillStyle='#baa373';c.fillRect(54,118,532,4);
  for(let i=0;i<=40;i++){const x=54+i*13.3;c.fillStyle=i%5?'#9d9d82':'#e9ce98';c.fillRect(x,70,1,i%5?15:28);if(i%5===0){c.font='12px monospace';c.fillText(String(i*5+80),x-8,63);}}
  c.fillStyle='#ff9c72';c.fillRect(54+(total?sec/total:0)*532,56,3,84);
  c.fillStyle='#d9cba6';c.font='600 24px system-ui';c.textAlign='center';c.fillText(t('إذاعة الساحل','Coast radio'),320,194);
  c.fillStyle='#e5aa79';c.font='16px system-ui';c.fillText(active?t('على الهواء','ON AIR'):t('غرفة البث','BROADCAST ROOM'),320,233);
}
mount({id:'city-radio',title:['إذاعة المدينة التي صنعتها','Radio from your city'],intro:['اختر قصاصتين من نشاطاتك، واضغط على سطر من النشرة لتفتح الحدث الذي أتى منه.','Pick up to two clippings from your activities. Open a bulletin line to trace it to its event.'],render(ui){
  const {t,lang}=ui;player?.stop();if(heard){speechSynthesis.cancel();heard=null;}
  const records=ui.events().filter(e=>e&&typeof e.id==='string'&&typeof e.ar==='string'&&typeof e.en==='string'&&e.activity!=='city-radio').slice(0,18);
  if(!selected)selected=records.slice(0,2).map(e=>e.id);else selected=selected.filter(id=>records.some(e=>e.id===id));
  const w=surface(ui),can=stage(t('مؤشر زمن نشرة الساحل','Coast radio broadcast playhead')),list=el('div',null,'cr-desk'),playerArea=el('div',null,'cr-desk'),detail=output();w.append(can,list,playerArea,detail);
  const chosen=()=>selected.map(id=>records.find(e=>e.id===id)).filter(Boolean);
  const duration=()=>selected.length*10;
  const origin=e=>[...activities,...extras].find(a=>a[0]===e.activity);
  const announce=(e,i)=>{const a=origin(e),place=a?t(a[1],a[2]):t('دفتر المدينة','the city log');
    return (i===0?t('هنا إذاعة الساحل. من ','Coast Radio. From '):t('وفي موجز آخر، من ','Elsewhere, from '))+place+' — '+e[lang];};
  const timestamp=e=>{const d=new Date(e.at);return isNaN(d)?'':d.toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'});};
  function draw(){
    player?.stop();if(heard){speechSynthesis.cancel();heard=null;}detail.textContent='';list.replaceChildren();playerArea.replaceChildren();
    if(!records.length){studio(can,t,0,0,false);list.append(el('p',t('دفتر البث ينتظر أول حدث. أكمل محاولة في الكاميرا أو اعرض فكرتك، ثم ارجع إلى هنا.','The broadcast log is waiting for its first event. Finish a camera run or screen a scene, then return.')),row(link('./weightless-cam.html?lang='+lang,t('العب جولة بالكاميرا','Try the camera')),link('./director-sentence.html?lang='+lang,t('اصنع مشهدًا','Direct a scene'))));return;}
    list.append(el('h2',t('قصاصاتك','Your clippings')));
    for(const e of records){
      const l=el('label',null,'cr-row'),box=el('input');box.type='checkbox';box.checked=selected.includes(e.id);box.disabled=!box.checked&&selected.length>=2;box.dataset.creative='clip';
      box.onchange=()=>{selected=box.checked?[...selected,e.id]:selected.filter(id=>id!==e.id);time=0;draw();};
      l.append(box,el('span',e[lang]));list.append(l);
    }
    if(!selected.length){studio(can,t,0,0,false);return;}
    const script=chosen(),sec=el('output',null,'cr-meter'),current=el('p',null,'cr-read');
    const scrub=range('seek',time,0,duration(),.1,v=>player.seek(v));const play=button('air',t('شغّل توقيت النشرة','Run bulletin timing'),()=>player.play());
    player=clock(duration,(value,on)=>{
      time=value;scrub.value=value;sec.value=value.toFixed(1)+' / '+duration()+t(' ث',' s');
      const e=script[Math.min(script.length-1,Math.floor(value/10))];
      current.textContent=announce(e,script.indexOf(e));studio(can,t,value,duration(),on);play.textContent=on?t('أوقف التوقيت','Pause timing'):t('شغّل توقيت النشرة','Run bulletin timing');
    });
    playerArea.append(el('h2',t('نشرة الساحل','The coast bulletin')),row(play,sec),field(t('موضع البث','Broadcast position'),scrub),current);
    script.forEach((e,i)=>playerArea.append(button('source'+i,(i*10)+'–'+((i+1)*10)+t(' ث',' s')+' · '+announce(e,i),()=>{
      player.seek(i*10);detail.dataset.source=e.activity;detail.replaceChildren(document.createTextNode(t('من سجل اللعب','From the play log')+' · '+timestamp(e)+'\n'+e[lang]));
      const a=origin(e);if(a){detail.append(el('br'),link('./'+a[0]+'.html?lang='+lang,t('افتح النشاط','Open activity')+' · '+t(a[1],a[2])));}
    })));
    const voice=globalThis.speechSynthesis?.getVoices().find(v=>v.localService&&v.lang.toLowerCase().startsWith(lang));
    if(voice&&typeof SpeechSynthesisUtterance==='function'){
      const listen=button('listen',t('استمع إلى النص','Listen to the script'),()=>{
        if(heard){speechSynthesis.cancel();heard=null;listen.textContent=t('استمع إلى النص','Listen to the script');return;}
        const u=new SpeechSynthesisUtterance(script.map(announce).join(' '));u.voice=voice;u.lang=voice.lang;heard=u;
        const done=()=>{if(heard===u){heard=null;listen.textContent=t('استمع إلى النص','Listen to the script');}};u.onend=done;u.onerror=done;listen.textContent=t('أوقف الاستماع','Stop listening');speechSynthesis.speak(u);
      });playerArea.append(listen);
    }
    player.seek(Math.min(time,duration()));
  }
  draw();
}});
window.addEventListener('pagehide',()=>{player?.stop();if(heard)globalThis.speechSynthesis?.cancel();});
