import {W,H,clamp,one,table,act,picker,tabs,node,rect,poly,line,ellipse,sky,text,grain} from './screencraft-ui.js';

const names=[['المعطف','Coat'],['الوشاح','Scarf'],['القبعة','Cap']];
const inks=['#f6ca7e','#85d0d1','#f3a4a2'];
const cloth=['#b77640','#3e818a','#a85b58'];
const starts=[0,2,6];
const initial=[[0,4],[2,4,8],[6,8,7]];
const xy=id=>[id%3,Math.floor(id/3)];
const distance=(a,b)=>{const [x,y]=xy(a),[u,v]=xy(b);return Math.hypot((x-u)*1.16,y-v);};
const label=id=>'ABC'[Math.floor(id/3)]+(id%3+1);
function route(v,i){
  if(!Array.isArray(v)||v[0]!==starts[i]||!v.every(x=>Number.isInteger(x)&&x>=0&&x<=8))return [...initial[i]];
  return v.slice(0,9).filter((x,j,a)=>j===0||x!==a[j-1]);
}
function schedule(path,holds){
  const list=[];let time=0;
  for(let i=0;i<path.length;i++){
    if(i)time+=distance(path[i-1],path[i]);
    list.push({id:path[i],arrive:time,depart:time+(holds.get(i)||0)});time=list[i].depart;
  }
  return list;
}
function poseAt(track,time){
  for(let i=0;i<track.length;i++){
    const k=track[i],next=track[i+1];
    if(!next||time<=k.depart)return xy(k.id);
    if(time<next.arrive){
      const progress=(time-k.depart)/(next.arrive-k.depart),a=xy(k.id),b=xy(next.id);
      return a.map((v,j)=>v+(b[j]-v)*progress);
    }
  }
}
function audience([x,z]){return [157+x*162+(z-1)*7,151+z*48];}
function visibleExchange(tracks,actor,mark,start,end){
  const [x,z]=xy(mark),other=2-actor*2;
  // Check every change of velocity. Between two changes both blocking bounds are linear.
  const times=[start,end,...tracks[other].flatMap(p=>[p.arrive,p.depart]).filter(t=>t>start&&t<end)].sort((a,b)=>a-b);
  function blocked(t){const p=poseAt(tracks[other],t);return p[1]>z+.25&&Math.abs(audience(p)[0]-audience([x,z])[0])<27;}
  for(let i=1;i<times.length;i++){
    const a=times[i-1],b=times[i],p=poseAt(tracks[other],a),q=poseAt(tracks[other],b);
    const dx=audience(q)[0]-audience(p)[0],dy=q[1]-p[1];
    const offsets=[0,1];
    if(dx)for(const edge of [-27,27])offsets.push((audience([x,z])[0]+edge-audience(p)[0])/dx);
    if(dy)offsets.push((z+.25-p[1])/dy);
    const cuts=offsets.filter(t=>t>=0&&t<=1).sort((x,y)=>x-y);
    for(let j=1;j<cuts.length;j++)if(blocked(a+(b-a)*(cuts[j]+cuts[j-1])/2))return false;
    if(blocked(a)||blocked(b))return false;
  }
  return true;
}
function rehearse(paths){
  const holds=[new Map(),new Map(),new Map()],events=[];let receivedAt=0;
  const tracks=()=>paths.map((p,i)=>schedule(p,holds[i]));
  for(let giver=0;giver<2;giver++){
    const all=tracks(),last=all[giver].at(-1),ri=paths[giver+1].indexOf(last.id);
    if(ri<0)break;
    const arriveG=Math.max(last.depart,receivedAt),arriveR=all[giver+1][ri].arrive;
    const start=Math.max(arriveG,arriveR),end=start+.65;
    const keep=(actor,key,add)=>holds[actor].set(key,(holds[actor].get(key)||0)+add);
    keep(giver,paths[giver].length-1,end-arriveG);
    keep(giver+1,ri,end-arriveR);
    events.push({giver,id:last.id,start,end,wait:start-Math.min(arriveG,arriveR),early:arriveG<arriveR?giver:giver+1});
    receivedAt=end;
  }
  const all=tracks();
  for(const e of events)e.visible=visibleExchange(all,e.giver,e.id,e.start,e.end);
  return {tracks:all,events,end:Math.max(3,...all.map(p=>p.at(-1).depart))+.65};
}
function topPoint([x,z]){return [128+x*194,63+z*89];}
function stageFloor(c){
  const g=c.createLinearGradient(0,40,0,H);g.addColorStop(0,'#54443a');g.addColorStop(.65,'#8f684b');g.addColorStop(1,'#4a3936');rect(c,g,0,0,W,H);
  for(let i=0;i<16;i++){
    const y=i*23;line(c,'#332b2880',1,[0,y],[W,y]);for(let j=0;j<6;j++){
      const x=(j*141+i*41)%700;line(c,'#b6875a3d',1,[x,y+9],[x+70,y+8]);line(c,'#473a31',1,[x,y],[x,y+22]);
    }
  }
}
function renderStage(c,state,model,sec,t){
  const front=state.view==='house';
  if(front){
    sky(c,'#1a2029','#52463d');poly(c,'#5f4c42',[[70,120],[570,120],[640,H],[0,H]]);
    for(let i=0;i<10;i++)line(c,'#b2805655',1,[i*68,130],[i*95-82,H]);
    for(let i=0;i<7;i++)line(c,'#89694d',1,[0,137+i*24],[W,137+i*24]);
    for(let i=0;i<3;i++){
      const x=157+i*162;rect(c,'#0e1a20',x-20,63,40,64);rect(c,'#a18865',x-23,61,46,3);
    }
    for(const x of [0,590])for(let i=0;i<6;i++)poly(c,i%2?'#542c31':'#713b3b',[[x+i*10,0],[x+12+i*10,0],[x+8+i*10,147],[x+i*9,197]]);
    poly(c,'#393337',[[0,0],[640,0],[640,21],[470,38],[300,27],[127,41],[0,25]]);
  }else{
    stageFloor(c);
    for(let i=0;i<9;i++){
      const [x,y]=topPoint(xy(i));
      line(c,'#e0d7bd',2,[x-8,y],[x+8,y]);line(c,'#e0d7bd',2,[x,y-7],[x,y+7]);text(c,label(i),x+23,y+18,12,'#e9debf');
    }
    for(let i=0;i<3;i++){
      c.save();c.setLineDash(i===0?[]:i===1?[10,5]:[2,5]);const pts=state.paths[i].map(id=>topPoint(xy(id)));
      if(pts.length>1)line(c,inks[i],i===state.actor?3:1.4,...pts);c.restore();
    }
  }
  const actors=model.tracks.map((track,id)=>({id,coord:poseAt(track,sec)}));
  const carrier=model.events.filter(e=>sec>=e.end).length;
  for(const {id,coord} of actors.sort((a,b)=>a.coord[1]-b.coord[1])){
    const [x,y]=(front?audience:topPoint)(coord);
    const offset=actors.filter(a=>a.id<id&&Math.hypot(a.coord[0]-coord[0],a.coord[1]-coord[1])<.1).length;
    const xx=x+offset*16;
    if(front){
      ellipse(c,'#201f2880',xx,y+2,18,4);rect(c,'#252e32',xx-7,y-16,5,16);rect(c,'#252e32',xx+3,y-16,5,16);
      poly(c,cloth[id],[[xx-8,y-42],[xx+7,y-42],[xx+14,y-14],[xx-14,y-14]]);
      ellipse(c,'#c19976',xx,y-49,7,8);
      if(id===1)line(c,inks[id],3,[xx-6,y-40],[xx+6,y-33],[xx+9,y-24]);
      if(id===2)rect(c,inks[id],xx-10,y-56,20,4);
      if(id===carrier)text(c,'⚿',xx+15,y-26,20,'#ffe9a7');
    }else{
      ellipse(c,'#332d2b',xx+2,y+5,13,7);ellipse(c,cloth[id],xx,y,12,15);
      text(c,['I','II','III'][id],xx,y+4,12,'#fff4dd');
      if(id===carrier){ellipse(c,'#f9e0a2',xx+12,y-9,4,4);line(c,'#f9e0a2',2,[xx+12,y-7],[xx+18,y-3]);}
    }
  }
  grain(c);
  if(front)rect(c,'#1c2028',0,H-14,W,14);
}
export function blocking(ui){
  const {t}=ui,old=ui.load('blocking',{})||{};
  const state={actor:one(old.actor,[0,1,2]),view:one(old.view,['plan','house']),paths:initial.map((_,i)=>route(old.paths?.[i],i))};
  let model=rehearse(state.paths);
  const w=table(ui,t('ثلاثة مداخل ومفتاح واحد','Three entrances, one key'),
    t('اختر ممثلًا ثم أضف علامات إلى مساره. آخر علامة لحامل المفتاح هي موضع التسليم. مرّر مسار المستلم عبرها.','Select a performer and add floor marks. The carrier hands over at their last mark. Route the receiver through it.'),
    (c,sec)=>renderStage(c,state,model,sec,t),()=>model.end);
  function save(){ui.save('blocking',state);}
  function feedback(){
    const lines=model.events.map((e,i)=>{
      const note=e.wait>.05?t(...names[e.early])+' · '+t('انتظار','waiting')+' '+e.wait.toFixed(1)+' '+t('ث','s'):t('وصول متزامن','simultaneous arrival');
      return (i+1)+' · '+label(e.id)+' · '+e.start.toFixed(1)+' '+t('ث','s')+' · '+note+' · '+(e.visible?t('التسليم مرئي من الصالة','visible from the house'):t('يحجب الممثل الثالث لحظة التسليم','third performer masks the handoff'));
    });
    if(model.events.length<2){
      const i=model.events.length,mark=label(state.paths[i].at(-1));
      lines.push(t('يتوقف المفتاح عند ','Key waits at ')+mark+' · '+t('أضف العلامة إلى مسار ','Add the mark to ')+t(...names[i+1]));
    }
    lines.push(t('مجموع مسافات المشي','Total walking distance')+' '+state.paths.reduce((sum,p)=>sum+p.reduce((v,id,j)=>v+(j?distance(id,p[j-1]):0),0),0).toFixed(1));
    w.result.textContent=lines.join('\n');w.frame.setAttribute('aria-label',t('بروفة المداخل','Entrance rehearsal')+' · '+lines.join('. '));
  }
  function update(){model=rehearse(state.paths);save();render();w.seek(0);}
  function render(){
    tabs(w,'actor',names.map((n,i)=>[i,['I','II','III'][i]+' · '+t(...n)]),state.actor,id=>{state.actor=id;save();render();});
    const path=state.paths[state.actor];
    const grid=node('div',null,'sc-path');grid.setAttribute('role','group');grid.setAttribute('aria-label',t('أضف علامة إلى المسار','Append floor mark'));
    for(let i=0;i<9;i++){
      const b=act('mark'+i,label(i),()=>{path.push(i);update();const next=w.main.querySelector('[data-sc="undo"]');next?.focus({preventScroll:true});});
      b.disabled=i===path.at(-1)||path.length>=9;grid.append(b);
    }
    const actions=node('div',null,'sc-actions'),undo=act('undo',t('تراجع عن آخر علامة','Undo last mark'),()=>{path.pop();update();});
    undo.disabled=path.length<2;
    actions.append(undo,act('clear-path',t('ارجع إلى باب الدخول','Return to entrance'),()=>{state.paths[state.actor]=[starts[state.actor]];update();}));
    model.events.forEach((e,i)=>actions.append(act('handoff'+i,t('جمّد التسليم ','Freeze handoff ')+(i+1),()=>w.seek(e.start+.3))));
    w.controls.replaceChildren(picker('view',t('زاوية البروفة','Rehearsal camera'),[['plan',t('مخطط الخشبة','Stage plan')],['house',t('مقعد الجمهور','Audience seat')]],state.view,v=>{state.view=v;save();w.refresh();}),
      node('div',t(...names[state.actor])+' · '+path.map(label).join(' › '),'sc-subhead'),grid,actions);
    feedback();w.refresh();
  }
  render();w.seek(.5);
}
