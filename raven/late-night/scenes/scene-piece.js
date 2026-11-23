import {begin,thumbnail} from './ui.js';

const memory={};
export function recall(ui,init){return memory[ui.route] ||= init(ui.editData||{});}
export function record(ui,title,type,data,canvas,feedback,event){
  const piece=ui.savePiece({title,type,data,thumbnail:thumbnail(canvas)});
  if(piece&&event)ui.recordEvent(event);
  feedback.textContent=piece?ui.t('أُضيفت القطعة إلى دفتر أعمالك.','Added to your notebook.'):ui.t('تعذّر الحفظ على الجهاز. يمكنك تنزيل النسخة.','Device storage is unavailable. You can download a copy.');
  return piece;
}

export function scene(id,title,intro,draw) {
  return {id,title,intro,render(ui){begin(ui);draw({...ui,route:id});}};
}
