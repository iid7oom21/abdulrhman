import test from 'node:test';
import assert from 'node:assert/strict';
import {activityStore} from '../raven/after-show/state.js';
const name = key => 'raven.after-show.v1.' + key;
function local() {
  const entries = new Map();
  return {
    getItem(key) {return entries.get(key) ?? null;},
    setItem(key,value) {entries.set(key,value);},
    removeItem(key) {entries.delete(key);}
  };
}
test('an absent round does not create resume data and a confirmed round is independent of other activities',()=>{
  const storage=local(), first=activityStore(()=>storage);
  assert.equal(first.saved('edit'),false);
  assert.deepEqual(first.load('edit',{}),{});
  assert.equal(storage.getItem(name('edit')),null);
  first.save('sound',{cue:2.1}); first.save('edit',{shots:['exterior']});
  assert.equal(first.saved('edit'),true);
  const copy=first.load('edit');copy.shots.push('lamp');
  assert.deepEqual(first.load('edit'),{shots:['exterior']});
  assert.equal(first.clear('edit'),true);
  assert.equal(first.saved('edit'),false);
  assert.deepEqual(activityStore(()=>storage).load('sound'),{cue:2.1});
});
test('a stale tab preserves both copies and has to reopen the newer state explicitly',()=>{
  const storage=local(),first=activityStore(()=>storage), second=activityStore(()=>storage);
  first.load('budget',null);second.load('budget',null);
  assert.equal(first.save('budget',{budget:10}),true);
  assert.equal(second.save('budget',{budget:4}),false);
  assert.equal(second.issue('budget'),'conflict');
  assert.deepEqual(second.load('budget'),{budget:4});
  assert.equal(second.clear('budget'),false);
  assert.deepEqual(activityStore(()=>storage).load('budget'),{budget:10});
  second.refresh('budget');
  assert.deepEqual(second.load('budget'),{budget:10});
  assert.equal(second.save('budget',{budget:8}),true);
});
test('unsupported and malformed stored rounds survive attempted saves until an explicit reset',()=>{
  for(const raw of ['?',JSON.stringify({v:42,data:{unknown:1}})]){
    const storage=local();storage.setItem(name('light'),raw);
    const state=activityStore(()=>storage);
    assert.equal(state.load('light',null),null);assert.equal(state.issue('light'),'incompatible');
    assert.equal(state.save('light',{amount:2}),false);assert.equal(storage.getItem(name('light')),raw);
    assert.deepEqual(state.load('light'),{amount:2});
    assert.equal(state.clear('light'),true);assert.equal(storage.getItem(name('light')),null);
  }
});
test('read and write failures retain the in-memory game and never confirm a save',()=>{
  const broken=[()=>{throw Error('blocked');},()=>({getItem:()=>null,setItem:()=>{},removeItem:()=>{}})];
  for(const provider of broken){
    const notices=[],state=activityStore(provider,(reason,key)=>notices.push([reason,key]));
    assert.equal(state.save('daily',{round:4}),false);
    assert.deepEqual(state.load('daily'),{round:4});
    assert.equal(state.saved('daily'),false);
    assert.deepEqual(notices.at(-1),['unavailable','daily']);
  }
});
