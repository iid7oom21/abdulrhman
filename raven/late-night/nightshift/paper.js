import {action,element,mount} from '../night-shell.js';
import {download} from '../night-store.js';
import {WIDTH,HEIGHT,MAX_COMMANDS,MAX_POINTS,clone,stamp,segment,apply,reload,measures,validDraft} from './paper-rules.js';

const SCALE=4, newDraft=()=>({version:1, tool:'water', seed:41, absorption:75, dryness:15, commands:[]});
let state, current, before, redo=[], cursor=[76,41];

function render(ui) {
  const {root,t}=ui;
  if(!state) {
    const saved=ui.load();state=validDraft(saved)?saved:newDraft();
    ({sheet:current,before}=reload(state.commands));
  }
  const num=v=>new Intl.NumberFormat(ui.lang).format(v);
  const control=(id,label,fn)=>{const b=action(label,fn);b.dataset.paper=id;return b;};
  const canvas=(name,cls)=>{
    const c=element('canvas',null,cls);c.width=WIDTH*SCALE;c.height=HEIGHT*SCALE;c.dataset.paper=name;return c;
  };
  const bench=element('div',null,'paper-bench'), suite=element('section',null,'paper-suite'), settings=element('section',null,'paper-settings');
  const header=element('h2',t('ورقة العمل','Working sheet'));
  const desk=element('div',null,'paper-desk'), sheet=canvas('sheet','paper-surface'), pointer=canvas('cursor','paper-cursor');
  sheet.tabIndex=0;sheet.setAttribute('role','group');sheet.setAttribute('aria-label',t('سطح الرسم','Drawing surface'));
  pointer.setAttribute('aria-hidden','true');desk.append(sheet,pointer);
  const help=element('p',t('اسحب لرسم مسار. بالأسهم حرّك الفرشاة، وبالمسافة ضع لمسة. اضغط Shift مع سهم لرسم خط.',
    'Drag to draw. Use arrow keys to move the brush, Space to dab, or Shift and an arrow to draw a line.'));
  help.id='paper-input-help';sheet.setAttribute('aria-describedby',help.id);
  const position=element('p',null,'paper-position');position.setAttribute('role','status');
  const counts=element('p',null,'paper-counts');counts.dataset.paper='measure';
  const tools=element('div',null,'paper-controls');
  const pen=control('ink',t('فرشاة الحبر','Ink brush'),()=>choose('ink'));
  const water=control('water',t('فرشاة الماء','Water brush'),()=>choose('water'));
  const dab=control('dab',t('لمسة عند المؤشر','Dab at cursor'),()=>stroke([cursor]));
  tools.append(pen,water,dab);
  const spread=control('spread',t('شغّل الانتشار','Spread the ink'),()=>{
    commit({type:'spread',seed:state.seed,absorption:state.absorption,dryness:state.dryness});
    status.textContent=t('تظهر الورقة قبل الانتشار وبعده تحت سطح الرسم.', 'Compare the sheet before and after this pass below.');
  });spread.classList.add('primary');
  const undo=control('undo',t('تراجع','Undo'),()=>{
    if(!state.commands.length)return;
    redo.push(state.commands.pop());
    ({sheet:current,before}=reload(state.commands));ui.save(state);paint();
  });
  const again=control('redo',t('أعد آخر فعل','Redo last action'),()=>{const c=redo.pop();if(c)commit(c,true);});
  const transport=element('div',null,'paper-controls');transport.append(spread,undo,again);
  suite.append(header,desk,tools,position,counts,transport,help);
  const settingsHeading=element('h2',t('خصائص الورق','Paper properties'));
  const photo=element('img',null,'paper-still');
  photo.src=new URL('../ink/art/panel-press.webp',import.meta.url).href;photo.width=616;photo.height=616;photo.alt='';
  photo.onerror=()=>{photo.hidden=true;};
  settings.append(photo,settingsHeading);
  for(const [key,label] of [['absorption',t('امتصاص الألياف','Fibre absorption')],['dryness',t('جفاف الورقة','Paper dryness')]]) {
    const field=element('label',null,'paper-field'),name=element('span',label),value=element('output',num(state[key])+'%'),input=element('input');
    input.type='range';input.min=0;input.max=100;input.step=1;input.value=state[key];input.dataset.paper=key;
    input.oninput=()=>{state[key]=Number(input.value);value.textContent=num(state[key])+'%';};input.onchange=()=>ui.save(state);
    field.append(name,value,input);settings.append(field);
  }
  const seedBox=element('label',null,'paper-seed'),seed=element('input');
  seed.type='number';seed.min=1;seed.max=9999;seed.step=1;seed.value=state.seed;seed.dataset.paper='seed';
  seedBox.append(element('span',t('بذرة توزيع الألياف (١–٩٩٩٩)','Fibre seed (1–9999)')),seed);
  seed.onchange=()=>{
    if(seed.validity.valid && seed.value!=='') {state.seed=seed.valueAsNumber;ui.save(state);}
    updateTools();
  };
  seed.oninput=updateTools;
  const guide=element('p',t('أضف ماءً فوق جزء من الخط، ثم شغّل الانتشار. يتحرك الحبر حيث يلامس الماء. تزيد الألياف الماصّة الانتشار، ويقلّ على الورق الجاف.',
    'Wet part of the line and run a pass. Ink travels where it meets water. Absorbent fibres spread more ink; dry paper holds it in place.'));
  settings.append(seedBox,guide);
  bench.append(suite,settings);
  const comparison=element('section',null,'paper-compare'),compareTitle=element('h2',t('قبل الانتشار وبعده','Before and after spreading'));
  const compareGrid=element('div',null,'paper-pair'),cBefore=canvas('before'),cAfter=canvas('after');
  for(const [c,label] of [[cBefore,t('قبل','Before')],[cAfter,t('بعد','After')]]) {
    const f=element('figure');c.setAttribute('aria-label',label);f.append(c,element('figcaption',label));compareGrid.append(f);
  }
  const difference=element('p');difference.dataset.paper='difference';comparison.append(compareTitle,compareGrid,difference);
  const actions=element('div',null,'paper-controls');
  const exportPng=control('png',t('نزّل الطبعة PNG','Download print PNG'),()=>{
    if(!sheet.getContext('2d'))return;
    try{sheet.toBlob(blob=>{if(blob)download('raven-rain-paper.png',blob);else status.textContent=t('تعذّر إنشاء الصورة.','The print could not be created.');},'image/png');}
    catch{status.textContent=t('تعذّر تنزيل الطبعة.','The print could not be downloaded.');}
  });
  const reset=control('reset',t('ورقة جديدة','New sheet'),()=>{
    state=newDraft();redo=[];cursor=[76,41];({sheet:current,before}=reload([]));ui.replaceDraft(state);
    root.querySelector('[data-paper="absorption"]').value=state.absorption;root.querySelector('[data-paper="dryness"]').value=state.dryness;
    for(const field of root.querySelectorAll('.paper-field'))field.querySelector('output').textContent=num(Number(field.querySelector('input').value))+'%';
    seed.value=state.seed;status.textContent='';paint();sheet.focus();
  });
  actions.append(exportPng,reset);const status=element('p');status.setAttribute('role','status');
  root.replaceChildren(bench,comparison,actions,status);
  let staged=null, contact=null,points=[],active=true,texture=null;
  const output=document.createElement('canvas');output.width=WIDTH;output.height=HEIGHT;
  const low=output.getContext('2d'),ctx=sheet.getContext('2d'),overlay=pointer.getContext('2d');
  const rgba=low?.createImageData(WIDTH,HEIGHT);
  function draw(target,matrix) {
    const g=target.getContext('2d');if(!g || !low)return;
    g.fillStyle='#e7dac0';g.fillRect(0,0,target.width,target.height);
    if(texture){g.fillStyle=g.createPattern(texture,'repeat');g.fillRect(0,0,target.width,target.height);}
    const pixels=rgba.data;
    for(let i=0;i<matrix.ink.length;i++) {
      const pigment=Math.min(1,Math.sqrt(matrix.ink[i]/3800));
      const moisture=matrix.water[i]/255*.25;
      const a=pigment+moisture*(1-pigment);
      const ink=a?pigment/a:0;
      pixels[i*4]=87-71*ink; pixels[i*4+1]=125-94*ink; pixels[i*4+2]=145-95*ink;
      pixels[i*4+3]=Math.round(255*a);
    }
    low.putImageData(rgba,0,0);g.imageSmoothingEnabled=true;g.drawImage(output,0,0,target.width,target.height);
  }
  function crosshair(){
    if(overlay) {
      overlay.clearRect(0,0,pointer.width,pointer.height);
      const x=(cursor[0]+.5)*SCALE,y=(cursor[1]+.5)*SCALE,rad=SCALE*(state.tool==='ink'?2.5:7.5);
      for(const [color,width] of [['#f6ebd3',3],['#333d42',1]]) {
        overlay.strokeStyle=color;overlay.lineWidth=width;overlay.beginPath();overlay.arc(x,y,rad,0,Math.PI*2);overlay.stroke();
      }
    }
    position.textContent=t('موضع الفرشاة · عمود ','Brush position · column ')+num(cursor[0]+1)+t('، صف ', ', row ')+num(cursor[1]+1);
  }
  function updateTools(){
    const m=measures(current),full=state.commands.length>=MAX_COMMANDS;
    pen.setAttribute('aria-pressed',String(state.tool==='ink'));water.setAttribute('aria-pressed',String(state.tool==='water'));
    undo.disabled=!state.commands.length;again.disabled=!redo.length;dab.disabled=full;
    spread.disabled=full||!m.wet||!m.marked||seed.value===''||!seed.validity.valid;
    exportPng.disabled=!ctx;
    if(full)status.textContent=t('امتلأ سجل هذه الورقة. يمكنك التراجع أو تنزيل طبعتك.','The sheet’s history is full. Undo an action or download your print.');
  }
  function paint() {
    sheet.dataset.stock=texture?'grain':'plain';
    const m=measures(current);const preview=staged || current;draw(sheet,preview);crosshair();updateTools();
    counts.textContent=t('خانات الحبر ','Inked cells ')+num(m.marked)+' · '+t('خانات الماء ','Wet cells ')+num(m.wet);
    counts.dataset.ink=String(m.marked);counts.dataset.water=String(m.wet);
    comparison.hidden=!before;
    if(before){
      draw(cBefore,before);draw(cAfter,current);
      const prev=measures(before);
      difference.textContent=t('مساحة الحبر قبل الانتشار ','Inked area before spreading: ')+num(prev.marked)+
        t(' خانة، وبعده ',' cells, after spreading: ')+num(m.marked)+t(' خانة.',' cells.');
    }
  }
  function choose(tool){state.tool=tool;ui.save(state);paint();}
  function commit(c,fromRedo=false){
    if(state.commands.length>=MAX_COMMANDS)return;
    if(!fromRedo)redo=[];
    state.commands.push(c);before=c.type==='spread'?clone(current):null;
    apply(current,c);ui.save(state);paint();
  }
  function stroke(ps){commit({type:state.tool,points:ps.map(p=>[...p])});}
  function point(e){
    const r=sheet.getBoundingClientRect();
    return [Math.max(0,Math.min(WIDTH-1,Math.floor((e.clientX-r.left)*WIDTH/r.width))),
      Math.max(0,Math.min(HEIGHT-1,Math.floor((e.clientY-r.top)*HEIGHT/r.height)))];
  }
  sheet.onpointerdown=e=>{
    if(contact!==null || e.button!==0 || state.commands.length>=MAX_COMMANDS)return;
    e.preventDefault();sheet.focus({preventScroll:true});sheet.setPointerCapture(e.pointerId);contact=e.pointerId;
    cursor=point(e);points=[cursor];staged=clone(current);stamp(staged,state.tool,...cursor);draw(sheet,staged);crosshair();
  };
  function extend(e) {
    if(e.pointerId!==contact)return;
    const to=point(e),from=points.at(-1);if(to[0]===from[0]&&to[1]===from[1])return;
    if(points.length===MAX_POINTS)points=points.filter((_,i)=>i%2===0||i===MAX_POINTS-1);
    points.push(to);cursor=to;segment(staged,state.tool,from,to);draw(sheet,staged);crosshair();
  }
  sheet.onpointermove=extend;
  sheet.onpointerup=e=>{
    if(e.pointerId!==contact)return;extend(e);contact=null;staged=null;stroke(points);
  };
  sheet.onpointercancel=()=>{contact=null;staged=null;paint();};
  sheet.onkeydown=e=>{
    const offsets={ArrowUp:[0,-2],ArrowDown:[0,2],ArrowLeft:[-2,0],ArrowRight:[2,0]};
    if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)stroke([cursor]);return;}
    if(!Object.hasOwn(offsets,e.key))return;
    e.preventDefault();const [dx,dy]=offsets[e.key],from=cursor;
    cursor=[Math.max(0,Math.min(WIDTH-1,from[0]+dx)),Math.max(0,Math.min(HEIGHT-1,from[1]+dy))];
    if(e.shiftKey)stroke([from,cursor]);else crosshair();
  };
  const grain=new Image(),grainURL=new URL('../../assets/visual-20261119/paper-grain.webp',import.meta.url).href;
  const recovery=element('div',null,'paper-controls');recovery.hidden=true;
  const retry=control('retry-grain',t('أعد تحميل خامة الورق','Reload grain'),()=>{recovery.hidden=true;grain.src=grainURL;});
  recovery.append(element('span',t('تعذّر تحميل خامة الورق. الرسم متاح على ورقة سادة.', 'Paper grain could not load. You can draw on plain stock.')),retry);
  suite.append(recovery);
  grain.onload=()=>{if(active){texture=grain;recovery.hidden=true;paint();}};
  grain.onerror=()=>{if(active)recovery.hidden=false;};
  grain.src=grainURL;
  paint();
  if(!ctx)status.textContent=t('تعذّر عرض الصورة. يمكنك تغيير موضع الفرشاة ومقارنة المساحات بالأرقام.', 'The image cannot be displayed. Move the brush and compare the area readings.');
  return ()=>{active=false;};
}
mount({id:'nightshift-paper',title:['ورق تحت المطر','Paper in the Rain'],intro:[
  'على الورقة خطّ حبر واحد. بلّل طرفه أو ارسم فوقه، ثم شاهد كيف تحمله الألياف.',
  'A single line of ink rests on the sheet. Wet its edge or draw your own, then watch the fibres carry the ink.'],render});
