import { node, arabic } from './dom.js?v=dossier-1';

const WIDTH = 1080;
const HEIGHT = 1350;
const FILE_NAME = 'raven-fourth-signature-seal.png';
const INK = '#172019';
const GOLD = '#d5b582';

function rule(context, x, y, width, opacity = 0.4) {
  context.save();
  context.strokeStyle = `rgba(213,181,130,${opacity})`;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + width, y);
  context.stroke();
  context.restore();
}

function lettering(context, value, y, size, color = GOLD, weight = 500) {
  context.direction = 'rtl';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `${weight} ${size}px RavenArabic, Tahoma, sans-serif`;
  context.fillStyle = color;
  context.fillText(value, WIDTH / 2, y);
}

function titleLines(context, title) {
  context.font = '500 76px RavenArabic, Tahoma, sans-serif';
  const lines = [];
  let line = '';
  for (const word of title.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > 800) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

async function makeSeal(title, hintCount) {
  // Load the site's bundled Arabic font before rasterizing; no remote assets are used.
  if (document.fonts) {
    let timer;
    try {
      await Promise.race([
        document.fonts.load('500 76px RavenArabic', `${title} اكتمل فحص المحضر`),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Font timed out')), 8000); })
      ]);
    } finally { clearTimeout(timer); }
  }
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');

  context.fillStyle = INK;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = context.createRadialGradient(540, 530, 30, 540, 530, 850);
  glow.addColorStop(0, '#2b3428');
  glow.addColorStop(1, INK);
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.strokeStyle = 'rgba(213,181,130,.5)';
  context.lineWidth = 2;
  context.strokeRect(42, 42, WIDTH - 84, HEIGHT - 84);
  context.strokeStyle = 'rgba(213,181,130,.16)';
  context.lineWidth = 1;
  context.strokeRect(54, 54, WIDTH - 108, HEIGHT - 108);
  for (const [x, y, dx, dy] of [[42, 42, 1, 1], [1038, 42, -1, 1], [42, 1308, 1, -1], [1038, 1308, -1, -1]]) {
    context.strokeStyle = GOLD;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(x, y + dy * 40);
    context.lineTo(x, y);
    context.lineTo(x + dx * 40, y);
    context.stroke();
  }

  context.direction = 'ltr';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '64px Georgia, serif';
  context.fillStyle = GOLD;
  context.fillText('R A V E N', 540, 178);
  rule(context, 430, 246, 220);
  lettering(context, `الملف ${arabic('017').padStart(3, arabic(0))}`, 304, 25, '#c6c1ad', 400);

  // A quiet archive number gives the exported card its own visual weight.
  context.save();
  context.direction = 'ltr';
  context.font = '350px Georgia, serif';
  context.fillStyle = 'rgba(213,181,130,.045)';
  context.fillText('017', 540, 590);
  context.restore();

  const lines = titleLines(context, title);
  const titleSize = lines.length > 2 ? 52 : 76;
  const lineHeight = titleSize * 1.6;
  const firstLine = 534 - (lines.length - 1) * lineHeight / 2;
  lines.forEach((line, index) => lettering(context, line, firstLine + index * lineHeight, titleSize, '#f2e7d2'));
  lettering(context, 'اكتمل فحص المحضر', 725, 32, '#ced5c3', 400);

  context.save();
  context.translate(540, 910);
  context.rotate(-0.06);
  context.strokeStyle = 'rgba(213,181,130,.75)';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, 101, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = 'rgba(213,181,130,.28)';
  context.beginPath();
  context.arc(0, 0, 92, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = GOLD;
  context.lineWidth = 5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(-20, -18);
  context.lineTo(-4, -1);
  context.lineTo(27, -32);
  context.stroke();
  context.direction = 'rtl';
  context.font = '500 26px RavenArabic, Tahoma, sans-serif';
  context.fillStyle = GOLD;
  context.fillText('تم الفحص', 0, 42);
  context.restore();

  if (hintCount !== null) lettering(context, `التلميحات المستخدمة: ${arabic(hintCount)}`, 1080, 25, '#c6c1ad', 400);
  rule(context, 150, 1151, 780, 0.25);
  lettering(context, 'لكل أثر رواية. ولكل رواية ما ينقصها.', 1211, 24, '#bcbca9', 400);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png');
  });
}

function downloadSeal(blob) {
  const url = URL.createObjectURL(blob);
  const link = node('a', { href: url, download: FILE_NAME, hidden: true });
  let timer;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearTimeout(timer);
    URL.revokeObjectURL(url);
    window.removeEventListener('pagehide', release);
  };
  try {
    document.body.append(link);
    link.click();
  } catch (error) {
    release();
    throw error;
  } finally { link.remove(); }
  // Give mobile browsers time to begin the download before releasing its URL.
  window.addEventListener('pagehide', release, { once: true });
  timer = setTimeout(release, 30000);
}

export function createCaseSeal({ title = 'التوقيع الرابع', hintCount = null } = {}) {
  const caseTitle = typeof title === 'string' && title.trim() ? title.trim().slice(0, 70) : 'التوقيع الرابع';
  const usedHints = Number.isSafeInteger(hintCount) && hintCount >= 0 ? hintCount : null;
  const status = node('p', { class: 'case-seal-status', role: 'status', 'aria-live': 'polite', text: 'يجري تجهيز صورة الختم…' });
  const save = node('button', { type: 'button', class: 'button button-outline case-seal-save', disabled: true, text: 'احفظ الختم كصورة' });
  const share = node('button', { type: 'button', class: 'button button-outline case-seal-share', hidden: true, disabled: true, text: 'شارك الختم' });
  const stamp = node('div', { class: 'case-seal-mark', 'aria-hidden': 'true' }, [
    node('span', { text: 'RAVEN', lang: 'en', dir: 'ltr' }),
    node('strong', { text: '017', lang: 'en', dir: 'ltr' })
  ]);
  const section = node('section', { class: 'case-seal', dir: 'rtl', 'aria-label': 'ختم إتمام التحقيق' }, [
    stamp,
    node('div', { class: 'case-seal-copy' }, [
      node('p', { class: 'case-seal-kicker', text: 'الملف ٠١٧ · اكتمل فحص المحضر' }),
      node('h3', { text: caseTitle }),
      usedHints === null ? null : node('p', { class: 'case-seal-hints', text: `التلميحات المستخدمة: ${arabic(usedHints)}` })
    ]),
    node('div', { class: 'case-seal-actions' }, [save, share]),
    status
  ]);

  let blob = null;
  let file = null;
  let preparing = false;
  let readyMessage = 'صورة بلا تفاصيل الحل؛ احفظها وشاركها من جهازك.';
  const tell = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle('case-seal-error', error);
  };
  const prepare = async () => {
    if (preparing) return;
    preparing = true;
    save.disabled = true;
    tell('يجري تجهيز صورة الختم…');
    try {
      blob = await makeSeal(caseTitle, usedHints);
      if (typeof File === 'function' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
        file = new File([blob], FILE_NAME, { type: 'image/png' });
        try { share.hidden = !navigator.canShare({ files: [file] }); }
        catch { share.hidden = true; }
      }
      share.disabled = false;
      save.textContent = 'احفظ الختم كصورة';
      if (!share.hidden) readyMessage = 'صورة بلا تفاصيل الحل؛ جاهزة للحفظ أو المشاركة.';
      tell(readyMessage);
    } catch {
      tell('تعذّر تجهيز صورة الختم. حاول مجددًا.', true);
      save.textContent = 'أعد تجهيز الختم';
    } finally {
      preparing = false;
      save.disabled = false;
    }
  };

  save.addEventListener('click', () => {
    if (!blob) { void prepare(); return; }
    try {
      downloadSeal(blob);
      tell('بدأ تنزيل الختم. ستجده ضمن تنزيلات جهازك.');
    } catch { tell('تعذّر تنزيل الصورة. حاول مجددًا أو استخدم المشاركة إن كانت متاحة.', true); }
  });
  share.addEventListener('click', async () => {
    if (!file || share.disabled) return;
    const previous = status.textContent;
    share.disabled = true;
    try {
      // The PNG is already prepared so this call retains the user's tap activation.
      await navigator.share({ files: [file], title: `RAVEN — ${caseTitle}`, text: 'الملف ٠١٧ · اكتمل فحص المحضر' });
      tell('تمت مشاركة الختم.');
    } catch (error) {
      if (error?.name === 'AbortError') tell(previous);
      else tell('تعذّرت المشاركة. احفظ الصورة ثم شاركها من جهازك.', true);
    } finally { share.disabled = false; }
  });
  void prepare();
  return section;
}
