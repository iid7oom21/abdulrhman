import assert from 'node:assert/strict';
import test from 'node:test';
import {LENGTH, move, onPlate, positionAt, firstOpening} from '../raven/late-night/games/station-model.js';
import {roll} from '../raven/late-night/games/reel-model.js';

test('the recorded shadow releases the door exactly one second later when arrival is delayed',()=>{
  const route=[{ms:0,x:0,y:1},{ms:100,x:0,y:0},{ms:200,x:1,y:0},{ms:300,x:2,y:0}];
  const delayed=route.map((step,index)=>index?{...step,ms:step.ms+1000}:step);
  assert.equal(LENGTH,10000);
  assert.equal(firstOpening(delayed)-firstOpening(route),1000);
  for(const trace of [route,delayed]){
    const trigger=firstOpening(trace),before={x:4,y:1};
    assert.deepEqual(move(before,1,0,onPlate(positionAt(trace,trigger-1))),before);
    assert.deepEqual(move(before,1,0,onPlate(positionAt(trace,trigger))),{x:5,y:1});
    assert.deepEqual(move({x:4,y:0},1,0,true),{x:4,y:0});
    assert.deepEqual(move({x:5,y:1},1,0,true),{x:6,y:1});
  }
});
test('the three bends determine the short and souvenir paths; a reversed turn stops the reel',()=>{
  const short=[{x:2,y:2,rot:3},{x:2,y:1,rot:1},{x:5,y:1,rot:2}];
  const long=[{x:1,y:2,rot:2},{x:1,y:4,rot:0},{x:5,y:4,rot:3}];
  const a=roll(short),b=roll(long);
  assert.equal(a.reason,'box');assert.equal(a.souvenir,false);
  assert.equal(b.reason,'box');assert.equal(b.souvenir,true);
  assert.ok(b.route.length>a.route.length);
  assert.equal(roll([{...short[0],rot:0},...short.slice(1)]).reason,'curve');
});
