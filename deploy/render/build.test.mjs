import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildSite,validatePublicExport,CORE_FILES,PUBLIC_RELEASE,EXPORT_MARKER} from './build.mjs';

const metadata={release:PUBLIC_RELEASE,interfaceVersion:'case-play-2',caseApiVersion:1,
  publicMode:'static-site-with-optional-written-case-server',storyIncludedInPublicBundle:false,
  providerCallsRequired:false,musicTracks:13,raven17Episodes:3,languages:['ar','en']};
const run=(program,args,options)=>execFileSync(program,args,{...options,shell:false,stdio:['ignore','pipe','pipe']});
const git=(repo,args)=>run('git',args,{cwd:repo});
const fails=code=>error=>error.code===code;
const write=(root,name,content)=>{const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);};
function publicFiles(root) {
  for(const name of CORE_FILES) write(root,name,'PUBLIC_FILE');
  write(root,'raven/release.json',JSON.stringify(metadata));
  const tracks=Array.from({length:13},(_,n)=>`assets/audio/raven/${String(n+1).padStart(2,'0')}.mp3`);
  for(const track of tracks) write(root,track,'AUDIO_FIXTURE');
  write(root,'site-audio.js','export const TRACKS = ['+tracks.map(file=>`{file:'${file}'}`).join(',')+'];');
  for(const n of [1,2,3]) write(root,`raven/terminal-preview/raven-17/part-${n}/index.html`,'EPISODE_FIXTURE');
}
function commit(repo) {
  git(repo,['add','--all']);git(repo,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','Fictional public deployment fixture']);
  return git(repo,['rev-parse','HEAD']).toString().trim();
}
function fixture(t) {
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'raven render $(literal) '));
  t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));
  git(repo,['init','--object-format=sha1']);publicFiles(repo);
  write(repo,'docs/review.txt','HISTORICAL_REVIEW_NOT_RUNTIME');
  return {repo,sha:commit(repo)};
}
function previousExport(repo) {
  const target=path.join(repo,'.render-site');
  write(target,EXPORT_MARKER,JSON.stringify({format:'raven-render-site-v1',commit:'a'.repeat(40),release:'previous'}));
  write(target,'original.txt','KEEP_PREVIOUS_EXACT_BYTES');return target;
}
function assertPrevious(target) {
  assert.equal(fs.readFileSync(path.join(target,'original.txt'),'utf8'),'KEEP_PREVIOUS_EXACT_BYTES');
  assert.equal(JSON.parse(fs.readFileSync(path.join(target,EXPORT_MARKER))).release,'previous');
}
const filesystem=overrides=>new Proxy(fs,{get(object,key){return Object.hasOwn(overrides,key)?overrides[key]:object[key];}});

test('export comes from the exact Git tree, ignores dirty source/untracked secrets, and validates 13 tracks and three episodes',t=>{
  const f=fixture(t),old=previousExport(f.repo);
  write(f.repo,'raven/deleted-name/play/app.js','DIRTY_MAIN_SOURCE_SENTINEL');
  write(f.repo,'private-untracked.json','UNTRACKED_SECRET_SENTINEL');
  const calls=[];
  const result=buildSite({repo:f.repo,commit:f.sha,run(program,args,options){calls.push({program,args});return run(program,args,options);}});
  assert.equal(result.commit,f.sha);assert.equal(result.directory,old);
  assert.equal(fs.readFileSync(path.join(old,'raven/deleted-name/play/app.js'),'utf8'),'PUBLIC_FILE');
  assert.equal(fs.existsSync(path.join(old,'private-untracked.json')),false);
  assert.equal(fs.existsSync(path.join(old,'.git')),false);
  assert.equal(fs.existsSync(path.join(old,'docs')),false);
  assert.equal(fs.existsSync(path.join(old,'original.txt')),false);
  assert.equal(validatePublicExport(old).musicTracks,13);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(old,EXPORT_MARKER))),{format:'raven-render-site-v1',commit:f.sha,release:PUBLIC_RELEASE});
  assert.equal(calls.filter(call=>call.program==='git' && call.args[1]==='archive').length,1);
  assert.equal(calls.some(call=>call.program==='sh'||call.program==='bash'),false);
  assert.equal(fs.readdirSync(f.repo).some(name=>name.startsWith('.render-build-')),false);
});

test('missing pinned commit fetches that exact SHA only, never a floating gh-pages fallback',t=>{
  const origin=fixture(t),repo=fs.mkdtempSync(path.join(os.tmpdir(),'raven-fetch-'));
  t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));git(repo,['init','--object-format=sha1']);git(repo,['remote','add','origin',origin.repo]);
  const calls=[];
  const result=buildSite({repo,commit:origin.sha,run(program,args,options){calls.push({program,args});return run(program,args,options);}});
  assert.equal(result.commit,origin.sha);
  assert.deepEqual(calls.filter(call=>call.args[1]==='fetch').map(call=>call.args),[['--no-replace-objects','fetch','--no-tags','--depth=1','origin',origin.sha]]);
});

test('a checkout without a Git remote, as on Render, fetches the pinned SHA from the public repository',t=>{
  const origin=fixture(t),repo=fs.mkdtempSync(path.join(os.tmpdir(),'raven-noremote-'));
  t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));git(repo,['init','--object-format=sha1']);
  const calls=[];
  const result=buildSite({repo,commit:origin.sha,source:origin.repo,run(program,args,options){calls.push({program,args});return run(program,args,options);}});
  assert.equal(result.commit,origin.sha);
  assert.deepEqual(calls.filter(call=>call.args[1]==='fetch').map(call=>call.args),[['--no-replace-objects','fetch','--no-tags','--depth=1',origin.repo,origin.sha]]);
});
test('failed Git fetch/archive or mismatched SHA leaves the previous export untouched',t=>{
  for(const failure of ['fetch','archive','revision']) {
    const f=fixture(t),target=previousExport(f.repo);
    assert.throws(()=>buildSite({repo:f.repo,commit:f.sha,run(program,args,options){
      if(program==='git' && failure==='fetch' && ['cat-file','fetch'].includes(args[1])) throw new Error('network failed');
      if(program==='git' && failure==='archive' && args[1]==='archive') throw new Error('archive failed');
      if(program==='git' && failure==='revision' && args[1]==='rev-parse') return Buffer.from('b'.repeat(40)+'\n');
      return run(program,args,options);
    }}),error=>['public_export_failed','public_commit_mismatch'].includes(error.code));
    assertPrevious(target);assert.equal(fs.existsSync(path.join(f.repo,'.render-site.build-lock')),false);
  }
});

test('Git replacement refs cannot substitute another tree under the pinned commit label',t=>{
  const f=fixture(t);
  write(f.repo,'raven/deleted-name/play/app.js','REPLACEMENT_TREE_SENTINEL');
  const replacement=commit(f.repo);
  git(f.repo,['replace',f.sha,replacement]);
  assert.equal(git(f.repo,['show',`${f.sha}:raven/deleted-name/play/app.js`]).toString(),'REPLACEMENT_TREE_SENTINEL');
  const result=buildSite({repo:f.repo,commit:f.sha});
  assert.equal(fs.readFileSync(path.join(result.directory,'raven/deleted-name/play/app.js'),'utf8'),'PUBLIC_FILE');
});

test('wrong release, missing files, fourteen tracks, mismatched playlist and missing episodes fail before publication',t=>{
  const mutations=[
    root=>write(root,'raven/release.json',JSON.stringify({...metadata,release:'unreviewed'})),
    root=>fs.rmSync(path.join(root,'raven/deleted-name/play/app.js')),
    root=>fs.rmSync(path.join(root,'raven/terminal-preview/assets/hero-poster.jpg')),
    root=>fs.rmSync(path.join(root,'raven/terminal-preview/assets/hero-loop.mp4')),
    root=>write(root,'assets/audio/raven/14.mp3','FOURTEENTH'),
    root=>write(root,'site-audio.js','export const TRACKS=[];'),
    root=>fs.rmSync(path.join(root,'raven/terminal-preview/raven-17/part-3'),{recursive:true}),
  ];
  for(const mutate of mutations) {
    const f=fixture(t);mutate(f.repo);const sha=commit(f.repo),target=previousExport(f.repo);
    assert.throws(()=>buildSite({repo:f.repo,commit:sha}),error=>['public_release_mismatch','invalid_public_export','music_inventory_mismatch','music_playlist_mismatch','episode_inventory_mismatch'].includes(error.code));
    assertPrevious(target);
  }
});

test('Git symlinks, submodules and private files never reach extraction or replace the previous site',t=>{
  for(const type of ['symlink','submodule','private']) {
    const f=fixture(t);
    if(type==='symlink') fs.symlinkSync('/etc/passwd',path.join(f.repo,'raven/public-link'));
    if(type==='submodule') git(f.repo,['update-index','--add','--cacheinfo',`160000,${f.sha},raven/external-component`]);
    if(type==='private') write(f.repo,'raven/private/raven-case-content.json','MUST_NOT_EXPORT');
    const sha=type==='submodule' ? (git(f.repo,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','Submodule fixture']),git(f.repo,['rev-parse','HEAD']).toString().trim()) : commit(f.repo);
    const target=previousExport(f.repo);let extracted=false;
    assert.throws(()=>buildSite({repo:f.repo,commit:sha,run(program,args,options){if(program==='tar') extracted=true;return run(program,args,options);}}),error=>['unsafe_git_tree','private_file_in_public_tree'].includes(error.code));
    assert.equal(extracted,false);assertPrevious(target);
  }
});

test('failed publication restores the previous directory; failed rollback preserves it in a reported recovery directory',t=>{
  for(const failRollback of [false,true]) {
    const f=fixture(t),target=previousExport(f.repo);
    const files=filesystem({renameSync(from,to){
      if(path.basename(from)==='site' && to===target) throw new Error('publication failed');
      if(failRollback && path.basename(from)==='previous' && to===target) throw new Error('rollback unavailable');
      return fs.renameSync(from,to);
    }});
    let failure;try{buildSite({repo:f.repo,commit:f.sha,files});}catch(error){failure=error;}
    assert.ok(failure);
    if(failRollback) {assert.equal(failure.code,'export_restore_required');assertPrevious(failure.recoveryDirectory);}
    else {assert.equal(failure.code,'public_export_failed');assertPrevious(target);}
  }
});

test('an existing lock, unowned target or destination symlink is preserved and refused',t=>{
  for(const kind of ['lock','unowned','symlink']) {
    const f=fixture(t),target=path.join(f.repo,'.render-site');
    if(kind==='lock') {previousExport(f.repo);fs.mkdirSync(path.join(f.repo,'.render-site.build-lock'));write(f.repo,'.render-site.build-lock/owner','EXISTING_LOCK');}
    if(kind==='unowned') write(target,'original.txt','KEEP_PREVIOUS_EXACT_BYTES');
    if(kind==='symlink') fs.symlinkSync(f.repo,target,'dir');
    assert.throws(()=>buildSite({repo:f.repo,commit:f.sha}),fails({lock:'build_locked',unowned:'unowned_export_destination',symlink:'unsafe_export_destination'}[kind]));
    if(kind==='lock') {assertPrevious(target);assert.equal(fs.readFileSync(path.join(f.repo,'.render-site.build-lock/owner'),'utf8'),'EXISTING_LOCK');}
    if(kind==='unowned') assert.equal(fs.readFileSync(path.join(target,'original.txt'),'utf8'),'KEEP_PREVIOUS_EXACT_BYTES');
    if(kind==='symlink') assert.equal(fs.lstatSync(target).isSymbolicLink(),true);
  }
});

test('cleanup failure after successful publication retains the previous build and still reports the validated new export',t=>{
  const f=fixture(t);previousExport(f.repo);
  const files=filesystem({rmSync(name,options){if(path.basename(name).startsWith('.render-build-')) throw new Error('cleanup denied');return fs.rmSync(name,options);}});
  const result=buildSite({repo:f.repo,commit:f.sha,files});
  assert.ok(result.cleanupDirectory);assert.equal(validatePublicExport(result.directory).release,PUBLIC_RELEASE);
  assertPrevious(path.join(result.cleanupDirectory,'previous'));
});
