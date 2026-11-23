import {start, el, button, group, canvas, output, box, dot, line, gradient} from './tools.js';

const slug = 'last-minute-auction';
const lots = [
  {name:['مصباح المسرح','Stage lamp'], rival:3},
  {name:['عدسة العرض','Projection lens'], rival:3},
  {name:['جهاز العرض المتكامل','All-in-one projector'], rival:8}
];
let sales = [], bid = 0, previous = null, restored = false, saved = false, editRound = 0, recalled = null;
const credits = () => 12 - sales.reduce((sum, sale) => sum + sale.paid, 0);
function ending() {
  const [lamp, lens, projector] = sales.map(s => s.won);
  if (projector) return 'machine';
  if (lamp && lens) return 'assembled';
  if (lamp) return 'shadow';
  return 'unlit';
}
const programs = {
  machine:['عرض الفيلم بجهاز العرض','Film screening with the projector'],
  assembled:['عرض الفيلم بالمصباح والعدسة','Film screening with the lamp and lens'],
  shadow:['عرض ظلال بالمصباح','Shadow show with the stage lamp'],
  unlit:['أُجّل العرض','Screening postponed']
};
function lotArt(c, round, x, scale=1) {
  c.save();c.translate(x,179);c.scale(scale,scale);
  if(round===0){
    box(c,'#172127',-50,29,97,8);box(c,'#937450',-3,-8,7,40);
    line(c,'#b79968',6,[[-39,-40],[-28,-2],[16,-2],[40,-35]]);
    c.rotate(-.21);box(c,'#51565a',-43,-64,70,40);box(c,'#888378',-35,-57,19,26);
    c.fillStyle='#c3a470';c.beginPath();c.moveTo(25,-63);c.lineTo(53,-73);c.lineTo(53,-17);c.lineTo(25,-25);c.fill();
    line(c,'#e6cea1',6,[[52,-70],[52,-20]]);
  } else if(round===1){
    box(c,'#323234',-70,24,141,14);
    line(c,'#ac8e61',7,[[-58,26],[-43,-8],[28,-8],[51,26]]);
    for(let k=0;k<8;k++)dot(c,k%2?'#4e5757':'#252e33',-18+k*4,-33,40);
    dot(c,'#c7b08a',14,-33,39);dot(c,'#3f6268',14,-33,32);dot(c,'#669ba0',7,-40,16);dot(c,'#bccac2',4,-49,5);
  } else {
    box(c,'#a88c61',-63,21,127,9);box(c,'#45494b',-55,-30,107,54);
    box(c,'#343d40',49,-21,28,23);box(c,'#a99777',73,-24,6,28);
    for(const x of [-29,29]){
      dot(c,'#c2a981',x,-58,31);dot(c,'#423f41',x,-58,26);
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;dot(c,'#b39b78',x+15*Math.cos(a),-58+15*Math.sin(a),6);}
      dot(c,'#d4ba8f',x,-58,4);
    }
    for(let x=-37;x<15;x+=7)box(c,'#858273',x,-16,3,23);
  }
  c.restore();
}
function draw(screen, round, balance) {
  const c = screen.getContext('2d');
  if (!c) return;
  gradient(c,'#101820','#4c4340');
  for(let x=0;x<640;x+=20){
    box(c,x%60===0?'#283137':'#212a31',x,0,2,223);
    line(c,'#302f32',1,[[x,0],[x+3,107],[x+1,223]]);
  }
  const beam=c.createRadialGradient(342,148,4,342,148,230);
  beam.addColorStop(0,'#ffe0a540');beam.addColorStop(1,'#c89d5e00');c.fillStyle=beam;c.fillRect(0,0,640,245);
  box(c,'#352927',0,224,640,96);
  for(let i=0;i<6;i++)line(c,'#584037',2,[[0,230+i*14],[640,226+i*15]]);
  box(c,'#b49669',191,215,266,6);box(c,'#231d20',200,221,250,11);
  if (round<3) lotArt(c,round,325);
  else if (ending()==='assembled') {lotArt(c,0,263,.84);lotArt(c,1,379,.84);}
  else if (ending()==='shadow') lotArt(c,0,325);
  else if (ending()==='machine') lotArt(c,2,325);
  for(let i=0;i<balance;i++){const x=35+12*i;box(c,'#d8ae74',x,259,19,23);line(c,'#7e603f',1,[[x+4,264],[x+4,276]]);}
  c.fillStyle='#d0b895';c.font='18px monospace';c.textAlign='right';c.fillText(String(Math.min(round+1,3)).padStart(2,'0')+' / 03',601,281);
}
function render(ui) {
  const {root,t}=ui;
  if (!restored && ui.editData?.sales && Array.isArray(ui.editData.sales)) {
    let cash=12;
    sales=ui.editData.sales.slice(0,3).map((entry,index)=>{
      const bid=Math.min(cash,Math.max(0,Math.trunc(Number(entry?.bid)||0)));
      const won=bid>lots[index].rival, paid=won?lots[index].rival+1:0;
      cash-=paid;
      return {bid,won,paid};
    });
  }
  restored=true;
  const after=sales.length===3, round=sales.length;
  const screen=canvas(t('منضدة المزاد والقطعة المعروضة','Auction table and current lot'));
  draw(screen,round,credits());
  if(after)screen.setAttribute('aria-label',t(...programs[ending()]));
  root.replaceChildren(screen);
  root.append(el('p',t('برنامج الليلة يحتاج جهاز عرض، أو مصباحًا وعدسة معًا. يصلح المصباح وحده لعرض ظلال.','Tonight’s film needs a projector, or a lamp and lens together. A lamp alone can stage a shadow show.')));
  const schedule=el('ol');
  for (const [i,lot] of lots.entries()) {
    const sale=sales[i];
    const label=t(...lot.name);
    const details=sale
      ? t('عرضك '+sale.bid+' · عرض الخصم '+lot.rival+' · دفعت '+sale.paid,'Your bid '+sale.bid+' · rival '+lot.rival+' · paid '+sale.paid)
      : i===round ? t('المزاد مفتوح','Bidding open') : t('لاحقًا','Upcoming');
    const item=el('li',label+' — '+details);item.dataset.lot=String(i+1);schedule.append(item);
  }
  root.append(schedule);
  const balance=el('p',t('المتبقي من ١٢ قسيمة: ','Remaining of 12 vouchers: ')+credits(),'game-note');
  balance.dataset.balance=String(credits()); root.append(balance);
  if (!after) {
    const label=el('label',t('حدّ مزايدتك على ','Maximum bid for ')+t(...lots[round].name)+' ');
    const selector=el('select');selector.dataset.game='bid';
    for(let i=0;i<=credits();i++){const option=el('option',i===0?t('أمرّر هذه الجولة','Pass this lot'):String(i));option.value=String(i);selector.append(option);}
    selector.value=String(bid);selector.onchange=()=>{bid=Number(selector.value);};
    label.append(selector);
    const close=button('close-round',t('أغلق الجولة','Close the round'),()=>{
      const rival=lots[round].rival,won=bid>rival;
      sales.push({bid,won,paid:won?rival+1:0});
      bid=Math.min(credits(),recalled?.[sales.length]?.bid || 0);
      if(sales.length===3)ui.recordEvent({ar:programs[ending()][0],en:programs[ending()][1],data:{lots:sales.map(s=>s.paid)}});
      render(ui);
    });
    root.append(group(label,close),el('p',t('يفوز العرض الأعلى. إذا فزت، تدفع قسيمة فوق عرض الخصم. التعادل للخصم.','The higher bid wins. Pay one voucher above the rival bid when you win. Ties go to the rival.')));
    return;
  }
  const outcome=ending(),paid=12-credits(),heading=output(t(...programs[outcome]));
  heading.dataset.outcome=outcome;
  const decision={
    assembled:t('شراء العدسة في الجولة الثانية أكمل المصباح الذي حجزته.','Buying the lens in round two completed your lamp setup.'),
    machine:t('احتفظت بتسع قسائم على الأقل للجهاز وفزت به في الجولة الثالثة.','You kept at least nine vouchers and won the projector in round three.'),
    shadow:t('اشتريت المصباح وحده. أمكن عرض الظلال على الجدار.','You secured the lamp alone and could put shadows on the wall.'),
    unlit:t('انتهت الجولة الثالثة من دون جهاز أو مصباح؛ تعذّر إسقاط صورة.','Round three ended without a projector or lamp to cast an image.')
  };
  root.append(heading,el('p',t('أنفقت ','You spent ')+paid+t(' من ١٢. ',' of 12. ')+decision[outcome]));
  if(previous)root.append(el('p',t('في المحاولة السابقة: ','Previous run: ')+t(...programs[previous.outcome])+' · '+previous.paid));
  const review=el('details'), summary=el('summary',t('عدّل عرضًا من هذه الأمسية','Edit a bid from this screening'));
  const choice=el('select');choice.dataset.game='edit-lot';
  const prompt=el('label',t('الجولة ','Round '));prompt.append(choice);
  lots.forEach((lot,i)=>{const opt=el('option',t(...lot.name));opt.value=String(i);choice.append(opt);});
  choice.value=String(editRound);choice.onchange=()=>{editRound=Number(choice.value);};
  review.append(summary,group(prompt,button('edit-bid',t('افتح العرض للتعديل','Reopen bid'),()=>{
    recalled=sales.map(s=>({...s}));sales=sales.slice(0,editRound);
    bid=Math.min(credits(),recalled[editRound].bid);saved=false;render(ui);
  })));
  root.append(review);
  const save=button('save',saved?t('حُفظت البطاقة في دفترك','Program saved to your notebook'):t('احفظ بطاقة العرض','Save the program'),()=>{
    const piece=ui.savePiece({title:t(...programs[outcome]),type:slug,data:{outcome,paid,sales:sales.map(s=>({...s}))},thumbnail:screen.toDataURL('image/webp',.7)});
    if(piece){saved=true;save.disabled=true;save.textContent=t('حُفظت البطاقة في دفترك','Program saved to your notebook');}
  });
  save.disabled=saved;
  root.append(group(save,button('replay',t('أعد المزاد بعروض الخصوم نفسها','Replay with the same rival bids'),()=>{previous={outcome,paid};sales=[];bid=0;saved=false;recalled=null;editRound=0;render(ui);})));
}
start(3,slug,['مزاد الدقيقة الأخيرة','Last-minute auction'],['راهن بقسائم الأمسية على أدوات سينما الميناء خلال ثلاث جولات.','Bid your evening’s vouchers across three lots at the harbour cinema.'],render);
