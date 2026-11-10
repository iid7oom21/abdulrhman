// Soundtrack migration validation: staging branch may have no media; release requires --require-media.
// node tests/music-replacement-manifest.mjs --require-media
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'raven/music-replacement/manifest.json'), 'utf8'));
const release = JSON.parse(readFileSync(join(root, 'raven/release.json'), 'utf8'));
const player = readFileSync(join(root, 'site-audio.js'), 'utf8');
const requireMedia = process.argv.includes('--require-media');
const sourceNames = new Set();
const targetNames = new Set();
const playlist = [...player.matchAll(/file: '([^']+)'/g)].map(match => match[1]);

assert.equal(manifest.tracks.length, 26, '26 audio-distinct candidates expected after exact byte deduplication');
assert.equal(release.musicTracks, 26, 'staged release must describe 26 songs');
assert.equal(playlist.length, 26, 'player must display 26 songs');
assert.equal(playlist.filter(file => file.endsWith('.m4a')).length, 26, 'player must serve M4A / native AAC');
assert.equal(manifest.audio_file_upload_required, true, 'uploads are required before release');
for (const [index, track] of manifest.tracks.entries()) {
  assert.equal(track.order, index + 1, 'track order is contiguous');
  assert.ok(track.source_mp4.endsWith('.mp4'), 'source file must be MP4');
  assert.ok(track.target_m4a.startsWith('assets/audio/raven-replacement/'), 'target path is within replacement folder');
  assert.ok(track.target_m4a.endsWith('.m4a'), 'target must be M4A');
  assert.ok(!sourceNames.has(track.source_mp4), 'no repeated source name');
  assert.ok(!targetNames.has(track.target_m4a), 'no repeated target name');
  sourceNames.add(track.source_mp4);
  targetNames.add(track.target_m4a);
  assert.equal(playlist[index], track.target_m4a, 'playlist order must match manifest');
  if (requireMedia) {
    const fullPath = join(root, track.target_m4a);
    assert.ok(existsSync(fullPath), 'audio file not present: ' + track.target_m4a);
    assert.ok(statSync(fullPath).size > 4096, 'invalid audio size: ' + track.target_m4a);
  }
}
assert.equal(manifest.removed_exact_duplicates.length, 1);
console.log('RAVEN music validated: 26 M4A song references' +
  (requireMedia ? ' with media assets' : ' (staging references only; NOT safe to publish)'));
