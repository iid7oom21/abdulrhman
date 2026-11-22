import {el,button,select,range,number,line,ground,text,studio,resetControls} from './practical-tools.js';

const cuts=[
  [[-47,-12],[-33,-12],[-33,-16],[-29,-16],[-29,-12],[28,-12],[28,-16],[32,-16],[32,-12],[48,-12],[46,12],[-46,13]],
  [[-15,-48],[15,-48],[15,46],[-15,47]],
  [[-16,-47],[16,-47],[15,47],[-16,47]],
  [[-45,19],[-1,-22],[45,18],[39,18],[-1,-12],[-38,19]]
];
const models=[
  [[320,170,0,165],[260,191,0,85],[380,191,0,85],[320,133,0,90]],
  [[320,218,0,85],[312,142,0,148],[339,161,0,111],[319,71,0,92]],
  [[315,195,0,150],[311,152,0,80],[344,154,0,75],[296,137,90,125]],
];
const names=[['جسر','Bridge'],['برج ساعة','Clock tower'],['سفينة','Boat']];
const pieces=[['العارضة','Beam'],['القائمة العريضة','Wide upright'],['القائمة النحيلة','Narrow upright'],['المثلث','Triangle']];
const color=['#795b42','#384f41','#864835','#58716a'];
const positions=raw=>models[0].map((a,i)=>[number(raw?.[i]?.[0],85,555,a[0]+[35,-35,25,-40][i]),number(raw?.[i]?.[1],55,245,a[1]-9),number(raw?.[i]?.[2],-180,180,0),number(raw?.[i]?.[3],45,180,90)]);
function projected(shape,state){
  const [x,y,rotation,size]=state,a=rotation*Math.PI/180,scale=size/100;
  return shape.map(([u,v])=>[x+(u*Math.cos(a)-v*Math.sin(a))*scale,y+(u*Math.sin(a)+v*Math.cos(a))*scale]);
}
function paper(c,i,state,color,stroke,width=1){
  const poly=projected(cuts[i],state);
  c.beginPath();poly.forEach(([x,y],n)=>n?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  if(i===1){
    const toWorld=(u,v)=>projected([[u,v]],state)[0];
    const [x,y]=toWorld(0,-29),r=8.5*state[3]/100;
    c.moveTo(x+r,y);c.arc(x,y,r,0,Math.PI*2);
  }
  c.fillStyle=color;c.fill('evenodd');
  if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
  if(i===1){
    const [left,centre,end]=projected([[-4,-33],[0,-29],[4,-31]],state);
    line(c,...left,...centre,color,2*state[3]/100);line(c,...centre,...end,color,2*state[3]/100);
  }
}
function mask(arr){
  const node=document.createElement('canvas');node.width=320;node.height=155;
  const c=node.getContext('2d',{willReadFrequently:true});c.scale(.5,.5);
  cuts.forEach((p,i)=>paper(c,i,arr[i],'#000'));return c.getImageData(0,0,320,155).data;
}
function overlap(aim,actual){
  let inside=0,target=0,outside=0,all=0;
  for(let i=3;i<aim.length;i+=4){
    const a=aim[i]>=128,b=actual[i]>=128;if(a)target++;if(b)all++;if(a&&b)inside++;if(b&&!a)outside++;
  }
  return [Math.round(inside*100/target),Math.round(outside*100/Math.max(1,all))];
}
export default function shadows(ui){
  const {t}=ui,old=ui.load(ui.route,{})||{};
  let named=number(old.named,0,2,0),sel=number(old.sel,0,3,0),show=old.show===true;
  const sets=[0,1,2].map(i=>positions(old.sets?.[i]));let aim=mask(models[named]),score=[];
  const w=studio(ui,t('مدينة بأربع قصاصات','A city in four cutouts'),t('اختر هيئة وقصاصة. حرّك الورق أو أدِره، ثم قرّبه من المصباح لتكبر مساحة ظله على القماش. اكشف تركيب الصورة وقارن النتيجتين.','Choose a silhouette and a cutout. Move or turn the paper, then bring it closer to the lamp to enlarge its shadow. Reveal how the layers made the image.'));
  const current=()=>sets[named];
  function save(){ui.save(ui.route,{sets,named,sel,show});}
  function render(){
    const c=w.ctx;if(!c)return;
    ground(c,'#25332e','#5c5947');
    function screen(x,y,scale,back,parts){
      c.save();c.translate(x,y);c.scale(scale,scale);
      c.fillStyle=back;c.fillRect(35,29,570,245);
      const rad=c.createRadialGradient(324,148,12,324,148,310);rad.addColorStop(0,'rgba(255,250,217,.45)');rad.addColorStop(1,'rgba(100,78,44,.18)');
      c.fillStyle=rad;c.fillRect(35,29,570,245);
      c.save();c.beginPath();c.rect(35,29,570,245);c.clip();
      if(show){
        const bounds=current().flatMap((v,i)=>projected(cuts[i],v)).concat(models[named].flatMap((v,i)=>projected(cuts[i],v)));
        const xs=bounds.map(p=>p[0]),ys=bounds.map(p=>p[1]);
        const mx=(Math.max(...xs)+Math.min(...xs))/2,my=(Math.max(...ys)+Math.min(...ys))/2;
        const magnify=Math.min(2,460/Math.max(1,Math.max(...xs)-Math.min(...xs)),195/Math.max(1,Math.max(...ys)-Math.min(...ys)));
        c.translate(320,152);c.scale(magnify,magnify);c.translate(-mx,-my);
      }
      if(!parts){for(let i=0;i<4;i++)paper(c,i,models[named][i],'#af9e7b');}
      cuts.forEach((shape,i)=>paper(c,i,current()[i],parts?color[i]:'#27372c',parts?'#e9dec4':i===sel&&!show?'#c78a51':null,parts?2:1));
      c.restore();
      line(c,33,278,610,278,'#b29562',3);c.restore();
    }
    if(show){
      screen(0,38,.50,'#c2b397',true);screen(320,38,.50,'#dfd4b7',false);
      text(c,t('مواضع الورق','Paper layers'),159,229,18,'#f7e8cc','center');text(c,t('الظل المركب','Combined shadow'),480,229,18,'#f7e8cc','center');
    }else screen(0,0,1,'#dfd4b7',false);
    text(c,t(...names[named]),585,300,15,'#f4e5c9','right');
  }
  function status(){
    score=overlap(aim,mask(current()));w.canvas.dataset.cover=score[0];w.canvas.dataset.spill=score[1];
    w.describe(t('مساحة الهدف المغطاة ','Target coverage ')+score[0]+'% · '+t('من ظلك خارج الهدف ','Your shadow outside the target ')+score[1]+'%.');
  }
  function controls(){
    const objs=el('div',null,'pra-row'),selects=el('div',null,'pra-row'),p=current()[sel];
    selects.append(select('subject',t('شكل الظل','Target silhouette'),names.map((v,i)=>[i,t(...v)]),named,v=>{named=+v;aim=mask(models[named]);show=false;refresh();}));
    pieces.forEach((n,i)=>{const b=button('piece-'+i,t(...n),()=>{sel=i;show=false;refresh();});b.setAttribute('aria-pressed',String(i===sel));objs.append(b);});
    const inputs=[
      ['x',t('الموقع الأفقي','Horizontal position'),85,555],['y',t('الارتفاع على القماش','Position down the screen'),55,245],
      ['rotate',t('الدوران °','Rotation °'),-180,180],['scale',t('تكبير الظل %','Shadow magnification %'),45,180]
    ].map(([id,l,min,max],i)=>range(id,l,min,max,p[i],v=>{p[i]=v;save();render();status();}));
    const reveal=button('reveal',show?t('عد إلى وضع الورق','Return to the cutouts'):t('اعرض الورق والظل معًا','Reveal both layers'),()=>{show=!show;refresh();});
    reveal.className='pra-main';reveal.setAttribute('aria-pressed',String(show));
    resetControls(w.controls,selects,objs,...inputs,reveal);
  }
  function refresh(){save();render();status();controls();}
  controls();render();status();
}
