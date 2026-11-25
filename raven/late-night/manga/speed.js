import {el,button,status,actions,board,control,select,slider,transport} from '../scenes/ui.js';
import {scene,recall,record} from '../scenes/scene-piece.js';
import {link} from '../night-shell.js';
import {INK,paper,screentone,motionLines,ticket,marquee} from './art.js';

const title=['خطوط السرعة','Speed lines'];
const intro=['تذكرة تطير عبر بهو سينما المرسى في ثانية ونصف. اختر كم إطارًا تمسك كل رسمة، وكم خط سرعة، ومتى تلطّخ الحركة.','A ticket flies across the Marsa cinema lobby in a second and a half. Choose how many frames each drawing holds, how many speed lines, and when to smear the motion.'];
export const FRAMES=36, FPS=24, START=650, TRAVEL=580;
export const position=f=>START-TRAVEL*(1-Math.pow(1-Math.min(f,FRAMES-1)/(FRAMES-1),3));
// The animation as drawn: which drawing appears on each frame, the jump between drawings and their count.
export function analyse({step,lines,smear,budget}){
  const drawings=[];for(let f=0;f<FRAMES;f+=step)drawings.push(f);
  const jumps=drawings.slice(1).map((f,i)=>Math.abs(position(f)-position(drawings[i])));
  const maxJump=Math.round(Math.max(...jumps));
  const felt=lines>=6||smear, readable=lines<=28, steady=maxJump<=70||smear, affordable=!budget||drawings.length<=budget;
  return {drawings:drawings.length,maxJump,felt,readable,steady,affordable,ok:felt&&readable&&steady&&affordable};
}
const shown=(f,step)=>Math.floor(f/step)*step;

function draw(ui){
  const {root,t}=ui;
  const s=recall(ui,d=>({step:[1,2,3].includes(d.step)?d.step:2,lines:Number.isFinite(d.lines)?Math.min(40,Math.max(0,d.lines)):12,smear:!!d.smear,mode:d.mode==='budget'?'budget':'free'}));
  const stage=board(root,...title,t),msg=status(root);
  const verdict=el('div',null,'manga-result');verdict.setAttribute('aria-live','polite');
  const opts=el('div');root.append(opts);
  const budget=()=>s.mode==='budget'?18:0;
  function render(time){
    const c=stage.ctx,f=Math.min(FRAMES-1,Math.round(time*FPS)),d=shown(f,s.step),x=position(d),next=position(Math.min(FRAMES-1,d+s.step));
    paper(c,720,330);screentone(c,0,236,720,94,7,1.5);c.fillStyle=INK;c.fillRect(0,232,720,5);
    marquee(c,40,40,190,120,'MARSA');
    const jump=Math.abs(next-x);
    motionLines(c,x+30,60,Math.min(680-x,260),150,s.lines,1,7);
    if(s.smear&&jump>45&&d<FRAMES-s.step){c.save();c.globalAlpha=.85;for(let k=1;k<=4;k++)ticket(c,x+k*jump/8,150,1.4,-.25);c.restore();}
    ticket(c,x,150,1.4,-.25);
    const rtl=ui.lang!=='en';c.save();c.fillStyle=INK;c.font='600 16px system-ui';c.direction=rtl?'rtl':'ltr';c.textAlign=rtl?'right':'left';c.fillText(t('إطار ','frame ')+(f+1)+' / '+FRAMES+'  ·  '+t('رسمة ','drawing ')+(d/s.step+1),rtl?700:20,318);c.restore();
    stage.caption.textContent=t('التذكرة عند ','Ticket at ')+Math.round(x)+t(' بكسل من اليسار. ',' px from the left. ')+t('خطوط السرعة: ','Speed lines: ')+s.lines+(s.smear?t(' · تلطيخ مفعّل',' · smear on'):'');
  }
  const play=transport(root,ui,1.5,time=>render(time),evaluate);
  function evaluate(){
    const r=analyse({...s,budget:budget()});verdict.dataset.ok=String(r.ok);
    const rows=[
      [r.felt,t('تحس بالسرعة: ','Feels fast: ')+(s.lines>=6?s.lines+t(' خطًا',' lines'):s.smear?t('التلطيخ يحمل الحركة','the smear carries it'):t('خطوط قليلة وبلا تلطيخ','too few lines and no smear'))],
      [r.readable,t('التذكرة مقروءة: ','Ticket readable: ')+(r.readable?t('الخطوط لا تغطيها','the lines leave it clear'):s.lines+t(' خطًا تغطي التذكرة',' lines cover the ticket'))],
      [r.steady,t('أكبر قفزة بين رسمتين ','Largest jump between drawings ')+r.maxJump+t(' بكسل',' px')+(r.maxJump>70?(s.smear?t(' يغطيها التلطيخ',' covered by the smear'):t(' — تبدو التذكرة تقفز',' — the ticket appears to jump')):'')],
    ];
    if(budget())rows.push([r.affordable,t('عدد الرسمات ','Drawings ')+r.drawings+t(' من ',' of ')+budget()+t(' مسموحة',' allowed')]);
    verdict.replaceChildren(el('h2',r.ok?t('لقطة سريعة ومقروءة','Fast and readable'):t('ما زالت اللقطة تحتاج تعديلًا','The cut still needs work')));
    const list=el('ul',null,'ns-list');rows.forEach(([ok,text])=>{const li=el('li',(ok?'✓ ':'✗ ')+text);li.dataset.ok=String(ok);list.append(li);});verdict.append(list);
    actions(verdict,button(t('احفظ الإعداد في دفتري','Save setup to my notebook'),()=>record(ui,t('خطوط السرعة','Speed lines'),'ink-lines',{...s,result:r},stage.canvas,msg,{ar:'ضبطت لقطة أنمي سريعة',en:'Timed a fast anime cut',data:{kind:'speed-lines',ok:r.ok}}),'save'));
    msg.textContent=t('اكتمل العرض. ','Playback complete. ')+t('رسمات: ','Drawings: ')+r.drawings+'.';
    return r;
  }
  const refresh=()=>{verdict.replaceChildren();play.set(0);};
  const stepSel=select([['1',t('رسمة لكل إطار (على الواحد)','A drawing every frame (on ones)')],['2',t('رسمة كل إطارين (على الاثنين)','A drawing every two frames (on twos)')],['3',t('رسمة كل ثلاثة إطارات','A drawing every three frames (on threes)')]],String(s.step),v=>{s.step=Number(v);refresh();},'step');
  const out=el('output',String(s.lines));
  const lines=slider(0,40,s.lines,v=>{s.lines=v;out.value=String(v);refresh();},'lines');
  const smear=button('',()=>{s.smear=!s.smear;smear.setAttribute('aria-pressed',String(s.smear));smear.textContent=s.smear?t('التلطيخ مفعّل','Smear on'):t('فعّل إطار التلطيخ','Turn on the smear frame');refresh();},'smear');
  smear.setAttribute('aria-pressed',String(s.smear));smear.textContent=s.smear?t('التلطيخ مفعّل','Smear on'):t('فعّل إطار التلطيخ','Turn on the smear frame');
  const mode=select([['free',t('تجربة حرة','Free practice')],['budget',t('تحدي الميزانية: ١٨ رسمة فقط','Budget challenge: 18 drawings at most')]],s.mode,v=>{s.mode=v;refresh();},'mode');
  const lineRow=control(t('خطوط السرعة','Speed lines'),lines);lineRow.append(out);
  opts.append(control(t('المهمة','Task'),mode),control(t('الإيقاع','Timing'),stepSel),lineRow);
  actions(opts,smear,button(t('اختبر اللقطة الآن','Check the cut now'),()=>{play.set(1.5);evaluate();},'check'));
  root.append(verdict,link(t('العودة إلى ليالي الحبر','Back to Ink Nights'),ui.url('ink-studio.html'),'ink-back'));
  play.set(0);
}
export default scene('ink-lines',title,intro,draw);
