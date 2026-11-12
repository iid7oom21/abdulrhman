import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Reviewed public runtime files only. Never enumerate a repository or serve by extension.
const files = [
  'site-player.js', 'site-audio.js', 'site-entry.js', 'site-bridge.js', 'site-player.css',
  'raven/index.html', 'raven/content.html',
  'raven/deleted-name/index.html', 'raven/deleted-name/content.html', 'raven/deleted-name/reading-tools.js',
  'raven/deleted-name/case-entry.js', 'raven/release.json',
  'raven/deleted-name/play/index.html', 'raven/deleted-name/play/content.html',
  'raven/deleted-name/play/app.js', 'raven/deleted-name/play/style.css',
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
  'raven/assets/raven-studio-ident-v1.js', 'raven/assets/raven-story-card.js',
  'raven/assets/raven-archive.js', 'raven/assets/raven-home-focus.css',
  'raven/assets/raven-enhancements-v1.js', 'raven/assets/raven-archive.css',
  'raven/assets/raven-deleted-name-home.js', 'raven/assets/raven-refinement-v2.js',
  'raven/assets/favicon.svg',
  ...['jonas', 'claire', 'elena', 'mateo', 'noah', 'evidence_table'].map(name =>
    `raven/assets/images/deleted-name/${name}.jpg`),
  'raven/assets/raven-homepage-v6.css', 'raven/assets/raven-redesign-v1.css', 'raven/assets/raven-i18n.js',
  'raven/assets/raven-visual-scenes.js', 'raven/assets/raven-visual-scenes.css',
  // Runtime files used by the pinned homepage and its linked studio, not the source/download bundle.
  'studio/index.html', 'studio/assets/index-BvmsDJTf.js', 'studio/assets/index-DO0lVgqN.css',
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
  ...['zarqa-poster.jpg', 'episode-1.jpg', 'episode-2.jpg', 'episode-3.jpg', 'cinzel.woff2',
    'ibm-plex-arabic.woff2', 'raven-intro-poster.jpg', 'hero-poster.jpg', 'hero-loop.mp4',
    'raven-intro.mp4'].map(name => 'raven/terminal-preview/assets/' + name),
  'fourth-signature/index.html', 'fourth-signature/favicon.svg',
  'fourth-signature/assets/fonts/NotoSansArabic.ttf',
  'fourth-signature/assets/audio/raven-dark-pop-intimate-revised.mp3',
  'assets/raven-home-share.jpg', 'assets/texts/raven-texts.js',
  ...['raven-intro-wide.mp4', 'raven-intro.jpg', 'raven-intro-wide.jpg', 'raven-intro.mp4'].map(name => 'assets/intro/' + name),
  ...Array.from({length:13}, (_, n) => `assets/audio/raven/${String(n + 1).padStart(2, '0')}.mp3`),
];
const routes = new Map(files.map(file => ['/' + file, file]));
const legacyCaseRoutes = new Map([
  ['/deleted-name', '/raven/deleted-name/'],
  ['/deleted-name/', '/raven/deleted-name/'],
  ['/deleted-name/index.html', '/raven/deleted-name/'],
  ['/deleted-name/content.html', '/raven/deleted-name/content.html'],
  ['/raven/deleted-name.html', '/raven/deleted-name/'],
]);
for (const file of files) if (file.endsWith('/index.html')) routes.set('/' + file.slice(0, -10), file);
// The pinned studio build retains its GitHub Pages base. Alias only reviewed studio routes.
for (const [route, file] of [...routes]) if (route.startsWith('/studio/')) routes.set('/abdulrhman' + route, file);
const mime = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.webp':'image/webp', '.png':'image/png',
  '.woff2':'font/woff2', '.ttf':'font/ttf', '.mp3':'audio/mpeg', '.mp4':'video/mp4'};
export const HOSTED_DIALOGUE_PATHS = new Set(['/raven/dialogue/', '/raven/dialogue/index.html']);

// Check the request target before URL() can normalize traversal. Public filenames are ASCII.
export function siteRequestPath(target) {
  const pathname = target.split('?')[0];
  if (!/^\/[A-Za-z0-9_./-]*$/.test(pathname) || pathname.includes('//') ||
      pathname.split('/').some(part => part.startsWith('.'))) return null;
  return pathname;
}

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
      if (pathname === '/abdulrhman/raven/index.html') return '/raven/';
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
        return {fd, stat, type:mime[path.extname(relative)], html:relative.endsWith('.html')};
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
    res.setHeader('Content-Security-Policy', siteContentSecurityPolicy(body.toString()));
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
