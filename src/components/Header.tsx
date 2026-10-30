import React from 'react';
import { Video, Sparkles, Code2, Globe, Layers, Image as ImageIcon } from 'lucide-react';
import { ModelType } from '../types';

interface HeaderProps {
  currentTab: 'studio' | 'storyboard' | 'pexafy' | 'code';
  setCurrentTab: (tab: 'studio' | 'storyboard' | 'pexafy' | 'code') => void;
  activeModel: ModelType;
  setActiveModel: (m: ModelType) => void;
  lang: 'en' | 'ar';
  setLang: (l: 'en' | 'ar') => void;
  onOpenCode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  activeModel,
  setActiveModel,
  lang,
  setLang,
  onOpenCode,
}) => {
  const isAr = lang === 'ar';

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Studio Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                {isAr ? 'استوديو عبد الرحمن' : 'Abdulrhman'}
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-medium">
                  Studio AI
                </span>
              </h1>
            </div>
            <p className="text-xs text-zinc-400 font-sans">
              {isAr ? 'منصة توليد وتوجيه الفيديو السينمائي الذكي' : 'Cinematic AI Video & Creative Director Suite'}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-sm">
          <button
            onClick={() => setCurrentTab('studio')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              currentTab === 'studio'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>{isAr ? 'استوديو التوليد' : 'Video Studio'}</span>
          </button>

          <button
            onClick={() => setCurrentTab('storyboard')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              currentTab === 'storyboard'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>{isAr ? 'لوحة المشاهد' : 'Storyboard'}</span>
          </button>

          <button
            onClick={() => setCurrentTab('pexafy')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              currentTab === 'pexafy'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span>{isAr ? 'مكتبة Pexafy' : 'Pexafy Assets'}</span>
          </button>

          <button
            onClick={() => setCurrentTab('code')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all ${
              currentTab === 'code'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span>{isAr ? 'أكواد الـ API' : 'API Playground'}</span>
          </button>
        </nav>

        {/* Action Controls & Settings */}
        <div className="flex items-center gap-2.5">
          {/* Active Model Selector */}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">
              {isAr ? 'النموذج:' : 'Model:'}
            </span>
            <select
              value={activeModel}
              onChange={(e) => setActiveModel(e.target.value as ModelType)}
              className="bg-transparent text-xs text-zinc-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="raven" className="bg-zinc-900 text-zinc-100">Runway Raven (v1)</option>
              <option value="aleph2" className="bg-zinc-900 text-zinc-100">Aleph 2 (Video-to-Video)</option>
              <option value="veo3.1" className="bg-zinc-900 text-zinc-100">Google Veo 3.1 (HQ)</option>
              <option value="gen-3-alpha" className="bg-zinc-900 text-zinc-100">Gen-3 Alpha Director</option>
            </select>
          </div>

          {/* Quick API Snippet Trigger */}
          <button
            onClick={onOpenCode}
            title={isAr ? 'عرض كود الطلب' : 'View API Request Snippet'}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
          >
            <Code2 className="w-4 h-4" />
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => setLang(isAr ? 'en' : 'ar')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isAr ? 'English' : 'عربي'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
