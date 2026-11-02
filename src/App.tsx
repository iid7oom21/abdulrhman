import React, { useState } from 'react';
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
  Search,
  Layers,
  Wand2,
  Eye,
} from 'lucide-react';
import { Header } from './components/Header';
import {
  INITIAL_PROJECTS,
  PEXAFY_GALLERY,
  INITIAL_STORYBOARD,
  PROMPT_PRESETS,
} from './data/mockData';
import {
  AspectRatio,
  CameraMotion,
  ModelType,
  PexafyPhoto,
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
  const [lang, setLang] = useState<'en' | 'ar'>('ar');

  const [projects, setProjects] = useState<VideoProject[]>(INITIAL_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<VideoProject>(INITIAL_PROJECTS[0]);
  const [promptText, setPromptText] = useState<string>(INITIAL_PROJECTS[0].promptText);
  const [negativePrompt, setNegativePrompt] = useState<string>(
    INITIAL_PROJECTS[0].negativePrompt || ''
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [duration, setDuration] = useState<number>(8);
  const [cameraMotion, setCameraMotion] = useState<CameraMotion>('drone-aerial');
  const [cameraSpeed, setCameraSpeed] = useState<number>(4);

  const [storyboard, setStoryboard] = useState<StoryboardScene[]>(INITIAL_STORYBOARD);
  const [newSceneTitle, setNewSceneTitle] = useState('');
  const [newScenePrompt, setNewScenePrompt] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const isAr = lang === 'ar';

  const handleGenerateVideo = () => {
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
      videoUrl: selectedProject.videoUrl,
      thumbnailUrl:
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      status: 'completed',
      progress: 100,
      createdAt: new Date().toISOString(),
      musicMood: 'Cinematic Noir',
    };
    setProjects([newProj, ...projects]);
    setSelectedProject(newProj);
  };

  const handleUsePexafyAsset = (photo: PexafyPhoto) => {
    setPromptText(photo.suggestedPrompt);
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
      thumbnail:
        'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80',
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

  const filteredGallery = PEXAFY_GALLERY.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.suggestedPrompt.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const apiSnippet = `const response = await fetch('https://api.dev.runwayml.com/v1/generate/video', {
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
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-300/90">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold">
              {isAr
                ? 'أرشيف RAVEN السري — قضية «على الجانب الآخر» متاحة الآن للتجربة التفاعلية'
                : 'RAVEN Secret Archive — Interactive Case "On The Other Side" is live'}
            </span>
          </div>
          <a
            href="/raven/index.html"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-medium transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isAr ? 'دخول أرشيف RAVEN' : 'Open RAVEN Archive'}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
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
            <div className="lg:col-span-5 space-y-5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5">
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
                  <span>{isAr ? 'قوالب جاهزة سريعة:' : 'Quick Prompt Presets:'}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => {
                        setPromptText(preset.prompt);
                        setCameraMotion(preset.camera);
                        setCameraSpeed(preset.speed);
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors"
                    >
                      {preset.title}
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
                    {[4, 8, 12, 16].map((d) => (
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
                onClick={handleGenerateVideo}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isAr ? 'توليد المشهد الآن' : 'Generate Cinematic Video'}</span>
              </button>
            </div>

            {/* Active Preview & Recent Generations */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden">
                <div className="aspect-video bg-black relative">
                  {selectedProject.videoUrl ? (
                    <video
                      key={selectedProject.id}
                      src={selectedProject.videoUrl}
                      poster={selectedProject.thumbnailUrl}
                      controls
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={selectedProject.thumbnailUrl}
                      alt={selectedProject.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-xs font-mono text-indigo-300 border border-white/10">
                      {selectedProject.model.toUpperCase()}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-xs font-mono text-zinc-300 border border-white/10">
                      {selectedProject.aspectRatio} · {selectedProject.duration}s
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h2 className="font-bold text-base text-white mb-1">{selectedProject.title}</h2>
                  <p className="text-xs text-zinc-400 line-clamp-2">{selectedProject.promptText}</p>
                </div>
              </div>

              {/* Project History Grid */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-300 mb-3">
                  {isAr ? 'المشاريع المولّدة حديثاً' : 'Recent Studio Generations'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => {
                        setSelectedProject(proj);
                        setPromptText(proj.promptText);
                      }}
                      className={`text-start rounded-xl overflow-hidden border transition-all cursor-pointer ${
                        selectedProject.id === proj.id
                          ? 'border-indigo-500 bg-zinc-900 ring-1 ring-indigo-500/40'
                          : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700'
                      }`}
                    >
                      <div className="aspect-video relative bg-zinc-950">
                        <img
                          src={proj.thumbnailUrl}
                          alt={proj.title}
                          className="w-full h-full object-cover opacity-85"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="w-6 h-6 text-white drop-shadow" />
                        </div>
                      </div>
                      <div className="p-2.5">
                        <div className="text-xs font-semibold text-zinc-200 truncate">
                          {proj.title}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                          {proj.model} · {proj.duration}s
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
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {isAr ? 'مكتبة Pexafy المرجعية للإلهام البصري' : 'Pexafy Visual Reference Library'}
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  {isAr
                    ? 'اختر أي لقطة مرجعية لتحويلها فوراً إلى Prompt وإعدادات إضاءة داخل الاستوديو.'
                    : 'Select any curated reference frame to load its lighting & prompt into the studio.'}
                </p>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute top-2.5 start-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? 'ابحث في الصور والوسوم...' : 'Search photos or tags...'}
                  className="ps-9 pe-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredGallery.map((photo) => (
                <div
                  key={photo.id}
                  className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-video relative bg-zinc-950">
                    <img
                      src={photo.url}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 right-2 flex gap-1">
                      {photo.colorPalette.map((hex) => (
                        <span
                          key={hex}
                          style={{ backgroundColor: hex }}
                          className="w-4 h-4 rounded-full border border-white/30 shadow"
                          title={hex}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-white">{photo.title}</h3>
                        <span className="text-[11px] text-emerald-400">{photo.lighting}</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1.5">{photo.suggestedPrompt}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {photo.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[11px] px-2 py-0.5 rounded bg-zinc-950 text-zinc-400 border border-zinc-800"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUsePexafyAsset(photo)}
                      className="w-full py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {isAr ? 'استخدام في استوديو التوليد' : 'Load into Video Studio'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
