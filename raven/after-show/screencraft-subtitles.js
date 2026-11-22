import {W,H,clamp,one,table,act,picker,range,options,tabs,node,rect,poly,line,ellipse,sky,text,grain} from './screencraft-ui.js';

const clips=[
  {speaker:['الخبّاز','Baker'], line:['تفضّلي، الخبز الدافي يطلع بعد شوي.','Come in. The warm bread will be out shortly.'],
    parts:[[['تفضّلي','Come in'],['حياك','Welcome']], [['الخبز الدافي','the warm bread'],['الرغيف الحار','the hot loaf']], [['يطلع بعد شوي','will be out shortly'],['قريب يجهز','is nearly ready']]],
    meaning:[['الترحيب','welcome'],['الخبز الدافي','warm bread'],['قرب الموعد','timing']]},
  {speaker:['الزبونة','Customer'], line:['مشكور، خلّ لي رغيفين للرحلة.','Thanks. Save me two loaves for the trip.'],
    parts:[[['مشكور','Thanks'],['تسلم','Thank you']], [['خلّ لي رغيفين','save me two loaves'],['احجز لي ثنتين','keep two for me']], [['للرحلة','for the trip'],['للمشوار','for my journey']]],
    meaning:[['الشكر','thanks'],['عدد الأرغفة','quantity'],['غرض الطلب','purpose']]},
  {speaker:['الخبّاز','Baker'], line:['على عيني، خذيها عند الباب الخلفي.','Of course. Pick them up at the back door.'],
    parts:[[['على عيني','Of course'],['أبشري','Gladly']], [['تستلمينها','pick them up'],['خذيها','collect them']], [['عند الباب الخلفي','by the back door'],['من الباب الخلفي','at the rear door']]],
    meaning:[['قبول الطلب','acceptance'],['الاستلام','collection'],['المكان','location']]}
];
const plainParts=[
  [[['ادخلي','Step inside'],['تفضّلي بالدخول','Please come in']],[['الخبز الساخن','the hot bread'],['الرغيف الساخن','the hot loaf']],[['يجهز قريبًا','will be ready soon'],['سيجهز بعد قليل','will be ready shortly']]],
  [[['شكرًا','Thanks'],['أشكرك','Thank you']],[['احجز لي رغيفين','reserve two loaves'],['أريد رغيفين','I need two loaves']],[['للرحلة','for the trip'],['لرحلتي','for my journey']]],
  [[['حسنًا','Very well'],['بالتأكيد','Certainly']],[['استلمي الخبز','collect the bread'],['استلمي طلبك','collect your order']],[['من الباب الخلفي','at the rear door'],['من المدخل الخلفي','at the back entrance']]]
];
const phrases=(s,index)=>s.tone==='warm'?clips[index].parts:plainParts[index];
const duration=4;
const freshCaption=(v={})=>({parts:[0,1,2].map(i=>one(v?.parts?.[i],['0','1','off'],'0')),split:one(v?.split,[1,2],2),
  hold:clamp(v?.hold,1,3.8,2.6),pos:one(v?.pos,['low','high']),tone:one(v?.tone,['warm','plain'])});
function bakery(c,index,phase,translate){
  const palettes=[['#83959c','#f2bd85'],['#899b97','#edc69a'],['#8d9b94','#f6cb93']];
  sky(c,...palettes[index]);
  rect(c,'#4a5049',0,25,640,15);rect(c,'#373e37',13,43,613,200);
  for(let i=0;i<4;i++){
    const x=22+i*153;
    const g=c.createLinearGradient(x,60,x+150,200);g.addColorStop(0,'#b9c1ad');g.addColorStop(.56,'#788b81');g.addColorStop(1,'#a28366');
    rect(c,g,x,52,141,169);
    poly(c,'#e6bb7d55',[[x+131,55],[x+100,55],[x+14,218],[x+46,218]]);
    rect(c,'#d6bb92',x,51,142,3);
  }
  // The shop's name is physically painted on the window. The collision test uses these edges.
  rect(c,'#355552',214,61,212,33);
  line(c,'#e8d3a8',1,[218,65],[422,65]);line(c,'#e8d3a8',1,[218,90],[422,90]);
  text(c,translate('مخبز السنابل','WHEATSHEAF'),320,84,18,'#f7dfac',650);
  for(let i=0;i<3;i++){
    rect(c,'#3e443c',i*227+12,122,163,4);
    for(let k=0;k<6;k++){
      const x=i*227+20+k*25;
      ellipse(c,'#a56f43',x,117,10,5);line(c,'#efe0a0',1,[x-5,114],[x-3,118]);
    }
  }
  rect(c,'#76634c',0,223,W,51);rect(c,'#d2ba83',0,221,W,6);
  for(let k=0;k<28;k++){const x=k*23;line(c,'#937e5f',1,[x,235],[x+8,269]);}
  function person(x,y,color,apron,hat){
    poly(c,color,[[x-15,y+15],[x+13,y+15],[x+26,y+38],[x+30,221],[x-32,221],[x-24,y+35]]);
    poly(c,apron,[[x-10,y+27],[x+12,y+27],[x+18,220],[x-21,220]]);
    ellipse(c,'#91684f',x,y,13,17);ellipse(c,hat,x-1,y-9,15,9);
  }
  person(136+(index===0?phase*7:0),145,'#6b7166','#bfb19a','#e4d4b3');
  person(508-(index===1?phase*10:0),151,'#495d62','#535c63','#53443e');
  rect(c,'#232d2d',0,0,W,15);rect(c,'#232d2d',0,275,W,33);grain(c);
}
function layout(c,s,index,narrow,t){
  const clip=clips[index];
  const pieces=phrases(s,index).map((part,i)=>s.parts[i]==='off'?'':t(...part[+s.parts[i]]));
  const lines=[pieces.slice(0,s.split).filter(Boolean).join(' '),pieces.slice(s.split).filter(Boolean).join(' ')].filter(Boolean);
  const font=narrow?25:21, stride=font*1.24, max=narrow?285:600;
  c.font='600 '+font+'px system-ui,sans-serif';
  const longest=Math.max(0,...lines.map(v=>c.measureText(v).width));
  const first=s.pos==='high'?82:244;
  const nameBox={left:214,right:426,top:61,bottom:94};
  const covered=lines.some((l,i)=>{
    const y=first+i*stride,w=c.measureText(l).width;
    return (320-w/2)<nameBox.right&&(320+w/2)>nameBox.left&&y>=nameBox.top&&y-font<=nameBox.bottom;
  });
  const chars=pieces.join(' ').replace(/\s/gu,'').length;
  return {lines,font,stride,first,covered,chars,longest,max,missing:clip.meaning.filter((v,i)=>s.parts[i]==='off').map(v=>t(...v))};
}
export function subtitles(ui){
  const {t}=ui,old=ui.load('subtitles',{})||{};
  const state={clip:one(old.clip,[0,1,2]),narrow:old.narrow===true,edits:[0,1,2].map(i=>freshCaption(old.edits?.[i]))};
  const w=table(ui,t('كرسي المترجم الأخير','The last subtitle chair'),
    t('حرّر ثلاثة أسطر من حوار المخبز. اختبر زمن القراءة ومكان الترجمة قبل ردّ المتحدث التالي.','Edit three exchanges at the bakery. Check reading time and placement before the next speaker replies.'),
    (c,sec)=>{
      const idx=Math.min(2,Math.floor(sec/duration)), local=sec-idx*duration,s=state.edits[idx];
      bakery(c,idx,local,t);
      const m=layout(c,s,idx,state.narrow,t);
      if(state.narrow){rect(c,'#182329de',0,0,170,H);rect(c,'#182329de',470,0,170,H);}
      c.save();c.beginPath();c.rect(state.narrow?170:0,0,state.narrow?300:W,H);c.clip();
      if(local>=.2&&local<.2+s.hold)m.lines.forEach((l,i)=>{
        c.font='600 '+m.font+'px system-ui,sans-serif';const width=c.measureText(l).width;
        const y=m.first+m.stride*i;rect(c,s.tone==='warm'?'#372f24db':'#142027eb',313-width/2,y-m.font,14+width,m.font+5);
        text(c,l,320,y,m.font,s.tone==='warm'?'#fff0cc':'#fafdfd',600);
      });
      c.restore();
    },()=>duration*3);
  function save(){ui.save('subtitles',state);}
  function feedback(){
    const details=state.edits.map((s,i)=>{
      const m=layout(w.ctx,s,i,state.narrow,t), rate=m.chars/s.hold,missing=m.missing.length?m.missing.join('، '):t('مكتمل','complete');
      return (i+1)+' · '+rate.toFixed(1)+' '+t('حرف/ث','characters/s')+' · '+(m.covered?t('الاسم مغطّى','shop name covered'):t('الاسم ظاهر','shop name visible'))+' · '+(m.longest>m.max?t('السطر يتجاوز العرض','line exceeds frame'):t('يناسب العرض','fits frame'))+' · '+t('المعنى','meaning')+' '+missing;
    });
    w.result.textContent=details.join('\n');
    w.frame.setAttribute('aria-label',t('واجهة مخبز مع ترجمة الحوار','Bakery window with dialogue subtitles')+' · '+details[state.clip]);
  }
  function render(){
    const k=state.clip,s=state.edits[k],clip=clips[k];
    tabs(w,'subtitle',clips.map((v,i)=>[i,(i+1)+' · '+t(...v.speaker)]),k,v=>{state.clip=v;save();render();w.seek(v*duration+1);});
    w.controls.replaceChildren(node('p',t(...clip.line),'sc-subhead'));
    for(let i=0;i<3;i++){
      const opts=phrases(s,k)[i].map((x,j)=>[String(j),t(...x)]);opts.push(['off',t('اترك العبارة','Omit phrase')]);
      w.controls.append(picker('part'+i,t(...clip.meaning[i]),opts,s.parts[i],v=>{s.parts[i]=v;save();feedback();w.refresh();}));
    }
    function adjust(key,v){s[key]=v;save();feedback();w.refresh();}
    w.controls.append(picker('break',t('كسر السطر بعد','Break after'),[['1',t('العبارة الأولى','First phrase')],['2',t('العبارة الثانية','Second phrase')]],String(s.split),v=>adjust('split',+v)),
      picker('position',t('موضع الترجمة','Caption position'),options([['low','أسفل الصورة','Lower frame'],['high','على الزجاج','On the window']],t),s.pos,v=>adjust('pos',v)),
      picker('tone',t('نبرة العرض','Delivery'),options([['warm','دافئة','Warm'],['plain','محايدة','Neutral']],t),s.tone,v=>{s.tone=v;save();render();w.controls.querySelector('[data-sc="tone"]').focus();}),
      range('hold',t('مدة ظهور الترجمة بالثواني','Seconds on screen'),s.hold,1,3.8,.1,v=>adjust('hold',v)),
      picker('width',t('شاشة المراجعة','Review screen'),options([['wide','عريضة','Wide'],['phone','ضيقة','Narrow']],t),state.narrow?'phone':'wide',v=>{state.narrow=v==='phone';save();feedback();w.refresh();}),
      act('screen-all',t('اعرض المقاطع الثلاثة','Screen all three'),()=>{w.seek(0);w.main.querySelector('[data-sc="play"]').click();}));
    feedback();w.refresh();
  }
  render();w.seek(state.clip*duration+1);
}
