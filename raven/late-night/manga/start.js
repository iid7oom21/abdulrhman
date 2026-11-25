import {mount} from '../night-shell.js';

// Two Ink Nights workshops drawn on canvas: animation timing and manga lettering.
const activities={
  'ink-lines':()=>import('./speed.js'),
  'ink-letters':()=>import('./bubbles.js'),
};
const id=document.querySelector('#night-app').dataset.activity;
if(Object.hasOwn(activities,id))mount((await activities[id]()).default);
