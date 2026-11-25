import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inventory,validateInventory} from '../scripts/workshop-inventory.mjs';
import {catalog} from '../raven/after-show/workshops.js';
import {activities,extras} from '../raven/late-night/catalog.js';
import {items} from '../raven/late-night/ink/catalog.js';

test('the adapters follow the actual bilingual indexes and all legacy entry buttons',async()=>{
  const result=await inventory(),rows=result.entries;
  const keys=space=>rows.filter(row=>row.catalog===space).map(row=>row.id.split(':')[1]).sort();
  assert.deepEqual(keys('ink'),items.map(item=>item.page).sort());
  assert.deepEqual(keys('after-show'),Object.keys(catalog).sort());
  assert.deepEqual(keys('late-night'),[...activities,...extras].map(item=>item[0]).sort());
  const html=await readFile(new URL('../raven/after-show-25/index.html',import.meta.url),'utf8');
  assert.deepEqual(keys('after-show-25'),[...html.matchAll(/href="\.\/([\w-]+)\.html"/g)].map(m=>m[1]).sort());
  const legacy=rows.find(row=>row.id==='after-show-25:01-last-send');
  assert.deepEqual(legacy.languages,['ar']);assert.equal(legacy.state,'legacy-interactive');
  assert.deepEqual(legacy.links,['raven/after-show-25/02-shift.html']);
  assert.deepEqual(rows.find(row=>row.id==='ink:ink-page').exports,['PNG']);
  assert.equal(rows.find(row=>row.id==='after-show:edit').estimatedMinutes,catalog.edit[6]);
  assert.match(rows.find(row=>row.id==='ink:ink-page').durationSource,/estimate/);
  assert.ok(rows.every(row=>/^[a-f\d]{12}$/.test(row.version)));
  assert.ok(result.overlaps.some(x=>[x.left,x.right].includes(legacy.id)&&[x.left,x.right].includes('after-show:edit')));
  assert.deepEqual(await inventory(),result);
});
test('duplicate identities, missing files and invalid or external references fail the audit',async()=>{
  const {entries}=await inventory(),row=entries.find(r=>r.id==='ink:ink-page');
  for(const [items,why] of [
    [[row,row],/Duplicate id/],[[row,{...row,id:'ink:new'}],/Duplicate path/],
    [[{...row,art:'raven/missing-workshop-poster.webp'}],/Broken reference/],
    [[{...row,related:['ink:missing']}],/Missing related/],
    [[{...row,links:['https:\/\/example.invalid\/absent']}],/Outside site/],
    [[{...row,type:'proposal'}],/Invalid metadata/]
  ]) await assert.rejects(()=>validateInventory(items),why);
});
