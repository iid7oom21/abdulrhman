import {action, element, link, mount} from '../night-shell.js';
import {download} from '../night-store.js';

const title = ['صفحة قبل الفجر','A page before dawn'];
const ending = ['بقي شيءٌ من الليل على الورق.','A little of the night stayed on the paper.'];
const panels = [
  {id:'window', title:['النافذة','The window'], alt:['وراء زجاج المطبعة، يربط قارب صغير الرصيف بآخر الليل.','A small boat rests at the quay beyond the print shop window.']},
  {id:'type', title:['قالب الطباعة','Setting the type'], alt:['يد تجمع قوالب معدنية محفورة في مسطرة التنضيد.','A hand sets engraved metal blocks into a composing stick.']},
  {id:'press', title:['دورة المكبس','A turn of the press'], alt:['يمسك العامل مقبض المكبس وتدور العجلة بجانب كتفه.','The printmaker turns the handle beside the press flywheel.']},
  {id:'drying', title:['الطبعة المعلّقة','The drying print'], alt:['تتدلّى طبعة قارب من مشبكين عند النافذة مع ضوء الصباح.','Two clips hold a print of a boat at the window in the morning light.']}
];
const findPanel = id => panels.find(panel => panel.id === id);
const urlFor = id => new URL('./art/panel-' + id + '.webp', import.meta.url);
const images = new Map();
let selection = [], direction, caption = false, preview = false, restored = false, saved = false;
let refreshArt = () => {};

function checkedSelection(data) {
  return Array.isArray(data?.panels) && data.panels.length === 3 &&
    new Set(data.panels).size === 3 && data.panels.every(id => findPanel(id)) &&
    ['rtl','ltr'].includes(data.direction) && typeof data.caption === 'boolean';
}

function loadPanel(panel, retry=false) {
  const image = new Image();
  const asset = {image, status:'loading'};
  images.set(panel.id, asset);
  image.onload = () => { asset.status = 'ready'; refreshArt(); };
  image.onerror = () => { asset.status = 'failed'; refreshArt(); };
  const url=urlFor(panel.id);
  if(retry) url.searchParams.set('retry',Date.now());
  image.src=url;
}

function face(size, weight=400) {
  return weight + ' ' + size + 'px NightPlex, Tahoma, Arial, sans-serif';
}

function wrappedText(ctx, text, x, y, width, spacing) {
  let line = '';
  for (const word of text.split(' ')) {
    if (line && ctx.measureText(line + ' ' + word).width > width) {
      ctx.fillText(line,x,y);
      y += spacing;
      line = word;
    } else line += (line ? ' ' : '') + word;
  }
  if (line) ctx.fillText(line,x,y);
}

function drawPanel(ctx,panel,x,y,w,h,ui) {
  const asset = images.get(panel.id);
  if (asset.status === 'ready') {
    const {image}=asset;
    const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);
    const sourceWidth=w/scale, sourceHeight=h/scale;
    const cropY = {window:.49,type:.52,press:.49,drying:.48}[panel.id];
    ctx.drawImage(image,(image.naturalWidth-sourceWidth)/2,(image.naturalHeight-sourceHeight)*cropY,
      sourceWidth,sourceHeight,x,y,w,h);
  } else {
    ctx.fillStyle='#e5e2d9'; ctx.fillRect(x,y,w,h);
    ctx.fillStyle='#232423'; ctx.font=face(24); ctx.textAlign='center'; ctx.direction=ui.t('rtl','ltr');
    wrappedText(ctx,ui.t(...panel.alt),x+w/2,y+h/2-18,w-46,37);
  }
  ctx.strokeStyle='#262624'; ctx.lineWidth=3; ctx.strokeRect(x+1.5,y+1.5,w-3,h-3);
}

function drawSheet(canvas,ui) {
  const ctx=canvas.getContext('2d');
  if (!ctx) return false;
  const w=canvas.width;
  ctx.fillStyle='#f5f2e9'; ctx.fillRect(0,0,w,canvas.height);
  ctx.direction=ui.t('rtl','ltr'); ctx.textAlign=ui.t('right','left');
  ctx.font=face(39,600); ctx.fillStyle='#20221e';
  ctx.fillText(ui.t(...title),ui.t(w-34,34),67);
  const secondX=direction==='rtl'?448:32, thirdX=direction==='rtl'?32:448;
  drawPanel(ctx,findPanel(selection[0]),32,104,816,412,ui);
  drawPanel(ctx,findPanel(selection[1]),secondX,533,400,400,ui);
  drawPanel(ctx,findPanel(selection[2]),thirdX,533,400,400,ui);
  if (caption) {
    const text=ui.t(...ending);
    ctx.font=face(17,500);
    const boxWidth=Math.min(376,Math.ceil(ctx.measureText(text).width+30));
    const x=ui.lang==='ar'?thirdX+388-boxWidth:thirdX+12;
    ctx.fillStyle='#f5f2e9';ctx.fillRect(x,881,boxWidth,39);
    ctx.lineWidth=1.5;ctx.strokeStyle='#242420';ctx.strokeRect(x,881,boxWidth,39);
    ctx.textAlign='center';ctx.fillStyle='#171816';ctx.fillText(text,x+boxWidth/2,906,boxWidth-16);
  }
  ctx.font='14px Georgia, serif';ctx.fillStyle='#56564f';ctx.direction='ltr';ctx.textAlign='left';
  ctx.fillText('RAVEN',32,963);
  ctx.font=face(16);ctx.direction=ui.t('rtl','ltr');ctx.textAlign='right';
  ctx.fillText(readingLabel(ui),848,963);
  return true;
}
function readingLabel(ui) {
  return direction==='rtl'?ui.t('قراءة من اليمين إلى اليسار','Read right to left'):ui.t('قراءة من اليسار إلى اليمين','Read left to right');
}

function render(ui) {
  const {root,t}=ui;
  direction ??= t('rtl','ltr');
  if (!restored) {
    restored=true;
    if (checkedSelection(ui.editData)) {
      selection=[...ui.editData.panels]; direction=ui.editData.direction; caption=ui.editData.caption; preview=true;
    }
    for(const panel of panels)loadPanel(panel);
  }
  const back=link(t('العودة إلى ليالي الحبر','Back to Ink Nights'),ui.url('ink-studio.html'));
  const controls=(...nodes)=>{const row=element('div',null,'ink-controls');row.append(...nodes);return row;};
  const button=(id,label,onClick,cls)=>{const node=action(label,onClick,cls);node.dataset.page=id;return node;};
  const readout=element('p',null,'ink-result');readout.setAttribute('role','status');
  function choiceGroup(label,options,current,change) {
    const group=controls();group.setAttribute('role','group');group.setAttribute('aria-label',label);
    for(const [value,name,id] of options) {
      const b=button(id,name,()=>{change(value);saved=false;render(ui);root.querySelector('[data-page="'+id+'"]').focus({preventScroll:true});});
      b.setAttribute('aria-pressed',String(value===current));group.append(b);
    }
    return group;
  }
  const retry=element('div',null,'ink-controls');
  const relevant=()=>preview?selection:panels.map(panel=>panel.id);
  function failures() {
    retry.replaceChildren();
    for(const id of relevant()) {
      if (images.get(id).status!=='failed') continue;
      const panel=findPanel(id);
      retry.append(button('retry-'+id,t('أعد تحميل لقطة ','Reload panel · ')+t(...panel.title),()=>{
        loadPanel(panel,true);refreshArt();
      }));
    }
  }
  root.replaceChildren();
  if (!preview) {
    const instruction=element('h2',t('اختر ثلاث لقطات بالترتيب','Choose three panels in order'));
    const gallery=element('div',null,'ink-strip');
    const pickButtons=new Map();
    const chosen=element('p',null,'ink-result');
    chosen.setAttribute('role','status');chosen.dataset.page='sequence';
    const previewButton=button('preview',t('عاين صفحتي','Preview my page'),()=>{
      if(selection.length!==3) return;
      preview=true;render(ui);
      root.querySelector('h2').focus();
    },'primary');
    function updatePicks() {
      for(const [id,b] of pickButtons) {
        const position=selection.indexOf(id);
        b.setAttribute('aria-pressed',String(position!==-1));
        b.disabled=position===-1&&selection.length===3;
        const name=t(...findPanel(id).title);
        const label=position===-1?name:(position+1)+' · '+name;
        b.lastElementChild.textContent=label;b.setAttribute('aria-label',label);
      }
      chosen.textContent=selection.length?selection.map((id,i)=>(i+1)+' · '+t(...findPanel(id).title)).join('   /   '):
        t('اضغط أي لقطة لإضافتها، ومرة أخرى لإزالتها.','Tap a panel to add it, and tap it again to remove it.');
      previewButton.disabled=selection.length!==3;
    }
    for(const panel of panels) {
      const b=button('pick-'+panel.id,'',()=>{
        if(selection.includes(panel.id)) selection=selection.filter(id=>id!==panel.id);
        else if(selection.length<3)selection.push(panel.id);
        saved=false;updatePicks();
      },'ink-card');
      const description=element('span',t(...panel.alt));description.id='description-'+panel.id;
      description.hidden=true;b.setAttribute('aria-describedby',description.id);
      const photo=images.get(panel.id).image;photo.alt='';
      const label=element('span');b.append(photo,description,label);pickButtons.set(panel.id,b);gallery.append(b);
    }
    root.append(instruction,gallery,chosen,
      element('h3',t('اتجاه القراءة','Reading direction')),
      choiceGroup(t('اتجاه القراءة','Reading direction'),[['rtl',t('من اليمين','Right to left'),'rtl'],['ltr',t('من اليسار','Left to right'),'ltr']],direction,v=>direction=v),
      element('h3',t('آخر لقطة','Closing panel')),
      choiceGroup(t('آخر لقطة','Closing panel'),[[false,t('اتركها صامتة','Leave it silent'),'silent'],[true,t(...ending),'caption']],caption,v=>caption=v),
      controls(previewButton,back),retry);
    updatePicks();
    refreshArt=()=>{
      failures();
      for(const panel of panels) {
        const photo=pickButtons.get(panel.id).firstElementChild,asset=images.get(panel.id);
        if(photo!==asset.image) photo.replaceWith(asset.image);
        asset.image.alt='';asset.image.hidden=asset.status==='failed';
        pickButtons.get(panel.id).children[1].hidden=asset.status!=='failed';
      }
    };
  } else {
    const figure=element('figure',null,'ink-stage');
    const canvas=element('canvas');canvas.width=880;canvas.height=984;canvas.dataset.page='sheet';
    canvas.dataset.panels=selection.join(',');canvas.dataset.direction=direction;
    canvas.setAttribute('role','img');canvas.setAttribute('tabindex','-1');
    const heading=element('h2',t('صفحتك','Your page'));heading.tabIndex=-1;
    const order=element('figcaption',readingLabel(ui)+' · '+selection.map(id=>t(...findPanel(id).title)).join(' / '));
    canvas.setAttribute('aria-label',selection.map(id=>t(...findPanel(id).alt)).join(' ')+(caption?' '+t(...ending):''));
    figure.append(canvas,order);
    const edit=button('edit',t('عدّل الصفحة','Edit page'),()=>{
      preview=false;render(ui);
      root.querySelector('[data-page="pick-'+selection[0]+'"]').focus({preventScroll:true});
    });
    const png=button('png',t('نزّل الصفحة PNG','Download page PNG'),async()=>{
      await document.fonts.ready;
      if(!canvas.isConnected||!drawSheet(canvas,ui))return;
      canvas.toBlob(blob=>{
        if(blob) download('raven-before-dawn.png',blob,'image/png');
        else readout.textContent=t('تعذّر إنشاء الصورة. أعد المحاولة أو احفظ ترتيبك في الدفتر.','The image could not be created. Try again or keep your arrangement in the portfolio.');
      },'image/png');
    },'primary');
    const save=button('save',t('احفظ في دفتر أعمالي','Save to my portfolio'),()=>{
      const thumb=element('canvas');thumb.width=176;thumb.height=197;
      const ctx=thumb.getContext('2d');
      if(ctx)ctx.drawImage(canvas,0,0,176,197);
      const record=ui.savePiece({title:t(...title),type:'ink-page',data:{panels:[...selection],direction,caption},
        thumbnail:ctx?thumb.toDataURL('image/webp',.75):undefined});
      if(record){saved=true;save.disabled=true;}
    });
    save.disabled=saved;
    root.append(heading,figure,readout,retry,controls(png,save,edit,back));
    refreshArt=()=>{
      const ready=selection.every(id=>images.get(id).status==='ready');
      const rendered=drawSheet(canvas,ui);png.disabled=!ready||!rendered;
      failures();
      readout.textContent=ready?'':t('يظهر وصف اللقطة إلى أن تجهز صورتها للطباعة.','The panel description stands in until its artwork is ready to print.');
    };
    document.fonts.ready.then(()=>{if(canvas.isConnected) refreshArt();});
  }
  refreshArt();
}
mount({id:'ink-page',title,intro:['ركّب صفحة مانغا من وردية ليلية في مطبعة الميناء.','Compose a manga page from a night shift at the harbour print shop.'],render});
