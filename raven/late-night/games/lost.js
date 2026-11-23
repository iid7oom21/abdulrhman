import {start, el, button, group, canvas, output, box, dot, line, gradient} from './tools.js';

const slug='lost-and-found';
const objects=[
  {kind:'scarf',name:['وشاح أزرق','Blue scarf'],detail:['صوف أزرق، عند طرفه زر معدني دائري.','Blue wool with a round metal button on one end.'],color:'#458aa3',tie:'#d9caa6',button:true},
  {kind:'umbrella',name:['مظلة بنية','Brown umbrella'],detail:['قماش بني ومقبض خشبي، وعلى الرباط خيط أزرق.','Brown canopy, wooden handle, blue thread on its strap.'],color:'#91675a',tie:'#629fcb',wood:true},
  {kind:'scarf',name:['وشاح كهرماني','Amber scarf'],detail:['صوف بلون الكهرمان، ينتهي بهدب أسود.','Amber wool with black fringes.'],color:'#b8905d',tie:'#333135'},
  {kind:'umbrella',name:['مظلة خضراء','Green umbrella'],detail:['قماش أخضر ومقبض خشبي، وعلى الرباط خيط أصفر.','Green canopy, wooden handle, yellow thread on its strap.'],color:'#497868',tie:'#efc359',wood:true},
  {kind:'flask',name:['قارورة شاي','Tea flask'],detail:['أسطوانة خضراء داكنة بغطاء معدني على شكل كوب.','Dark green cylinder with a metal cup-shaped lid.'],color:'#4a6665',tie:'#b4a086'}
];
const cards=[
  {request:['وشاح أزرق بطرفه زر معدني','A blue scarf with a metal button on one end'],matches:o=>o.kind==='scarf'&&o.button},
  {request:['مظلة بمقبض خشبي','An umbrella with a wooden handle'],detail:['الرباط عليه خيط أزرق.','There is blue thread on its strap.'],matches:o=>o.kind==='umbrella'&&o.wood}
];
const fresh=()=>({index:0,active:0,seen:[],answers:[null,null],clarified:false,finished:false});
let state=fresh(),moving=false,raf=0,startTime=0,phase=0,restored=false,announcement='',view=null,saved=false;
const positive=(n,max)=>Number.isInteger(n)&&n>=0&&n<max;
function eligible(card) {
  return objects.flatMap((o,i)=> cards[card].matches(o)&&(!state.clarified||card!==1||o.tie==='#629fcb')?[i]:[]);
}
function verdict(card){
  const answer=state.answers[card], possible=eligible(card);
  if(answer===null)return 'open';
  if(answer==='more')return 'pending';
  return possible.length===1&&possible[0]===answer?'returned':'unmatched';
}
const labels={
  open:['بقي الطلب مفتوحًا','Claim open'],
  pending:['محفوظ لحين وصول وصف أدق','Held for a closer description'],
  returned:['أُعيد الغرض المطابق','Matching item returned'],
  unmatched:['الغرض المختار لا يطابق الطلب','Chosen item does not match the claim']
};
const notice={
  inspect:['وُضع الغرض تحت ضوء الفحص.','Item on the inspection light.'],
  returned:['سُجّل التسليم لهذه البطاقة.','Handover recorded for this claim.'],
  ambiguous:['الوصف ينطبق على مظلتين. يمكنك انتظار تفصيل من صاحب الطلب.','Two umbrellas fit this description. You can hold the claim for one more detail.'],
  held:['سُجّل طلب التفصيل. يمكنك ترك المظلتين في الخزانة.','Request for detail recorded. Both umbrellas can stay in the cabinet.'],
  followup:['رد صاحب الطلب مُتاح الآن.','The claimant’s reply is now available.']
};
function paintItem(c,obj,x,y,scale){
  c.save();c.translate(x,y);c.scale(scale,scale);
  if(obj.kind==='umbrella'){
    c.rotate(-.14);
    line(c,'#b18b5b',8,[[-78,2],[-90,7],[-98,3],[-99,-6],[-94,-13]]);
    line(c,'#8e7356',4,[[-79,2],[90,2]]);
    c.fillStyle=obj.color;c.beginPath();c.moveTo(-76,2);c.bezierCurveTo(-62,-21,-18,-22,80,0);c.bezierCurveTo(41,10,-13,14,-76,2);c.fill();
    line(c,'#c2ad8f',1,[[-60,-3],[20,-8],[78,0]]);
    line(c,obj.tie,5,[[-21,-16],[-21,9],[-36,18]]);
  } else if(obj.kind==='scarf'){
    c.rotate(-.12);box(c,obj.color,-69,-18,133,32);box(c,'#0002',-63,8,115,6);
    for(let k=0;k<8;k++){const y=-17+k*4;line(c,obj.color,2,[[-69,y],[-77-k%3,y+2]]);line(c,obj.color,2,[[64,y],[70+k%3,y+3]]);}
    for(let i=0;i<4;i++)box(c,'#c3c0a5',-54+i*5,-18,1,31);
    if(obj.button){dot(c,'#d2caaf',48,-3,7);dot(c,'#554d45',46,-4,1.5);dot(c,'#554d45',50,-2,1.5);}
  } else {
    c.rotate(-.18);box(c,'#2f3b3a',-43,-20,77,40);box(c,obj.color,-48,-17,94,34);
    box(c,'#b3ad9a',34,-14,22,28);box(c,'#89958d',48,-11,13,22);box(c,'#697e77',-38,-14,9,29);
  }
  c.restore();
}
function draw(screen){
  const c=screen.getContext('2d');if(!c)return;
  gradient(c,'#14272d','#60716a');
  for(let i=0;i<5;i++){
    const x=i*141-30;box(c,'#2c4144',x,19,127,113);box(c,'#425452',x+5,23,117,98);
    for(let a=0;a<4;a++)box(c,'#314746',x+8+a*30,90-a%2*17,18,28+a%2*17);
    box(c,'#738479',x+64,25,2,91);
  }
  const light=c.createRadialGradient(320,90,3,320,90,180);
  light.addColorStop(0,'#f6d6a345');light.addColorStop(1,'#d8be7c00');c.fillStyle=light;c.fillRect(124,0,390,200);
  box(c,'#394644',0,140,640,37);box(c,'#8d9785',0,175,640,5);
  box(c,'#2b3637',0,180,640,92);box(c,'#76827a',0,270,640,8);box(c,'#162c30',0,282,640,38);
  const scroll=(phase*250)%32;for(let i=-1;i<=21;i++){const x=i*32-scroll;line(c,'#56615b',2,[[x+9,182],[x-9,269]]);}
  const center=320-phase*250;
  for(let i=-2;i<=2;i++){
    const id=(state.index+i+objects.length)%objects.length;const x=center+i*250;
    c.fillStyle='#17232670';c.beginPath();c.ellipse(x,228,79,8,0,0,Math.PI*2);c.fill();paintItem(c,objects[id],x,217,i===0?1.17:.9);
  }
  box(c,'#d3af71',208,165,225,5);
  for(const x of [208,431])line(c,'#deb87d',2,[[x,148],[x,165]]);
}
function stop(){cancelAnimationFrame(raf);moving=false;phase=0;}
function render(ui) {
  stop();
  if (!restored && ui.editData && Array.isArray(ui.editData.answers)) {
    const data=ui.editData;
    state.index=positive(data.index,objects.length)?data.index:0;
    state.seen=Array.isArray(data.seen)?data.seen.filter(i=>positive(i,objects.length)):[];
    state.answers=cards.map((_,i)=>positive(data.answers[i],objects.length)||data.answers[i]==='more'?data.answers[i]:null);
    state.clarified=data.clarified===true;
  }
  restored=true;
  const {root,t}=ui;view=ui;
  const localized=obj=>t(...obj), item=objects[state.index], active=state.active;
  const screen=canvas(localized(item.name));screen.dataset.game='belt';draw(screen);
  root.replaceChildren(screen);
  if(state.finished){
    const report=el('ol');
    cards.forEach((card,i)=>{
      const a=state.answers[i],v=verdict(i);
      const row=el('li',localized(card.request)+' — '+(typeof a==='number'?localized(objects[a].name)+' · ':'')+localized(labels[v]));
      row.dataset.verdict=v;report.append(row);
    });
    const save=button('save',saved?t('حُفظ المحضر في دفترك','Log saved to your notebook'):t('احفظ المحضر','Save the handover log'),()=>{
      const piece=ui.savePiece({title:t('محضر خزانة المفقودات','Lost-property shift log'),type:slug,data:structuredClone(state),thumbnail:screen.toDataURL('image/webp',.7)});
      if(piece){saved=true;save.disabled=true;save.textContent=t('حُفظ المحضر في دفترك','Log saved to your notebook');}
    });
    save.disabled=saved;
    root.append(el('h2',t('محضر نهاية الوردية','End of shift')),report,
      group(save,
        button('revise',t('راجع طلبًا','Review a claim'),()=>{state.finished=false;saved=false;render(ui);}),
        button('replay',t('ابدأ وردية جديدة','Start a new shift'),()=>{state=fresh();announcement='';saved=false;render(ui);})));
    return;
  }
  const switcher=group();
  cards.forEach((card,i)=>{
    const b=button('claim-'+(i+1),t('بطاقة ','Claim ')+(i+1),()=>{state.active=i;announcement='';render(ui);});
    b.setAttribute('aria-pressed',String(i===active));switcher.append(b);
  });
  const claim=el('p',localized(cards[active].request)+(state.clarified&&active===1?' — '+localized(cards[1].detail):''),'game-note');
  claim.dataset.game='request';
  const current=el('p',t('تحت الضوء: ','On the belt: ')+localized(item.name));current.dataset.game='current-item';
  const detail=output(state.seen.includes(state.index)?localized(item.detail):'');detail.dataset.game='inspection';
  const belt=button('belt-toggle',t('شغّل السير','Run the belt'),()=>{
    if(moving){stop();draw(screen);belt.textContent=t('شغّل السير','Run the belt');return;}
    moving=true;startTime=performance.now();belt.textContent=t('أوقف السير','Pause the belt');
    function tick(now){
      if(!moving || view!==ui || !screen.isConnected)return;
      const elapsed=now-startTime;
      if(elapsed>=4200){
        state.index=(state.index+1)%objects.length;startTime=now;phase=0;refreshBeltText();
      } else phase=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.max(0,(elapsed-3400)/800);
      draw(screen);raf=requestAnimationFrame(tick);
    }
    raf=requestAnimationFrame(tick);
  });
  function refreshBeltText(){
    const o=objects[state.index];current.textContent=t('تحت الضوء: ','On the belt: ')+localized(o.name);
    detail.textContent=state.seen.includes(state.index)?localized(o.detail):'';
    screen.setAttribute('aria-label',localized(o.name));returnItem.disabled=!state.seen.includes(state.index);
  }
  const returnItem=button('return-item',t('سلّم هذا الغرض للطلب','Assign this item to the claim'),()=>{
    const possible=eligible(active);
    if(possible.includes(state.index)&&possible.length>1){announcement='ambiguous';}
    else {state.answers[active]=state.index;announcement='returned';}
    render(ui);
  });
  returnItem.disabled=!state.seen.includes(state.index);
  root.append(switcher,claim,current,group(belt,
    button('inspect',t('تأمّل الغرض عن قرب','Inspect the item'),()=>{if(!state.seen.includes(state.index))state.seen.push(state.index);announcement='inspect';render(ui);}),
    button('next-item',t('دع الغرض يمر','Let the item pass'),()=>{state.index=(state.index+1)%objects.length;announcement='';render(ui);})),detail,group(returnItem));
  if(active===1 && !state.clarified){
    if(state.answers[1]!=='more')root.append(group(button('ask-detail',t('أحتاج وصفًا إضافيًا','Ask for another detail'),()=>{state.answers[1]='more';announcement='held';render(ui);})));
    else root.append(group(button('read-reply',t('اقرأ الوصف الإضافي','Read the extra detail'),()=>{state.clarified=true;announcement='followup';render(ui);})));
  }
  const status=el('p',localized(labels[verdict(active)])+(announcement?' · '+localized(notice[announcement]):''));status.dataset.game='claim-state';
  root.append(status,group(button('finish',t('أنه الوردية وراجع الطلبين','End the shift and review both claims'),()=>{
    state.finished=true;ui.recordEvent({ar:'انتهت وردية المفقودات',en:'Lost-property shift ended',data:{claims:cards.map((_,i)=>verdict(i))}});render(ui);
  })));
}
window.addEventListener('pagehide',stop);
start(4,slug,['خزانة المفقودات','Lost and found'],['تتبّع أغراض المحطّة تحت ضوء السير، ثم قرر ماذا تعيد لأصحاب بطاقتي الوصف.','Watch the parcels pass under the station lamp and decide what to return to each claimant.'],render);
