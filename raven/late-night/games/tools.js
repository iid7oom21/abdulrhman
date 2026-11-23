import {mount} from '../night-shell.js';
export function el(tag,text,cls){
  const element=document.createElement(tag);
  if(text!==undefined&&text!==null)element.textContent=text;
  if(cls)element.className=cls;
  return element;
}
export function button(key,text,click){
  const b=el('button',text);b.type='button';b.dataset.game=key;b.addEventListener('click',click);return b;
}
export function group(...children){
  const g=el('div',null,'game-controls');g.append(...children);return g;
}
export function canvas(label){
  const c=el('canvas',null,'game-art');c.width=640;c.height=320;c.setAttribute('role','img');c.setAttribute('aria-label',label);return c;
}
export function output(text){
  const p=el('p',text,'game-readout');p.setAttribute('role','status');return p;
}
export function start(id,slug,title,intro,render){
  mount({id:slug,title,intro,render});
}
export function box(c,color,x,y,w,h){c.fillStyle=color;c.fillRect(x,y,w,h);}
export function dot(c,color,x,y,r){
  c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
}
export function line(c,color,width,points){
  c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();
  points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();
}
export function gradient(c,first,last,w=640,h=320){
  const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,first);g.addColorStop(1,last);box(c,g,0,0,w,h);
}
export function keepButton(ui,label,piece){
  const control=button('keep',label,()=>{
    if(ui.savePiece(piece())){
      control.textContent=ui.t('حُفظت القطعة في دفترك','Saved to your notebook');
      control.disabled=true;
    }
  });
  return control;
}
