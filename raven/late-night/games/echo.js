import {start,keepButton,el,button,group,canvas,output,box,dot,line,gradient,loadPhoto,redrawWhenLoaded} from './tools.js';
const pierPhoto=loadPhoto('echo-chart');
const names=[['رصيف الملح','Salt pier'],['رصيف الزجاج','Glass pier'],['رصيف الحبال','Rope pier']];
const objects=[['جرس','Bell'],['فانوس','Beacon'],['عوامة','Buoy']];
const dictionary=[['الملح','Salt'],['الزجاج','Glass'],['الحبال','Rope'],['الجرس الأول','First bell'],['الجرس الثاني','Second bell'],['بريد','Mail']];
const times=[['20:10','20:40'],['20:20','20:50'],['20:30','21:00']];
const variants=[{icons:[1,2,0],object:2,bell:1},{icons:[2,0,1],object:1,bell:0},{icons:[0,1,2],object:0,bell:1}];
let variant=0,solo=false,phase='sender',signals=[],pier=0,time='20:10',meaning='',imported=false;
const task=()=>variants[variant],targetPier=()=>task().icons.indexOf(task().object);
// The plate contains three empty piers. Only the sender’s map receives the scenario signals.
function pierMap(label, marks) {
  const view=canvas(label), c=view.getContext('2d');
  function draw() {
    if(pierPhoto.naturalWidth) c.drawImage(pierPhoto,0,0,640,320);
    else {
      gradient(c,'#253739','#143036');
      box(c,'#625646',0,0,640,36);
      for(const x of [89,312,545]) {
        box(c,'#514c42',x-18,34,36,243);
        for(let y=41;y<275;y+=10) line(c,'#776959',1,[[x-17,y],[x+17,y]]);
      }
    }
    for(const [i,x] of [89,312,545].entries()){
      // The fixed pier letters are public. The removable signal plates are private.
      box(c,'#102326',x-18,55,36,33);
      c.fillStyle='#e5ded1';c.textAlign='center';c.font='20px monospace';
      c.fillText(String.fromCharCode(65+i),x,79);
      if(!marks) continue;
      const y=219, ink='#f2dfaf';
      dot(c,'#131f21',x,y,24);
      c.beginPath();c.strokeStyle='#bba882';c.lineWidth=1.5;c.arc(x,y,23,0,2*Math.PI);c.stroke();
      switch(marks[i]){
        case 0:
          c.beginPath();c.strokeStyle=ink;c.lineWidth=2.5;
          c.moveTo(x-9,y+6);c.quadraticCurveTo(x-7,y+4,x-7,y-2);
          c.bezierCurveTo(x-7,y-13,x+7,y-13,x+7,y-2);
          c.quadraticCurveTo(x+7,y+4,x+9,y+6);c.closePath();c.stroke();
          dot(c,ink,x,y+9,2);break;
        case 1:
          line(c,ink,2,[[x-8,y+8],[x+8,y+8],[x+6,y-5],[x-6,y-5],[x-8,y+8]]);
          line(c,ink,2,[[x-8,y-5],[x,y-11],[x+8,y-5]]);
          dot(c,'#f4be62',x,y+1,3);break;
        case 2:
          line(c,ink,2,[[x,y-12],[x,y-6],[x+7,y+4],[x+4,y+8],[x-4,y+8],[x-7,y+4],[x,y-6]]);
          line(c,'#dcaa73',3,[[x-5,y+1],[x+5,y+1]]);break;
      }
    }
  }
  draw();redrawWhenLoaded(pierPhoto,view,draw);
  return view;
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
     const img=pierMap(t('خريطة الأرصفة للمرسل','Sender’s pier map'),scenario.icons);
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
     const img=pierMap(t('أرصفة قارب البريد','Mail boat piers'));
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
