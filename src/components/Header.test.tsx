import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, vi, describe, beforeEach } from 'vitest';
import { Header } from './Header';
import { ModelType } from '../types';

describe('Header component', () => {
  const defaultProps = {
    currentTab: 'studio' as const,
    setCurrentTab: vi.fn(),
    activeModel: 'raven' as ModelType,
    setActiveModel: vi.fn(),
    lang: 'en' as const,
    setLang: vi.fn(),
    onOpenCode: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the correct title and description in English', () => {
    render(<Header {...defaultProps} lang="en" />);
    expect(screen.getByText('Abdulrhman')).toBeInTheDocument();
    expect(screen.getByText('Cinematic AI Video & Creative Director Suite')).toBeInTheDocument();
  });

  test('renders the correct title and description in Arabic', () => {
    render(<Header {...defaultProps} lang="ar" />);
    expect(screen.getByText('استوديو عبد الرحمن')).toBeInTheDocument();
    expect(screen.getByText('منصة توليد وتوجيه الفيديو السينمائي الذكي')).toBeInTheDocument();
  });

  test('calls setCurrentTab when a tab is clicked', () => {
    render(<Header {...defaultProps} />);
    const storyboardTab = screen.getByText('Storyboard');
    fireEvent.click(storyboardTab);
    expect(defaultProps.setCurrentTab).toHaveBeenCalledWith('storyboard');
  });

  test('calls setActiveModel when a model is selected', () => {
    render(<Header {...defaultProps} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'aleph2' } });
    expect(defaultProps.setActiveModel).toHaveBeenCalledWith('aleph2');
  });

  test('calls onOpenCode when the code button is clicked', () => {
    render(<Header {...defaultProps} />);
    const codeBtn = screen.getByTitle('View API Request Snippet');
    fireEvent.click(codeBtn);
    expect(defaultProps.onOpenCode).toHaveBeenCalled();
  });

  test('calls setLang when the language switcher is clicked', () => {
    const { rerender } = render(<Header {...defaultProps} lang="en" />);
    const langBtnEn = screen.getByText('عربي');
    fireEvent.click(langBtnEn);
    expect(defaultProps.setLang).toHaveBeenCalledWith('ar');

    rerender(<Header {...defaultProps} lang="ar" />);
    const langBtnAr = screen.getByText('English');
    fireEvent.click(langBtnAr);
    expect(defaultProps.setLang).toHaveBeenCalledWith('en');
  });
});
