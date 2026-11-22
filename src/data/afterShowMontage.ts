import type { StoryboardScene } from '../types';

type Language = 'ar' | 'en';
const SHOTS = {
  exterior: {seconds: 5, ar: ['واجهة المبنى', 'لقطة ثابتة تعرّف بالمكان.'], en: ['Building exterior', 'Hold on the exterior to establish the location.']},
  hand: {seconds: 4, ar: ['اليد والظرف', 'تضع يدٌ الظرف على سطح الطاولة.'], en: ['Hand and envelope', 'A hand places the envelope on the table.']},
  envelope: {seconds: 3, ar: ['الظرف على الطاولة', 'تستقر اللقطة على الظرف بعد وضعه.'], en: ['Envelope on the table', 'Hold on the envelope resting on the table.']},
  lamp: {seconds: 6, ar: ['المصباح', 'لقطة ثابتة للمصباح.'], en: ['Lamp', 'Hold on the lamp.']},
} as const;

type ShotId = keyof typeof SHOTS;
const EDITING_ROUTES = ['edit', 'free', 'duo', 'brief', 'custom', 'daily'];

export interface Montage {
  shots: ShotId[];
  route: string;
}

export function readMontageQuery(search: string): Montage | 'invalid' | null {
  const params = new URLSearchParams(search);
  const selections = params.getAll('afterShow');
  if (!selections.length) return null;
  const ids = selections[0].split(',');
  if (selections.length !== 1 || ids.length > 4 || !ids.every((id): id is ShotId => Object.hasOwn(SHOTS, id))) {
    return 'invalid';
  }
  const source = params.get('from');
  return {shots: ids, route: source && EDITING_ROUTES.includes(source) ? source : 'edit'};
}

export function montageScenes(montage: Montage, lang: Language): StoryboardScene[] {
  return montage.shots.map((id, index) => {
    const shot = SHOTS[id];
    const [title, prompt] = shot[lang];
    return {
      id: `after-show-${index + 1}-${id}`, sceneNumber: index + 1, title, prompt,
      duration: shot.seconds, camera: 'static-tripod', transition: 'cut',
      thumbnail: `../raven/after-show/assets/${id}.webp`,
    };
  });
}

export function localizeMontageScenes(
  scenes: StoryboardScene[], montage: Montage, from: Language, to: Language
): StoryboardScene[] {
  const source = montageScenes(montage, from);
  const translated = montageScenes(montage, to);
  return scenes.map(scene => {
    const index = source.findIndex(original => original.id === scene.id);
    if (index < 0) return scene;
    return {...scene, title: translated[index].title,
      prompt: scene.prompt === source[index].prompt ? translated[index].prompt : scene.prompt};
  });
}

export function returnToEdit(montage: Montage | 'invalid', lang: Language): string {
  const route = montage === 'invalid' ? 'edit' : montage.route;
  return '../raven/after-show/?' + new URLSearchParams({activity: route, lang}).toString();
}
