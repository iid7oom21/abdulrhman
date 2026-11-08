import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
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
  put('raven/release.json',JSON.stringify({release:PUBLIC_RELEASE,interfaceVersion:'case-play-1',caseApiVersion:1,
    publicMode:'static-site-with-optional-written-case-server',storyIncludedInPublicBundle:false,
    providerCallsRequired:false,musicTracks:13,raven17Episodes:3,languages:['ar','en']}));
  put(EXPORT_MARKER,JSON.stringify({format:'raven-render-site-v1',commit:SITE_COMMIT,release:PUBLIC_RELEASE}));
  const bytes=Buffer.from(JSON.stringify(fixturePack())+'\n'),secret=path.join(secrets,'case.json');fs.writeFileSync(secret,bytes);
  const env={RAVEN_RENDER_DATA_MOUNT:mount,RAVEN_RENDER_DATA_DIR:path.join(mount,'raven'),RAVEN_CASE_CONTENT_FILE:secret};
  return {root,siteRoot,mount,secrets,secret,bytes,env,put,options:{siteRoot,env,defaultSecretFile:path.join(secrets,'missing-default.json')}};
}
function rejected(callback,code) { assert.throws(callback,error=>error instanceof RenderStartupError && (!code || error.code===code)); }

test('module import performs no listen/build and does not require private configuration',()=>{
  const script=`await import(${JSON.stringify(new URL('./start.mjs',import.meta.url).href)});console.log('import-only');`;
  assert.equal(execFileSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:5000}).trim(),'import-only');
});

test('validated private JSON is staged atomically with pinned public export, restrictive modes and disk paths',t=>{
  const f=fixture(t);f.env.RAVEN_CASE_CONTENT_SHA256=digest(f.bytes).toUpperCase();f.env.PORT='19001';
  const runtime=prepareRenderRuntime(f.options);
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
