import {mount} from '../night-shell.js';

const activities={
  'memory-lift':()=>import('./memory-lift.js').then(module=>module.default),
  'seven-windows':()=>import('./seven-windows.js').then(module=>module.default),
  'curtain-party':()=>import('./curtain-party.js').then(module=>module.default),
  'sound-museum':()=>import('./sound-museum.js').then(module=>module.default),
  weekend:()=>import('./weekend.js').then(module=>module.weekend),
  'screening-room':()=>import('./screening.js').then(module=>module.screening),
};
const id=document.querySelector('#night-app').dataset.activity;
if(Object.hasOwn(activities,id))mount(await activities[id]());
