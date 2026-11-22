import {SHOTS, duration} from './edit-rules.js';

export const furniture = ['cup', 'folder', 'light'];
export const continuityRounds = [
  {a:{cup:0, folder:0, light:0}, b:{cup:1, folder:0, light:0}},
  {a:{cup:1, folder:0, light:1}, b:{cup:1, folder:1, light:1}},
  {a:{cup:0, folder:1, light:0}, b:{cup:0, folder:1, light:1}},
];

export function changedProp(round) {
  return furniture.find(id => round.a[id] !== round.b[id]);
}

// The costs and capabilities are visible to the visitor before selection.
export const setup = {
  boom:{cost:4, provides:['speech']},
  lav:{cost:3, provides:['speech']},
  room:{cost:6, provides:['place']},
  wide:{cost:4, provides:['place']},
  detail:{cost:2, provides:['detail']},
  bounce:{cost:3, provides:['light']},
};
export const budgetRounds = [['speech','place'], ['place','detail','light']];

export function budgetResult(picks, goals) {
  const ids = [...new Set(picks)].filter(id => Object.hasOwn(setup,id));
  const spent = ids.reduce((sum,id) => sum + setup[id].cost, 0);
  const provided = ids.flatMap(id => setup[id].provides);
  const missing = goals.filter(goal => !provided.includes(goal));
  return {spent, missing, valid:missing.length === 0 && spent <= 10};
}

export const sounds = ['paper','chair','key'];

export function allowedShots(value) {
  return Array.isArray(value) && value.every(id => typeof id === 'string' && Object.hasOwn(SHOTS,id));
}

export function clampNumber(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min,value)) : fallback;
}

const defaults = {stage:0, shots:[], angle:0, exposure:0, cue:'paper', at:2,
  muted:true, head:0, finished:false};

export function restoreFestival(data) {
  data = data && typeof data === 'object' ? data : {};
  const shots = allowedShots(data.shots) ? [...new Set(data.shots)].slice(0,3) : [];
  const stage = shots.length === 3 ? Math.trunc(clampNumber(data.stage,0,0,3)) : 0;
  return {...defaults, stage, shots,
    angle:clampNumber(data.angle,0,-100,100), exposure:clampNumber(data.exposure,0,-60,60),
    cue:sounds.includes(data.cue) ? data.cue : 'paper', at:clampNumber(data.at,2,0,shots.length ? duration(shots)-.1 : 2),
    muted:data.muted !== false, head:clampNumber(data.head,0,0,duration(shots)),
    finished:data.finished === true && stage === 3};
}

export function activeShot(ids, elapsed) {
  let end = 0;
  for (const id of ids) {
    end += SHOTS[id].seconds;
    if (elapsed < end) return id;
  }
  return ids.at(-1);
}

export function shareSource(value) {
  if (!value || !['edit','festival'].includes(value.source) || !allowedShots(value.shots) ||
      value.shots.length < 1 || value.shots.length > 4) return null;
  return {source:value.source, shots:[...value.shots], seconds:duration(value.shots),
    angle:clampNumber(value.angle,0,-100,100), exposure:clampNumber(value.exposure,0,-60,60)};
}
