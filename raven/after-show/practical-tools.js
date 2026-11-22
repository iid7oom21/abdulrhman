export function el(tag,text,cls){
  const e=document.createElement(tag);
  if(text!=null)e.textContent=text;
  if(cls)e.className=cls;
  return e;
}
export function button(id,text,fn){
  const e=el('button',text);e.type='button';e.dataset.practical=id;e.addEventListener('click',fn);return e;
}
export function select(id,label,items,initial,change){
  const wrap=el('label',null,'pra-select'),input=el('select');
  input.dataset.practical=id;
  for(const [value,name] of items){const option=el('option',name);option.value=String(value);input.append(option);}
  input.value=String(initial);input.addEventListener('change',()=>change(input.value));
  wrap.append(el('span',label),input);return wrap;
}
export function range(id,label,min,max,value,change){
  const wrap=el('label',null,'pra-range'),input=el('input'),out=el('output',String(value));
  input.type='range';input.min=min;input.max=max;input.value=value;input.dataset.practical=id;
  input.addEventListener('input',()=>{out.value=input.value;change(Number(input.value));});
  wrap.append(el('span',label),input,out);return wrap;
}
export function number(v,lo,hi,d){
  return Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v))):d;
}
export function setIn(v,items,d){return items.includes(v)?v:d;}
export function path(ctx,pts,fill,stroke,width=1){
  ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}
}
export function line(ctx,x1,y1,x2,y2,color,width=1){
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
export function text(ctx,str,x,y,size=16,color='#2e3932',align='left'){
  ctx.save();ctx.font=size+'px "Noto Sans Arabic", Arial, sans-serif';ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(str,x,y);ctx.restore();
}
export function ground(ctx,top,bottom){
  const g=ctx.createLinearGradient(0,0,0,310);g.addColorStop(0,top);g.addColorStop(1,bottom);ctx.fillStyle=g;ctx.fillRect(0,0,640,310);
  ctx.save();ctx.fillStyle='rgba(90,70,42,.12)';
  for(let i=0;i<520;i++)ctx.fillRect((i*127)%640,(i*337)%311,1+(i%3),1);
  ctx.restore();
}
export function studio(ui,title,brief){
  const panel=el('section',null,'pra-workshop'),hero=el('header'),canvas=el('canvas'),controls=el('div',null,'pra-controls'),status=el('p',null,'pra-status');
  const frame=el('figure',null,'pra-frame');canvas.width=640;canvas.height=310;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',title);
  status.setAttribute('role','status');frame.append(canvas);hero.append(el('h1',title),el('p',brief));panel.append(hero,frame,status,controls);ui.root.replaceChildren(panel);
  let raf=0;const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const stop=()=>{cancelAnimationFrame(raf);raf=0;};
  ui.onCleanup(stop);
  return {panel,canvas,ctx:canvas.getContext('2d'),controls,status,stop,reduced:()=>reduce.matches,
    describe(label){canvas.setAttribute('aria-label',label);status.textContent=label;},
    play(ms,render,end){
      stop();
      if(reduce.matches){render(1);end?.();return;}
      const start=performance.now();
      const tick=now=>{const t=Math.min(1,(now-start)/ms);render(t);if(t<1)raf=requestAnimationFrame(tick);else {raf=0;end?.();}};
      raf=requestAnimationFrame(tick);
    }
  };
}
export function resetControls(node,...children){
  const id=document.activeElement?.dataset.practical;
  node.replaceChildren(...children);
  if(id)node.querySelector('[data-practical="'+id+'"]')?.focus({preventScroll:true});
}
