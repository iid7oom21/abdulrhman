import type { VideoProject } from "../types";

const ROOT = `${import.meta.env.BASE_URL}visual-lab`;

export const RAVEN_HOME_URL = new URL(
  '../raven/index.html',
  new URL(import.meta.env.BASE_URL, window.location.origin),
).pathname;

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
      "Rainy blue-hour manor exterior, wet stone, iron gate, warm amber windows and a central raven. Photorealistic cinematic mystery, charcoal and olive shadows, 35mm film.",
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
      "Double-height dark oak archive with a reading table, brass lamp and tall rain-streaked arched window. Warm practical light against cool moonlight, cinematic 35mm photography.",
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
      "Walnut desk with blank cream paper, an unmarked wax-sealed envelope, brass magnifier, fountain pen and raven feather. Warm lamp and cool rainy window, cinematic close-up.",
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
      "Old stone corridor with arches, worn limestone, rainy windows and an ajar door emitting amber light. Symmetrical framing, charcoal and olive shadows, photorealistic 35mm mystery film.",
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
