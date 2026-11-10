// RAVEN staged music migration guard.
// While source media is unavailable, the published player must use the 13 existing MP3 files.
// Run: node tests/music-replacement-manifest.mjs [--require-media]
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'raven/music-replacement/manifest.json'), 'utf8'));
const release = JSON.parse(readFileSync(join(root, 'raven/release.json'), 'utf8'));
const player = readFileSync(join(root, 'site-audio.js'), 'utf8');
const pending = manifest.status === 'pending-media-and-audio-deduplication';
const proposedCount = (player.match(/file: 'assets\\/audio\\/raven-replacement\\//g) || []).length;
const oldCount = (player.match(/file: 'assets\\/audio\\/raven\\/\\d+\\.mp3'/g) || []).length;

assert.equal(manifest.tracks.length, 17, 'initial candidate count (not audio-deduplicated)');
if (pending) {
  assert.equal(release.musicTracks, 13, 'keep existing 13 songs live until new media is verified');
  assert.equal(oldCount, 13, 'published player must use existing audio files');
  assert.equal(proposedCount, 0, 'published player cannot reference pending audio files');
} else {
  assert.equal(release.musicTracks, manifest.tracks.length, 'release count must match verified playlist');
  assert.equal(proposedCount, manifest.tracks.length, 'published player must contain verified songs');
}
const requireMedia = process.argv.includes('--require-media') || !pending;
const targets = new Set();
for (const [index, track] of manifest.tracks.entries()) {
  assert.equal(track.order, index + 1, 'track order must be contiguous');
  assert.match(track.source_mp4, /^\\d+\\.mp4$/);
  assert.match(track.target_mp3, /^assets\\/audio\\/raven-replacement\\/\\d+\\.mp3$/);
  assert.ok(!targets.has(track.target_mp3), 'duplicate target path');
  targets.add(track.target_mp3);
  if (!pending) assert.ok(player.includes("file: '" + track.target_mp3 + "'"), 'playlist missing ' + track.target_mp3);
  if (requireMedia) {
    const dest = join(root, track.target_mp3);
    assert.ok(existsSync(dest), 'missing soundtrack file ' + track.target_mp3);
    assert.ok(statSync(dest).size > 4096, 'soundtrack file too small ' + track.target_mp3);
  }
}
console.log('RAVEN music: ' + (pending ? '17 candidate replacements staged; 13 playable songs remain published' : 'verified replacement playlist') +
  (requireMedia ? '; audio files checked' : '; no new audio released'));
