import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useViewPreferences } from './use_view_preferences';

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

describe('useViewPreferences Hook', () => {
  it('returns default values when no profile data', () => {
    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      authToken: null,
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

    const { result } = renderHook(() => useViewPreferences());

    expect(result.current.viewMode).toBe('kanban');
    expect(result.current.tableColumns).toEqual([
      'status',
      'title',
      'subtasks',
      'due',
      'tags',
      'timeTracked',
    ]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('returns profile preferences when available', () => {
    vi.mocked(useProfile).mockReturnValue({
      authToken: 'test-token',
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
          viewMode: 'table',
          tableColumns: ['title', 'due', 'status'],
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

    const { result } = renderHook(() => useViewPreferences());

    expect(result.current.viewMode).toBe('table');
    expect(result.current.tableColumns).toEqual(['title', 'due', 'status']);
  });

  it('calls updatePreferences when setting view mode', async () => {
    const updatePreferences = vi.fn().mockResolvedValue({ success: true });

    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      authToken: null,
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

    const { result } = renderHook(() => useViewPreferences());

    await result.current.setViewMode('table');

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith({ viewMode: 'table' });
    });
  });

  it('calls updatePreferences when setting table columns', async () => {
    const updatePreferences = vi.fn().mockResolvedValue({ success: true });

    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      authToken: null,
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

    const { result } = renderHook(() => useViewPreferences());

    const newColumns = ['title', 'tags', 'status'];
    await result.current.setTableColumns(newColumns);

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith({ tableColumns: newColumns });
    });
  });

  it('returns loading state from profile', () => {
    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      authToken: null,
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

    const { result } = renderHook(() => useViewPreferences());

    expect(result.current.isLoading).toBe(true);
  });

  it('returns error state from profile', () => {
    vi.mocked(useProfile).mockReturnValue({
      profile: null,
      authToken: null,
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

    const { result } = renderHook(() => useViewPreferences());

    expect(result.current.error).toBe('Failed to load profile');
  });
});
