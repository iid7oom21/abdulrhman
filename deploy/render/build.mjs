#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const SITE_COMMIT = '8fb45b01bc8a5feb0d6d33f9636dfe84020f8895';
export const PUBLIC_RELEASE = '2026-11-12-case-play-2';
export const EXPORT_MARKER = '.raven-render-export.json';
// Render builds from a shallow, single-branch checkout and removes its Git
// remote, so a missing pinned commit is fetched from here by its SHA.
export const PUBLIC_REPOSITORY = 'https://github.com/iid7oom21/abdulrhman.git';
const FORMAT = 'raven-render-site-v1';
const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TRACKS = Array.from({length:13}, (_, index) => `${String(index + 1).padStart(2,'0')}.mp3`);
const EPISODES = ['part-1','part-2','part-3'];
// Public runtime roots only: do not package historical review documents, tests,
// repository metadata or any private delivery alongside the website.
const PUBLIC_ROOTS = ['assets','fourth-signature','raven','studio','404.html','index.html',
  'player-core.js','robots.txt','site-audio.js','site-bridge.js','site-entry.js','site-player.css',
  'site-player.js','sitemap.xml'];
export const CORE_FILES = [
  'site-player.js','site-audio.js','site-entry.js','site-bridge.js','site-player.css',
  'assets/texts/raven-texts.js','raven/index.html','raven/content.html',
  'raven/deleted-name/index.html','raven/deleted-name/content.html',
  'raven/deleted-name/reading-tools.js','raven/deleted-name/case-entry.js',
  'raven/deleted-name/play/index.html','raven/deleted-name/play/content.html',
  'raven/deleted-name/play/app.js','raven/deleted-name/play/style.css',
  'raven/assets/raven-homepage-v6.css','raven/terminal-preview/raven-17/index.html',
  'raven/terminal-preview/assets/hero-poster.jpg',
  'raven/terminal-preview/assets/hero-loop.mp4',
  'raven/assets/images/deleted-name/claire.jpg',
  'raven/assets/images/deleted-name/jonas.jpg',
  'raven/assets/images/deleted-name/mateo.jpg',
  'raven/assets/images/deleted-name/noah.jpg',
  'raven/assets/images/deleted-name/elena.jpg',
  'raven/assets/images/deleted-name/evidence_table.jpg',
  'raven/assets/favicon.svg',
  'raven/deleted-name/assets/characters/cast-portraits-v1.webp',
  'raven/deleted-name/assets/scenes/case-investigation-v2.webp',
  'raven/deleted-name/assets/scenes/case-tools-v1.webp',
];
export class RenderBuildError extends Error {
  constructor(code, recoveryDirectory) { super(code); this.code = code; if (recoveryDirectory) this.recoveryDirectory = recoveryDirectory; }
}
const check = (condition, code) => { if (!condition) throw new RenderBuildError(code); };
const sameFile = (one, two) => one.dev === two.dev && one.ino === two.ino;
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const sameList = (actual, expected) => JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
const command = (program, args, {cwd}) => execFileSync(program,args,{
  cwd,shell:false,stdio:['ignore','pipe','pipe'],maxBuffer:8 * 1024 * 1024,
  env:{...process.env,GIT_TERMINAL_PROMPT:'0'},
});
const exists = (files, name) => { try { return files.lstatSync(name); } catch (error) { if(error.code==='ENOENT') return null; throw error; } };
function ordinaryFile(files, root, relative) {
  let current=root;
  for (const part of relative.split('/')) {
    current=path.join(current,part); const info=files.lstatSync(current);
    check(!info.isSymbolicLink(),'unsafe_export');
  }
  const info=files.lstatSync(current);
  check(info.isFile() && info.size > 0,'missing_public_file'); return current;
}

export function validatePublicExport(root, {files=fs, release=PUBLIC_RELEASE} = {}) {
  try {
    const rootInfo=files.lstatSync(root);
    check(rootInfo.isDirectory() && !rootInfo.isSymbolicLink() && files.realpathSync(root)===path.resolve(root),'unsafe_export');
    const metadata=JSON.parse(files.readFileSync(ordinaryFile(files,root,'raven/release.json'),'utf8'));
    check(plain(metadata) && sameList(Object.keys(metadata),[
      'release','interfaceVersion','caseApiVersion','publicMode','storyIncludedInPublicBundle',
      'providerCallsRequired','musicTracks','raven17Episodes','languages',
    ]) && metadata.release===release && metadata.interfaceVersion==='case-play-2' &&
      metadata.caseApiVersion===1 && metadata.publicMode==='static-site-with-optional-written-case-server' &&
      metadata.storyIncludedInPublicBundle===false && metadata.providerCallsRequired===false &&
      metadata.musicTracks===13 && metadata.raven17Episodes===3 &&
      Array.isArray(metadata.languages) && sameList(metadata.languages,['ar','en']),'public_release_mismatch');
    for (const relative of CORE_FILES) ordinaryFile(files,root,relative);
    const audio='assets/audio/raven';
    check(sameList(files.readdirSync(path.join(root,audio)).filter(name=>/\.mp3$/i.test(name)),TRACKS),'music_inventory_mismatch');
    for (const track of TRACKS) ordinaryFile(files,root,`${audio}/${track}`);
    // Read the reviewed literal playlist without executing any public JavaScript.
    const playlist=files.readFileSync(path.join(root,'site-audio.js'),'utf8');
    const listed=[...playlist.matchAll(/\bfile\s*:\s*(['"])(assets\/audio\/raven\/\d+\.mp3)\1/g)].map(match=>match[2]);
    check(sameList(listed,TRACKS.map(track=>`${audio}/${track}`)),'music_playlist_mismatch');
    const episodes='raven/terminal-preview/raven-17';
    check(sameList(files.readdirSync(path.join(root,episodes)).filter(name=>/^part-\d+$/.test(name)),EPISODES),'episode_inventory_mismatch');
    for (const episode of EPISODES) ordinaryFile(files,root,`${episodes}/${episode}/index.html`);
    return metadata;
  } catch (error) {
    if(error instanceof RenderBuildError) throw error;
    throw new RenderBuildError('invalid_public_export');
  }
}

function validateTree(bytes) {
  const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  check(decoded.endsWith('\0'),'unsafe_git_tree');
  const seen=new Set();
  for (const record of decoded.slice(0,-1).split('\0')) {
    const match=/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(record);
    check(match,'unsafe_git_tree');
    const name=match[3],parts=name.split('/');
    check(!seen.has(name) && !name.includes('\\') && !/[\x00-\x1f\x7f]/.test(name) &&
      parts.every(part=>part!=='' && part!=='.' && part!=='..' && part!=='.git'),'unsafe_git_tree');
    check(!parts.some(part=>/^(?:private|author|saves|server)$/i.test(part) || /^PRIVATE-/i.test(part) || /^\.env(?:\.|$)/.test(part) || /^(?:raven-case-content\.json|case-store\.json(?:\.lock)?)$/i.test(part)), 'private_file_in_public_tree');
    check(name!==EXPORT_MARKER,'reserved_export_marker');
    seen.add(name);
  }
  check(seen.size>0 && seen.size<=20000,'unsafe_git_tree');
  return [...new Set([...seen].map(name=>name.split('/')[0]))].sort();
}
function ownedExport(files, directory) {
  const info=exists(files,directory);
  if(!info) return null;
  check(info.isDirectory() && !info.isSymbolicLink(),'unsafe_export_destination');
  try {
    const marker=JSON.parse(files.readFileSync(ordinaryFile(files,directory,EXPORT_MARKER),'utf8'));
    check(plain(marker) && marker.format===FORMAT && /^[a-f0-9]{40}$/.test(marker.commit) && typeof marker.release==='string','unowned_export_destination');
  } catch { throw new RenderBuildError('unowned_export_destination'); }
  return info;
}

// Injection is for local tests. CLI always uses the pinned public commit above;
// no environment override can silently select a floating branch or source tree.
export function buildSite({repo=MODULE_ROOT,files=fs,run=command,commit=SITE_COMMIT,release=PUBLIC_RELEASE,source=PUBLIC_REPOSITORY} = {}) {
  check(/^[a-f0-9]{40}$/.test(commit),'invalid_public_commit');
  repo=path.resolve(repo);
  check(files.realpathSync(repo)===repo && files.lstatSync(repo).isDirectory(),'unsafe_repository');
  const target=path.join(repo,'.render-site'),lock=path.join(repo,'.render-site.build-lock');
  let staging,stagingInfo,lockInfo,backup,backupExists=false,published=false,keepStaging=false;
  const removeStaging=()=>{
    const current=files.lstatSync(staging);
    check(current.isDirectory() && !current.isSymbolicLink() && sameFile(stagingInfo,current),'staging_replaced');
    files.rmSync(staging,{recursive:true,force:true});
  };
  try {
    const original=ownedExport(files,target);
    try { files.mkdirSync(lock,{mode:0o700}); lockInfo=files.lstatSync(lock); }
    catch { throw new RenderBuildError('build_locked'); }
    // Ignore local replace refs: a commit label must identify its actual tree.
    const git=args=>run('git',['--no-replace-objects',...args],{cwd:repo});
    let present=true;
    try { git(['cat-file','-e',`${commit}^{commit}`]); } catch { present=false; }
    if(!present) {
      // Prefer the checkout's own remote. Without one (as on Render), fetch the
      // pinned SHA from the public repository; rev-parse below still requires the
      // fetched object to be exactly that commit, so no other tree can enter.
      let remote='origin';
      try { git(['remote','get-url','origin']); } catch { remote=source; }
      git(['fetch','--no-tags','--depth=1',remote,commit]);
    }
    check(git(['rev-parse','--verify',`${commit}^{commit}`]).toString().trim()===commit,'public_commit_mismatch');
    const roots=validateTree(git(['ls-tree','-r','-z','--full-tree',commit,'--',...PUBLIC_ROOTS]));
    staging=files.mkdtempSync(path.join(repo,'.render-build-'));
    stagingInfo=files.lstatSync(staging);
    const next=path.join(staging,'site'),archive=path.join(staging,'public-site.tar');
    backup=path.join(staging,'previous');files.mkdirSync(next,{mode:0o755});
    git(['archive','--format=tar',`--output=${archive}`,commit,'--',...roots]);
    run('tar',['--extract','--file',archive,'--directory',next,'--no-same-owner','--no-same-permissions'],{cwd:repo});
    validatePublicExport(next,{files,release});
    files.writeFileSync(path.join(next,EXPORT_MARKER),JSON.stringify({format:FORMAT,commit,release})+'\n',{flag:'wx',mode:0o644});
    const latest=ownedExport(files,target);
    check(original ? latest && sameFile(original,latest) : !latest,'export_changed_during_build');
    if(original) { files.renameSync(target,backup);backupExists=true; }
    try { files.renameSync(next,target);published=true; }
    catch(error) {
      if(backupExists) {
        try { files.renameSync(backup,target);backupExists=false; }
        catch { keepStaging=true;throw new RenderBuildError('export_restore_required',backup); }
      }
      throw error;
    }
    // POSIX rename publishes the already-validated directory. Cleanup cannot
    // turn this success into a false failed build with a removed old export.
    try { removeStaging();staging=undefined; } catch { keepStaging=true; }
    return {commit,release,directory:target,...(keepStaging ? {cleanupDirectory:staging} : {})};
  } catch(error) {
    if(error instanceof RenderBuildError) throw error;
    throw new RenderBuildError('public_export_failed',keepStaging ? backup : undefined);
  } finally {
    if(staging && !keepStaging && !published) {
      try { removeStaging(); } catch { /* Failed staging is never the live export. */ }
    }
    if(lockInfo) {
      try { if(sameFile(lockInfo,files.lstatSync(lock))) files.rmdirSync(lock); } catch { /* Keep an uncertain lock for operator review. */ }
    }
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const result=buildSite();
    console.log(`RAVEN public export verified: ${result.commit} (${result.release}), 13 tracks, 3 episodes.`);
    if(result.cleanupDirectory) console.warn(`Previous build files retained for cleanup: ${result.cleanupDirectory}`);
  } catch(error) {
    console.error(`RAVEN Render build failed: ${error.code || 'public_export_failed'}`);
    if(error.recoveryDirectory) console.error(`Previous export retained for recovery: ${error.recoveryDirectory}`);
    process.exitCode=1;
  }
}
