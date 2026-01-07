import { useMemo } from 'react';

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

/** Batch update data for applying presets */
export interface BatchFilterUpdate {
  selectedTags?: string[];
  selectedContexts?: string[];
  selectedStatus?: CompletionStatus;
  selectedTimeRange?: TimeRange;
  currentDate?: Date;
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
  batchUpdate: (updates: BatchFilterUpdate) => Promise<{ success: boolean; error?: string }>;
}

/** Create preference setters bound to updatePreferences */
function createPreferenceSetters(
  updatePreferences: ReturnType<typeof useProfile>['updatePreferences'],
) {
  return {
    setSelectedTags: async (tags: string[]) => updatePreferences({ selectedTags: tags }),
    setSelectedContexts: async (contexts: string[]) =>
      updatePreferences({ selectedContexts: contexts }),
    setSelectedStatus: async (status: CompletionStatus) =>
      updatePreferences({ selectedStatus: status }),
    setSelectedTimeRange: async (timeRange: TimeRange) =>
      updatePreferences({ selectedTimeRange: timeRange }),
    setCurrentDate: async (date: Date) => updatePreferences({ currentDate: date.toISOString() }),
    batchUpdate: async (updates: BatchFilterUpdate) => {
      const payload: Record<string, unknown> = {};
      if (updates.selectedTags !== undefined) payload.selectedTags = updates.selectedTags;
      if (updates.selectedContexts !== undefined)
        payload.selectedContexts = updates.selectedContexts;
      if (updates.selectedStatus !== undefined) payload.selectedStatus = updates.selectedStatus;
      if (updates.selectedTimeRange !== undefined)
        payload.selectedTimeRange = updates.selectedTimeRange;
      if (updates.currentDate !== undefined)
        payload.currentDate = updates.currentDate.toISOString();
      return updatePreferences(payload);
    },
  };
}

/** Hook for managing todo filter preferences */
export const useFilterPreferences = (): UseFilterPreferencesReturn => {
  const { profile, isLoading, error, updatePreferences } = useProfile();
  const prefs = profile?.preferences;

  const selectedTags = useMemo(() => extractSelectedTags(prefs), [prefs]);
  const selectedContexts = useMemo(() => extractSelectedContexts(prefs), [prefs]);
  const selectedStatus = useMemo(() => extractSelectedStatus(prefs), [prefs]);
  const selectedTimeRange = useMemo(() => extractSelectedTimeRange(prefs), [prefs]);
  const currentDate = useMemo(() => extractCurrentDate(prefs), [prefs]);

  const setters = useMemo(() => createPreferenceSetters(updatePreferences), [updatePreferences]);

  return {
    selectedTags,
    selectedContexts,
    selectedStatus,
    selectedTimeRange,
    currentDate,
    isLoading,
    error: error || null,
    ...setters,
  };
};
