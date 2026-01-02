/**
 * Helper functions for filter preferences hook
 */
import type { CompletionStatus } from '../components/status_filter';
import type { TimeRange } from '../components/time_range_filter';
import type { FilterPreferences } from './use_filter_preferences';

interface ProfilePreferences {
  selectedTags?: string[];
  selectedContexts?: string[];
  selectedStatus?: CompletionStatus;
  selectedTimeRange?: TimeRange;
  currentDate?: string;
}

/** Extract selected tags from profile */
export function extractSelectedTags(preferences?: ProfilePreferences | null): string[] {
  return preferences?.selectedTags || [];
}

/** Extract selected contexts from profile */
export function extractSelectedContexts(preferences?: ProfilePreferences | null): string[] {
  return preferences?.selectedContexts || [];
}

/** Extract selected status from profile */
export function extractSelectedStatus(preferences?: ProfilePreferences | null): CompletionStatus {
  return preferences?.selectedStatus || 'all';
}

/** Extract selected time range from profile */
export function extractSelectedTimeRange(preferences?: ProfilePreferences | null): TimeRange {
  return preferences?.selectedTimeRange || { type: 'current-week' };
}

/** Extract and validate current date from profile */
export function extractCurrentDate(preferences?: ProfilePreferences | null): Date {
  if (preferences?.currentDate) {
    const date = new Date(preferences.currentDate);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return new Date();
}

/** Build default filter preferences */
export function getDefaultFilterPreferences(): FilterPreferences {
  return {
    selectedTags: [],
    selectedContexts: [],
    selectedStatus: 'all',
    selectedTimeRange: { type: 'current-week' },
    currentDate: new Date(),
  };
}
