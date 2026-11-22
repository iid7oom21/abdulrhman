const seq = length => Array.from({length}, (_,i) => i);
const integer = (v, lo, hi, fallback) => Number.isInteger(v) && v >= lo && v <= hi ? v : fallback;
const values = (input, initial, lo, hi) => initial.map((v,i) => integer(input?.[i],lo,hi,v));
const object = v => v && typeof v === 'object' ? v : {};
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));

export function inkSettings(raw) {
  const v=object(raw);
  return {points:values(v.points,[5,2,12,9],0,14), masks:values(v.masks,seq(16).map(()=>0),0,1), frame:integer(v.frame,0,15,5)};
}
export function gridPoint(id) { return {x:100+id%5*110, y:64+Math.floor(id/5)*86}; }
export function inkPoint(points,frame) {
  const progress=clamp(frame,0,15)/5, i=Math.min(2,Math.floor(progress)), u=progress-i;
  const a=gridPoint(points[Math.max(i-1,0)]), b=gridPoint(points[i]);
  const c=gridPoint(points[i+1]), d=gridPoint(points[Math.min(i+2,3)]);
  function blend(k) {
    return .5*((2*b[k])+(-a[k]+c[k])*u+(2*a[k]-5*b[k]+4*c[k]-d[k])*u*u+(-a[k]+3*b[k]-3*c[k]+d[k])*u*u*u);
  }
  return {x:blend('x'),y:blend('y')};
}
export function inkScene(s,f) {
  const trace=seq(33).map(i=>inkPoint(s.points,Math.max(0,f-4+i/8)));
  const orb={x:187+f*16,y:143+24*Math.sin(f*Math.PI/15),r:41};
  const intersects=trace.some(p=>Math.hypot(p.x-orb.x,p.y-orb.y)<=orb.r);
  return {trace,orb,intersects,hidden:intersects&&s.masks[f]===1};
}

const stoneDefaults={base:0,vein:1,wear:1,repeat:3,stagger:0};
export function stoneRecipe(raw) {
  const v=object(raw);
  return Object.fromEntries(Object.entries(stoneDefaults).map(([k,d])=>[k,integer(v[k],k==='repeat'?1:0,k==='repeat'?5:k==='stagger'?1:2,d)]));
}
export function stoneSettings(raw) {
  const v=object(raw);
  return {...stoneRecipe(v),near:v.near===true, slots:[0,1].map(i=>v.slots?.[i] && typeof v.slots[i]==='object'?stoneRecipe(v.slots[i]):null), chosen:integer(v.chosen,0,1,null)};
}
export const stones=[[201,184,149],[130,157,147],[159,107,97]];
export function stoneTile(s,i,j) {return s.stagger?(i*2+j)%5:0;}
export function stonePixel(s,u,v,variant) {
  const x=u+(variant*.21),y=v+(variant*.13);
  const curl=y+.35*x+.08*Math.sin(10*x+4*y)+.031*Math.sin(28*x-5*y);
  const d=Math.abs(Math.sin(curl*(s.vein+2)*Math.PI));
  const branch=Math.abs(Math.sin((curl+.1*Math.sin(8*y)+.04*x)*11));
  const strata=8*Math.sin(10*curl)+4*Math.sin(25*x+12*y)+2*Math.sin(81*x-57*y);
  const vein=Math.exp(-d*d*120)*(s.vein+1)*12 + Math.exp(-branch*branch*390)*12;
  const edge=Math.min(u,1-u,v,1-v);
  const chip=edge<(.005+s.wear*.007)*(1+.45*Math.sin(29*(x+y))) ? 12+s.wear*10 : 0;
  return stones[s.base].map((c,k)=>clamp(Math.round(c+strata-vein-chip+(k===0?3:0)),0,255));
}
export function stoneReadings(s) {
  const rows=Math.max(1,Math.round(s.repeat/2)),variants=new Set(),samples=[];
  for(let j=0;j<rows;j++) for(let i=0;i<s.repeat;i++) {
    const variant=stoneTile(s,i,j);variants.add(variant);
    function sample(a,b){samples.push(a.reduce((sum,c,k)=>sum+Math.abs(c-b[k]),0)/3);}
    for(let n=1;n<=12;n++) {
      if(i+1<s.repeat)sample(stonePixel(s,.98,n/13,variant),stonePixel(s,.02,n/13,stoneTile(s,i+1,j)));
      if(j+1<rows)sample(stonePixel(s,n/13,.98,variant),stonePixel(s,n/13,.02,stoneTile(s,i,j+1)));
    }
  }
  const total=rows*s.repeat;
  return {duplicates:total-variants.size,total,seam:samples.length?Math.round(samples.reduce((a,b)=>a+b,0)/samples.length):0};
}

export function splitSettings(raw) {
  const v=object(raw);
  return {seam:integer(v.seam,42,58,50), offset:integer(v.offset,-5,5,3),frame:integer(v.frame,0,23,12), view:integer(v.view,0,2,0)};
}
export function splitFrame(s,f) {
  const seam=640*s.seam/100;
  // Each take has its own cup. The matte selects the left half of A and the right half of B.
  const left=182+clamp(f,0,23)*12, right=182+clamp(f-s.offset,0,23)*12;
  const visibleLeft=left<seam, visibleRight=right>=seam;
  return {left,right,seam,visibleLeft,visibleRight,count:Number(visibleLeft)+Number(visibleRight)};
}
export function splitReadings(s) {
  const counts=seq(24).map(f=>splitFrame(s,f).count);
  const handoff=seq(24).find(f=>!splitFrame(s,f).visibleLeft);
  return {gaps:seq(24).filter(f=>counts[f]===0),duplicates:seq(24).filter(f=>counts[f]===2),handoff};
}
export const initialDoors=[[1,2],[3,2],[1,4]];
export function branchSettings(raw) {
  const v=object(raw);
  return {doors:initialDoors.map((pair,i)=>values(v.doors?.[i],pair,0,4)),ends:values(v.ends,[0,1],0,2),room:integer(v.room,0,4,0),
    watching:v.watching===true,path:Array.isArray(v.path)?v.path.filter(x=>Number.isInteger(x)&&x>=0&&x<=4).slice(-40):[],
    runs:Array.isArray(v.runs)?v.runs.filter(p=>Array.isArray(p)&&p.length>1&&p.length<=40&&p.every(x=>Number.isInteger(x)&&x>=0&&x<=4)).slice(-2):[]};
}
export function examineMap(s) {
  function walk(start) {
    const seen=new Set(),todo=[start];
    while(todo.length) { const n=todo.pop(); if(seen.has(n))continue;seen.add(n); if(n<3)todo.push(...s.doors[n]); }
    return seen;
  }
  const reach=walk(0);
  const endings=[...new Set([...reach].filter(x=>x>=3).map(x=>s.ends[x-3]))];
  const trapped=[...reach].filter(n=>n<3 && ![...walk(n)].some(x=>x>=3));
  return {endings,trapped,unreachable:seq(5).filter(n=>!reach.has(n))};
}
