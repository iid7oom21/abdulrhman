import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const STUDIO_ENTRY_ASSETS = ['studio/assets/index-WOHAaYmS.js', 'studio/assets/index-B8hYmrFe.css'];

export const AFTER_SHOW_FILES = [
  'index.html', 'content.html', 'app.js', 'state.js', 'style.css',
  'edit.js', 'edit-rules.js', 'edit.css', 'sims.js', 'sim-rules.js', 'sims.css',
  'events.js', 'event-rules.js', 'events.css', 'lens.js', 'lens.css',
  'workshops.js', 'screencraft.js', 'screencraft.css', 'illusions.js', 'illusions.css',
  'illusions-art.js', 'illusions-rules.js', 'stagecraft.js', 'stagecraft.css',
  'practical-tools.js', 'practical-motif.js', 'practical-performance.js', 'practical-popup.js', 'practical-shadows.js',
  'screencraft-glass.js', 'screencraft-blocking.js', 'screencraft-subtitles.js', 'screencraft-ui.js',
  'practical.js', 'practical.css', 'filmlab.js', 'filmlab.css', 'filmlab-model.js', 'filmlab-art.js',
  ...['titles', 'parallax', 'subtitles', 'blocking', 'forced-scale', 'matte', 'zoetrope', 'costume',
    'rainbox', 'stopmotion', 'description', 'wayfinding', 'leitmotif', 'shadows', 'performance', 'popup',
    'film-ink', 'scenic-texture', 'split-screen', 'branch-film'].map(id => 'assets/preview-' + id + '.webp'),
  'assets/exterior.webp', 'assets/hand.webp', 'assets/envelope.webp', 'assets/lamp.webp',
  'assets/foley-paper.wav', 'assets/foley-chair.wav', 'assets/foley-key.wav',
  'assets/light-bright.png', 'assets/light-soft.png', 'assets/light-raking.png', 'assets/credits.txt',
  'assets/preview-projection.webp', 'assets/preview-light.webp', 'assets/preview-sound.webp',
  'assets/preview-grade.webp', 'assets/preview-camera.webp',
  'assets/preview-budget.webp', 'assets/preview-continuity.webp', 'assets/preview-archive.webp',
].map(name => 'raven/after-show/' + name);

const nightActivities = [
  'station-shadow', 'reel-run', 'last-minute-auction', 'lost-and-found', 'dome-sky', 'echo-two',
  'echo-last-seat', 'darkroom-minute', 'weightless-cam', 'tide-harbor', 'fabric-wind', 'harbour-watch',
  'director-sentence', 'reading-actor', 'city-radio', 'puzzle-owner', 'replay-caller',
  'memory-lift', 'seven-windows', 'curtain-party', 'sound-museum',
];

export const LATE_NIGHT_FILES = [
  'index.html', 'boot.js', 'catalog.js', 'hub.js', 'hub.css', 'night-store.js', 'night-shell.js', 'night-shell.css',
  'evening.js', 'evening-programme.js', 'work-file.js', 'connect.js', 'connect.css', 'night-tests.html', 'coast-map.html',
  ...['nightshift-post', 'nightshift-paper', 'nightshift-window', 'nightshift-seat', 'nightshift-mirrors'].flatMap(id => [id + '.html', 'thumbs/' + id + '.webp']),
  ...['post.js', 'post.css', 'post-rules.js', 'paper.js', 'paper.css', 'paper-rules.js', 'window.js', 'window.css',
    'mirrors.js', 'mirrors.css', 'mirror-rules.js',
    'seat-script.js', 'seat-story.js', 'seat-rules.js', 'seat-audio.js', 'seat.css',
    'art/seat-assets.json', 'art/salma-booth.webp', 'art/seat-auditorium.webp', 'art/seat-passage.ogg',
    'art/window-assets.json', ...['room', 'wait', 'gaze', 'curtain', 'boat', 'cover'].map(id => 'art/window-' + id + '.webp')
  ].map(file => 'nightshift/' + file),
  ...nightActivities.flatMap(id => [id + '.html', 'thumbs/' + id + '.webp', 'assets/photo/' + id + '.webp']),
  ...['studio', 'beacon', 'cut', 'camera', 'ferry', 'page', 'courier', 'lines', 'letters'].map(name => 'ink-' + name + '.html'),
  ...['catalog.js', 'programme.js', 'ink.css', 'beacon.js', 'cut.js', 'camera.js', 'ferry.js', 'page.js', 'print-panels.js', 'courier.js', 'courier-rules.js', 'courier.css'].map(name => 'ink/' + name),
  ...['ferry-pier', 'ferry-pier-print', 'ferry-signal', 'ferry-deck', 'beacon-night', 'beacon-boats',
    'camera-cover', 'camera-window', 'camera-harbour', 'panel-press', 'panel-type', 'panel-window', 'panel-drying',
    'workshop-lines', 'workshop-letters'].map(name => 'ink/art/' + name + '.webp'),
  'ink/art/courier/manifest.json',
  ...['route', 'departure', 'crossing', 'letter', 'arrival', 'shelter',
    'print-departure', 'print-crossing', 'print-letter', 'print-arrival', 'print-shelter']
    .map(name => 'ink/art/courier/' + name + '.webp'),
  // The two drawn Ink Nights workshops: speed-line timing and speech-bubble lettering.
  ...['start.js', 'art.js', 'speed.js', 'bubbles.js', 'manga.css'].map(name => 'manga/' + name),
  ...['harbour-cinema', 'harbour-cinema-mobile', 'station-porter', 'auction-lots', 'lost-items', 'dome-disc',
    'reel-board', 'echo-chart', 'scene-props', 'curtain-closed', 'museum-base',
    'director-cinema', 'director-square', 'director-figure'].map(name => 'assets/photo/' + name + '.webp'),
  ...['time-door', 'three-evening', 'my-notebook', 'festival-chair', 'idea-to-studio',
    'dialogue-preview', 'episode-ends', 'behind-frame', 'weekend', 'screening-room'].map(id => id + '.html'),
  ...['auction.js', 'dome.js', 'echo.js', 'games.css', 'lost.js', 'reel.js', 'reel-model.js',
    'station.js', 'station-model.js', 'station-scene.js', 'tools.js'].map(name => 'games/' + name),
  ...['camera.js', 'camera-rules.js', 'darkroom.js', 'echo.js', 'fabric.js', 'kit.js', 'main.js',
    'models.js', 'sims.css', 'tide.js', 'vts.js', 'vts-rules.js'].map(name => 'sims/' + name),
  ...['creative.css', 'director.js', 'kit.js', 'puzzle-rules.js', 'puzzle.js', 'radio.js',
    'reading.js', 'replay.js', 'scene.js'].map(name => 'creative/' + name),
  ...['art.js', 'memory-lift.js', 'seven-windows.js', 'curtain-party.js', 'sound-museum.js',
    'scene-piece.js', 'scenes.css', 'screening.js', 'studio-screening.js', 'start.js', 'ui.js', 'weekend.js']
    .map(name => 'scenes/' + name),
  'assets/hero.png', 'assets/museum-bell.wav', 'assets/museum-mill.wav', 'assets/museum-ticket.wav',
].map(name => 'raven/late-night/' + name);

export const RAVEN17_PREVIEW_FILES = ['index.html', 'home.css', 'home.js']
  .map(name => 'raven/raven-17-preview/' + name);
export const EPISODE_GALLERY_FILES = ['index.html', 'content.html', 'gallery.js', 'gallery.css',
  'assets/series-wide.webp', 'assets/series-mobile.webp'].map(name => 'raven/episodes/' + name);

// Reviewed public runtime files only. Never enumerate a repository or serve by extension.
// The Render export and the Pages check read this list too, so one edit adds a file to the mount,
// the export and the checks together.
export const SITE_FILES = [
  ...AFTER_SHOW_FILES, ...LATE_NIGHT_FILES, ...RAVEN17_PREVIEW_FILES, ...EPISODE_GALLERY_FILES,
  // Local visual-review assets. No private content or new API surface.
  'raven/assets/raven-visual-home.css',
  'raven/assets/raven-visual-home.js',
  'raven/assets/raven-home-resume.css',
  'raven/assets/raven-home-resume.js',
  'raven/deleted-name/opening-visual.css',
  'raven/deleted-name/opening-visual.js',
  'raven/deleted-name/reading-continuity.js',
  'raven/assets/visual-20261119/appointment-phone.webp',
  'raven/assets/visual-20261119/appointment-phone-mobile.webp',
  'raven/deleted-name/play/play-visual.css',
  'raven/deleted-name/play/belief-review.css',
  'raven/deleted-name/play/belief-review.js',
  'raven/assets/visual-20261119/case-entry.webp',
  'raven/assets/visual-20261119/cinema-atmosphere.webp',
  'raven/assets/visual-20261119/comparison-surface-mobile.webp',
  'raven/assets/visual-20261119/notebook-surface.webp',
  'raven/assets/visual-20261119/paper-grain.webp',
  'raven/assets/visual-20261119/notebook-surface-mobile.webp',
  'raven/assets/visual-20261119/comparison-surface.webp',
  'raven/assets/visual-20261119/section-divider.webp',
  'raven/assets/visual-20261119/case-entry-mobile.webp',
  'raven/assets/visual-20261119/cinema-atmosphere-mobile.webp',
  'site-player.js', 'site-audio.js', 'site-entry.js', 'site-bridge.js', 'site-player.css',
  'raven/index.html', 'raven/content.html',
  'raven/dialogue/preview-room.css',
  'raven/deleted-name/index.html', 'raven/deleted-name/content.html', 'raven/deleted-name/reading-tools.js',
  'raven/deleted-name/case-entry.js', 'raven/deleted-name/opening-artwork.js', 'raven/release.json',
  'raven/deleted-name/play/index.html', 'raven/deleted-name/play/content.html',
  'raven/deleted-name/play/app.js', 'raven/deleted-name/play/style.css',
  // Generic review surface only; case packs and author policies stay private.
  'raven/investigation-lab/index.html', 'raven/investigation-lab/content.html', 'raven/investigation-lab/style.css',
  'raven/investigation-lab/workbench.js',
  'raven/deleted-name/assets/case-record.webp', 'raven/deleted-name/assets/case-arrival.webp',
  'raven/deleted-name/assets/case-og-v4.jpg',
  'raven/deleted-name/assets/characters/cast-portraits-v1.png',
  'raven/deleted-name/assets/characters/cast-portraits-v1.webp',
  'raven/deleted-name/assets/scenes/case-scenes-v1.png',
  'raven/deleted-name/assets/scenes/case-scenes-v1.webp',
  'raven/deleted-name/assets/scenes/investigation-scenes-v1.png',
  'raven/deleted-name/assets/scenes/investigation-scenes-v1.webp',
  'raven/deleted-name/assets/scenes/case-investigation-v2.png',
  'raven/deleted-name/assets/scenes/case-investigation-v2.webp',
  'raven/deleted-name/assets/scenes/case-tools-v1.png',
  'raven/deleted-name/assets/scenes/case-tools-v1.webp',
  'raven/assets/raven-scene-art.css',
  'raven/assets/raven-studio-ident-v1.js', 'raven/assets/raven-home-focus.css',
  'raven/assets/raven-enhancements-v1.js', 'raven/assets/raven-archive.css',
  'raven/assets/raven-deleted-name-home.js', 'raven/assets/raven-refinement-v2.js',
  'raven/assets/raven-media-fallback.js', 'raven/assets/raven-media-fallback.css',
  'raven/assets/favicon.svg',
  ...['jonas', 'claire', 'elena', 'mateo', 'noah', 'evidence_table'].map(name =>
    `raven/assets/images/deleted-name/${name}.jpg`),
  // Smaller WebP copies of the same portraits for the homepage cards (srcset); the JPGs stay the originals.
  ...['jonas', 'claire', 'elena', 'mateo', 'noah'].map(name =>
    `raven/assets/images/deleted-name/web/${name}-600.webp`),
  'raven/assets/images/deleted-name/web/evidence_table-640h.webp',
  'raven/assets/raven-homepage-v6.css', 'raven/assets/raven-redesign-v1.css',
  'raven/assets/raven-polish-v2.css', 'raven/assets/raven-i18n.js',
  'raven/assets/raven-visual-scenes.js', 'raven/assets/raven-visual-scenes.css',
  // Reviewed silent atmosphere clips and their posters, never a directory wildcard.
  ...['archive-opening', 'paper-detail', 'over-shoulder'].flatMap(name =>
    ['mp4', 'webp'].map(extension => `raven/assets/atmosphere-v1/${name}.${extension}`)),
  // Runtime files used by the pinned homepage and its linked studio, not the source/download bundle.
  'studio/index.html', ...STUDIO_ENTRY_ASSETS,
  'studio/assets/index-C7tRTuJ0.js', 'studio/assets/index-DI-to4yn.css', 'studio/assets/index-B9yDZDSb.js', // previous releases, for cached clients
  'studio/visual-lab/assets/ibm-plex-arabic.woff2',
  ...['01-manor', '02-archive', '03-desk', '04-corridor'].flatMap(name =>
    ['webp', 'png'].map(extension => `studio/visual-lab/assets/${name}.${extension}`)),
  ...['landscape', 'portrait'].flatMap(format => [
    `studio/visual-lab/media/raven-${format}.mp4`, `studio/visual-lab/media/poster-${format}.webp`,
  ]),
  'raven/terminal-preview/index.html', 'raven/terminal-preview/favicon.svg',
  'raven/terminal-preview/case-017/index.html', 'raven/terminal-preview/zarqa/index.html',
  'raven/terminal-preview/raven-17/index.html',
  ...[1, 2, 3].map(n => `raven/terminal-preview/raven-17/part-${n}/index.html`),
  ...['episode-1.jpg', 'episode-2.jpg', 'episode-3.jpg', 'cinzel.woff2',
    'ibm-plex-arabic.woff2', 'raven-intro-poster.jpg', 'hero-poster.jpg', 'hero-loop.mp4',
    'raven-intro.mp4'].map(name => 'raven/terminal-preview/assets/' + name),
  'fourth-signature/index.html',
  'fourth-signature/assets/audio/raven-dark-pop-intimate-revised.mp3',
  'assets/raven-home-share.jpg', 'assets/texts/raven-texts.js',
  ...['raven-intro-wide.mp4', 'raven-intro.jpg', 'raven-intro-poster.jpg', 'raven-intro-wide.jpg', 'raven-intro.mp4'].map(name => 'assets/intro/' + name),
  ...Array.from({length:13}, (_, n) => `assets/audio/raven/${String(n + 1).padStart(2, '0')}.mp3`),
];
const routes = new Map(SITE_FILES.map(file => ['/' + file, file]));
const legacyCaseRoutes = new Map([
  ['/deleted-name', '/raven/deleted-name/'],
  ['/deleted-name/', '/raven/deleted-name/'],
  ['/deleted-name/index.html', '/raven/deleted-name/'],
  ['/deleted-name/content.html', '/raven/deleted-name/content.html'],
  ['/raven/deleted-name.html', '/raven/deleted-name/'],
]);
for (const file of SITE_FILES) if (file.endsWith('/index.html')) routes.set('/' + file.slice(0, -10), file);
// Serve the same reviewed studio files at both supported mount paths.
for (const [route, file] of [...routes]) if (route.startsWith('/studio/')) routes.set('/abdulrhman' + route, file);
// Pages links may arrive under the repository prefix. Redirect once to the Render route
// so native links and imports resolve against the same base as a direct visit.
const pagesSections = ['/raven/after-show', '/raven/late-night', '/raven/raven-17-preview', '/raven/episodes'];
const mime = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.webp':'image/webp', '.png':'image/png',
  '.woff2':'font/woff2', '.ttf':'font/ttf', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.ogg':'audio/ogg', '.mp4':'video/mp4'};
export const HOSTED_DIALOGUE_PATHS = new Set(['/raven/dialogue/', '/raven/dialogue/index.html']);

// Check the request target before URL() can normalize traversal. Public filenames are ASCII.
export function siteRequestPath(target) {
  const pathname = target.split('?')[0];
  if (!/^\/[A-Za-z0-9_./-]*$/.test(pathname) || pathname.includes('//') ||
      pathname.split('/').some(part => part.startsWith('.'))) return null;
  return pathname;
}

// These two surfaces ship external scripts and local artwork only.
const localPagePolicy = "default-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; " +
  "font-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; " +
  "frame-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'";
const localPages = new Set([...LATE_NIGHT_FILES, ...RAVEN17_PREVIEW_FILES].filter(name => name.endsWith('.html')));
const hash = text => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
export function siteContentSecurityPolicy(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(m => hash(m[1]));
  // Two existing homepage handlers. Do not authorize arbitrary inline script attributes.
  const handlers = ['closeEpisodesOutside(event)', 'closeEpisodes()'].map(hash);
  const media = 'https://cdn.websitepublisher.ai https://d2ol7oe51mr4n9.cloudfront.net https://res.cloudinary.com';
  return `default-src 'none'; script-src 'self' ${scripts.join(' ')}; script-src-attr 'unsafe-hashes' ${handlers.join(' ')}; ` +
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; ` +
    `font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; img-src 'self' data: ${media}; ` +
    `media-src 'self' ${media}; connect-src 'self'; frame-src 'self'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'`;
}

export function createSiteMount(directory) {
  if (!path.isAbsolute(directory)) throw new Error('site_root_must_be_absolute');
  const root = path.resolve(directory), rootInfo = fs.lstatSync(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || fs.realpathSync(root) !== root) throw new Error('invalid_site_root');
  const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;
  return {
    redirect(pathname) {
      if (['/abdulrhman/raven', '/abdulrhman/raven/', '/abdulrhman/raven/index.html'].includes(pathname)) return '/raven/';
      if (pathname.startsWith('/abdulrhman/')) {
        const canonical = pathname.slice('/abdulrhman'.length);
        if (pagesSections.includes(canonical)) return canonical + '/';
        if (pagesSections.some(section => canonical.startsWith(section + '/')) && routes.has(canonical)) return canonical;
      }
      if (legacyCaseRoutes.has(pathname)) return legacyCaseRoutes.get(pathname);
      return !pathname.endsWith('/') && (routes.has(pathname + '/') || pathname === '/raven/dialogue')
        ? pathname + '/' : null;
    },
    open(pathname) {
      const relative = routes.get(pathname);
      if (!relative) return null;
      let fd;
      try {
        const currentRoot = fs.lstatSync(root);
        if (!currentRoot.isDirectory() || currentRoot.isSymbolicLink() || !sameFile(rootInfo, currentRoot)) return null;
        let current = root, expected;
        const parts = relative.split('/');
        for (const [index, part] of parts.entries()) {
          current = path.join(current, part);
          expected = fs.lstatSync(current);
          if (expected.isSymbolicLink() || (index < parts.length - 1 ? !expected.isDirectory() : !expected.isFile())) return null;
        }
        if (fs.realpathSync(current) !== current) return null;
        fd = fs.openSync(current, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        const stat = fs.fstatSync(fd);
        if (!stat.isFile() || !sameFile(expected, stat) || fs.realpathSync(current) !== current) {
          fs.closeSync(fd); return null;
        }
        return {fd, stat, type:mime[path.extname(relative)], html:relative.endsWith('.html'), localPage:localPages.has(relative)};
      } catch {
        if (fd !== undefined) fs.closeSync(fd);
        // Missing assets and unsafe paths have the same response; disk paths never cross HTTP.
        return null;
      }
    },
  };
}

export function serveSiteFile(req, res, asset) {
  const {fd, stat, type, html} = asset;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', html ? 'no-store' : 'no-cache');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  if (html) {
    // Public HTML is small; media is streamed below, including single byte ranges.
    if (stat.size > 2 * 1024 * 1024) { fs.closeSync(fd); res.writeHead(404); res.end(); return; }
    let body;
    try { body = fs.readFileSync(fd); } finally { fs.closeSync(fd); }
    res.setHeader('Content-Security-Policy', asset.localPage ? localPagePolicy : siteContentSecurityPolicy(body.toString()));
    res.setHeader('Content-Length', body.length);
    res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : body); return;
  }
  res.setHeader('Accept-Ranges', 'bytes');
  let start = 0, end = stat.size - 1, status = 200;
  if (req.method === 'GET' && req.headers.range) {
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range && (range[1] || range[2])) {
      if (!range[1]) start = Math.max(0, stat.size - Number(range[2]));
      else { start = Number(range[1]); if (range[2]) end = Math.min(end, Number(range[2])); }
    }
    if (!range || (!range[1] && !range[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) {
      fs.closeSync(fd); res.writeHead(416, {'Content-Range':`bytes */${stat.size}`}); res.end(); return;
    }
    status = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
  }
  res.setHeader('Content-Length', Math.max(0, end - start + 1));
  res.writeHead(status);
  if (req.method === 'HEAD' || stat.size === 0) { fs.closeSync(fd); res.end(); return; }
  const stream = fs.createReadStream('', {fd, autoClose:true, start, end});
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
