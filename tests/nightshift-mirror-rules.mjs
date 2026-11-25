import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGES, PERIOD, mirrorSegment, shutterSegment, traceStage} from '../raven/late-night/nightshift/mirror-rules.js';

const answers = [
  {angles:[0,0,0], times:[1,2,3]},
  {angles:[1,0,0], times:[0,2]},
  {angles:[1,1,1], times:[1,3]}
];

test('every panel assignment and release time: each of the three maps admits exactly its expected solutions',()=>{
  STAGES.forEach((stage,i)=>{
    const answer = answers[i];
    assert.equal(stage.sources.length,2);
    assert.equal(stage.windows.length,2);
    assert.equal(stage.mirrors.length,3);
    assert.ok(!traceStage(stage,stage.initial,0).success);
    for (const a of [0,1]) for (const b of [0,1]) for (const c of [0,1]) {
      const angles = [a,b,c];
      for (let time=0; time<PERIOD; time++) {
        const result = traceStage(stage,angles,time);
        assert.equal(result.success,angles.every((v,j)=>v===answer.angles[j])&&answer.times.includes(time),
          stage.id+' at '+angles+' and time '+time);
        assert.equal(result.success,result.beams.every(beam=>beam.reached));
        if (result.success) {
          assert.deepEqual(result.beams.map(beam=>beam.hits.map(hit=>hit.id)),[['A','B','pier'],['C','hall']]);
        }
      }
    }
  });
});

test('the harbour arcade includes exact reflected points and its first obstruction at the chosen release time',()=>{
  const stage = STAGES[0];
  const open = traceStage(stage,[0,0,0],1);
  assert.deepEqual(open.beams[0].points,[[5,60],[26,60],[26,22],[96,22]]);
  assert.deepEqual(open.beams[1].points,[[70,74],[70,45],[96,45]]);
  const closed = traceStage(stage,[0,0,0],0);
  assert.deepEqual(closed.beams[0].hits.at(-1),{kind:'shutter',id:'shutter',at:[54,22]});
  assert.equal(closed.beams[0].reached,false);
  assert.equal(closed.beams[1].reached,true);
  assert.deepEqual(traceStage(stage,[0,0,0],1+PERIOD*8), open);
  assert.deepEqual(shutterSegment(stage,1),{a:[54,26],b:[54,36]});
  assert.deepEqual(shutterSegment(stage,3),shutterSegment(stage,1));
  assert.deepEqual(mirrorSegment(stage.mirrors[0],0),{a:[22,64],b:[30,56]});
  // Touching the carriage's end intercepts the light; a fractional second later clears it.
  assert.equal(traceStage(stage,[0,0,0],5/9).beams[0].hits.at(-1).kind,'shutter');
  assert.equal(traceStage(stage,[0,0,0],5/9+.001).beams[0].hits.at(-1).kind,'window');
});

test('on the crossing, one moving carriage can intercept either beam; rays can cross without intercepting each other',()=>{
  const stage=STAGES[2], angles=[1,1,1];
  assert.deepEqual(traceStage(stage,angles,0).beams.map(b=>b.hits.at(-1).id),['pier','shutter']);
  assert.deepEqual(traceStage(stage,angles,2).beams.map(b=>b.hits.at(-1).id),['shutter','hall']);
  const open=traceStage(stage,angles,1);
  assert.deepEqual(open.beams[0].points,[[12,5],[12,24],[80,24],[80,76]]);
  assert.deepEqual(open.beams[1].points,[[95,53],[45,53],[45,4]]);
});

test('rays strike the finite mirror away from its pivot, miss beyond its ends, and stop at the closest surface',()=>{
  const stage=STAGES[0];
  const sourceAt = y => ({...stage,sources:[{...stage.sources[0],at:[5,y]}]});
  assert.deepEqual(traceStage(sourceAt(62),[0,0,0],1).beams[0].points,[[5,62],[24,62],[24,24],[96,24]]);
  assert.deepEqual(traceStage(sourceAt(66),[0,0,0],1).beams[0].hits,[{kind:'edge',id:'east',at:[100,66]}]);
  const occluded={...stage,shutter:{start:[16,58],end:[16,60],half:[0,5]}};
  assert.deepEqual(traceStage(occluded,[0,0,0],0).beams[0].hits,[{kind:'shutter',id:'shutter',at:[16,60]}]);
  const grazing={...stage,shutter:{start:[16,60],end:[16,60],half:[2,0]}};
  assert.deepEqual(traceStage(grazing,[0,0,0],0).beams[0].hits,[{kind:'shutter',id:'shutter',at:[14,60]}]);
});

test('a beam arriving at a different window is reported as a miss, even with the other beam on target',()=>{
  const stage = STAGES[0];
  const wrong = {...stage,sources:[{...stage.sources[0],target:'hall'},stage.sources[1]]};
  const result = traceStage(wrong,[0,0,0],1);
  assert.deepEqual(result.beams.map(b=>b.reached),[false,true]);
  assert.deepEqual(result.beams[0].hits.at(-1),{kind:'window',id:'pier',at:[96,22]});
  assert.equal(result.success,false);
});

test('tracing terminates in a closed optical loop and rejects malformed release controls',()=>{
  const loop={...STAGES[0],
    mirrors:[[20,20],[80,20],[80,60],[20,60]].map((at,index)=>({id:String(index),at})),
    sources:[{id:'pier',target:'pier',at:[45,20],dir:[1,0]}],
    shutter:{start:[1,3],end:[1,5],half:[0,1]}};
  const result=traceStage(loop,[0,1,0,1],0);
  assert.equal(result.success,false);
  assert.deepEqual(result.beams[0].hits.map(hit=>hit.kind),['mirror','mirror','mirror','mirror','loop']);
  assert.throws(()=>traceStage(STAGES[0],[0,1],0),RangeError);
  assert.throws(()=>traceStage(STAGES[0],[0,2,1],0),RangeError);
  assert.throws(()=>traceStage(STAGES[0],[0,0,0],NaN),RangeError);
});
