// The staged RAVEN soundtrack is NOT live until all 32 AAC/M4A media files exist.
// node tests/music-replacement-manifest.mjs --require-media
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'raven/music-replacement/manifest.json'), 'utf8'));
const release = JSON.parse(readFileSync(join(root, 'raven/release.json'), 'utf8'));
const player = readFileSync(join(root, 'site-audio.js'), 'utf8');
const liveFiles = [...player.matchAll(/file: '([^']+)'/g)].map(m => m[1]);
const pending = manifest.audio_file_upload_required === true;
const checkMedia = process.argv.includes('--require-media') || !pending;
const newFiles = liveFiles.filter(x => x.startsWith('assets/audio/raven-replacement/'));
const originalFiles = liveFiles.filter(x => x.startsWith('assets/audio/raven/'));

assert.equal(manifest.tracks.length, 32, '32 staged source files');
assert.equal(manifest.removed_exact_duplicates.length, 1, 'one exact byte-duplicate excluded');
if (pending) {
  assert.equal(release.musicTracks, 13, 'keep the working original release live until new media is uploaded');
  assert.equal(originalFiles.length, 13, '13 original MP3 files should be referenced');
  assert.equal(newFiles.length, 0, 'incomplete soundtrack must never be published');
} else {
  assert.equal(release.musicTracks, 32, 'activated soundtrack must contain 32 tracks');
  assert.equal(originalFiles.length, 0, 'replace old track references after successful upload');
  assert.equal(newFiles.length, 32, '32 hosted audio files must be referenced');
}

const names = new Set();
for (const [index, track] of manifest.tracks.entries()) {
  assert.equal(track.order, index + 1, 'track order');
  assert.ok(track.source_mp4.endsWith('.mp4'), 'source must be MP4');
  assert.ok(track.target_m4a.startsWith('assets/audio/raven-replacement/'), 'new audio path');
  assert.ok(track.target_m4a.endsWith('.m4a'), 'preserve AAC stream in M4A container');
  assert.ok(!names.has(track.target_m4a), 'no duplicate path');
  names.add(track.target_m4a);
  if (!pending) assert.equal(newFiles[index], track.target_m4a, 'published track order');
  if (checkMedia) {
    const file = join(root, track.target_m4a);
    assert.ok(existsSync(file), 'missing required audio asset: ' + track.target_m4a);
    assert.ok(statSync(file).size > 4096, 'audio file empty: ' + track.target_m4a);
  }
}
console.log(pending
 ? 'RAVEN: 13 original tracks live; 32 replacement tracks staged (NOT PUBLISHED)'
 : 'RAVEN: 32 replacement tracks active and media checked');
