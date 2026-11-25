import {validPiece as validSeatEnding} from './nightshift/seat-rules.js';
import {checkedSelection} from './ink/print-panels.js';
// A portable work carries editable settings. Each activity chooses its own bundled artwork.
import {validateCourierManga, MANGA_FORMAT} from './ink/courier-rules.js';
import {validScene,describe} from './creative/scene.js';
import {cameraRun} from './sims/camera-rules.js';

export const MAX_FILE_BYTES=64*1024;
const format='raven-late-night-work';
const ownKeys=(value,keys)=>value && !Array.isArray(value) && typeof value==='object' &&
  Object.keys(value).every(key=>keys.includes(key));
const inRange=(n,lo,hi)=>Number.isFinite(n)&&n>=lo&&n<=hi;

function manga(data){
  if(!ownKeys(data,['format','order','path','weather']) || !ownKeys(data.weather,['rain','wind']) || !validateCourierManga(data))return null;
  return {format:MANGA_FORMAT,path:[...data.path],order:[...data.order],weather:{rain:data.weather.rain,wind:data.weather.wind}};
}
function page(s){
  if(!ownKeys(s,['panels','direction','caption']) || !checkedSelection(s))return null;
  return {panels:[...s.panels],direction:s.direction,caption:s.caption};
}
function frame(s){
  if(!ownKeys(s,['version','mode','travel','spacing','seek']) || s.version!==1 || !['free','challenge'].includes(s.mode) ||
    !Number.isInteger(s.travel) || !inRange(s.travel,-80,80) || !Number.isInteger(s.spacing) ||
    !inRange(s.spacing,0,100) || !inRange(s.seek,0,100))return null;
  return {version:1,mode:s.mode,travel:s.travel,spacing:s.spacing,seek:s.seek};
}
function replay(s){
  if(!ownKeys(s,['version','duration','pushes']) || s.version!==1 || !inRange(s.duration,0,12) ||
    !Number.isInteger(s.duration*4) || !Array.isArray(s.pushes) || s.pushes.length>256 ||
    !s.pushes.every(p=>ownKeys(p,['t','dv']) && inRange(p.t,0,s.duration) && Number.isInteger(p.t*4) && [-4,-1,1,4].includes(p.dv)))return null;
  return {version:1,duration:s.duration,pushes:s.pushes.map(({t,dv})=>({t,dv}))};
}
function scene(s){
  if(!ownKeys(s,['version','prompt','setting','blackout','duration','shots']) || !validScene(s) ||
    !s.shots.every(p=>ownKeys(p,['id','start','seconds','lighting','motion','description']) &&
      (p.description===undefined || ownKeys(p.description,['ar','en']))))return null;
  return {version:1,prompt:s.prompt,setting:s.setting,duration:s.duration,blackout:s.blackout,
    shots:s.shots.map(({id,start,seconds,lighting,motion},i)=>({id,start,seconds,lighting,motion,description:describe(s,i)}))};
}
function seatEnding(s){
  if(!ownKeys(s,['version','ending','events']) || !validSeatEnding(s) ||
    !s.events.every(e=>ownKeys(e,['kind','id'])))return null;
  return {version:1,ending:s.ending,events:s.events.map(({kind,id})=>({kind,id}))};
}
const types=new Map([
  ['nightshift-seat',{kind:'scene',type:'seat-ending',check:seatEnding}],
  ['ink-courier',{kind:'manga',type:MANGA_FORMAT,check:manga}],
  ['ink-page',{kind:'manga',type:'ink-page',check:page}],
  ['ink-camera',{kind:'frame',type:'ink-camera',check:frame}],
  ['director-sentence',{kind:'scene',type:'night-scene',check:scene}],
  ['weightless-cam',{kind:'replay',type:'camera-run',check:replay}],
]);
export const workKind=p=>types.get(p.activity)?.type===p.type?types.get(p.activity).kind:null;
export function portableWork(p) {
  const spec=types.get(p.activity);
  if(!spec || spec.type!==p.type || typeof p.title!=='string' || !p.title.trim() || p.title.length>160)return null;
  const source=p.data;
  const data=spec.check(spec.kind==='replay' && source ?
    {version:source.version,duration:source.duration,pushes:source.pushes} : source);
  return data && {format,version:1,kind:spec.kind,activity:p.activity,title:p.title,type:p.type,data};
}
export function readWork(text){
  if(typeof text!=='string' || new Blob([text]).size>MAX_FILE_BYTES)throw new Error('size');
  let p;
  try {p=JSON.parse(text);} catch {throw new Error('json');}
  if(!ownKeys(p,['format','version','kind','activity','title','type','data']) || p.format!==format || p.version!==1)throw new Error('format');
  const spec=types.get(p.activity);
  if(!spec || spec.kind!==p.kind || spec.type!==p.type || typeof p.title!=='string' || !p.title.trim() || p.title.length>160)throw new Error('format');
  const data=spec.check(p.data);
  if(!data)throw new Error('settings');
  return {activity:p.activity,title:p.title.trim(),type:p.type,data:spec.kind==='replay'?cameraRun(data.pushes,data.duration):data};
}
