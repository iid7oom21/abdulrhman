import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,budgetRounds,budgetResult,continuityRounds,changedProp,restoreFestival,activeShot,shareSource} from '../raven/after-show/event-rules.js';

test('ten units, alternative orders, overspend and missing requirements',()=>{
  assert.deepEqual(budgetResult(['boom','room'],budgetRounds[0]),{spent:10,missing:[],valid:true});
  assert.equal(budgetResult(['lav','wide'],budgetRounds[0]).valid,true);
  assert.deepEqual(budgetResult(['boom','room','detail'],budgetRounds[0]),{spent:12,missing:[],valid:false});
  assert.deepEqual(budgetResult(['wide','wide','unknown'],budgetRounds[0]),{spent:4,missing:['speech'],valid:false});
  assert.equal(budgetResult(['wide','detail','bounce'],budgetRounds[1]).valid,true);
  assert.equal(budgetResult(['room','detail','bounce'],budgetRounds[1]).valid,false);
  assert.ok(Object.values(setup).every(item=>item.cost>0));
});
test('in each continuity setup exactly the specified prop differs',()=>{
  assert.deepEqual(continuityRounds.map(changedProp),['cup','folder','light']);
  for(const round of continuityRounds) assert.equal(Object.keys(round.a).filter(k=>round.a[k]!==round.b[k]).length,1);
});
test('festival phases require a real reel, media and cue bounds; keep the chosen cue settings when resuming',()=>{
  const bad=restoreFestival({stage:3,shots:['unknown'],at:Infinity,finished:true});
  assert.equal(bad.stage,0);assert.equal(bad.finished,false);
  const reel=['envelope','exterior','hand'];
  const saved=restoreFestival({shots:reel,stage:3,at:200,angle:-110,head:15,exposure:14,cue:'key',muted:false,finished:true});
  assert.equal(saved.stage,3);assert.equal(saved.at,11.9);assert.equal(saved.head,12);
  assert.equal(saved.angle,-100);assert.equal(saved.exposure,14);assert.equal(saved.muted,false);assert.equal(saved.finished,true);
  assert.equal(activeShot(reel,2.99),'envelope');assert.equal(activeShot(reel,3),'exterior');assert.equal(activeShot(reel,12),'hand');
  assert.equal(restoreFestival({stage:3,shots:['hand','hand','lamp']}).stage,0);
});
test('sharing reads only whitelisted shot ids and recomputes the displayed duration',()=>{
  assert.equal(shareSource({source:'edit',shots:['__proto__']}),null);
  assert.equal(shareSource({source:'private',shots:['hand']}),null);
  assert.deepEqual(shareSource({source:'edit',shots:['hand','lamp'],seconds:999,notes:'private sentinel'}),
    {source:'edit',shots:['hand','lamp'],seconds:10,angle:0,exposure:0});
});
