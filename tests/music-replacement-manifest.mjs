// RAVEN staged soundtrack migration guard.
// Until new media files are uploaded and verified, the live player must use the existing 13 songs.
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
const liveFiles = [...player.matchAll(/file: '([^']+)'/g)].map(match => match[1]);
const oldCount = liveFiles.filter(file => file.startsWith('assets/audio/raven/')).length;
const proposedCount = liveFiles.filter(file => file.startsWith('assets/audio/raven-replacement/')).length;

assert.equal(manifest.tracks.length, 17, 'original candidate count before audio-deduplication');
if (pending) {
  assert.equal(release.musicTracks, 13, 'keep 13 existing songs live while replacement is pending');
  assert.equal(oldCount, 13, 'the live player must reference existing audio');
  assert.equal(proposedCount, 0, 'the live player must not reference unpublished audio');
} else {
  assert.equal(release.musicTracks, manifest.tracks.length, 'the release count must match verified media');
  assert.equal(proposedCount, manifest.tracks.length, 'the player must list verified files');
}

const requireMedia = process.argv.includes('--require-media') || !pending;
const paths = new Set();
for (const [index, track] of manifest.tracks.entries()) {
  assert.equal(track.order, index + 1, 'track order must be contiguous');
  assert.ok(track.source_mp4.endsWith('.mp4'), 'source must be MP4');
  assert.ok(track.target_mp3.startsWith('assets/audio/raven-replacement/') && track.target_mp3.endsWith('.mp3'), 'target must be MP3 in replacement directory');
  assert.ok(!paths.has(track.target_mp3), 'target paths must be unique');
  paths.add(track.target_mp3);
  if (!pending) assert.ok(liveFiles.includes(track.target_mp3), 'the player must reference ' + track.target_mp3);
  if (requireMedia) {
    const dest = join(root, track.target_mp3);
    assert.ok(existsSync(dest), 'missing audio file: ' + track.target_mp3);
    assert.ok(statSync(dest).size > 4096, 'audio file too small: ' + track.target_mp3);
  }
}
console.log(pending
  ? 'RAVEN replacement audio pending: 17 candidates staged; the original 13-song playlist remains active'
  : 'RAVEN replacement playlist checked: ' + manifest.tracks.length + ' tracks');
