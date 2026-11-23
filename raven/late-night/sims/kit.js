export function element(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
export function action(id,label,fn){const b=element('button',label);b.type='button';b.dataset.sim=id;b.addEventListener('click',fn);return b;}
export function select(id,label,choices,current,fn){
  const l=element('label',null,'sim-input'),s=element('select');s.dataset.sim=id;
  choices.forEach(([value,text])=>{const o=element('option',text);o.value=value;s.append(o);});
  s.value=current;s.addEventListener('change',()=>fn(s.value));l.append(element('span',label),s);return l;
}
export function slider(id,label,min,max,step,current,fn){
  const l=element('label',null,'sim-input'),row=element('span',null,'sim-range'),s=element('input'),out=element('output',String(current));
  s.type='range';s.min=min;s.max=max;s.step=step;s.value=current;s.dataset.sim=id;
  s.addEventListener('input',()=>{out.value=s.value;fn(+s.value);});row.append(s,out);l.append(element('span',label),row);return l;
}
export function surface(ui){
  const box=element('section',null,'night-sim'),frame=element('figure'),canvas=element('canvas'),caption=element('figcaption'),controls=element('div',null,'sim-controls'),read=element('p',null,'sim-read'),actions=element('div',null,'sim-actions');
  canvas.width=640;canvas.height=320;canvas.setAttribute('role','img');frame.append(canvas,caption);
  read.setAttribute('role','status');box.append(frame,read,controls,actions);ui.root.replaceChildren(box);
  return {canvas,c:canvas.getContext('2d'),read,controls,actions,box,describe(text){if(caption.textContent!==text){caption.textContent=text;canvas.setAttribute('aria-label',text);}}};
}
export function shade(c,top,bottom){
  const g=c.createLinearGradient(0,0,0,320);g.addColorStop(0,top);g.addColorStop(1,bottom);c.fillStyle=g;c.fillRect(0,0,640,320);
}
export function line(c,x,y,x2,y2,col,w=1){
  c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=col;c.lineWidth=w;c.stroke();
}
export function dot(c,x,y,r,col){c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.fillStyle=col;c.fill();}
export function poly(c,pts,col,stroke){
  c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  if(col){c.fillStyle=col;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}
}
export function ink(c,str,x,y,col='#ecdcbb',size=15,align='left'){
  c.save();c.direction=/[\u0600-\u06ff]/.test(str)?'rtl':'ltr';c.font=size+'px Arial,Tahoma,sans-serif';c.textAlign=align;c.fillStyle=col;c.fillText(str,x,y);c.restore();
}
export function output(canvas,name){canvas.toBlob(blob=>{
  if(!blob)return;const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);
},'image/png');}
export function miniature(canvas){
  const thumb=document.createElement('canvas');thumb.width=180;thumb.height=90;thumb.getContext('2d').drawImage(canvas,0,0,180,90);return thumb.toDataURL('image/webp',.68);
}
export function archive(ui,w,type,title,data){
  const r=ui.savePiece({type,title,data,thumbnail:miniature(w.canvas)});
  if(r){let done=w.box.querySelector('.sim-confirm');if(!done){done=element('p',null,'sim-confirm');done.setAttribute('role','status');w.box.append(done);}done.textContent=ui.t('حُفظت القطعة في دفتر أعمالي.','Saved to My notebook.');}
  return r;
}
export function playFrames(ms,update,complete){
  let frame=0,stop=false;const start=performance.now(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick(now){if(stop)return;const t=Math.min(1,(now-start)/ms);update(t);if(t<1)frame=requestAnimationFrame(tick);else complete?.();}
  if(reduced){update(1);complete?.();}else frame=requestAnimationFrame(tick);
  return ()=>{stop=true;cancelAnimationFrame(frame);};
}
