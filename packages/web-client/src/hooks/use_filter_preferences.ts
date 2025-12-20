import { useCallback, useMemo } from 'react';

import type { CompletionStatus } from '../components/status_filter';
import type { TimeRange } from '../components/time_range_filter';
import { useProfile } from './use_profile';

export interface FilterPreferences {
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeRange: TimeRange;
  currentDate: Date;
}

export interface UseFilterPreferencesReturn {
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeRange: TimeRange;
  currentDate: Date;
  isLoading: boolean;
  error: string | null;
  setSelectedTags: (tags: string[]) => Promise<{ success: boolean; error?: string }>;
  setSelectedContexts: (contexts: string[]) => Promise<{ success: boolean; error?: string }>;
  setSelectedStatus: (status: CompletionStatus) => Promise<{ success: boolean; error?: string }>;
  setSelectedTimeRange: (timeRange: TimeRange) => Promise<{ success: boolean; error?: string }>;
  setCurrentDate: (date: Date) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Hook for managing todo filter preferences
 */
export const useFilterPreferences = (): UseFilterPreferencesReturn => {
  const { profile, isLoading, error, updatePreferences } = useProfile();

  const selectedTags = useMemo<string[]>(
    () => profile?.preferences?.selectedTags || [],
    [profile?.preferences?.selectedTags],
  );

  const selectedContexts = useMemo<string[]>(
    () => profile?.preferences?.selectedContexts || [],
    [profile?.preferences?.selectedContexts],
  );

  const selectedStatus = useMemo<CompletionStatus>(
    () => profile?.preferences?.selectedStatus || 'all',
    [profile?.preferences?.selectedStatus],
  );

  const selectedTimeRange = useMemo<TimeRange>(
    () => profile?.preferences?.selectedTimeRange || { type: 'current-week' },
    [profile?.preferences?.selectedTimeRange],
  );

  const currentDate = useMemo<Date>(() => {
    if (profile?.preferences?.currentDate) {
      const date = new Date(profile.preferences.currentDate);
      // Validate date is valid (not Invalid Date)
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return new Date();
  }, [profile?.preferences?.currentDate]);

  const setSelectedTags = useCallback(
    async (tags: string[]) => {
      return await updatePreferences({ selectedTags: tags });
    },
    [updatePreferences],
  );

  const setSelectedContexts = useCallback(
    async (contexts: string[]) => {
      return await updatePreferences({ selectedContexts: contexts });
    },
    [updatePreferences],
  );

  const setSelectedStatus = useCallback(
    async (status: CompletionStatus) => {
      return await updatePreferences({ selectedStatus: status });
    },
    [updatePreferences],
  );

  const setSelectedTimeRange = useCallback(
    async (timeRange: TimeRange) => {
      return await updatePreferences({ selectedTimeRange: timeRange });
    },
    [updatePreferences],
  );

  const setCurrentDate = useCallback(
    async (date: Date) => {
      return await updatePreferences({ currentDate: date.toISOString() });
    },
    [updatePreferences],
  );

  return {
    selectedTags,
    selectedContexts,
    selectedStatus,
    selectedTimeRange,
    currentDate,
    isLoading,
    error: error || null,
    setSelectedTags,
    setSelectedContexts,
    setSelectedStatus,
    setSelectedTimeRange,
    setCurrentDate,
  };
};
