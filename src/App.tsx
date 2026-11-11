import React, { useEffect, useState } from 'react';
import {
  Play,
  Sparkles,
  Camera,
  Clock,
  Sliders,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Wand2,
  Eye,
} from 'lucide-react';
import { Header } from './components/Header';
import { StudioPreview, type PreviewCue } from './components/StudioPreview';
import { RavenSceneLibrary } from './components/RavenSceneLibrary';
import { RAVEN_HOME_URL, RAVEN_PROJECTS, RAVEN_SCENES, type RavenScene } from './data/ravenAssets';
import {
  INITIAL_STORYBOARD,
} from './data/mockData';
import {
  AspectRatio,
  CameraMotion,
  ModelType,
  StoryboardScene,
  VideoProject,
} from './types';

const CAMERA_MOTIONS: { value: CameraMotion; labelEn: string; labelAr: string }[] = [
  { value: 'drone-aerial', labelEn: 'Drone Aerial', labelAr: 'تصوير جوي (درون)' },
  { value: 'dolly-zoom', labelEn: 'Dolly Zoom', labelAr: 'دولي زووم سينمائي' },
  { value: 'fpv-orbit', labelEn: 'FPV Orbit', labelAr: 'مدار FPV سريع' },
  { value: 'pan-right', labelEn: 'Pan Right', labelAr: 'تحريك لليمين' },
  { value: 'pan-left', labelEn: 'Pan Left', labelAr: 'تحريك لليسار' },
  { value: 'tilt-up', labelEn: 'Tilt Up', labelAr: 'إمالة للأعلى' },
  { value: 'tilt-down', labelEn: 'Tilt Down', labelAr: 'إمالة للأسفل' },
  { value: 'static-tripod', labelEn: 'Static Tripod', labelAr: 'كاميرا ثابتة' },
];

const ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '21:9', '1:1', '4:3'];

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'studio' | 'storyboard' | 'pexafy' | 'code'>('studio');
  const [activeModel, setActiveModel] = useState<ModelType>('raven');
  const [lang, setLang] = useState<'en' | 'ar'>(() => new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'ar');

  const [projects, setProjects] = useState<VideoProject[]>(RAVEN_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<VideoProject>(RAVEN_PROJECTS[0]);
  const [promptText, setPromptText] = useState<string>(RAVEN_PROJECTS[0].promptText);
  const [negativePrompt, setNegativePrompt] = useState<string>(
    RAVEN_PROJECTS[0].negativePrompt || ''
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [duration, setDuration] = useState<number>(24);
  const [cameraMotion, setCameraMotion] = useState<CameraMotion>('dolly-zoom');
  const [cameraSpeed, setCameraSpeed] = useState<number>(2);

  const [storyboard, setStoryboard] = useState<StoryboardScene[]>(INITIAL_STORYBOARD);
  const [newSceneTitle, setNewSceneTitle] = useState('');
  const [newScenePrompt, setNewScenePrompt] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const isAr = lang === 'ar';
  const [previewCue, setPreviewCue] = useState<PreviewCue | null>(null);
  const [draftThumbnail, setDraftThumbnail] = useState(RAVEN_SCENES[0].preview);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  const selectProject = (project: VideoProject) => {
    setSelectedProject(project);
    setPromptText(project.promptText);
    setNegativePrompt(project.negativePrompt || '');
    setAspectRatio(project.aspectRatio);
    setDuration(project.duration);
    setCameraMotion(project.camera.motion);
    setCameraSpeed(project.camera.speed);
    setActiveModel(project.model);
    setDraftThumbnail(project.thumbnailUrl);
  };

  const handleAddDraft = () => {
    if (!promptText.trim()) return;
    const newProj: VideoProject = {
      id: `proj-${Date.now()}`,
      title: promptText.slice(0, 42) + (promptText.length > 42 ? '...' : ''),
      promptText,
      negativePrompt: negativePrompt || undefined,
      model: activeModel,
      aspectRatio,
      duration,
      camera: {
        motion: cameraMotion,
        speed: cameraSpeed,
        lens: '35mm Street',
        fps: 24,
        smoothness: 92,
      },
      keyframes: [],
      thumbnailUrl: draftThumbnail,
      status: 'idle',
      progress: 0,
      createdAt: new Date().toISOString(),
      musicMood: 'Cinematic Noir',
    };
    setProjects([newProj, ...projects]);
    setSelectedProject(newProj);
  };

  const handleUseRavenScene = (scene: RavenScene) => {
    selectProject(RAVEN_PROJECTS.find(film => film.aspectRatio === selectedProject.aspectRatio) || RAVEN_PROJECTS[0]);
    setPromptText(scene.prompt);
    setDraftThumbnail(scene.preview);
    setPreviewCue(previous => ({ time: scene.seek, requestId: (previous?.requestId || 0) + 1 }));
    setCurrentTab('studio');
  };

  const handleAddScene = () => {
    if (!newSceneTitle.trim() || !newScenePrompt.trim()) return;
    const nextScene: StoryboardScene = {
      id: `sc-${Date.now()}`,
      sceneNumber: storyboard.length + 1,
      title: newSceneTitle.trim(),
      prompt: newScenePrompt.trim(),
      duration: 5,
      camera: cameraMotion,
      thumbnail: draftThumbnail,
      transition: 'dissolve',
    };
    setStoryboard([...storyboard, nextScene]);
    setNewSceneTitle('');
    setNewScenePrompt('');
  };

  const handleDeleteScene = (id: string) => {
    setStoryboard(
      storyboard
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, sceneNumber: idx + 1 }))
    );
  };

  const apiSnippet = `// Illustrative UI snippet only; this is not a verified provider API contract.
const response = await fetch('https://api.dev.runwayml.com/v1/generate/video', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
    'X-Runway-Version': '2024-11-06'
  },
  body: JSON.stringify({
    configId: '${activeModel}',
    input: {
      promptText: ${JSON.stringify(promptText)},
      aspectRatio: '${aspectRatio}',
      duration: ${duration},
      camera: {
        motion: '${cameraMotion}',
        speed: ${cameraSpeed}
      }
    }
  })
});
const result = await response.json();
console.log(result);`;

  const copySnippet = () => {
    navigator.clipboard?.writeText(apiSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top RAVEN Archive Quick Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-indigo-950/60 to-zinc-900 border-b border-amber-500/20 px-4 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-2 text-amber-300/90">
            <span className="w-2 h-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold">
              {isAr
                ? 'مشاهد RAVEN وفيلمه داخل المشروع. يمكنك إضافة مسودات مؤقتة للجلسة من إعدادات اللقطة.'
                : 'RAVEN scenes and film are integrated here. Shot settings can be added as temporary session drafts.'}
            </span>
          </div>
          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setCurrentTab('studio'); selectProject(RAVEN_PROJECTS[0]); }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-zinc-950 hover:bg-amber-300 font-medium transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isAr ? 'مشاهد RAVEN والفيلم' : 'RAVEN scenes & film'}</span>
            </button>
            <a
              href={`${RAVEN_HOME_URL}${isAr ? '' : '?lang=en'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-medium transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isAr ? 'دخول أرشيف RAVEN' : 'Open RAVEN Archive'}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        activeModel={activeModel}
        setActiveModel={setActiveModel}
        lang={lang}
        setLang={setLang}
        onOpenCode={() => setCurrentTab('code')}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {currentTab === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Prompt & Controls Panel */}
            <div className="order-2 self-start lg:col-span-4 space-y-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  {isAr ? 'وصف المشهد السينمائي (Prompt)' : 'Cinematic Scene Prompt'}
                </label>
                <textarea
                  rows={4}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder={
                    isAr
                      ? 'صف المشهد، الإضاءة، وحركة الكاميرا بالتفصيل...'
                      : 'Describe your scene, lighting, and camera motion...'
                  }
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 p-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Prompt Presets */}
              <div>
                <div className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isAr ? 'استخدم وصف مشهد من المشروع:' : 'Use a project scene description:'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {RAVEN_SCENES.map((scene) => (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => handleUseRavenScene(scene)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
                    >
                      {isAr ? scene.title : scene.titleEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera & Format Settings */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isAr ? 'حركة الكاميرا' : 'Camera Motion'}</span>
                  </label>
                  <select
                    value={cameraMotion}
                    onChange={(e) => setCameraMotion(e.target.value as CameraMotion)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
                  >
                    {CAMERA_MOTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {isAr ? m.labelAr : m.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isAr ? 'المدة (ثواني)' : 'Duration (sec)'}</span>
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
                  >
                    {[4, 8, 12, 16, 24].map((d) => (
                      <option key={d} value={d}>
                        {d}s
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Aspect Ratio & Speed */}
              <div className="space-y-3">
                <div>
                  <span className="block text-xs text-zinc-400 mb-1.5">
                    {isAr ? 'أبعاد الفيديو (Aspect Ratio)' : 'Aspect Ratio'}
                  </span>
                  <div className="flex gap-2">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => setAspectRatio(ratio)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                          aspectRatio === ratio
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span className="flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      {isAr ? 'سرعة الحركة' : 'Motion Speed'}
                    </span>
                    <span className="font-mono text-indigo-400">{cameraSpeed}/10</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={cameraSpeed}
                    onChange={(e) => setCameraSpeed(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddDraft}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAr ? 'إضافة مسودة للجلسة' : 'Add session draft'}</span>
              </button>
            </div>

            {/* Integrated project film and scene navigation. */}
            <div className="order-1 lg:col-span-8 space-y-6">
              <StudioPreview project={selectedProject} isAr={isAr} cue={previewCue} onSelectProject={selectProject} />

              {/* Project History Grid */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-300 mb-3">
                  {isAr ? 'أفلام المشروع ومسوداته' : 'Project films and drafts'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => { setPreviewCue(null); selectProject(proj); }}
                      className={`text-start rounded-xl overflow-hidden border transition-all cursor-pointer ${
                        selectedProject.id === proj.id
                          ? 'border-indigo-500 bg-zinc-900 ring-1 ring-indigo-500/40'
                          : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700'
                      }`}
                    >
                      <div className="aspect-video relative bg-zinc-950">
                        <img
                          src={proj.thumbnailUrl}
                          alt={!isAr && proj.titleEn ? proj.titleEn : proj.title}
                          className="w-full h-full object-cover opacity-85"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="w-6 h-6 text-white drop-shadow" />
                        </div>
                      </div>
                      <div className="p-2.5">
                        <div className="text-xs font-semibold text-zinc-200 truncate">
                          {!isAr && proj.titleEn ? proj.titleEn : proj.title}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                          {proj.status === 'idle' ? (isAr ? 'مسودة' : 'Draft') : 'RAVEN'} · {proj.duration}s
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'storyboard' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <span>
                    {isAr ? 'لوحة تسلسل المشاهد السينمائية' : 'Cinematic Storyboard Sequence'}
                  </span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  {isAr
                    ? 'رتّب مشاهدك واضبط الانتقالات وحركة الكاميرا لكل لقطة قبل التصدير النهائي.'
                    : 'Arrange scenes, camera moves, and transitions for your production.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newSceneTitle}
                  onChange={(e) => setNewSceneTitle(e.target.value)}
                  placeholder={isAr ? 'عنوان المشهد...' : 'Scene title...'}
                  className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100"
                />
                <input
                  type="text"
                  value={newScenePrompt}
                  onChange={(e) => setNewScenePrompt(e.target.value)}
                  placeholder={isAr ? 'وصف اللقطة...' : 'Shot prompt...'}
                  className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 min-w-56"
                />
                <button
                  type="button"
                  onClick={handleAddScene}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAr ? 'إضافة مشهد' : 'Add Scene'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {storyboard.map((scene) => (
                <div
                  key={scene.id}
                  className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-video relative bg-zinc-950">
                    <img
                      src={scene.thumbnail}
                      alt={scene.title}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-black/75 text-amber-400 font-mono text-xs font-bold">
                      #{scene.sceneNumber}
                    </span>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h3 className="font-bold text-sm text-white">{scene.title}</h3>
                      <p className="text-xs text-zinc-400 mt-1">{scene.prompt}</p>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs text-zinc-400 font-mono">
                      <span>
                        {scene.camera} · {scene.duration}s · {scene.transition}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteScene(scene.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                        title={isAr ? 'حذف المشهد' : 'Delete scene'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentTab === 'pexafy' && (
          <RavenSceneLibrary isAr={isAr} search={searchQuery} onSearch={setSearchQuery} onUseScene={handleUseRavenScene} />
        )}

        {currentTab === 'code' && (
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {isAr ? 'كود الربط البرمجي (API Playground)' : 'Runway / Studio API Snippet'}
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  {isAr
                    ? 'كود جاهز يعكس إعدادات النموذج والمشهد الحالية في الاستوديو.'
                    : 'Live-generated API request matching your current studio configuration.'}
                </p>
              </div>
              <button
                type="button"
                onClick={copySnippet}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 transition-colors cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>{isAr ? 'تم النسخ!' : 'Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-cyan-400" />
                    <span>{isAr ? 'نسخ الكود' : 'Copy Snippet'}</span>
                  </>
                )}
              </button>
            </div>
            <pre
              dir="ltr"
              className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-cyan-300 font-mono overflow-x-auto leading-relaxed"
            >
              <code>{apiSnippet}</code>
            </pre>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
