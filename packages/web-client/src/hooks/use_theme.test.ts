import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTheme } from './use_theme';

// Mock useProfile hook
const mockUpdatePreferences = vi.fn();
vi.mock('./use_profile', () => ({
  useProfile: vi.fn(() => ({
    profile: null,
    isLoading: false,
    updatePreferences: mockUpdatePreferences,
  })),
}));

// Import the mocked module to control it
import { useProfile } from './use_profile';
const mockUseProfile = vi.mocked(useProfile);

describe('useTheme', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let mockMediaQueryList: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Reset mocks
    vi.clearAllMocks();
    mockUpdatePreferences.mockResolvedValue({ success: true });

    // Mock matchMedia
    originalMatchMedia = window.matchMedia;
    mockMediaQueryList = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList);

    // Clear dark class from document
    document.documentElement.classList.remove('dark');

    // Reset useProfile mock
    mockUseProfile.mockReturnValue({
      profile: null,
      isLoading: false,
      error: null,
      fetchProfile: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      linkTelegram: vi.fn(),
      unlinkTelegram: vi.fn(),
      updatePreferences: mockUpdatePreferences,
      clearError: vi.fn(),
      mutations: {} as ReturnType<typeof useProfile>['mutations'],
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  describe('initial state', () => {
    it('defaults to system theme when no preference stored', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('system');
      expect(result.current.resolvedTheme).toBe('light');
    });

    it('resolves to dark when system prefers dark', () => {
      mockMediaQueryList.matches = true;

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('system');
      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('reads theme from localStorage', () => {
      localStorage.setItem('eddo-theme', 'dark');

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('dark');
      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('uses profile theme when authenticated', () => {
      mockUseProfile.mockReturnValue({
        profile: {
          userId: 'test',
          username: 'test',
          email: 'test@test.com',
          createdAt: '',
          updatedAt: '',
          permissions: [],
          status: 'active',
          preferences: { dailyBriefing: false, dailyRecap: false, theme: 'dark' },
        },
        isLoading: false,
        error: null,
        fetchProfile: vi.fn(),
        updateProfile: vi.fn(),
        changePassword: vi.fn(),
        linkTelegram: vi.fn(),
        unlinkTelegram: vi.fn(),
        updatePreferences: mockUpdatePreferences,
        clearError: vi.fn(),
        mutations: {} as ReturnType<typeof useProfile>['mutations'],
      });

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('updates theme state', async () => {
      const { result } = renderHook(() => useTheme());

      await act(async () => {
        await result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('stores theme in localStorage', async () => {
      const { result } = renderHook(() => useTheme());

      await act(async () => {
        await result.current.setTheme('light');
      });

      expect(localStorage.getItem('eddo-theme')).toBe('light');
    });

    it('applies dark class to document', async () => {
      const { result } = renderHook(() => useTheme());

      await act(async () => {
        await result.current.setTheme('dark');
      });

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes dark class for light theme', async () => {
      document.documentElement.classList.add('dark');

      const { result } = renderHook(() => useTheme());

      await act(async () => {
        await result.current.setTheme('light');
      });

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('persists to profile when authenticated', async () => {
      mockUseProfile.mockReturnValue({
        profile: {
          userId: 'test',
          username: 'test',
          email: 'test@test.com',
          createdAt: '',
          updatedAt: '',
          permissions: [],
          status: 'active',
          preferences: { dailyBriefing: false, dailyRecap: false },
        },
        isLoading: false,
        error: null,
        fetchProfile: vi.fn(),
        updateProfile: vi.fn(),
        changePassword: vi.fn(),
        linkTelegram: vi.fn(),
        unlinkTelegram: vi.fn(),
        updatePreferences: mockUpdatePreferences,
        clearError: vi.fn(),
        mutations: {} as ReturnType<typeof useProfile>['mutations'],
      });

      const { result } = renderHook(() => useTheme());

      await act(async () => {
        await result.current.setTheme('dark');
      });

      expect(mockUpdatePreferences).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('does not call updatePreferences when not authenticated', async () => {
      const { result } = renderHook(() => useTheme());

      await act(async () => {
        await result.current.setTheme('dark');
      });

      expect(mockUpdatePreferences).not.toHaveBeenCalled();
    });
  });

  describe('system theme changes', () => {
    it('listens for system theme changes', () => {
      renderHook(() => useTheme());

      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });

    it('updates resolved theme when system changes', async () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.resolvedTheme).toBe('light');

      // Simulate system theme change
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1];
      await act(async () => {
        changeHandler({ matches: true } as MediaQueryListEvent);
      });

      await waitFor(() => {
        expect(result.current.resolvedTheme).toBe('dark');
      });
    });

    it('cleans up listener on unmount', () => {
      const { unmount } = renderHook(() => useTheme());

      unmount();

      expect(mockMediaQueryList.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });
  });
});
