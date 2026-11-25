// A read-only itinerary. Every object can be examined with sound and artwork off.
export const beats = [
  {id:'ticket',object:'ticket'}, {id:'aisle',object:'seat'},
  {id:'deck',object:'tape'}, {id:'phone',object:'line'}, {id:'interval'}
];
export const options = ['play','hold','ask'];
export const validEnding = id => options.includes(id);
export const event = (kind,id) => ({kind,id});
export function approachEvents() {
  return beats.flatMap(({id,object})=>object ? [event('read',id),event('inspect',object)] : [event('read',id)]);
}
function validLog(actual,expected) {
  return Array.isArray(actual) && actual.length===expected.length && expected.every((row,i)=>
    actual[i]?.kind===row.kind && actual[i]?.id===row.id && Object.keys(actual[i]).length===2);
}
export const validCheckpoint = s => s?.version===1 && s.scene==='interval' && validLog(s.events,approachEvents());
export function endingEvents(id) {
  return [...approachEvents(),event('choose',id),event('perform',id),event('finish',id)];
}
export const validPiece = s => s?.version===1 && validEnding(s.ending) && validLog(s.events,endingEvents(s.ending));
