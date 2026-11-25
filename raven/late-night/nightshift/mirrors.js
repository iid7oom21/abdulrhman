import {action, element, mount} from '../night-shell.js';
import {FIELD, PERIOD, STAGES, mirrorSegment, shutterSegment, traceStage} from './mirror-rules.js';

const NS = 'http://www.w3.org/2000/svg';
const {width, height} = FIELD;
const beaconStill = new URL('../ink/art/beacon-night.webp', import.meta.url).href;
const slopes = ['╱', '╲'];
const compass = {
  north:['الشمال','north'], south:['الجنوب','south'], east:['الشرق','east'], west:['الغرب','west'],
};
const names = {pier:['الرصيف','quay'], hall:['الصالة','hall']};

function newRound(stage = 0) {
  return {version:1, stage, selected:0, angles:[...STAGES[stage].initial], phase:0, fired:false};
}

function recover(data) {
  if (data?.version !== 1 || !Number.isInteger(data.stage) || !STAGES[data.stage] ||
      !Number.isInteger(data.selected) || !STAGES[data.stage].mirrors[data.selected] ||
      !Array.isArray(data.angles) || data.angles.length !== 3 || !data.angles.every(a => a === 0 || a === 1) ||
      !Number.isInteger(data.phase) || data.phase < 0 || data.phase >= PERIOD ||
      typeof data.fired !== 'boolean') return newRound();
  return {...data, angles:[...data.angles]};
}

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(NS,tag);
  for (const [name,value] of Object.entries(attrs)) node.setAttribute(name,String(value));
  node.append(...children);
  return node;
}
const line = ({a,b}, attrs) => svg('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],...attrs});

function makeChart(t, select) {
  const chart = svg('svg',{viewBox:'-5 -5 '+(width+10)+' '+(height+10),class:'mirror-chart',
    'data-harbour-chart':'',role:'img','aria-label':t('مخطط المنارتين والمرايا والحاجز. يتوفر وصف المواضع أسفل أزرار اللعب.',
    'Chart of the two lighthouses, mirrors and shutter. A list of positions follows the controls.')});
  const grid = svg('pattern',{id:'chart-grid',width:10,height:10,patternUnits:'userSpaceOnUse'},
    svg('path',{d:'M10 0H0V10',stroke:'#acc5aa','stroke-width':.32,fill:'none',opacity:.34}));
  const rim = svg('linearGradient',{id:'chart-sea',x2:1,y2:1,gradientUnits:'objectBoundingBox'},
    svg('stop',{offset:'0%','stop-color':'#384940'}),svg('stop',{offset:'62%','stop-color':'#1b3d46'}),
    svg('stop',{offset:'100%','stop-color':'#122d35'}));
  chart.append(svg('defs',{},grid,rim),
    svg('rect',{x:-5,y:-5,width:width+10,height:height+10,fill:'url(#chart-sea)'}),
    svg('image',{href:beaconStill,x:0,y:0,width,height,preserveAspectRatio:'xMidYMid slice',opacity:.31}),
    svg('rect',{width,height,fill:'url(#chart-grid)',stroke:'#b8b59a','stroke-width':.34}));
  const rule = svg('g',{class:'etched'});
  for (let i=0;i<=width;i+=2) {
    const length=i%10===0 ? 1.55 : .55;
    rule.append(line({a:[i,-.25],b:[i,-.25-length]}),line({a:[i,height+.25],b:[i,height+.25+length]}));
  }
  for (let i=0;i<=height;i+=2) {
    const length=i%10===0 ? 1.55 : .55;
    rule.append(line({a:[-.25,i],b:[-.25-length,i]}),line({a:[width+.25,i],b:[width+.25+length,i]}));
  }
  const rails=svg('g'), rays=svg('g'), lanterns=svg('g'), shutter=svg('g'), pivots=svg('g');
  chart.append(rule,rails,rays,lanterns,shutter,pivots);
  let drawnStage;
  function stageObjects(stage) {
    if (drawnStage===stage) return;
    drawnStage=stage;
    const track={a:stage.shutter.start,b:stage.shutter.end};
    const start=shutterSegment(stage,0);
    shutter.replaceChildren(line(start,{stroke:'#101e24','stroke-width':2.1,'stroke-linecap':'square'}),
      line(start,{stroke:'#efb0a2','stroke-width':1.22}),
      line(start,{stroke:'#553b39','stroke-width':1.25,'stroke-dasharray':'.58 .9'}));
    rails.replaceChildren(line(track,{stroke:'#f6dfb7','stroke-width':.65,'stroke-dasharray':'1.1 1.1'}));
    for (const [cx,cy] of [track.a,track.b])
      rails.append(svg('circle',{cx,cy,r:.85,fill:'#a6b2a1',stroke:'#253837','stroke-width':.3}));
    lanterns.replaceChildren();
    for (const source of stage.sources) {
      const [x,y]=source.at,[dx,dy]=source.dir;
      const marks = svg('g',{class:source.id==='pier'?'quay-light':'hall-light'});
      const tower = svg('g',{transform:'translate('+x+' '+y+') rotate('+Math.atan2(dy,dx)*180/Math.PI+')'});
      tower.append(svg('path',{d:'M-2.9 -2.4 -1.6 -1.5 0 -1.5 .8 -1 .8 1 0 1.5 -1.6 1.5 -2.9 2.4Z',fill:'#e7dcc4',stroke:'#172a30','stroke-width':.44}),
        svg('path',{d:'M-.9 -1.2V1.2 M-2 -1.6V1.6',fill:'none',stroke:'#4a5e5b','stroke-width':.36}),
        svg('path',{d:'M.85 -1 4 -.45 4 .45 .85 1Z',fill:'currentColor'}));
      marks.append(tower);lanterns.append(marks);
    }
    for(const window of stage.windows) {
      const group=svg('g',{class:window.id==='pier'?'quay-light':'hall-light'});
      const glass=line(window,{class:'window-glass'});
      if(window.id==='hall')glass.setAttribute('stroke-dasharray','1.4 1.2');
      group.append(line(window,{class:'window-frame'}),glass);
      const [x,y]=window.a,[u,v]=window.b;
      for(const k of [.25,.5,.75])group.append(svg('circle',{cx:x+(u-x)*k,cy:y+(v-y)*k,r:.36,fill:'#23363a'}));
      lanterns.append(group);
    }
  }
  function setShutter(stage,time){
    const start=stage.shutter.start,half=stage.shutter.half;
    const {a}=shutterSegment(stage,time);
    shutter.setAttribute('transform','translate('+(a[0]+half[0]-start[0])+' '+(a[1]+half[1]-start[1])+')');
  }
  function paint(stage,round,shot) {
    stageObjects(stage);
    setShutter(stage,round.phase);
    pivots.replaceChildren();rays.replaceChildren();
    for(const [i,m] of stage.mirrors.entries()){
      const [cx,cy]=m.at, segment=mirrorSegment(m,round.angles[i]);
      const group=svg('g',{'data-chart-mirror':i});
      group.append(svg('circle',{cx,cy,r:3.5,class:'pivot'}));
      if (round.selected===i)group.append(svg('circle',{cx,cy,r:5.6,class:'active-pivot'}));
      group.append(line(segment,{class:'reflector-rim'}),line(segment,{class:'reflector'}),
        svg('circle',{cx,cy,r:.6,fill:'#fff5d8',stroke:'#21383a','stroke-width':.28}),
        svg('text',{x:cx,y:cy-6.8},m.id),svg('circle',{cx,cy,r:6,class:'mirror-hit'}));
      group.addEventListener('click',()=>select(i));
      pivots.append(group);
    }
    const beams=shot?.beams ?? stage.sources.map(({id,at,dir})=>({
      id,points:[at,[at[0]+dir[0]*7,at[1]+dir[1]*7]]
    }));
    for(const beam of beams){
      const points=beam.points.map(p=>p.join(',')).join(' '), cls='ray ray-'+beam.id;
      rays.append(svg('polyline',{points,class:cls+' ray-halo'}),svg('polyline',{points,class:cls}));
      if(shot){
        const [x,y]=beam.points.at(-1);
        rays.append(beam.reached
          ? svg('circle',{cx:x,cy:y,r:2.25,fill:'none',stroke:'#fff4d3','stroke-width':.65})
          : svg('path',{d:'M'+(x-1.45)+' '+(y-1.45)+'l2.9 2.9m0 -2.9l-2.9 2.9',stroke:'#fff0db','stroke-width':.72}));
      }
    }
  }
  return {chart,paint,setShutter};
}

let round;
function render(ui) {
  const {t,root}=ui;
  if (!round) round=recover(ui.load());
  const num = new Intl.NumberFormat(ui.lang === 'ar' ? 'ar-u-nu-arab' : 'en').format;
  const direction=angle=>angle===0?t('صاعدة إلى اليمين','rising to the right'):t('هابطة إلى اليمين','falling to the right');
  const bench=element('section',null,'mirror-workbench'),figure=element('figure');
  const model=makeChart(t,chooseMirror);
  const plate=element('div',null,'mirror-plate'),legend=element('figcaption',null,'mirror-legend');
  legend.append(element('span',t('ضوء الرصيف','Quay light')),element('span',t('ضوء الصالة','Hall light')));
  plate.append(model.chart);figure.append(plate,legend);
  const controls=element('div',null,'mirror-console'),roundInfo=element('header',null,'mirror-round');
  const heading=element('h2'),count=element('p');heading.tabIndex=-1;roundInfo.append(heading,count);
  function group(label,cls) {
    const field=element('fieldset',null,'mirror-controls'), options=element('div',null,'mirror-options '+cls);
    field.append(element('legend',label),options);return {field,options};
  }
  const mirrors=group(t('اختر مرآة','Select a mirror'),'mirror-angles');
  const mirrorButtons=['A','B','C'].map((id,i)=>{
    const b=action('',()=>chooseMirror(i));
    b.dataset.mirror=i;b.dir='ltr';b.append(id,element('code'));mirrors.options.append(b);return b;
  });
  const turn=action('',()=>{round.angles[round.selected]=1-round.angles[round.selected];edit();});
  turn.dataset.turn='1';turn.className='mirror-turn';mirrors.field.append(turn);
  const time=group(t('وقت إطلاق الضوء','Release time'),'mirror-times');
  const times=Array.from({length:PERIOD},(_,i)=>{
    const b=action(num(i)+t(' ث',' s'),()=>{round.phase=i;edit();});b.dataset.release=i;time.options.append(b);return b;
  });
  const explanation=element('p',t('ينزلق الحاجز على السكة ويعود كل أربع ثوانٍ.','The shutter slides along its rail and back every four seconds.'),'mirror-timing');
  const run=element('div',null,'mirror-run');
  const fire=action(t('أطلق الشعاعين','Send both beams'),()=>{stopPreview();round.fired=true;ui.save(round);paint();result.focus();},'primary');
  fire.dataset.fire='';
  const watch=action('',()=>{if(timer)stopPreview();else startPreview();});watch.dataset.preview='';
  run.append(fire,watch);
  const result=element('section',null,'mirror-result');result.dataset.result='';result.tabIndex=-1;
  const details=element('details',null,'mirror-note'),mapList=element('ul',null,'mirror-map-list');
  details.append(element('summary',t('كيف أقرأ المخطط؟','How do I read the chart?')),
    element('p',t('لكل منارة نافذة تحمل علامة شعاعها: خط متصل للرصيف، وخط متقطع للصالة. أدر المرايا لتغيّر مسار الضوء، واختر وقتًا تكون فيه السكة سالكة. علامة × تبيّن أين توقّف الضوء.',
    'Each lighthouse has a matching window: a solid line for the quay, a dashed line for the hall. Turn the mirrors to steer the light and choose a release time when the rail is clear. A cross marks where a beam stopped.')),
    element('p',t('مواضع المخطط تبدأ من أعلى اليسار. العدد الأول للمسافة يمينًا، والثاني للمسافة إلى الأسفل.',
    'Positions start at the top left. The first number measures rightward, the second downward.')),mapList);
  const reset=action(t('أعد هذه المرحلة','Reset this stage'),()=>begin(round.stage),'mirror-reset');reset.dataset.reset='';
  controls.append(roundInfo,mirrors.field,time.field,explanation,run,result,details,reset);
  bench.append(figure,controls);root.replaceChildren(bench);

  let timer=0;
  function chooseMirror(i){round.selected=i;ui.save(round);paint();}
  function edit(){stopPreview();round.fired=false;ui.save(round);paint();}
  function begin(i){
    stopPreview();round=newRound(i);ui.replaceDraft(round);paint();
    heading.focus({preventScroll:true});bench.scrollIntoView({block:'start'});
  }
  function watchLabel(){
    watch.textContent=timer?t('أوقف المعاينة','Stop preview'):t('راقب الحاجز','Watch the shutter');
    watch.setAttribute('aria-pressed',String(Boolean(timer)));
  }
  function stopPreview(){
    cancelAnimationFrame(timer);timer=0;watchLabel();model.setShutter(STAGES[round.stage],round.phase);
  }
  function startPreview(){
    if(document.hidden)return;
    if(round.fired){round.fired=false;ui.save(round);paint();}
    const started=performance.now();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    function frame(now){
      const dt=(now-started)/1000;
      if(dt>=PERIOD){stopPreview();return;}
      model.setShutter(STAGES[round.stage],round.phase+(reduced?Math.floor(dt):dt));
      timer=requestAnimationFrame(frame);
    }
    timer=requestAnimationFrame(frame);watchLabel();
  }
  function lostVisibility(){if(document.hidden)stopPreview();}
  document.addEventListener('visibilitychange',lostVisibility);
  window.addEventListener('pagehide',stopPreview);
  function redrawResult(shot){
    result.replaceChildren();result.hidden=!shot;
    if(!shot){delete result.dataset.won;return;}
    result.dataset.won=String(shot.success);
    const reached=shot.beams.filter(beam=>beam.reached).length;
    const final=round.stage===STAGES.length-1;
    const title=shot.success
      ? (final?t('أضأت نافذتي المرفأ في المراحل الثلاث','Both windows lit on all three stages'):t('أضاء الشعاعان نافذتيهما','Both windows lit'))
      : reached?t('أضاءت نافذة واحدة','One window lit'):t('بقيت النافذتان معتمتين','Both windows stayed dark');
    result.append(element('h3',title),element('p',t('وقت الإطلاق ','Released at ')+num(round.phase)+t(' ث.',' s.')));
    const list=element('ol');
    for(const [i,beam] of shot.beams.entries()){
      const end=beam.hits.at(-1), row=element('li');
      row.dataset.beam=i;row.dataset.hit=end.kind;row.dataset.reached=String(beam.reached);
      const mirrorsHit=beam.hits.filter(h=>h.kind==='mirror').map(h=>h.id);
      const journey=mirrorsHit.length
        ? t('انعكس عن ', 'reflected from ')+mirrorsHit.join(t(' ثم ',' then '))+t('، ',' and ')
        : '';
      const endings={
        shutter:t('اعترضه الحاجز.','met the shutter.'),
        edge:t('خرج من المخطط نحو ','left the chart to the ')+(compass[end.id]?t(...compass[end.id]):'')+'.',
        loop:t('عاد إلى مرآة سبق أن مرّ بها.','returned to a mirror it had already hit.'),
        window:beam.reached?t('أضاء نافذته.','lit its window.'):t('وصل إلى النافذة الأخرى.','reached the other window.'),
      };
      row.textContent=t('ضوء ','The ')+t(...names[beam.id])+t(' · ',' light · ')+journey+endings[end.kind];list.append(row);
    }
    result.append(list);
    if(shot.success){
      const next=action(final?t('العب من البداية','Play from the beginning'):t('انتقل للمرحلة التالية','Go to the next stage'),
        ()=>begin(final?0:round.stage+1),'primary');
      if(final)next.dataset.again='';else next.dataset.next='';result.append(next);
    }else{
      result.append(action(t('عدّل مسار الضوء','Adjust the light path'),()=>{
        mirrorButtons[round.selected].focus({preventScroll:true});bench.scrollIntoView({block:'start'});
      }));
    }
  }
  function updateMap(stage){
    mapList.replaceChildren();
    const pos=([x,y])=>{const label=element('bdi','('+num(x)+', '+num(y)+')');label.dir='ltr';return label;};
    function entry(label,point,after=''){const item=element('li');item.append(label,' ',pos(point),after);mapList.append(item);}
    for(const s of stage.sources){
      const [dx,dy]=s.dir,face=dx ? (dx>0?'east':'west') : (dy>0?'south':'north');
      entry(t('منارة ','Lighthouse · ')+t(...names[s.id]),s.at,t(' نحو ',' facing ')+t(...compass[face]));
    }
    stage.mirrors.forEach((m,i)=>entry(t('مرآة ','Mirror ')+m.id,m.at,' · '+direction(round.angles[i])));
    for(const w of stage.windows)entry(t('نافذة ','Window · ')+t(...names[w.id]),[(w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2]);
    const shutter=shutterSegment(stage,round.phase), ends=element('li');
    ends.append(t('طرفا الحاجز عند الإطلاق ','Shutter ends at release '),pos(shutter.a),t(' و ',' and '),pos(shutter.b));
    mapList.append(ends);
  }
  function paint(){
    const stage=STAGES[round.stage];bench.dataset.stage=round.stage;
    heading.textContent = t(...stage.title);
    count.textContent = t('المرحلة ', 'Stage ') + num(round.stage + 1) + t(' من ', ' of ') + num(STAGES.length);
    mirrorButtons.forEach((b,i)=>{
      b.dataset.angle=round.angles[i];b.querySelector('code').textContent=slopes[round.angles[i]];
      b.setAttribute('aria-pressed',String(i===round.selected));
      b.setAttribute('aria-label',t('مرآة ','Mirror ')+stage.mirrors[i].id+' · '+direction(round.angles[i]));
    });
    turn.textContent=t('أدر المرآة ','Turn mirror ')+stage.mirrors[round.selected].id+t(' ربع دورة',' a quarter turn');
    times.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===round.phase)));
    const shot=round.fired?traceStage(stage,round.angles,round.phase):null;
    model.paint(stage,round,shot);redrawResult(shot);updateMap(stage);watchLabel();
  }
  paint();
  return ()=>{
    stopPreview();document.removeEventListener('visibilitychange',lostVisibility);window.removeEventListener('pagehide',stopPreview);
  };
}
mount({id:'nightshift-mirrors',title:['ظلال المنارتين','Twin Lighthouse Shadows'],
  intro:['اختر مرآة وأدرها ليصل ضوء كل منارة إلى نافذتها قبل أن يعترضه الحاجز.',
    'Choose a mirror and turn it to guide each lighthouse beam to its window, past the moving shutter.'],render});
