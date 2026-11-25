import {mount, element, action, link} from '../night-shell.js';
import {download} from '../night-store.js';

const title = ['كاميرا الطبقات', 'Multiplane camera'];
const width = 960, height = 480, overscan = 80, duration = 4;
const defaults = {mode: 'challenge', travel: 48, spacing: 50, seek: 0};
let setup, firstFrame = false, completed = false;

const layers = ['harbour', 'window'].map(name => ({name, image: null, pending: null, failed: false}));
function loadLayer(layer) {
  if (layer.image) return Promise.resolve();
  if (!layer.pending) {
    const image = new Image();
    layer.failed = false;
    layer.pending = new Promise(resolve => {
      let timer;
      function finish(loaded) {
        clearTimeout(timer);
        image.onload = image.onerror = null;
        layer.image = loaded ? image : null;
        layer.failed = !loaded;
        if (!loaded) image.removeAttribute('src');
        resolve();
      }
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      timer = setTimeout(() => finish(false), 8500);
      image.src = new URL('./art/camera-' + layer.name + '.webp', import.meta.url).href;
    }).finally(() => { layer.pending = null; });
  }
  return layer.pending;
}
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
function restore(raw) {
  const s = {...defaults};
  if (raw?.version !== 1) return s;
  if (raw.mode === 'free') s.mode = 'free';
  for (const [key, low, high] of [['travel',-80,80],['spacing',0,100],['seek',0,100]]) {
    if (Number.isFinite(raw[key])) s[key] = clamp(key==='seek'?raw[key]:Math.round(raw[key]),low,high);
  }
  return s;
}
// Both painted planes start registered. Pulling the cels apart increases only the near-plane motion.
function shifts(travel, spacing, phase) {
  const camera = travel * phase / 100;
  const far = camera * .25, near = camera * (.25 + .75 * spacing / 100);
  return {far, near, difference: Math.abs(near - far)};
}
function drawLayer(c, layer, shift) {
  const x = -overscan - shift, plateWidth = width + 2 * overscan;
  if (layer.image) {
    const h = plateWidth * layer.image.naturalHeight / layer.image.naturalWidth;
    c.drawImage(layer.image, x, layer.name === 'window' ? height - h : (height - h) / 2, plateWidth, h);
    return;
  }
  // A registration diagram keeps the same two moving reference marks when an asset is unavailable.
  c.save(); c.translate(-shift,0);
  if (layer.name === 'harbour') {
    c.fillStyle='#2d3b45';c.fillRect(-overscan,0,plateWidth,height);
    c.fillStyle='#50636d';c.fillRect(-overscan,height*.60,plateWidth,height*.40);
    c.fillStyle='#b89968';c.fillRect(710,130,8,155);
    c.fillStyle='#e9ce90';c.fillRect(703,118,22,20);
  } else {
    c.fillStyle='#684735';c.fillRect(176,0,24,height);c.fillRect(-overscan,height-29,plateWidth,29);
    c.fillStyle='#b5a08b';c.fillRect(185,0,2,height);
  }
  c.restore();
}
function render(ui) {
  const {root,t,lang} = ui;
  setup ??= restore(ui.editData);
  const localNumber = new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-arab':'en',{maximumFractionDigits:1});
  const num = value => localNumber.format(value);
  const px = value => num(value) + t(' بكسل',' px');
  const form = element('div',null,'ink-controls'), figure = element('figure',null,'ink-stage');
  const canvas=element('canvas'), caption=element('figcaption'), results=element('p',null,'ink-result');
  canvas.width=width;canvas.height=height;canvas.setAttribute('role','img');canvas.dataset.camera='frame';
  figure.append(canvas,caption);results.setAttribute('role','status'); results.dataset.camera='result';
  const c=canvas.getContext('2d'), inputs={};
  const numbers=element('p');numbers.dataset.camera='measurements';
  const feedback=element('p');feedback.setAttribute('role','status');
  const recovery=element('div',null,'ink-controls'), buttons=element('div',null,'ink-controls');
  const timings=element('div',null,'ink-controls'), exportRow=element('div',null,'ink-controls');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let raf=0, playing=false;
  function button(id, ar, en, fn, cls) {
    const b=action(t(ar,en),fn,cls);b.dataset.camera=id;return b;
  }
  const range = (parent,key,label,min,max,unit) => {
    const box=element('label'), text=element('span',t(...label)), input=element('input'), output=element('output');
    input.type='range';input.min=min;input.max=max;input.value=setup[key];input.dataset.camera=key;
    input.addEventListener('input',()=>{
      stop();firstFrame=false;setup[key]=input.valueAsNumber;
      if(key!=='seek'){setup.seek=100;completed=false;results.textContent='';}
      draw();
    });
    box.append(text,input,output);parent.append(box);inputs[key]={input,output,unit};
  };
  const modeLabel=element('label'),mode=element('select');mode.dataset.camera='mode';
  for(const [id,ar,en] of [['challenge','تحدّي النافذة','Window challenge'],['free','تصوير حر','Free camera']]) mode.append(new Option(t(ar,en),id));
  mode.value=setup.mode;modeLabel.append(element('span',t('وضع التصوير','Camera mode')),mode);form.append(modeLabel);
  const brief=element('p');brief.dataset.camera='brief';
  function changeBrief(){
    brief.textContent=setup.mode==='challenge'
      ?t('طلب اللقطة: اجعل حافة النافذة تنزاح عن مصباح المرفأ بمقدار ٣٠ إلى ٤٥ بكسل بين بداية الحركة ونهايتها.','Shot brief: move the window edge 30–45 pixels relative to the harbour lamp between the opening and closing frames.')
      :t('اختر حركة الكاميرا وحدّد الإطار الذي تريد طباعته.','Set your camera move, then choose the frame to print.');
  }
  mode.addEventListener('change',()=>{stop();setup.mode=mode.value;completed=false;results.textContent='';changeBrief();draw();});
  range(form,'travel',['سَير الكاميرا الأفقي','Horizontal camera travel'],-80,80,px);
  range(form,'spacing',['تباعد الطبقتين','Plane separation'],0,100,v=>num(v)+'%');
  range(timings,'seek',['موضع الإطار','Frame position'],0,100,v=>num(duration*v/100)+t(' ث',' s'));
  const play=button('play','شغّل الحركة','Play move',()=>{
    if(playing){stop();draw();return;}
    if(setup.seek>=100)setup.seek=0;
    firstFrame=false;playing=true;completed=false;results.textContent='';
    const started=performance.now()-setup.seek*duration*10;
    let previous=-1;
    function tick(now){
      const fraction=clamp((now-started)/(duration*10),0,100);
      // The reduced-motion transport uses four discrete poses per second; scrubbing always remains available.
      const seek=reduced.matches?Math.floor(fraction/6.25)*6.25:fraction;
      if(seek!==previous){setup.seek=seek;previous=seek;draw();}
      if(fraction>=100){stop();setup.seek=100;assess();draw();return;}
      raf=requestAnimationFrame(tick);
    }
    raf=requestAnimationFrame(tick);draw();
  },'primary');
  const origin=button('compare','قارن بالإطار الأول','Compare with first frame',()=>{stop();firstFrame=!firstFrame;draw();});
  const restart=button('restart','ارجع لبداية الحركة','Rewind move',()=>{stop();firstFrame=false;setup.seek=0;completed=false;results.textContent='';draw();});
  const check=button('check','افحص الحركة','Check move',()=>{stop();firstFrame=false;setup.seek=100;assess();draw();});
  function assess(){
    completed=true;
    const {difference}=shifts(setup.travel,setup.spacing,100);
    const met=difference>=30&&difference<=45;
    results.textContent=setup.mode==='free'
      ?t('فرق الحركة في لقطتك ','Relative motion in your take: ')+px(difference)
      :(met?t('تحقّق طلب اللقطة. ','The shot meets the brief. '):t('جرّب طول حركة أو مسافة أخرى. ','Try a different travel distance or separation. '))
        +t('فرق الحركة بين الطبقتين ','Relative motion between planes: ')+px(difference);
    results.dataset.met=setup.mode==='challenge'?String(met):'free';
  }
  const save=button('save','احفظ الإطار في دفتر أعمالي','Keep frame in my portfolio',()=>{
    stop();draw();
    const thumb=element('canvas');thumb.width=240;thumb.height=120;
    const ctx=thumb.getContext('2d');if(ctx&&c)ctx.drawImage(canvas,0,0,240,120);
    ui.savePiece({type:'ink-camera',title:t('نافذة ورشة المرفأ','Harbour workshop window'),data:{version:1,...setup,seek:firstFrame?0:setup.seek},thumbnail:ctx&&c?thumb.toDataURL('image/webp',.8):undefined});
  });
  const png=button('download','نزّل الإطار PNG','Download frame PNG',()=>{
    stop();draw();
    canvas.toBlob(blob=>{
      if(blob)download('raven-ink-camera.png',blob,'image/png');
      else feedback.textContent=t('تعذّر إنشاء ملف الصورة. يمكنك إعادة المحاولة.','The image file could not be created. Please retry.');
    },'image/png');
  });
  const reload=button('retry','أعد تحميل الرسم المتعذّر','Reload missing artwork',()=>{
    const failed=layers.filter(l=>l.failed);
    Promise.all(failed.map(loadLayer)).then(()=>{if(root.contains(figure))draw();});draw();
  });
  function stop(){cancelAnimationFrame(raf);raf=0;playing=false;}
  function draw(){
    const phase=firstFrame?0:setup.seek,m=shifts(setup.travel,setup.spacing,phase);
    if(c){drawLayer(c,layers[0],m.far);drawLayer(c,layers[1],m.near);}
    canvas.dataset.near=String(+Math.abs(m.near).toFixed(3));canvas.dataset.far=String(+Math.abs(m.far).toFixed(3));canvas.dataset.difference=String(+m.difference.toFixed(3));
    const missing=layers.some(layer=>layer.failed),ready=layers.every(layer=>layer.image);
    canvas.dataset.art=ready?'ready':missing?'failed':'loading';
    const direction=m.near===0?'':m.near>0?t(' إلى اليسار',' left'):t(' إلى اليمين',' right');
    caption.textContent=t('نافذة ورشة تركيب الأفلام تطلّ على مصباح المرفأ وقارب مربوط إلى الرصيف.','A film-splicing bench overlooks a harbour lamp and a moored ferry.');
    numbers.textContent=t('حافة النافذة ','Window edge ')+px(Math.abs(m.near))+direction+' · '+t('مصباح المرفأ ','Harbour lamp ')+px(Math.abs(m.far))+direction+' · '+t('الفرق ','Difference ')+px(m.difference);
    canvas.setAttribute('aria-label',caption.textContent+' '+numbers.textContent);
    for(const key of Object.keys(inputs)){const field=inputs[key];field.input.value=setup[key];field.output.value=field.unit(setup[key]);}
    origin.textContent=firstFrame?t('ارجع إلى إطاري','Return to my frame'):t('قارن بالإطار الأول','Compare with first frame');
    origin.setAttribute('aria-pressed',String(firstFrame));play.textContent=playing?t('أوقف مؤقتًا','Pause'):t('شغّل الحركة','Play move');
    if(!completed)delete results.dataset.met;
    reload.hidden=!missing;png.disabled=!ready||!c;save.disabled=!ready||!c;
    const status=!c?t('العرض النصي متاح. تعرض القياسات انتقال كل طبقة.','Text view is available. The readings track each plane.')
      :missing?t('تعذّر تحميل إحدى الطبقات. يبيّن المخطط حركتها ويمكنك تجربة اللقطة.','A plate could not load. The diagram tracks its motion so you can still try the shot.')
      :!ready?t('جارٍ تحضير طبقتي الرسم…','Preparing the two painted planes…'):'';
    if(feedback.textContent!==status)feedback.textContent=status;
  }
  buttons.append(play,origin,restart,check);recovery.append(feedback,reload);exportRow.append(png,save);
  const back=link(t('ارجع إلى ليالي الحبر','Back to Ink Nights'),ui.url('./ink-studio.html'));
  root.append(figure,numbers,brief,form,buttons,timings,results,recovery,exportRow,back);
  function hidden(){if(document.hidden){stop();draw();}}
  document.addEventListener('visibilitychange',hidden);
  window.addEventListener('pagehide',stop);
  changeBrief();if(completed)assess();draw();
  Promise.all(layers.filter(l=>!l.failed).map(loadLayer)).then(()=>{if(root.contains(figure))draw();});
  return ()=>{stop();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',stop);};
}
mount({id:'ink-camera',title,intro:['حرّك نافذة الورشة والمرفأ كطبقتين في لقطة أنمي واحدة.','Move the workshop window and the harbour as two planes in a single anime shot.'],render});
