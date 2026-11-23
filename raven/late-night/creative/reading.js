import {mount} from '../night-shell.js';
import {el,button,field,select,words,row,output,surface} from './kit.js';

const tones={gentle:['هادئة','Gentle'],plain:['مباشرة','Direct'],urgent:['مستعجلة','Urgent']};
const lines={
 time:['كم بقي قبل إغلاق الصالة؟','How long until you close the hall?'],
 bag:['نسيت حقيبتي عند آخر صف.','I left my bag by the back row.'],
 door:['أين أنتظر لترافقني؟','Where can I wait for you to escort me?'],
 check:['أقدر أوصف لك الحقيبة أولًا.','I can describe the bag first.']
};
function intent(s){
  if(/وصف|لون|describe|colou?r/iu.test(s))return 'check';
  if(/حقيب|شنط|bag|satchel/iu.test(s))return 'bag';
  if(/وق[تت]|بقي|متى|إغلاق|غلاق|time|long|close/iu.test(s))return 'time';
  if(/باب|أنتظر|ترافق|door|escort|wait/iu.test(s))return 'door';return 'other';
}
function perform(take){
  let item=false;
  return take.map(l=>{
    let ans,escorted=false;
    if(l.intent==='bag'){item=true;ans=l.tone==='urgent'?['وقفت عند الباب. قل لي الصف حتى أرافقك.','I have stopped at the door. Tell me the row so I can escort you.']:['آخر صف؟ خلك عند الشباك وأنا أطلع المفتاح.','The back row? Stay by the box office while I get the key.'];}
    else if(l.intent==='door'){escorted=item;ans=item?['انتظر تحت ضوء الشباك. بندخل سوا.','Wait under the box-office light. We will go in together.']:['أقدر أرافقك بعد ما أعرف وش تحتاج من الداخل.','I can escort you once I know what you need inside.'];}
    else if(l.intent==='check'){escorted=item;ans=item?['تفضّل اوصفها. أحمل المفتاح وأمشي معك لآخر صف.','Please describe it. I will take the key and walk you to the back row.']:['وش الشيء اللي تبي توصفه؟','What would you like to describe?'];}
    else if(l.intent==='time')ans=l.tone==='gentle'?['باقي دقيقتان. خذ نفس وقل لي وش تحتاج.','Two minutes. Catch your breath and tell me what you need.']:['دقيقتان. بعدها أقفل الباب وأنهي سجل الوردية.','Two minutes. Then I lock the door and close the shift log.'];
    else ans=l.tone==='urgent'?['سمعت استعجالك. أي باب أو غرض تقصد؟','I hear the urgency. Which door or item do you mean?']:['وضح لي طلبك وأنا عند الشباك.','Tell me what you need while I am at the box office.'];
    return {...l,answer:ans,escorted};
  });
}
const session={take:[],tone:'gentle',draft:'',line:'time',alternate:'bag',cursor:0};
mount({id:'reading-actor',title:['ممثل طاولة القراءة','The table-read actor'],intro:['عند شباك السينما دقيقتان قبل الإغلاق. أمامك أربعة أدوار لتطلب المرافقة. يجيب الموظف من بطاقة دور مكتوبة على جهازك.','Two minutes to closing at the box office. You have four turns to ask for an escort. The clerk responds from a local, written role card.'],render(ui){
  const {t}=ui,w=surface(ui);
  function display(l){return l.custom||t(...lines[l.intent]);}
  function add(custom=false){
    if(session.take.length>=4)return;
    const txt=custom?session.draft.trim():'';
    if(custom&&!txt)return;
    session.take.push({custom:txt,intent:custom?intent(txt):session.line,tone:session.tone});session.draft='';
    if(session.take.length===4){session.alternate=session.take[0].intent==='bag'?'time':'bag';ui.recordEvent({ar:'اكتملت بروفة شباك السينما في أربعة أدوار.',en:'The box-office rehearsal completed four turns.',data:{kind:'reading-complete',turns:4}});}
    draw();
  }
  function card(line){const box=el('div',null,'cr-paper');
    box.append(el('p',t('الزائر','Visitor')+' · '+t(...tones[line.tone])),el('blockquote',display(line)),el('p',t('موظف الشباك','Box-office clerk')),el('blockquote',t(...line.answer)));
    return box;
  }
  function draw(){
    const played=perform(session.take);w.replaceChildren();
    w.append(el('p',t('دورك: استعد حقيبتك من آخر صف. دور الموظف: إغلاق السينما ومرافقة من يحتاج الرجوع إلى الصالة.','Your role: retrieve a bag left in the back row. The clerk must lock up and escort anyone returning to the hall.'),'cr-read'));
    if(played.length<4){
      w.append(el('h2',t('دور ','Turn ')+(played.length+1)+' / 4'));
      if(played.length)w.append(card(played.at(-1)));
      const opts=Object.entries(lines).map(([id,n])=>[id,t(...n)]);
      const custom=words('custom',session.draft,t('اكتب ما تقوله للموظف','Your line to the clerk'),115,v=>{session.draft=v;send.disabled=!v.trim();});
      const send=button('send-custom',t('قل جملتي','Speak my line'),()=>add(true));send.disabled=!session.draft.trim();
      w.append(field(t('النبرة','Delivery'),select('tone',Object.entries(tones).map(([id,n])=>[id,t(...n)]),session.tone,v=>{session.tone=v;})),
        field(t('جملة من بطاقة الدور','Line from the rehearsal card'),select('line',opts,session.line,v=>{session.line=v;})),
        button('speak',t('اقرأ الجملة','Read the line'),()=>add()),field(t('أو جملة من عندك','Or your own line'),custom),send);
    }else{
      const alt=[{custom:'',intent:session.alternate,tone:session.take[0].tone},...session.take.slice(1)];
      const b=perform(alt),idx=session.cursor;
      const opts=Object.entries(lines).filter(([id])=>id!==session.take[0].intent||session.take[0].custom).map(([id,n])=>[id,t(...n)]);
      w.append(el('h2',t('بروفتان عند الشباك','Two box-office takes')),
        field(t('جرّب افتتاحية أخرى','Try a different opening'),select('alternate',opts,session.alternate,v=>{session.alternate=v;session.cursor=0;draw();})));
      const seq=row(...[0,1,2,3].map(i=>{const btn=button('turn'+i,t('الدور ','Turn ')+(i+1),()=>{session.cursor=i;draw();});btn.setAttribute('aria-pressed',String(i===idx));return btn;}));w.append(seq);
      function outcome(take){
        const turn=take.findIndex(line=>line.escorted);
        if(turn<0)return el('p',t('انتهت البروفة من دون اتفاق صريح على الدخول معًا.','This take ended without an agreed escort.'),'cr-read');
        return el('p',t('اتفق الموظف على مرافقتك في الدور ','The clerk agreed to escort you on turn ')+(turn+1)+' · «'+t(...take[turn].answer)+'»','cr-read');
      }
      const a=card(played[idx]),c=card(b[idx]);a.append(outcome(played));c.append(outcome(b));a.prepend(el('h3',t('البروفة الأصلية','Original take')));c.prepend(el('h3',t('بعد تعديل الافتتاحية','Revised opening')));
      const both=el('div',null,'cr-columns');both.append(a,c);w.append(both);
      const note=(line)=>line.intent==='bag'?t('سمّيت الغرض، فانتقل الموظف إلى مكانه.','Naming the item let the clerk turn to its location.'):
        line.intent==='time'?t('ربط السؤال رد الموظف بوقت الإغلاق.','The question drew the reply toward closing time.'):t('الرد يتبع الطلب الذي سمعه الموظف هنا.','The reply follows the request the clerk heard here.');
      w.append(el('p',t('من البروفة الأصلية','From the original take')+' «'+display(played[idx])+'» · '+note(played[idx]),'cr-read'));
      w.append(button('again',t('ابدأ بروفة جديدة','Start another rehearsal'),()=>{Object.assign(session,{take:[],line:'time',draft:'',tone:'gentle',cursor:0});draw();}));
    }
  }
  draw();
}});
