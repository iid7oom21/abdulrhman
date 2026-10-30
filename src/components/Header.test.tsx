import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Header } from './Header';

describe('Header Component', () => {
  const mockSetCurrentTab = vi.fn();
  const mockSetActiveModel = vi.fn();
  const mockSetLang = vi.fn();
  const mockOnOpenCode = vi.fn();

  const defaultProps = {
    currentTab: 'studio' as const,
    setCurrentTab: mockSetCurrentTab,
    activeModel: 'raven' as const,
    setActiveModel: mockSetActiveModel,
    lang: 'en' as const,
    setLang: mockSetLang,
    onOpenCode: mockOnOpenCode,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly in English', () => {
    render(<Header {...defaultProps} />);

    expect(screen.getByText('Abdulrhman')).toBeInTheDocument();
    expect(screen.getByText('Cinematic AI Video & Creative Director Suite')).toBeInTheDocument();
    expect(screen.getByText('Video Studio')).toBeInTheDocument();
    expect(screen.getByText('Storyboard')).toBeInTheDocument();
    expect(screen.getByText('Pexafy Assets')).toBeInTheDocument();
    expect(screen.getByText('API Playground')).toBeInTheDocument();
    expect(screen.getByText('Model:')).toBeInTheDocument();
  });

  it('renders correctly in Arabic', () => {
    render(<Header {...defaultProps} lang="ar" />);

    expect(screen.getByText('استوديو عبد الرحمن')).toBeInTheDocument();
    expect(screen.getByText('منصة توليد وتوجيه الفيديو السينمائي الذكي')).toBeInTheDocument();
    expect(screen.getByText('استوديو التوليد')).toBeInTheDocument();
    expect(screen.getByText('لوحة المشاهد')).toBeInTheDocument();
    expect(screen.getByText('مكتبة Pexafy')).toBeInTheDocument();
    expect(screen.getByText('أكواد الـ API')).toBeInTheDocument();
    expect(screen.getByText('النموذج:')).toBeInTheDocument();
  });

  it('handles tab switching', () => {
    render(<Header {...defaultProps} />);

    fireEvent.click(screen.getByText('Storyboard'));
    expect(mockSetCurrentTab).toHaveBeenCalledWith('storyboard');

    fireEvent.click(screen.getByText('Pexafy Assets'));
    expect(mockSetCurrentTab).toHaveBeenCalledWith('pexafy');
  });

  it('handles model selection', () => {
    render(<Header {...defaultProps} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'aleph2' } });

    expect(mockSetActiveModel).toHaveBeenCalledWith('aleph2');
  });

  it('handles language toggling from English to Arabic', () => {
    render(<Header {...defaultProps} lang="en" />);

    fireEvent.click(screen.getByText('عربي'));
    expect(mockSetLang).toHaveBeenCalledWith('ar');
  });

  it('handles language toggling from Arabic to English', () => {
    render(<Header {...defaultProps} lang="ar" />);

    fireEvent.click(screen.getByText('English'));
    expect(mockSetLang).toHaveBeenCalledWith('en');
  });

  it('handles open code button click', () => {
    render(<Header {...defaultProps} />);

    // The button has a title attribute 'View API Request Snippet' in English
    const codeBtn = screen.getByTitle('View API Request Snippet');
    fireEvent.click(codeBtn);

    expect(mockOnOpenCode).toHaveBeenCalled();
  });
});
