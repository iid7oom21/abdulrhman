export const ending = ['بقي شيءٌ من الليل على الورق.','A little of the night stayed on the paper.'];
export const panels = [
  {id:'window', title:['النافذة','The window'], alt:['وراء زجاج المطبعة، يربط قارب صغير الرصيف بآخر الليل.','A small boat rests at the quay beyond the print shop window.']},
  {id:'type', title:['قالب الطباعة','Setting the type'], alt:['يد تجمع قوالب معدنية محفورة في مسطرة التنضيد.','A hand sets engraved metal blocks into a composing stick.']},
  {id:'press', title:['دورة المكبس','A turn of the press'], alt:['يمسك العامل مقبض المكبس وتدور العجلة بجانب كتفه.','The printmaker turns the handle beside the press flywheel.']},
  {id:'drying', title:['الطبعة المعلّقة','The drying print'], alt:['تتدلّى طبعة قارب من مشبكين عند النافذة مع ضوء الصباح.','Two clips hold a print of a boat at the window in the morning light.']}
];
export const findPanel = id => panels.find(panel => panel.id === id);
export function checkedSelection(data) {
  return Array.isArray(data?.panels) && data.panels.length === 3 &&
    new Set(data.panels).size === 3 && data.panels.every(id => findPanel(id)) &&
    ['rtl','ltr'].includes(data.direction) && typeof data.caption === 'boolean';
}
