import { useEffect, useRef, useState } from "react";
import { Film, Play, Volume2, VolumeX } from "lucide-react";
import { isRavenFilm, RAVEN_PROJECTS, RAVEN_SCENES } from "../data/ravenAssets";
import type { VideoProject } from "../types";

export interface PreviewCue {
  time: number;
  requestId: number;
}

interface Props {
  project: VideoProject;
  isAr: boolean;
  cue: PreviewCue | null;
  onSelectProject: (project: VideoProject) => void;
}

export function StudioPreview({ project, isAr, cue, onSelectProject }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pending = useRef<{ src: string; time: number; resume: boolean } | null>(
    null,
  );
  const handledCue = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState(false);
  const [playBlocked, setPlayBlocked] = useState(false);
  const isRaven = isRavenFilm(project);
  const title = !isAr && project.titleEn ? project.titleEn : project.title;
  const activeScene = RAVEN_SCENES.reduce(
    (active, scene, index) => (currentTime >= scene.start ? index : active),
    0,
  );

  function seek(time: number) {
    const video = videoRef.current;
    if (!video || !project.videoUrl) return;
    if (video.readyState >= 1) {
      video.currentTime = Math.max(0, Math.min(time, video.duration));
      setCurrentTime(time);
    } else {
      pending.current = { src: project.videoUrl, time, resume: false };
      video.load();
    }
  }

  useEffect(() => {
    setError(false);
    setPlayBlocked(false);
    setCurrentTime(0);
    if (pending.current?.src !== project.videoUrl) pending.current = null;
  }, [project.videoUrl]);

  useEffect(() => {
    if (cue && isRaven && handledCue.current !== cue.requestId) {
      handledCue.current = cue.requestId;
      seek(cue.time);
    }
  }, [cue, project.videoUrl]);

  const switchFormat = (next: VideoProject) => {
    if (next.id === project.id) return;
    const video = videoRef.current;
    const hasMetadata = !!video && video.readyState >= 1;
    const previousIntent = pending.current;
    pending.current = {
      src: next.videoUrl!,
      time: hasMetadata ? video.currentTime : previousIntent?.time || 0,
      resume: hasMetadata ? !video.paused : previousIntent?.resume || false,
    };
    onSelectProject(next);
  };

  const onMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const intent = pending.current;
    if (intent && intent.src === project.videoUrl) {
      pending.current = null;
      video.currentTime = Math.min(intent.time, video.duration);
      setCurrentTime(video.currentTime);
      if (intent.resume) void video.play().catch(() => setPlayBlocked(true));
    }
  };

  return (
    <section
      className="space-y-4"
      aria-label={isAr ? "مشغّل المشروع" : "Project player"}
      id="project-preview"
    >
      <div className="overflow-hidden rounded-2xl border border-amber-200/15 bg-zinc-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
            <Film className="h-4 w-4" />
            <span>
              {isRaven
                ? isAr
                  ? "فيلم RAVEN"
                  : "RAVEN film"
                : isAr
                  ? "معاينة المشروع"
                  : "Project preview"}
            </span>
          </div>
          {isRaven && (
            <div
              className="flex gap-1 rounded-lg bg-zinc-950 p-1"
              role="group"
              aria-label={isAr ? "نسخة الفيلم" : "Film format"}
            >
              {RAVEN_PROJECTS.map((film) => (
                <button
                  type="button"
                  key={film.id}
                  aria-pressed={project.id === film.id}
                  onClick={() => switchFormat(film)}
                  className={`min-h-10 rounded-md px-3 text-xs transition-colors ${project.id === film.id ? "bg-amber-200 text-zinc-950" : "text-zinc-300 hover:bg-zinc-800"}`}
                >
                  {film.aspectRatio === "16:9"
                    ? isAr
                      ? "أفقي"
                      : "Landscape"
                    : isAr
                      ? "عمودي"
                      : "Portrait"}{" "}
                  <span dir="ltr">{film.aspectRatio}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div
          className={`relative flex justify-center bg-black ${project.aspectRatio === "9:16" ? "h-[min(65svh,620px)]" : "aspect-video"}`}
        >
          {project.videoUrl ? (
            <video
              ref={videoRef}
              key={project.videoUrl}
              src={project.videoUrl}
              poster={project.thumbnailUrl}
              controls
              playsInline
              preload="metadata"
              muted={muted}
              aria-label={title}
              className="h-full w-full object-contain"
              onLoadedMetadata={onMetadata}
              onTimeUpdate={(event) =>
                setCurrentTime(event.currentTarget.currentTime)
              }
              onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
              onError={() => setError(true)}
            />
          ) : (
            <img
              src={project.thumbnailUrl}
              alt={title}
              className="h-full w-full object-contain"
            />
          )}
          <span
            className="pointer-events-none absolute start-3 top-3 rounded bg-black/70 px-2 py-1 text-[10px] text-zinc-200"
            dir="ltr"
          >
            {project.aspectRatio} · {project.duration}s · {project.camera.fps}{" "}
            FPS
          </span>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-white">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                {isRaven
                  ? isAr
                    ? "مونتاج من صور المشروع، بحركة كاميرا هادئة وأجواء صوتية أصلية."
                    : "Project stills with slow camera movement and original ambience."
                  : project.promptText}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              aria-pressed={!muted}
              aria-label={
                isAr
                  ? muted
                    ? "تفعيل صوت الفيلم"
                    : "كتم صوت الفيلم"
                  : muted
                    ? "Enable film sound"
                    : "Mute film sound"
              }
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-amber-200 hover:bg-zinc-800"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
          </div>
          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-rose-950/40 p-3 text-sm text-rose-200"
            >
              <p>
                {isAr
                  ? "تعذّر تحميل الفيلم. يمكنك إعادة المحاولة هنا."
                  : "The film could not load. Retry here."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setError(false);
                  videoRef.current?.load();
                }}
                className="min-h-10 rounded border border-rose-400/50 px-3"
              >
                {isAr ? "إعادة المحاولة" : "Retry"}
              </button>
            </div>
          )}
          {playBlocked && (
            <p role="status" className="text-xs text-amber-200">
              {isAr
                ? "النسخة جاهزة. اضغط تشغيل للمتابعة."
                : "The version is ready. Press play to continue."}
            </p>
          )}
        </div>
      </div>

      {isRaven && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              {isAr ? "مشاهد المشروع" : "Project scenes"}
            </h3>
            <p className="text-xs text-zinc-400">
              {isAr
                ? "اختر لقطة للانتقال إليها في الفيلم"
                : "Select a frame to jump to its scene"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RAVEN_SCENES.map((scene, index) => (
              <button
                type="button"
                key={scene.id}
                onClick={() => seek(scene.seek)}
                aria-pressed={activeScene === index}
                className={`group overflow-hidden rounded-xl border text-start transition-colors ${activeScene === index ? "border-amber-300/70 bg-amber-200/10" : "border-zinc-800 bg-zinc-900/40 hover:border-amber-200/40"}`}
              >
                <div className="relative aspect-video">
                  <img
                    src={scene.preview}
                    alt={isAr ? scene.title : scene.titleEn}
                    width="1440"
                    height="810"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 start-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-1 font-mono text-[9px] text-white">
                    <Play className="h-2.5 w-2.5" />
                    00:{String(Math.floor(scene.seek)).padStart(2, "0")}
                  </span>
                </div>
                <div className="px-2 py-3 text-xs leading-relaxed text-zinc-200">
                  {isAr ? scene.title : scene.titleEn}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
