import {start,keepButton,el,button,group,canvas,output,box,dot,line,gradient} from './tools.js';
const names=[['رصيف الملح','Salt pier'],['رصيف الزجاج','Glass pier'],['رصيف الحبال','Rope pier']];
const objects=[['جرس','Bell'],['فانوس','Beacon'],['عوامة','Buoy']];
const dictionary=[['الملح','Salt'],['الزجاج','Glass'],['الحبال','Rope'],['الجرس الأول','First bell'],['الجرس الثاني','Second bell'],['بريد','Mail']];
const times=[['20:10','20:40'],['20:20','20:50'],['20:30','21:00']];
const variants=[{icons:[1,2,0],object:2,bell:1},{icons:[2,0,1],object:1,bell:0},{icons:[0,1,2],object:0,bell:1}];
let variant=0,solo=false,phase='sender',signals=[],pier=0,time='20:10',meaning='',imported=false;
const task=()=>variants[variant],targetPier=()=>task().icons.indexOf(task().object);
function harbor(c,mapped,marks){
  gradient(c,'#20333e','#606a61');dot(c,'#cdbb90',508,41,16);for(let i=0;i<18;i++){const x=i*42-11,y=103-(i*17)%35;box(c,'#304149',x,y,39,40);line(c,'#394951',6,[[x-1,y],[x+18,y-11],[x+40,y]]);box(c,'#d9b57b',x+9,y+9,4,6);}
  box(c,'#29444b',0,129,640,191);
  for(let y=143;y<320;y+=13)for(let x=(y*7)%53;x<650;x+=71)line(c,'#556d68',1,[[x,y],[x+27,y]]);
  for(let j=0;j<3;j++){
    const x=115+j*195;
    box(c,'#675c4c',x-24,127,47,114);box(c,'#88755b',x-29,235,57,10);
    for(let y=130;y<240;y+=8)line(c,'#403e36',1,[[x-22,y],[x+21,y]]);
    for(const o of [-30,25]){box(c,'#3d4944',x+o,233,6,30);box(c,'#a69671',x+o,233,6,4);}
    if(mapped){
      const v=marks[j];if(v===0){dot(c,'#c5a66b',x,167,8);box(c,'#bd9e66',x-10,169,20,3);dot(c,'#c5a66b',x,175,2);}
      if(v===1){box(c,'#665f4c',x-4,163,8,12);box(c,'#f1d797',x-3,165,6,6);line(c,'#1f393c',2,[[x-6,163],[x,159],[x+6,163]]);}
      if(v===2){dot(c,'#b58b66',x,169,6);line(c,'#eed5a7',3,[[x-6,169],[x+6,169]]);}
    }
    c.fillStyle='#dfd0aa';c.font='16px sans-serif';c.textAlign='center';c.fillText(String.fromCharCode(65+j),x,220);
  }
  line(c,'#d0c49f',2,[[12,284],[187,275],[353,284],[545,272]]);box(c,'#b39c78',541,265,25,6);
}
function render(ui){
 const {root,t}=ui;
 if(!imported){imported=true;const d=ui.editData;
   if(d&&Array.isArray(d.signals)&&d.signals.length<=3&&d.signals.every(n=>Number.isInteger(n)&&n>=0&&n<dictionary.length)&&Number.isInteger(d.variant)&&variants[d.variant]){
     variant=d.variant;signals=[...d.signals];phase='sender';solo=d.solo===true;
     if(Number.isInteger(d.pier)&&names[d.pier])pier=d.pier;
     if(times.flat().includes(d.time))time=d.time;
     if(typeof d.meaning==='string')meaning=d.meaning.slice(0,120);
   }
 }
 function refresh(){
   root.replaceChildren();const scenario=task(),station=targetPier(),targetTime=times[station][scenario.bell];
   const signalText=signals.map(n=>t(...dictionary[n])).join(' / ');
   if(phase==='sender'){
     const img=canvas(t('خريطة الأرصفة للمرسل','Sender’s pier map'));harbor(img.getContext('2d'),true,scenario.icons);
     const brief=el('p',t('حقيبة البريد عند علامة ','The mailbag is at the ')+t(...objects[scenario.object])+t('، وتغادر في ',' and leaves at the ')+t(...dictionary[3+scenario.bell])+'.','game-note');brief.dataset.game='private-map';
     const legend=el('p',names.map((n,j)=>String.fromCharCode(65+j)+' · '+t(...n)+' — '+t(...objects[scenario.icons[j]])).join('   /   '));
     const codes=group(...dictionary.map((d,i)=>button('signal-'+i,t(...d),()=>{if(signals.length<3){signals.push(i);refresh();}})));codes.querySelectorAll('button').forEach(b=>b.disabled=signals.length===3);
     const bus=output(t('الإشارات ','Signals ')+signals.length+'/3 · '+signalText);
     const mode=button('solo',solo?t('تدريب فردي مفعّل','Solo practice on'):t('تدرّب وحدك','Practise solo'),()=>{solo=!solo;refresh();});mode.setAttribute('aria-pressed',String(solo));
     const back=button('undo',t('اسحب آخر إشارة','Remove last signal'),()=>{signals.pop();refresh();});back.disabled=!signals.length;
     const pass=button('pass',solo?t('انتقل إلى الجدول','Switch to the timetable'):t('سلّم الجوال','Hand over the phone'),()=>{phase='handoff';refresh();});pass.disabled=!signals.length;
     root.append(img,brief,legend,codes,bus,group(back,mode,pass));
   }else if(phase==='handoff'){
     const title=el('h2',solo?t('الجدول جاهز لك','Your timetable is ready'):t('دور مستلم البريد','The mail receiver’s turn'));
     root.append(title,el('p',solo?t('افتح الدور الثاني واقرأ الإشارات التي اخترتها.','Open the second role and read your signals.'):t('أعطِ الهاتف لزميلك. يفتح هو جدول القارب.','Pass the device. The receiver opens the boat schedule.')),button('receive',t('افتح دور المستلم','Open receiver role'),()=>{phase='receiver';refresh();}));
   }else if(phase==='receiver'){
     const img=canvas(t('أرصفة قارب البريد','Mail boat piers'));harbor(img.getContext('2d'),false,[]);
     const table=el('table');table.dir=ui.lang==='ar'?'rtl':'ltr';const head=table.createTHead().insertRow();
     for(const label of [t('الرصيف','Pier'),t(...dictionary[3]),t(...dictionary[4])])head.append(el('th',label));
     names.forEach((n,j)=>{const row=table.insertRow();row.append(el('th',t(...n)),el('td',times[j][0]),el('td',times[j][1]));});
     const ports=group(...names.map((n,i)=>{const b=button('pier-'+i,t(...n),()=>{pier=i;refresh();});b.setAttribute('aria-pressed',String(pier===i));return b;}));
     const departures=group(...times.flat().map(v=>{const b=button('time-'+v.replace(':',''),v,()=>{time=v;refresh();});b.setAttribute('aria-pressed',String(v===time));return b;}));
     const note=el('label',t('كيف فهمت الإشارات؟','How did you read the signals?'));const input=el('input');input.type='text';input.maxLength=120;input.value=meaning;input.dataset.game='meaning';input.oninput=()=>meaning=input.value;note.append(input);
     root.append(img,el('p',t('وصلتك الإشارات: ','Received signals: ')+signalText,'game-note'),table,el('h3',t('اختر الرصيف','Select a pier')),ports,el('h3',t('اختر وقت القارب','Select the boat time')),departures,note,group(button('reveal',t('اكشف الحصيلة','Reveal exchange'),()=>{phase='result';ui.recordEvent({ar:'فككت إشارات قارب البريد.',en:'You interpreted the mail-boat signals.',data:{variant,pier,time}});refresh();})));
     if(solo)root.append(button('revisit',t('راجع الخريطة في التدريب','Review the practice map'),()=>{phase='sender';refresh();}));
   }else{
     const yes=pier===station&&time===targetTime;
     const read=output(yes?t('استلمت الحقيبة في الموعد.','You received the mail on time.'):t('فاتت الحقيبة هذا الموعد.','The mail missed this connection.'));read.dataset.result=yes?'met':'missed';
     const summary=el('div');summary.append(el('p',t('إشارات المرسل: ','Sender’s signals: ')+signalText),el('p',t('اختيار المستلم: ','Receiver’s choice: ')+t(...names[pier])+' · '+time),el('p',t('قراءة المستلم: ','Receiver’s reading: ')+(meaning||t('لم يكتب ملاحظة.','No note entered.'))),el('p',t('الموعد الفعلي: ','Actual collection: ')+t(...names[station])+' · '+targetTime));
     root.append(read,summary,group(button('again',t('أعد نفس الجولة','Replay this round'),()=>{phase='sender';signals=[];pier=0;time=times[0][0];meaning='';refresh();}),button('next',t('جرّب موعدًا آخر','Try a new schedule'),()=>{variant=(variant+1)%variants.length;signals=[];pier=0;time=times[0][0];meaning='';phase='sender';refresh();}),keepButton(ui,t('احتفظ بسجل الإشارات','Keep the signal log'),()=>({title:t('سجل قارب البريد','Mail boat signal log'),type:'echo-two',data:{variant,signals:[...signals],pier,time,meaning,solo}}))));
   }
   root.dataset.role=phase;
 }
 refresh();
}
start(6,'echo-two',['تردّد لشخصين','A frequency for two'],['لدى أحدكما خريطة ولدى الآخر جدول القارب. اتفقا بثلاث إشارات على الأكثر.','One player has the map, the other the boat schedule. Coordinate with up to three signals.'],render);
