/**
 * Type definitions for todo filters components
 */
import type { BatchFilterUpdate } from '../hooks/use_filter_preferences';
import type { CurrentFilterState } from '../hooks/use_filter_presets';
import type { ViewMode } from '../hooks/use_view_preferences';

import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';

export interface TodoFiltersProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  selectedContexts: string[];
  setSelectedContexts: (contexts: string[]) => void;
  selectedStatus: CompletionStatus;
  setSelectedStatus: (status: CompletionStatus) => void;
  selectedTimeRange: TimeRange;
  setSelectedTimeRange: (timeRange: TimeRange) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  tableColumns: string[];
  onTableColumnsChange: (columns: string[]) => void;
  isViewPrefsLoading?: boolean;
  batchUpdateFilters?: (
    updates: BatchFilterUpdate,
  ) => Promise<{ success: boolean; error?: string }>;
}

export interface FilterRowProps {
  viewMode: ViewMode;
  isViewPrefsLoading: boolean;
  tableColumns: string[];
  onViewModeChange: (mode: ViewMode) => void;
  onTableColumnsChange: (columns: string[]) => void;
  selectedTimeRange: TimeRange;
  setSelectedTimeRange: (timeRange: TimeRange) => void;
  selectedStatus: CompletionStatus;
  setSelectedStatus: (status: CompletionStatus) => void;
  allContexts: string[];
  selectedContexts: string[];
  setSelectedContexts: (contexts: string[]) => void;
  allTags: string[];
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  currentDate: Date;
  onApplyPreset: (filters: CurrentFilterState) => void;
}

export interface PeriodNavigationProps {
  currentDate: Date;
  selectedTimeRange: TimeRange;
  onNavigate: (direction: 'prev' | 'next') => void;
  onReset: () => void;
}
