import {W,H,clamp,one,table,act,picker,input,range,options,tabs,node,rect,poly,line,ellipse,sky,text,grain} from './screencraft-ui.js';

const FRAME_SECONDS=6;
function station(c){
  sky(c,'#263e4c','#ebba7e');
  const glow=c.createRadialGradient(465,186,8,465,186,230);glow.addColorStop(0,'#ffdd98');glow.addColorStop(1,'#9e9a8840');rect(c,glow,0,0,W,H);
  for(let i=0;i<16;i++){
    const x=i*46-20,y=136+Math.sin(i*1.71)*26;
    rect(c,'#61716f',x,y,41,100);rect(c,'#536969',x-2,y-3,44,4);
    for(let j=0;j<4;j++)for(let k=0;k<3;k++)rect(c,(i+j+k)%4?'#788480':'#e0bd83',x+5+j*9,y+9+k*15,4,7);
  }
  rect(c,'#354e51',0,220,W,35);poly(c,'#46555a',[[0,245],[640,217],[640,308],[0,308]]);
  for(let i=-80;i<720;i+=101){
    poly(c,'#f6dca317',[[i,4],[i+24,4],[i-78,236],[i-108,243]]);
    line(c,'#283b40',4,[i,0],[i,231]);line(c,'#99aaa1',1,[i+3,0],[i+3,231]);
  }
  poly(c,'#1f343a',[[0,0],[640,0],[640,19],[0,52]]);
  line(c,'#ddc5a1',2,[0,54],[640,20]);line(c,'#283f44',7,[0,235],[640,215]);
  for(let i=0;i<5;i++)line(c,'#c0a37b5c',1,[i*188-128,H],[232+i*80,228]);
}
function passer(c,x,p){
  ellipse(c,'#29353a60',x+6,264,39,6);
  const stride=Math.sin(12*Math.PI*p)*9;
  poly(c,'#263439',[[x-13,206],[x+14,206],[x+14+stride,261],[x+7+stride,261],[x+1,223],[x-11-stride,260],[x-18-stride,259]]);
  poly(c,'#25353a',[[x-7,114],[x+7,114],[x+19,130],[x+25,196],[x+12,218],[x-21,219],[x-24,178],[x-17,133]]);
  poly(c,'#45524f',[[x-15,129],[x-20,155],[x-23,179],[x-18,192],[x-11,146]]);
  ellipse(c,'#27383b',x,101,11,16);ellipse(c,'#304145',x-1,92,11,7);rect(c,'#293a3d',x-5,113,10,11);
}
const wordsFor=(s,lang)=>[s.first|| (lang==='ar'?'ضوء':'Night'),s.second||(lang==='ar'?'عابر':'Glass')];
function titleGeometry(c,s,t,lang,pocket=false){
  const size=pocket?37:45;
  const words=wordsFor(s,lang),p=t/FRAME_SECONDS;
  c.font='750 '+size+'px system-ui,sans-serif';
  const widths=words.map(w=>c.measureText(w).width);
  const gap=14,total=widths[0]+widths[1]+gap;
  const cx=320+(s.track==='drift'?(p-.5)*164:s.track==='reverse'?(.5-p)*164:0);
  const x=lang==='ar'?[cx+total/2-widths[0]/2,cx-total/2+widths[1]/2]:[cx-total/2+widths[0]/2,cx+total/2-widths[1]/2];
  const clip=pocket?[195,445]:[0,W],person=-45+p*730;
  const show=t>=s.enter, behind=s.plane==='back';
  const visible=x.map((v,i)=>{
    const low=v-widths[i]/2,high=v+widths[i]/2;
    return show&&low>=clip[0]&&high<=clip[1]&&(!behind||low>person+23||high<person-23);
  });
  return {words,x,size,show,person,visible};
}
function drawTitle(c,s,time,lang,pocket=false){
  station(c);const g=titleGeometry(c,s,time,lang,pocket);
  function lettering(){
    if(!g.show)return;
    for(let i=0;i<2;i++){
      text(c,g.words[i],g.x[i],174,g.size,'#fcf0d3',750);
      if(s.reflect){c.save();c.translate(0,365);c.scale(1,-.9);text(c,g.words[i],g.x[i]+4,179,g.size,'#e5ce955e',750);c.restore();}
    }
  }
  if(s.plane==='back')lettering();passer(c,g.person,time/FRAME_SECONDS);if(s.plane==='front')lettering();
  grain(c);
  if(pocket){
    rect(c,'#101b20de',0,0,195,H);rect(c,'#101b20de',445,0,195,H);
    line(c,'#e1d4ba',1,[195,0],[195,H]);line(c,'#e1d4ba',1,[445,0],[445,H]);
  }
}
function titleTake(s={},reflection=false){
  const word=v=>typeof v==='string'?v.trimStart().split(/\s+/u)[0].slice(0,14):'';
  return {first:word(s?.first),second:word(s?.second),enter:clamp(s?.enter,0,4,.5),
    track:one(s?.track,['still','drift','reverse']),plane:one(s?.plane,['back','front']),reflect:typeof s?.reflect==='boolean'?s.reflect:reflection};
}
let titleEdit=null;
export function titles(ui){
  const {t,lang}=ui,old=ui.load('titles',{})||{};
  const state={take:one(old.take,['A','B']),view:one(old.view,['wide','pocket']),A:titleTake(old.A),B:titleTake(old.B,true)};
  const pieceID=ui.params.get('nightPiece');
  const forEvening=ui.params.get('nightEvening')==='1';
  let imported=false;
  if(pieceID){
    import('../late-night/night-store.js').then(({pieces})=>{
      const piece=pieces().find(p=>p.id===pieceID && p.activity==='titles'&&p.type==='title');
      if(piece && w.frame.isConnected){
        state[state.take]=titleTake(titleEdit?.id===piece.id?titleEdit.take:piece.data.take);
        imported=true;render();
      }
    });
  }
  let cards=[];
  const current=()=>state[state.take];
  const w=table(ui,t('الاسم يعبر الشاشة','A title crosses the screen'),
    t('اكتب اسمًا من كلمتين على زجاج المحطة. جمّد مرور الشخص لتختبر أين تُقرأ كل كلمة.','Set two words on the station glass. Freeze the passerby to see where each word can be read.'),
    (c,p)=>{drawTitle(c,current(),p,lang,state.view==='pocket');cards.forEach(([ctx,k])=>drawTitle(ctx,state[k],p,lang,state.view==='pocket'));},()=>FRAME_SECONDS);
  function save(){if(imported)titleEdit={id:pieceID,take:{...current()}};ui.save('titles',state);}
  function feedback(){
    const s=current(), phone=state.view==='pocket', counts=[0,0];
    for(let i=0;i<FRAME_SECONDS*24;i++){
      const g=titleGeometry(w.ctx,s,(i+.5)/24,lang,phone);g.visible.forEach((yes,j)=>{if(yes)counts[j]++;});
    }
    const names=wordsFor(s,lang);
    const font=titleGeometry(w.ctx,s,0,lang,phone).size;
    const px=Math.round(font*(phone?320/250:320/640));
    w.result.textContent=t('وقت القراءة الكامل','Completely visible')+' · '+names.map((word,i)=>word+' '+(counts[i]/24).toFixed(1)+' '+t('ث','s')).join('   /   ')+'\n'+t('عند عرض 320 بكسل، حجم الحرف التقريبي ','At 320px, approximate type size ')+px+' px';
    w.frame.setAttribute('aria-label',names.join(' ')+' · '+t('زجاج محطة ومرور شخص','Station glass and a passing figure'));
  }
  function adjust(key,value){current()[key]=value;save();feedback();w.refresh();}
  function render(){
    const s=current();
    tabs(w,'take',[['A',t('الشارة الأولى','Title A')],['B',t('الشارة الثانية','Title B')]],state.take,k=>{state.take=k;save();render();});
    const titleInput=(key,ar,en)=>{
      const wrap=input(key,t(ar,en),s[key],v=>{const bounded=titleTake({[key]:v})[key];if(bounded!==v)wrap.querySelector('input').value=bounded;adjust(key,bounded);});
      wrap.querySelector('input').placeholder=wordsFor({},lang)[key==='first'?0:1];return wrap;
    };
    w.controls.replaceChildren(titleInput('first','الكلمة الأولى','First word'),titleInput('second','الكلمة الثانية','Second word'),
      picker('plane',t('موضع الحروف','Lettering plane'),options([['back','خلف العابر','Behind the figure'],['front','أمام العابر','In front of the figure']],t),s.plane,v=>adjust('plane',v)),
      picker('track',t('مسار العنوان','Title movement'),options([['still','ثابت','Fixed'],['drift','نحو اليمين','Glide right'],['reverse','نحو اليسار','Glide left']],t),s.track,v=>adjust('track',v)),
      range('enter',t('ثانية الظهور','Entry second'),s.enter,0,4,.1,v=>adjust('enter',v)),
      picker('reflection',t('انعكاس','Reflection'),options([['off','مطفأ','Off'],['on','على الزجاج','On glass']],t),s.reflect?'on':'off',v=>adjust('reflect',v==='on')),
      picker('screen',t('اختبار العرض','Screen test'),options([['wide','شاشة عريضة','Wide screen'],['pocket','قصّة جوال','Phone crop']],t),state.view,v=>{state.view=v;save();feedback();w.refresh();}));
    const compare=node('div',null,'sc-inset');cards=[];
    for(const k of ['A','B']){
      const f=node('figure'),can=node('canvas');can.width=W;can.height=H;can.setAttribute('aria-hidden','true');
      const cap=node('figcaption',k==='A'?t('الشارة الأولى','Title A'):t('الشارة الثانية','Title B'));
      f.append(can,cap);compare.append(f);cards.push([can.getContext('2d'),k]);
    }
    w.controls.append(compare);
    if(forEvening||imported){
      const transfer=act('night-title',forEvening?t('راجع العنوان لأمسيتك','Review title for your evening'):t('احفظ نسخة معدّلة في الدفتر','Save an edited copy to the notebook'),()=>{
        const take={...current()};
        if(!take.first.trim()||!take.second.trim()){
          w.result.textContent=t('اكتب كلمتي عنوانك قبل نقله.','Write both words of your title before transferring.');
          w.controls.querySelector('[data-sc="'+(take.first?'second':'first')+'"]').focus();return;
        }
        const words=[take.first,take.second].join(' '),thumb=w.frame.toDataURL('image/webp',.65);
        const sheet=node('div',null,'sc-inset');
        const confirm=act('night-title-confirm',forEvening?t('انقل هذا العنوان','Transfer this title'):t('أضف هذه النسخة','Add this version'),async()=>{
          confirm.disabled=true;
          try{
            const {writePiece}=await import('../late-night/night-store.js');
            const piece=writePiece('titles',{title:words,type:'title',data:{take},thumbnail:thumb});
            if(!piece)throw Error('save');
            const u=new URL(forEvening?'../late-night/three-evening.html':'../late-night/my-notebook.html',location.href);
            if(forEvening)u.searchParams.set('titlePiece',piece.id);u.searchParams.set('lang',lang);
            const next=node('a',forEvening?t('تابع إلى فصل النوافذ','Continue to the windows chapter'):t('افتح الدفتر','Open notebook'));next.href=u.href;next.target='_top';
            sheet.replaceChildren(node('p',words),next);next.focus();
          }catch{confirm.disabled=false;sheet.append(node('p',t('تعذّر تأكيد الحفظ. يمكنك تنزيل نسخة من العنوان.','Saving could not be confirmed. You can download a copy of the title.')),
              act('copy-title',t('تنزيل نسخة JSON','Download JSON'),async()=>{const {download}=await import('../late-night/night-store.js');download('raven-title.json',{type:'title',title:words,data:{take}}); }));}
        });
        sheet.append(node('p',t('العنوان الذي سينتقل','Title to carry over')+' · '+words),confirm,act('night-title-back',t('رجوع','Back'),render));
        transfer.replaceWith(sheet);confirm.focus();
      });
      w.controls.append(transfer);
    }
    feedback();w.refresh();
  }
  render();w.seek(2.65);
}

const materialList=[['skyline','خط الأفق','Skyline'],['blocks','واجهات المباني','Building fronts'],['columns','أعمدة الرصيف','Platform columns']];
const depths=[['بعيدة','Far'],['وسطى','Middle'],['قريبة','Near']];
function pass(v={},dream=false){
  const layers=Array.isArray(v?.layers)&&v.layers.length===3&&new Set(v.layers).size===3&&v.layers.every(id=>materialList.some(d=>d[0]===id))?v.layers:[...materialList.map(d=>d[0])];
  return {layers:[...layers],speed:[0,1,2].map((_,i)=>clamp(v?.speed?.[i],-80,160,(dream?[115,20,-28]:[12,48,120])[i]))};
}
function city(c,s,time){
  const p=time/5;
  sky(c,'#789c99','#ecce9c');ellipse(c,'#f9dba2',485,68,29,29);
  for(let k=0;k<3;k++){
    const shift=s.speed[k]*p*2, id=s.layers[k];
    if(id==='skyline'){
      for(let i=-12;i<19;i++){
        const x=i*52-shift,y=122+Math.cos(i*2.1)*17;
        rect(c,'#617e7c',x,y,46,82);
        for(let j=0;j<4;j++)line(c,'#77938d',1,[x+4+j*11,y+3],[x+4+j*11,190]);
      }
      const x=430-shift;rect(c,'#486867',x-13,69,26,131);rect(c,'#476765',x-8,57,16,15);line(c,'#415e60',2,[x,45],[x,60]);
      for(let i=0;i<9;i++)rect(c,'#a4ad94',x-10,77+i*11,20,2);
    }else if(id==='blocks'){
      for(let i=-4;i<10;i++){
        const x=i*115-shift+3,y=157+Math.sin(i*1.7)*17;
        rect(c,'#4d6560',x,y,106,83);poly(c,'#7f8c77',[[x-2,y],[x+20,y-9],[x+89,y-9],[x+109,y]]);
        for(let j=0;j<7;j++)for(let l=0;l<3;l++)rect(c,(i+j+l)%5===0?'#e4c68f':'#879786',x+5+j*14,y+7+l*16,6,9);
      }
    }else{
      rect(c,'#324b49',0,248,W,8);
      for(let i=-2;i<5;i++){
        const x=350+i*210-shift;
        poly(c,'#2d4545',[[x-8,18],[x+11,18],[x+6,255],[x-4,255]]);line(c,'#61756a',3,[x-4,30],[x-3,247]);
        poly(c,'#3b5550',[[x-8,75],[x-43,17],[x-34,17],[x-3,57]]);rect(c,'#354c49',x-16,240,34,15);
      }
    }
  }
  poly(c,'#263d3c',[[0,0],[640,0],[640,12],[0,23]]);
  poly(c,'#283d3d',[[0,264],[640,249],[640,308],[0,308]]);
  line(c,'#cbb58b',3,[0,274],[640,257]);line(c,'#576358',2,[0,284],[640,269]);
  poly(c,'#fff3ba15',[[105,22],[167,19],[65,263],[6,263]]);grain(c);
}
export function parallax(ui){
  const {t}=ui,old=ui.load('parallax',{})||{};
  const state={take:one(old.take,['street','dream']),street:pass(old.street),dream:pass(old.dream,true)};
  const cur=()=>state[state.take];
  const w=table(ui,t('مدينة من ثلاث زجاجات','A city in three panes'),
    t('ارسم عمق الرحلة من النافذة. عيّن الرسم لكل لوح واضبط مقدار انزلاقه. يشير الرقم السالب إلى مرور معاكس.','Build depth outside the carriage. Assign a drawing and travel distance to each pane. Negative values reverse its passage.'),
    (c,sec)=>city(c,cur(),sec),()=>5);
  function save(){ui.save('parallax',state);}
  function feedback(){
    const s=cur(),column=s.speed[s.layers.indexOf('columns')],tower=s.speed[s.layers.indexOf('skyline')];
    const delta=tower-column,second=delta>0?200/delta:Infinity;
    const relation=Math.abs(tower)>Math.abs(column)?t('البرج البعيد يقطع مسافة أطول من العمود.','The distant tower travels farther than the column.'):
      Math.abs(tower)===Math.abs(column)?t('البرج والعمود يقطعان مسافة متساوية.','Tower and column travel equal distances.'):
      t('العمود يقطع مسافة أطول من البرج.','The column travels farther than the tower.');
    w.result.textContent=relation+'\n'+(second<=5?t('يتقاطعان عند ','They cross at ')+second.toFixed(2)+' '+t('ث','s'):t('لا يتقاطع البرج والعمود الأوسط خلال المرور.','The tower and middle column do not cross during this pass.'));
    w.frame.setAttribute('aria-label',relation);
    return second;
  }
  function render(){
    const s=cur();tabs(w,'pass',[['street',t('مرور طبيعي','Street pass')],['dream',t('مرور الحلم','Dream pass')]],state.take,v=>{state.take=v;save();render();});
    w.controls.replaceChildren();
    for(let i=0;i<3;i++)w.controls.append(
      picker('layer'+i,t(...depths[i])+' · '+t('اللوح','Pane'),options(materialList,t),s.layers[i],v=>{
        const prev=s.layers.indexOf(v);[s.layers[prev],s.layers[i]]=[s.layers[i],s.layers[prev]];save();render();w.controls.querySelector('[data-sc="layer'+i+'"]').focus();
      }),range('speed'+i,t(...depths[i])+' · '+t('إزاحة اللوح','Pane travel'),s.speed[i],-80,160,1,v=>{s.speed[i]=v;save();feedback();w.refresh();}));
    w.controls.append(act('crossing',t('جمّد أقرب محاذاة','Freeze closest alignment'),()=>{
      const a=feedback();w.seek(clamp(Number.isFinite(a)?a:0,0,5));
    }));feedback();w.refresh();
  }
  render();w.seek(2.5);
}
