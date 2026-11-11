const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const crypto=require('node:crypto').webcrypto;
const source=fs.readFileSync(new URL('../raven/dialogue/local-api.js','file://'+__filename),'utf8');
const key='raven_dialogue_static_backend_v2',legacy='raven_dialogue_static_backend_v1';
function boot(seed){const values=new Map(Object.entries(seed)),removed=[];const scope={window:{fetch:async()=>{}},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>{removed.push(k);values.delete(k);}},Response,URL,DOMException,crypto,setTimeout:fn=>fn()};vm.runInNewContext(source,scope);return{values,removed,api:async(p,b)=>{const r=await scope.window.fetch(p,b?{method:'POST',body:JSON.stringify(b)}:{});return{httpStatus:r.status,...await r.json()};}};}
test('corrupt and incompatible browser backups survive new actions unchanged and report unconfirmed storage',async()=>{
 for(const raw of ['{broken',JSON.stringify({version:3,log:[]}),JSON.stringify({version:2,log:[{path:'/unsupported',data:{}}]})]){
  const s=boot({[key]:raw,other_app_preferences:'keep',raven_music_volume_v1:'0.4'});
  const r=await s.api('/api/dialogue',{requestId:'new',characterId:'jonas',message:'test'});
  assert.equal(r.httpStatus,200);assert.equal(r.localPersist,'incompatible');assert.equal(s.values.get(key),raw);
  assert.equal(s.values.get('other_app_preferences'),'keep');assert.equal(s.values.get('raven_music_volume_v1'),'0.4');assert.deepEqual(s.removed,[]);
 }
});
test('an invalid later saved event does not leave partial materials/knowledge in memory',async()=>{
 const log=[{path:'/api/materials',data:{id:'first',type:'statement',text:'PARTIAL'}},{path:'/api/shares',data:{eventId:'s',materialId:'first',recipients:['jonas']}},{path:'/api/materials',data:{id:'bad',type:'evidence',text:'invalid'}}];
 const raw=JSON.stringify({version:2,log}),s=boot({[key]:raw});
 assert.deepEqual((await s.api('/api/materials')).items,[]);assert.deepEqual((await s.api('/api/knowledge?characterId=jonas')).materials,[]);assert.equal(s.values.get(key),raw);
});
test('valid legacy migration retains the original and a valid new backup restores materials',async()=>{
 const old=JSON.stringify([{path:'/api/materials',data:{id:'keep',type:'statement',text:'preserve'}}]),s=boot({[legacy]:old});
 assert.equal(s.values.get(legacy),old);assert.deepEqual(s.removed,[]);assert.equal((await s.api('/api/materials')).items[0].text,'preserve');
 const next=boot(Object.fromEntries(s.values));assert.equal((await next.api('/api/materials')).items[0].id,'keep');
});
