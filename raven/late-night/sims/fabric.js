import {clothVertex,clothRun,clothVisibility} from './models.js';
import {surface,action,slider,select,shade,line,dot,poly,ink,archive,output,playFrames} from './kit.js';
let cfg={left:135,right:413,weight:1,fan:1},moment=3.5,shown=false;
export default function fabric(ui){
  const {t}=ui,w=surface(ui);let cancel=()=>{},result;
  if(ui.editData?.cfg){const d=ui.editData.cfg;cfg={left:Math.max(86,Math.min(235,d.left||135)),right:Math.max(337,Math.min(521,d.right||413)),weight:[.65,1,1.65].includes(d.weight)?d.weight:1,fan:[-1.3,0,1,1.65].includes(d.fan)?d.fan:1};moment=Math.max(0,Math.min(9,ui.editData.moment||0));}
  const pinned=(u,v,time)=>clothVertex(u,v,time,cfg);
  function render(time){
    moment=time;const c=w.c,p=(u,v)=>pinned(u,v,time),vis=clothVisibility(time,cfg);shade(c,'#2b4654','#9aa392');
    for(let i=0;i<12;i++){const x=i*57,h=63+((i*23)%59);c.fillStyle=i%2?'#839084':'#566c6b';c.fillRect(x,225-h,54,h);for(let k=0;k<6;k++){c.fillStyle=k%3?'#314949':'#cab384';c.fillRect(x+8+(k%3)*13,235-h+Math.floor(k/3)*18,7,11);}}
    c.fillStyle='#7b7564';c.fillRect(0,219,640,46);
    const bodyX=560-(time/9)*490;
    for(let k=0;k<4;k++){const x=bodyX+k*20,y=204+k%2*4;dot(c,x,y-12,5,'#c5ae87');c.fillStyle=k%2?'#5c4038':'#3e5a4f';c.fillRect(x-5,y-7,10,17);line(c,x-3,y+9,x-6+Math.sin(time*5)*4,y+17,'#333c39',2.5);line(c,x+3,y+9,x+5-Math.sin(time*5)*4,y+17,'#333c39',2.5);}
    // Draw the fabric in strips. Their surface Jacobian also drives the motif-exposure score.
    const steps=30;
    for(let u=0;u<steps;u++)for(let v=0;v<4;v++){
      const a=u/steps,b=v/4,pts=[p(a,b),p(a+1/steps,b),p(a+1/steps,b+.25),p(a,b+.25)];
      const brightness=Math.max(20,Math.min(53,29+11*(pts[1][0]-pts[0][0])/((cfg.right-cfg.left)/steps)));
      poly(c,pts,'hsl(354 31% '+brightness+'%)');}
    const peak=[];for(let i=0;i<=5;i++)peak.push(p(.34+.16*i/5,.72-.42*i/5));
    for(let i=1;i<=5;i++)peak.push(p(.50+.16*i/5,.30+.42*i/5));
    for(let i=1;i<=5;i++)peak.push(p(.66-.32*i/5,.72));poly(c,peak,'#e2c697');
    const middle=[p(.44,.62),p(.50,.46),p(.56,.62)];poly(c,middle,'#774d4c');
    for(const x of [cfg.left,cfg.right]){line(c,x,54,x,30,'#cfbe9d',2);dot(c,x,54,4,'#d9c4a1');}
    // The proscenium masks the edges and a lower lintel hides sagging cloth.
    c.fillStyle='#475851';c.fillRect(130,47,17,122);c.fillRect(482,47,17,122);c.fillRect(130,166,369,7);
    c.fillStyle='#293936';c.fillRect(0,260,640,60);result.bands.forEach((v,i)=>{c.fillStyle=v?'#b6c29d':'#a17066';c.fillRect(42+i*9.2,278,8.6,8);});
    const x=42+Math.max(0,Math.min(6,time-2))/6*552;line(c,x,270,x,292,'#f4d5a3',2);ink(c,'2 s',42,307);ink(c,'8 s',568,307);
    w.canvas.dataset.best=result.best;w.canvas.dataset.time=time.toFixed(1);
    w.describe(t('الشعار مثلث داخل الراية. يمر الموكب بين الثانية ٢ و٨؛ يحتاج رؤية متصلة مدتها ثانيتان.','The flag has a triangular emblem. The parade passes from second 2 to 8 and needs two continuous seconds of visibility.'));
    w.read.textContent=t('الإطار ','Frame ')+time.toFixed(1)+' s · '+(vis.clear?t('الشعار مكشوف','Emblem exposed'):t('الشعار محجوب أو مطوي','Emblem obscured or folded'))+' · '+t('أطول ظهور متصل ','Longest uninterrupted view ')+result.best.toFixed(1)+' s · '+t('إجمالي الظهور ','Total exposed ')+result.total.toFixed(1)+' s'+(shown?' · '+(result.success?t('اكتمل طلب الموكب','Parade brief met'):t('تحتاج الراية إلى ثبات أطول','Longer exposure needed')):'');
  }
  const timeControl=slider('frame',t('إطار اللقطة · ث','Still frame · s'),0,9,.1,moment,v=>{cancel();render(v);});
  const syncTime=()=>{const input=timeControl.querySelector('input');input.value=moment;timeControl.querySelector('output').value=moment.toFixed(1);};
  function update(key,v){cancel();cfg[key]=v;shown=false;result=clothRun(cfg);render(moment);}
  w.controls.append(slider('left',t('المثبت الأيسر','Left pin'),86,235,1,cfg.left,v=>update('left',v)),
    slider('right',t('المثبت الأيمن','Right pin'),337,521,1,cfg.right,v=>update('right',v)),
    select('weight',t('وزن الراية','Fabric weight'),[[.65,t('خفيفة','Light')],[1,t('متوسطة','Medium')],[1.65,t('ثقيلة','Heavy')]],cfg.weight,v=>update('weight',+v)),
    select('fan',t('اتجاه وقوة الهواء','Fan direction and strength'),[[-1.3,t('من اليمين','From the right')],[0,t('مطفأة','Off')],[1,t('من اليسار','From the left')],[1.65,t('هبة قوية','Strong gust')]],cfg.fan,v=>update('fan',+v)),timeControl);
  w.actions.append(action('run',t('مرّر الموكب','Run parade'),()=>{cancel();shown=true;cancel=playFrames(4500,v=>{render(v*9);syncTime();});ui.recordEvent({ar:'ظهر شعار الموكب '+result.best.toFixed(1)+' ثوان متصلة.',en:'The parade emblem remained exposed for '+result.best.toFixed(1)+' s.',data:{kind:'banner',best:result.best}});}),
    action('repin',t('انقل المثبّتين بنفس الوزن','Move both pins at the same weight'),()=>{const left=cfg.left<170?195:128,right=cfg.right>420?398:456;update('left',left);update('right',right);for(const [id,v] of [['left',left],['right',right]]){const input=w.controls.querySelector('[data-sim="'+id+'"]');input.value=v;input.nextSibling.value=v;}}),
    action('save',t('احفظ هذه اللقطة','Save this still'),()=>archive(ui,w,'fabric',t('راية الموكب','Parade banner'),{cfg:{...cfg},moment})),
    action('export',t('نزّل الإطار','Download still'),()=>output(w.canvas,'banner-still')));
  result=clothRun(cfg);render(moment);return ()=>cancel();
}
