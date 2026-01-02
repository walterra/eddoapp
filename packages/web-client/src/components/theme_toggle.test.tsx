import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeToggle } from './theme_toggle';

// Mock useTheme hook
const mockSetTheme = vi.fn();
vi.mock('../hooks/use_theme', () => ({
  useTheme: vi.fn(() => ({
    theme: 'system',
    resolvedTheme: 'light',
    isLoading: false,
    setTheme: mockSetTheme,
  })),
}));

import { useTheme } from '../hooks/use_theme';
const mockUseTheme = vi.mocked(useTheme);

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetTheme.mockResolvedValue({ success: true });
  });

  it('renders all theme options', () => {
    render(<ThemeToggle />);

    expect(screen.getByTestId('theme-option-system')).toBeInTheDocument();
    expect(screen.getByTestId('theme-option-light')).toBeInTheDocument();
    expect(screen.getByTestId('theme-option-dark')).toBeInTheDocument();
  });

  it('shows system option as selected by default', () => {
    render(<ThemeToggle />);

    expect(screen.getByTestId('theme-option-system')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('theme-option-light')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('theme-option-dark')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows correct option as selected based on theme', () => {
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      resolvedTheme: 'dark',
      isLoading: false,
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    expect(screen.getByTestId('theme-option-system')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('theme-option-light')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('theme-option-dark')).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls setTheme when clicking light option', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByTestId('theme-option-light'));

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('calls setTheme when clicking dark option', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByTestId('theme-option-dark'));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme when clicking system option', async () => {
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      resolvedTheme: 'dark',
      isLoading: false,
      setTheme: mockSetTheme,
    });

    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByTestId('theme-option-system'));

    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('has accessible labels', () => {
    render(<ThemeToggle />);

    expect(screen.getByLabelText('System theme')).toBeInTheDocument();
    expect(screen.getByLabelText('Light theme')).toBeInTheDocument();
    expect(screen.getByLabelText('Dark theme')).toBeInTheDocument();
  });

  it('has group role for accessibility', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('group', { name: 'Theme selection' })).toBeInTheDocument();
  });
});
