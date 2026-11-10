// RAVEN audio staging gate. Never merge while media is absent or manifest is pending.
// node tests/music-replacement-manifest.mjs --static-only
// node tests/music-replacement-manifest.mjs --verify-local   (after unpacking 24 MP3s)
// node tests/music-replacement-manifest.mjs --require-media (release gate)
import {readFileSync,existsSync,statSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const m=JSON.parse(readFileSync(join(root,'raven/music-replacement/manifest.json'),'utf8'));
const release=JSON.parse(readFileSync(join(root,'raven/release.json'),'utf8'));
const player=readFileSync(join(root,'site-audio.js'),'utf8');
const list=[...player.matchAll(/file: '([^']+)'/g)].map(x=>x[1]);
const staticOnly=process.argv.includes('--static-only');
const verifyLocal=process.argv.includes('--verify-local');
assert.equal(m.tracks.length,24,'24 verified distinct audio recordings required');
assert.equal(release.musicTracks,24,'staged release music count must match');
assert.equal(release.raven17Episodes,3,'existing episodes must be retained');
assert.equal(list.length,24,'staged player should list 24 tracks');
assert.equal(new Set(list).size,24,'no duplicate player paths');
const oldDir=join(root,'assets/audio/raven');
if(existsSync(oldDir)){
  for(let i=1;i<=13;i++)assert.ok(existsSync(join(oldDir,String(i).padStart(2,'0')+'.mp3')),'legacy fallback missing');
}
for(const [i,t] of m.tracks.entries()){
  assert.equal(t.order,i+1,'track order');
  assert.ok(/^\\d+\\.mp4$/.test(t.source_mp4),'source filename');
  assert.ok(/^assets\\/audio\\/raven-replacement\\/\\d+\\.mp3$/.test(t.target_mp3),'MP3 path');
  assert.equal(list[i],t.target_mp3,'player manifest ordering');
  assert.ok(Number.isSafeInteger(t.output_bytes)&&t.output_bytes>4096,'expected MP3 size');
  assert.match(t.sha256_mp3,/^[0-9a-f]{64}$/,'expected MP3 SHA-256');
  if(!staticOnly){
    const file=join(root,t.target_mp3);
    assert.ok(existsSync(file),'missing MP3 audio asset: '+t.target_mp3);
    assert.equal(statSync(file).size,t.output_bytes,'MP3 byte size mismatch: '+t.target_mp3);
    const actual=createHash('sha256').update(readFileSync(file)).digest('hex');
    assert.equal(actual,t.sha256_mp3,'MP3 SHA-256 mismatch: '+t.target_mp3);
  }
}
if(!staticOnly&&!verifyLocal){
  assert.equal(m.audio_file_upload_required,false,'BLOCKED: files must be uploaded, retested and explicitly marked ready before merging');
}
console.log('RAVEN soundtrack QA passed: 24 MP3 refs'+(staticOnly?' (metadata only)':verifyLocal?' (verified local files, NOT approved for publish)':' (release gate)'));
