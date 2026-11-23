export const LENGTH=10000, ORIGIN={x:0,y:1}, PLATE={x:2,y:0};
export const onPlate=p=>p.x===PLATE.x&&p.y===PLATE.y;
export function positionAt(trace,ms) {
  let current=ORIGIN;
  for(const step of trace){if(step.ms>ms)break;current=step;}
  return {x:current.x,y:current.y};
}
export function move(p,dx,dy,open){
  const x=p.x+dx,y=p.y+dy;
  if(x<0||x>6||y<0||y>2)return p;
  if(x===5&&(y!==1||!open))return p;
  if(p.x===5&&y!==1)return p;
  return {x,y};
}
export function firstOpening(trace){return trace.find(step=>onPlate(step))?.ms??null;}
