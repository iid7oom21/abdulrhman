// Geometric room reflection through a mirror source, using a back wall at x=24 m.
export function pulse(source,seat,curtain){
  const sx=Math.max(1,Math.min(21,source)),receiver=[[5,3],[9,6],[14,9]][seat]||[5,3],sy=2,wall=24;
  const direct=Math.hypot(sx-receiver[0],sy-receiver[1]),mirror=2*wall-sx;
  const reflected=Math.hypot(mirror-receiver[0],sy-receiver[1]);
  const wallY=sy+(receiver[1]-sy)*(wall-sx)/(mirror-receiver[0]);
  const gap=(reflected-direct)/343*1000,ratio=(curtain ? 0.24 : 0.87)*(1+direct*.055)/(1+reflected*.055);
  return {sx,sy,receiver,wallY,direct,reflected,gap,ratio,directMs:direct/343*1000,echoMs:reflected/343*1000,success:gap>=48&&ratio>=.24};
}
// A 90-second fictional harbour tide, dropping through the middle of the programme.
export const water=t=>2.5+1.30*Math.cos((t-12)*Math.PI*2/90);
export function crossing(start,screen,berth){
  const at=start+(berth?16:12),arrive=at+(berth?11:8),sill=5.8,clear=sill-water(at)-screen;
  return {at,arrive,water:water(at),clear,deadline:68,success:clear>=0&&arrive<=68};
}
export function clothVertex(u,v,seconds,cfg){
  const {left,right,weight,fan}=cfg;
  const span=Math.max(95,right-left),gust=fan*(.66+.34*Math.sin(seconds*2.37)+.13*Math.sin(seconds*5.1));
  // The hems are pinned at the top corners. Slack and lateral folding grow away from each pin.
  const slack=Math.sin(Math.PI*u),edge=Math.sin(Math.PI*u)*.5+.5;
  const fold=gust/(weight*.75+.4),wave=Math.sin(2*Math.PI*u+seconds*2.4);
  return [left+span*u+fold*47*Math.sin(2*Math.PI*u+seconds*2.2)*slack*(.4+.6*v)+fold*9*v,
    54+slack*(225/span)*13*weight+v*(77+weight*11)+fold*13*wave*slack*v+fold*5*edge*v];
}
export function clothVisibility(time,cfg){
  // A motif is exposed only if all sampled horizontal strips face the audience and clear the parade arch.
  const area=(.32*(cfg.right-cfg.left))*(.42*(77+11*cfg.weight));
  let actual=0;let clear=true;
  for(let y=0;y<4;y++)for(let x=0;x<5;x++){
    const u=.34+x*.32/5,v=.30+y*.42/4,p=clothVertex(u,v,time,cfg),r=clothVertex(u+.32/5,v,time,cfg),b=clothVertex(u,v+.42/4,time,cfg);
    const signed=(r[0]-p[0])*(b[1]-p[1])-(r[1]-p[1])*(b[0]-p[0]);
    actual+=Math.max(0,signed);
    if(signed<=0||p[0]<147||r[0]>482||Math.max(p[1],r[1],b[1])>166)clear=false;
  }
  return {ratio:Math.min(1,actual/area),clear:clear&&actual>=area*.62};
}
export function clothRun(cfg){
  let best=0,current=0,total=0;
  const bands=[];
  for(let i=0;i<60;i++){
    const time=2+(i+.5)/10,visible=clothVisibility(time,cfg).clear;
    bands.push(visible);current=visible?current+1:0;best=Math.max(best,current);if(visible)total++;
  }
  return {best:best/10,total:total/10,bands,success:best>=20};
}
