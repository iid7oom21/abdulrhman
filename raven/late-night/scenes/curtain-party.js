import {el,board,actions,button,status,file,transport,control,slider,bound} from './ui.js';
import {theater} from './art.js';
import {scene,recall,record} from './scene-piece.js';

const title=['حفلة خلف الستارة', 'A party behind the curtain'];
const intro=['أعطِ الستارة والضوء والموسيقي إشارة لكل واحد، ثم اتخذ مقعدك.', 'Cue the curtain, light and musician, then take your seat.'];
const signals=[['فتح الستارة','Curtain opens'],['إضاءة المنصة','Stage light on'],['دخول الموسيقي','Musician enters']];
function curtain(ui){
  const {root,t}=ui,s=recall(ui,d=>({times:signals.map((_,i)=>bound(d.times?.[i],[1,3,4][i],0,6)),at:0,shown:false,back:false}));
  const stage=board(root,...title,t),edit=el('div'),play=el('div'),report=el('div'),msg=status(root);root.append(edit,play,report);
  let player;
  signals.forEach((label,i)=>{const output=el('output');const input=slider(0,6,s.times[i],v=>{s.times[i]=v;s.shown=false;s.back=false;report.replaceChildren();player.set(0);output.value=v+' s';},'cue-'+i,.5);output.value=s.times[i]+' s';const field=control(t(...label),input);field.append(output);edit.append(field);});
  function textAt(sec){return signals.filter((_,i)=>sec>=s.times[i]).map(label=>t(...label)).join(' / ')||t('المسرح ينتظر الإشارة.','The stage awaits its first cue.');}
  function results(){
    report.replaceChildren();if(!s.shown)return;
    const ordered=signals.map((label,i)=>({name:t(...label),sec:s.times[i]})).sort((a,b)=>a.sec-b.sec);
    const difference=s.times[1]-s.times[0];
    report.append(el('p',difference===0?t('اشتغل الضوء لحظة فتح الستارة.','The light and curtain shared a cue.'):t('اشتغل الضوء ','The light came on ')+Math.abs(difference)+t(' ث ',' s ')+(difference<0?t('قبل فتح الستارة.','before the curtain opened.'):t('بعد فتح الستارة.','after the curtain opened.'))));
    actions(report,button(s.back?t('ارجع إلى مقعد الجمهور','Return to the audience'):t('افتح كواليس الإشارات','Show cue sheet'),()=>{s.back=!s.back;player.update();results();},'backstage'));
    if(s.back){const l=el('ol',null,'ns-list');ordered.forEach(q=>l.append(el('li',q.sec+' s · '+q.name)));report.append(l);}
    const data=()=>({times:[...s.times],seconds:8});
    actions(report,button(t('احفظ الافتتاح','Save opening'),()=>record(ui,t(...title),'scene',data(),stage.canvas,msg,{ar:'عُرض افتتاح بإشارات صانع المشهد.',en:'A stage opening followed its maker’s cues.',data:data()}),'save'),
      button(t('نزّل ورقة الإشارات','Download cue sheet'),()=>file('raven-stage-cues.json',JSON.stringify(data(),null,2)),'export'));
  }
  player=transport(play,ui,8,sec=>{s.at=sec;theater(stage.ctx,s.times,sec,s.back);stage.caption.textContent=textAt(sec);},()=>{s.shown=true;results();},s.at);
  actions(root,button(t('ارجع إلى بداية العرض','Restart opening'),()=>{s.back=false;player.set(0);results();},'retry'));player.update();results();
}

export default scene('curtain-party',title,intro,curtain);
