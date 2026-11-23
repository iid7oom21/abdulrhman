import {mount} from '../night-shell.js';
import {el,button,field,select,row,output,surface} from './kit.js';
import {topics,solutions,generate,clue,fits} from './puzzle-rules.js';

const s={topic:'cinema',level:'simple',serial:0,rules:[],board:[0,0,0],solved:false,changed:false,alter:null};
mount({id:'puzzle-owner',title:['صاحب اللغز','The puzzle keeper'],intro:['رتّب ثلاثة ملصقات في أربع خانات. بعد الحل جرّب كيف يتغيّر اللغز إذا بدّلت قيدًا واحدًا.','Hang three posters in four slots. After solving, change a clue and see what happens.'],render(ui){
  const {t,lang}=ui,w=surface(ui),normal=()=>topics[s.topic][lang==='ar'?0:1];
  function fresh(){
    const hash=17+s.serial*31+Object.keys(topics).indexOf(s.topic)*7+(s.level==='hard'?101:0);
    s.rules=generate(hash,s.level);s.board=[0,0,0];s.solved=false;s.changed=false;s.alter=null;
  }
  if(!s.rules.length)fresh();
  function markup(){
    w.replaceChildren();
    const topicNames={cinema:t('السينما','Cinema'),harbor:t('الميناء','Harbour'),garden:t('الحديقة','Garden')};
    w.append(row(field(t('موضوع الملصقات','Poster theme'),select('theme',Object.entries(topicNames),s.topic,v=>{s.topic=v;fresh();markup();})),
      field(t('الصعوبة','Difficulty'),select('difficulty',[['simple',t('تثبيت ثم ترتيب','Anchor and arrange')],['hard',t('ترتيب بالعلاقات','Relational puzzle')]],s.level,v=>{s.level=v;fresh();markup();}))));
    const names=normal(),paper=el('ol',null,'cr-list');s.rules.forEach(r=>paper.append(el('li',clue(r,names,t))));
    w.append(el('h2',t('تعليمات التعليق','The hanging instructions')),paper);
    const grid=el('div',null,'cr-fields');names.forEach((name,i)=>{
      const n=el('div',null,'cr-paper');n.append(el('p',name,'cr-poster'),field(t('الخانة','Slot'),select('slot'+i,[[0,t('اختر','Choose')],...[1,2,3,4].map(j=>[j,String(j)])],s.board[i],v=>{s.board[i]=+v;result.textContent='';})));grid.append(n);
    });w.append(grid);
    const result=output();
    function check(){
      if(s.board.includes(0)||new Set(s.board).size<3){result.textContent=t('يحتاج كل ملصق إلى خانة مختلفة.','Each poster needs its own slot.');return;}
      const bad=s.rules.find(r=>!fits(s.board,r));
      if(bad){result.textContent=t('هذا الترتيب يخالف القيد «','This layout conflicts with “')+clue(bad,names,t)+(lang==='ar'?'».':'”.');return;}
      if(!s.solved)ui.recordEvent({ar:'اكتمل تعليق ثلاثة ملصقات في لغز '+topicNamesAr[s.topic]+'.',en:'Three posters were hung in the '+s.topic+' puzzle.',data:{kind:'puzzle-solved',topic:s.topic,level:s.level}});
      s.solved=true;markup();
    }
    w.append(row(button('verify',t('اختبر الترتيب','Check layout'),check),button('hint',t('لمحة','A hint'),()=>{
      const r=s.rules.find(k=>s.board[k.a]===0||(!['at','not'].includes(k.op)&&s.board[k.b]===0)||!fits(s.board,k))||s.rules[0];
      result.textContent=t('ابدأ بهذا القيد','Try applying this clue')+' · '+clue(r,names,t);
    }),button('new',t('لغز آخر','Another puzzle'),()=>{s.serial++;fresh();markup();})),result);
    if(!s.solved)return;
    w.append(el('p',t('وجدت ترتيبًا يحقق كل القيود. فحص المحرك 24 ترتيبًا.','Your layout satisfies every clue. The engine checked all 24 possible arrangements.'),'cr-read'));
    const pick=select('edit-rule',s.rules.map((r,i)=>[i,clue(r,names,t)]),s.alter?.idx??0,v=>{s.alter={idx:+v,mode:'remove'};update();});
    const action=select('rule-change',[['remove',t('احذف القيد','Remove clue')],['at',t('ثبّت ملصق القيد في خانة 4','Place its poster in slot 4')],['not',t('امنع ملصق القيد من خانة 2','Keep its poster out of slot 2')]],s.alter?.mode||'remove',v=>{s.alter={idx:+pick.value,mode:v};update();});
    const what=output();function update(){const i=+pick.value,mode=action.value;s.alter={idx:i,mode};const rules=s.rules.slice();if(mode==='remove')rules.splice(i,1);else rules[i]={op:mode,a:rules[i].a,b:mode==='at'?4:2};
      const n=solutions(rules).length;what.dataset.count=n;what.textContent=t('عدد الترتيبات بعد التعديل','Number of matching layouts after the edit')+' · '+n;}
    w.append(el('h3',t('اختبر نسخة بقيد مختلف','Test an altered clue')),row(field(t('القيد','Clue'),pick),field(t('التعديل','Edit'),action)),what);update();
  }
  const topicNamesAr={cinema:'السينما',harbor:'الميناء',garden:'الحديقة'};markup();
}});
