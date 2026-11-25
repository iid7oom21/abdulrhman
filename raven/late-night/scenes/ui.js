export function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
export function button(label, fn, id) {
  const b = el('button', label);
  b.type = 'button';
  b.dataset.scene = id;
  b.addEventListener('click', fn);
  return b;
}
export function control(label, child) {
  const row = el('label', null, 'ns-field');
  row.append(el('span', label), child);
  return row;
}
export function select(options, value, fn, id) {
  const s = el('select');
  s.dataset.scene=id;
  for (const [key,name] of options) {
    const o = el('option',name); o.value=key; s.append(o);
  }
  s.value=value;
  s.addEventListener('change',()=>fn(s.value));
  return s;
}
export function slider(min,max,value,fn,id,step=1) {
  const r=el('input');r.type='range';r.min=min;r.max=max;r.step=step;r.value=value;r.dataset.scene=id;
  r.addEventListener('input',()=>fn(r.valueAsNumber));return r;
}
export function board(root, ar, en, t) {
  const figure=el('figure',null,'ns-stage'), canvas=el('canvas'),caption=el('figcaption');
  canvas.width=720;canvas.height=330;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',t(ar,en));
  figure.append(canvas,caption);root.append(figure);
  return {canvas,ctx:canvas.getContext('2d'),caption};
}
export function status(root) {
  const p=el('p',null,'ns-status');p.setAttribute('role','status');root.append(p);return p;
}
export function actions(root, ...children) {
  const wrap=el('div',null,'ns-actions');wrap.append(...children);root.append(wrap);return wrap;
}
export function file(name,content,mime='application/json') {
  const blob = content instanceof Blob ? content : new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download=name;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
export function downloadCanvas(canvas,name) {
  canvas.toBlob(blob=>{if(blob)file(name,blob);},'image/png');
}
export function thumbnail(canvas) {
  const copy=el('canvas');copy.width=288;copy.height=132;
  const c=copy.getContext('2d');
  if (!c || !canvas.getContext('2d')) return undefined;
  c.drawImage(canvas,0,0,288,132);return copy.toDataURL('image/webp',.77);
}
export function bound(value,fallback,min,max) {
  return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
}
export function indices(raw, max, length) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(i=>Number.isInteger(i)&&i>=0&&i<max))].slice(0,length);
}
let cleanup=()=>{};
export function begin(ui) {cleanup();cleanup=()=>{};ui.root.replaceChildren();ui.root.classList.add('ns-room');}
export function onLeave(fn) {const old=cleanup;cleanup=()=>{old();fn();};}
window.addEventListener('pagehide',()=>cleanup());
export function transport(root, ui, duration, renderFrame, done, initial=0) {
  const {t}=ui;
  let time=bound(initial,0,0,duration),token=0,start=0;
  const clock=el('output'),seek=slider(0,duration,time,v=>{stop();time=v;update();if(v>=duration)done?.();},'seek',.1);
  const play=button('',()=>{if(token){stop();update();return;}if(time>=duration)time=0;start=performance.now()-time*1000;tick();},'play');
  const wrap=actions(root,play,control(t('موضع العرض','Playhead'),seek),clock);
  wrap.classList.add('ns-transport');
  function update(){seek.value=time;clock.value=time.toFixed(1)+' / '+duration+t(' ث',' s');renderFrame(time,!!token);}
  function stop(){cancelAnimationFrame(token);token=0;play.textContent=t('شغّل العرض','Play');}
  function tick(){
    time=Math.min(duration,(performance.now()-start)/1000);
    if(time>=duration){stop();update();done?.();return;}
    token=requestAnimationFrame(tick);play.textContent=t('أوقف مؤقتًا','Pause');update();
  }
  const onHide=()=>{if(document.hidden)stop();};
  document.addEventListener('visibilitychange',onHide);
  onLeave(()=>{stop();document.removeEventListener('visibilitychange',onHide);});
  stop();
  return {update,stop,get time(){return time;},set(v){stop();time=bound(v,0,0,duration);update();}};
}
