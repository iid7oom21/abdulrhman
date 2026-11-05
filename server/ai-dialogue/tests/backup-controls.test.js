import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createBackup,restoreBackup} from '../src/backup.js';
import {runtimeControls} from '../src/runtime-controls.js';
import {createPreviewServer} from '../src/server.js';
import {_reset} from '../src/dialogue.js';
const temp=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'raven-recovery-'));t.after(()=>fs.rmSync(dir,{recursive:true}));return dir;};
async function server(t,options,cookie){const app=createPreviewServer(options);await new Promise(r=>app.listen(0,'127.0.0.1',r));const root='http://127.0.0.1:'+app.address().port;let closed=false;const close=async()=>{if(!closed){closed=true;await new Promise(r=>app.close(r));}};t.after(close);if(!cookie)cookie=(await fetch(root)).headers.get('set-cookie').split(';')[0];return {root,cookie,close,post:async(p,data)=>{const r=await fetch(root+p,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(data)});return {status:r.status,body:await r.json()};},get:async p=>{const r=await fetch(root+p,{headers:{cookie}});return r.json();}};}

test('backup/restore retains session, material, share, reply and replay/conflict through real HTTP',async t=>{
 _reset();const dir=temp(t),file=path.join(dir,'original.json'),backup=path.join(dir,'backup.json'),target=path.join(dir,'restored.json');let calls=0;
 const a=await server(t,{storeFile:file,generate:()=>{calls++;return {text:'KNOWN',refused:false};}});
 assert.equal((await a.post('/api/materials',{id:'s1',type:'statement',text:'player text'})).status,200);
 assert.equal((await a.post('/api/shares',{eventId:'e1',materialId:'s1',recipients:['jonas']})).status,200);
 const body={requestId:'one',characterId:'jonas',message:'hello'},first=await a.post('/api/dialogue',body);assert.equal(first.body.status,'completed');await a.close();
 const original=fs.readFileSync(file);const receipt=createBackup(file,backup);assert.equal(receipt.bytes,original.length);assert.equal(fs.statSync(backup).mode&0o777,0o600);
 restoreBackup(backup,target);assert.deepEqual(fs.readFileSync(file),original);assert.deepEqual(fs.readFileSync(target),original);
 _reset();const b=await server(t,{storeFile:target,generate:()=>{calls++;throw new Error('must not generate');}},a.cookie);
 const replay=await b.post('/api/dialogue',body);assert.equal(replay.body.replayed,true);assert.deepEqual(replay.body.response,first.body.response);assert.equal(calls,1);
 assert.equal((await b.post('/api/dialogue',{...body,message:'changed'})).status,409);
 const materials=await b.get('/api/materials');assert.equal(materials.items.length,1);assert.equal(materials.events.length,1);assert.equal((await b.get('/api/history')).items.length,1);
});

test('backup refuses corrupt nested state; restore rejects tampering and never overwrites a destination',async t=>{
 _reset();const dir=temp(t),file=path.join(dir,'s.json'),backup=path.join(dir,'b.json'),target=path.join(dir,'target.json');const a=await server(t,{storeFile:file});await a.close();
 createBackup(file,backup);const original=fs.readFileSync(backup,'utf8');assert.throws(()=>createBackup(file,backup),e=>e.code==='EEXIST');assert.equal(fs.readFileSync(backup,'utf8'),original);
 fs.writeFileSync(target,'KEEP');assert.throws(()=>restoreBackup(backup,target),e=>e.code==='EEXIST');assert.equal(fs.readFileSync(target,'utf8'),'KEEP');
 const tampered=JSON.parse(original);tampered.snapshot='null';fs.writeFileSync(backup,JSON.stringify(tampered));assert.throws(()=>restoreBackup(backup,path.join(dir,'new.json')),/invalid_backup/);
 tampered.sha256=createHash('sha256').update(tampered.snapshot).digest('hex');fs.writeFileSync(backup,JSON.stringify(tampered));assert.throws(()=>restoreBackup(backup,path.join(dir,'new.json')));assert.equal(fs.existsSync(path.join(dir,'new.json')),false);
 const snapshot=JSON.parse(fs.readFileSync(file,'utf8'));snapshot.sessions[0].actions=[{kind:'material',input:{id:'bad',type:'evidence',author:'player',text:'no'}}];fs.writeFileSync(file,JSON.stringify(snapshot));
 assert.throws(()=>createBackup(file,path.join(dir,'bad.json')),/incompatible_store_file/);assert.equal(fs.existsSync(path.join(dir,'bad.json')),false);
});

test('operator switch stops new provider calls, preserves pending work and allows written replies/history',async t=>{
 _reset();const dir=temp(t),file=path.join(dir,'controls.json');fs.writeFileSync(file,JSON.stringify({version:1,providerCallsEnabled:true}));
 const readControls=runtimeControls({RAVEN_RUNTIME_CONTROL_PATH:file});let calls=0,resolve;const pending=new Promise(r=>resolve=r);
 const s=await server(t,{readControls,generate:async()=>{calls++;return pending;},providerInfo:{provider:'openai',model:'test'}});t.after(()=>resolve?.({text:'COMPLETED',refused:false}));
 const first=await s.post('/api/dialogue',{requestId:'one',characterId:'jonas',message:'a'});assert.equal(first.status,202);assert.equal(calls,1);
 fs.writeFileSync(file,JSON.stringify({version:1,providerCallsEnabled:false}));
 const second=await s.post('/api/dialogue',{requestId:'two',characterId:'claire',message:'b'});assert.equal(second.body.status,'completed');assert.equal(second.body.response.source,'deterministic-fallback');assert.equal(calls,1);
 resolve({text:'COMPLETED',refused:false});await new Promise(r=>setImmediate(r));
 assert.equal((await s.get('/api/operations/one')).response.text,'COMPLETED');assert.equal((await s.get('/api/history')).items.length,2);
 const config=await s.get('/api/config');assert.equal(config.controls.providerCallsEnabled,false);assert.equal(config.mode,'simulation');assert.equal((await s.get('/api/status')).mode,'simulation');assert.equal(config.controls.purchasesEnabled,false);assert.equal(config.controls.entitlementUseEnabled,false);
 fs.writeFileSync(file,'{broken');assert.equal(readControls().providerCallsEnabled,false);assert.equal(readControls().controlAvailable,false);
 fs.writeFileSync(file,JSON.stringify({version:1,providerCallsEnabled:true,purchasesEnabled:true}));assert.equal(readControls().providerCallsEnabled,false);
 assert.equal(runtimeControls({RAVEN_MODEL_CALLS_ENABLED:'0'})().providerCallsEnabled,false);
});
