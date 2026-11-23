import type {StoryboardScene} from '../types';

const prefix='raven.studio.named-board.v1.';
const idOK=(x:unknown):x is string=>typeof x==='string' && /^[a-zA-Z0-9-]{1,90}$/.test(x);
const text=(x:unknown,size:number)=>typeof x==='string' && x.length<=size;
const shot=(x:unknown)=>typeof x==='string'&&['exterior','hand','envelope','lamp'].includes(x);
const camera=['drone-aerial','dolly-zoom','fpv-orbit','pan-right','pan-left','tilt-up','tilt-down','static-tripod'];
type Source={kind:'director',piece:string}|{kind:'cut',route:string,shots:string[]};
export type NamedBoard={version:1,id:string,name:string,scenes:StoryboardScene[],source:Source};
type StoredBoard={board:NamedBoard,raw:string};
type Dict=Record<string,unknown>;
const object=(x:unknown):x is Dict=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x);
function thumbnail(x:unknown):boolean {
  return typeof x==='string'&&(
    /^\.\.\/raven\/after-show\/assets\/(exterior|hand|envelope|lamp)\.webp$/.test(x) ||
    /^(?:\.\/|\/)?visual-lab\/assets\/(01-manor|02-archive|03-desk|04-corridor)\.webp$/.test(x) ||
    (x.length<512000 && /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(x))
  );
}
function valid(x:unknown,id:string):x is NamedBoard {
  if(!object(x)||x.version!==1||x.id!==id||!text(x.name,70)||!(x.name as string).trim()||!object(x.source)||!Array.isArray(x.scenes)||x.scenes.length>80)return false;
  const s=x.source,sourceOK=(s.kind==='director'&&idOK(s.piece))||(s.kind==='cut'&&['edit','free','duo','daily','custom','brief'].includes(String(s.route))&&Array.isArray(s.shots)&&s.shots.length>0&&s.shots.length<=4&&s.shots.every(shot));
  return sourceOK&&x.scenes.every((v,i)=>object(v)&&idOK(v.id)&&v.sceneNumber===i+1&&text(v.title,500)&&text(v.prompt,8000)&&Number.isInteger(v.duration)&&Number(v.duration)>0&&Number(v.duration)<=120&&camera.includes(String(v.camera))&&['cut','fade','dissolve','whip-pan'].includes(String(v.transition))&&thumbnail(v.thumbnail));
}
export function loadBoard(id:string|null):StoredBoard|null {
  if(!idOK(id))return null;
  try{const raw=localStorage.getItem(prefix+id);if(!raw)return null;const parsed:unknown=JSON.parse(raw);return valid(parsed,id)?{board:parsed,raw}:null;}catch{return null;}
}
export function boardList():{id:string,name:string}[] {
  try{return Object.keys(localStorage).filter(k=>k.startsWith(prefix)).flatMap(k=>{const found=loadBoard(k.slice(prefix.length));return found?[{id:found.board.id,name:found.board.name}]:[];});}catch{return [];}
}
export function saveBoard(previous:StoredBoard,scenes:StoryboardScene[]):StoredBoard|null {
  const board={...previous.board,scenes};
  try{if(!valid(board,board.id)||localStorage.getItem(prefix+board.id)!==previous.raw)return null;
    const raw=JSON.stringify(board);localStorage.setItem(prefix+board.id,raw);
    return localStorage.getItem(prefix+board.id)===raw?{board,raw}:null;
  }catch{return null;}
}
export function boardReturn(source:Source,lang:string):string {
  return source.kind==='director'?'../raven/late-night/director-sentence.html?'+new URLSearchParams({piece:source.piece,lang}):
    '../raven/after-show/?'+new URLSearchParams({activity:source.route,lang});
}
