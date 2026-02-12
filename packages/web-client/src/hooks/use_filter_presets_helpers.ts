/**
 * Helper functions for filter presets hook
 */
import type { CompletionStatus } from '../components/status_filter';
import type { TimeRange } from '../components/time_range_filter';
import type { TimeTrackingStatus } from '../components/time_tracking_filter';

import type { FilterPreset } from './use_profile_types';

/** Current filter state to save as a preset */
export interface CurrentFilterState {
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeTracking: TimeTrackingStatus;
  selectedTimeRange: TimeRange;
  currentDate: Date;
}

/** Data for creating a new preset */
export interface CreatePresetData {
  name: string;
  filters: CurrentFilterState;
  useRelativeDate: boolean;
}

/** Data for updating an existing preset */
export interface UpdatePresetData {
  id: string;
  name?: string;
}

/** Generate a unique ID for a new preset */
export function generatePresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Create a FilterPreset from current filter state */
export function createFilterPreset(data: CreatePresetData): FilterPreset {
  return {
    id: generatePresetId(),
    name: data.name.trim(),
    selectedTags: [...data.filters.selectedTags],
    selectedContexts: [...data.filters.selectedContexts],
    selectedStatus: data.filters.selectedStatus,
    selectedTimeTracking: data.filters.selectedTimeTracking,
    selectedTimeRange: { ...data.filters.selectedTimeRange },
    dateMode: data.useRelativeDate ? 'relative' : 'fixed',
    savedDate: data.useRelativeDate ? undefined : data.filters.currentDate.toISOString(),
    createdAt: new Date().toISOString(),
  };
}

/** Convert a preset back to filter state for applying */
export function presetToFilterState(preset: FilterPreset): CurrentFilterState {
  const currentDate =
    preset.dateMode === 'relative' ? new Date() : new Date(preset.savedDate ?? new Date());

  return {
    selectedTags: [...preset.selectedTags],
    selectedContexts: [...preset.selectedContexts],
    selectedStatus: preset.selectedStatus,
    selectedTimeTracking: preset.selectedTimeTracking ?? 'all',
    selectedTimeRange: { ...preset.selectedTimeRange },
    currentDate,
  };
}

/** Update a preset in the list by ID */
export function updatePresetInList(
  presets: FilterPreset[],
  id: string,
  updates: Partial<Pick<FilterPreset, 'name'>>,
): FilterPreset[] {
  return presets.map((p) => (p.id === id ? { ...p, ...updates } : p));
}
