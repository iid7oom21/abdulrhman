// Validate the fields consumed by the editor before restoring browser data.
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const strings = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => typeof value[key] === 'string');
const motions = [
  'drone-aerial',
  'dolly-zoom',
  'pan-right',
  'pan-left',
  'tilt-up',
  'tilt-down',
  'fpv-orbit',
  'static-tripod',
];

export function isProjectList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (project) =>
        record(project) &&
        strings(project, ['id', 'title', 'promptText', 'thumbnailUrl']) &&
        ['raven', 'aleph2', 'veo3.1', 'gen-3-alpha'].includes(
          project.model as string,
        ) &&
        ['16:9', '9:16', '21:9', '1:1', '4:3'].includes(
          project.aspectRatio as string,
        ) &&
        [4, 8, 12, 16].includes(project.duration as number) &&
        (project.negativePrompt === undefined ||
          typeof project.negativePrompt === 'string') &&
        (project.videoUrl === undefined ||
          typeof project.videoUrl === 'string') &&
        record(project.camera) &&
        motions.includes(project.camera.motion as string) &&
        typeof project.camera.speed === 'number' &&
        project.camera.speed >= 1 &&
        project.camera.speed <= 10 &&
        typeof project.camera.lens === 'string' &&
        [24, 30, 60].includes(project.camera.fps as number),
    )
  );
}

export function isSceneList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (scene) =>
        record(scene) &&
        strings(scene, ['id', 'title', 'prompt', 'thumbnail', 'transition']) &&
        motions.includes(scene.camera as string) &&
        typeof scene.duration === 'number' &&
        typeof scene.sceneNumber === 'number',
    )
  );
}
