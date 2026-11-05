import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The help box is static markup; this keeps it word-for-word equal to Mati's text pack.
const pack = JSON.parse(fs.readFileSync(new URL('../src/player_help_texts_bilingual_v1.0.0.json', import.meta.url), 'utf8'));
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const box = html.match(/<section id="player-help"[\s\S]*?<\/section>/)?.[0];
const text = pattern => [...box.matchAll(pattern)].map(match => match[1]);

test('the help box exists once, between the log and the question field', () => {
  assert.ok(box, 'player-help section missing');
  assert.equal(html.match(/id="player-help"/g).length, 1);
  const at = id => html.indexOf(`id="${id}"`);
  assert.ok(at('log') < at('player-help') && at('player-help') < at('input'));
});

test('the help box shows the Arabic texts of the pack verbatim and in order', () => {
  assert.deepEqual(text(/<h2[^>]*>([^<]*)<\/h2>/g), [pack.help_title.ar]);
  assert.deepEqual(text(/<p>([^<]*)<\/p>/g), [pack.help_intro.ar]);
  assert.deepEqual(text(/<li>([^<]*)<\/li>/g), pack.help_steps.map(step => step.ar));
  assert.deepEqual(text(/<p class="hint">([^<]*)<\/p>/g), [pack.question_hint.ar]);
});

test('every entry in the pack has both Arabic and English', () => {
  for (const entry of [pack.help_title, pack.help_intro, ...pack.help_steps, pack.question_hint]) {
    assert.equal(typeof entry.ar, 'string');
    assert.equal(typeof entry.en, 'string');
    assert.ok(entry.ar.trim() && entry.en.trim());
  }
});
