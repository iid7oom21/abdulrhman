import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const dir=new URL('../public/texts/',import.meta.url);
test('approved text pack is identical in its standalone sections and executable browser bundle',()=>{
 const pack=JSON.parse(fs.readFileSync(new URL('raven_all_texts_bilingual_merged_v1.0.1.json',dir),'utf8'));
 for(const key of ['player_help_texts_bilingual_v1.0.0','music_player_texts_bilingual_v1.0.0_8songs','dialogue_status_texts_bilingual_v1.0.1'])assert.deepEqual(JSON.parse(fs.readFileSync(new URL(key+'.json',dir),'utf8')),pack[key]);
 const context={window:{}};vm.runInNewContext(fs.readFileSync(new URL('raven-texts.js',dir),'utf8'),context);
 assert.deepEqual(JSON.parse(JSON.stringify(context.window.RAVEN_ALL_TEXTS_BILINGUAL_MERGED)),pack);
});
