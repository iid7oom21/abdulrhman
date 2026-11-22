import {inkSettings,inkScene,gridPoint,stoneSettings,stoneRecipe,stoneReadings,splitSettings,splitReadings,branchSettings,examineMap} from './filmlab-model.js';
import {drawInk,drawStone,sampleBoard,drawSplit,drawMuseum} from './filmlab-art.js';

function node(tag,text,cls) {
  const n=document.createElement(tag);
  if(text!=null)n.textContent=text;
  if(cls)n.className=cls;
  return n;
}
const numbers=n=>Array.from({length:n},(_,i)=>i);
function action(id,text,fn) {
  const b=node('button',text);b.type='button';b.dataset.film=id;b.onclick=fn;return b;
}
function select(id,title,options,onChange) {
  const label=node('label',null,'film-field'), s=node('select');
  const caption=node('span',title);label.append(caption,s);s.dataset.film=id;
  options.forEach(([id,title])=>{const o=node('option',title);o.value=id;s.append(o);});
  s.onchange=()=>onChange(Number(s.value));return {label,s};
}
function slider(id,title,min,max,onInput) {
  const label=node('label',null,'film-field'), input=node('input'), output=node('span',null,'film-value');
  input.type='range';input.min=min;input.max=max;input.step=1;input.dataset.film=id;input.dir='ltr';
  const caption=node('span',title);caption.append(output);label.append(caption,input);
  input.oninput=()=>onInput(Number(input.value));
  return {label,write(value){input.value=value;output.textContent=' · '+value;}};
}
function area(title) {const a=node('fieldset',null,'film-group');a.append(node('legend',title));return a;}
function row(...items){const d=node('div',null,'film-row');d.append(...items);return d;}
function listText(arr){return arr.map(i=>String(i+1)).join(' · ');}
function workshop(ui,title,brief,prepare,draw) {
  const {t}=ui,section=node('section',null,'film-lab'), header=node('header',null,'film-head');
  header.append(node('h1',title),node('p',brief));const stage=node('figure',null,'film-stage');
  const canvas=node('canvas');canvas.width=640;canvas.height=308;canvas.setAttribute('role','img');stage.append(canvas);
  const caption=node('figcaption');stage.append(caption);
  const controls=node('div',null,'film-controls'),data=prepare(ui.load(ui.route,null));
  const status=node('p',null,'film-result');status.setAttribute('role','status');
  section.append(header,stage,controls,status);ui.root.replaceChildren(section);
  const c=canvas.getContext('2d');
  if(!c)caption.textContent=t('العرض النصي','Text view');
  let timer=null, sync=()=>{}, stopPlayback=()=>{};
  function update(persist=true){sync();if(c)draw(c,data,timer!==null);if(persist)ui.save(ui.route,data);}
  function stop(){if(timer!==null){clearInterval(timer);timer=null;stopPlayback();}}
  function playback(count,frame,advance){
    const range=slider('frame',t('الإطار','Frame'),1,count,n=>{stop();advance(n-1);update();});
    const go=action('play',t('شغّل من البداية','Play from start'),()=>{
      if(timer!==null){stop();update();return;}
      advance(0);timer=setInterval(()=>{if(frame()===count-1){stop();update();return;}advance(frame()+1);update(false);},230);
      go.textContent=t('أوقف العرض','Pause');update();
    });
    const isReduced=matchMedia('(prefers-reduced-motion: reduce)');
    const setMotion=()=>{go.hidden=isReduced.matches;if(go.hidden&&timer!==null){stop();update();}};
    stopPlayback=()=>{go.textContent=t('شغّل من البداية','Play from start');};
    setMotion();isReduced.addEventListener('change',setMotion);ui.onCleanup(()=>isReduced.removeEventListener('change',setMotion));
    const back=action('previous',t('الإطار السابق','Previous frame'),()=>{stop();advance((frame()+count-1)%count);update();});
    const next=action('next',t('الإطار التالي','Next frame'),()=>{stop();advance((frame()+1)%count);update();});
    const g=area(t('طاولة العرض','Playback'));g.append(range.label,row(back,next,go));controls.append(g);
    return ()=>range.write(frame()+1);
  }
  ui.onCleanup(stop);
  return {t,data,controls,status,canvas,caption,update,stop,playback,setSync(fn){sync=fn;update(false);}};
}
function ink(ui) {
  const {t}=ui;let selected=1;
  const w=workshop(ui,t('المؤثّر الذي يُكتب باليد','Ink on film'),t('ارسم أثرًا عبر أربع صور مفتاحية، وقرّر متى يختفي خلف الكرة.','Place an ink trail across four keyframes, then mask the parts that travel behind the sphere.'),inkSettings,(c,s)=>drawInk(c,s,true));
  const s=w.data;selected=Math.min(3,Math.round(s.frame/5));
  const g=area(t('نقاط الارتكاز','Keyframe anchors'));
  const keys=numbers(4).map(i=>action('key-'+i,String(i*5+1),()=>{w.stop();selected=i;s.frame=i*5;w.update();}));
  const grid=node('div',null,'film-grid');grid.dir='ltr';
  function place(i){w.stop();s.points[selected]=i;s.frame=selected*5;w.update();}
  const cells=numbers(15).map(i=>action('cell-'+i,String(i+1),()=>place(i)));grid.append(...cells);
  g.append(node('p',t('اختر إطارًا مفتاحيًا، ثم المس موضعًا في الصورة أو اختر رقمه.','Choose a keyframe, then tap the picture or choose its numbered position.')),row(...keys),grid);
  w.canvas.style.cursor='crosshair';w.canvas.onclick=e=>{const rect=w.canvas.getBoundingClientRect(), x=(e.clientX-rect.left)*640/rect.width,y=(e.clientY-rect.top)*308/rect.height;
    const distances=numbers(15).map(i=>{const p=gridPoint(i);return Math.hypot(x-p.x,y-p.y);});place(distances.indexOf(Math.min(...distances)));};
  const mask=action('mask','',()=>{w.stop();s.masks[s.frame]=1-s.masks[s.frame];w.update();});
  const maskGroup=area(t('قناع الإطار الحالي','Frame matte'));maskGroup.append(mask);
  w.controls.append(g,maskGroup);
  const syncPlay=w.playback(16,()=>s.frame,n=>{s.frame=n;selected=Math.min(3,Math.round(n/5));});
  w.setSync(()=>{syncPlay();keys.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected)));cells.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===s.points[selected])));
    const behind=Boolean(s.masks[s.frame]);mask.textContent=behind?t('الأثر خلف الكرة','Trail behind the sphere'):t('الأثر أمام الكرة','Trail in front of the sphere');mask.setAttribute('aria-pressed',String(behind));
    const intersect=numbers(16).filter(f=>inkScene(s,f).intersects),hidden=intersect.filter(f=>s.masks[f]);
    w.status.textContent=t('إطارات تقاطع الأثر مع الكرة','Frames where ink crosses the sphere')+' · '+(listText(intersect)||'0')+' / '+t('المحجوب بالقناع','Hidden by the matte')+' · '+(listText(hidden)||'0');
    w.caption.textContent=t('الإطار','Frame')+' '+(s.frame+1)+'/16 · '+t('نقطة الصورة المفتاحية','Anchor position')+' '+(s.points[selected]+1);
    w.canvas.setAttribute('aria-label',w.caption.textContent+' · '+mask.textContent);
  });
}
function stone(ui) {
  const {t}=ui,w=workshop(ui,t('رخام من ورق','Marble on paper'),t('اطبع عيّنتين للوح نفسه. بدّل العروق والتكرار، ثم اختر السطح الأنسب لمسافة التصوير.','Print two samples for the same panel. Adjust the veins and repeat, then choose a surface at shooting distance.'),stoneSettings,drawStone);
  const s=w.data,g=area(t('وصفة السطح','Surface recipe'));
  const fields=[
    ['base',t('لون الأساس','Ground colour'),[t('حجر رملي','Sandstone'),t('يشم','Jade'),t('طين محروق','Terracotta')]],
    ['vein',t('طبقة العروق','Vein layer'),[t('متباعدة','Open'),t('متوسطة','Medium'),t('متقاربة','Dense')]],
    ['wear',t('اهتراء الحافة','Edge wear'),[t('خفيف','Light'),t('متوسط','Medium'),t('كثيف','Heavy')]],
    ['stagger',t('توزيع البقع','Pattern layout'),[t('تكرار الطبعة','Identical prints'),t('طبعات متبادلة','Staggered prints')]]
  ].map(([key,title,options])=>{const f=select(key,title,options.map((o,i)=>[i,o]),v=>{s[key]=v;w.update();});g.append(f.label);return [key,f.s];});
  const repeat=slider('repeat',t('بلاطات في عرض اللوح','Tiles across panel'),1,5,v=>{s.repeat=v;w.update();});g.append(repeat.label);w.controls.append(g);
  const view=action('distance','',()=>{s.near=!s.near;w.update();});
  const samples=area(t('منضدة العيّنات','Sample bench'));const cards=node('div',null,'film-samples');
  const slots=numbers(2).map(i=>{
    const id=i===0?'A':'B',card=node('div',null,'film-sample'),c=node('canvas');c.width=240;c.height=112;c.setAttribute('aria-label',t('العيّنة ','Sample ')+id);
    const print=action('print-'+i,t('اطبع ','Print ')+id,()=>{s.slots[i]=stoneRecipe(s);if(s.chosen===i)s.chosen=null;w.update();});
    const choose=action('choose-'+i,t('اعتمد ','Use ')+id,()=>{if(s.slots[i]){Object.assign(s,s.slots[i]);s.chosen=i;s.near=false;w.update();}});
    const desc=node('p',null,'film-sample-read');card.append(c,desc,row(print,choose));cards.append(card);return {c,choose,desc,id};
  });
  samples.append(cards);w.controls.append(row(view),samples);
  w.setSync(()=>{
    fields.forEach(([key,input])=>input.value=s[key]);repeat.write(s.repeat);view.textContent=s.near?t('اعرض بمقاس الفيلم','View at film size'):t('افحص عن قرب','Inspect close up');
    const reading=stoneReadings(s);
    w.caption.textContent=(s.near?t('فحص قريب','Close inspection'):t('مسافة التصوير','Shooting distance'))+' · '+s.repeat+' × '+Math.max(1,Math.round(s.repeat/2));
    w.canvas.setAttribute('aria-label',w.caption.textContent);
    w.status.textContent=t('بلاطات تطابق طبعة سبقتها','Tiles repeating an earlier print')+' · '+reading.duplicates+'/'+reading.total+' / '+t('متوسط فرق السطوع عند الوصل','Mean colour jump at seams')+' · '+reading.seam+'/255';
    slots.forEach(({c,choose,desc,id},i)=>{const recipe=s.slots[i];c.hidden=!recipe;choose.disabled=!recipe;
      const active=Boolean(recipe)&&s.chosen===i&&Object.entries(recipe).every(([k,val])=>s[k]===val);
      choose.setAttribute('aria-pressed',String(active));
      desc.textContent=recipe?id+' · '+fields[0][1].options[recipe.base].text+' · '+recipe.repeat+'×'+Math.max(1,Math.round(recipe.repeat/2)):t('لم تُطبع العيّنة ','Awaiting sample ')+id;
      if(recipe&&c.getContext('2d'))sampleBoard(c.getContext('2d'),recipe);
    });
  });
}
function split(ui) {
  const {t}=ui,w=workshop(ui,t('الشخص الذي قابل نفسه','Meeting a double'),t('من أداءين في المقهى اصنع تسليمًا واحدًا للكوب. ازح الحد وإشارة دخول الأداء الثاني وافحص لحظة التبادل.','Compose one cup handoff from two café takes. Shift the matte and the second entrance, then check the exchange.'),splitSettings,drawSplit);
  const s=w.data,g=area(t('تركيب الأداءين','Take composition'));
  const seam=slider('seam',t('موضع الحد ٪','Matte position %'),42,58,n=>{w.stop();s.seam=n;w.update();});
  const offset=slider('offset',t('إزاحة الأداء الثاني بالإطارات','Take B offset in frames'),-5,5,n=>{w.stop();s.offset=n;w.update();});
  const labels=[t('التركيب','Composite'),t('الأداء الأول','Raw take A'),t('الأداء الثاني','Raw take B')];
  const modes=labels.map((l,i)=>action('view-'+i,l,()=>{w.stop();s.view=i;w.update();}));
  g.append(seam.label,offset.label,row(...modes));w.controls.append(g);
  const go=action('inspect',t('افحص أول إطار مختلف','Inspect first discrepancy'),()=>{w.stop();s.view=0;const r=splitReadings(s);s.frame=r.gaps[0]??r.duplicates[0]??r.handoff;w.update();});
  const syncPlay=w.playback(24,()=>s.frame,n=>s.frame=n);
  w.controls.append(row(go));
  w.setSync(()=>{syncPlay();seam.write(s.seam);offset.write(s.offset);modes.forEach((b,i)=>b.setAttribute('aria-pressed',String(s.view===i)));
    const r=splitReadings(s);
    w.status.textContent=t('إطارات بكوبين','Two cups')+' · '+(listText(r.duplicates)||'0')+' / '+t('إطارات بلا كوب','Missing cup')+' · '+(listText(r.gaps)||'0');
    w.caption.textContent=labels[s.view]+' · '+t('الإطار','Frame')+' '+(s.frame+1)+'/24 · '+t('عبور الحد','Matte crossing')+' '+(r.handoff+1);w.canvas.setAttribute('aria-label',w.caption.textContent);
  });
}
function branch(ui) {
  const {t}=ui;
  const rooms=[t('الردهة','Vestibule'),t('قاعة الخزف','Ceramics'),t('رواق الماء','Water gallery'),t('صالة الضوء','Light hall'),t('الشرفة','Terrace')];
  const endings=[t('غروب حجري','Stone sunset'),t('حديقة ساكنة','Quiet garden'),t('فوانيس تطفأ','Last lanterns')];
  const w=workshop(ui,t('فيلم له بابان','A film with two doors'),t('اربط أبواب خمس قاعات ثم سلّم الجهاز لمشاهد يكتشف فيلمك من مدخله.','Connect five museum rooms, then pass the device to someone who can discover your film from its entrance.'),branchSettings,(c,s)=>drawMuseum(c,s.room,s.ends[s.room-3]));
  const s=w.data,editor=node('div',null,'film-editor'),viewer=node('section',null,'film-viewer'),g=area(t('برنامج القاعات','Projection map'));
  const options=rooms.map((r,i)=>[i,r]);
  const editors=s.doors.map((pair,i)=>{const line=node('div',null,'film-doors');line.append(node('h3',rooms[i]));g.append(line);
    return pair.map((_,j)=>{const label=j===0?t('الباب الأيسر','Left door'):t('الباب الأيمن','Right door');
      const f=select('door-'+i+'-'+j,label,options,n=>{s.doors[i][j]=n;s.room=i;s.runs=[];w.update();});line.append(f.label);return f.s;});
  });
  const stills=s.ends.map((_,i)=>{const f=select('ending-'+i,rooms[i+3]+' · '+t('لقطة الختام','Closing shot'),endings.map((v,j)=>[j,v]),n=>{s.ends[i]=n;s.room=i+3;s.runs=[];w.update();});g.append(f.label);return f.s;});
  const audit=action('map-check',t('افحص المسارات','Check paths'),()=>{const r=examineMap(s);analysis.hidden=false;
    analysis.textContent=t('النهايات الممكنة','Reachable endings')+' · '+(r.endings.map(e=>endings[e]).join(' / ')||'0')+'. '+t('غرف عالقة بلا مخرج','Trapped rooms')+' · '+(r.trapped.map(i=>rooms[i]).join(' / ')||'0')+'. '+t('غرف معزولة عن المدخل','Unreachable rooms')+' · '+(r.unreachable.map(i=>rooms[i]).join(' / ')||'0');});
  const analysis=node('p',null,'film-reading');analysis.setAttribute('role','status');analysis.hidden=true;
  const logs=node('p',null,'film-reading');
  function start(){s.watching=true;s.room=0;s.path=[0];w.update();viewer.querySelector('button:not([hidden])')?.focus();}
  const begin=action('screen',t('ابدأ عرض المشاهد','Start audience screening'),start);
  editor.append(g,row(audit,begin),analysis,logs);
  const prompt=node('h2'),close=action('edit-map',t('ارجع إلى طاولة المخرج','Return to the director’s desk'),()=>{s.watching=false;s.path=[];w.update();begin.focus();});
  function traverse(j){
    const target=s.doors[s.room]?.[j];if(target===undefined)return;
    s.room=target;s.path=[...s.path,target].slice(-40);
    if(target>=3)s.runs=[...s.runs,s.path.slice()].slice(-2);
    w.update();prompt.focus({preventScroll:true});
  }
  prompt.tabIndex=-1;
  const left=action('watch-left',t('افتح الباب الأيسر','Open left door'),()=>traverse(0));
  const right=action('watch-right',t('افتح الباب الأيمن','Open right door'),()=>traverse(1));
  const again=action('screen-again',t('اعرض من المدخل','Screen from the entrance'),start);
  viewer.append(prompt,row(left,right,again,close));w.controls.append(editor,viewer);
  w.setSync(()=>{
    editor.hidden=s.watching;viewer.hidden=!s.watching;w.status.hidden=s.watching;
    editors.forEach((pair,i)=>pair.forEach((e,j)=>e.value=s.doors[i][j]));stills.forEach((e,i)=>e.value=s.ends[i]);
    analysis.hidden=true;
    w.caption.textContent=rooms[s.room]+(s.room>=3?' · '+endings[s.ends[s.room-3]]:'');
    w.canvas.setAttribute('aria-label',w.caption.textContent);prompt.textContent=s.room<3?t('أي باب تفتح؟','Which door will you open?'):t('نهاية العرض','End of the screening')+' · '+endings[s.ends[s.room-3]];
    left.hidden=right.hidden=s.room>=3;again.hidden=s.room<3;
    logs.textContent=s.runs.length?t('آخر مسارات العرض','Recent screenings')+' · '+s.runs.map(run=>run.map(i=>rooms[i]).join(' / ')).join(' | '):'';
    w.status.textContent=t('يبدأ العرض من الردهة. خريطة المخرج مخفية أثناء المشاهدة.','The screening starts in the vestibule. The director’s map is hidden during playback.');
  });
}
export default function mount(ui) {
  const activities={'film-ink':ink,'scenic-texture':stone,'split-screen':split,'branch-film':branch};
  activities[ui.route](ui);
}
