import type { AspectRatio, CameraMotion, ModelType } from '../types';

export const STUDIO_DRAFT_STORAGE_KEY = 'raven_studio_settings_draft_v1';

export const VALID_CAMERA_MOTIONS: readonly CameraMotion[] = [
  'drone-aerial',
  'dolly-zoom',
  'fpv-orbit',
  'pan-right',
  'pan-left',
  'tilt-up',
  'tilt-down',
  'static-tripod',
];

export const VALID_ASPECT_RATIOS: readonly AspectRatio[] = [
  '16:9',
  '9:16',
  '21:9',
  '1:1',
  '4:3',
];

export const VALID_DURATIONS: readonly number[] = [4, 8, 12, 16, 24];

export const VALID_MODELS: readonly ModelType[] = [
  'raven',
  'aleph2',
  'veo3.1',
  'gen-3-alpha',
];

const MAX_PROMPT_LENGTH = 20000;

export interface StudioSettingsDraft {
  promptText: string;
  negativePrompt: string;
  cameraMotion: CameraMotion;
  duration: number;
  aspectRatio: AspectRatio;
  cameraSpeed: number;
  activeModel: ModelType;
}

interface StoredStudioDraftPayload extends StudioSettingsDraft {
  version: 1;
  updatedAt: string;
}

function getDefaultStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function isSameDraft(
  a: StudioSettingsDraft,
  b: StudioSettingsDraft
): boolean {
  return (
    a.promptText === b.promptText &&
    a.negativePrompt === b.negativePrompt &&
    a.cameraMotion === b.cameraMotion &&
    a.duration === b.duration &&
    a.aspectRatio === b.aspectRatio &&
    a.cameraSpeed === b.cameraSpeed &&
    a.activeModel === b.activeModel
  );
}

export function parseStudioDraft(
  raw: string | null,
  fallback: StudioSettingsDraft
): { draft: StudioSettingsDraft; restored: boolean } {
  if (!raw) {
    return { draft: { ...fallback }, restored: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { draft: { ...fallback }, restored: false };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { draft: { ...fallback }, restored: false };
  }

  const record = parsed as Record<string, unknown>;

  const promptText =
    typeof record.promptText === 'string'
      ? record.promptText.slice(0, MAX_PROMPT_LENGTH)
      : fallback.promptText;

  const negativePrompt =
    typeof record.negativePrompt === 'string'
      ? record.negativePrompt.slice(0, MAX_PROMPT_LENGTH)
      : fallback.negativePrompt;

  const cameraMotion =
    typeof record.cameraMotion === 'string' &&
    VALID_CAMERA_MOTIONS.includes(record.cameraMotion as CameraMotion)
      ? (record.cameraMotion as CameraMotion)
      : fallback.cameraMotion;

  const duration =
    typeof record.duration === 'number' &&
    VALID_DURATIONS.includes(record.duration)
      ? record.duration
      : fallback.duration;

  const aspectRatio =
    typeof record.aspectRatio === 'string' &&
    VALID_ASPECT_RATIOS.includes(record.aspectRatio as AspectRatio)
      ? (record.aspectRatio as AspectRatio)
      : fallback.aspectRatio;

  const cameraSpeed =
    typeof record.cameraSpeed === 'number' &&
    Number.isInteger(record.cameraSpeed) &&
    record.cameraSpeed >= 1 &&
    record.cameraSpeed <= 10
      ? record.cameraSpeed
      : fallback.cameraSpeed;

  const activeModel =
    typeof record.activeModel === 'string' &&
    VALID_MODELS.includes(record.activeModel as ModelType)
      ? (record.activeModel as ModelType)
      : fallback.activeModel;

  return {
    draft: {
      promptText,
      negativePrompt,
      cameraMotion,
      duration,
      aspectRatio,
      cameraSpeed,
      activeModel,
    },
    restored: true,
  };
}

export function loadStudioDraft(
  fallback: StudioSettingsDraft,
  storage?: Storage | null
): { draft: StudioSettingsDraft; restored: boolean } {
  const target = storage === undefined ? getDefaultStorage() : storage;
  if (!target) {
    return { draft: { ...fallback }, restored: false };
  }

  try {
    const raw = target.getItem(STUDIO_DRAFT_STORAGE_KEY);
    return parseStudioDraft(raw, fallback);
  } catch {
    return { draft: { ...fallback }, restored: false };
  }
}

export function saveStudioDraft(
  draft: StudioSettingsDraft,
  storage?: Storage | null
): boolean {
  const target = storage === undefined ? getDefaultStorage() : storage;
  if (!target) return false;

  const payload: StoredStudioDraftPayload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    promptText: draft.promptText.slice(0, MAX_PROMPT_LENGTH),
    negativePrompt: draft.negativePrompt.slice(0, MAX_PROMPT_LENGTH),
    cameraMotion: draft.cameraMotion,
    duration: draft.duration,
    aspectRatio: draft.aspectRatio,
    cameraSpeed: draft.cameraSpeed,
    activeModel: draft.activeModel,
  };

  try {
    target.setItem(STUDIO_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearStudioDraft(storage?: Storage | null): boolean {
  const target = storage === undefined ? getDefaultStorage() : storage;
  if (!target) return false;

  try {
    target.removeItem(STUDIO_DRAFT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
