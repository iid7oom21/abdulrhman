import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { ACTIVITIES, CHAPTERS, EXPANSION_EVIDENCE, FILE_MANIFEST, REVISION } from '../modules/expansion-data.js';
import { emptyProgress, normalizeProgress, availableEvidenceIds, evaluateActivity, solvedQuestionIds, createInvestigation, calculateFileHashes } from '../modules/investigation.js';
import { SOLUTION_PAYLOADS, acceptedPrefix, solutionPayload } from './expansion-fixtures.mjs';

function harness(initial={}) {
  let state={progress:emptyProgress(),viewedIds:[],drafts:{},...structuredClone(initial)};
  const listeners=new Set();
  const caseStore={get:()=>structuredClone(state),update(fn){const draft=structuredClone(state);fn(draft);draft.progress=normalizeProgress(draft.progress);state=draft;for(const callback of listeners)callback(structuredClone(state));},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
  const services={caseStore};
  const engine=createInvestigation(services);
  return{engine,caseStore,services};
}

test('all 32 activities have actual inputs and sources accessible before they are needed',()=>{
  assert.equal(ACTIVITIES.length,32); assert.equal(CHAPTERS.length,7); assert.equal(EXPANSION_EVIDENCE.length,8);
  let progress=emptyProgress();
  for(const activity of ACTIVITIES){
    const available=availableEvidenceIds(progress);
    assert.ok(activity.fields.length>0,activity.id);
    assert.ok(activity.requiredEvidenceIds.every(id=>available.includes(id)),`source deadlock ${activity.id}`);
    assert.deepEqual(evaluateActivity(activity.id,solutionPayload(activity.id),{viewedIds:available}),{valid:true,correct:true,message:'ثُبتت النتيجة بمصادرها. يمكنك متابعة التحقيق.'});
    progress=normalizeProgress({...progress,accepted:[...progress.accepted,{activityId:activity.id,payload:solutionPayload(activity.id)}]});
  }
  assert.equal(progress.completedActivityIds.length,32);
  assert.deepEqual(solvedQuestionIds(progress),['Q01','Q02','Q03','Q04']);
});

test('full engine journey rejects every forward skip and unlocks report only after A32',async()=>{
  const{engine}=harness();
  try{
    for(let i=0;i<32;i++){
      const activity=ACTIVITIES[i];
      assert.equal(engine.canReport(),false);
      if(i<31){const skip=await engine.submit(ACTIVITIES[i+1].id,solutionPayload(ACTIVITIES[i+1].id));assert.equal(skip.valid,false);}
      for(const id of activity.requiredEvidenceIds)await engine.markViewed(id);
      const result=await engine.submit(activity.id,solutionPayload(activity.id),`answer-${i}`,engine.getSnapshot().seq);
      assert.equal(result.accepted,true,activity.id);
      assert.equal(engine.getSnapshot().completedActivityIds.length,i+1);
    }
    assert.equal(engine.canReport(),true);
    assert.equal(engine.getSnapshot().currentActivity,null);
  }finally{engine.destroy();}
});

test('closed evidence and unviewed required sources cannot be submitted or marked viewed',async()=>{
  const{engine}=harness();
  try{
    assert.equal(await engine.markViewed('E07'),false);
    assert.equal((await engine.submit('A01',solutionPayload('A01'))).valid,false);
    assert.equal(engine.getSnapshot().wrongSubmissions,0);
    await engine.markViewed('E09');
    assert.equal((await engine.submit('A01',solutionPayload('A01'))).accepted,true);
  }finally{engine.destroy();}
});

test('counter accounting is idempotent and blank input is not a wrong submission',async()=>{
  const{engine}=harness();
  try{
    await engine.markViewed('E09');
    assert.equal((await engine.submit('A01',{})).valid,false);
    assert.equal(engine.getSnapshot().wrongSubmissions,0);
    const wrong={...solutionPayload('A01'),code:'NOPE'};
    const first=await engine.submit('A01',wrong,'same-request',0);
    const retry=await engine.submit('A01',wrong,'same-request',0);
    assert.deepEqual(retry,first);
    assert.equal(engine.getSnapshot().wrongSubmissions,1);
    assert.equal(engine.getSnapshot().seq,1);
    assert.equal((await engine.submit('A01',solutionPayload('A01'),'different',0)).valid,false);
    assert.equal(engine.getSnapshot().wrongSubmissions,1);
  }finally{engine.destroy();}
});

test('hints advance independently per activity and repeated viewing is free',async()=>{
  const{engine}=harness();
  try{
    assert.equal((await engine.revealHint('A01',2)).ok,false);
    assert.equal((await engine.revealHint('A02',1)).ok,false);
    await engine.revealHint('A01',1,'hint-one');
    const seq=engine.getSnapshot().seq;
    await engine.revealHint('A01',1,'reopen');
    assert.equal(engine.getSnapshot().seq,seq);
    assert.equal(engine.getSnapshot().hintCount,1);
    await engine.markViewed('E09'); await engine.submit('A01',solutionPayload('A01'));
    const second=await engine.revealHint('A02',1);
    assert.equal(second.hint,ACTIVITIES[1].hints[0]);
    assert.deepEqual(engine.getSnapshot().hintsByActivity,{A01:[1],A02:[1]});
  }finally{engine.destroy();}
});

test('forged completion lists and discontinuous or wrong accepted records never unlock the ending',()=>{
  assert.equal(normalizeProgress({completedActivityIds:ACTIVITIES.map(a=>a.id),solvedIds:['Q01','Q02','Q03','Q04']}).accepted.length,0);
  assert.equal(normalizeProgress({accepted:[{activityId:'A32',payload:solutionPayload('A32')}]}).accepted.length,0);
  const corrupt=acceptedPrefix(32);corrupt[12].payload.lucian='receipt';
  assert.equal(normalizeProgress({accepted:corrupt}).accepted.length,12);
  for(const bad of [null,[],true,{accepted:{}},{revision:'wrong',accepted:acceptedPrefix(32)}])assert.equal(normalizeProgress(bad).accepted.length,0);
});

test('each chapter boundary round-trips valid progress without upgrading old four-answer saves',()=>{
  for(const chapter of CHAPTERS){
    const p=normalizeProgress({revision:REVISION,accepted:acceptedPrefix(chapter.last),elapsedMs:1250,hintsByActivity:{A01:[1]}});
    assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(p))),p);
  }
  assert.equal(normalizeProgress({solvedIds:['Q01','Q02','Q03','Q04'],answers:{Q01:'b'}}).completedActivityIds.length,0);
});

test('Q02 has E08 available; Q03 and Q04 preserve exact canonical support rules',()=>{
  assert.ok(availableEvidenceIds(normalizeProgress({accepted:acceptedPrefix(12)})).includes('E08'));
  const all=Array.from({length:16},(_,i)=>`E${String(i+1).padStart(2,'0')}`);
  assert.equal(evaluateActivity('A26',{...solutionPayload('A26'),support:['E03','E08']},{viewedIds:all}).correct,false);
  assert.equal(evaluateActivity('A32',{...solutionPayload('A32'),support:['E01','E07','E08']},{viewedIds:all}).correct,true);
  assert.equal(evaluateActivity('A32',{...solutionPayload('A32'),support:['E07','E08','E15']},{viewedIds:all}).correct,false);
});

test('hash manifest matches actual shipped bytes; changed content fails verification',async()=>{
  const hashes={};
  for(const file of FILE_MANIFEST){const data=await readFile(new URL(file.url));assert.equal(data.byteLength,file.bytes);hashes[file.id]=createHash('sha256').update(data).digest('hex');assert.equal(hashes[file.id],file.sha256);}
  assert.equal(evaluateActivity('A23',{file:'back-v1',computedHashes:hashes},{viewedIds:['E10','E11']}).correct,true);
  hashes['back-v1']=createHash('sha256').update('modified file').digest('hex');
  assert.equal(evaluateActivity('A23',{file:'back-v1',computedHashes:hashes},{viewedIds:['E10','E11']}).correct,false);
  const actual=await calculateFileHashes(async url=>{const data=await readFile(new URL(url));return{ok:true,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};});
  assert.equal(actual['back-v1'],FILE_MANIFEST[1].sha256);
});

test('042 fixture has exactly one solution with leading zero',()=>{
  const clues=ACTIVITIES.find(a=>a.id==='A11').puzzle.clues;
  const matches=[];
  for(let i=0;i<1000;i++){const candidate=String(i).padStart(3,'0');if(new Set(candidate).size!==3)continue;
    if(clues.every(([guess,present,placed])=>[...guess].filter(c=>candidate.includes(c)).length===present&&[...guess].filter((c,j)=>candidate[j]===c).length===placed))matches.push(candidate);
  }
  assert.deepEqual(matches,['042']);
});

test('2026 people/document constraint grid has exactly the approved solution',()=>{
  const perms=values=>values.length?values.flatMap((v,i)=>perms(values.filter((_,j)=>i!==j)).map(rest=>[v,...rest])):[[]];
  const found=[];
  for(const people of perms(['elena','elias','nora','lucian']))for(const jobs of perms(['inventory','maintenance','referral','receipt'])){
    const p=name=>people.indexOf(name),j=name=>jobs.indexOf(name);
    if(p('elias')<p('nora')&&[2,3].includes(p('lucian'))&&j('receipt')===p('nora')+1&&j('maintenance')===j('inventory')+1&&!['maintenance','referral'].includes(jobs[p('elena')])&&!['inventory','receipt'].includes(jobs[p('nora')])&&j('maintenance')<j('receipt')&&p('nora')===j('maintenance')+1)found.push({people,jobs});
  }
  assert.deepEqual(found,[{people:['elena','elias','nora','lucian'],jobs:['inventory','maintenance','referral','receipt']}]);
});

test('Arabic digits normalize but malformed numbers and duplicate choices are invalid',()=>{
  assert.equal(evaluateActivity('A11',{code:'٠٤٢'},{viewedIds:['E09']}).correct,true);
  assert.equal(evaluateActivity('A18',{clockOffset:'seven',alignment:36,position:'01:13'},{viewedIds:['E12','E13']}).valid,false);
  assert.equal(evaluateActivity('A13',{...solutionPayload('A13'),attachments:['E02','E02','E04']},{viewedIds:['E02','E03','E04','E05','E08']}).valid,false);
});

test('ranked failure never counts or advances locally',async()=>{
  const{engine,services}=harness({progress:{...emptyProgress(),mode:'ranked',runId:'run-test'},viewedIds:['E09']});
  services.cloud={submitStage:async()=>{throw new Error('offline');}};
  try{await assert.rejects(()=>engine.submit('A01',solutionPayload('A01')),/offline/);assert.equal(engine.getSnapshot().seq,0);assert.equal(engine.canReport(),false);}finally{engine.destroy();}
});

test('late idempotent ranked response returns its outcome without rolling back newer state',async()=>{
  const ranked={...emptyProgress(),mode:'ranked',runId:'run-test',startedAt:1000};
  const{engine,services,caseStore}=harness({progress:ranked,viewedIds:['E09']});
  let resolve;
  services.cloud={submitStage:()=>new Promise(done=>{resolve=done;})};
  try{
    const pending=engine.submit('A01',solutionPayload('A01'),'late-answer',0);
    const newer=normalizeProgress({...ranked,accepted:acceptedPrefix(10),seq:15});
    const viewed=availableEvidenceIds(newer);
    caseStore.update(s=>{s.progress=newer;s.viewedIds=viewed;s.notes=[{evidenceId:'E03',text:'ملاحظة أحدث'}];});
    const result={ok:true,valid:true,correct:true,accepted:true,activityId:'A01',seq:1};
    resolve({progress:{...ranked,accepted:acceptedPrefix(1),seq:1},viewedIds:['E09'],result});
    assert.deepEqual(await pending,result);
    assert.equal(engine.getSnapshot().seq,15);
    assert.equal(engine.getSnapshot().completedActivityIds.length,10);
    assert.deepEqual(caseStore.get().viewedIds,viewed);
    assert.equal(caseStore.get().notes[0].text,'ملاحظة أحدث');
  }finally{engine.destroy();}
});

test('in-flight ranked response cannot restore an abandoned or replaced run',async()=>{
  for(const replacement of ['practice','new-run','same-run-reopened']){
    const ranked={...emptyProgress(),mode:'ranked',runId:'run-old',startedAt:1000};
    const{engine,services,caseStore}=harness({progress:ranked});
    let resolve;services.cloud={markViewed:()=>new Promise(done=>{resolve=done;})};
    try{
      const pending=engine.markViewed('E09');
      caseStore.update(s=>{s.progress=emptyProgress();s.viewedIds=[];});
      if(replacement!=='practice')caseStore.update(s=>{s.progress={...ranked,runId:replacement==='new-run'?'run-new':'run-old'};});
      const before=caseStore.get();
      resolve({progress:{...ranked,seq:1},viewedIds:['E09'],result:{ok:true,seq:1}});
      await assert.rejects(()=>pending,error=>error.code==='RUN_CHANGED');
      assert.deepEqual(caseStore.get(),before,replacement);
    }finally{engine.destroy();}
  }
});

test('in-flight ranked hint cannot apply after the signed-in account changes',async()=>{
  const ranked={...emptyProgress(),mode:'ranked',runId:'run-test',startedAt:1000};
  const{engine,services,caseStore}=harness({progress:ranked});
  let account='account-a';let resolve;
  services.cloud={getSession:()=>({user:{id:account}}),revealHint:()=>new Promise(done=>{resolve=done;})};
  try{
    const pending=engine.revealHint('A01',1,'pending-hint',0);account='account-b';
    const before=caseStore.get();
    resolve({progress:{...ranked,seq:1,hintsByActivity:{A01:[1]}},viewedIds:[],result:{ok:true,hint:'old account hint'}});
    await assert.rejects(()=>pending,error=>error.code==='RUN_CHANGED');
    assert.deepEqual(caseStore.get(),before);
  }finally{engine.destroy();}
});

test('practice timer pauses outside the case and reset starts from fresh elapsed state',async()=>{
  const{engine,caseStore}=harness();
  const original=Date.now;let clock=100000;Date.now=()=>clock;
  try{
    engine.setActive(true);clock+=2500;assert.equal(engine.getSnapshot().elapsedMs,2500);
    engine.setActive(false);clock+=5000;assert.equal(engine.getSnapshot().elapsedMs,2500);
    engine.setActive(true);clock+=1000;engine.setPaused(true);clock+=5000;assert.equal(engine.getSnapshot().elapsedMs,3500);
    caseStore.update(s=>{s.progress=emptyProgress();s.drafts={};});engine.setActive(false);assert.equal(engine.getSnapshot().elapsedMs,0);
  }finally{Date.now=original;engine.destroy();}
});

test('timer handles external pause, an empty-run reset, ranked replacement and return to practice',()=>{
  const{engine,caseStore}=harness();
  const original=Date.now;let clock=100000;Date.now=()=>clock;
  try{
    engine.setActive(true);clock+=1500;
    assert.equal(engine.getSnapshot().elapsedMs,1500);
    caseStore.update(s=>{s.progress=emptyProgress();});
    assert.equal(engine.getSnapshot().elapsedMs,0,'reset before any answer discards the old live delta');
    clock+=700;caseStore.update(s=>{s.progress.paused=true;});clock+=2000;
    assert.equal(engine.getSnapshot().elapsedMs,700,'external pause flushes once');
    caseStore.update(s=>{s.progress.paused=false;});clock+=300;
    caseStore.update(s=>{s.progress={...emptyProgress(),mode:'ranked',runId:'server-run',startedAt:clock-4000};});
    assert.equal(engine.getSnapshot().elapsedMs,4000,'ranked timing uses server start, not practice delta');
    clock+=500;caseStore.update(s=>{s.notes=[{text:'workspace update'}];});
    assert.equal(engine.getSnapshot().elapsedMs,4500);
    assert.equal(caseStore.get().progress.elapsedMs,0,'practice clock cannot write into ranked state');
    caseStore.update(s=>{s.progress={...emptyProgress(),elapsedMs:250};});clock+=100;
    assert.equal(engine.getSnapshot().elapsedMs,350,'new practice begins a fresh live interval');
    engine.setActive(false);clock+=900;assert.equal(engine.getSnapshot().elapsedMs,350);
  }finally{engine.destroy();Date.now=original;}
});

test('completion freezes hint counters while already opened hints remain readable',async()=>{
  const{engine}=harness({progress:{...emptyProgress(),accepted:acceptedPrefix(32),hintsByActivity:{A01:[1]},completedAt:1000}});
  try{
    const before=engine.getSnapshot();
    assert.equal((await engine.revealHint('A01',1)).ok,true);
    assert.equal((await engine.revealHint('A01',2)).ok,false);
    assert.equal(engine.getSnapshot().seq,before.seq);
    assert.equal(engine.getSnapshot().hintCount,1);
  }finally{engine.destroy();}
});
