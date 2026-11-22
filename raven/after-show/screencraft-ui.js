export const W=640, H=308;
export const clamp=(v,a,b,d=a)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):d;
export const one=(v,options,def=options[0])=>options.includes(v)?v:def;
export function node(tag,text,cls){
  const n=document.createElement(tag);
  if(text!=null)n.textContent=text;
  if(cls)n.className=cls;
  return n;
}
export function table(ui,heading,instructions,draw,duration){
  const {t}=ui;
  const main=node('section',null,'sc-table');
  main.append(node('h1',heading),node('p',instructions,'sc-intro'));
  const frame=node('canvas');frame.width=W;frame.height=H;frame.setAttribute('role','img');
  frame.setAttribute('aria-label',heading);frame.dataset.sc='frame';
  const screen=node('figure',null,'sc-screen');
  screen.append(frame);main.append(screen);
  const readout=node('p',null,'sc-clock');
  const transport=node('div',null,'sc-transport');
  const scrub=node('input');scrub.type='range';scrub.min=0;scrub.step='.01';scrub.dir='ltr';
  scrub.dataset.sc='scrub';scrub.setAttribute('aria-label',t('موضع العرض بالثواني','Playhead in seconds'));
  const play=act('play',t('شغّل','Play'),toggle);
  transport.append(play,scrub,readout);main.append(transport);
  const nav=node('div',null,'sc-nav'), controls=node('div',null,'sc-controls');
  const result=node('output',null,'sc-report');result.dataset.sc='report';result.setAttribute('aria-live','polite');
  main.append(nav,controls,result);ui.root.replaceChildren(main);
  const ctx=frame.getContext('2d'), reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let time=0,tick=0,active=false,lastRender=0;
  const refresh=()=>{scrub.max=duration();time=clamp(time,0,+scrub.max);scrub.value=time;
    readout.textContent=time.toFixed(1)+' / '+(+scrub.max).toFixed(1)+' '+t('ث','s');
    if(ctx){ctx.save();draw(ctx,time);ctx.restore();}
  };
  function stop(){cancelAnimationFrame(tick);active=false;play.setAttribute('aria-pressed','false');play.textContent=t('شغّل','Play');}
  function toggle(){
    if(active){stop();return;}
    if(time>=duration()-.015)time=0;
    let start=performance.now()-time*1000;
    active=true;play.setAttribute('aria-pressed','true');play.textContent=t('جمّد الإطار','Freeze frame');
    function loop(now){
      if(!active)return;
      time=Math.min(duration(),(now-start)/1000);
      if(now-lastRender>(reduced.matches?400:32)||time>=duration()){refresh();lastRender=now;}
      if(time>=duration()){stop();return;}
      tick=requestAnimationFrame(loop);
    }
    tick=requestAnimationFrame(loop);
  }
  function seek(v){stop();time=v;refresh();}
  scrub.oninput=()=>seek(+scrub.value);ui.onCleanup(stop);
  return {main,frame,ctx,nav,controls,result,refresh,seek,stop,time:()=>time};
}
export function act(key,label,fn){
  const b=node('button',label);b.type='button';b.dataset.sc=key;b.onclick=fn;return b;
}
export function picker(key,label,opts,value,fn){
  const f=node('label',null,'sc-input');const s=node('select');s.dataset.sc=key;
  for(const [v,txt] of opts){const o=node('option',txt);o.value=v;s.append(o);}
  s.value=value;s.onchange=()=>fn(s.value);f.append(node('span',label),s);return f;
}
export function range(key,label,v,min,max,step,fn){
  const f=node('label',null,'sc-input');const s=node('input');s.type='range';s.min=min;s.max=max;s.step=step;s.value=v;s.dataset.sc=key;s.dir='ltr';
  const o=node('output',String(v));s.oninput=()=>{o.textContent=s.value;fn(+s.value);};
  f.append(node('span',label),s,o);return f;
}
export function input(key,label,v,fn){
  const f=node('label',null,'sc-input');const s=node('input');s.type='text';s.maxLength=14;s.value=v;s.dataset.sc=key;s.dir='auto';
  s.oninput=()=>fn(s.value);f.append(node('span',label),s);return f;
}
export function options(items,t){return items.map(([id,ar,en])=>[id,t(ar,en)]);}
export function tabs(w,key,items,v,fn){
  w.nav.replaceChildren(...items.map(([id,label])=>{
    const b=act(key+'-'+id,label,()=>fn(id));b.setAttribute('aria-pressed',String(v===id));return b;
  }));
}
export function rect(c,color,x,y,w,h){c.fillStyle=color;c.fillRect(x,y,w,h);}
export function poly(c,color,pts){
  c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
}
export function line(c,color,width,...pts){
  c.strokeStyle=color;c.lineWidth=width;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
}
export function ellipse(c,col,x,y,rx,ry){
  c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();
}
export function sky(c,a,b){
  const gradient=c.createLinearGradient(0,0,0,H);gradient.addColorStop(0,a);gradient.addColorStop(1,b);rect(c,gradient,0,0,W,H);
}
export function text(c,txt,x,y,size=16,color='#f6ebcd',weight=600){
  c.font=weight+' '+size+'px system-ui,sans-serif';c.textAlign='center';c.fillStyle=color;c.fillText(txt,x,y);
}
export function grain(c){
  // Fixed film grain, shared between frames so scrubbing never creates flicker.
  if(!grain.tile){
    const sheet=document.createElement('canvas');sheet.width=sheet.height=80;const g=sheet.getContext('2d');
    const im=g.createImageData(80,80);let seed=1704;
    for(let j=0;j<im.data.length;j+=4){seed=(1664525*seed+1013904223)>>>0;const v=seed>>>24;im.data[j]=im.data[j+1]=im.data[j+2]=v;im.data[j+3]=24;}
    g.putImageData(im,0,0);grain.tile=sheet;
  }
  rect(c,c.createPattern(grain.tile,'repeat'),0,0,W,H);
}
