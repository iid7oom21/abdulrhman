import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { App } from '../App';
import type { StoryboardScene } from '../types';
import {
  buildJpegPagesPdfBytes,
  buildStoryboardFilename,
  buildStoryboardJsonPayload,
  buildTextFallbackPdfBytes,
  serializeStoryboardJson,
} from './storyboardExport';

const SAMPLE_SCENES: StoryboardScene[] = [
  {
    id: 'sc-2',
    sceneNumber: 2,
    title: 'Archive Desk Close-Up',
    prompt: 'Warm lamplight over handwritten parchment inside the dark oak archive.',
    duration: 6,
    camera: 'dolly-zoom',
    thumbnail: '/visual-lab/assets/03-desk.webp',
    transition: 'fade',
  },
  {
    id: 'sc-1',
    sceneNumber: 1,
    title: 'Manor Establishing Shot',
    prompt: 'Slow drone approach toward the rainy gothic manor at dusk.',
    duration: 8,
    camera: 'drone-aerial',
    thumbnail: '/visual-lab/assets/01-manor.webp',
    transition: 'dissolve',
  },
];

function decodeLatin1(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function assertValidPdfXref(bytes: Uint8Array): void {
  const text = decodeLatin1(bytes);
  expect(text.startsWith('%PDF-1.4\n')).toBe(true);
  expect(text.trimEnd().endsWith('%%EOF')).toBe(true);

  const xrefMatch = text.match(/startxref\n(\d+)\n%%EOF/);
  expect(xrefMatch).not.toBeNull();
  const startXref = Number(xrefMatch![1]);
  expect(text.slice(startXref, startXref + 4)).toBe('xref');

  const xrefSection = text.slice(startXref, text.indexOf('trailer', startXref));
  const entryLines = xrefSection
    .split('\n')
    .filter((line) => /^\d{10} 00000 n $/.test(line));
  expect(entryLines.length).toBeGreaterThan(0);

  entryLines.forEach((line, idx) => {
    const offset = Number(line.slice(0, 10));
    const expectedHeader = `${idx + 1} 0 obj\n`;
    expect(text.slice(offset, offset + expectedHeader.length)).toBe(expectedHeader);
  });
}

describe('storyboardExport pure helpers', () => {
  it('formats UTC-dated filenames for JSON and PDF', () => {
    const fixedDate = new Date('2026-11-19T12:00:00Z');
    expect(buildStoryboardFilename('json', fixedDate)).toBe('raven-storyboard-2026-11-19.json');
    expect(buildStoryboardFilename('pdf', fixedDate)).toBe('raven-storyboard-2026-11-19.pdf');
  });

  it('serializes scenes sorted by sceneNumber with project summary metadata', () => {
    const fixedDate = new Date('2026-11-19T12:00:00Z');
    const payload = buildStoryboardJsonPayload(SAMPLE_SCENES, {
      model: 'raven',
      aspectRatio: '16:9',
      lang: 'en',
      exportedAt: fixedDate,
    });

    expect(payload.schemaVersion).toBe(1);
    expect(payload.exportedAt).toBe('2026-11-19T12:00:00.000Z');
    expect(payload.project).toEqual({
      name: 'RAVEN Studio',
      model: 'raven',
      aspectRatio: '16:9',
      totalScenes: 2,
      totalDurationSec: 14,
    });
    expect(payload.scenes.map((s) => s.sceneNumber)).toEqual([1, 2]);
    expect(payload.scenes[0].title).toBe('Manor Establishing Shot');

    const jsonString = serializeStoryboardJson(SAMPLE_SCENES, {
      model: 'raven',
      aspectRatio: '16:9',
      lang: 'en',
      exportedAt: fixedDate,
    });
    expect(JSON.parse(jsonString)).toEqual(payload);
  });

  it('builds a spec-compliant multi-page JPEG PDF with exact xref byte offsets', () => {
    const fakeJpegA = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
    const fakeJpegB = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x11, 0x22, 0xff, 0xd9]);

    const pdfBytes = buildJpegPagesPdfBytes([
      { jpegBytes: fakeJpegA, widthPx: 1190, heightPx: 1684 },
      { jpegBytes: fakeJpegB, widthPx: 1190, heightPx: 1684 },
    ]);

    assertValidPdfXref(pdfBytes);
    const text = decodeLatin1(pdfBytes);
    expect(text).toContain('/Count 2');
    expect(text).toContain('/Filter /DCTDecode');
  });

  it('builds a valid paginated vector-text PDF fallback with scene details', () => {
    const manyScenes: StoryboardScene[] = Array.from({ length: 18 }, (_, idx) => ({
      id: `sc-${idx + 1}`,
      sceneNumber: idx + 1,
      title: `Sequence Beat ${idx + 1}`,
      prompt: 'A dramatic tracking shot moving down the rain-swept stone corridor with warm lantern reflections.',
      duration: 5,
      camera: 'dolly-zoom',
      thumbnail: '/visual-lab/assets/04-corridor.webp',
      transition: 'dissolve',
    }));

    const pdfBytes = buildTextFallbackPdfBytes(manyScenes, {
      model: 'veo3.1',
      aspectRatio: '21:9',
      lang: 'en',
      exportedAt: new Date('2026-11-19T12:00:00Z'),
    });

    assertValidPdfXref(pdfBytes);
    const text = decodeLatin1(pdfBytes);
    expect(text).toContain('Sequence Beat 1');
    expect(text).toContain('Sequence Beat 18');
    expect(text).toContain('Page 2 /');
  });
});

describe('Storyboard download controls in App', () => {
  const createdBlobs: Blob[] = [];
  const clickedDownloads: string[] = [];
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    window.localStorage.clear();
    createdBlobs.length = 0;
    clickedDownloads.length = 0;

    URL.createObjectURL = vi.fn((blob: Blob) => {
      createdBlobs.push(blob);
      return `blob:mock-${createdBlobs.length}`;
    });
    URL.revokeObjectURL = vi.fn();

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownloads.push(this.download);
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('downloads formatted JSON and PDF including newly added scenes, and disables export when empty', async () => {
    render(<App />);

    // Open Storyboard tab
    fireEvent.click(screen.getByRole('button', { name: 'لوحة المشاهد' }));

    // Add a custom scene to verify dynamic sequence export
    fireEvent.change(screen.getByLabelText('عنوان المشهد'), {
      target: { value: 'لقطة الختام' },
    });
    fireEvent.change(screen.getByLabelText('وصف اللقطة'), {
      target: { value: 'انسحاب بطيء للكاميرا خارج بوابة القصر تحت المطر' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'إضافة مشهد' }));

    // Export JSON
    fireEvent.click(screen.getByRole('button', { name: /تنزيل JSON/ }));
    expect(clickedDownloads[0]).toMatch(/^raven-storyboard-\d{4}-\d{2}-\d{2}\.json$/);
    expect(createdBlobs[0].type).toContain('application/json');

    const jsonText = await createdBlobs[0].text();
    const parsed = JSON.parse(jsonText);
    expect(parsed.project.totalScenes).toBe(4);
    expect(parsed.scenes[3].title).toBe('لقطة الختام');

    // Export PDF
    fireEvent.click(screen.getByRole('button', { name: /تنزيل PDF/ }));
    expect(clickedDownloads[1]).toMatch(/^raven-storyboard-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(createdBlobs[1].type).toBe('application/pdf');

    const pdfBuffer = new Uint8Array(await createdBlobs[1].arrayBuffer());
    assertValidPdfXref(pdfBuffer);

    // Delete all scenes -> export buttons become disabled
    const deleteButtons = screen.getAllByTitle('حذف المشهد');
    for (const btn of deleteButtons) {
      fireEvent.click(btn);
    }

    expect(screen.getByRole('button', { name: /تنزيل PDF|تم تنزيل PDF/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /تنزيل JSON|تم تنزيل JSON/ })).toBeDisabled();
  });
});
