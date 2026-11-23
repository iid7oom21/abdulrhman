import {start,keepButton,el,button,group,canvas,output,box,dot,line,gradient} from './tools.js';
import {cols,rows,goal,spawn,obstacle,souvenir,turns,vector,roll} from './reel-model.js';
const fresh=()=>[0,1,2].map(()=>({x:null,y:null,rot:0}));let pieces=fresh(),chosen=0,round=1,result=null,preview=null,started=0,loop=0;
let drawActive=null,imported=false,track=null;
const xy=(x,y)=>[100+x*74,49+y*55];
const port=([x,y],[dx,dy])=>[x+dx*29,y+dy*24];
const lerp=([ax,ay],[bx,by],t)=>[ax+(bx-ax)*t,ay+(by-ay)*t];

// Sample the same quadratic drawn on each bend, in the direction the reel enters it.
// Distances are screen pixels, so a long straight and a short bend use proportional time.
function makeTrack(route,parts){
  const points=[];
  function add(point){
    const last=points.at(-1),length=last?Math.hypot(point[0]-last.point[0],point[1]-last.point[1]):0;
    if(!last||length)points.push({point,distance:(last?.distance||0)+length});
  }
  add(xy(...route[0]));
  for(let i=1;i<route.length;i++){
    const [x,y]=route[i],center=xy(x,y),bend=parts.find(p=>p.x===x&&p.y===y);
    if(!bend){add(center);continue;}
    const incoming=[route[i-1][0]-x,route[i-1][1]-y],entry=port(center,incoming);
    add(entry);
    const sides=turns[bend.rot].map(dir=>vector[dir]);
    const side=sides.findIndex(([dx,dy])=>dx===incoming[0]&&dy===incoming[1]);
    if(side<0)break; // A mismatched bend stops the reel where it meets the tile.
    const exit=port(center,sides[1-side]);
    for(let step=1;step<=16;step++){
      const t=step/16;
      add(lerp(lerp(entry,center,t),lerp(center,exit,t),t));
    }
  }
  return points;
}

function trailAt(points,fraction){
  const target=points.at(-1).distance*Math.min(1,Math.max(0,fraction)),trail=[points[0].point];
  for(let i=1;i<points.length;i++){
    const {point,distance}=points[i];
    if(distance>target){
      const prior=points[i-1];
      trail.push(lerp(prior.point,point,(target-prior.distance)/(distance-prior.distance)));
      break;
    }
    trail.push(point);
  }
  return trail;
}

function scene(c,fraction,out){
  gradient(c,'#493c39','#202c31');for(let i=0;i<16;i++){line(c,'#64544a',1,[[0,12+i*19],[640,12+i*19]]);}
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const [x,y]=xy(i,j);box(c,(i+j)%2?'#4c4a43':'#555147',x-36,y-26,72,52);dot(c,'#6c6655',x,y,2);}
  const [ox,oy]=xy(...obstacle);box(c,'#252d2d',ox-30,oy-20,60,40);box(c,'#856e50',ox-30,oy-19,60,5);
  for(let i=0;i<2;i++)line(c,'#69645a',3,[[ox-22+i*42,oy-11],[ox-22+i*42,oy+13]]);
  const [gx,gy]=xy(...goal);box(c,'#222d2f',gx-23,gy-14,46,30);line(c,'#d5af70',3,[[gx-22,gy-15],[gx-17,gy-23],[gx+21,gy-19],[gx+23,gy-14]]);
  const [cx,cy]=xy(...souvenir);
  if(round===2){box(c,'#c5ad76',cx-16,cy-9,32,18);for(let i=0;i<5;i++)box(c,'#514b3b',cx-12+i*5,cy+3,2,2);}
  pieces.forEach((p,i)=>{if(p.x===null)return;
    const center=xy(p.x,p.y),[a,b]=turns[p.rot].map(dir=>port(center,vector[dir]));
    for(const [wide,color] of [[10,'#242d2f'],[6,['#dba468','#a6bac4','#d5be7b'][i]]]){
      c.beginPath();c.strokeStyle=color;c.lineWidth=wide;c.moveTo(...a);c.quadraticCurveTo(...center,...b);c.stroke();
    }
  });
  let pos=xy(...spawn);
  if(out){
    const trail=trailAt(track,fraction);
    line(c,'#c6bfa1',2,trail);pos=trail.at(-1);
  }
  dot(c,'#242a2b',pos[0],pos[1],18);dot(c,'#b9b0a0',pos[0],pos[1],15);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5+fraction*6;dot(c,'#454746',pos[0]+Math.cos(a)*8,pos[1]+Math.sin(a)*8,3.5);}
}
function render(ui){
  const {t,root}=ui;
  if(!imported){imported=true;if(Array.isArray(ui.editData?.pieces)&&ui.editData.pieces.length===3){const v=ui.editData.pieces;if(v.every(p=>Number.isInteger(p.x)&&p.x>=0&&p.x<cols&&Number.isInteger(p.y)&&p.y>=0&&p.y<rows&&turns[p.rot])){pieces=v.map(p=>({...p}));round=ui.editData.round===2?2:1;}}}
  const view=canvas(t('مخطط الصالة ومسار البكرة','Cinema floor and reel path'));view.dataset.game='reel-view';
  const c=view.getContext('2d'),controls=group(),board=el('div',null,'game-board'),read=output(),notes=el('p',null,'game-note'),actions=group();
  board.setAttribute('role','group');board.setAttribute('aria-label',t('خانات الصالة من A1 إلى G5','Floor cells A1 through G5'));
  const cellName=(x,y)=>String.fromCharCode(65+x)+(y+1);
  const corner=['└','┌','┐','┘'];
  function layout(){
    controls.replaceChildren(...pieces.map((p,i)=>{const b=button('piece-'+i,t('قطعة ','Bend ')+(i+1)+' '+corner[p.rot],()=>{chosen=i;layout();});b.setAttribute('aria-pressed',String(i===chosen));return b;}));
    controls.append(button('rotate',t('دوّر القطعة','Rotate bend'),()=>{pieces[chosen].rot=(pieces[chosen].rot+1)%4;result=null;layout();}));
    board.replaceChildren();
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const piece=pieces.findIndex(p=>p.x===x&&p.y===y),name=cellName(x,y);
      const occupied=[spawn,obstacle,goal].some(p=>p[0]===x&&p[1]===y);
      const glyph=piece>=0?corner[pieces[piece].rot]:name;
      const b=button('cell-'+name,glyph,()=>{if(piece>=0&&piece!==chosen){chosen=piece;}else{pieces[chosen].x=x;pieces[chosen].y=y;result=null;}layout();});
      b.setAttribute('aria-label',name+(piece>=0?' · '+t('قطعة ','Bend ')+(piece+1):''));b.disabled=occupied;if(piece===chosen)b.setAttribute('aria-pressed','true');board.append(b);
    }
    actions.replaceChildren();const run=button('roll',t('أطلق البكرة','Release the reel'),()=>{
      preview=roll(pieces);track=makeTrack(preview.route,pieces);result=null;started=performance.now();layout();animate();
    });run.disabled=pieces.some(p=>p.x===null);actions.append(run);
    if(result){
      const win=result.reason==='box'&&(round===1||result.souvenir);
      read.textContent=(win?t('وصلت إلى صندوق الحفظ.','Reached the archive box.'):result.reason==='box'?t('وصلت البكرة دون البطاقة. جرّب الصف الخامس.','The reel arrived without the card. Try row five.'):t('توقفت البكرة. عدّل موضع قطعة أو اتجاهها.','The reel stopped. Change a bend or its orientation.'))+' '+t('المسار: ','Path: ')+result.route.map(p=>cellName(...p)).join(' › ');
      read.dataset.result=win?'won':'retry';view.dataset.route=result.route.map(p=>cellName(...p)).join(',');
      if(win){actions.append(keepButton(ui,t('احتفظ بالمسار','Keep this route'),()=>({title:t('مسار البكرة','Reel route'),type:'reel-run',data:{pieces:pieces.map(p=>({...p})),round,path:result.route}})));}
      if(win&&round===1)actions.append(button('long',t('طريق البطاقة التذكارية','Take the souvenir route'),()=>{round=2;result=null;layout();}));
    }else{read.dataset.result='';read.textContent=t('اختر قطعة ثم خانة. اختر القطعة مجددًا لتدويرها.','Choose a bend and a cell. Select it again to rotate it using the rotation button.');}
    notes.textContent=t('البداية A3 →، العائق D3، صندوق الحفظ F3.','Start A3 →, obstruction D3, archive box F3.')+(round===2?t(' التقط البطاقة عند D5.',' Pick up the card at D5.'):'');
    if(preview){controls.querySelectorAll('button').forEach(b=>b.disabled=true);board.querySelectorAll('button').forEach(b=>b.disabled=true);run.disabled=true;read.textContent=t('البكرة تدور…','The reel is rolling…');}
    scene(c,1,result);
  }
  function animate(){
    if(!preview)return;
    const u=Math.min(1,(performance.now()-started)/1500);
    scene(c,1-(1-u)**1.4,preview);
    if(u<1){loop=requestAnimationFrame(()=>drawActive.animate());return;}
    result=preview;preview=null;ui.recordEvent({ar:'أطلقت البكرة عبر أرض الصالة.',en:'You released the reel across the auditorium.',data:{route:result.route,reason:result.reason,souvenir:result.souvenir}});layout();
  }
  drawActive={animate};root.replaceChildren(view,notes,controls,board,actions,read);layout();
}
start(2,'reel-run',['بكرة تدور في سينما نائمة','A reel in a sleeping cinema'],['ضع ثلاث وصلات منحنية لتمر البكرة حول الصندوق في وسط الصالة.','Place three bends to carry the reel around the obstruction.'],render);
