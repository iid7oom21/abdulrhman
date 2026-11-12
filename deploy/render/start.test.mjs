import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync,spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {prepareRenderRuntime,createRenderServer,MAX_CONTENT_BYTES,RenderStartupError} from './start.mjs';
import {CORE_FILES,SITE_COMMIT,PUBLIC_RELEASE,EXPORT_MARKER} from './build.mjs';
import {fixturePack} from '../../server/ai-dialogue/tests/fixtures/case.js';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const mode = file => fs.statSync(file).mode & 0o777;
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'raven-render-start-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const siteRoot=path.join(root,'public'),mount=path.join(root,'mount'),secrets=path.join(root,'secrets');
  for(const directory of [siteRoot,mount,secrets])fs.mkdirSync(directory);
  function put(relative,body='fixture') { const file=path.join(siteRoot,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body); }
  for(const file of CORE_FILES)put(file);
  put('site-audio.js',Array.from({length:13},(_,i)=>`{file:'assets/audio/raven/${String(i+1).padStart(2,'0')}.mp3'}`).join(','));
  for(let n=1;n<=13;n++)put(`assets/audio/raven/${String(n).padStart(2,'0')}.mp3`);
  for(let n=1;n<=3;n++)put(`raven/terminal-preview/raven-17/part-${n}/index.html`);
  put('raven/release.json',JSON.stringify({release:PUBLIC_RELEASE,interfaceVersion:'case-play-2',caseApiVersion:1,
    publicMode:'static-site-with-optional-written-case-server',storyIncludedInPublicBundle:false,
    providerCallsRequired:false,musicTracks:13,raven17Episodes:3,languages:['ar','en']}));
  put(EXPORT_MARKER,JSON.stringify({format:'raven-render-site-v1',commit:SITE_COMMIT,release:PUBLIC_RELEASE}));
  const bytes=Buffer.from(JSON.stringify(fixturePack())+'\n'),secret=path.join(secrets,'case.json');fs.writeFileSync(secret,bytes);
  const env={RAVEN_RENDER_DATA_MOUNT:mount,RAVEN_RENDER_DATA_DIR:path.join(mount,'raven'),RAVEN_CASE_CONTENT_FILE:secret};
  return {root,siteRoot,mount,secrets,secret,bytes,env,put,options:{siteRoot,env,defaultSecretFile:path.join(secrets,'missing-default.json')}};
}
function rejected(callback,code) { assert.throws(callback,error=>error instanceof RenderStartupError && (!code || error.code===code)); }
function browserFixture(t) {
  const f=fixture(t);
  Object.assign(f.env,{
    RAVEN_RENDER_STORAGE_MODE:'browser-checkpoint',RAVEN_CASE_CHECKPOINT_KEY:'a1'.repeat(32),
    RAVEN_RENDER_EPHEMERAL_DIR:path.join(f.root,'temporary-private'),
    // Explicitly unusable disk settings demonstrate that this mode needs no disk.
    RAVEN_RENDER_DATA_MOUNT:path.join(f.root,'absent-disk'),
    RAVEN_RENDER_DATA_DIR:path.join(f.root,'absent-disk','raven'),
  });
  return f;
}

async function launchProcess(t,options) {
  const code=`import {createRenderServer} from ${JSON.stringify(new URL('./start.mjs',import.meta.url).href)};
    const {server}=createRenderServer(JSON.parse(process.argv[1]));
    server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
    process.once('SIGTERM',()=>{server.closeAllConnections();server.close(()=>process.exit(0));});`;
  const child=spawn(process.execPath,['--input-type=module','-e',code,JSON.stringify(options)],{stdio:['ignore','ignore','ignore','ipc']});
  const close=async()=>{
    if(child.exitCode!==null || child.signalCode!==null)return;
    const exited=once(child,'exit');child.kill('SIGTERM');await exited;
  };
  t.after(close);
  const message=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('fixture server startup timed out'));},5000);
    child.once('message',value=>{clearTimeout(timer);resolve(value);});
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('fixture server exited: '+code));});
  });
  const origin='http://127.0.0.1:'+message.port;
  const request=async(target,{body,cookie}={})=>{
    const response=await fetch(origin+target,{method:body===undefined?'GET':'POST',headers:{
      ...(cookie?{cookie}:{}),...(body===undefined?{}:{'Content-Type':'application/json',Origin:origin.replace('http:','https:')}),
    },...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,headers:response.headers,body:await response.json()};
  };
  return {origin,request,close};
}

test('module import performs no listen/build and does not require private configuration',()=>{
  const script=`await import(${JSON.stringify(new URL('./start.mjs',import.meta.url).href)});console.log('import-only');`;
  assert.equal(execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:5000}).trim(),'import-only');
});

test('validated private JSON is staged atomically with pinned public export, restrictive modes and disk paths',t=>{
  const f=fixture(t);f.env.RAVEN_CASE_CONTENT_SHA256=digest(f.bytes).toUpperCase();f.env.PORT='19001';
  const runtime=prepareRenderRuntime(f.options);
  assert.equal(runtime.storageMode,'disk');
  assert.equal(runtime.host,'0.0.0.0');assert.equal(runtime.port,19001);assert.equal(runtime.source,'secret-file');
  assert.equal(runtime.caseContentSHA256,digest(f.bytes));assert.deepEqual(fs.readFileSync(runtime.caseContentPath),f.bytes);
  for(const directory of [runtime.dataDir,path.dirname(runtime.caseContentPath),path.dirname(runtime.caseStoragePath)])assert.equal(mode(directory),0o700);
  assert.equal(mode(runtime.caseContentPath),0o600);assert.equal(path.dirname(runtime.caseStoragePath),path.dirname(runtime.storeFile));
  assert.ok(runtime.caseStoragePath.startsWith(f.mount+path.sep));
  assert.deepEqual(fs.readdirSync(path.dirname(runtime.caseContentPath)),['raven-case-content.json']);
});

test('gzip secret and validated cache fallback work without reading a real secret; cache permissions are repaired',t=>{
  const f=fixture(t);delete f.env.RAVEN_CASE_CONTENT_FILE;f.env.RAVEN_CASE_CONTENT_GZIP_BASE64=gzipSync(f.bytes).toString('base64');
  const first=prepareRenderRuntime(f.options);assert.equal(first.source,'secret-env');
  const inode=fs.statSync(first.caseContentPath).ino;
  fs.chmodSync(first.caseContentPath,0o644);fs.chmodSync(first.dataDir,0o755);
  delete f.env.RAVEN_CASE_CONTENT_GZIP_BASE64;f.env.RAVEN_CASE_CONTENT_SHA256=digest(f.bytes);
  const cached=prepareRenderRuntime(f.options);assert.equal(cached.source,'validated-cache');
  assert.equal(fs.statSync(cached.caseContentPath).ino,inode);assert.equal(mode(cached.caseContentPath),0o600);assert.equal(mode(cached.dataDir),0o700);
  fs.writeFileSync(cached.caseContentPath,'{"broken":true}');
  rejected(()=>prepareRenderRuntime(f.options));assert.equal(fs.readFileSync(cached.caseContentPath,'utf8'),'{"broken":true}');
});

test('invalid replacement, mismatch and conflicting secrets preserve the exact old cached pack',t=>{
  const f=fixture(t),runtime=prepareRenderRuntime(f.options),original=fs.readFileSync(runtime.caseContentPath),inode=fs.statSync(runtime.caseContentPath).ino;
  const malformed=path.join(f.secrets,'malformed.json');fs.writeFileSync(malformed,'{"SECRET_SENTINEL":');
  const unapproved=fixturePack();unapproved.authorTruth='SECRET_SENTINEL';const extra=path.join(f.secrets,'extra.json');fs.writeFileSync(extra,JSON.stringify(unapproved));
  const variants=[
    {...f.env,RAVEN_CASE_CONTENT_FILE:malformed}, {...f.env,RAVEN_CASE_CONTENT_FILE:extra},
    {...f.env,RAVEN_CASE_CONTENT_SHA256:'0'.repeat(64)}, {...f.env,RAVEN_CASE_CONTENT_SHA256:'not-a-hash'},
    {...f.env,RAVEN_CASE_CONTENT_FILE:path.join(f.secrets,'missing.json')},
    {...f.env,RAVEN_CASE_CONTENT_GZIP_BASE64:gzipSync(f.bytes).toString('base64')},
    {...f.env,RAVEN_CASE_CONTENT_FILE:''},
  ];
  for(const env of variants){
    assert.throws(()=>prepareRenderRuntime({...f.options,env}),error=>error instanceof RenderStartupError && !error.message.includes('SECRET_SENTINEL'));
    assert.deepEqual(fs.readFileSync(runtime.caseContentPath),original);assert.equal(fs.statSync(runtime.caseContentPath).ino,inode);
  }
  assert.deepEqual(fs.readdirSync(path.dirname(runtime.caseContentPath)),['raven-case-content.json']);
});

test('gzip decoding is strict and both compressed expansion and plain files obey the 8 MiB limit',t=>{
  const f=fixture(t),runtime=prepareRenderRuntime(f.options),old=fs.readFileSync(runtime.caseContentPath);
  const env={...f.env};delete env.RAVEN_CASE_CONTENT_FILE;
  for(const value of ['%%%%','YQ==','',gzipSync(Buffer.alloc(MAX_CONTENT_BYTES+1,65)).toString('base64')]){
    rejected(()=>prepareRenderRuntime({...f.options,env:{...env,RAVEN_CASE_CONTENT_GZIP_BASE64:value}}));
    assert.deepEqual(fs.readFileSync(runtime.caseContentPath),old);
  }
  const oversized=path.join(f.secrets,'oversized.json');fs.writeFileSync(oversized,Buffer.alloc(MAX_CONTENT_BYTES+1,32));
  rejected(()=>prepareRenderRuntime({...f.options,env:{...f.env,RAVEN_CASE_CONTENT_FILE:oversized}}),'invalid_private_file');
  const invalidUtf8=path.join(f.secrets,'invalid-utf8.json');fs.writeFileSync(invalidUtf8,Buffer.concat([f.bytes,Buffer.from([0xff])]));
  rejected(()=>prepareRenderRuntime({...f.options,env:{...f.env,RAVEN_CASE_CONTENT_FILE:invalidUtf8}}));
});

test('private source files reject Git, public roots, links and path normalization without replacing cache',t=>{
  const f=fixture(t),runtime=prepareRenderRuntime(f.options),old=fs.readFileSync(runtime.caseContentPath);
  const repo=path.join(f.root,'private-in-git');fs.mkdirSync(repo);fs.writeFileSync(path.join(repo,'.git'),'gitdir: elsewhere');fs.writeFileSync(path.join(repo,'pack.json'),f.bytes);
  f.put('pack.json',f.bytes);
  const link=path.join(f.secrets,'linked.json');fs.symlinkSync(f.secret,link);
  const linkedDirectory=path.join(f.root,'linked-secrets');fs.symlinkSync(f.secrets,linkedDirectory);
  for(const file of [path.join(repo,'pack.json'),path.join(f.siteRoot,'pack.json'),link,path.join(linkedDirectory,'case.json'),'relative.json',f.secrets+'/../secrets/case.json']){
    rejected(()=>prepareRenderRuntime({...f.options,env:{...f.env,RAVEN_CASE_CONTENT_FILE:file}}));
    assert.deepEqual(fs.readFileSync(runtime.caseContentPath),old);
  }
});

test('missing mounted directory, data outside it, linked ancestors and Git-owned storage fail closed',t=>{
  const f=fixture(t);
  const missing=path.join(f.root,'missing-mount');
  rejected(()=>prepareRenderRuntime({...f.options,env:{...f.env,RAVEN_RENDER_DATA_MOUNT:missing,RAVEN_RENDER_DATA_DIR:path.join(missing,'raven')}}));assert.equal(fs.existsSync(missing),false);
  rejected(()=>prepareRenderRuntime({...f.options,env:{...f.env,RAVEN_RENDER_DATA_DIR:path.join(f.root,'not-mounted')}}),'data_outside_mount');
  const linkedMount=path.join(f.root,'linked-mount');fs.symlinkSync(f.mount,linkedMount);
  rejected(()=>prepareRenderRuntime({...f.options,env:{...f.env,RAVEN_RENDER_DATA_MOUNT:linkedMount,RAVEN_RENDER_DATA_DIR:path.join(linkedMount,'raven')}}));
  const linked=path.join(f.mount,'linked');fs.symlinkSync(f.secrets,linked);
  rejected(()=>prepareRenderRuntime({...f.options,env:{...f.env,RAVEN_RENDER_DATA_DIR:path.join(linked,'raven')}}));
  const repo=path.join(f.mount,'checkout');fs.mkdirSync(repo);fs.mkdirSync(path.join(repo,'.git'));
  rejected(()=>prepareRenderRuntime({...f.options,env:{...f.env,RAVEN_RENDER_DATA_DIR:path.join(repo,'saves')}}),'private_path_in_git');
});

test('cached content and store symlinks are rejected without following, chmodding or replacing their targets',t=>{
  const f=fixture(t),runtime=prepareRenderRuntime(f.options),outside=path.join(f.secrets,'untouched.txt');fs.writeFileSync(outside,'keep');fs.chmodSync(outside,0o644);
  fs.symlinkSync(outside,runtime.caseStoragePath);rejected(()=>prepareRenderRuntime(f.options));assert.equal(mode(outside),0o644);assert.equal(fs.readFileSync(outside,'utf8'),'keep');
  fs.unlinkSync(runtime.caseStoragePath);fs.unlinkSync(runtime.caseContentPath);fs.symlinkSync(outside,runtime.caseContentPath);
  rejected(()=>prepareRenderRuntime(f.options));assert.equal(fs.lstatSync(runtime.caseContentPath).isSymbolicLink(),true);assert.equal(fs.readFileSync(outside,'utf8'),'keep');
});

test('wrong marker, missing public asset and invalid port stop before private cache creation',t=>{
  const f=fixture(t);const marker=path.join(f.siteRoot,EXPORT_MARKER),original=fs.readFileSync(marker);
  fs.writeFileSync(marker,JSON.stringify({format:'raven-render-site-v1',commit:'0'.repeat(40),release:PUBLIC_RELEASE}));
  rejected(()=>prepareRenderRuntime(f.options),'public_commit_mismatch');assert.equal(fs.existsSync(f.env.RAVEN_RENDER_DATA_DIR),false);
  fs.writeFileSync(marker,original);fs.unlinkSync(path.join(f.siteRoot,CORE_FILES[0]));rejected(()=>prepareRenderRuntime(f.options));
  f.put(CORE_FILES[0]);
  for(const PORT of ['0','65536','1.2','NaN',''])rejected(()=>prepareRenderRuntime({...f.options,env:{...f.env,PORT}}));
});

test('atomic publication failure preserves prior content and removes its own staging file',t=>{
  const f=fixture(t),runtime=prepareRenderRuntime(f.options),old=fs.readFileSync(runtime.caseContentPath),rename=fs.renameSync;
  fs.renameSync=function(from,to){if(to===runtime.caseContentPath)throw Error('SECRET_SENTINEL');return rename(from,to);};
  try { rejected(()=>prepareRenderRuntime(f.options),'render_startup_failed'); }
  finally { fs.renameSync=rename; }
  assert.deepEqual(fs.readFileSync(runtime.caseContentPath),old);assert.deepEqual(fs.readdirSync(path.dirname(runtime.caseContentPath)),['raven-case-content.json']);
});

for (const target of ['caseStoragePath','storeFile']) test(`corrupt ${target} prevents server creation and preserves its original bytes`,t=>{
  const f=fixture(t),runtime=prepareRenderRuntime(f.options),bytes=Buffer.from('{"PRIVATE_SENTINEL":broken');
  fs.writeFileSync(runtime[target],bytes);
  rejected(()=>createRenderServer(f.options),'render_server_unavailable');
  assert.deepEqual(fs.readFileSync(runtime[target]),bytes);
});

test('hosted server loads the written case, forces simulation off-provider, and uses Secure durable sessions',async t=>{
  const f=fixture(t);f.env.RAVEN_AI_PROVIDER='openai';f.env.RAVEN_MODEL_CALLS_ENABLED='1';f.env.OPENAI_API_KEY='FICTIONAL_NEVER_USED';
  f.env.RAVEN_CASE_CHECKPOINT_KEY='IGNORED_UNLESS_BROWSER_MODE_IS_EXPLICIT';
  const {server,runtime}=createRenderServer(f.options);
  assert.equal(server.listening,false);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const origin='http://127.0.0.1:'+server.address().port;
  const home=await fetch(origin+'/?lang=en',{redirect:'manual'});assert.equal(home.status,307);assert.equal(home.headers.get('location'),'/raven/?lang=en');
  const config=await(await fetch(origin+'/api/config')).json();
  assert.equal(config.provider,'simulation');assert.equal(config.controls.providerCallsEnabled,false);assert.equal(config.controls.purchasesEnabled,false);assert.equal(config.controls.entitlementUseEnabled,false);
  const caseConfig=await(await fetch(origin+'/api/case/config')).json();assert.equal(caseConfig.enabled,true);assert.equal(caseConfig.persistence,'disk-file');
  const start=await fetch(origin+'/api/case/start',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin.replace('http:','https:')},body:JSON.stringify({contentVersion:'fixture-v1'})});
  assert.equal(start.status,200);assert.match(start.headers.get('set-cookie'),/HttpOnly; SameSite=Strict;.*; Secure/);assert.equal((await start.json()).saveStatus,'confirmed');assert.equal(mode(runtime.caseStoragePath),0o600);
  const health=await fetch(origin+'/healthz');assert.equal(health.status,200);
  const noSource={...f.env};delete noSource.RAVEN_CASE_CONTENT_FILE;
  fs.unlinkSync(runtime.caseContentPath);rejected(()=>createRenderServer({...f.options,env:noSource}));
});

test('browser mode stages only private content without requiring or creating a persistent mount or save files',t=>{
  const f=browserFixture(t),runtime=prepareRenderRuntime(f.options);
  assert.equal(runtime.storageMode,'browser-checkpoint');
  assert.equal(runtime.caseStoragePath,null);assert.equal(runtime.storeFile,null);
  assert.equal(runtime.dataDir,f.env.RAVEN_RENDER_EPHEMERAL_DIR);
  assert.equal(mode(runtime.dataDir),0o700);assert.equal(mode(runtime.caseContentPath),0o600);
  assert.deepEqual(fs.readFileSync(runtime.caseContentPath),f.bytes);
  assert.equal(fs.existsSync(f.env.RAVEN_RENDER_DATA_MOUNT),false);
  assert.equal(fs.existsSync(path.join(runtime.dataDir,'stores')),false);
  assert.doesNotMatch(JSON.stringify(runtime),new RegExp(f.env.RAVEN_CASE_CHECKPOINT_KEY));
});

test('free template gzip input is validated and staged privately with its decoded hash',t=>{
  const f=browserFixture(t);delete f.env.RAVEN_CASE_CONTENT_FILE;
  f.env.RAVEN_CASE_CONTENT_GZIP_BASE64=gzipSync(f.bytes).toString('base64');
  f.env.RAVEN_CASE_CONTENT_SHA256=digest(f.bytes);
  f.env.RAVEN_CASE_CHECKPOINT_KEY=f.env.RAVEN_CASE_CHECKPOINT_KEY.toUpperCase();
  const runtime=prepareRenderRuntime(f.options);
  assert.equal(runtime.source,'secret-env');assert.equal(runtime.storageMode,'browser-checkpoint');
  assert.equal(runtime.caseContentSHA256,digest(f.bytes));assert.deepEqual(fs.readFileSync(runtime.caseContentPath),f.bytes);
  assert.equal(mode(runtime.caseContentPath),0o600);assert.equal(runtime.caseStoragePath,null);assert.equal(runtime.storeFile,null);
  for(const secret of [f.env.RAVEN_CASE_CHECKPOINT_KEY,f.env.RAVEN_CASE_CONTENT_GZIP_BASE64])assert.equal(JSON.stringify(runtime).includes(secret),false);
});

test('browser mode refuses missing or malformed stable keys and unknown modes before creating private content',t=>{
  const f=browserFixture(t);
  for(const value of [undefined,'','short','g'.repeat(64),'ab'.repeat(31)]){
    const env={...f.env};if(value===undefined)delete env.RAVEN_CASE_CHECKPOINT_KEY;else env.RAVEN_CASE_CHECKPOINT_KEY=value;
    rejected(()=>createRenderServer({...f.options,env}));
    assert.equal(fs.existsSync(f.env.RAVEN_RENDER_EPHEMERAL_DIR),false);
  }
  rejected(()=>prepareRenderRuntime({...f.options,env:{...f.env,RAVEN_RENDER_STORAGE_MODE:'memory'}}),'invalid_storage_mode');
  assert.equal(fs.existsSync(f.env.RAVEN_RENDER_EPHEMERAL_DIR),false);
});

test('browser content remains outside Git and public roots and cannot follow directory links',t=>{
  const f=browserFixture(t),outside=path.join(f.root,'unmodified');fs.mkdirSync(outside);fs.chmodSync(outside,0o755);
  const link=path.join(f.root,'linked-private');fs.symlinkSync(outside,link);
  const repo=path.join(f.root,'checkout');fs.mkdirSync(repo);fs.mkdirSync(path.join(repo,'.git'));
  for(const directory of [f.siteRoot,path.join(repo,'private'),path.join(link,'content'),'/']){
    rejected(()=>prepareRenderRuntime({...f.options,env:{...f.env,RAVEN_RENDER_EPHEMERAL_DIR:directory}}));
  }
  assert.equal(mode(outside),0o755);assert.deepEqual(fs.readdirSync(outside),[]);
});

test('browser mode never uses an ephemeral content cache when the deployment secret is missing',t=>{
  const f=browserFixture(t),runtime=prepareRenderRuntime(f.options),old=fs.readFileSync(runtime.caseContentPath);
  const missing={...f.env};delete missing.RAVEN_CASE_CONTENT_FILE;
  rejected(()=>prepareRenderRuntime({...f.options,env:missing}),'private_content_required');
  assert.deepEqual(fs.readFileSync(runtime.caseContentPath),old);
  const broken=path.join(f.secrets,'broken.json');fs.writeFileSync(broken,'{"SECRET_SENTINEL":');
  rejected(()=>prepareRenderRuntime({...f.options,env:{...f.env,RAVEN_CASE_CONTENT_FILE:broken}}));
  assert.deepEqual(fs.readFileSync(runtime.caseContentPath),old);
});

test('browser checkpoint survives a real process restart and loss of all ephemeral files without claiming server persistence',async t=>{
  const f=browserFixture(t);f.env.RAVEN_AI_PROVIDER='openai';f.env.RAVEN_MODEL_CALLS_ENABLED='1';f.env.OPENAI_API_KEY='FICTIONAL_UNUSED_KEY';
  const first=await launchProcess(t,f.options);
  const config=await first.request('/api/case/config');assert.equal(config.body.persistence,'browser-checkpoint');assert.equal(config.body.enabled,true);
  const provider=await first.request('/api/config');assert.equal(provider.body.provider,'simulation');assert.equal(provider.body.controls.providerCallsEnabled,false);assert.equal(provider.body.persistence,'process-memory');
  assert.doesNotMatch(JSON.stringify([config.body,provider.body]),new RegExp(f.env.RAVEN_CASE_CHECKPOINT_KEY+'|FICTIONAL_UNUSED_KEY'));
  const began=await first.request('/api/case/start',{body:{contentVersion:'fixture-v1'}});
  assert.equal(began.status,200);assert.equal(began.body.saveStatus,'browser-required');assert.equal(typeof began.body.checkpoint,'string');
  assert.match(began.headers.get('set-cookie'),/HttpOnly; SameSite=Strict;.*; Secure/);
  const cookie=began.headers.get('set-cookie').split(';')[0];
  const action={id:'render-free-read',revision:0,contentVersion:'fixture-v1',actionId:'read',values:{}};
  const changed=await first.request('/api/case/actions',{body:action,cookie});assert.equal(changed.status,200);assert.equal(changed.body.revision,1);
  assert.equal(changed.body.persistence,'browser-checkpoint');assert.equal(changed.body.saveStatus,'browser-required');
  const checkpoint=changed.body.checkpoint;assert.equal(typeof checkpoint,'string');assert.ok(checkpoint.length>0);
  assert.doesNotMatch(checkpoint,/PUBLIC_CARD_BODY|UNSEEN_MATERIAL_SENTINEL|FUTURE_SCENE_SENTINEL/);
  await first.close();fs.rmSync(f.env.RAVEN_RENDER_EPHEMERAL_DIR,{recursive:true,force:true});
  const second=await launchProcess(t,f.options);
  assert.equal((await second.request('/api/case/state',{cookie})).status,401);
  const restored=await second.request('/api/case/restore',{body:{checkpoint},cookie});assert.equal(restored.status,200);assert.equal(restored.body.revision,1);
  assert.equal(restored.body.saveStatus,'browser-required');assert.deepEqual(restored.body.materials,changed.body.materials);
  const resumedCookie=restored.headers.get('set-cookie')?.split(';')[0] || cookie;
  const replay=await second.request('/api/case/actions',{body:action,cookie:resumedCookie});assert.equal(replay.status,200);assert.equal(replay.body.replayed,true);assert.equal(replay.body.revision,1);
  const reading=await second.request('/api/case/export',{cookie:resumedCookie});assert.equal(reading.status,200);
  assert.equal(Object.hasOwn(reading.body,'checkpoint'),false);assert.equal(Object.hasOwn(reading.body,'checkpointInfo'),false);
  assert.doesNotMatch(JSON.stringify(reading.body),/UNSEEN_MATERIAL_SENTINEL|FUTURE_SCENE_SENTINEL/);
  assert.equal(fs.existsSync(path.join(f.env.RAVEN_RENDER_EPHEMERAL_DIR,'stores')),false);
  await second.close();
  const wrong=await launchProcess(t,{...f.options,env:{...f.env,RAVEN_CASE_CHECKPOINT_KEY:'b2'.repeat(32)}});
  const rejectedRestore=await wrong.request('/api/case/restore',{body:{checkpoint},cookie:resumedCookie});assert.equal(rejectedRestore.status,400);assert.equal(rejectedRestore.body.error,'checkpoint_invalid');
  assert.equal(rejectedRestore.headers.get('set-cookie'),null);
});
