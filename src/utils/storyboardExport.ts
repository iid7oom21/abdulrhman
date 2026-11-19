import type { AspectRatio, ModelType, StoryboardScene } from '../types';

export interface StoryboardExportMeta {
  model: ModelType;
  aspectRatio: AspectRatio;
  lang: 'en' | 'ar';
  exportedAt?: Date;
}

export interface StoryboardJsonScene {
  sceneNumber: number;
  id: string;
  title: string;
  prompt: string;
  durationSec: number;
  camera: StoryboardScene['camera'];
  transition: StoryboardScene['transition'];
  thumbnail: string;
}

export interface StoryboardJsonPayload {
  schemaVersion: 1;
  exportedAt: string;
  language: 'en' | 'ar';
  project: {
    name: string;
    model: ModelType;
    aspectRatio: AspectRatio;
    totalScenes: number;
    totalDurationSec: number;
  };
  scenes: StoryboardJsonScene[];
}

export interface StoryboardPdfPageImage {
  jpegBytes: Uint8Array;
  widthPx: number;
  heightPx: number;
}

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const CANVAS_WIDTH_PX = 1190;
const CANVAS_HEIGHT_PX = 1684;

const textEncoder = new TextEncoder();

export function buildStoryboardFilename(
  format: 'json' | 'pdf',
  date: Date = new Date()
): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `raven-storyboard-${yyyy}-${mm}-${dd}.${format}`;
}

export function buildStoryboardJsonPayload(
  scenes: readonly StoryboardScene[],
  meta: StoryboardExportMeta
): StoryboardJsonPayload {
  const exportedAt = (meta.exportedAt ?? new Date()).toISOString();
  const ordered = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  const totalDurationSec = ordered.reduce((sum, s) => sum + s.duration, 0);

  return {
    schemaVersion: 1,
    exportedAt,
    language: meta.lang,
    project: {
      name: 'RAVEN Studio',
      model: meta.model,
      aspectRatio: meta.aspectRatio,
      totalScenes: ordered.length,
      totalDurationSec,
    },
    scenes: ordered.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      id: scene.id,
      title: scene.title,
      prompt: scene.prompt,
      durationSec: scene.duration,
      camera: scene.camera,
      transition: scene.transition,
      thumbnail: scene.thumbnail,
    })),
  };
}

export function serializeStoryboardJson(
  scenes: readonly StoryboardScene[],
  meta: StoryboardExportMeta
): string {
  return `${JSON.stringify(buildStoryboardJsonPayload(scenes, meta), null, 2)}\n`;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

function encodeAscii(str: string): Uint8Array {
  return textEncoder.encode(str);
}

function escapePdfString(value: string): string {
  // Sanitize to printable ASCII for Type1 Helvetica fallback stream
  const ascii = value
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
  return ascii;
}

function wrapTextByChars(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function assemblePdfFromObjects(
  objects: readonly Uint8Array[]
): Uint8Array {
  const chunks: Uint8Array[] = [];
  // Standard PDF 1.4 binary header
  const header = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, // %PDF-1.4\n
    0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a, // binary comment line
  ]);
  chunks.push(header);

  let offset = header.length;
  const offsets: number[] = [0];

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(offset);
    const objPrefix = encodeAscii(`${i + 1} 0 obj\n`);
    const objSuffix = encodeAscii('\nendobj\n');
    chunks.push(objPrefix, objects[i], objSuffix);
    offset += objPrefix.length + objects[i].length + objSuffix.length;
  }

  const xrefOffset = offset;
  const xrefLines = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((pos) => `${String(pos).padStart(10, '0')} 00000 n `),
  ];
  const trailer = [
    ...xrefLines,
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF\n',
  ].join('\n');

  chunks.push(encodeAscii(trailer));
  return concatBytes(chunks);
}

export function buildJpegPagesPdfBytes(
  pages: readonly StoryboardPdfPageImage[]
): Uint8Array {
  if (pages.length === 0) {
    throw new Error('Cannot build PDF with zero pages');
  }

  const pageObjIds = pages.map((_, idx) => 3 + idx * 3);
  const objects: Uint8Array[] = [
    // 1: Catalog
    encodeAscii('<< /Type /Catalog /Pages 2 0 R >>'),
    // 2: Pages
    encodeAscii(
      `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
    ),
  ];

  for (let i = 0; i < pages.length; i += 1) {
    const page = pages[i];
    const contentObjId = 4 + i * 3;
    const imageObjId = 5 + i * 3;

    // Page object
    objects.push(
      encodeAscii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] /Resources << /XObject << /Im1 ${imageObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`
      )
    );

    // Content stream drawing the full-bleed A4 image
    const stream = `q\n${A4_WIDTH_PT} 0 0 ${A4_HEIGHT_PT} 0 0 cm\n/Im1 Do\nQ\n`;
    const streamBytes = encodeAscii(stream);
    objects.push(
      concatBytes([
        encodeAscii(`<< /Length ${streamBytes.length} >>\nstream\n`),
        streamBytes,
        encodeAscii('endstream'),
      ])
    );

    // Image XObject (JPEG / DCTDecode)
    objects.push(
      concatBytes([
        encodeAscii(
          `<< /Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpegBytes.length} >>\nstream\n`
        ),
        page.jpegBytes,
        encodeAscii('\nendstream'),
      ])
    );
  }

  return assemblePdfFromObjects(objects);
}

export function buildTextFallbackPdfBytes(
  scenes: readonly StoryboardScene[],
  meta: StoryboardExportMeta
): Uint8Array {
  const payload = buildStoryboardJsonPayload(scenes, meta);
  const allLines: { text: string; size: number; bold?: boolean }[] = [
    { text: 'RAVEN Studio - Storyboard Sequence', size: 18, bold: true },
    {
      text: `Model: ${payload.project.model} | Aspect Ratio: ${payload.project.aspectRatio} | Scenes: ${payload.project.totalScenes} | Total: ${payload.project.totalDurationSec}s`,
      size: 10,
    },
    { text: `Exported: ${payload.exportedAt}`, size: 9 },
    { text: '------------------------------------------------------------------------------', size: 10 },
  ];

  if (payload.scenes.length === 0) {
    allLines.push({ text: 'No scenes in storyboard.', size: 11 });
  } else {
    for (const scene of payload.scenes) {
      allLines.push({
        text: `Scene #${scene.sceneNumber}: ${scene.title}`,
        size: 13,
        bold: true,
      });
      allLines.push({
        text: `Camera: ${scene.camera} | Duration: ${scene.durationSec}s | Transition: ${scene.transition}`,
        size: 10,
      });
      for (const wrapped of wrapTextByChars(scene.prompt, 84)) {
        allLines.push({ text: `  ${wrapped}`, size: 10 });
      }
      allLines.push({ text: '', size: 8 });
    }
  }

  // Paginate lines across A4 pages
  const marginTop = 790;
  const marginBottom = 56;
  const pageStreams: string[] = [];
  let commands: string[] = [];
  let y = marginTop;

  const flushPage = () => {
    pageStreams.push(commands.join('\n'));
    commands = [];
    y = marginTop;
  };

  for (const line of allLines) {
    const lineHeight = line.size + 6;
    if (y - lineHeight < marginBottom) {
      flushPage();
    }
    if (line.text) {
      const fontName = line.bold ? '/F2' : '/F1';
      commands.push(
        `BT ${fontName} ${line.size} Tf 48 ${y.toFixed(1)} Td (${escapePdfString(line.text)}) Tj ET`
      );
    }
    y -= lineHeight;
  }
  if (commands.length > 0 || pageStreams.length === 0) {
    flushPage();
  }

  // Objects: 1=Catalog, 2=Pages, 3=Font Helvetica, 4=Font Helvetica-Bold, then pairs of (Page, Content)
  const pageObjIds = pageStreams.map((_, idx) => 5 + idx * 2);
  const objects: Uint8Array[] = [
    encodeAscii('<< /Type /Catalog /Pages 2 0 R >>'),
    encodeAscii(
      `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageStreams.length} >>`
    ),
    encodeAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),
    encodeAscii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'),
  ];

  for (let i = 0; i < pageStreams.length; i += 1) {
    const contentObjId = 6 + i * 2;
    const footer = `\nBT /F1 9 Tf 48 28 Td (Page ${i + 1} / ${pageStreams.length}) Tj ET\n`;
    const streamBytes = encodeAscii(pageStreams[i] + footer);

    objects.push(
      encodeAscii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>`
      )
    );
    objects.push(
      concatBytes([
        encodeAscii(`<< /Length ${streamBytes.length} >>\nstream\n`),
        streamBytes,
        encodeAscii('endstream'),
      ])
    );
  }

  return assemblePdfFromObjects(objects);
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function renderStoryboardCanvasPages(
  scenes: readonly StoryboardScene[],
  meta: StoryboardExportMeta
): StoryboardPdfPageImage[] | null {
  if (typeof document === 'undefined' || typeof atob === 'undefined') {
    return null;
  }

  const payload = buildStoryboardJsonPayload(scenes, meta);
  const isAr = meta.lang === 'ar';
  const fontFamily = isAr
    ? '"IBM Plex Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif'
    : '"Inter", "Segoe UI", system-ui, Arial, sans-serif';

  const padX = 72;
  const contentWidth = CANVAS_WIDTH_PX - padX * 2;
  const bottomLimit = CANVAS_HEIGHT_PX - 110;

  const canvases: HTMLCanvasElement[] = [];

  const startNewPage = (isFirstPage: boolean): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; y: number } | null => {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH_PX;
    canvas.height = CANVAS_HEIGHT_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.direction = isAr ? 'rtl' : 'ltr';
    ctx.textAlign = isAr ? 'right' : 'left';
    ctx.textBaseline = 'top';

    // Crisp white editorial background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH_PX, CANVAS_HEIGHT_PX);

    // Top dark header band
    const headerHeight = isFirstPage ? 196 : 96;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_WIDTH_PX, headerHeight);

    // Amber accent bar
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, headerHeight - 6, CANVAS_WIDTH_PX, 6);

    const anchorX = isAr ? CANVAS_WIDTH_PX - padX : padX;

    ctx.fillStyle = '#f59e0b';
    ctx.font = `700 20px ${fontFamily}`;
    ctx.fillText(
      isAr ? 'استوديو RAVEN — وثيقة تسلسل المشاهد' : 'RAVEN STUDIO — STORYBOARD SEQUENCE',
      anchorX,
      isFirstPage ? 36 : 34
    );

    if (isFirstPage) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 36px ${fontFamily}`;
      ctx.fillText(
        isAr ? 'تسلسل المشاهد السينمائية' : 'Cinematic Film Sequence',
        anchorX,
        74
      );

      ctx.fillStyle = '#cbd5e1';
      ctx.font = `500 20px ${fontFamily}`;
      const summaryLine = isAr
        ? `المشاهد: ${payload.project.totalScenes}   •   المدة الإجمالية: ${payload.project.totalDurationSec} ثانية   •   الأبعاد: ${payload.project.aspectRatio}   •   النموذج: ${payload.project.model}`
        : `Scenes: ${payload.project.totalScenes}   •   Total Duration: ${payload.project.totalDurationSec}s   •   Aspect Ratio: ${payload.project.aspectRatio}   •   Model: ${payload.project.model}`;
      ctx.fillText(summaryLine, anchorX, 134);
    }

    canvases.push(canvas);
    return { canvas, ctx, y: headerHeight + 40 };
  };

  let current = startNewPage(true);
  if (!current) return null;

  const anchorX = isAr ? CANVAS_WIDTH_PX - padX : padX;

  if (payload.scenes.length === 0) {
    current.ctx.fillStyle = '#475569';
    current.ctx.font = `500 24px ${fontFamily}`;
    current.ctx.fillText(
      isAr ? 'لا توجد مشاهد في لوحة التسلسل.' : 'No scenes in the storyboard.',
      anchorX,
      current.y
    );
  } else {
    for (const scene of payload.scenes) {
      const ctx = current.ctx;
      ctx.font = `400 22px ${fontFamily}`;
      const promptLines = wrapCanvasText(ctx, scene.prompt, contentWidth - 64);
      const cardHeight = 148 + promptLines.length * 32;

      if (current.y + cardHeight > bottomLimit) {
        const next = startNewPage(false);
        if (!next) return null;
        current = next;
      }

      const pageCtx = current.ctx;
      const cardY = current.y;

      // Card container
      drawRoundedRect(pageCtx, padX, cardY, contentWidth, cardHeight, 16);
      pageCtx.fillStyle = '#f8fafc';
      pageCtx.fill();
      pageCtx.lineWidth = 2;
      pageCtx.strokeStyle = '#e2e8f0';
      pageCtx.stroke();

      // Left/Right amber accent strip inside card
      const accentX = isAr ? padX + contentWidth - 8 : padX;
      pageCtx.fillStyle = '#f59e0b';
      pageCtx.fillRect(accentX, cardY + 14, 8, cardHeight - 28);

      const innerAnchorX = isAr ? padX + contentWidth - 36 : padX + 36;

      // Scene badge + title
      pageCtx.fillStyle = '#b45309';
      pageCtx.font = `700 22px ${fontFamily}`;
      const headerLabel = isAr
        ? `المشهد #${scene.sceneNumber} — ${scene.title}`
        : `Scene #${scene.sceneNumber} — ${scene.title}`;
      pageCtx.fillText(headerLabel, innerAnchorX, cardY + 24);

      // Prompt lines
      pageCtx.fillStyle = '#1e293b';
      pageCtx.font = `400 22px ${fontFamily}`;
      let textY = cardY + 66;
      for (const line of promptLines) {
        pageCtx.fillText(line, innerAnchorX, textY);
        textY += 32;
      }

      // Technical metadata line
      pageCtx.fillStyle = '#475569';
      pageCtx.font = `600 18px ${fontFamily}`;
      const specs = isAr
        ? `الكاميرا: ${scene.camera}   |   المدة: ${scene.durationSec}s   |   الانتقال: ${scene.transition}`
        : `Camera: ${scene.camera}   |   Duration: ${scene.durationSec}s   |   Transition: ${scene.transition}`;
      pageCtx.fillText(specs, innerAnchorX, cardY + cardHeight - 44);

      current.y += cardHeight + 24;
    }
  }

  // Stamp page numbers & export timestamp on every page footer
  const totalPages = canvases.length;
  const dateStamp = payload.exportedAt.slice(0, 10);
  const pageImages: StoryboardPdfPageImage[] = [];

  for (let i = 0; i < canvases.length; i += 1) {
    const canvas = canvases[i];
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX, CANVAS_HEIGHT_PX - 82);
    ctx.lineTo(CANVAS_WIDTH_PX - padX, CANVAS_HEIGHT_PX - 82);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = `500 18px ${fontFamily}`;
    ctx.direction = isAr ? 'rtl' : 'ltr';
    ctx.textAlign = 'left';
    ctx.fillText(`RAVEN Studio · ${dateStamp}`, padX, CANVAS_HEIGHT_PX - 62);
    ctx.textAlign = 'right';
    ctx.fillText(
      isAr ? `صفحة ${i + 1} من ${totalPages}` : `Page ${i + 1} of ${totalPages}`,
      CANVAS_WIDTH_PX - padX,
      CANVAS_HEIGHT_PX - 62
    );

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const prefix = 'data:image/jpeg;base64,';
    if (!dataUrl || !dataUrl.startsWith(prefix)) {
      return null;
    }
    const jpegBytes = decodeBase64ToBytes(dataUrl.slice(prefix.length));
    if (jpegBytes.length === 0) return null;

    pageImages.push({
      jpegBytes,
      widthPx: CANVAS_WIDTH_PX,
      heightPx: CANVAS_HEIGHT_PX,
    });
  }

  return pageImages;
}

export function buildStoryboardPdfBytes(
  scenes: readonly StoryboardScene[],
  meta: StoryboardExportMeta
): Uint8Array {
  const renderedPages = renderStoryboardCanvasPages(scenes, meta);
  if (renderedPages && renderedPages.length > 0) {
    return buildJpegPagesPdfBytes(renderedPages);
  }
  return buildTextFallbackPdfBytes(scenes, meta);
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function downloadStoryboardJson(
  scenes: readonly StoryboardScene[],
  meta: StoryboardExportMeta
): { filename: string; byteLength: number } {
  const json = serializeStoryboardJson(scenes, meta);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const filename = buildStoryboardFilename('json', meta.exportedAt);
  triggerBlobDownload(blob, filename);
  return { filename, byteLength: blob.size };
}

export function downloadStoryboardPdf(
  scenes: readonly StoryboardScene[],
  meta: StoryboardExportMeta
): { filename: string; byteLength: number } {
  const bytes = buildStoryboardPdfBytes(scenes, meta);
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const filename = buildStoryboardFilename('pdf', meta.exportedAt);
  triggerBlobDownload(blob, filename);
  return { filename, byteLength: blob.size };
}
