import React, { useState } from 'react';
import { Header } from './components/Header';
import { ModelType } from './types';

function App() {
  const [currentTab, setCurrentTab] = useState<'studio' | 'storyboard' | 'pexafy' | 'code'>('studio');
  const [activeModel, setActiveModel] = useState<ModelType>('raven');
  const [lang, setLang] = useState<'en' | 'ar'>('en');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        activeModel={activeModel}
        setActiveModel={setActiveModel}
        lang={lang}
        setLang={setLang}
        onOpenCode={() => console.log('Open code')}
      />
      <main className="max-w-7xl mx-auto p-4 lg:p-8">
        <div className="flex items-center justify-center h-[60vh] border-2 border-dashed border-zinc-800 rounded-2xl">
          <p className="text-zinc-500 font-medium">Content for {currentTab} goes here</p>
        </div>
      </main>
    </div>
  );
}

export default App;
