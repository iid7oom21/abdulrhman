import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Header } from './Header';

const setCurrentTab = vi.fn();
const setActiveModel = vi.fn();
const setLang = vi.fn();
const onOpenCode = vi.fn();

const props = {
  currentTab: 'studio' as const,
  setCurrentTab,
  activeModel: 'raven' as const,
  setActiveModel,
  lang: 'en' as const,
  setLang,
  onOpenCode,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Header', () => {
  it('shows the studio name and tabs in English', () => {
    render(<Header {...props} />);

    expect(screen.getByRole('heading', { name: /RAVEN Studio/ })).toBeInTheDocument();
    expect(screen.getByText('Scenes, film and production drafts')).toBeInTheDocument();
    for (const tab of ['Storyboard', 'Scene library', 'API Playground']) {
      expect(screen.getByText(tab)).toBeInTheDocument();
    }
    expect(screen.getByText('Model:')).toBeInTheDocument();
  });

  it('shows the studio name and tabs in Arabic', () => {
    render(<Header {...props} lang="ar" />);

    expect(screen.getByRole('heading', { name: /استوديو RAVEN/ })).toBeInTheDocument();
    expect(screen.getByText('المشاهد والفيلم ومسودات الإنتاج')).toBeInTheDocument();
    for (const tab of ['لوحة المشاهد', 'مكتبة الصور', 'أكواد الـ API']) {
      expect(screen.getByText(tab)).toBeInTheDocument();
    }
    expect(screen.getByText('النموذج:')).toBeInTheDocument();
  });

  it('reports the tab the reader picked', () => {
    render(<Header {...props} />);

    fireEvent.click(screen.getByText('Storyboard'));
    expect(setCurrentTab).toHaveBeenCalledWith('storyboard');

    fireEvent.click(screen.getByText('Scene library'));
    expect(setCurrentTab).toHaveBeenCalledWith('pexafy');

    fireEvent.click(screen.getByText('API Playground'));
    expect(setCurrentTab).toHaveBeenCalledWith('code');
  });

  it('reports the chosen model', () => {
    render(<Header {...props} />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('raven');

    fireEvent.change(select, { target: { value: 'aleph2' } });
    expect(setActiveModel).toHaveBeenCalledWith('aleph2');
  });

  it('switches language both ways', () => {
    const { unmount } = render(<Header {...props} lang="en" />);
    fireEvent.click(screen.getByText('عربي'));
    expect(setLang).toHaveBeenCalledWith('ar');
    unmount();

    render(<Header {...props} lang="ar" />);
    fireEvent.click(screen.getByText('English'));
    expect(setLang).toHaveBeenCalledWith('en');
  });

  it('opens the request snippet', () => {
    render(<Header {...props} />);

    fireEvent.click(screen.getByTitle('View API Request Snippet'));
    expect(onOpenCode).toHaveBeenCalledTimes(1);
  });
});
