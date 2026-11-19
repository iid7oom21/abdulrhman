import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App } from '../App';
import {
  STUDIO_DRAFT_STORAGE_KEY,
  clearStudioDraft,
  loadStudioDraft,
  parseStudioDraft,
  saveStudioDraft,
  type StudioSettingsDraft,
} from './studioDraftStorage';

const FALLBACK_DRAFT: StudioSettingsDraft = {
  promptText: 'Default prompt',
  negativePrompt: '',
  cameraMotion: 'dolly-zoom',
  duration: 24,
  aspectRatio: '16:9',
  cameraSpeed: 2,
  activeModel: 'raven',
};

describe('studioDraftStorage pure helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves and restores a valid control-panel draft', () => {
    const edited: StudioSettingsDraft = {
      promptText: 'مشهد ليلي في المكتبة مع مطر خفيف',
      negativePrompt: 'blurry',
      cameraMotion: 'fpv-orbit',
      duration: 12,
      aspectRatio: '21:9',
      cameraSpeed: 8,
      activeModel: 'veo3.1',
    };

    expect(saveStudioDraft(edited)).toBe(true);
    const loaded = loadStudioDraft(FALLBACK_DRAFT);
    expect(loaded.restored).toBe(true);
    expect(loaded.draft).toEqual(edited);
  });

  it('falls back safely on corrupted JSON or non-object payloads', () => {
    expect(parseStudioDraft('{not-valid-json', FALLBACK_DRAFT)).toEqual({
      draft: FALLBACK_DRAFT,
      restored: false,
    });
    expect(parseStudioDraft('[]', FALLBACK_DRAFT)).toEqual({
      draft: FALLBACK_DRAFT,
      restored: false,
    });
    expect(parseStudioDraft('null', FALLBACK_DRAFT)).toEqual({
      draft: FALLBACK_DRAFT,
      restored: false,
    });
  });

  it('validates each field individually and falls back for invalid values', () => {
    const raw = JSON.stringify({
      promptText: 'Valid custom prompt',
      negativePrompt: 12345,
      cameraMotion: 'invalid-motion',
      duration: 999,
      aspectRatio: '3:2',
      cameraSpeed: 42,
      activeModel: 'unknown-model',
    });

    const parsed = parseStudioDraft(raw, FALLBACK_DRAFT);
    expect(parsed.restored).toBe(true);
    expect(parsed.draft).toEqual({
      promptText: 'Valid custom prompt',
      negativePrompt: FALLBACK_DRAFT.negativePrompt,
      cameraMotion: FALLBACK_DRAFT.cameraMotion,
      duration: FALLBACK_DRAFT.duration,
      aspectRatio: FALLBACK_DRAFT.aspectRatio,
      cameraSpeed: FALLBACK_DRAFT.cameraSpeed,
      activeModel: FALLBACK_DRAFT.activeModel,
    });
  });

  it('handles storage errors gracefully without throwing', () => {
    const brokenStorage = {
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
      removeItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
    } as unknown as Storage;

    expect(loadStudioDraft(FALLBACK_DRAFT, brokenStorage)).toEqual({
      draft: FALLBACK_DRAFT,
      restored: false,
    });
    expect(saveStudioDraft(FALLBACK_DRAFT, brokenStorage)).toBe(false);
    expect(clearStudioDraft(brokenStorage)).toBe(false);
  });
});

describe('App control panel localStorage autosave', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('autosaves Prompt, Camera Motion, Duration, Aspect Ratio, Speed, and Model and restores them after reload', () => {
    const { unmount } = render(<App />);

    // Fresh load without edits should not pollute localStorage
    expect(window.localStorage.getItem(STUDIO_DRAFT_STORAGE_KEY)).toBeNull();

    const promptInput = screen.getByLabelText(/وصف المشهد السينمائي/) as HTMLTextAreaElement;
    const cameraSelect = screen.getByLabelText(/حركة الكاميرا/) as HTMLSelectElement;
    const durationSelect = screen.getByLabelText(/المدة/) as HTMLSelectElement;
    const speedSlider = screen.getByLabelText(/سرعة الحركة/) as HTMLInputElement;
    const modelSelect = screen
      .getAllByRole('combobox')
      .find((el) => (el as HTMLSelectElement).value === 'raven') as HTMLSelectElement;
    expect(modelSelect).toBeDefined();

    fireEvent.change(promptInput, { target: { value: 'ممر حجري مظلم مع ضوء شمعة متحرك' } });
    fireEvent.change(cameraSelect, { target: { value: 'fpv-orbit' } });
    fireEvent.change(durationSelect, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: '21:9' }));
    fireEvent.change(speedSlider, { target: { value: '8' } });
    fireEvent.change(modelSelect, { target: { value: 'veo3.1' } });

    const storedRaw = window.localStorage.getItem(STUDIO_DRAFT_STORAGE_KEY);
    expect(storedRaw).not.toBeNull();
    const stored = JSON.parse(storedRaw!);
    expect(stored.promptText).toBe('ممر حجري مظلم مع ضوء شمعة متحرك');
    expect(stored.cameraMotion).toBe('fpv-orbit');
    expect(stored.duration).toBe(12);
    expect(stored.aspectRatio).toBe('21:9');
    expect(stored.cameraSpeed).toBe(8);
    expect(stored.activeModel).toBe('veo3.1');

    // Simulate full page refresh by unmounting and remounting App
    unmount();
    render(<App />);

    expect((screen.getByLabelText(/وصف المشهد السينمائي/) as HTMLTextAreaElement).value).toBe(
      'ممر حجري مظلم مع ضوء شمعة متحرك'
    );
    expect((screen.getByLabelText(/حركة الكاميرا/) as HTMLSelectElement).value).toBe('fpv-orbit');
    expect((screen.getByLabelText(/المدة/) as HTMLSelectElement).value).toBe('12');
    expect((screen.getByLabelText(/سرعة الحركة/) as HTMLInputElement).value).toBe('8');
    expect(screen.getByRole('button', { name: '21:9' }).className).toContain('border-indigo-500');

    // Clicking reset draft clears localStorage and restores defaults
    fireEvent.click(screen.getByRole('button', { name: /إعادة تعيين المسودة/ }));
    expect(window.localStorage.getItem(STUDIO_DRAFT_STORAGE_KEY)).toBeNull();
    expect((screen.getByLabelText(/حركة الكاميرا/) as HTMLSelectElement).value).toBe('dolly-zoom');
    expect((screen.getByLabelText(/المدة/) as HTMLSelectElement).value).toBe('24');
    expect((screen.getByLabelText(/سرعة الحركة/) as HTMLInputElement).value).toBe('2');
  });
});
