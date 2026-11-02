import React from 'react';
import {
  Aperture,
  ArrowUpRight,
  Code2,
  Globe,
  Layers,
  Image,
  Clapperboard,
} from 'lucide-react';

type Tab = 'studio' | 'storyboard' | 'pexafy' | 'code';

interface HeaderProps {
  currentTab: Tab;
  setCurrentTab: (tab: Tab) => void;
  lang: 'en' | 'ar';
  setLang: (lang: 'en' | 'ar') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  lang,
  setLang,
}) => {
  const isAr = lang === 'ar';
  const tabs = [
    {
      id: 'studio',
      icon: Clapperboard,
      label: isAr ? 'استوديو الإبداع' : 'Creative studio',
    },
    {
      id: 'storyboard',
      icon: Layers,
      label: isAr ? 'لوحة المشاهد' : 'Storyboard',
    },
    {
      id: 'pexafy',
      icon: Image,
      label: isAr ? 'مكتبة الإلهام' : 'Inspiration library',
    },
    { id: 'code', icon: Code2, label: isAr ? 'أكواد API' : 'API playground' },
  ] as const;

  return (
    <header className="studio-header">
      <div className="header-top page-width">
        <button
          type="button"
          className="studio-brand"
          onClick={() => setCurrentTab('studio')}
          aria-label={
            isAr ? 'استوديو عبد الرحمن — الرئيسية' : 'Abdulrhman Studio — home'
          }
        >
          <span className="brand-symbol">
            <Aperture size={28} strokeWidth={1.6} />
          </span>
          <span>
            <strong>
              {isAr ? 'عبد الرحمن' : 'Abdulrhman'}
              <span className="brand-dot">.</span>
            </strong>
            <small>CREATIVE STUDIO</small>
          </span>
        </button>
        <div className="header-actions">
          <span className="workspace-label">
            <span className="status-dot" />
            {isAr ? 'مساحتك الإبداعية' : 'Your creative workspace'}
          </span>
          <button
            type="button"
            className="language-button"
            onClick={() => setLang(isAr ? 'en' : 'ar')}
          >
            <Globe size={15} />
            {isAr ? 'English' : 'عربي'}
          </button>
          <span className="avatar" aria-hidden="true">
            A
          </span>
        </div>
      </div>
      <div className="header-bottom page-width">
        <nav
          className="studio-nav"
          aria-label={isAr ? 'أقسام الاستوديو' : 'Studio navigation'}
        >
          {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              className={currentTab === id ? 'nav-item active' : 'nav-item'}
              aria-current={currentTab === id ? 'page' : undefined}
              onClick={() => setCurrentTab(id)}
            >
              <Icon size={17} strokeWidth={1.6} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <a className="archive-link" href="/raven/index.html">
          <span className="archive-dot" />
          {isAr ? 'عالم RAVEN' : 'RAVEN universe'}
          <ArrowUpRight size={15} />
        </a>
      </div>
    </header>
  );
};
