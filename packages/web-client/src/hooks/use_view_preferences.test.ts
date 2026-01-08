import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { sortColumnsByCanonicalOrder, useViewPreferences } from './use_view_preferences';

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
      'due',
      'tags',
      'timeTracked',
      'subtasks',
    ]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('returns profile preferences sorted in canonical order regardless of stored order', () => {
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
          // Stored in wrong order - should be sorted on read
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
    // Returns columns in canonical order: status, title, due, ...
    expect(result.current.tableColumns).toEqual(['status', 'title', 'due']);
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

describe('sortColumnsByCanonicalOrder', () => {
  it('sorts columns to match canonical order', () => {
    // Input in wrong order
    const input = ['tags', 'title', 'status', 'due'];
    const result = sortColumnsByCanonicalOrder(input);

    // Should be sorted according to AVAILABLE_COLUMNS order: status, title, due, tags, ...
    expect(result).toEqual(['status', 'title', 'due', 'tags']);
  });

  it('preserves all selected columns', () => {
    const input = ['timeTracked', 'subtasks', 'context'];
    const result = sortColumnsByCanonicalOrder(input);

    expect(result).toHaveLength(3);
    expect(result).toContain('timeTracked');
    expect(result).toContain('subtasks');
    expect(result).toContain('context');
  });

  it('returns empty array for empty input', () => {
    const result = sortColumnsByCanonicalOrder([]);
    expect(result).toEqual([]);
  });

  it('handles single column', () => {
    const result = sortColumnsByCanonicalOrder(['title']);
    expect(result).toEqual(['title']);
  });

  it('handles all columns in wrong order', () => {
    const input = [
      'description',
      'link',
      'repeat',
      'completed',
      'status',
      'timeTracked',
      'tags',
      'due',
      'context',
      'subtasks',
      'title',
    ];
    const result = sortColumnsByCanonicalOrder(input);

    // Canonical order: status, title, due, tags, timeTracked, subtasks, context, completed, repeat, link, description
    expect(result).toEqual([
      'status',
      'title',
      'due',
      'tags',
      'timeTracked',
      'subtasks',
      'context',
      'completed',
      'repeat',
      'link',
      'description',
    ]);
  });

  it('appends unknown columns at the end', () => {
    const input = ['unknownColumn', 'title', 'due'];
    const result = sortColumnsByCanonicalOrder(input);

    // Known columns first in order, unknown at end
    expect(result).toEqual(['title', 'due', 'unknownColumn']);
  });

  it('preserves order of multiple unknown columns', () => {
    const input = ['unknown1', 'title', 'unknown2', 'due'];
    const result = sortColumnsByCanonicalOrder(input);

    // Known columns first in order, unknown at end in original order
    expect(result).toEqual(['title', 'due', 'unknown1', 'unknown2']);
  });

  it('does not mutate input array', () => {
    const input = ['tags', 'title', 'due'];
    const inputCopy = [...input];
    sortColumnsByCanonicalOrder(input);

    expect(input).toEqual(inputCopy);
  });
});
