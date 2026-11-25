import {crossing,water} from './models.js';
import {surface,action,slider,select,shade,line,dot,poly,ink,archive,output,playFrames,quantity,showReadings} from './kit.js';
let start=0,height=2.7,berth=0;
export default function harbor(ui){
  const {t}=ui,w=surface(ui);let stop=()=>{},sent=false;
  if(Number.isFinite(ui.editData?.start)){start=Math.max(0,Math.min(65,ui.editData.start));height=Math.max(1.4,Math.min(3.5,ui.editData.height||2.7));berth=ui.editData.berth===1?1:0;}
  const seconds = value => quantity(ui.lang, value, 0, t('ث', 's'));
  const firstTick = seconds(0), lastTick = seconds(90);
  function draw(time){
    const c=w.c,r=crossing(start,height,berth),wl=water(time),base=207,scale=18,sea=base-wl*scale,crown=base-5.8*scale;
    shade(c,'#252b2b','#161c1d');
    for(let x=40;x<620;x+=40)line(c,x,33,x,208,'#343b38');
    for(let metres=0;metres<=8;metres++){
      const y=base-metres*scale;
      line(c,42,y,604,y,'#373f3d');
      if(metres%2===0)ink(c,quantity(ui.lang,metres,0,t('م','m')),35,y+4,'#c5bfaf',12,'right');
    }
    c.fillStyle='rgba(57,86,90,.63)';c.fillRect(40,sea,565,220-sea);
    line(c,40,sea,605,sea,'#92b1b1',2);
    const bx=Math.min(572,Math.max(49,time<=r.at?49+(328-49)*Math.max(0,(time-start)/(r.at-start)):328+(560-328)*Math.min(1,(time-r.at)/(r.arrive-r.at))));
    const deck=sea-4;
    poly(c,[[bx-34,deck],[bx+33,deck],[bx+22,deck+8],[bx-24,deck+8]],'#573e2c','#261f1c');
    const h=height*scale;line(c,bx-19,deck,bx-19,sea-h,'#d7bc92',2);line(c,bx+19,deck,bx+19,sea-h,'#d7bc92',2);
    c.fillStyle='#dfdbbf';c.fillRect(bx-18,sea-h,36,Math.max(4,h-11));
    c.fillStyle='#4d514a';c.beginPath();c.moveTo(244,188);c.lineTo(244,65);c.lineTo(415,65);c.lineTo(415,188);c.lineTo(395,188);c.lineTo(395,130);c.quadraticCurveTo(328,2*crown-130,264,130);c.lineTo(264,188);c.closePath();c.fill();
    c.strokeStyle='#a8a597';c.lineWidth=1.5;c.stroke();
    line(c,241,65,418,65,'#cab28b',5);line(c,328,crown,328,crown+6,'#ebb985',2);
    c.fillStyle='#161b1c';c.fillRect(0,219,640,101);
    const xx=x=>44+x/90*548,yy=y=>295-y*14;
    for(let j=0;j<90;j++)line(c,xx(j),yy(water(j)),xx(j+1),yy(water(j+1)),'#8ec2ba',2.3);
    line(c,xx(r.at),232,xx(r.at),299,'#e5bd80',1.5);dot(c,xx(time),yy(wl),4,'#fff2d1');
    ink(c,firstTick,44,312);ink(c,lastTick,595,312,'#ecdcbb',15,'right');
    w.describe(t('المنحنى يمثل تسعين ثانية. الخط الثابت عند عبور القوس.','The curve covers 90 seconds. The upright mark is arch passage.'));
    w.canvas.dataset.clear=r.clear.toFixed(2);w.canvas.dataset.arrive=r.arrive;w.canvas.dataset.success=r.success;
  }
  function report(r) {
    const metres = value => quantity(ui.lang, value, 2, t('م', 'm'));
    const reason=r.clear<0?t('الشاشة أعلى من القوس','Screen exceeds clearance'):r.arrive>r.deadline?t('فات الافتتاح','Opening missed'):t('يمر القارب ويلحق الافتتاح','Clears arch before opening');
    showReadings(w.read, [
      [t('عبور القوس', 'Arch passage'), seconds(r.at)],
      [t('منسوب الماء', 'Water level'), metres(r.water)],
      [t('ارتفاع القوس', 'Arch height'), metres(5.8)],
      [t('الخلوص', 'Clearance'), metres(r.clear)],
      [t('الوصول', 'Arrival'), seconds(r.arrive)],
      [t('موعد الافتتاح', 'Opening time'), seconds(r.deadline)]
    ], sent ? reason : '');
  }
  function previewArch(){const r=crossing(start,height,berth);draw(r.at);report(r);}
  function sync(){stop();sent=false;previewArch();}
  w.controls.append(slider('departure',t('الانطلاق · ث','Departure · s'),0,65,1,start,v=>{start=v;sync();}),
    slider('height',t('ارتفاع الشاشة · م','Screen height · m'),1.4,3.5,.1,height,v=>{height=v;sync();}),
    select('berth',t('موقع الرسو','Destination'),[[0,t('الرصيف القريب','Near quay')],[1,t('الرصيف البعيد','Far quay')]],berth,v=>{berth=+v;sync();}));
  w.actions.append(action('run',t('اعرض رحلة القارب','Preview the voyage'),()=>{
    stop();sent=true;const r=crossing(start,height,berth),last=r.clear<0?r.at:r.arrive;
    report(r);
    stop=playFrames(3500,v=>draw(start+v*(last-start)));
    const ar=r.success?'وصل القارب في الموعد':r.clear<0?'توقّف القارب عند القوس':'فات القارب افتتاح العرض';
    const en=r.success?'The boat reached the opening':r.clear<0?'The boat stopped at the arch':'The boat missed opening';
    ui.recordEvent({ar:ar+' · '+last+' ث.',en:en+' · '+last+' s.',data:{kind:'harbor',start,height,berth,clear:r.clear,arrival:r.arrive}});
  }),action('arch',t('جمّد لحظة العبور','Freeze the crossing'),()=>{stop();sent=true;previewArch();}),
    action('save',t('احفظ خطة المرفأ','Save harbour plan'),()=>archive(ui,w,'harbor',t('خطة المرفأ','Harbour plan'),{start,height,berth})),
    action('export',t('نزّل الخطة','Download plan'),()=>output(w.canvas,'harbour-plan')));
  sync();return ()=>stop();
}
