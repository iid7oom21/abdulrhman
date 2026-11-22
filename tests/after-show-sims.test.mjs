import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleShift,cueResult,inspectShipment,shipments,pixelMetrics,validatedLight} from '../raven/after-show/sim-rules.js';

test('one screen takes seven minutes even with a second technician',()=>{
  const s=scheduleShift({subs:{start:0,tech:0},mix:{start:0,tech:1}},false);
  assert.deepEqual(s.scheduled.map(t=>[t.id,t.start,t.end]),[['subs',0,4],['mix',4,7]]);
  assert.deepEqual(s.scheduled[1].conflicts,['screen']);assert.equal(s.delay,1);
  const parallel=scheduleShift({subs:{start:0,tech:0},mix:{start:0,tech:0},prep:{start:0,tech:1}},true);
  assert.equal(parallel.end,9);assert.equal(parallel.scheduled[2].start,0);
  const rehearsal=parallel.scheduled.find(job=>job.id==='rehearsal');
  assert.deepEqual([rehearsal.start,rehearsal.end,rehearsal.screen,rehearsal.conflicts],[7,9,true,['checks']]);
  const late=scheduleShift({prep:{start:14,tech:1},rehearsal:{start:0,tech:1}},true);
  assert.equal(late.end,22);
  const waiting=scheduleShift({subs:{start:0,tech:0},mix:{start:0,tech:0},prep:{start:0,tech:0}},true);
  assert.equal(waiting.end,15);assert.equal(waiting.delay,9);
});
test('sound accepts the inclusive quarter-second boundary and reports a signed offset',()=>{
  for(const a of [1.75,2,2.25])assert.equal(cueResult(a,2).matched,true);
  for(const a of [1.749,2.251])assert.equal(cueResult(a,2).matched,false);
  assert.deepEqual(cueResult(2.4,2),{matched:false,delta:.4});
});
test('shipment decisions follow visible format, version and language',()=>{
  assert.deepEqual(shipments.map(s=>inspectShipment(s.request,s.item).decision),['missing','replace','approve','replace']);
  assert.deepEqual(inspectShipment(['PDF',2,'AR'],['PDF',null,'AR']),{decision:'missing',fields:[1]});
  assert.deepEqual(inspectShipment(['PDF',2,'AR'],['PNG',null,'AR']),{decision:'replace',fields:[0]});
});
test('pixel statistics measure the sampled pixels and do not cross image rows',()=>{
  const measured=pixelMetrics({width:2,data:new Uint8ClampedArray([0,0,0,255,255,255,255,255,255,255,255,255,0,0,0,255])});
  assert.equal(measured.low,50);assert.equal(measured.high,50);assert.ok(Math.abs(measured.texture-255)<1e-9);
  assert.deepEqual(validatedLight({angle:1/0,spread:103,exposure:-200}),{angle:-28,spread:100,exposure:-60});
});
