import { Search, Image as ImageIcon } from "lucide-react";
import { RAVEN_SCENES, type RavenScene } from "../data/ravenAssets";

interface Props {
  isAr: boolean;
  search: string;
  onSearch: (value: string) => void;
  onUseScene: (scene: RavenScene) => void;
}

export function RavenSceneLibrary({
  isAr,
  search,
  onSearch,
  onUseScene,
}: Props) {
  const query = search.trim().toLocaleLowerCase();
  const scenes = RAVEN_SCENES.filter((scene) =>
    [scene.title, scene.titleEn, scene.description, scene.prompt, ...scene.tags]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query),
  );
  return (
    <section className="space-y-6" aria-labelledby="asset-library-title">
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="asset-library-title"
            className="flex items-center gap-2 text-lg font-semibold text-white"
          >
            <ImageIcon className="h-5 w-5 text-amber-200" />
            {isAr ? "مكتبة مشاهد RAVEN" : "RAVEN scene library"}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {isAr
              ? "صور المشروع المولّدة. اختر لقطة لعرضها في الفيلم وتحميل وصفها في إعدادات المسودة."
              : "Generated project images. Choose a scene to preview it in the film and use its description in a draft."}
          </p>
        </div>
        <label className="relative block shrink-0">
          <span className="sr-only">
            {isAr ? "البحث في مشاهد المشروع" : "Search project scenes"}
          </span>
          <Search className="absolute start-3 top-3 h-4 w-4 text-zinc-500" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={isAr ? "ابحث عن مشهد…" : "Search scenes…"}
            className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 py-2 pe-4 ps-10 text-sm sm:w-56"
          />
        </label>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {scenes.map((scene) => (
          <article
            key={scene.id}
            className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50"
          >
            <img
              src={scene.preview}
              alt={isAr ? scene.title : scene.titleEn}
              width="1440"
              height="810"
              className="aspect-video w-full object-cover"
              loading="lazy"
            />
            <div className="space-y-3 p-5">
              <h3 className="text-lg text-white">
                {isAr ? scene.title : scene.titleEn}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {isAr ? scene.description : scene.prompt}
              </p>
              <button
                type="button"
                onClick={() => onUseScene(scene)}
                className="min-h-11 rounded-lg border border-amber-200/30 bg-amber-200/10 px-4 py-2 text-sm text-amber-200 transition-colors hover:bg-amber-200/20"
              >
                {isAr ? "استخدام اللقطة في المشروع" : "Use scene in project"}
              </button>
            </div>
          </article>
        ))}
      </div>
      {!scenes.length && (
        <div
          role="status"
          className="rounded-xl border border-zinc-800 p-8 text-center"
        >
          <p className="text-zinc-300">
            {isAr ? "لا توجد مشاهد تطابق البحث." : "No matching scenes."}
          </p>
          <button
            type="button"
            onClick={() => onSearch("")}
            className="mt-4 min-h-11 px-4 text-amber-200"
          >
            {isAr ? "عرض جميع المشاهد" : "Show all scenes"}
          </button>
        </div>
      )}
    </section>
  );
}
