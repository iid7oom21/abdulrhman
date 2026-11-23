export function el(tag,txt,cls){const e=document.createElement(tag);if(txt!=null)e.textContent=txt;if(cls)e.className=cls;return e;}
export function button(key,label,fn){const b=el('button',label);b.type='button';b.dataset.creative=key;b.onclick=fn;return b;}
export function field(label,input){const l=el('label',null,'cr-field');l.append(el('span',label),input);return l;}
export function select(key,options,value,apply){const s=el('select');s.dataset.creative=key;for(const [v,lab] of options){const o=el('option',lab);o.value=v;s.append(o);}s.value=String(value);s.onchange=()=>apply(s.value);return s;}
export function range(key,v,min,max,step,fn){const s=el('input');s.type='range';s.min=min;s.max=max;s.step=step;s.value=v;s.dir='ltr';s.dataset.creative=key;s.oninput=()=>fn(+s.value);return s;}
export function words(key,value,hint,limit,fn){const s=el('input');s.type='text';s.value=value;s.placeholder=hint;s.maxLength=limit;s.dataset.creative=key;s.dir='auto';s.oninput=()=>fn(s.value);return s;}
export function row(...items){const out=el('div',null,'cr-row');out.append(...items);return out;}
export function output(){const n=el('p',null,'cr-status');n.setAttribute('role','status');return n;}
export function surface(ui){const n=el('div',null,'cr-desk');ui.root.replaceChildren(n);return n;}
export function stage(label){const c=el('canvas');c.width=640;c.height=300;c.setAttribute('role','img');c.setAttribute('aria-label',label);c.className='cr-stage';return c;}
export function clock(max,paint,onEnd){
  let frame=0,t=0,playing=false;
  const reduce=matchMedia('(prefers-reduced-motion:reduce)');
  function stop(){cancelAnimationFrame(frame);playing=false;}
  function seek(value){stop();t=Math.max(0,Math.min(max(),value));paint(t,false);}
  function play(){
    if(playing){seek(t);return;}
    if(t>=max())t=0;playing=true;const start=performance.now()-t*1000;let last=-1000;
    function tick(now){
      if(!playing)return;
      t=Math.min(max(),(now-start)/1000);
      if(t>=max()||now-last>(reduce.matches?400:33)){paint(t,playing&&t<max());last=now;}
      if(t>=max()){stop();onEnd?.();return;}
      frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);
  }
  return {seek,play,stop,get time(){return t;}};
}
export const clamp=(a,lo,hi)=>Math.max(lo,Math.min(hi,a));
export function choose(t,v){return Array.isArray(v)?t(...v):t(v.ar,v.en);}
export function link(href,label){const a=el('a',label,'cr-link');a.href=href;return a;}
