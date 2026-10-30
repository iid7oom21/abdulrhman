import React, { useState } from 'react';
import { Header } from './components/Header';
import { INITIAL_PROJECTS, PEXAFY_GALLERY, INITIAL_STORYBOARD, PROMPT_PRESETS } from './data/mockData';
import { ModelType } from './types';

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<'studio' | 'storyboard' | 'pexafy' | 'code'>('studio');
  const [activeModel, setActiveModel] = useState<ModelType>('raven');
  const [lang, setLang] = useState<'en' | 'ar'>('en');

  return (
    <div className="min-h-screen bg-black text-zinc-200">
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        activeModel={activeModel}
        setActiveModel={setActiveModel}
        lang={lang}
        setLang={setLang}
        onOpenCode={() => console.log('Open code')}
      />
      <main className="p-4 max-w-7xl mx-auto">
        {currentTab === 'studio' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Projects</h2>
            <ul className="list-disc pl-5">
              {INITIAL_PROJECTS.map(p => (
                <li key={p.id}>{p.title}</li>
              ))}
            </ul>
          </div>
        )}
        {currentTab === 'storyboard' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Storyboard Scenes</h2>
            <ul className="list-disc pl-5">
              {INITIAL_STORYBOARD.map(s => (
                <li key={s.id}>{s.title}</li>
              ))}
            </ul>
          </div>
        )}
        {currentTab === 'pexafy' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Pexafy Gallery</h2>
            <ul className="list-disc pl-5">
              {PEXAFY_GALLERY.map(p => (
                <li key={p.id}>{p.title}</li>
              ))}
            </ul>
          </div>
        )}
        {currentTab === 'code' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Prompt Presets</h2>
            <ul className="list-disc pl-5">
              {PROMPT_PRESETS.map((p, i) => (
                <li key={i}>{p.title}</li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
