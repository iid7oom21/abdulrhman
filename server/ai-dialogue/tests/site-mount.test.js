import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {createPreviewServer} from '../src/server.js';
import {createOpenAIReply} from '../src/provider.js';
import {_reset} from '../src/dialogue.js';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raven-site-'));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  const root = path.join(dir, 'public'); fs.mkdirSync(root);
  const write = (name, text) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, text); return file; };
  write('raven/index.html', '<!doctype html><iframe src="content.html"></iframe>');
  write('raven/content.html', '<!doctype html><script>window.testReady=true;</script><button onclick="closeEpisodes()">close</button>');
  write('raven/deleted-name/index.html', '<!doctype html><a href="../dialogue/">Dialogue</a>');
  write('site-player.js', 'export const loaded = true;');
  write('assets/audio/raven/01.mp3', '0123456789');
  write('assets/audio/raven/13.mp3', 'TRACK THIRTEEN');
  write('assets/audio/raven/14.mp3', 'NOT PUBLIC');
  // A mounted dialogue must use the server UI, never this simulator or its journal.
  write('raven/dialogue/index.html', '<script src="local-api.js">LOCAL_ONLY_SIMULATOR</script>');
  write('raven/dialogue/local-api.js', 'SECRET_LOCAL_OVERRIDE');
  return {dir, root, write};
}
async function start(t, options = {}) {
  const app = createPreviewServer(options);
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  let closed = false;
  const close = async () => { if (!closed) { closed = true; await new Promise(resolve => app.close(resolve)); } };
  t.after(close);
  return {root:'http://127.0.0.1:' + app.address().port, close};
}
const rawGet = (root, target, cookie) => new Promise((resolve, reject) => {
  const request = http.request(root, {path:target, headers:cookie ? {cookie} : {}}, response => {
    const chunks = []; response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => resolve({status:response.statusCode, body:Buffer.concat(chunks).toString()}));
  }); request.on('error', reject); request.end();
});

test('site mount is opt-in and preserves standalone UI, config and API headers', async t => {
  const s = await start(t);
  const home = await fetch(s.root);
  assert.equal(home.status, 200); assert.equal(home.headers.get('x-frame-options'), 'DENY');
  assert.doesNotMatch(await home.text(), /raven-dialogue-transport/);
  assert.notEqual((await fetch(s.root + '/raven/')).status, 200);
  const config = await fetch(s.root + '/api/config');
  assert.equal(config.headers.get('set-cookie'), null);
  assert.equal(config.headers.get('x-frame-options'), 'DENY');
  assert.equal((await config.json()).sourceKnowledgeAvailable, false);
});

test('hosting can land on RAVEN without creating a preview session or accepting an external redirect', async t => {
  const f = fixture(t), s = await start(t, {siteRoot:f.root,hostedRootRedirect:'/raven/'});
  for (const method of ['GET','HEAD']) for (const target of ['/?lang=en','/index.html?lang=ar']) {
    const response = await fetch(s.root + target, {method,redirect:'manual'});
    assert.equal(response.status,307);
    assert.equal(response.headers.get('location'),'/raven/' + target.slice(target.indexOf('?')));
    assert.equal(response.headers.get('set-cookie'),null);
    assert.equal(await response.text(),'');
  }
  assert.equal((await fetch(s.root + '/raven/')).status,200);
  assert.equal((await fetch(s.root + '/raven/dialogue/')).status,200);
  assert.throws(() => createPreviewServer({hostedRootRedirect:'/raven/'}),/invalid_hosted_root_redirect/);
  assert.throws(() => createPreviewServer({siteRoot:f.root,hostedRootRedirect:'https://example.com/'}),/invalid_hosted_root_redirect/);
});

test('mounted public files are read-only, media ranges work, and only dialogue GET issues a session', async t => {
  const f = fixture(t), s = await start(t, {siteRoot:f.root, secureCookie:true});
  const redirect = await fetch(s.root + '/raven?lang=en', {redirect:'manual'});
  assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/raven/?lang=en');
  const page = await fetch(s.root + '/raven/content.html');
  assert.equal(page.status, 200); assert.equal(page.headers.get('set-cookie'), null);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.equal(page.headers.get('x-frame-options'), 'SAMEORIGIN');
  const csp = page.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self' 'sha256-/); assert.match(csp, /frame-src 'self'/);
  assert.match(csp, /frame-ancestors 'self'/); assert.match(csp, /script-src-attr 'unsafe-hashes' 'sha256-/);
  assert.doesNotMatch(csp.split('script-src ')[1].split(';')[0], /unsafe-inline/);
  assert.equal((await fetch(s.root + '/site-player.js')).headers.get('content-type'), 'text/javascript; charset=utf-8');
  const audio = await fetch(s.root + '/assets/audio/raven/01.mp3', {headers:{range:'bytes=2-5'}});
  assert.equal(audio.status, 206); assert.equal(audio.headers.get('content-range'), 'bytes 2-5/10'); assert.equal(await audio.text(), '2345');
  const suffix = await fetch(s.root + '/assets/audio/raven/01.mp3', {headers:{range:'bytes=-2'}});
  assert.equal(await suffix.text(), '89');
  assert.equal((await fetch(s.root + '/assets/audio/raven/01.mp3', {headers:{range:'bytes=99-'}})).status, 416);
  const head = await fetch(s.root + '/assets/audio/raven/13.mp3', {method:'HEAD',headers:{range:'bytes=99-'}});
  assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), '14'); assert.equal(await head.text(), '');
  assert.equal((await fetch(s.root + '/assets/audio/raven/14.mp3')).status, 404);
  const dialogue = await fetch(s.root + '/raven/dialogue/?mode=local');
  const cookie = dialogue.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; SameSite=Strict; Path=\/; Secure/);
  assert.equal(dialogue.headers.get('cache-control'), 'no-store');
  assert.equal(dialogue.headers.get('x-frame-options'), 'SAMEORIGIN');
  const html = await dialogue.text();
  assert.match(html, /name="raven-dialogue-transport" content="same-origin-server"/);
  assert.match(html, /fetch\('\/api\/config'/); assert.doesNotMatch(html, /local-api\.js|LOCAL_ONLY_SIMULATOR/);
  assert.match(html, /raven_deleted_name_hosted_server_preview_v2/);
  assert.match(html, /raven_deleted_name_hosted_server_material_actions_v1/);
  assert.doesNotMatch(html, /'raven_deleted_name_preview_v2'|'raven_deleted_name_material_actions_v1'/);
  assert.equal((await fetch(s.root + '/raven/dialogue/index.html', {headers:{cookie:cookie.split(';')[0]}})).headers.get('set-cookie'), null);
  assert.equal((await fetch(s.root + '/raven/dialogue/local-api.js')).status, 404);
  const english = await (await fetch(s.root + '/raven/dialogue/?lang=en')).text();
  assert.match(english, /role="note" lang="en" dir="ltr">This technical server preview is currently available in Arabic/);
  assert.match(english, /href="\/raven\/deleted-name\/\?lang=en"/);
  assert.doesNotMatch(html, /This technical server preview is currently available in Arabic/);
  assert.match(await (await fetch(s.root + '/texts/raven-texts.js')).text(), /dialogue_status_texts/);
  assert.match(fs.readFileSync(path.join(f.root, 'raven/dialogue/index.html'), 'utf8'), /LOCAL_ONLY_SIMULATOR/);
});

test('hosted dialogue uses real HTTP recipient context, mocked provider, and durable replay after restart', async t => {
  _reset(); const f = fixture(t), storeFile = path.join(f.dir, 'private-store.json'); let calls = 0;
  const generate = createOpenAIReply({apiKey:'TEST_ONLY',model:'mock',fetchImpl:async (_url, options) => {
    calls++; assert.doesNotMatch(options.body, /PRIVATE_NOTE/);
    assert.deepEqual(JSON.parse(JSON.parse(options.body).input).receivedPlayerMaterials.map(m => m.id), ['shared']);
    return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({action:'quote_materials',materialIds:['shared']})}]}]}));
  }});
  const a = await start(t, {siteRoot:f.root, storeFile, generate, providerInfo:{provider:'openai',model:'mock'}});
  assert.equal((await fetch(a.root + '/raven/deleted-name/')).headers.get('set-cookie'), null);
  const cookie = (await fetch(a.root + '/raven/dialogue/')).headers.get('set-cookie').split(';')[0];
  const post = (root, url, body, session = cookie) => fetch(root + url, {method:'POST',headers:{cookie:session,'content-type':'application/json'},body:JSON.stringify(body)});
  for (const material of [{id:'private',type:'private_note',text:'PRIVATE_NOTE'}, {id:'shared',type:'statement',text:'PUBLIC_PLAYER_CLAIM'}]) {
    assert.equal((await post(a.root, '/api/materials', material)).status, 200);
  }
  assert.equal((await post(a.root, '/api/shares', {eventId:'share',materialId:'shared',recipients:['jonas']})).status, 200);
  const payload = {requestId:'hosted-request',characterId:'jonas',message:'ما القول الذي وصلك؟'};
  const submitted = await post(a.root, '/api/dialogue', payload); assert.equal(submitted.status, 202);
  let result;
  for (let n = 0; n < 20; n++) { result = await (await fetch(a.root + '/api/operations/hosted-request', {headers:{cookie}})).json(); if (result.status !== 'pending') break; }
  assert.equal(result.status, 'completed'); assert.match(result.response.text, /PUBLIC_PLAYER_CLAIM/); assert.equal(result.saveStatus, 'confirmed');
  const otherCookie = (await fetch(a.root + '/raven/dialogue/')).headers.get('set-cookie').split(';')[0];
  assert.equal((await post(a.root, '/api/dialogue', payload, otherCookie)).status, 403);
  assert.equal((await fetch(a.root + '/api/operations/hosted-request', {headers:{cookie:otherCookie}})).status, 404);
  await a.close(); _reset();
  const b = await start(t, {siteRoot:f.root, storeFile, generate:() => { throw new Error('must not generate'); }});
  const replay = await (await post(b.root, '/api/dialogue', payload)).json();
  assert.equal(replay.replayed, true); assert.deepEqual(replay.response, result.response); assert.equal(calls, 1);
  assert.equal((await fetch(b.root + '/api/history', {headers:{cookie}})).headers.get('x-frame-options'), 'DENY');
  assert.equal((await fetch(b.root + '/api/history')).status, 401);
  assert.equal((await (await fetch(b.root + '/api/knowledge?characterId=claire', {headers:{cookie}})).json()).materials.length, 0);
});

test('reviewed PNG and WebP atlases and CSS are served while unlisted or symlinked files stay private', async t => {
  const f = fixture(t), pngAssets = [
    'raven/deleted-name/assets/characters/cast-portraits-v1.png',
    'raven/deleted-name/assets/scenes/case-scenes-v1.png',
    'raven/deleted-name/assets/scenes/investigation-scenes-v1.png',
  ];
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC2kAAAAASUVORK5CYII=', 'base64');
  const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
  const assets = pngAssets.flatMap(asset => [
    {path:asset, bytes:png, type:'image/png'},
    {path:asset.replace(/\.png$/, '.webp'), bytes:webp, type:'image/webp'},
  ]);
  const publicFiles = assets.map(asset => f.write(asset.path, asset.bytes));
  const cssAsset = 'raven/assets/raven-scene-art.css', css = '.scene-art { background-size: cover; }';
  f.write(cssAsset, css);
  const privateAssets = ['raven/deleted-name/assets/characters/private-reference.png',
    'raven/deleted-name/assets/characters/private-reference.webp',
    'raven/deleted-name/assets/scenes/private-reference.png',
    'raven/deleted-name/assets/scenes/private-reference.webp', 'raven/assets/private-scene-art.css'];
  const privateFiles = privateAssets.map(asset => f.write(asset, 'PRIVATE_ASSET_SENTINEL'));
  const s = await start(t, {siteRoot:f.root});
  for (const asset of assets) {
    const response = await fetch(s.root + '/' + asset.path + '?v=1');
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), asset.type);
    assert.equal(response.headers.get('content-length'), String(asset.bytes.length));
    assert.equal(response.headers.get('set-cookie'), null);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), asset.bytes);
  }
  const stylesheet = await fetch(s.root + '/' + cssAsset);
  assert.equal(stylesheet.status, 200); assert.equal(stylesheet.headers.get('content-type'), 'text/css; charset=utf-8');
  assert.equal(await stylesheet.text(), css);
  for (const asset of privateAssets) {
    const response = await fetch(s.root + '/' + asset);
    assert.equal(response.status, 404); assert.doesNotMatch(await response.text(), /PRIVATE_ASSET_SENTINEL/);
  }
  for (const [index, publicFile] of publicFiles.entries()) {
    fs.unlinkSync(publicFile); fs.symlinkSync(privateFiles[0], publicFile);
    const linked = await fetch(s.root + '/' + assets[index].path);
    assert.equal(linked.status, 404); assert.doesNotMatch(await linked.text(), /PRIVATE_ASSET_SENTINEL/);
  }
});

test('visual scenes and linked studio serve reviewed assets across root and legacy URLs without exposing adjacent files', async t => {
  const f = fixture(t);
  const assets = [
    ['raven/assets/raven-visual-scenes.js', 'text/javascript; charset=utf-8', 'SCENE_SCRIPT'],
    ['raven/assets/raven-visual-scenes.css', 'text/css; charset=utf-8', '.scene { display:block; }'],
    ['studio/index.html', 'text/html; charset=utf-8', '<!doctype html><div id="root"></div>'],
    ['studio/assets/index-BvmsDJTf.js', 'text/javascript; charset=utf-8', 'STUDIO_SCRIPT'],
    ['studio/assets/index-DO0lVgqN.css', 'text/css; charset=utf-8', '.studio { display:block; }'],
    ['studio/visual-lab/assets/ibm-plex-arabic.woff2', 'font/woff2', 'FONT_FIXTURE'],
    ['studio/visual-lab/assets/01-manor.webp', 'image/webp', 'MANOR_PREVIEW'],
    ['studio/visual-lab/assets/02-archive.png', 'image/png', 'ARCHIVE_DOWNLOAD'],
    ['studio/visual-lab/media/poster-landscape.webp', 'image/webp', 'LANDSCAPE_POSTER'],
    ['studio/visual-lab/media/poster-portrait.webp', 'image/webp', 'PORTRAIT_POSTER'],
    ['studio/visual-lab/media/raven-landscape.mp4', 'video/mp4', '0123456789'],
    ['studio/visual-lab/media/raven-portrait.mp4', 'video/mp4', 'abcdefghij'],
  ];
  for (const [name, , body] of assets) f.write(name, body);
  const s = await start(t, {siteRoot:f.root});
  for (const [name, type, body] of assets) {
    const prefixes = name.startsWith('studio/') ? ['', '/abdulrhman'] : [''];
    for (const prefix of prefixes) for (const method of ['GET', 'HEAD']) {
      const response = await fetch(`${s.root}${prefix}/${name}?v=20261107`, {method});
      assert.equal(response.status, 200, `${method} ${prefix}/${name}`);
      assert.equal(response.headers.get('content-type'), type);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.equal(await response.text(), method === 'HEAD' ? '' : body);
    }
  }
  for (const prefix of ['', '/abdulrhman']) {
    const redirect = await fetch(s.root + prefix + '/studio?lang=en', {redirect:'manual'});
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get('location'), prefix + '/studio/?lang=en');
    assert.equal((await fetch(s.root + prefix + '/studio/')).status, 200);
    const movie = await fetch(s.root + prefix + '/studio/visual-lab/media/raven-portrait.mp4', {headers:{range:'bytes=2-5'}});
    assert.equal(movie.status, 206); assert.equal(movie.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(await movie.text(), 'cdef');
  }
  const back = await fetch(s.root + '/abdulrhman/raven/index.html?lang=en', {redirect:'manual'});
  assert.equal(back.status, 308); assert.equal(back.headers.get('location'), '/raven/?lang=en');
  assert.equal(back.headers.get('set-cookie'), null);

  const privateFiles = ['studio/visual-lab/README.md', 'studio/visual-lab/assets.json',
    'studio/visual-lab/raven-visual-kit.zip', 'studio/visual-lab/scripts/render-visual-lab.py',
    'studio/visual-lab/assets/private-reference.png', 'studio/visual-lab/media/private.mp4',
    'studio/assets/private.js', 'studio/raven-case-content.json'];
  for (const name of privateFiles) f.write(name, 'PRIVATE_STUDIO_SENTINEL');
  for (const prefix of ['', '/abdulrhman']) {
    for (const name of [...privateFiles, 'studio/visual-lab/', 'studio/assets/',
      'studio/visual-lab/assets/../private-reference.png', 'studio/%2e%2e/.env']) {
      const response = await rawGet(s.root, prefix + '/' + name);
      assert.equal(response.status, 404); assert.doesNotMatch(response.body, /PRIVATE_STUDIO_SENTINEL/);
    }
  }
  // An allowed legacy URL must use the same symlink checks as a root-hosted URL.
  const linked = path.join(f.root, 'studio/visual-lab/media/poster-portrait.webp');
  fs.unlinkSync(linked); fs.symlinkSync(path.join(f.root, privateFiles[0]), linked);
  for (const prefix of ['', '/abdulrhman']) {
    const response = await fetch(s.root + prefix + '/studio/visual-lab/media/poster-portrait.webp');
    assert.equal(response.status, 404); assert.doesNotMatch(await response.text(), /PRIVATE_STUDIO_SENTINEL/);
  }
});

test('reviewed homepage images, favicon and media fallback serve exact bytes while adjacent files and symlinks stay private', async t => {
  const f = fixture(t), names = ['jonas','claire','elena','mateo','noah','evidence_table'];
  const assets = names.map((name,index) => ({name:`raven/assets/images/deleted-name/${name}.jpg`,
    type:'image/jpeg',bytes:Buffer.from([0xff,0xd8,0xff,0xe0,index,0xff,0xd9])}));
  assets.push({name:'raven/assets/favicon.svg',type:'image/svg+xml',bytes:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><title>Fixture favicon</title></svg>')});
  assets.push({name:'raven/assets/raven-media-fallback.js',type:'text/javascript; charset=utf-8',bytes:Buffer.from('/* reviewed media fallback */')});
  assets.push({name:'raven/assets/raven-media-fallback.css',type:'text/css; charset=utf-8',bytes:Buffer.from('.media-fallback { display: block; }')});
  for (const asset of assets) f.write(asset.name,asset.bytes);
  const privateNames = ['raven/assets/images/deleted-name/private.jpg','raven/assets/images/deleted-name/jonas-copy.jpg',
    'raven/assets/images/deleted-name/claire.webp','raven/assets/images/private.jpg','raven/assets/favicon-private.svg',
    'raven/assets/raven-media-fallback-private.js','raven/assets/raven-media-fallback-private.css'];
  for (const name of privateNames) f.write(name,'PRIVATE_HOMEPAGE_SENTINEL');
  const s = await start(t,{siteRoot:f.root});
  for (const asset of assets) for (const method of ['GET','HEAD']) {
    const response = await fetch(s.root + '/' + asset.name + '?v=reviewed',{method});
    assert.equal(response.status,200); assert.equal(response.headers.get('content-type'),asset.type);
    assert.equal(response.headers.get('content-length'),String(asset.bytes.length));
    assert.equal(response.headers.get('set-cookie'),null);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),method === 'HEAD' ? Buffer.alloc(0) : asset.bytes);
  }
  for (const name of [...privateNames,'raven/assets/images/deleted-name/','raven/assets/images/',
    'deleted-name/assets/images/jonas.jpg','raven/title-sequence.html']) {
    const response = await fetch(s.root + '/' + name);
    assert.equal(response.status,404); assert.doesNotMatch(await response.text(),/PRIVATE_HOMEPAGE_SENTINEL/);
  }
  const outside = path.join(f.dir,'outside.jpg');fs.writeFileSync(outside,'PRIVATE_HOMEPAGE_SENTINEL');
  for (const [index,asset] of assets.entries()) {
    const file = path.join(f.root,asset.name);fs.unlinkSync(file);
    fs.symlinkSync(index % 2 ? outside : path.join(f.root,privateNames[0]),file);
    const response = await fetch(s.root + '/' + asset.name);
    assert.equal(response.status,404);assert.doesNotMatch(await response.text(),/PRIVATE_HOMEPAGE_SENTINEL/);
  }
  const images = path.join(f.root,'raven/assets/images/deleted-name'),moved = path.join(f.dir,'moved-images');
  fs.renameSync(images,moved);fs.symlinkSync(moved,images);
  for (const name of names) assert.equal((await fetch(s.root + `/raven/assets/images/deleted-name/${name}.jpg`)).status,404);
});

test('only the exact legacy case entry URLs redirect to canonical pages with query strings intact', async t => {
  const f = fixture(t);f.write('raven/deleted-name/content.html','<!doctype html><p>Canonical case reading</p>');
  const aliases = [
    ['/deleted-name','/raven/deleted-name/'],['/deleted-name/','/raven/deleted-name/'],
    ['/deleted-name/index.html','/raven/deleted-name/'],['/deleted-name/content.html','/raven/deleted-name/content.html'],
    ['/raven/deleted-name.html','/raven/deleted-name/'],
  ];
  const s = await start(t,{siteRoot:f.root});
  const query = '?lang=en&source=legacy%20link';
  for (const [from,to] of aliases) for (const method of ['GET','HEAD']) {
    const response = await fetch(s.root + from + query + '#opening',{method,redirect:'manual'});
    assert.equal(response.status,308);assert.equal(response.headers.get('location'),to + query);
    // Fragments never reach HTTP. A Location without a fragment lets browsers
    // inherit the original #opening instead of replacing or stripping it.
    assert.equal(response.headers.get('location').includes('#'),false);
    assert.equal(response.headers.get('set-cookie'),null);assert.equal(await response.text(),'');
    const destination = await fetch(s.root + response.headers.get('location'),{method});
    assert.equal(destination.status,200);assert.equal(destination.headers.get('set-cookie'),null);
  }
  for (const name of ['deleted-name/private.html','deleted-name/content-backup.html','raven/deleted-name-private.html']) {
    f.write(name,'PRIVATE_ALIAS_SENTINEL');
    const response = await fetch(s.root + '/' + name,{redirect:'manual'});
    assert.equal(response.status,404);assert.equal(response.headers.get('location'),null);
    assert.doesNotMatch(await response.text(),/PRIVATE_ALIAS_SENTINEL/);
  }
});

test('private files and raw traversal never reach the public mount, with or without a session', async t => {
  const f = fixture(t), s = await start(t, {siteRoot:f.root});
  for (const file of ['.env', '.git/config', 'PRIVATE-content-review-not-published.md', 'docs/review.html',
    'server/ai-dialogue/.data/preview-store.json', 'raven/assets/secret.js', 'raven/deleted-name/backup.html']) f.write(file, 'PRIVATE_SENTINEL');
  const paths = ['/.env', '/.git/config', '/PRIVATE-content-review-not-published.md', '/docs/review.html',
    '/server/ai-dialogue/.data/preview-store.json', '/raven/assets/secret.js', '/raven/deleted-name/backup.html',
    '/raven/assets/', '/raven/../.env', '/raven/./content.html', '/raven/%2e%2e/.env', '/%72aven/content.html',
    '/raven/%252e%252e/.env', '/raven%2fcontent.html', '/raven\\..\\.env', '/raven//content.html',
    '/raven/%00', '/raven/%', '//raven/content.html', 'http://preview.local/raven/content.html'];
  const cookie = (await fetch(s.root)).headers.get('set-cookie').split(';')[0];
  for (const session of [undefined, cookie]) for (const target of paths) {
    const response = await rawGet(s.root, target, session); assert.equal(response.status, 404, target); assert.doesNotMatch(response.body, /PRIVATE_SENTINEL|public|workspace/);
  }
});

test('allowlisted paths reject file and directory symlinks, including links within the root', async t => {
  const f = fixture(t), s = await start(t, {siteRoot:f.root});
  const outside = path.join(f.dir, 'outside.js'); fs.writeFileSync(outside, 'PRIVATE_SENTINEL');
  const allowed = path.join(f.root, 'site-player.js'); fs.unlinkSync(allowed); fs.symlinkSync(outside, allowed);
  assert.equal((await fetch(s.root + '/site-player.js')).status, 404);
  fs.unlinkSync(allowed); f.write('local-copy.js', 'PRIVATE_SENTINEL'); fs.symlinkSync(path.join(f.root, 'local-copy.js'), allowed);
  assert.equal((await fetch(s.root + '/site-player.js')).status, 404);
  fs.renameSync(path.join(f.root, 'raven/deleted-name'), path.join(f.dir, 'outside-case'));
  fs.symlinkSync(path.join(f.dir, 'outside-case'), path.join(f.root, 'raven/deleted-name'));
  assert.equal((await fetch(s.root + '/raven/deleted-name/')).status, 404);
  const rootLink = path.join(f.dir, 'public-link'); fs.symlinkSync(f.root, rootLink);
  assert.throws(() => createPreviewServer({siteRoot:rootLink}), /invalid_site_root/);
  assert.throws(() => createPreviewServer({siteRoot:'relative/path'}), /site_root_must_be_absolute/);
});
