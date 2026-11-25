import {PLATE} from './station-model.js';

const WIDTH = 640;
const HEIGHT = 320;
const floor = (x, y) => [66 + 85 * x, 169 + 48 * y];

function stroke(ctx, color, width, points) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.stroke();
}

function ellipse(ctx, color, x, y, rx, ry) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function polygon(ctx, color, points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) ctx.lineTo(...p);
  ctx.closePath();
  ctx.fill();
}

function drawFloor(ctx, photograph) {
  if (photograph) {
    const h = photograph.naturalWidth * HEIGHT / WIDTH;
    ctx.drawImage(photograph, 0, (photograph.naturalHeight - h) / 2,
      photograph.naturalWidth, h, 0, 0, WIDTH, HEIGHT);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, '#182126');
    gradient.addColorStop(1, '#43423b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    for (let y = 0; y < 3; y++) {
      stroke(ctx, '#66635a', 1, [[23, floor(0, y)[1]], [617, floor(0, y)[1]]]);
    }
  }
  // Flush brass studs mark each available step on the wet concrete.
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 7; col++) {
      const [x, y] = floor(col, row);
      ellipse(ctx, '#28291f', x, y + 1, 4, 1.9);
      ellipse(ctx, '#b8aa88', x, y, 3, 1.05);
    }
  }
  const [exitX, exitY] = floor(6, 1);
  stroke(ctx, 'rgba(220,209,174,.85)', 2.4, [[exitX - 15,exitY + 6],[exitX + 10,exitY + 6],[exitX + 4,exitY + 2]]);
  stroke(ctx, 'rgba(220,209,174,.85)', 2.4, [[exitX + 10,exitY + 6],[exitX + 3,exitY + 11]]);
}

function drawPedal(ctx, open) {
  const [x, y] = floor(PLATE.x, PLATE.y);
  polygon(ctx, '#191c19', [[x-21,y-6],[x+20,y-6],[x+26,y+7],[x-27,y+7]]);
  polygon(ctx, '#8f8872', [[x-20,y-7],[x+19,y-7],[x+24,y+4],[x-25,y+4]]);
  polygon(ctx, '#4a4d43', [[x-18,y-5],[x+17,y-5],[x+21,y+2],[x-22,y+2]]);
  for (let i=-15;i<18;i+=5) stroke(ctx,'#b7b5a2',1,[[x+i,y-4],[x+i-2,y+1]]);
  stroke(ctx,open?'#abe3c4':'#f4c77a',2,[[x-23,y+5],[x+23,y+5]]);
}

function gate(ctx, open) {
  const [x, y] = floor(5, 1);
  const far = y-23, near = y+22;
  function post(px, base) {
    ellipse(ctx, 'rgba(10,13,11,.42)',px+3,base,6,2);
    const metal = ctx.createLinearGradient(px-2,0,px+3,0);
    metal.addColorStop(0,'#3e3d34'); metal.addColorStop(.38,'#c5b497'); metal.addColorStop(.63,'#8b826e'); metal.addColorStop(1,'#3c3f39');
    ctx.fillStyle = metal; ctx.fillRect(px-2.5,base-28,5,28);
    ellipse(ctx, '#afaa92',px,base-28,2.5,1.1);
  }
  const hingeX=x-5, latchX=x+5;
  post(hingeX,far);
  // A swinging iron gate releases the middle lane. Its hinge never moves.
  const endX=open?hingeX+31:latchX, endY=open?far+1:near;
  for(const h of [5,23]){
    stroke(ctx, '#242522', 3.8, [[hingeX,far-h],[endX,endY-h]]);
    stroke(ctx, h===23?'#c1a787':'#776f5c', 1.2, [[hingeX,far-h-1],[endX,endY-h-1]]);
  }
  for(let i=1;i<=4;i++){
    const px=hingeX+(endX-hingeX)*i/4, py=far+(endY-far)*i/4;
    stroke(ctx,'#605f52',1.7,[[px,py-22],[px,py-5]]);
  }
  post(latchX,near);
  ellipse(ctx,open?'#acedc9':'#ffd19b',latchX,near-26,2.1,1.8);
}

function drawPerson(ctx, p, porter, ghost, carry) {
  const [cx, foot] = floor(p.x,p.y);
  const height = 55 + 8*p.y;
  ctx.save();
  ellipse(ctx, ghost?'rgba(100,152,148,.35)':'rgba(9,12,12,.6)',cx+1,foot+1,height*.22,3.2);
  if (ghost) ctx.globalAlpha=.66;
  if (porter) {
    const w = height * porter.naturalWidth / porter.naturalHeight;
    if (ghost) {
      ctx.filter='grayscale(1) brightness(1.95)';
      ctx.shadowColor='#a8dddc'; ctx.shadowBlur=4;
    } else {
      ctx.shadowColor='rgba(238,205,160,.65)'; ctx.shadowBlur=1;
    }
    ctx.drawImage(porter,cx-w/2,foot-height,w,height);
    ctx.filter='none'; ctx.shadowBlur=0;
  } else {
    // A survey marker with a distinct footprint keeps the plan usable offline.
    ctx.fillStyle=ghost?'#bcd9d4':'#e7ca94';
    ctx.strokeStyle='#202823'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(cx,foot); ctx.lineTo(cx-7,foot-12);
    ctx.arc(cx,foot-16,8,Math.PI*.85,Math.PI*2+.15*Math.PI);
    ctx.closePath();ctx.fill();ctx.stroke();
  }
  if (carry) {
    const x = cx+height*.095, y=foot-height*.40, w=height*.20, h=height*.14;
    const leather=ctx.createLinearGradient(x,y,x,y+h);
    leather.addColorStop(0,'#ae8050');leather.addColorStop(1,'#654427');
    stroke(ctx,'#493422',1.7,[[x+3,y],[x+4,y-2],[x+w-3,y-2],[x+w-2,y]]);
    ctx.fillStyle=leather;ctx.fillRect(x,y,w,h);
    stroke(ctx,'#cfaa79',1,[[x+2,y+2],[x+w-1,y+2]]);
  }
  ctx.restore();
}

export function makeStationScene(canvas, onAssetsChange) {
  const ctx = canvas.getContext('2d');
  const files = {platform: 'station-shadow.webp', porter: 'station-porter.webp'};
  const images = {}, failed = new Set();
  let revision = 0, lastFrame = '';
  // Keep the world coordinates independent of the display pixel density.
  canvas.width=WIDTH*2;canvas.height=HEIGHT*2;
  ctx.setTransform(2,0,0,2,0,0);
  function load(key) {
    const image = new Image();
    image.onload = () => {images[key]=image;changed();};
    image.onerror = () => {failed.add(key);changed();};
    image.src = new URL('../assets/photo/'+files[key], import.meta.url).href;
  }
  function changed() {
    revision++;
    canvas.dataset.scenery=images.platform?'photo':'plan';
    canvas.dataset.porter=images.porter?'photo':'marker';
    onAssetsChange();
  }
  return {
    load(){for(const key of Object.keys(files))load(key);},
    failed(){return failed.size>0;},
    retry(){const missing=[...failed];failed.clear();for(const key of missing)load(key);onAssetsChange();},
    draw(player,ghost,open,carry){
      const signature=[revision,player?.x,player?.y,ghost?.x,ghost?.y,open,carry].join('/');
      if(lastFrame===signature)return;
      lastFrame=signature;
      drawFloor(ctx,images.platform);drawPedal(ctx,open);gate(ctx,open);
      // Resolve depth at a crossing while preserving the overlay for coincident positions.
      const actors=[];
      if(ghost)actors.push({p:ghost,shadow:true});
      if(player)actors.push({p:player,shadow:false});
      for(const actor of actors.sort((a,b)=>a.p.y-b.p.y))
        drawPerson(ctx,actor.p,images.porter,actor.shadow,!actor.shadow&&carry);
    },
  };
}
