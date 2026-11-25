import {clothVertex,clothRun,clothVisibility} from './models.js';
import {surface,action,slider,select,shade,line,dot,poly,ink,archive,output,playFrames,quantity,isolate,updateReading} from './kit.js';
let cfg={left:135,right:413,weight:1,fan:1},moment=3.5,shown=false;
export default function fabric(ui){
  const {t}=ui,w=surface(ui);let cancel=()=>{},result;
  if(ui.editData?.cfg){const d=ui.editData.cfg;cfg={left:Math.max(86,Math.min(235,d.left||135)),right:Math.max(337,Math.min(521,d.right||413)),weight:[.65,1,1.65].includes(d.weight)?d.weight:1,fan:[-1.3,0,1,1.65].includes(d.fan)?d.fan:1};moment=Math.max(0,Math.min(9,ui.editData.moment||0));}
  const pinned=(u,v,time)=>clothVertex(u,v,time,cfg);
  const seconds = (time, digits = 1) => quantity(ui.lang, time, digits, t('ث','s'));
  function render(time, playing = false){
    moment=time;const c=w.c,p=(u,v)=>pinned(u,v,time),vis=clothVisibility(time,cfg);shade(c,'#242725','#131617');
    // The rig is shown in elevation; the tracked parade marker is below the fabric.
    for(let x=40;x<640;x+=40)line(c,x,29,x,191,'#343a36');
    for(let y=38;y<191;y+=30)line(c,36,y,605,y,'#343a36');
    line(c,36,204,605,204,'#77766b');
    const bodyX=560-(time/9)*490;
    for(let k=0;k<4;k++){const x=bodyX+k*11;dot(c,x,204,2.8,'#d6b993');}
    // Draw the fabric in strips. Their surface Jacobian also drives the motif-exposure score.
    const steps=30;
    for(let u=0;u<steps;u++)for(let v=0;v<4;v++){
      const a=u/steps,b=v/4,pts=[p(a,b),p(a+1/steps,b),p(a+1/steps,b+.25),p(a,b+.25)];
      const brightness=Math.max(16,Math.min(48,26+10*(pts[1][0]-pts[0][0])/((cfg.right-cfg.left)/steps)));
      poly(c,pts,'hsl(17 42% '+brightness+'%)');}
    for(let i=1;i<steps;i++){
      c.beginPath();for(let j=0;j<=8;j++){const [x,y]=p(i/steps,j/8);if(j)c.lineTo(x,y);else c.moveTo(x,y);}
      c.strokeStyle=i%4?'rgba(243,214,174,.14)':'rgba(24,15,11,.30)';c.lineWidth=.7;c.stroke();
    }
    const peak=[];for(let i=0;i<=5;i++)peak.push(p(.34+.16*i/5,.72-.42*i/5));
    for(let i=1;i<=5;i++)peak.push(p(.50+.16*i/5,.30+.42*i/5));
    for(let i=1;i<=5;i++)peak.push(p(.66-.32*i/5,.72));poly(c,peak,'#e2c697');
    const middle=[p(.44,.62),p(.50,.46),p(.56,.62)];poly(c,middle,'#734c39');
    for(const x of [cfg.left,cfg.right]){line(c,x,54,x,30,'#cfbe9d',2);dot(c,x,54,4,'#d9c4a1');}
    // The proscenium masks the edges and a lower lintel hides sagging cloth.
    c.fillStyle='#54534a';c.fillRect(130,47,17,122);c.fillRect(482,47,17,122);c.fillRect(130,166,369,7);
    c.fillStyle='#191b1a';c.fillRect(0,260,640,60);result.bands.forEach((v,i)=>{c.fillStyle=v?'#b9c0a3':'#966f61';c.fillRect(42+i*9.2,278,8.6,8);});
    const x=42+Math.max(0,Math.min(6,time-2))/6*552;line(c,x,270,x,292,'#f4d5a3',2);ink(c,'0:02',42,307);ink(c,'0:08',568,307);
    w.canvas.dataset.best=result.best;w.canvas.dataset.time=time.toFixed(1);
    w.describe(t('النقاط تحت الراية تتابع الموكب. يمرّ بين الثانية ٢ و٨ ويحتاج أن يرى الشعار المثلث ثانيتين متصلتين.','The markers track the parade below the banner. It passes from second 2 to 8 and needs two continuous seconds of visibility of the triangular emblem.'));
    const readings = [
      t('الإطار ', 'Frame ') + isolate(seconds(time)),
      vis.clear ? t('الشعار مكشوف', 'Emblem exposed') : t('الشعار محجوب أو مطوي', 'Emblem obscured or folded'),
      t('أطول ظهور متصل ', 'Longest uninterrupted view ') + isolate(seconds(result.best)),
      t('إجمالي الظهور ', 'Total exposed ') + isolate(seconds(result.total))
    ];
    if (shown) readings.push(result.success ? t('اكتمل طلب الموكب','Parade brief met') : t('تحتاج الراية إلى ثبات أطول','Longer exposure needed'));
    updateReading(w.read, readings.join(' · '), playing);
  }
  const timeControl=slider('frame',t('إطار اللقطة · ث','Still frame · s'),0,9,.1,moment,v=>{cancel();render(v);});
  const syncTime=()=>{const input=timeControl.querySelector('input');input.value=moment;timeControl.querySelector('output').value=moment.toFixed(1);};
  function update(key,v){cancel();cfg[key]=v;shown=false;result=clothRun(cfg);render(moment);}
  w.controls.append(slider('left',t('المثبت الأيسر','Left pin'),86,235,1,cfg.left,v=>update('left',v)),
    slider('right',t('المثبت الأيمن','Right pin'),337,521,1,cfg.right,v=>update('right',v)),
    select('weight',t('وزن الراية','Fabric weight'),[[.65,t('خفيفة','Light')],[1,t('متوسطة','Medium')],[1.65,t('ثقيلة','Heavy')]],cfg.weight,v=>update('weight',+v)),
    select('fan',t('اتجاه وقوة الهواء','Fan direction and strength'),[[-1.3,t('من اليمين','From the right')],[0,t('مطفأة','Off')],[1,t('من اليسار','From the left')],[1.65,t('هبة قوية','Strong gust')]],cfg.fan,v=>update('fan',+v)),timeControl);
  w.actions.append(action('run',t('مرّر الموكب','Run parade'),()=>{cancel();shown=true;cancel=playFrames(4500,v=>{render(v*9,v<1);syncTime();});ui.recordEvent({ar:'ظهر شعار الموكب '+result.best.toFixed(1)+' ثوان متصلة.',en:'The parade emblem remained exposed for '+result.best.toFixed(1)+' s.',data:{kind:'banner',best:result.best}});}),
    action('repin',t('انقل المثبّتين بنفس الوزن','Move both pins at the same weight'),()=>{const left=cfg.left<170?195:128,right=cfg.right>420?398:456;update('left',left);update('right',right);for(const [id,v] of [['left',left],['right',right]]){const input=w.controls.querySelector('[data-sim="'+id+'"]');input.value=v;input.nextSibling.value=v;}}),
    action('save',t('احفظ هذه اللقطة','Save this still'),()=>archive(ui,w,'fabric',t('راية الموكب','Parade banner'),{cfg:{...cfg},moment})),
    action('export',t('نزّل الإطار','Download still'),()=>output(w.canvas,'banner-still')));
  result=clothRun(cfg);render(moment);return ()=>cancel();
}
