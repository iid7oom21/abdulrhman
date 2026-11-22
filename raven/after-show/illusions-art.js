import {forcedProjection,overlap,silhouetteWidths,seamColumns} from './illusions-rules.js';

const W=640,H=308;
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function gradient(c,x,y,x2,y2,...colors){
  const g=c.createLinearGradient(x,y,x2,y2);colors.forEach((col,i)=>g.addColorStop(i/(colors.length-1),col));return g;
}
function polygon(c,points,color){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();
}
function stroke(c,points,color,width=1){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function ellipse(c,x,y,rx,ry,color) {
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();
}
function texture(c,seed,strength){
  c.save();c.globalAlpha=strength;
  for(let i=0;i<3000;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%640;
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    rect(c,x,seed%308,1+seed%3,1,seed&4?'#fff5ce':'#040a13');
  }
  c.restore();
}
function building(c,left,top,bottom,width){
  const depth=width*.18;
  polygon(c,[[left+width,top],[left+width+depth,top-6],[left+width+depth,bottom-5],[left+width,bottom]],'#586270');
  rect(c,left,top,width,bottom-top,gradient(c,left,0,left+width,0,'#cec8b7','#a0aaba','#d2cfc5'));
  polygon(c,[[left-4,top],[left+depth,top-7],[left+width+depth+2,top-7],[left+width+4,top]],'#e5dbc6');
  rect(c,left-3,top,width+6,3,'#8c9294');
  const step=(bottom-top)/7;
  for(let i=0;i<6;i++){
    for(let j=0;j<4;j++){
      const x=left+(j+.5)*width/4.2,y=top+(i+.66)*step;
      rect(c,x,y,width*.098,step*.55,(i+j)%4===1?'#dfbb77':'#546574');
      rect(c,x,y,width*.016,step*.55,'#ded5bc');
    }
    rect(c,left,top+(i+1)*step,width,1,'#868d90');
  }
}
function cup(c,right,top,bottom,width){
  const height=bottom-top,x=right-width*.52;
  c.save();c.translate(x,top);c.scale(width/140,height/110);
  c.beginPath();c.ellipse(-63,43,29,27,-.15,0,Math.PI*2);c.lineWidth=10;c.strokeStyle='#8ab1aa';c.stroke();
  c.beginPath();c.moveTo(-68,0);c.bezierCurveTo(-66,61,-55,107,-25,109);c.quadraticCurveTo(3,116,37,106);c.bezierCurveTo(58,91,65,50,69,0);c.closePath();
  c.fillStyle=gradient(c,-70,0,70,0,'#2f5862','#779d9d','#d1d8bd','#9bb8ad','#537779');c.fill();
  ellipse(c,0,0,69,11,'#e9e2c5');ellipse(c,0,-.5,64,8,'#41676b');
  ellipse(c,1,1.6,56,5,'#354d51');c.restore();
}
function cross(c,pt,col,style){
  const [x,y]=pt;stroke(c,[[x-8,y],[x+8,y]],col,2);stroke(c,[[x,y-8],[x,y+8]],col,2);
  if(style){c.strokeStyle=col;c.lineWidth=1;c.strokeRect(x-10,y-10,20,20);}
}
export function drawScale(c,values,side=false,guides=true){
  const {cupCm,towerCm}=values, p=forcedProjection(cupCm,towerCm);
  rect(c,0,0,W,H,gradient(c,0,0,0,H,'#111e32','#374b5d','#142839'));
  if(side){
    const baseline=224, unit=.60, cupX=63+cupCm*.72,bldX=63+towerCm*.72;
    rect(c,14,baseline+1,613,18,gradient(c,0,baseline,0,baseline+20,'#b69976','#695b50'));
    for(let i=0;i<=8;i++){
      const x=63+72*i;
      stroke(c,[[x,baseline+18],[x,baseline+27]],'#d6c099',1);
    }
    building(c,bldX,baseline-136*unit,baseline,54);
    cup(c,cupX,baseline-36*unit,baseline,32);
    rect(c,32,baseline-18,27,15,'#6e8e9a');
    polygon(c,[[59,baseline-17],[68,baseline-20],[68,baseline-4],[59,baseline-7]],'#dfd1aa');
    const origin=[63,baseline-16*unit];
    c.save();c.setLineDash([6,5]);
    stroke(c,[origin,[bldX,baseline-136*unit]],'#e8b28d',1.5);
    stroke(c,[origin,[cupX,baseline-36*unit]],'#a6d5d7',1.5);
    c.restore();texture(c,81,.12);return;
  }
  const horizon=163;
  rect(c,0,horizon,W,H-horizon,gradient(c,0,horizon,0,H,'#8999a3','#5c7483','#2f4a5c'));
  for (let i=0;i<13;i++) {
    const left=14+i*53, h=14+((i*79)%40);
    rect(c,left,horizon-h,37,h,'#748495');rect(c,left+30,horizon-h+2,11,h-2,'#61788a');
  }
  for(const x of [-350,-120,120,410,690,950])stroke(c,[[305,horizon],[x,308]],'#566d7c',1);
  const towerWidth=320*90/towerCm, cupWidth=320*39/cupCm;
  building(c,p.roof[0],p.roof[1],p.towerFoot,towerWidth);
  ellipse(c,p.cup[0]-cupWidth*.46,p.cupFoot+4,cupWidth*.78,10,'#344e5d');
  cup(c,p.cup[0],p.cup[1],p.cupFoot,cupWidth);
  texture(c,99,.065);
  if(guides){cross(c,p.roof,'#fdc183',true);cross(c,p.cup,'#b1ebef',false);}
}

function lobby(c,v,painted) {
  rect(c,0,0,W,H,gradient(c,0,0,0,H,painted?'#776759':'#87796b','#bcae96','#5b554e'));
  const vx=v.x,vy=v.y,baseH=228;
  polygon(c,[[0,0],[vx,vy],[0,baseH+45]],painted?'#7e6d5f':'#8c7d6e');
  polygon(c,[[640,0],[vx,vy],[640,baseH+45]],painted?'#9c8773':'#a38f79');
  polygon(c,[[0,baseH],[vx,vy],[640,baseH],[640,308],[0,308]],gradient(c,0,baseH,0,308,'#d7cab2','#b0a798','#6f685f'));
  for(let x=-400;x<1300;x+=140)stroke(c,[[vx,vy],[x,308]],'#827b71',1.1);
  for(let y=183;y<330;y+=((y-160)*.52+6))stroke(c,[[0,y],[640,y]],'#91877b',1);
  for(let i=0;i<8;i++){
    const x=i*94-12, dist=Math.min(1,Math.abs(x-vx)/360);
    const w=24+v.size*.30+8*dist;
    const rows=painted?2:1;
    for(let row=0;row<rows;row++){
      const y=vy-37-dist*42-row*49;
      rect(c,x,y,w,32,painted?'#504c49':'#65594f');
      c.beginPath();c.arc(x+w/2,y,w/2,Math.PI,Math.PI*2);c.fillStyle=painted?'#514f4c':'#65594f';c.fill();
      rect(c,x+4,y+2,w-8,25,gradient(c,x,y,x+w,y+24,'#adb3aa','#737b78','#cdbda5'));
      rect(c,x+w*.48,y-2,2,30,'#83725b');
      rect(c,x-4,y+29,w+8,3,'#dec9a5');
    }
  }
  for(const x of seamColumns){
    rect(c,x-4,58,10,166,gradient(c,x-4,0,x+6,0,'#a4937e','#f0dfbc','#8b7961'));
    rect(c,x-9,54,20,6,'#dcccab');rect(c,x-8,220,18,5,'#c9b89b');
  }
  texture(c,painted?781:999,painted?.18:.07);
}
function cart(c,progress){
  const x=85+4.1*progress;
  rect(c,x-29,196,46,29,'#6c4e36');rect(c,x-28,195,44,4,'#b28b55');
  rect(c,x-20,181,27,15,'#ad906a');rect(c,x-15,178,17,3,'#6c523a');
  rect(c,x-30,226,56,4,'#d8c399');
  stroke(c,[[x+20,224],[x+20,169],[x+12,166]],'#b69c66',3);
  ellipse(c,x-19,234,5,5,'#443e39');ellipse(c,x+15,234,5,5,'#443e39');
}
function grids(c,v,col){
  c.save();c.setLineDash([6,5]);for(const x of [-230,100,570,900])stroke(c,[[v.x,v.y],[x,308]],col,1);
  stroke(c,[[0,v.y],[W,v.y]],col,1);c.restore();cross(c,[v.x,v.y],col,false);
}
export function drawMatte(c,{real,paint,seam,cartPosition,gridsOn,wipe,reveal}){
  lobby(c,real,false);
  const split=reveal?Math.round(640*wipe/100):seamColumns[seam];
  c.save();c.beginPath();c.rect(split,0,W-split,H);c.clip();lobby(c,paint,true);c.restore();
  c.save();c.beginPath();c.rect(0,0,reveal?480:Math.min(480,split),H);c.clip();cart(c,cartPosition);c.restore();
  if(gridsOn && !reveal){grids(c,real,'#a3eef0');grids(c,paint,'#ffbd80');}
  if(reveal)stroke(c,[[split,0],[split,H]],'#f7e9b9',3);
}
export function drawBird(c,angle,x=320,y=155,scale=1){
  c.save();c.translate(x,y);c.scale(scale,scale);
  const rad=angle*Math.PI/180, wing=[-42+Math.sin(rad)*86,-24-Math.cos(rad)*93];
  const far=[8+Math.sin(rad-.25)*66,-28-Math.cos(rad-.25)*73];
  polygon(c,[[2,-5],far,[35,2]],'#a69572');
  polygon(c,[[-72,9],[-107,30],[-48,20],[22,21],[72,-5],[57,-23],[21,-2]],'#e5d6ae');
  polygon(c,[[-64,10],[-99,-1],[-47,18],[4,18]],'#ad9475');
  polygon(c,[[51,-13],[69,-35],[77,-16],[66,-1]],'#f4e5b8');
  polygon(c,[[74,-23],[97,-16],[74,-15]],'#8c7655');
  polygon(c,[[-45,15],wing,[23,6]],'#ede0be');
  polygon(c,[wing,[-22,-1],[23,6]],'#bba781');
  stroke(c,[[-45,15],wing,[23,6]],'#736b59',1.3);
  stroke(c,[wing,[-22,-1],[-45,15]],'#9a896d',1);
  c.restore();
}
export function drawDrum(c,angles,frame,original=null){
  rect(c,0,0,W,H,gradient(c,0,0,W,H,'#302e2d','#555046','#303635'));
  rect(c,0,195,W,113,gradient(c,0,195,0,H,'#a18a65','#65543c','#3f342e'));
  for(let i=0;i<8;i++){const x=i*83-4;polygon(c,[[x+4,222],[x+76,221],[x+73,276],[x+3,278]],i===frame?'#f4ead2':'#c5b89a');drawBird(c,angles[i],x+38,254,.31);}
  if(original){
    stroke(c,[[320,14],[320,198]],'#968a73');
    drawBird(c,original[frame],169,148,.78);drawBird(c,angles[frame],471,148,.78);
  }else{ellipse(c,320,181,82,9,'#322f2a');drawBird(c,angles[frame],320,166,1.05);}
  texture(c,188,.10);
}
const palette=['#81635c','#617b71','#7d7082'];
export function figure(c,look,x,y,scale=1,role=0,mono=false){
  c.save();c.translate(x,y);c.scale(scale,scale);
  const ink=mono?'#161919':palette[role], shadow=mono?ink:'#51483f', cloth=mono?ink:'#ccb690';
  const shoulders=[18,28,38][look.shoulder], bottom=[70,95,116][look.length];
  ellipse(c,-1,-5,11,14,mono?ink:'#bda789');
  rect(c,-5,5,10,13,cloth);
  stroke(c,[[-10,53],[-13,105],[-15,125]],shadow,7);stroke(c,[[9,53],[13,104],[16,125]],shadow,7);
  const cap=look.shoulder===2?-6:look.shoulder===1?0:7;
  polygon(c,[[-8,12],[-shoulders,21+cap],[-shoulders-7,56],[-shoulders+1,57],[-15,37],[-12,51],[-23,bottom],[24,bottom],[12,50],[16,35],[shoulders+6,47],[shoulders+12,42],[shoulders,21+cap],[7,12]],ink);
  if(!mono){stroke(c,[[-8,15],[0,28],[7,15]],cloth,2);stroke(c,[[0,28],[2,bottom-4]],cloth,1);}
  const hand=shoulders+10;
  if(look.prop===1){
    stroke(c,[[hand,43],[hand+10,54]],cloth,2);rect(c,hand+1,54,20,24,cloth);
    if(!mono)rect(c,hand+4,58,13,14,'#b88d59');
  }else if(look.prop===2){
    polygon(c,[[hand-4,43],[hand+18,16],[hand+27,22],[hand+4,49]],cloth);
  }else if(look.prop===3){
    stroke(c,[[hand,43],[hand+27,9]],cloth,4);
  }
  c.restore();
}
function sampleLook(look,width){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=width*2;
  const c=canvas.getContext('2d',{willReadFrequently:true});
  figure(c,look,width*.48,width*.43,width/110,0,true);
  const pixels=c.getImageData(0,0,canvas.width,canvas.height).data,bits=new Uint8Array(canvas.width*canvas.height);
  for(let i=0;i<bits.length;i++)bits[i]=Number(pixels[i*4+3]>=94);
  return bits;
}
export function costumeTest(looks){
  const all=[];
  for(const width of silhouetteWidths){
    const samples=looks.map(l=>sampleLook(l,width));
    for(const [a,b] of [[0,1],[0,2],[1,2]])all.push({width,a,b,match:overlap(samples[a],samples[b])});
  }
  return all;
}
export function drawWardrobe(c,looks,{far,mono,order}){
  rect(c,0,0,W,H,gradient(c,0,0,W,H,'#aa9071','#d0ba90','#998167'));
  for(let x=0;x<W;x+=18)stroke(c,[[x,0],[x,H]],'#b49e7c',.6);
  for(let y=0;y<H;y+=18)stroke(c,[[0,y],[W,y]],'#b49e7c',.6);
  rect(c,0,238,W,70,gradient(c,0,238,0,308,'#63564a','#403c37'));
  const scale=far?.46:1.35, spacing=far?90:175;
  for(let i=0;i<3;i++){
    const x=320+(i-1)*spacing;
    ellipse(c,x,245,40*scale,4*scale,'#554c40');
    const role=order[i];figure(c,looks[role],x,244-125*scale,scale,role,mono);
    c.fillStyle='#fae9c9';c.textAlign='center';c.font='18px Georgia';c.fillText(['A','B','C'][i],x,275);
  }
  texture(c,819,.10);
}
