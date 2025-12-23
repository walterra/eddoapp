import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useFilterPreferences } from './use_filter_preferences';

// Mock useProfile hook
vi.mock('./use_profile', () => ({
  useProfile: vi.fn(),
}));

import { useProfile } from './use_profile';

/** Creates mock mutations object for useProfile tests */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockMutations = (): any => ({
  updateProfile: {
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  },
  changePassword: {
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  },
  linkTelegram: {
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  },
  unlinkTelegram: {
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  },
  preferences: {
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  },
  githubResync: {
    isPending: false,
    isError: false,
    error: null,
    reset: vi.fn(),
    mutateAsync: vi.fn(),
  },
});

describe('useFilterPreferences Hook', () => {
  it('returns default values when no profile data', () => {
    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      isLoading: false,
      error: null,
      fetchProfile: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      linkTelegram: vi.fn(),
      unlinkTelegram: vi.fn(),
      updatePreferences: vi.fn(),
      clearError: vi.fn(),
      mutations: createMockMutations(),
    });

    const { result } = renderHook(() => useFilterPreferences());

    expect(result.current.selectedTags).toEqual([]);
    expect(result.current.selectedContexts).toEqual([]);
    expect(result.current.selectedStatus).toBe('all');
    expect(result.current.selectedTimeRange).toEqual({ type: 'current-week' });
    expect(result.current.currentDate).toBeInstanceOf(Date);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('returns profile filter preferences when available', () => {
    const testDate = '2024-07-15T10:00:00.000Z';
    vi.mocked(useProfile).mockReturnValue({
      profile: {
        userId: '123',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        permissions: [],
        status: 'active',
        preferences: {
          dailyBriefing: false,
          dailyRecap: false,
          selectedTags: ['work', 'urgent'],
          selectedContexts: ['office'],
          selectedStatus: 'incomplete',
          selectedTimeRange: { type: 'current-month' },
          currentDate: testDate,
        },
      },
      isLoading: false,
      error: null,
      fetchProfile: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      linkTelegram: vi.fn(),
      unlinkTelegram: vi.fn(),
      updatePreferences: vi.fn(),
      clearError: vi.fn(),
      mutations: createMockMutations(),
    });

    const { result } = renderHook(() => useFilterPreferences());

    expect(result.current.selectedTags).toEqual(['work', 'urgent']);
    expect(result.current.selectedContexts).toEqual(['office']);
    expect(result.current.selectedStatus).toBe('incomplete');
    expect(result.current.selectedTimeRange).toEqual({ type: 'current-month' });
    expect(result.current.currentDate).toEqual(new Date(testDate));
  });

  it('calls updatePreferences when setting selected tags', async () => {
    const updatePreferences = vi.fn().mockResolvedValue({ success: true });

    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      isLoading: false,
      error: null,
      fetchProfile: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      linkTelegram: vi.fn(),
      unlinkTelegram: vi.fn(),
      updatePreferences,
      clearError: vi.fn(),
      mutations: createMockMutations(),
    });

    const { result } = renderHook(() => useFilterPreferences());

    const newTags = ['personal', 'important'];
    await result.current.setSelectedTags(newTags);

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith({ selectedTags: newTags });
    });
  });

  it('calls updatePreferences when setting selected contexts', async () => {
    const updatePreferences = vi.fn().mockResolvedValue({ success: true });

    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      isLoading: false,
      error: null,
      fetchProfile: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      linkTelegram: vi.fn(),
      unlinkTelegram: vi.fn(),
      updatePreferences,
      clearError: vi.fn(),
      mutations: createMockMutations(),
    });

    const { result } = renderHook(() => useFilterPreferences());

    const newContexts = ['home', 'errands'];
    await result.current.setSelectedContexts(newContexts);

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith({ selectedContexts: newContexts });
    });
  });

  it('calls updatePreferences when setting selected status', async () => {
    const updatePreferences = vi.fn().mockResolvedValue({ success: true });

    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      isLoading: false,
      error: null,
      fetchProfile: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      linkTelegram: vi.fn(),
      unlinkTelegram: vi.fn(),
      updatePreferences,
      clearError: vi.fn(),
      mutations: createMockMutations(),
    });

    const { result } = renderHook(() => useFilterPreferences());

    await result.current.setSelectedStatus('completed');

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith({ selectedStatus: 'completed' });
    });
  });

  it('calls updatePreferences when setting selected time range', async () => {
    const updatePreferences = vi.fn().mockResolvedValue({ success: true });

    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      isLoading: false,
      error: null,
      fetchProfile: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      linkTelegram: vi.fn(),
      unlinkTelegram: vi.fn(),
      updatePreferences,
      clearError: vi.fn(),
      mutations: createMockMutations(),
    });

    const { result } = renderHook(() => useFilterPreferences());

    const newTimeRange = { type: 'current-year' as const };
    await result.current.setSelectedTimeRange(newTimeRange);

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith({ selectedTimeRange: newTimeRange });
    });
  });

  it('calls updatePreferences when setting current date', async () => {
    const updatePreferences = vi.fn().mockResolvedValue({ success: true });

    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      isLoading: false,
      error: null,
      fetchProfile: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      linkTelegram: vi.fn(),
      unlinkTelegram: vi.fn(),
      updatePreferences,
      clearError: vi.fn(),
      mutations: createMockMutations(),
    });

    const { result } = renderHook(() => useFilterPreferences());

    const newDate = new Date('2024-08-20T12:00:00.000Z');
    await result.current.setCurrentDate(newDate);

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith({
        currentDate: newDate.toISOString(),
      });
    });
  });

  it('returns loading state from profile', () => {
    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
      fetchProfile: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      linkTelegram: vi.fn(),
      unlinkTelegram: vi.fn(),
      updatePreferences: vi.fn(),
      clearError: vi.fn(),
      mutations: createMockMutations(),
    });

    const { result } = renderHook(() => useFilterPreferences());

    expect(result.current.isLoading).toBe(true);
  });

  it('returns error state from profile', () => {
    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      isLoading: false,
      error: 'Failed to load profile',
      fetchProfile: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      linkTelegram: vi.fn(),
      unlinkTelegram: vi.fn(),
      updatePreferences: vi.fn(),
      clearError: vi.fn(),
      mutations: createMockMutations(),
    });

    const { result } = renderHook(() => useFilterPreferences());

    expect(result.current.error).toBe('Failed to load profile');
  });

  it('handles invalid date strings gracefully', () => {
    vi.mocked(useProfile).mockReturnValue({
      profile: {
        userId: '123',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        permissions: [],
        status: 'active',
        preferences: {
          dailyBriefing: false,
          dailyRecap: false,
          currentDate: 'invalid-date-string',
        },
      },
      isLoading: false,
      error: null,
      fetchProfile: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      linkTelegram: vi.fn(),
      unlinkTelegram: vi.fn(),
      updatePreferences: vi.fn(),
      clearError: vi.fn(),
      mutations: createMockMutations(),
    });

    const { result } = renderHook(() => useFilterPreferences());

    // Should fallback to current date instead of Invalid Date
    expect(result.current.currentDate).toBeInstanceOf(Date);
    expect(isNaN(result.current.currentDate.getTime())).toBe(false);
  });
});
