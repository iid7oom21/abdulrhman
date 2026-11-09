// RAVEN soundtrack replacement QA. Run: node tests/music-replacement-manifest.mjs [--require-media]
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'raven/music-replacement/manifest.json'), 'utf8'));
const player = readFileSync(join(root, 'site-audio.js'), 'utf8');
const release = JSON.parse(readFileSync(join(root, 'raven/release.json'), 'utf8'));
assert.equal(manifest.tracks.length, 17, 'expected 17 candidate names');
assert.equal(release.musicTracks, manifest.tracks.length, 'release track count');
const files = new Set();
for (const [index, track] of manifest.tracks.entries()) {
  assert.equal(track.order, index + 1, 'manifest order must be contiguous');
  assert.match(track.source_mp4, /^\d+\.mp4$/);
  assert.match(track.target_mp3, /^assets\/audio\/raven-replacement\/\d+\.mp3$/);
  assert.ok(!files.has(track.target_mp3), 'duplicate target path');
  files.add(track.target_mp3);
  assert.ok(player.includes("file: '" + track.target_mp3 + "'"), 'playlist missing ' + track.target_mp3);
  if (process.argv.includes('--require-media')) {
    const dest = join(root, track.target_mp3);
    assert.ok(existsSync(dest), 'missing audio ' + track.target_mp3);
    assert.ok(statSync(dest).size > 4096, 'audio too small ' + track.target_mp3);
  }
}
assert.equal((player.match(/file: 'assets\/audio\/raven-replacement\//g) || []).length, manifest.tracks.length);
console.log('RAVEN playlist manifest verified: ' + manifest.tracks.length + ' tracks' +
  (process.argv.includes('--require-media') ? ' with media files' : ' (manifest/code only; media not checked)'));
