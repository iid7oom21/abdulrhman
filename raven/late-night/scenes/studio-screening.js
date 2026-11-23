import {el,button,control,select,transport} from './ui.js';

const prefix='raven.studio.named-board.v1.';
const safeID=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,90}$/.test(id);

function picture(src) {
  if(typeof src!=='string')return null;
  if(src.length<512000 && /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+=*$/.test(src))return src;
  const reel=src.match(/^\.\.\/raven\/after-show\/assets\/(exterior|hand|envelope|lamp)\.webp$/);
  if(reel)return '../after-show/assets/'+reel[1]+'.webp';
  const still=src.match(/^(?:\.\/|\/)?visual-lab\/assets\/(01-manor|02-archive|03-desk|04-corridor)\.webp$/);
  return still?'../../studio/visual-lab/assets/'+still[1]+'.webp':null;
}
function read(id) {
  if(!safeID(id))return null;
  const raw=localStorage.getItem(prefix+id);if(!raw)return null;
  const b=JSON.parse(raw);
  if(b?.id!==id||b.version!==1||typeof b.name!=='string'||!b.name.trim()||b.name.length>70||!Array.isArray(b.scenes)||!b.scenes.length||b.scenes.length>80)return null;
  const frames=[];
  for(const [i,s] of b.scenes.entries()){
    if(s?.sceneNumber!==i+1||typeof s.title!=='string'||typeof s.prompt!=='string'||s.prompt.length>8000||!Number.isInteger(s.duration)||s.duration<=0||s.duration>120)return null;
    const src=picture(s.thumbnail);if(!src)return null;
    frames.push({src,title:s.title,prompt:s.prompt,seconds:s.duration});
  }
  const seconds=frames.reduce((n,f)=>n+f.seconds,0);
  return {id:'studio-'+id,title:b.name,seconds,sourceSeconds:seconds,frames,
    settings:frames.map((f,i)=>(i+1)+'. '+f.title+' · '+f.seconds+' s\n'+f.prompt).join('\n\n')};
}

// Reading the Studio archive takes an explicit action on the maker's side of the handoff.
export function chooseStudioBoard(ui,root,include){
  const {t}=ui,area=el('div',null,'ns-actions');
  const picker=button(t('اختر لوحة من الاستوديو على هذا الجهاز','Choose a Studio board on this device'),()=>{
    area.replaceChildren();
    let names=[];
    try{
      names=Object.keys(localStorage).filter(k=>k.startsWith(prefix)).flatMap(k=>{
        const id=k.slice(prefix.length);try{const b=read(id);return b?[[id,b.title]]:[];}catch{return [];}
      });
    }catch{area.append(el('p',t('تعذرت قراءة مسودات الاستوديو على هذا الجهاز.','Studio drafts could not be read on this device.')));return;}
    if(!names.length){const a=el('a',t('افتح الاستوديو','Open Studio'));a.href=ui.url('../../studio/?tab=storyboard');area.append(el('p',t('لا تتوفر لوحة مسمّاة للعرض على هذا الجهاز.','There is no named board available to screen on this device.')),a);return;}
    const made=el('p');made.setAttribute('role','status');
    const list=select([['',t('اختر لوحة','Choose a board')],...names],'',v=>add.disabled=!v,'studio-list');
    const add=button(t('أضف هذه اللوحة للبرنامج','Add this board to the programme'),()=>{
      let b=null;try{b=read(list.value);}catch{}
      if(b){include(b);return;}made.textContent=t('تعذرت قراءة اللوحة المختارة.','The selected board could not be read.');
    },'studio-add');add.disabled=true;
    area.append(control(t('مسودات الاستوديو','Studio drafts'),list),add,made);
  },'studio-picker');
  area.append(picker);root.append(area);
}

export function playStudioBoard(ui,root,b){
  const {t}=ui,figure=el('figure'),img=el('img',null,'ns-still'),cap=el('figcaption'),retry=button(t('أعد تحميل اللقطة','Retry shot'),()=>{img.src=b.frames[previous].src;},'studio-retry');
  retry.hidden=true;img.alt='';let previous=-1;
  img.onerror=()=>{retry.hidden=false;};img.onload=()=>{retry.hidden=true;};
  figure.append(img,cap,retry);root.append(figure);
  const player=transport(root,ui,b.seconds,sec=>{
    let end=0;let i=b.frames.findIndex(s=>{end+=s.seconds;return sec<end;});if(i<0)i=b.frames.length-1;
    if(previous===i)return;previous=i;retry.hidden=true;img.src=b.frames[i].src;
    // Only the picture and its running position belong on the audience screen.
    cap.textContent=t('لقطة ','Shot ')+(i+1)+' / '+b.frames.length;
  });
  player.update();
}
