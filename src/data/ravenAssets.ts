import type { VideoProject } from "../types";

const ROOT = `${import.meta.env.BASE_URL}visual-lab`;

// The published RAVEN site is its own deployment (the gh-pages branch). The studio
// links to it rather than bundling a copy, so readers always get the current site
// and no stale snapshot of it ships inside this app.
export const RAVEN_HOME_URL = 'https://iid7oom21.github.io/abdulrhman/raven/';

export interface RavenScene {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  prompt: string;
  preview: string;
  original: string;
  start: number;
  seek: number;
  tags: string[];
}

export const RAVEN_SCENES: RavenScene[] = [
  {
    id: "01-manor",
    title: "القصر تحت المطر",
    titleEn: "The Manor",
    description: "حجر مبتل، سماء رمادية، ودفء يتسلل من النوافذ.",
    prompt:
      "Rainy blue-hour manor exterior, wet dark stone, ornate iron gate ajar, warm amber light from tall windows, single black raven on the gate, heavy rain streaks, cool charcoal and olive blacks, subtle antique gold reflections on wet surfaces, atmospheric fog, photorealistic cinematic mystery, 35mm film.",
    start: 0,
    seek: 1,
    tags: ["قصر", "مطر", "خارجي", "manor", "rain"],
  },
  {
    id: "02-archive",
    title: "قاعة الأرشيف",
    titleEn: "The Archive",
    description: "خشب داكن وضوء بارد، تتوسطهما بقعة من الكهرمان.",
    prompt:
      "Double-height dark oak archive, tall bookshelves with aged volumes, large walnut reading table, single brass oil lamp casting warm pool of light, tall arched window with rain streaks, cool gray shadows, parchment and brass textures, mysterious silence, cinematic 35mm.",
    start: 5.75,
    seek: 6.75,
    tags: ["أرشيف", "مكتبة", "داخلي", "archive", "library"],
  },
  {
    id: "03-desk",
    title: "على ضوء المصباح",
    titleEn: "The Desk",
    description: "ورق كريمي، شمع داكن، ولمعة نحاس معتّق.",
    prompt:
      "Walnut desk under single brass lamp, blank aged paper, unmarked sealed envelope, brass magnifier, fountain pen, single raven feather, warm amber practical light against deep charcoal shadows, cinematic close-up, no readable text.",
    start: 11.5,
    seek: 12.5,
    tags: ["مكتب", "مصباح", "ورق", "desk", "lamp"],
  },
  {
    id: "04-corridor",
    title: "الممر الحجري",
    titleEn: "The Corridor",
    description: "تتابع من الأقواس، وظلال طويلة تحيط بخيط من الضوء.",
    prompt:
      "Old stone corridor with worn limestone arches, wooden door slightly ajar emitting warm amber light, rainy windows in background, cool blue-gray tones, subtle fog, antique gold highlights on wet stone, symmetrical framing, photorealistic 35mm mystery.",
    start: 17.25,
    seek: 18.25,
    tags: ["ممر", "باب", "حجر", "corridor", "door"],
  },
].map((scene) => ({
  ...scene,
  preview: `${ROOT}/assets/${scene.id}.webp`,
  original: `${ROOT}/assets/${scene.id}.png`,
}));

export const RAVEN_PROJECTS: VideoProject[] = ["landscape", "portrait"].map(
  (layout) => ({
    id: `raven-${layout}`,
    title:
      layout === "landscape"
        ? "RAVEN — الفيلم الأفقي"
        : "RAVEN — الفيلم العمودي",
    titleEn:
      layout === "landscape"
        ? "RAVEN — Landscape film"
        : "RAVEN — Portrait film",
    promptText:
      "Four cinematic RAVEN concept stills: rainy manor, dark oak archive, lamplit desk and stone corridor. Slow camera movement, dissolves and original rain ambience.",
    model: "raven",
    aspectRatio: layout === "landscape" ? "16:9" : "9:16",
    duration: 24,
    camera: {
      motion: "dolly-zoom",
      speed: 2,
      lens: "35mm Street",
      fps: 24,
      smoothness: 92,
    },
    keyframes: RAVEN_SCENES.map((scene) => ({
      id: scene.id,
      url: scene.preview,
      timePosition: scene.seek,
      label: scene.title,
      source: "generated",
    })),
    videoUrl: `${ROOT}/media/raven-${layout}.mp4`,
    thumbnailUrl: `${ROOT}/media/poster-${layout}.webp`,
    status: "completed",
    progress: 100,
    createdAt: "2026-11-06T10:34:00Z",
    musicMood: "Original rain ambience",
  }),
);

export const isRavenFilm = (project: VideoProject) =>
  RAVEN_PROJECTS.some((film) => film.id === project.id);
