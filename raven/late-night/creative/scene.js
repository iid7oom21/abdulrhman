export const places={pier:['الرصيف','Pier'],cinema:['السينما','Cinema'],square:['الساحة','Square']};
export const lights={dusk:['ضوء الغروب','Dusk'],dim:['ضوء خافت','Dim'],amber:['مصباح كهرماني','Amber lamp']};
export const motions={still:['لقطة ثابتة','Locked shot'],walk:['خطوات عابرة','Walk through'],pan:['حركة أفقية','Tracking shot']};
const cues=['arrival','blackout','departure'];
const objectWords={ar:['تدخل الشخصية','تخفت اللوحة','تغادر الشخصية'],en:['The figure arrives','The sign goes dark','The figure departs']};
const phrases={pier:['عند الرصيف','on the pier'],cinema:['أمام شباك السينما','outside the box office'],square:['في ساحة الساعة','in the clock square']};
export function describe(s,i){return {ar:objectWords.ar[i]+' '+phrases[s.setting][0],en:objectWords.en[i]+' '+phrases[s.setting][1]};}
const record=(value,fields)=>value!==null && typeof value==='object' && !Array.isArray(value) &&
  Object.keys(value).every(key=>fields.includes(key));
export function validScene(s){
  if(!record(s,['version','prompt','setting','duration','blackout','shots']) || s.version!==1 ||
    typeof s.prompt!=='string' || !s.prompt.trim() || s.prompt.length>160 ||
    typeof s.setting!=='string' || !Object.hasOwn(places,s.setting) ||
    !Number.isInteger(s.duration)||s.duration<8||s.duration>15 ||
    !Number.isInteger(s.blackout)||s.blackout<2||s.blackout>s.duration-3 ||
    !Array.isArray(s.shots)||s.shots.length!==cues.length)return false;
  let end=0;
  for(const [i,id] of cues.entries()){
    const shot=s.shots[i];
    if(!record(shot,['id','start','seconds','lighting','motion','description']) || shot.id!==id ||
      shot.start!==end || !Number.isInteger(shot.seconds)||shot.seconds<1 ||
      typeof shot.lighting!=='string'||!Object.hasOwn(lights,shot.lighting) ||
      typeof shot.motion!=='string'||!Object.hasOwn(motions,shot.motion))return false;
    if(shot.description!==undefined && (!record(shot.description,['ar','en']) ||
      !['ar','en'].every(lang=>typeof shot.description[lang]==='string' && shot.description[lang].length<=240)))return false;
    end+=shot.seconds;
  }
  return end===s.duration && s.shots[1].start===s.blackout;
}
export function retime(s){
  const last=s.duration-s.blackout,middle=Math.max(1,Math.floor(last/2));
  const lengths=[s.blackout,middle,last-middle];let start=0;
  for(const [i,p] of s.shots.entries()){p.start=start;p.seconds=lengths[i];p.description=describe(s,i);start+=lengths[i];}
}
// The local renderer knows a small authored vocabulary. An unfamiliar detail, even in a
// familiar location, needs the director's explicit choice of a stand-in from that library.
function normalWords(sentence){
  return String(sentence).normalize('NFKC').toLowerCase().normalize('NFD')
    .replace(/\p{M}/gu,'').replace(/ـ/g,'').replace(/ى/g,'ي').match(/[\p{L}\p{N}]+/gu)||[];
}
const wordSet=s=>new Set(normalWords(s));
const settings={
  pier:wordSet('رصيف محطة مرفأ ميناء قطار pier dock station harbour harbor train'),
  cinema:wordSet('سينما شباك ستارة مسرح قاعة تذاكر cinema theatre theater box office ticket booth'),
  square:wordSet('ساحة ميدان برج ساعة square plaza tower clock'),
};
const descriptions=wordSet(
  'انتظار انتظر ينتظر تنتظر منتظر منتظرة يقف تقف واقف واقفة شخصية شخص رجل امرأة مصور زائر ظل خطوة خطوات مرور يمر تمر يمشي تمشي يسير تسير يعبر تعبر يغادر تغادر دخول خروج لقطة مشهد ثابت ثابتة هادئ هادئة ببطء علامة لوحة إشارة مصباح ضوء ضوءه يضيء تضيء انطفاء تنطفئ ينطفئ خافت خافتة عتمة غروب ليل ليلا ليلي ليلية ذهبي ذهبية كهرماني كهرمانية فانوس مضاءة زجاج عند بعد قبل من مع في على قرب بجانب أمام تحت ثم إلى و وسط بين حتى خلال حين بينما');
const english=wordSet('waiting waits wait standing stands person figure visitor silhouette walking walks walk crosses crossing steps moves leaves leaving arrives passing still quiet slow slowly scene shot tracking pan light lights lighting glow glows lit lamp sign board goes dims dark faded dusk evening night sunset golden amber lantern shadow a an the this on at by near beside outside in with and after before under as to of from through toward until while over along');
function forms(word){
  if(!/[\u0600-\u06ff]/u.test(word))return [word];
  // Check the whole Arabic word, then common attached conjunctions/prepositions and article.
  const bare=word.replace(/^[وف](?=.)/u,'');
  return [...new Set([word,bare,bare.replace(/^[بكل](?=ال)/u,''),bare.startsWith('لل')?'ال'+bare.slice(2):bare].flatMap(w=>[w,w.replace(/^ال(?=.)/u,'')]))];
}
export function matchCatalog(sentence){
  const tokens=normalWords(sentence),found=new Set(),unknown=[];
  for(const word of tokens){
    const variants=forms(word),place=Object.keys(settings).find(id=>variants.some(v=>settings[id].has(v)));
    if(place)found.add(place);
    else if(!variants.some(v=>descriptions.has(v)||english.has(v)))unknown.push(word);
  }
  const setting=found.size===1?[...found][0]:null;
  return {setting,unknown:[...new Set(unknown)],ready:Boolean(setting)&&unknown.length===0};
}
export function buildScene(input,setting){
  if(typeof input!=='string'||!input.trim()||input.length>160||typeof setting!=='string'||!Object.hasOwn(places,setting))return null;
  const p=input.trim();
  let seed=0;for(const ch of p)seed=(seed*31+ch.codePointAt(0))>>>0;
  const dim=/عتمة|خافت|dark|shadow|dim/iu.test(p),warm=/ذهبي|كهرماني|فانوس|golden|amber|lantern/iu.test(p);
  const walking=/يسير|يمشي|يمر|خطو|walk|cross/iu.test(p);
  const s={version:1,prompt:p,setting,duration:8+seed%8,blackout:3+(seed>>>3)%3,
    shots:cues.map((id,i)=>({id,lighting:[warm?'amber':dim?'dim':'dusk','dim',dim?'dusk':'amber'][i],motion:[walking?'walk':'pan','still','walk'][i]}))};retime(s);return s;
}
// Coordinates are on the 764 × 430 location plate. Each polygon follows the
// inside edge of the practical sign so the blackout survives a different cut.
const sets = {
  pier: {file: 'director-sentence', sign: [[573,214],[677,214],[677,255],[573,255]], floor: 351, height: 155, mark: 321},
  cinema: {file: 'director-cinema', sign: [[566,178],[709,179],[709,247],[566,247]], floor: 383, height: 220, mark: 353},
  square: {file: 'director-square', sign: [[625,213],[731,209],[731,258],[625,262]], floor: 378, height: 147, mark: 368}
};
const bitmaps = new Map();
const footage = new Map();
const waiting = new WeakMap();

function loadPlate(file) {
  if (!bitmaps.has(file)) {
    bitmaps.set(file, new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = new URL('../assets/photo/' + file + '.webp', import.meta.url).href;
    }));
  }
  return bitmaps.get(file);
}
function locationFootage(setting) {
  if (!footage.has(setting)) {
    const entry = {};
    entry.ready = Promise.all([loadPlate(sets[setting].file),loadPlate('director-figure')])
      .then(([plate, performer]) => {entry.images = {plate, performer};});
    footage.set(setting, entry);
  }
  return footage.get(setting);
}

export function retrySceneImages(setting) {
  const entry=footage.get(setting);
  if (!entry?.images) return;
  if (!entry.images.plate) bitmaps.delete(sets[setting].file);
  if (!entry.images.performer) bitmaps.delete('director-figure');
  footage.delete(setting);
}

function drawSign(ctx, corners, lit) {
  ctx.save();
  ctx.beginPath();
  corners.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.closePath();
  if (lit) {
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(255,201,123,0.76)';
    ctx.shadowColor = 'rgba(248,177,82,0.55)';
    ctx.shadowBlur = 12;
  } else {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#555659';
  }
  ctx.fill();
  ctx.restore();
}

function drawPerformer(ctx, model, sprite, index, progress, traverse) {
  // The four exposures share a footline. Travel is measured in strides so a
  // slower edit also slows the gait, instead of letting the feet skate.
  const height = model.height, distance = traverse ? height * 1.42 : height * .94;
  const reach = model.mark;
  const x = index === 0 ? reach - distance * (1-progress) : reach + (index === 2 ? distance * progress : 0);
  if (index === 1) return; // The insert cuts away from the performer to the sign.
  const phase = index === 0 ? distance*progress : distance*(1+progress);
  const exposure = Math.floor(phase/(height*.125)) % 4;
  ctx.save();
  ctx.translate(x,model.floor);
  const shadow=ctx.createRadialGradient(0,0,0,0,0,height*.28);
  shadow.addColorStop(0,'rgba(11,17,22,.52)');shadow.addColorStop(1,'rgba(11,17,22,0)');
  ctx.save();ctx.scale(1,.11);ctx.fillStyle=shadow;ctx.fillRect(-height*.28,-height*.28,height*.56,height*.56);ctx.restore();
  const width = height * 180 / 248;
  ctx.drawImage(sprite,exposure*180,0,180,248,-width/2,-height,width,height);
  ctx.restore();
}

function drawLocation(ctx, images, s, index, p, time) {
  const model = sets[s.setting], shot = s.shots[index];
  const [left, top] = model.sign[0], [right, bottom] = model.sign[2];
  const framing = index === 1 ? 1.74 : index === 2 ? 1.08 : 1.02;
  const zoom = framing + (shot.motion==='walk' && index===1 ? p*.16 : 0);
  const viewWidth = 764/zoom, viewHeight = 358/zoom;
  const target = index === 1 ? (left+right)/2 : model.mark+10;
  const room = 764-viewWidth, travel = shot.motion==='pan' ? Math.min(room,42) : 0;
  const center = Math.max(travel/2,Math.min(room-travel/2,target-viewWidth/2));
  const x = center + (p-.5)*travel;
  const y = Math.max(0,Math.min(430-viewHeight,(index===1?(top+bottom)/2:224)-viewHeight/2));
  ctx.save();
  ctx.scale(zoom,zoom);ctx.translate(-x,-y);
  ctx.drawImage(images.plate,0,0,764,430);
  drawSign(ctx,model.sign,time<s.blackout);
  drawPerformer(ctx,model,images.performer,index,p,shot.motion==='walk');
  ctx.fillStyle = {dusk:'rgba(44,76,112,.08)',dim:'rgba(9,17,27,.27)',amber:'rgba(210,133,59,.14)'}[shot.lighting];
  ctx.fillRect(0,0,764,430);
  ctx.restore();
}

function drawMotionPlan(ctx, s, time, failed) {
  ctx.fillStyle='#162129';ctx.fillRect(0,0,764,358);
  ctx.strokeStyle='#557078';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(35,246);ctx.lineTo(729,246);ctx.stroke();
  ctx.fillStyle=time<s.blackout?'#e9bc78':'#364953';ctx.fillRect(490,105,112,56);
  const x=112+480*time/s.duration;
  ctx.fillStyle='#dfd7ca';ctx.beginPath();ctx.arc(x,232,7,0,Math.PI*2);ctx.fill();
  if (failed) {
    const ar=document.documentElement.lang==='ar';ctx.direction=ar?'rtl':'ltr';
    ctx.textAlign=ar?'right':'left';ctx.font='20px sans-serif';ctx.fillStyle='#e2d9c9';
    ctx.fillText(ar?'تعذّر تحميل الصورة · مخطط الحركة':'Image unavailable · movement plan',ar?729:35,312);
  }
}

export function paintScene(canvas,s,time) {
  const ctx=canvas.getContext('2d');
  if (!ctx || !validScene(s)) return null;
  const index=Math.max(0,s.shots.findLastIndex(shot=>time>=shot.start));
  const shot=s.shots[index], progress=Math.max(0,Math.min(1,(time-shot.start)/shot.seconds));
  const entry=locationFootage(s.setting);
  const previousVisual=canvas.dataset.visual;
  if (entry.images) waiting.delete(canvas);
  ctx.save();
  ctx.scale(canvas.width/764,canvas.height/358);
  if (entry.images?.plate && entry.images.performer) {
    drawLocation(ctx,entry.images,s,index,progress,time);
    canvas.dataset.visual='photograph';
  } else {
    drawMotionPlan(ctx,s,time,!!entry.images);
    canvas.dataset.visual=entry.images?'movement-plan':'loading';
    if (!entry.images) {
      const previous=waiting.get(canvas);
      waiting.set(canvas,{s,time,entry});
      if (previous?.entry!==entry) entry.ready.then(()=>{
        const latest=waiting.get(canvas);
        if (latest?.entry===entry && canvas.isConnected) {
          waiting.delete(canvas);paintScene(canvas,latest.s,latest.time);
        }
      });
    }
  }
  ctx.restore();
  if (previousVisual!==canvas.dataset.visual) canvas.dispatchEvent(new Event('visualchange'));
  return shot;
}

export async function sceneThumbnails(s) {
  if (!validScene(s)) return [];
  const entry=locationFootage(s.setting);
  await entry.ready;
  if(!entry.images.plate||!entry.images.performer)return [];
  try{
    const frames=s.shots.map(shot=>{
      const canvas=document.createElement('canvas');
      canvas.width=384;canvas.height=180;
      if(!paintScene(canvas,s,shot.start+shot.seconds/2)||canvas.dataset.visual!=='photograph')return '';
      return canvas.toDataURL('image/webp',.74);
    });
    return frames.every(frame=>/^data:image\/(?:webp|png);base64,.+/.test(frame))?frames:[];
  }catch{return [];}
}
