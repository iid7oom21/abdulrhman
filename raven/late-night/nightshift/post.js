import {action,element,mount} from '../night-shell.js';
import {beginShift,restoreShift,perform,finished,elapsedByUse,parcels,TRANSFER,CAPACITY,LAST_MINUTE} from './post-rules.js';

const floors = [['مدخل المرفأ','Harbour entrance'],['مكتب الفرز','Sorting office'],
  ['قاعة البروفات','Rehearsal room'],['كابينة العرض','Projection booth']];
const locations = {car:['داخل المصعد','In the lift'], shelf:['على رفّ الفرز','On the sorting shelf'],
  platform:['على منصة التبديل','On the transfer platform'], delivered:['تم التسليم','Delivered']};
const controls = {
  up:['اصعد طابقًا','Go up one floor'],down:['انزل طابقًا','Go down one floor'],wait:['انتظر دقيقة','Wait a minute'],
  load:['حمّل','Load'],unload:['ضع على المنصة','Unload to platform'],deliver:['سلّم','Deliver'],
};
let shift;

function render(ui) {
  const {root,t} = ui;
  if (!shift) shift = restoreShift(ui.load()) || beginShift();
  const num = n => new Intl.NumberFormat(ui.lang).format(n);
  const floor = f => num(f) + ' · ' + t(...floors[f]);
  const name = i => t(...parcels[i].label);
  const data = () => ({version:1,commands:shift.log.map(event => event.command)});
  const range = p => t('من الدقيقة ', 'Minutes ') + num(p.opens) + t(' إلى ', ' to ') + num(p.closes);
  const workspace = element('div',null,'post-room');
  const consoleBox = element('section',null,'post-console'), board = element('section',null,'post-manifest');
  const label = element('h2',t('لوحة المصعد','Lift controls')), activeFloor = element('p',null,'post-floor');
  const photo = element('img',null,'post-still'); photo.width=672;photo.height=270;photo.alt='';
  const locationPhoto = new URL('../assets/photo/memory-lift.webp',import.meta.url).href;
  const retry = action(t('أعد تحميل اللقطة','Reload location still'),()=>{retry.hidden=true;photo.hidden=false;photo.src=locationPhoto;});
  retry.hidden=true; photo.onerror=()=>{photo.hidden=true;retry.hidden=false;}; photo.src=locationPhoto;
  const shaft = element('ol',null,'post-shaft');
  shaft.setAttribute('aria-label',t('موضع المصعد','Lift position'));
  const rows = [];
  for (let i=3;i>=0;i--) {
    const row = element('li',floor(i)), marker = element('span');
    row.prepend(marker);row.dataset.floor=i;shaft.append(row);rows[i]=row;
  }
  const dispatch = element('p',null,'post-load');
  const buttons = element('div',null,'post-actions');
  const quick = {};
  for (const cmd of ['up','down','wait']) {
    quick[cmd] = action(t(...controls[cmd]),()=>act(cmd));
    quick[cmd].dataset.post=cmd;buttons.append(quick[cmd]);
  }
  const time = element('p',null,'post-time');time.setAttribute('role','status');time.dataset.post='clock';
  const rules = element('details',null,'post-rules');
  rules.append(element('summary',t('قواعد الوردية','Shift rules')),
    element('p',t('تبدأ الوردية وعلبة الفيلم في المصعد. بقية الطرود على رفّ الطابق الأول. يتّسع المصعد لطردين ومنصة التبديل في طابق الفرز لطرد واحد.',
      'Start with the film canister in the lift. The other parcels are on the first-floor shelf. The lift holds two parcels; the sorting-floor transfer platform holds one.')),
    element('p',t('تستغرق الحركة بين طابقين متجاورين دقيقتين، وكل تحميل أو تفريغ أو تسليم دقيقة. يُحتسب التسليم عند انتهاء المناولة. يُقبل الطرد المتأخر ويظهر وقت تأخّره. ينتهي العمل في الدقيقة ٣٢.',
      'Travel takes two minutes per floor. Loading, unloading or delivering takes one minute. Delivery is timed at the end of handling. Late parcels are accepted and their delay is recorded. The shift closes at minute 32.')));
  consoleBox.append(photo,retry,label,activeFloor,shaft,dispatch,buttons,time,rules);
  const heading=element('h2',t('بوليصات التسليم','Delivery slips'));
  const instructions=element('p',t('علبة الفيلم معك. مفاتيح الصالة وشرائح العرض تنتظران في الطابق ١. اضغط على إجراء عند موقع الطرد.',
    'The canister is aboard. Hall keys and slides await on floor 1. Choose a handling action when you reach a parcel.'));
  const cards=element('div',null,'post-cards');board.append(heading,instructions,cards);
  workspace.append(consoleBox,board);
  const result=element('section',null,'post-result');result.dataset.post='result';result.tabIndex=-1;
  const history=element('details',null,'post-history'), historyTitle=element('summary',t('سجل الوردية','Shift log')),
    log=element('ol');history.append(historyTitle,log);
  const transport=element('div',null,'post-actions');
  const undo=action(t('تراجع عن آخر قرار','Undo last decision'),()=>{
    shift=restoreShift({version:1,commands:data().commands.slice(0,-1)});
    ui.save(data());paint();(undo.disabled ? quick.up : undo).focus();
  });
  undo.dataset.post='undo';
  const reset=action(t('ابدأ وردية جديدة','Start a new shift'),()=>{
    shift=beginShift();ui.replaceDraft(data());paint();quick.up.focus();
  });
  reset.dataset.post='reset';transport.append(undo,reset);
  root.replaceChildren(workspace,result,history,transport);

  function act(cmd) {
    const next=perform(shift,cmd);
    if (!next.state) return;
    shift=next.state;ui.save(data());paint();
    if (finished(shift)) {result.focus();return;}
    const nextButton=root.querySelector('[data-post="'+cmd+'"]');
    if (nextButton && !nextButton.disabled) nextButton.focus();
    else (Object.values(quick).find(b=>!b.disabled) || undo).focus();
  }
  function eventLine(e) {
    if (e.command==='up' || e.command==='down') return t('انتقل المصعد إلى ', 'Lift moved to ') + floor(e.floor);
    if (e.command==='wait') return t('انتظر المصعد في ', 'Lift waited at ') + floor(e.floor);
    const verb={load:t('تحميل ', 'Loaded '),unload:t('تفريغ على منصة التبديل: ', 'Unloaded to transfer platform: '),deliver:t('تسليم ', 'Delivered ')};
    return verb[e.command.split(':')[0]]+name(e.parcel)+' · '+floor(e.floor);
  }
  function actionsFor(i,p) {
    const available=[];
    if (shift.slots[i]==='car') {
      if (shift.floor===p.target) available.push('deliver');
      if (shift.floor===TRANSFER) available.push('unload');
    } else if (['shelf','platform'].includes(shift.slots[i]) && shift.floor===TRANSFER) available.push('load');
    return available;
  }
  function parcelCards() {
    cards.replaceChildren();
    for (const [i,p] of parcels.entries()) {
      const card=element('article',null,'post-slip');card.dataset.parcel=p.id;
      const target=element('p',floor(p.target)+' · '+range(p),'post-target');
      const state=element('p',t(...locations[shift.slots[i]]));
      if (shift.delivered[i]!==null) state.append(' · '+t('الدقيقة ','Minute ')+num(shift.delivered[i]));
      card.append(element('h3',name(i)),target,state);
      for (const op of finished(shift) ? [] : actionsFor(i,p)) {
        const command=op+':'+p.id, b=action(t(...controls[op]),()=>act(command)), checked=perform(shift,command);
        b.dataset.post=command;
        b.setAttribute('aria-label',t(...controls[op])+' · '+name(i));
        b.disabled=Boolean(checked.error);
        card.append(b);
        const reason={capacity:['المصعد ممتلئ.','The lift is full.'],platform:['منصة التبديل مشغولة.','The transfer platform is occupied.'],
          early:['لم تبدأ نافذة التسليم بعد.','The delivery window has not opened.']};
        if (reason[checked.error]) card.append(element('small',t(...reason[checked.error])));
      }
      cards.append(card);
    }
  }
  function summary() {
    result.replaceChildren();result.hidden=!finished(shift);
    if (result.hidden) return;
    const onTime=parcels.filter((p,i)=>shift.delivered[i]!==null && shift.delivered[i]<=p.closes).length;
    result.dataset.onTime=onTime;
    result.append(element('h2',t('حصيلة الوردية','Shift report')),
      element('p',t('وصل في الموعد: ', 'Delivered in the window: ')+num(onTime)+' / '+num(parcels.length)));
    for (const [i,p] of parcels.entries()) {
      const at=shift.delivered[i],late=at===null?null:Math.max(0,at-p.closes);
      const msg=at===null?t('بقي دون تسليم عند الإغلاق.', 'Still undelivered at closing.'):
        t('انتهى التسليم في الدقيقة ','Delivered at minute ')+num(at)+' · '+(late?t('تأخّر بالدقائق: ','Minutes late: ')+num(late):t('ضمن النافذة.','Within the window.'));
      result.append(element('p',name(i)+' — '+msg));
    }
    const x=elapsedByUse(shift);
    result.append(element('p',t('توزيع دقائق الوردية: ','Shift minutes: ')+t('التنقل ','travel ')+num(x.travel)+
      t(' (منها بمصعد فارغ ',' (empty lift ')+num(x.emptyTravel)+') · '+t('التبديل ','transfer ')+num(x.transfer)+
      ' · '+t('المناولة ','handling ')+num(x.handling)+' · '+t('الانتظار ','wait ')+num(x.wait)+'.'));
  }
  function paint() {
    activeFloor.textContent=t('الطابق الحالي ','Current floor ')+floor(shift.floor);
    rows.forEach((row,i)=>{row.setAttribute('aria-current',String(i===shift.floor));
      row.firstChild.textContent=i===shift.floor?t('المصعد','Lift'):'';});
    for (const [command,b] of Object.entries(quick)) b.disabled=!perform(shift,command).state;
    time.textContent=t('الدقيقة ','Minute ')+num(shift.minute)+' / '+num(LAST_MINUTE);
    time.dataset.minute=shift.minute;
    dispatch.textContent=t('حمولة المصعد ', 'Lift load ')+num(shift.slots.filter(s=>s==='car').length)+' / '+num(CAPACITY);
    undo.disabled=!shift.log.length;
    parcelCards();summary();
    log.replaceChildren();
    if (!shift.log.length) log.append(element('li',t('٠ · بدأ المصعد في مدخل المرفأ.','0 · Shift began at the harbour entrance.')));
    for (const e of shift.log) {
      const line=element('li'),when=element('bdi',num(e.start)+'–'+num(e.end));when.dir='ltr';
      line.append(when,' · '+eventLine(e));log.append(line);
    }
  }
  paint();
}
mount({id:'nightshift-post',title:['بريد المصعد','Elevator Mail'],intro:[
  'ثلاثة طرود، ومصعد بريد واحد في سينما المرفأ. خذها إلى أبوابها في موعدها.',
  'Three parcels and one service lift at Harbour Cinema. Bring each to its door in time.'],render});
