import { useCallback, useMemo } from 'react';

import type { CompletionStatus } from '../components/status_filter';
import type { TimeRange } from '../components/time_range_filter';
import {
  extractCurrentDate,
  extractSelectedContexts,
  extractSelectedStatus,
  extractSelectedTags,
  extractSelectedTimeRange,
} from './use_filter_preferences_helpers';
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

  const prefs = profile?.preferences;

  const selectedTags = useMemo(() => extractSelectedTags(prefs), [prefs]);
  const selectedContexts = useMemo(() => extractSelectedContexts(prefs), [prefs]);
  const selectedStatus = useMemo(() => extractSelectedStatus(prefs), [prefs]);
  const selectedTimeRange = useMemo(() => extractSelectedTimeRange(prefs), [prefs]);
  const currentDate = useMemo(() => extractCurrentDate(prefs), [prefs]);

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
