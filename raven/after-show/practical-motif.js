import {el,button,select,number,setIn,ground,line,text,studio,resetControls} from './practical-tools.js';

const instruments=['sine','triangle','sawtooth'];
const frequencies=[261.63,293.66,329.63,392,440];
const noteNames=[['دو','C'],['ري','D'],['مي','E'],['صول','G'],['لا','A']];
const locations=[['الرصيف','The platform'],['السوق','The market'],['السطح','The rooftop']];
const timbres=[['صفير ناعم','Soft whistle'],['وتر مكتوم','Muted string'],['قصبة','Reed']];
function phrase(raw,source){
  const r=raw||source||{};
  return {notes:[0,2,1,3].map((n,i)=>number(r.notes?.[i],0,4,n)),
    beats:[1,2,2,2].map((n,i)=>number(r.beats?.[i],1,4,n)),bpm:number(r.bpm,60,140,90),voice:setIn(r.voice,instruments,'triangle')};
}
export default function motif(ui){
  const {t}=ui,raw=ui.load(ui.route,{})||{};
  const scenes=[phrase(raw.scenes?.[0]),null,null];
  for(let i=1;i<3;i++)if(raw.scenes?.[i])scenes[i]=phrase(raw.scenes[i]);
  let scene=number(raw.scene,0,2,0),slot=number(raw.slot,0,3,0);
  if(!scenes[scene])scenes[scene]=phrase(null,scenes[0]);
  let ac=null,muted=true,timer=0,active=false,voices=[],audible=false,closed=false;
  function hostAudio(on){
    if(on===audible)return;
    audible=on;
    try{
      const other=[...document.querySelectorAll('audio,video')].some(e=>!e.paused&&!e.ended&&!e.muted&&!e.error&&e.volume>0);
      window.parent.RavenSite?.setMediaActive?.(window,document,on||other);
    }catch{/* A standalone or cross-origin host may have no soundtrack bridge. */}
  }
  const w=studio(ui,t('أربع نغمات تعود','Four notes return'),t('اكتب لحنًا من أربع نغمات لثماني نبضات. عند عودته في السوق وعلى السطح، حافظ على اتجاه النغمات وغيّر الآلة أو السرعة.','Write four notes across eight beats. For the market and rooftop returns, keep the melodic contour and change the instrument or tempo.'));
  const get=()=>scenes[scene],save=()=>ui.save(ui.route,{scene,slot,scenes});
  const dir=a=>a.slice(1).map((n,i)=>Math.sign(n-a[i]));
  function report(){
    const p=get(),total=p.beats.reduce((a,b)=>a+b,0),contour=dir(p.notes);
    const same=contour.every((d,i)=>d===dir(scenes[0].notes)[i]),variation=p.voice!==scenes[0].voice||p.bpm!==scenes[0].bpm;
    const m=t('نبضات ','Beats ')+total+'/8 · '+t('اتجاه اللحن ','Melodic contour ')+contour.map(d=>d===0?'→':d>0?'↗':'↘').join(' ');
    w.describe(m+(scene?' · '+(same?t('حُفظ الاتجاه','Contour retained'):t('تغيّر الاتجاه','Contour changed'))+' · '+(variation?t('تغيّر الأداء','Performance varied'):t('الآلة والسرعة كما في البداية','Same instrument and tempo as the opening')):''));
  }
  function render(progress=-1){
    const c=w.ctx;if(!c)return;
    ground(c,'#d4cbb8','#f3ecda');
    const p=get(),total=p.beats.reduce((a,b)=>a+b,0),scale=491/Math.max(8,total),current=progress<0?-1:progress*total;
    const roof=scene===0?[28,42,31,54,25,40]:scene===1?[48,24,55,36,72,43]:[67,35,90,28,54,80];
    c.save();
    for(let i=0;i<16;i++){
      const x=30+i*20,h=12+((i*37+scene*7)%31);c.fillStyle='#a2a798';c.fillRect(x,84-h,18,h);
    }
    roof.forEach((h,j)=>{
      const x=41+j*49,y=85-h*.65,wide=j%2?34:42;
      c.fillStyle=j%2?'#5b6a61':'#49605b';c.fillRect(x,y,wide,85-y);
      c.fillRect(x-2,y-2,wide+4,3);
      if(j%2===scene%2)c.fillRect(x+7,y-8,8,7);
      c.fillStyle='#c3b497';
      for(let wx=x+4;wx<x+wide-3;wx+=8)for(let wy=y+5;wy<77;wy+=10)c.fillRect(wx,wy,2.5,4);
    });c.restore();
    line(c,30,86,610,86,'#836d52',2);
    text(c,t(...locations[scene]),591,62,23,'#424c40','right');
    text(c,p.bpm+' BPM',591,84,13,'#775d47','right');
    for(let i=0;i<5;i++)line(c,51,135+i*15,594,135+i*15,'#8b8b78',1.5);
    const bar=71+4*scale;line(c,bar,135,bar,195,'#656e5f',1.5);
    for(let k=0;k<Math.max(8,total);k++)line(c,71+k*scale,239,71+k*scale,245,k%4?'#b7ad94':'#715e47',k%4?1:2);
    let beat=0,previous=null;const centers=[];
    for(let i=0;i<4;i++){
      const x=71+(beat+p.beats[i]/2)*scale,y=195-p.notes[i]*15,hit=current>=beat&&current<beat+p.beats[i];
      centers.push([x,y,hit]);if(previous)line(c,previous[0],previous[1],x,y,'#ae8056',3);previous=[x,y];
      line(c,71+beat*scale,251,71+(beat+p.beats[i])*scale-3,251,i===slot?'#944731':'#516b5c',6);
      text(c,String(p.beats[i]),x,280,18,'#465549','center');
      beat+=p.beats[i];
    }
    for(let i=0;i<centers.length;i++){
      const [x,y,hit]=centers[i];c.fillStyle=hit||i===slot?'#954635':'#293d34';c.beginPath();c.ellipse(x,y,10,6,-.3,0,Math.PI*2);c.fill();line(c,x+8,y,x+8,y-35,c.fillStyle,3);
    }
    const target=71+8*scale;line(c,target,216,target,261,'#92482d',2);
    if(progress>=0)line(c,71+current*scale,112,71+current*scale,247,'#ab4e2d',2);
  }
  function stop(){
    w.stop();clearTimeout(timer);for(const v of voices){try{v.stop();}catch{}}voices=[];active=false;hostAudio(false);
  }
  function onVisibility(){if(document.hidden&&active){stop();render();controls();}}
  document.addEventListener('visibilitychange',onVisibility);
  ui.onCleanup(()=>{closed=true;document.removeEventListener('visibilitychange',onVisibility);stop();if(ac)ac.close().catch(()=>{});});
  function sync(){stop();save();render();report();controls();}
  function play(){
    stop();const p=get(),beatSec=60/p.bpm,total=p.beats.reduce((a,b)=>a+b,0);active=true;
    if(!muted&&ac?.state==='running'){
      hostAudio(true);
      let when=ac.currentTime+.025;
      for(let i=0;i<4;i++){
        const v=ac.createOscillator(),gain=ac.createGain(),length=p.beats[i]*beatSec;
        v.type=p.voice;v.frequency.value=frequencies[p.notes[i]];gain.gain.setValueAtTime(.001,when);
        gain.gain.exponentialRampToValueAtTime(.085,when+.025);gain.gain.exponentialRampToValueAtTime(.001,when+length-.015);
        v.connect(gain);gain.connect(ac.destination);v.onended=()=>{v.disconnect();gain.disconnect();};v.start(when);v.stop(when+length);voices.push(v);when+=length;
      }
    }
    w.play(total*beatSec*1000,render);timer=setTimeout(()=>{active=false;hostAudio(false);controls();},total*beatSec*1000+30);controls();
  }
  function controls(){
    const p=get(),nav=el('div',null,'pra-row'),notes=el('div',null,'pra-row'),settings=el('div',null,'pra-row'),actions=el('div',null,'pra-row');
    locations.forEach((name,i)=>{const b=button('scene-'+i,t(...name),()=>{scene=i;if(!scenes[i])scenes[i]=phrase(null,scenes[0]);sync();});b.setAttribute('aria-pressed',String(i===scene));nav.append(b);});
    for(let i=0;i<4;i++){const b=button('note-'+i,(i+1)+' · '+t(...noteNames[p.notes[i]]),()=>{slot=i;sync();});b.setAttribute('aria-pressed',String(i===slot));notes.append(b);}
    settings.append(select('pitch',t('النغمة','Pitch'),noteNames.map((n,i)=>[i,t(...n)]),p.notes[slot],v=>{p.notes[slot]=+v;sync();}),
      select('beats',t('طولها بالنبضات','Length in beats'),[1,2,3,4].map(n=>[n,n]),p.beats[slot],v=>{p.beats[slot]=+v;sync();}),
      select('voice',t('الآلة','Instrument'),instruments.map((n,i)=>[n,t(...timbres[i])]),p.voice,v=>{p.voice=v;sync();}),
      select('tempo',t('نبضة في الدقيقة','Beats per minute'),[60,75,90,105,120,140].map(n=>[n,n]),p.bpm,v=>{p.bpm=+v;sync();}));
    const audio=button('mute',muted?t('فعّل الصوت','Enable sound'):t('اكتم الصوت','Mute sound'),async()=>{
      if(!muted){muted=true;stop();render();controls();return;}
      try{const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error();if(!ac)ac=new C();await ac.resume();if(closed)return;muted=false;controls();}
      catch{w.status.textContent=t('الصوت غير متاح. النوتة المرئية متاحة.','Audio unavailable. The visual score is available.');}
    });audio.setAttribute('aria-pressed',String(!muted));
    const go=button('replay',active?t('أوقف العرض','Stop playback'):t('اعرض اللحن','Play phrase'),()=>{if(active){stop();render();controls();}else play();});go.className='pra-main';actions.append(go,audio);
    resetControls(w.controls,nav,notes,settings,actions);
  }
  controls();render();report();
}
