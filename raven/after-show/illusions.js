import {bounded,forcedProjection,matteCheck,seamColumns,initialWing,loopLimit,wingGaps,defaultCostumes,costumeRoles,silhouetteWidths} from './illusions-rules.js';
import {drawScale,drawMatte,drawDrum,drawWardrobe,costumeTest} from './illusions-art.js';

function el(tag,text,cls){
  const node=document.createElement(tag);
  if(text!=null)node.textContent=text;
  if(cls)node.className=cls;
  return node;
}
function group(cls,...nodes){
  const box=el('div',null,cls);box.append(...nodes);return box;
}
function action(id,label,fn){
  const b=el('button',label);b.type='button';b.dataset.illusion=id;b.addEventListener('click',fn);return b;
}
function switchButtons(label,options,selected,change){
  const g=el('fieldset',null,'il-choices');g.append(el('legend',label));
  const controls=options.map(([key,txt])=>{
    const b=action(key,txt,()=>change(key));g.append(b);return b;
  });
  const update=key=>controls.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.illusion===key)));
  update(selected);return {g,update};
}
function makeRange(key,label,min,max,initial,apply,display=String,step=1){
  const form=el('label',null,'il-slider');const out=el('output',display(initial));
  const input=el('input');input.type='range';input.dataset.illusion=key;
  Object.assign(input,{min,max,step,value:initial});input.setAttribute('aria-label',label);
  input.addEventListener('input',()=>{const v=input.valueAsNumber;out.value=display(v);apply(v);});
  form.append(el('span',label),out,input);
  return {form,sync(v){input.value=v;out.value=display(v);}};
}
function listbox(key,label,options,current,change){
  const field=el('label',null,'il-list');const select=el('select');
  select.dataset.illusion=key;select.setAttribute('aria-label',label);
  for(const [id,text] of options){const o=el('option',text);o.value=id;select.append(o);}
  select.value=current;select.addEventListener('change',()=>change(select.value));field.append(el('span',label),select);return {field,select};
}
function studio(ui,names,description){
  const box=el('section',null,'il-workshop'),canvas=el('canvas'),caption=el('figcaption'),figure=el('figure',null,'il-frame');
  const title=ui.t(...names),heading=el('h1',title),intro=el('p',ui.t(...description),'il-intro');
  canvas.dataset.illusion='picture';canvas.width=640;canvas.height=308;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',title);
  figure.append(canvas,caption);box.append(heading,intro,figure);ui.root.replaceChildren(box);
  return {box,canvas,c:canvas.getContext('2d'),caption,setCaption(msg){caption.textContent=msg;canvas.setAttribute('aria-label',title+' · '+msg);}};
}
function stateOf(ui){return ui.load(ui.route,null)||{};}
function readScale(obj){return {cupCm:bounded(obj?.cupCm,60,125,108),towerCm:bounded(obj?.towerCm,260,750,330)};}
function mountScale(ui){
  const {t}=ui,old=stateOf(ui);
  const s=studio(ui,['فنجان بحجم عمارة','A cup as tall as a tower'],['اصنع صورة يتلامس فيها طرف الفنجان وسقف العمارة. اضبط مسافتيهما من عدسة ثابتة ثم التقط اللقطة.','Make the cup rim meet the roof of the tower. Move each object along its own rail, then capture the shot.']);
  const settings=readScale(old.settings);
  let side=old.side===true, shot=old.shot?readScale(old.shot):null, reveal=false;
  const save=()=>ui.save(ui.route,{settings,side,shot});
  const view=switchButtons(t('موضع النظر','Viewpoint'),[['lens',t('من العدسة','Through the lens')],['side',t('من الجانب','Side view')]],side?'side':'lens',v=>{side=v==='side';save();update();});
  const cm=v=>v+t(' سم',' cm');
  const cup=makeRange('cup',t('بعد الفنجان','Cup distance'),60,125,settings.cupCm,v=>{settings.cupCm=v;save();update();},cm);
  const tower=makeRange('tower',t('بعد العمارة','Tower distance'),260,750,settings.towerCm,v=>{settings.towerCm=v;save();update();},cm);
  const ins=el('p',t('تنجح المطابقة حين تصبح المسافة بين العلامتين ٣ بكسلات أو أقل في إطار التصوير.','Align the marks within 3 pixels of each other in the capture frame.'),'il-note');
  const capture=action('capture',t('التقط الصورة','Capture frame'),()=>{shot={...settings};reveal=false;save();update();});
  const result=el('div',null,'il-result'),rTitle=el('strong'),thumb=el('canvas'),rCaption=el('p');
  thumb.width=640;thumb.height=308;thumb.dataset.illusion='captured';
  const show=action('reveal',t('اكشف التصوير من الجانب','Reveal the side setup'),()=>{reveal=!reveal;update();});
  result.append(rTitle,thumb,show,rCaption);
  function update(){
    const gap=forcedProjection(settings.cupCm,settings.towerCm).gap;
    view.update(side?'side':'lens');if(s.c)drawScale(s.c,settings,side);
    s.setCaption((side?t('ارتفاع المجسمين ثابت','The two models have fixed heights'):t('المسافة بين العلامتين','Gap between the marks'))+' · '+gap.toFixed(1)+t(' بكسل',' px'));
    result.hidden=!shot;
    if(shot){
      const d=forcedProjection(shot.cupCm,shot.towerCm).gap;
      const ctx=thumb.getContext('2d');if(ctx)drawScale(ctx,shot,reveal,false);
      rTitle.textContent=d<=3?t('تلامس السقف والحافة','Rim and roof align'):t('بقيت مسافة بين العلامتين','The two marks are still apart');
      rCaption.textContent=cm(shot.cupCm)+' / '+cm(shot.towerCm)+' · '+d.toFixed(1)+t(' بكسل',' px');
      show.textContent=reveal?t('ارجع إلى الصورة الملتقطة','See the captured photograph'):t('اكشف التصوير من الجانب','Reveal the side setup');
      thumb.setAttribute('aria-label',show.textContent+' · '+rCaption.textContent);
    }
  }
  s.box.append(view.g,group('il-controls',cup.form,tower.form),ins,capture,result);update();
}
function readGrid(data,initial){
  return {x:bounded(data?.x,260,380,initial.x),y:bounded(data?.y,112,170,initial.y),size:bounded(data?.size,30,90,initial.size)};
}
function mountMatte(ui){
  const {t}=ui,old=stateOf(ui);
  const s=studio(ui,['نصف الفندق مرسوم','Half the hotel is painted'],['لوحة فندق تمتد طابقين فوق البهو المبني. اضبط رسم المنظور ثم اعبر العربة عبر عمود الوصل.','A matte adds two floors to a built hotel lobby. Align the perspective, then run a cart across the splice.']);
  const real=readGrid(old.real,{x:300,y:146,size:60}),paint=readGrid(old.paint,{x:345,y:128,size:46});
  let seam=bounded(old.seam,0,2,1),cartPosition=bounded(old.cartPosition,0,100,0),wipe=bounded(old.wipe,0,100,52);
  let active='paint',gridsOn=true,reveal=old.reveal===true,played=old.played===true,timer=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const save=()=>ui.save(ui.route,{real,paint,seam,cartPosition,wipe,reveal,played});
  const gridPick=switchButtons(t('الشبكة التي تحرّكها','Grid to adjust'),[['real',t('شبكة البهو المبني','Built lobby grid')],['paint',t('شبكة اللوحة','Painted grid')]],active,v=>{active=v;update();});
  const seamPick=listbox('seam',t('موضع الوصل','Splice column'),[[0,t('العمود الأيسر','Left column')],[1,t('العمود الأوسط','Centre column')],[2,t('العمود الأيمن','Right column')]],seam,v=>{seam=Number(v);save();update();});
  const axes=[['x',t('التلاشي الأفقي','Vanishing point · horizontal'),260,380],['y',t('ارتفاع الأفق','Horizon height'),112,170],['size',t('مقياس النوافذ','Window scale'),30,90]]
    .map(([key,name,min,max])=>[key,makeRange('grid-'+key,name,min,max,paint[key],v=>{(active==='real'?real:paint)[key]=v;save();update();})]);
  const manual=makeRange('position',t('موضع العربة','Cart position'),0,100,cartPosition,v=>{stop();cartPosition=v;played=true;save();update();},v=>v+'%');
  const curtain=makeRange('curtain',t('اسحب ستار الكشف','Slide the reveal curtain'),0,100,wipe,v=>{wipe=v;save();update();},v=>v+'%');
  const toggle=action('guides','',()=>{gridsOn=!gridsOn;update();});
  const play=action('cart-run','',()=>{
    if(timer){stop();save();update();return;}
    if(cartPosition>=100)cartPosition=0;
    played=true;reveal=false;gridsOn=false;
    if(reduced){cartPosition=Math.min(100,cartPosition+10);save();update();return;}
    timer=setInterval(()=>{cartPosition=Math.min(100,cartPosition+2);if(cartPosition>=100){stop();save();}update();},75);
    update();
  });
  const inspect=action('matte-inspect','',()=>{stop();reveal=!reveal;played=true;save();update();});
  const score=el('p',null,'il-result');
  function stop(){clearInterval(timer);timer=0;}
  function onHidden(){if(document.hidden){stop();save();update();}}
  document.addEventListener('visibilitychange',onHidden);ui.onCleanup(()=>{stop();document.removeEventListener('visibilitychange',onHidden);});
  function update(){
    const d=matteCheck({real,paint,seam});
    gridPick.update(active);axes.forEach(([key,axis])=>axis.sync((active==='real'?real:paint)[key]));manual.sync(cartPosition);
    if(s.c)drawMatte(s.c,{real,paint,seam,cartPosition,gridsOn,wipe,reveal});
    const cartX=85+cartPosition*4.1,cut=Math.max(0,Math.min(cartX+24,480)-Math.max(cartX-30,seamColumns[seam]));
    s.setCaption(reveal?t('يسار الستار البهو المبني، ويمينه الرسم الكامل.','The built plate is left of the curtain; the full painting is on its right.'):
      t('فارق التلاشي ','Vanishing gap ')+d.gridGap.toFixed(1)+t(' بكسل · فرق مقياس النوافذ ',' px · window scale gap ')+d.windowGap);
    toggle.textContent=gridsOn?t('أخفِ الشبكتين','Hide both grids'):t('أظهر الشبكتين','Show both grids');
    toggle.setAttribute('aria-pressed',String(gridsOn));
    play.textContent=timer?t('وقّف العربة','Pause cart'):reduced?t('قدّم العربة خطوة','Step the cart'):t('شغّل عبور العربة','Run the cart');
    inspect.textContent=reveal?t('اعرض التركيب','Show composite'):t('اكشف اللوحتين','Reveal the two plates');
    curtain.form.hidden=!reveal;
    score.hidden=!played;
    score.textContent=(d.gridGap<=5&&d.windowGap<=3?t('تطابقت الشبكتان. ','Grids aligned. '):t('طابق التلاشي ضمن ٥ بكسلات والمقياس ضمن ٣ درجات. ','Match the vanishing points within 5 pixels and the scales within 3 units. '))+
      (d.clipped?t('يمر خط الوصل على مسار العربة. ','The splice crosses the cart route. '):t('يمر المسار كاملًا حتى العمود الأخير. ','The full route reaches the last column. '))+
      (cut>0&&!reveal?t('الجزء المخفي من العربة الآن ','Cart currently hidden by the matte: ')+Math.round(cut)+t(' بكسل.',' px.'):'');
  }
  s.box.append(seamPick.field,gridPick.g,group('il-controls',...axes.map(([,axis])=>axis.form)),group('il-actions',play,toggle,inspect),manual.form,curtain.form,score);update();
}
function mountDrum(ui){
  const {t}=ui,old=stateOf(ui);
  const s=studio(ui,['دورة لا تنقطع','An unbroken loop'],['أربع وضعيات رئيسية لطائر ورقي وبينها أربع خانات. اضبط زوايا الطيّ حتى يطوي الجناح ويفتحه ثم يعود إلى البداية دون قفزة كبيرة.','Four paper-bird poses anchor four in-betweens. Shape the fold so the wing opens and returns to its first frame smoothly.']);
  const angles=initialWing.map((v,i)=>bounded(old.angles?.[i],-65,65,v));
  let frame=bounded(old.frame,0,7,0),compare=old.compare===true,examined=old.examined===true,timer=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const save=()=>ui.save(ui.route,{angles,frame,compare,examined});
  const states=el('fieldset',null,'il-frames');states.append(el('legend',t('اختر خانة الحركة','Choose a frame')));
  const buttons=angles.map((_,i)=>{
    const b=action('frame-'+i,String(i+1),()=>{stop();frame=i;save();update();});states.append(b);return b;
  });
  const angle=makeRange('fold',t('زاوية طيّة الجناح','Wing fold angle'),-65,65,angles[frame],v=>{angles[frame]=v;save();update();},v=>v+'°');
  const change=v=>{stop();angles[frame]=bounded(angles[frame]+v,-65,65,0);save();update();};
  const less=action('fold-down',t('اخفض الطيّة ٥°','Lower fold 5°'),()=>change(-5)),more=action('fold-up',t('ارفع الطيّة ٥°','Raise fold 5°'),()=>change(5));
  const step=action('next',t('الإطار التالي','Next frame'),()=>{stop();frame=(frame+1)%8;save();update();});
  const play=action('play','',()=>{
    if(timer){stop();save();update();return;}
    if(reduced){frame=(frame+1)%8;save();update();return;}
    timer=setInterval(()=>{frame=(frame+1)%8;update();},compare?700:210);update();
  });
  const finish=action('review',t('راجع اتصال الحلقة','Check the loop'),()=>{stop();examined=true;save();update();});
  const pair=action('slow-compare','',()=>{stop();compare=!compare;frame=0;save();update();});
  const verdict=el('p',null,'il-result');
  function stop(){clearInterval(timer);timer=0;}
  function onHidden(){if(document.hidden){stop();save();update();}}
  document.addEventListener('visibilitychange',onHidden);ui.onCleanup(()=>{stop();document.removeEventListener('visibilitychange',onHidden);});
  function update(){
    const gaps=wingGaps(angles),seam=gaps[7],max=Math.max(...gaps);
    buttons.forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===frame));b.setAttribute('aria-label',t('إطار ','Frame ')+(i+1)+' · '+angles[i]+'°');});
    angle.sync(angles[frame]);less.disabled=angles[frame]===-65;more.disabled=angles[frame]===65;
    if(s.c)drawDrum(s.c,angles,frame,compare?initialWing:null);
    s.setCaption((compare?t('يسارًا البداية، يمينًا طيّتك · ','Original at left, your fold at right · '):'')+
      t('إطار ','Frame ')+(frame+1)+'/8 · '+angles[frame]+'° · '+t('قفزة النهاية إلى البداية ','Last-to-first jump ')+seam+'°');
    play.textContent=timer?t('وقّف الدولاب','Pause drum'):reduced?t('تقدّم يدويًا','Advance manually'):compare?t('شغّل المقارنة البطيئة','Play slow comparison'):t('شغّل الدولاب','Turn the drum');
    pair.textContent=compare?t('اعرض طيّاتي وحدها','View my folds alone'):t('قارن بالبداية ببطء','Compare with the starting loop');pair.hidden=!examined;
    verdict.hidden=!examined;
    verdict.textContent=(seam<loopLimit?t('اتصلت النهاية بالبداية. ','Loop seam accepted. '):t('قفزة الإغلاق ما زالت كبيرة. ','The seam still jumps. '))+
      t('أكبر تغيّر بين خانتين ','Largest adjacent change ')+max+'° · '+t('قفزة الإغلاق ','Seam jump ')+seam+'°.';
  }
  s.box.append(states,angle.form,group('il-actions',less,more),el('p',t('لقبول الإغلاق يجب أن تكون قفزة الخانة ٨ إلى ١ أقل من ١٨°.','The jump from frame 8 to frame 1 must be below 18° to close the loop.'),'il-note'),group('il-actions',play,step,finish,pair),verdict);update();
}
function mountCostume(ui){
  const {t}=ui,old=stateOf(ui);
  const s=studio(ui,['الممثل في آخر صف','The actor in the back row'],['صمّم ثلاثة أزياء لفرقة جوالة. جرّب قراءة الهيئات من آخر صف ثم طابق كل ظلّ بدوره.','Dress three touring performers. Test their silhouettes from the back row, then match each figure with its role.']);
  const looks=defaultCostumes.map((l,i)=>({
    length:bounded(old.looks?.[i]?.length,0,2,l.length),
    shoulder:bounded(old.looks?.[i]?.shoulder,0,2,l.shoulder),
    prop:bounded(old.looks?.[i]?.prop,0,3,l.prop)
  }));
  let role=bounded(old.role,0,2,0),far=old.far===true,mono=old.mono===true,quiz=old.quiz===true,graded=old.graded===true;
  const oldOrder=old.order,order=Array.isArray(oldOrder)&&oldOrder.length===3&&new Set(oldOrder).size===3&&oldOrder.every(x=>[0,1,2].includes(x))?[...oldOrder]:[0,1,2];
  const picks=[0,1,2].map((_,i)=>bounded(old.picks?.[i],-1,2,-1));
  let previous=Number.isFinite(old.previous)?old.previous:null;
  let scan=[],cachedSignature='';
  const save=()=>ui.save(ui.route,{looks,role,far,mono,quiz,graded,order,picks,previous});
  const roles=costumeRoles.map((r,i)=>[String(i),t(...r)]);
  const rolePick=switchButtons(t('اختر الدور','Select a role'),roles.map(([i,r])=>['role-'+i,r]),'role-'+role,key=>{role=Number(key.slice(5));save();update();});
  const patterns=[
    ['length',t('طول المعطف','Coat length'),[t('قصير','Short'),t('متوسط','Mid-length'),t('طويل','Long')]],
    ['shoulder',t('قصّة الكتفين','Shoulder cut'),[t('نازلة','Sloping'),t('مستقيمة','Straight'),t('مرفوعة','Raised')]],
    ['prop',t('القطعة المحمولة','Hand prop'),[t('يد فارغة','Empty hand'),t('فانوس','Lantern'),t('خريطة ملفوفة','Rolled map'),t('عصا قيادة','Baton')]]
  ];
  const controls=patterns.map(([key,title,values])=>[key,listbox(key,title,values.map((v,i)=>[i,v]),looks[role][key],val=>{looks[role][key]=Number(val);graded=false;save();update();})]);
  const editor=group('il-editor',rolePick.g,group('il-controls',...controls.map(([,c])=>c.field)));
  const position=action('distance','',()=>{far=!far;save();update();}),colour=action('mono','',()=>{mono=!mono;save();update();});
  const quizBtn=action('quiz','',()=>{
    if(quiz){quiz=false;save();update();return;}
    quiz=true;far=true;mono=true;graded=false;picks.fill(-1);
    // Rotate the cast on each try while keeping saved assignments reproducible.
    order.push(order.shift());save();update();
  });
  const scoreBox=el('div',null,'il-result');
  const quizRows=group('il-controls');
  const answers=['A','B','C'].map((id,i)=>{
    const q=listbox('match-'+i,t('ظلّ ','Figure ')+id,[[-1,t('اختر الدور','Choose role')],...roles],picks[i],val=>{picks[i]=Number(val);graded=false;save();update();});
    quizRows.append(q.field);return q;
  });
  const evaluate=action('score',t('قيّم المطابقة','Score matching'),()=>{graded=true;save();update();});
  const explain=el('p',null,'il-note'),scanText=el('p'),oldScore=el('p');
  const inspect=action('scan',t('قِس تشابه الظلال','Measure the silhouettes'),()=>{
    if(!s.c)return;scan=costumeTest(looks);previous=scan.filter(x=>x.width===20).reduce((m,x)=>Math.max(m,x.match),0);
    save();update();
  });
  scoreBox.append(scanText,oldScore,inspect);
  function update(){
    rolePick.update('role-'+role);controls.forEach(([k,c])=>{c.select.value=looks[role][k];});
    editor.hidden=quiz;quizRows.hidden=!quiz;evaluate.hidden=!quiz;
    evaluate.disabled=picks.some(x=>x<0);answers.forEach((q,i)=>{q.select.value=picks[i];});
    const showOrder=quiz?order:[0,1,2];
    if(s.c)drawWardrobe(s.c,looks,{far,mono,order:showOrder});
    position.hidden=colour.hidden=quiz;
    position.textContent=far?t('شاهد من الصف الأول','View from the front row'):t('شاهد من آخر صف','View from the back row');
    colour.textContent=mono?t('أعد ألوان القماش','Restore fabric colours'):t('أخفِ الألوان','Hide colours');
    quizBtn.textContent=quiz?t('ارجع وعدّل قصّة','Return to fitting'):t('اختبر مطابقة الأدوار','Test role matching');
    s.setCaption((far?t('آخر صف','Back row'):t('الصف الأول','Front row'))+' · '+(mono?t('ظلال','Silhouettes'):t('قماش ملوّن','Fabric colours'))+
      (quiz?'': ' · '+roles.map(([,r],i)=>String.fromCharCode(65+i)+' '+r).join(' / ')));
    const signature=JSON.stringify(looks);
    if(cachedSignature!==signature){
      scan=s.c?costumeTest(looks):[];cachedSignature=signature;
    }
    const overlaps=scan.filter(v=>v.match>=.9);
    const min=silhouetteWidths.findLast(w=>overlaps.some(v=>v.width===w));
    const pair=overlaps.find(v=>v.width===min);
    const best=scan.filter(x=>x.width===20).reduce((m,x)=>Math.max(m,x.match),0);
    inspect.disabled=!s.c;
    if(!s.c)scanText.textContent=t('قياس البكسلات غير متاح في هذا المتصفح.','Pixel comparison is unavailable in this browser.');
    else scanText.textContent=pair?t('أصغر عرض اختُبر وفيه ظلّان متشابهان ','Smallest tested width with similar silhouettes: ')+min+t(' بكسل',' px')+
      ' · '+t(...costumeRoles[pair.a])+' / '+t(...costumeRoles[pair.b])+' · '+Math.round(pair.match*100)+'%.':
      t('ظلّت الهيئات متميزة حتى عرض ٨ بكسلات.','Silhouettes stay distinct down to 8 pixels.');
    oldScore.textContent=t('أعلى تداخل عند ٢٠ بكسل ','Highest overlap at 20 px ')+Math.round(best*100)+'%'+
      (previous!=null?t(' · القياس المحفوظ ',' · saved measurement ')+Math.round(previous*100)+'%':'');
    explain.hidden=!quiz||!graded;
    if(graded&&quiz){const matched=picks.filter((v,i)=>v===order[i]).length;explain.textContent=t('مطابقات صحيحة ','Correct matches ')+matched+'/3 · '+order.map((v,i)=>String.fromCharCode(65+i)+' '+t(...costumeRoles[v])).join(' / ');}
  }
  s.box.append(editor,group('il-actions',position,colour,quizBtn),quizRows,evaluate,explain,el('p',t('نقارن أقنعة الظلال عند عروض من ٨٠ إلى ٨ بكسلات. تداخل ٩٠٪ أو أكثر يعني أن القصّتين متشابهتان عند هذا العرض.','We sample silhouette masks from 80 to 8 pixels wide. An overlap of at least 90% marks a similar pair at that width.'),'il-note'),scoreBox);update();
}

export default function mount(ui){
  const routes={'forced-scale':mountScale,matte:mountMatte,zoetrope:mountDrum,costume:mountCostume};
  routes[ui.route](ui);
}
