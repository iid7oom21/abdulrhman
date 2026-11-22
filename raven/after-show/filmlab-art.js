import {inkScene,gridPoint,stonePixel,stoneTile,splitFrame} from './filmlab-model.js';

const W=640,H=308;
function fill(c,color,x,y,w,h){c.fillStyle=color;c.fillRect(x,y,w,h);}
function ellipse(c,x,y,rx,ry,color) {c.beginPath();c.ellipse(x,y,rx,ry,0,0,2*Math.PI);c.fillStyle=color;c.fill();}
function path(c,pts,color,closed=false,width=1) {
  c.beginPath();pts.forEach(([x,y],i)=>i===0?c.moveTo(x,y):c.lineTo(x,y));
  if(closed){c.closePath();c.fillStyle=color;c.fill();}else{c.strokeStyle=color;c.lineWidth=width;c.stroke();}
}
function grad(c,x,y,X,Y,stops){
  const g=c.createLinearGradient(x,y,X,Y);stops.forEach((s,i)=>g.addColorStop(i/(stops.length-1),s));return g;
}
function glow(c,x,y,r,colors) {
  const g=c.createRadialGradient(x,y,0,x,y,r);colors.forEach((s,i)=>g.addColorStop(i/(colors.length-1),s));return g;
}
function grain(c,alpha=.12){
  // Static grain, anchored to the physical frame. Playback never flickers.
  c.save();c.globalAlpha=alpha;
  let seed=471;for(let i=0;i<2350;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0; const x=(seed>>>9)%W;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;fill(c,i%3?'#fff7da':'#041824',x,(seed>>>9)%H,1.4,1);}
  c.restore();
}
function filmEdges(c) {
  for(const y of [0,285]){
    fill(c,'#0e1720',0,y,640,23);
    for(let i=0;i<19;i++){c.beginPath();c.roundRect(i*36+7,y+6,19,11,3);c.fillStyle='#b9b8a4';c.fill();}
  }
}
export function drawInk(c,s,showGrid) {
  fill(c,grad(c,0,0,640,308,['#0b1a2c','#234659','#142331']),0,0,W,H);
  fill(c,glow(c,282,156,248,['#5c74726e','#0e1a3500']),0,0,W,H);
  for(let i=0;i<9;i++){c.save();c.translate(0,27*i-50);path(c,[[0,60],[235,110],[415,88],[640,153]],'#b0d2c418');c.restore();}
  const {trace,orb}=inkScene(s,s.frame),points=trace.map(p=>[p.x,p.y]);
  function drawTrace() {
    c.save();c.lineJoin='round';c.lineCap='round';c.shadowColor='#f4ae54';c.shadowBlur=7;
    path(c,points,'#cc873d',false,4);c.shadowBlur=0;path(c,points,'#ffe4a0',false,1.7);
    const last=trace.at(-1);ellipse(c,last.x,last.y,3,3,'#fff4c1');c.restore();
  }
  if(s.masks[s.frame])drawTrace();
  ellipse(c,orb.x+4,orb.y+orb.r-1,35,6,'#101f2c77');
  const sphere=glow(c,orb.x-15,orb.y-18,74,['#e6cf9e','#b28f6b','#5c514c','#22313b']);
  ellipse(c,orb.x,orb.y,orb.r,orb.r,sphere);
  c.save();c.beginPath();c.arc(orb.x,orb.y,orb.r,0,Math.PI*2);c.clip();
  for(let i=0;i<7;i++){c.beginPath();c.ellipse(orb.x-11+i*4,orb.y-2,28+i*5,49,-.48,0,Math.PI*2);c.strokeStyle='#e7c28c45';c.lineWidth=.9;c.stroke();}c.restore();
  if(!s.masks[s.frame])drawTrace();
  if(showGrid)for(let i=0;i<15;i++){const {x,y}=gridPoint(i);path(c,[[x-5,y],[x+5,y]],'#cedfcd8c');path(c,[[x,y-5],[x,y+5]],'#cedfcd8c');}
  grain(c);filmEdges(c);
}
const tileCache=new Map();
function swatch(s) {
  const key=[s.base,s.vein,s.repeat,s.wear,s.stagger].join('/');
  if(tileCache.has(key))return tileCache.get(key);
  const buf=document.createElement('canvas');buf.width=360;buf.height=174;
  const ctx=buf.getContext('2d'), image=ctx.createImageData(buf.width,buf.height);
  const rows=Math.max(1,Math.round(s.repeat/2));
  for(let y=0;y<buf.height;y++)for(let x=0;x<buf.width;x++){
    const u=(x+.5)*s.repeat/buf.width,v=(y+.5)*rows/buf.height;
    const rgb=stonePixel(s,u%1,v%1,stoneTile(s,Math.floor(u),Math.floor(v)));
    const off=4*(y*buf.width+x);image.data[off]=rgb[0];image.data[off+1]=rgb[1];image.data[off+2]=rgb[2];image.data[off+3]=255;
  }
  ctx.putImageData(image,0,0);if(tileCache.size>30)tileCache.clear();tileCache.set(key,buf);return buf;
}
function board(c,s,x,y,w,h){
  c.save();c.shadowColor='#0d130f99';c.shadowBlur=10;c.shadowOffsetY=7;
  fill(c,'#705b42',x,y+2,w,h+4);c.restore();
  c.drawImage(swatch(s),x,y,w,h);
  fill(c,grad(c,x,y,x+w,y+h,['#fff7d916','#ffffff00','#29271618']),x,y,w,h);
}
export function drawStone(c,s) {
  fill(c,grad(c,0,0,640,308,['#8b7157','#705746','#483c34']),0,0,W,H);
  for(let i=0;i<115;i++) {
    const y=i*2.8;path(c,[[0,y],[110,y+Math.sin(i)*2],[281,y-2],[482,y+3],[640,y+1]],i%3?'#4e3e343c':'#bb9a6a41');
  }
  if(s.near) board(c,s,28,19,584,247); else {
    // The clapper-like matte is fixed so changes in pattern scale can be judged consistently.
    fill(c,'#2f352f',82,24,476,252);fill(c,'#cab997',95,34,450,226);
    board(c,s,124,51,392,189);
    fill(c,'#84745c',145,242,350,3);
  }
  c.save();c.translate(27,282);c.rotate(-.016);fill(c,'#cba778',0,0,585,20);
  for(let i=0;i<115;i++){const x=i*5;fill(c,'#5b483a',x,0,1,i%10===0?12:i%5===0?8:4);}
  c.restore();grain(c,.075);
}
export function sampleBoard(c,s) {c.clearRect(0,0,240,112);c.drawImage(swatch(s),0,0,240,112);}
function person(c,x,y,mirror,hand) {
  c.save();c.translate(x,y);c.scale(mirror,1);
  // The same coat, profile and posture are recorded twice; only the hand timing differs.
  ellipse(c,-11,46,30,10,'#151e20');
  path(c,[[-33,40],[-23,-1],[-13,-11],[7,-8],[17,0],[23,41]],grad(c,-30,-15,22,44,['#58616a','#38434a','#202b33']),true);
  path(c,[[-13,-10],[-7,10],[2,0],[8,-7]],'#bcad93',true);
  ellipse(c,-4,-28,14,19,'#ba9172');path(c,[[4,-26],[14,-22],[10,-19],[8,-17]],'#ba9172',true);
  path(c,[[-19,-27],[-18,-39],[-13,-47],[1,-48],[12,-40],[12,-34],[4,-36],[-1,-32],[-9,-33],[-12,-24],[-17,-19]],'#292b2b',true);
  const dx=(hand-x)*mirror;
  path(c,[[9,1],[17,5],[dx*.48,26],[dx-3,23]],'#47535a',false,8);
  path(c,[[dx-5,23],[dx+2,22],[dx+7,24]],'#d1a888',false,4);c.restore();
}
function cafe(c) {
  fill(c,grad(c,0,0,0,220,['#202d30','#4c514b','#8b7360']),0,0,640,308);
  for(let i=0;i<6;i++){const x=16+i*106;fill(c,'#36423f',x,26,94,104);fill(c,grad(c,x,20,x+63,131,['#2d4e59','#45606a','#a1937b']),x+5,31,84,93);
    fill(c,'#58635a',x+44,31,4,93);fill(c,'#59615a',x+5,77,84,3);}
  for(const x of [66,574]){path(c,[[x,0],[x,32]],'#292e2a',false,2);
    path(c,[[x-19,42],[x-5,30],[x+5,30],[x+19,42]],'#b49669',true);ellipse(c,x,43,15,3,'#f5dcb0');}
  fill(c,'#4a4540',0,139,640,9);fill(c,'#635348',0,149,640,70);
  for(let i=0;i<16;i++)fill(c,'#514b42',i*42,151,2,69);
  ellipse(c,320,59,20,20,'#373f3b');ellipse(c,320,59,16,16,'#d2bea0');
  path(c,[[320,48],[320,59],[329,63]],'#4a5146',false,1.8);
  for(const x of [222,418]){fill(c,'#403b36',x-34,188,65,12);fill(c,'#594539',x-31,140,8,60);fill(c,'#594539',x-24,229,6,42);}
  fill(c,grad(c,0,215,0,308,['#433e37','#2a302e']),0,215,640,93);
  path(c,[[62,205],[578,205],[600,225],[40,225]],'#a08363',true);fill(c,'#664e3c',40,225,560,8);
  fill(c,'#564638',93,233,11,75);fill(c,'#564638',536,233,11,75);
}
function cup(c,x){c.save();c.translate(x,199);
  ellipse(c,0,4,11,2.5,'#52463866');c.beginPath();c.arc(7,-5,4,0,2*Math.PI);c.lineWidth=2;c.strokeStyle='#eedcba';c.stroke();
  path(c,[[-7,-10],[7,-10],[5,0],[-4,0]],'#e8d6b5',true);ellipse(c,0,-10,7,2,'#ab8d69');c.restore();}
export function drawSplit(c,s,playing) {
  cafe(c);
  const v=splitFrame(s,s.frame);
  function take(side,x) {const anchor=side===0?239:401;const hand=side===0?Math.max(251,Math.min(326,x-7)):Math.min(389,Math.max(314,x+7));person(c,anchor,171,side===0?1:-1,hand);cup(c,x);}
  if(s.view===0) {
    c.save();c.beginPath();c.rect(0,0,v.seam,308);c.clip();take(0,v.left);c.restore();
    c.save();c.beginPath();c.rect(v.seam,0,640-v.seam,308);c.clip();take(1,v.right);c.restore();
    if(!playing){c.setLineDash([4,5]);path(c,[[v.seam,16],[v.seam,283]],'#f4cd80',false,1.5);c.setLineDash([]);}
  }else take(s.view-1,s.view===1?v.left:v.right);
  grain(c,.09);
}
const palettes=[
 ['#998d7b','#5d655d','#bcac92','#776b5d'],['#a28d70','#6b5f4d','#c1b29e','#6b6051'],
 ['#75918e','#4a6869','#9cafa7','#526760'],['#b29c89','#776859','#d0b59a','#76675c'],
 ['#8898a4','#50606e','#b2c0c2','#606a6d']
];
function doorway(c,x,y,w,h,light) {
  fill(c,'#3c423c',x-5,y-5,w+10,h+5);fill(c,grad(c,x,y,x+w,y+h,['#283632',light,'#4e5146']),x,y,w,h);
  path(c,[[x+2,y+2],[x+w*.66,y+8],[x+w*.66,y+h-5],[x+2,y+h]],'#444e48',true);
  ellipse(c,x+w*.56,y+h*.62,1.8,2,'#d7bd7b');
}
export function drawMuseum(c,room,ending) {
  const p=palettes[room], v=room<3?292+room*25:314;
  fill(c,grad(c,0,0,0,308,[p[0],p[2],p[3]]),0,0,640,308);
  path(c,[[0,0],[143,55],[143,209],[0,308]],p[1],true);
  path(c,[[640,0],[501,55],[501,209],[640,308]],p[1],true);
  fill(c,p[0],143,55,358,154);
  path(c,[[0,308],[143,208],[501,208],[640,308]],grad(c,0,200,0,308,[p[3],p[0]]),true);
  for(let i=0;i<12;i++)path(c,[[v,150],[i*90-160,308]],'#403e3937');
  for(const y of [220,239,267,300])path(c,[[0,y],[640,y]],'#c4b8a84f');
  for(const x of [163,244,395,476]){fill(c,'#423e3529',x,63,6,147);fill(c,'#ece3c744',x-1,64,2,144);}
  for(let i=0;i<4;i++){const x=84-i*31;path(c,[[x,32-i*11],[x,245+i*19]],'#cac7b247',false,1.7);path(c,[[640-x,32-i*11],[640-x,245+i*19]],'#cac7b247',false,1.7);}
  if(room<3){
    doorway(c,189,99,46,108,'#d1b085');doorway(c,405,99,46,108,'#a8bab2');
    fill(c,'#514c44',278,89,84,66);fill(c,'#c1ad90',282,93,76,58);
    if(room===0)path(c,[[286,147],[306,115],[323,139],[341,111],[353,147]],'#6b7977',true);
    if(room===1){for(let i=0;i<4;i++)ellipse(c,298+i*13,119,6,17-i*2,['#718680','#ccb385','#6d7371','#9c8068'][i]);}
    if(room===2){for(let i=0;i<4;i++)path(c,[[288,103+i*10],[350,111+i*9]],'#426667',false,4);}
    fill(c,'#ac9678',262,173,118,5);fill(c,'#7c705f',270,178,5,27);fill(c,'#7c705f',367,178,5,27);
  }else{
    fill(c,'#4c514b',250,85,140,120);fill(c,grad(c,250,80,390,205,['#adac9c','#617f84','#a89b84']),255,90,130,110);
    if(ending===0){ellipse(c,325,126,20,20,'#d6b887');path(c,[[255,192],[290,145],[322,169],[354,142],[385,187],[385,202],[255,202]],'#5d7071',true);}
    if(ending===1){for(let i=0;i<5;i++){const x=263+i*23;path(c,[[x,195],[x+14,145-i%3*8],[x+20,195]],'#526f67',true);}}
    if(ending===2){for(let i=0;i<4;i++){const x=266+i*28;ellipse(c,x,132+i%2*11,9,10,'#ddbd83');path(c,[[x,143+i%2*11],[x,196]],'#4b5e5d',false,2);}}
  }
  fill(c,glow(c,312,2,250,['#e9d6a74d','#edd9b300']),0,0,640,308);
  grain(c,.14);
}
