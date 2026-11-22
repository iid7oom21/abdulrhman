export const initialWing=[-42,-42,0,0,45,45,12,53];
export const loopLimit=18;

export function bounded(value,lo,hi,neutral) {
  return Number.isFinite(value)?Math.max(lo,Math.min(hi,Math.round(value))):neutral;
}
export function forcedProjection(cupCm,towerCm) {
  const point=(cm,x,y)=>[320+320*x/cm,163+320*(16-y)/cm];
  const cup=point(cupCm,4,36),roof=point(towerCm,24,136);
  return {cup,roof,cupFoot:point(cupCm,4,0)[1],towerFoot:point(towerCm,24,0)[1],
    gap:Math.hypot(roof[0]-cup[0],roof[1]-cup[1])};
}
export const seamColumns=[160,320,480];
export function matteCheck({real,paint,seam}) {
  return { gridGap:Math.hypot(real.x-paint.x,real.y-paint.y),windowGap:Math.abs(real.size-paint.size),
    clipped:seamColumns[seam]<480 };
}
export function wingGaps(angles) {
  return angles.map((v,i)=>Math.abs(v-angles[(i+1)%angles.length]));
}
export const defaultCostumes=[{length:1,shoulder:1,prop:0},{length:1,shoulder:1,prop:0},{length:2,shoulder:2,prop:1}];
export const costumeRoles=[['حارسة المحطة','Station keeper'],['رسّامة الخرائط','Cartographer'],['قائدة الفرقة','Conductor']];
export const silhouetteWidths=[80,48,32,20,12,8];
export function overlap(a,b) {
  let union=0,intersection=0;
  for(let i=0;i<a.length;i++) {
    if(a[i]||b[i])union++;
    if(a[i]&&b[i])intersection++;
  }
  return union ? intersection/union : 1;
}
