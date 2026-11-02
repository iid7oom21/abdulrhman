import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Play,
  Camera,
  Clock,
  Sliders,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  Layers,
  Wand2,
  Eye,
  ArrowUpRight,
  Cpu,
  Scan,
  Clapperboard,
  Film,
} from 'lucide-react';
import { Header } from './components/Header';
import { useStoredState } from './hooks/useStoredState';
import { isProjectList, isSceneList } from './data/storageValidation';
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

const CAMERA_MOTIONS: {
  value: CameraMotion;
  labelEn: string;
  labelAr: string;
}[] = [
  {
    value: 'drone-aerial',
    labelEn: 'Drone Aerial',
    labelAr: 'تصوير جوي (درون)',
  },
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
  const [currentTab, setCurrentTab] = useState<
    'studio' | 'storyboard' | 'pexafy' | 'code'
  >('studio');
  const [activeModel, setActiveModel] = useStoredState<ModelType>(
    'studio.model',
    'raven',
    (v) => ['raven', 'aleph2', 'veo3.1', 'gen-3-alpha'].includes(v as string),
  );
  const [lang, setLang] = useStoredState<'en' | 'ar'>(
    'studio.language',
    'ar',
    (v) => v === 'ar' || v === 'en',
  );

  const [projects, setProjects, projectStorageError] = useStoredState<
    VideoProject[]
  >('studio.projects', INITIAL_PROJECTS, isProjectList);
  const [selectedProject, setSelectedProject] = useState<VideoProject>(
    projects[0] || INITIAL_PROJECTS[0],
  );
  const [promptText, setPromptText, promptStorageError] =
    useStoredState<string>(
      'studio.prompt',
      INITIAL_PROJECTS[0].promptText,
      (v) => typeof v === 'string',
    );
  const [negativePrompt, setNegativePrompt] = useStoredState<string>(
    'studio.negativePrompt',
    INITIAL_PROJECTS[0].negativePrompt || '',
    (v) => typeof v === 'string',
  );
  const [aspectRatio, setAspectRatio] = useStoredState<AspectRatio>(
    'studio.ratio',
    '16:9',
    (v) => ASPECT_RATIOS.includes(v as AspectRatio),
  );
  const [duration, setDuration] = useStoredState<number>(
    'studio.duration',
    8,
    (v) => [4, 8, 12, 16].includes(v as number),
  );
  const [cameraMotion, setCameraMotion] = useStoredState<CameraMotion>(
    'studio.motion',
    'drone-aerial',
    (v) => CAMERA_MOTIONS.some((motion) => motion.value === v),
  );
  const [cameraSpeed, setCameraSpeed] = useStoredState<number>(
    'studio.speed',
    4,
    (v) => typeof v === 'number' && v >= 1 && v <= 10,
  );

  const [storyboard, setStoryboard, sceneStorageError] = useStoredState<
    StoryboardScene[]
  >('studio.storyboard', INITIAL_STORYBOARD, isSceneList);
  const [newSceneTitle, setNewSceneTitle] = useState('');
  const [newScenePrompt, setNewScenePrompt] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const isAr = lang === 'ar';
  const [feedback, setFeedback] = useState('');
  const [videoFailed, setVideoFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const storageError =
    projectStorageError || promptStorageError || sceneStorageError;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [lang, isAr]);

  useEffect(() => {
    setVideoFailed(false);
    setIsPlaying(false);
  }, [selectedProject.id]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(''), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const selectProject = (project: VideoProject) => {
    setSelectedProject(project);
    setPromptText(project.promptText);
    setNegativePrompt(project.negativePrompt || '');
    setActiveModel(project.model);
    setAspectRatio(project.aspectRatio);
    setDuration(project.duration);
    setCameraMotion(project.camera.motion);
    setCameraSpeed(project.camera.speed);
  };

  const handleSaveDraft = () => {
    if (!promptText.trim()) return;
    const newProj: VideoProject = {
      id: `proj-${crypto.randomUUID()}`,
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
      thumbnailUrl: selectedProject.thumbnailUrl,
      status: 'idle',
      progress: 0,
      createdAt: new Date().toISOString(),
      musicMood: 'Cinematic Noir',
    };
    setProjects((previous) => [newProj, ...previous]);
    setSelectedProject(newProj);
    setFeedback(
      isAr
        ? 'أُضيفت مسودة المشهد إلى مساحة إبداعك.'
        : 'Scene draft added to your workspace.',
    );
  };

  const handleUsePexafyAsset = (photo: PexafyPhoto) => {
    setPromptText(photo.suggestedPrompt);
    setCurrentTab('studio');
  };

  const handleAddScene = () => {
    if (!newSceneTitle.trim() || !newScenePrompt.trim()) return;
    const nextScene: StoryboardScene = {
      id: `sc-${crypto.randomUUID()}`,
      sceneNumber: storyboard.length + 1,
      title: newSceneTitle.trim(),
      prompt: newScenePrompt.trim(),
      duration: 5,
      camera: cameraMotion,
      thumbnail:
        'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&q=80',
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
        .map((s, idx) => ({ ...s, sceneNumber: idx + 1 })),
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

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(apiSnippet);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setFeedback(
        isAr
          ? 'تعذّر النسخ. يمكنك تحديد الكود ونسخه يدويًا.'
          : 'Could not copy. Select the code and copy it manually.',
      );
    }
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="studio-app">
      <a className="skip-link" href="#main-content">
        {isAr ? 'الانتقال إلى المحتوى' : 'Skip to content'}
      </a>
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        lang={lang}
        setLang={setLang}
      />
      <main id="main-content" className="studio-main page-width">
        {currentTab === 'studio' && (
          <>
            <section className="studio-hero" aria-labelledby="welcome-title">
              <div className="hero-art" aria-hidden="true" />
              <div className="hero-content">
                <span className="eyebrow">
                  <span />
                  {isAr
                    ? 'خيالك هو البداية'
                    : 'IT STARTS WITH YOUR IMAGINATION'}
                </span>
                <h1 id="welcome-title">
                  {isAr ? 'كل فكرة تستحق' : 'Every idea deserves'}
                  <br />
                  <em>
                    {isAr ? 'مشهدًا استثنائيًا.' : 'an extraordinary scene.'}
                  </em>
                </h1>
                <p>
                  {isAr
                    ? 'مساحة واحدة لتكتب، تتخيّل، وتصنع قصتك بطريقتك.'
                    : 'One space to write, imagine, and tell your story your way.'}
                </p>
                <button
                  className="hero-link"
                  type="button"
                  onClick={() => setCurrentTab('pexafy')}
                >
                  {isAr ? 'اكتشف ما يلهمك' : 'Find your inspiration'}
                  <ArrowUpRight size={17} />
                </button>
              </div>
              <span className="hero-caption" dir="ltr">
                <span />
                FRAME 001 / THE ART OF POSSIBILITY
              </span>
            </section>

            <div className="workspace-heading">
              <div>
                <span className="eyebrow muted">
                  {isAr ? 'من الفكرة إلى الكادر' : 'FROM IDEA TO FRAME'}
                </span>
                <h2>
                  {isAr ? 'لنصنع المشهد التالي' : 'Create your next scene'}
                  <span className="section-dot">.</span>
                </h2>
              </div>
              <span className="save-status" role="status">
                <span className="status-dot" />
                {storageError
                  ? isAr
                    ? 'الحفظ المحلي غير متاح'
                    : 'Local saving unavailable'
                  : isAr
                    ? 'مسوداتك محفوظة على هذا المتصفح'
                    : 'Drafts saved in this browser'}
              </span>
            </div>

            <div className="studio-grid">
              <section
                className="control-panel"
                aria-labelledby="scene-settings-title"
              >
                <div className="panel-heading">
                  <span className="panel-icon">
                    <Sliders size={17} />
                  </span>
                  <h3 id="scene-settings-title">
                    {isAr ? 'إعداد المشهد' : 'Scene setup'}
                  </h3>
                  <span className="step-label">01 — CREATE</span>
                </div>
                <div className="control-body">
                  <div className="field-heading">
                    <label htmlFor="scene-prompt">
                      {isAr
                        ? 'ماذا يدور في خيالك؟'
                        : 'What do you have in mind?'}
                    </label>
                    <Wand2 size={15} />
                  </div>
                  <textarea
                    id="scene-prompt"
                    dir="auto"
                    rows={5}
                    value={promptText}
                    maxLength={5000}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder={
                      isAr
                        ? 'صف المشهد، الإضاءة، وحركة الكاميرا...'
                        : 'Describe your scene, lighting, and camera motion...'
                    }
                    className="prompt-input"
                  />
                  <div className="prompt-meta">
                    <span>
                      {isAr
                        ? 'التفاصيل الصغيرة تصنع الفرق'
                        : 'Small details make the difference'}
                    </span>
                    <span dir="ltr">{promptText.length} / 5000</span>
                  </div>
                  <div
                    className="preset-list"
                    aria-label={isAr ? 'قوالب المشاهد' : 'Scene presets'}
                  >
                    {PROMPT_PRESETS.map((preset, index) => (
                      <button
                        key={preset.title}
                        type="button"
                        onClick={() => {
                          setPromptText(preset.prompt);
                          setCameraMotion(preset.camera);
                          setCameraSpeed(preset.speed);
                        }}
                      >
                        <Sparkles size={11} />
                        {isAr
                          ? [
                              'ضباب الجبال',
                              'مدينة النيون',
                              'رمال ذهبية',
                              'لقطة منتج',
                            ][index]
                          : preset.title}
                      </button>
                    ))}
                  </div>
                  <div className="settings-divider" />
                  <label className="field-label" htmlFor="model-select">
                    <Cpu size={14} />
                    {isAr ? 'النموذج الإبداعي' : 'Creative model'}
                  </label>
                  <select
                    id="model-select"
                    className="studio-select model-select"
                    value={activeModel}
                    onChange={(e) =>
                      setActiveModel(e.target.value as ModelType)
                    }
                  >
                    <option value="raven">Runway Raven (v1)</option>
                    <option value="aleph2">Aleph 2</option>
                    <option value="veo3.1">Google Veo 3.1</option>
                    <option value="gen-3-alpha">Gen-3 Alpha Director</option>
                  </select>
                  <div className="settings-row">
                    <div>
                      <label className="field-label" htmlFor="camera-motion">
                        <Camera size={14} />
                        {isAr ? 'حركة الكاميرا' : 'Camera motion'}
                      </label>
                      <select
                        id="camera-motion"
                        className="studio-select"
                        value={cameraMotion}
                        onChange={(e) =>
                          setCameraMotion(e.target.value as CameraMotion)
                        }
                      >
                        {CAMERA_MOTIONS.map((motion) => (
                          <option key={motion.value} value={motion.value}>
                            {isAr ? motion.labelAr : motion.labelEn}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label" htmlFor="scene-duration">
                        <Clock size={14} />
                        {isAr ? 'مدة المشهد' : 'Duration'}
                      </label>
                      <select
                        id="scene-duration"
                        className="studio-select"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                      >
                        {[4, 8, 12, 16].map((seconds) => (
                          <option key={seconds} value={seconds}>
                            {seconds} {isAr ? 'ثوانٍ' : 'seconds'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <fieldset className="ratio-field">
                    <legend className="field-label">
                      <Scan size={14} />
                      {isAr ? 'أبعاد المشهد' : 'Aspect ratio'}
                    </legend>
                    <div className="ratio-options" dir="ltr">
                      {ASPECT_RATIOS.map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          aria-pressed={aspectRatio === ratio}
                          className={aspectRatio === ratio ? 'selected' : ''}
                          onClick={() => setAspectRatio(ratio)}
                        >
                          <span
                            className="ratio-shape"
                            style={{ aspectRatio: ratio.replace(':', '/') }}
                          />
                          <span>{ratio}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="speed-heading">
                    <label className="field-label" htmlFor="camera-speed">
                      {isAr ? 'سرعة الحركة' : 'Motion speed'}
                    </label>
                    <span dir="ltr">
                      {cameraSpeed}
                      <span> / 10</span>
                    </span>
                  </div>
                  <input
                    id="camera-speed"
                    type="range"
                    min={1}
                    max={10}
                    value={cameraSpeed}
                    onChange={(e) => setCameraSpeed(Number(e.target.value))}
                    className="speed-range"
                  />
                  <details className="advanced-settings">
                    <summary>
                      {isAr ? 'إعدادات إضافية' : 'Advanced settings'}
                    </summary>
                    <label htmlFor="negative-prompt" className="field-label">
                      {isAr ? 'عناصر تريد تجنّبها' : 'Elements to avoid'}
                    </label>
                    <textarea
                      id="negative-prompt"
                      dir="auto"
                      rows={2}
                      className="prompt-input"
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                    />
                  </details>
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={!promptText.trim()}
                    className="create-button"
                  >
                    <Sparkles size={17} />
                    <span>
                      {isAr ? 'حفظ مسودة المشهد' : 'Save scene draft'}
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                  <p className="demo-note">
                    {isAr
                      ? 'مساحة تجريبية · التوليد الفعلي يحتاج ربط مزوّد فيديو'
                      : 'Demo workspace · Connect a video provider to generate'}
                  </p>
                  <p className="action-feedback" role="status">
                    {feedback}
                  </p>
                </div>
              </section>

              <div className="preview-column">
                <section
                  className="preview-panel"
                  aria-labelledby="preview-heading"
                >
                  <div className="panel-heading">
                    <span className="panel-icon">
                      <Clapperboard size={17} />
                    </span>
                    <h3 id="preview-heading">
                      {isAr ? 'من خلف العدسة' : 'Behind the lens'}
                    </h3>
                    <span className="preview-tag">
                      {selectedProject.status === 'idle'
                        ? isAr
                          ? 'مسودة'
                          : 'DRAFT'
                        : isAr
                          ? 'معاينة مرجعية'
                          : 'REFERENCE PREVIEW'}
                    </span>
                  </div>
                  <div className="scene-preview">
                    {selectedProject.videoUrl && isPlaying && !videoFailed ? (
                      <video
                        key={selectedProject.id}
                        src={selectedProject.videoUrl}
                        poster={selectedProject.thumbnailUrl}
                        controls
                        autoPlay
                        playsInline
                        preload="none"
                        onError={() => setVideoFailed(true)}
                        className="preview-media"
                      />
                    ) : (
                      <img
                        src={selectedProject.thumbnailUrl}
                        alt={selectedProject.title}
                        className="preview-media"
                      />
                    )}
                    {selectedProject.videoUrl && !isPlaying && !videoFailed && (
                      <button
                        type="button"
                        className="preview-play"
                        onClick={() => setIsPlaying(true)}
                        aria-label={
                          isAr
                            ? 'تشغيل الفيديو المرجعي'
                            : 'Play reference video'
                        }
                      >
                        <Play size={25} fill="currentColor" />
                      </button>
                    )}
                    <div className="preview-badges" dir="ltr">
                      <span>
                        <span className="status-dot" />
                        {selectedProject.model.toUpperCase()}
                      </span>
                      <span>
                        {selectedProject.aspectRatio} ·{' '}
                        {selectedProject.duration}s
                      </span>
                    </div>
                    {videoFailed && (
                      <span className="video-fallback" role="status">
                        {isAr
                          ? 'الفيديو المرجعي غير متاح؛ نعرض الصورة'
                          : 'Reference video unavailable; showing image'}
                      </span>
                    )}
                  </div>
                  <div className="preview-description">
                    <div className="preview-title-row">
                      <span className="eyebrow muted">
                        {isAr ? 'المشهد المحدد' : 'SELECTED SCENE'}
                      </span>
                      <span className="frame-number" dir="ltr">
                        {String(
                          projects.findIndex(
                            (project) => project.id === selectedProject.id,
                          ) + 1,
                        ).padStart(2, '0')}{' '}
                        / {String(projects.length).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 dir="auto">{selectedProject.title}</h3>
                    <p dir="auto">{selectedProject.promptText}</p>
                    <div className="scene-metadata">
                      <span>
                        <Camera size={13} />
                        {
                          CAMERA_MOTIONS.find(
                            (motion) =>
                              motion.value === selectedProject.camera.motion,
                          )?.[isAr ? 'labelAr' : 'labelEn']
                        }
                      </span>
                      <span>
                        <Film size={13} />
                        {selectedProject.camera.fps} FPS
                      </span>
                      <span>{selectedProject.camera.lens}</span>
                    </div>
                  </div>
                </section>
                <section
                  className="recent-projects"
                  aria-labelledby="recent-projects-title"
                >
                  <div className="recent-heading">
                    <h3 id="recent-projects-title">
                      {isAr ? 'من مساحة إبداعك' : 'From your workspace'}
                      <span>{projects.length}</span>
                    </h3>
                    <span>
                      {isAr ? 'المشاهد والمسودات' : 'Scenes & drafts'}
                    </span>
                  </div>
                  <div className="project-grid">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        aria-pressed={selectedProject.id === project.id}
                        onClick={() => selectProject(project)}
                        className={`project-card ${selectedProject.id === project.id ? 'selected' : ''}`}
                      >
                        <div className="project-image">
                          <img
                            src={project.thumbnailUrl}
                            alt=""
                            loading="lazy"
                          />
                          <span className="project-duration" dir="ltr">
                            {project.duration}s
                          </span>
                          {selectedProject.id === project.id && (
                            <span className="selected-check">
                              <Check size={12} />
                            </span>
                          )}
                        </div>
                        <div className="project-details">
                          <h4 dir="auto">{project.title}</h4>
                          <span>
                            {project.model.toUpperCase()}
                            <span>
                              {project.status === 'idle'
                                ? isAr
                                  ? 'مسودة'
                                  : 'Draft'
                                : isAr
                                  ? 'مرجع'
                                  : 'Reference'}
                            </span>
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
                <a className="raven-feature" href="/raven/index.html">
                  <span className="raven-icon">
                    <Eye size={23} />
                  </span>
                  <span>
                    <small>RAVEN ARCHIVES / 001</small>
                    <strong>
                      {isAr
                        ? 'على الجانب الآخر... قصة تنتظر اكتشافك.'
                        : 'On the other side… a story awaits.'}
                    </strong>
                  </span>
                  <ArrowUpRight size={20} />
                </a>
              </div>
            </div>
          </>
        )}

        {currentTab === 'storyboard' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <span>
                    {isAr
                      ? 'لوحة تسلسل المشاهد السينمائية'
                      : 'Cinematic Storyboard Sequence'}
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
                  aria-label={isAr ? 'عنوان المشهد' : 'Scene title'}
                  value={newSceneTitle}
                  onChange={(e) => setNewSceneTitle(e.target.value)}
                  placeholder={isAr ? 'عنوان المشهد...' : 'Scene title...'}
                  className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100"
                />
                <input
                  type="text"
                  aria-label={isAr ? 'وصف اللقطة' : 'Shot prompt'}
                  value={newScenePrompt}
                  onChange={(e) => setNewScenePrompt(e.target.value)}
                  placeholder={isAr ? 'وصف اللقطة...' : 'Shot prompt...'}
                  className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 min-w-0 w-full sm:w-auto"
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
                      <h3 className="font-bold text-sm text-white">
                        {scene.title}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        {scene.prompt}
                      </p>
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
                  {isAr
                    ? 'مكتبة Pexafy المرجعية للإلهام البصري'
                    : 'Pexafy Visual Reference Library'}
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
                  aria-label={
                    isAr
                      ? 'البحث في مكتبة الإلهام'
                      : 'Search inspiration library'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    isAr
                      ? 'ابحث في الصور والوسوم...'
                      : 'Search photos or tags...'
                  }
                  className="ps-9 pe-4 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {filteredGallery.length === 0 && (
              <div className="empty-state">
                <Search size={28} />
                <h3>{isAr ? 'لم نجد صورًا مطابقة' : 'No matching images'}</h3>
                <p>
                  {isAr
                    ? 'جرّب كلمة أخرى مثل Forest أو Desert.'
                    : 'Try another keyword, such as Forest or Desert.'}
                </p>
                <button type="button" onClick={() => setSearchQuery('')}>
                  {isAr ? 'عرض كل الصور' : 'Show all images'}
                </button>
              </div>
            )}
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
                        <h3 className="font-bold text-sm text-white">
                          {photo.title}
                        </h3>
                        <span className="text-[11px] text-emerald-400">
                          {photo.lighting}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1.5">
                        {photo.suggestedPrompt}
                      </p>
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
                      {isAr
                        ? 'استخدام في استوديو التوليد'
                        : 'Load into Video Studio'}
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
                  {isAr
                    ? 'كود الربط البرمجي (API Playground)'
                    : 'Runway / Studio API Snippet'}
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  {isAr
                    ? 'مثال توضيحي للإعدادات؛ تحقّق من واجهة المزوّد وشغّله على الخادم لحماية مفتاحك.'
                    : 'Illustrative settings example. Verify the provider API and run on your server to protect your key.'}
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
            <p role="status" className="text-xs text-amber-300">
              {feedback}
            </p>
            <pre
              dir="ltr"
              className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-cyan-300 font-mono overflow-x-auto leading-relaxed"
            >
              <code>{apiSnippet}</code>
            </pre>
          </div>
        )}
      </main>
      <footer className="studio-footer page-width">
        <span>
          ABDULRHMAN<span className="brand-dot">.</span> CREATIVE STUDIO
        </span>
        <span>
          {isAr
            ? 'مساحة لخيالك، وأفق لقصتك.'
            : 'A space for your imagination. A horizon for your story.'}
        </span>
      </footer>
    </div>
  );
};

export default App;
