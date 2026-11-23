// Original scenic flats painted on a 720 × 330 stage.
const W=720,H=330;
function rect(c,x,y,w,h,col){c.fillStyle=col;c.fillRect(x,y,w,h);}
function line(c,x,y,xx,yy,col,w=2){c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
function circ(c,x,y,r,col){c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
function poly(c,pts,col){c.fillStyle=col;c.beginPath();c.moveTo(...pts[0]);pts.slice(1).forEach(p=>c.lineTo(...p));c.closePath();c.fill();}
function gradient(c,a,b){const g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,a);g.addColorStop(1,b);c.fillStyle=g;c.fillRect(0,0,W,H);}
function vignette(c){const g=c.createRadialGradient(350,130,65,360,180,430);g.addColorStop(0,'#10202600');g.addColorStop(1,'#07171c77');c.fillStyle=g;c.fillRect(0,0,W,H);}
function wood(c,x,y,w,h){rect(c,x,y,w,h,'#755843');for(let i=3;i<h;i+=6)line(c,x+(i*13)%17,y+i,x+w-((i*7)%29),y+i+1,i%2?'#8c6b4b':'#644c3a',.8);}
function person(c,x,y,size,col,arm=0){c.save();c.translate(x,y);c.scale(size,size);circ(c,0,-20,7,'#d9ad83');rect(c,-6,-13,13,22,col);line(c,-1,8,-7,23,'#293b40',4);line(c,4,8,9,23,'#293b40',4);line(c,5,-8,17,-6-arm,col,4);c.restore();}
export function lobby(c,era,changed){if(!c)return;
  gradient(c,['#4b655c','#627c76','#253d4b'][era],['#bc9a68','#bcaf89','#436465'][era]);
  rect(c,0,222,W,108,['#8f7657','#a09479','#6d7369'][era]);
  for(let x=-240;x<800;x+=75)line(c,350+(x-350)*.45,221,x,H,'#675f51',1);
  for(const y of [225,241,270,310])line(c,0,y,W,y,'#6e675a',1);
  for(const x of [66,193,320]){wood(c,x,35,104,145);rect(c,x+5,40,94,135,'#9aaca0');rect(c,x+8,43,88,129,era===2?'#244654':'#8baaa6');
    for(let n=0;n<5;n++){rect(c,x+8+n*17,126-(n*7)%31,13,44+(n*7)%31,era===2?'#1b3440':'#526e6b');if(era===2)rect(c,x+11+n*17,136,3,5,'#edc28a');}
    wood(c,x+49,40,5,135);wood(c,x+5,103,94,4);}
  wood(c,511,50,122,172);rect(c,520,56,105,165,'#506362');line(c,573,56,573,221,'#344344',4);
  const rugX=changed[2]?490:235;poly(c,[[rugX,237],[rugX+83,237],[rugX+105,278],[rugX-12,278]],era===2?'#927665':'#ad7c5f');
  for(let i=0;i<4;i++)line(c,rugX-3-i,246+i*8,rugX+88+i*4,246+i*8,'#d1a884',2);
  const cx=changed[0]?92:367,cy=207;wood(c,cx-18,cy-45,40,9);wood(c,cx-17,cy-38,5,31);wood(c,cx+17,cy-38,5,31);
  wood(c,cx-23,cy-10,51,8);wood(c,cx-20,cy-2,5,24);wood(c,cx+16,cy-2,5,24);
  if(era>0&&changed[0]){rect(c,cx-18,cy-11,39,4,era===1?'#a3b1a0':'#96b8ad');}
  const lx=changed[1]?471:41;line(c,lx,157,lx,226,'#41483e',4);rect(c,lx-13,225,26,4,'#4a4d3e');
  poly(c,[[lx-13,141],[lx+13,141],[lx+23,167],[lx-23,167]],era===2&&changed[1]?'#f2ca87':'#c6b084');
  if(era===2&&changed[1]){const g=c.createRadialGradient(lx,161,2,lx,161,61);g.addColorStop(0,'#ffe4a877');g.addColorStop(1,'#ffe4a800');c.fillStyle=g;c.fillRect(lx-63,97,126,126);}
  if(era>0&&changed[2])line(c,rugX+5,263,rugX+75,263,'#e9ca96',era===1?2:4);
  vignette(c);
}
const rooms=[[62,39],[215,39],[367,39],[519,39],[135,160],[293,160],[455,160]];
function apartment(c,i,x,y,p){
  c.save();c.translate(x,y);wood(c,-4,-4,110,95);rect(c,0,0,102,86,['#b08768','#827c6a','#a78d60','#af8b70','#9a8674','#83796c','#9f9b81'][i]);
  rect(c,0,60,102,26,'#65594a');rect(c,5,9,35,43,'#6c746a');rect(c,8,12,29,37,'#969a82');
  const a=Math.sin(p*3.5)*6;
  if(i===0){person(c,48,48,.75,'#334e4a',a);line(c,45,43,65,49,'#654126',4);line(c,54,37+a,63,54+a,'#e5d3af',2);}
  if(i===1){person(c,37,52,.7,'#47565a',a);wood(c,45,51,48,6);if(p%15<5)poly(c,[[48,48],[66,43+a/3],[57,51]],'#f6e4bd');}
  if(i===2){rect(c,14,50,73,7,'#594837');for(let j=0;j<6;j++)rect(c,24+j*8,42-j%3*5,6,9+j%3*5,'#d9c08d');person(c,74,48,.6,'#555e4f',a);}
  if(i===3){person(c,32,51,.72,'#365951',a);circ(c,68,52,9,'#4b5450');rect(c,54,63,32,3,'#d4b789');}
  if(i===4){for(let j=0;j<3;j++){rect(c,23+j*22,56,12,9,'#885f43');line(c,29+j*22,56,25+j*22+a/3,38,'#4b6852',3);}person(c,68,48,.55,'#9e785a',a);}
  if(i===5){person(c,33,52,.62,'#45595f',a);wood(c,44,57,45,5);circleClock(c,63,48,p);}
  if(i===6)person(c,64,47,.7,'#5d5246',a);
  line(c,50,0,50,85,'#53483b',3);line(c,0,6,102,6,'#bea580',2);wood(c,-7,85,116,5);c.restore();
}
function circleClock(c,x,y,p){circ(c,x,y,9,'#495859');circ(c,x,y,6,'#ddd3ab');line(c,x,y,x+Math.sin(p)*4,y-3,'#555346',1);}
// One trajectory belongs to the whole facade; a close shot samples that same path.
export function paperFlight(seconds) {
  const time=seconds%15;
  if(time<5 || time>10)return null;
  const u=(time-5)/5;
  return {x:279+305*u,y:87+119*u-Math.sin(u*Math.PI)*31};
}
function airborne(c,pos,origin=[0,0]){
  if(!pos)return;
  const x=pos.x-origin[0],y=pos.y-origin[1];
  poly(c,[[x,y],[x-19,y-6],[x-8,y+3]],'#f6e5b5');
}
export function windows(c,focus=-1,phase=0){
  if(!c)return;
  gradient(c,'#1a3442','#385052');
  if(focus>=0){
    // The edited close-ups of the child and recipient begin at their respective narrative moments.
    const time=phase+(focus===1?3:focus===6?8:0);
    c.save();c.translate(114,18);c.scale(4.55,3.36);
    apartment(c,focus,0,0,time);
    c.beginPath();c.rect(0,0,102,86);c.clip();airborne(c,paperFlight(time),rooms[focus]);c.restore();
    vignette(c);return;
  }
  rect(c,41,12,637,302,'#58635c');for(let y=17;y<302;y+=9)line(c,42,y,674,y,'#61695f',.7);
  for(let i=0;i<7;i++)apartment(c,i,...rooms[i],phase);
  wood(c,27,5,660,9);wood(c,37,143,640,9);rect(c,40,285,638,32,'#414d47');
  airborne(c,paperFlight(phase));vignette(c);
}
export function theater(c,times,sec,back=false){if(!c)return;gradient(c,'#182932','#475753');rect(c,43,37,634,218,sec>=times[1]?'#798276':'#293b3d');
  wood(c,38,251,643,26);for(let x=35;x<690;x+=40)line(c,x,252,x-10,276,'#8d7052',1);
  const lit=sec>=times[1];
  if(lit)poly(c,[[355,39],[375,39],[499,250],[263,250]],'#d7c08b77');
  if(sec>=times[2]){const px=132+Math.min(1,(sec-times[2])/1.3)*250;person(c,px,189,2,'#42494b',3+Math.sin(sec*4)*4);line(c,px+7,174,px+40,153,'#8e684a',7);circ(c,px+12,181,12,'#a87d57');}
  const reveal=back?1:Math.min(1,Math.max(0,sec-times[0])/1.2),side=44+(1-reveal)*273;
  for(const left of [true,false]){const start=left?39:681-side;rect(c,start,28,side,220,'#6f3e38');for(let n=0;n<side;n+=12){rect(c,start+n,29,5,216,'#885047');line(c,start+n+7,36,start+n+4,240,'#583a36',2);}}
  wood(c,28,19,662,13);for(let x=10;x<723;x+=44){circ(c,x,322,21,'#1b2b31');circ(c,x+2,320,15,'#2f4241');}vignette(c);
}
export function museum(c,id,time=0,on=true){if(!c)return;
  gradient(c,'#243d43','#65736a');const p=on?time:0;
  rect(c,47,30,626,203,'#3e5555');rect(c,58,41,604,181,'#526662');wood(c,126,217,468,21);rect(c,156,238,407,64,'#534f43');
  if(id===0){wood(c,285,77,145,143);rect(c,295,87,125,121,'#5b706c');rect(c,310,111,92,13,'#192d2e');rect(c,328,124,52,17+Math.abs(Math.sin(p*3))*48,'#ddc690');line(c,419,121,460,90+Math.sin(p*3)*18,'#ad9469',8);circ(c,462,90+Math.sin(p*3)*18,8,'#594738');}
  if(id===1){poly(c,[[291,213],[308,119],[393,119],[419,213]],'#a48764');rect(c,329,172,36,41,'#53645a');c.save();c.translate(352,115);c.rotate(p*3);for(let i=0;i<4;i++){line(c,0,0,65,0,'#cfb78a',6);rect(c,27,-18,35,16,'#c5ad83');c.rotate(Math.PI/2);}c.restore();circ(c,352,115,11,'#74523a');}
  if(id===2){wood(c,280,207,153,9);line(c,298,205,298,71,'#a58e65',6);line(c,298,72,365,72,'#c2a474',6);c.save();c.translate(359,77);c.rotate(Math.sin(p*9)*Math.exp(-p)*.43);poly(c,[[0,0],[-9,15],[-23,69],[-39,82],[39,82],[23,69],[9,15]],'#ceb47d');circ(c,0,86,7,'#795a40');c.restore();}
  vignette(c);
}
export function theaterCard(c,title,lines){if(!c)return;gradient(c,'#213e44','#585847');
  for(let i=0;i<6;i++){line(c,35,29+i*3,685,29+i*3,'#a69670',1);line(c,35,283+i*3,685,283+i*3,'#a69670',1);}
  c.textAlign='center';c.fillStyle='#efe3bc';c.font='bold 34px system-ui';c.fillText(title,360,104,642);c.font='20px system-ui';lines.forEach((s,i)=>c.fillText(s,360,158+i*36,638));
}
