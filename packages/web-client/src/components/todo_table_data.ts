/**
 * Data and filtering hooks for TodoTable.
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import { useMemo } from 'react';

import { type SubtaskCount, useSubtaskCountsForParents } from '../hooks/use_parent_child';

import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';
import type { TimeTrackingStatus } from './time_tracking_filter';
import { calculateDateRange, type DateRange } from './todo_board_helpers';
import { useTodoBoardData } from './todo_board_state';
import {
  type FilteredDataParams,
  type FilterParams,
  useFilteredData,
  useTableFlags,
} from './todo_table_data_helpers';

export interface TodoTableProps {
  currentDate: Date;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeTracking: TimeTrackingStatus;
  selectedTimeRange: TimeRange;
  selectedColumns: string[];
}

export interface TableDataResult {
  groupedByContext: Array<[string, Todo[]]>;
  durationByContext: Record<string, string>;
  todoDurations: Map<string, number>;
  subtaskCounts: Map<string, SubtaskCount>;
  displayError: DatabaseError | null;
  hasNoTodos: boolean;
  hasActiveFilters: boolean;
  dateRange: DateRange;
}

export type TodoTableData = TableDataResult & ReturnType<typeof useTodoBoardData>;

interface BuildFilterParamsInput extends FilterParams {
  dateRange: DateRange;
}

const buildFilterParams = ({
  selectedTags,
  selectedContexts,
  selectedStatus,
  selectedTimeTracking,
  dateRange,
}: BuildFilterParamsInput): FilteredDataParams => ({
  selectedTags,
  selectedContexts,
  selectedStatus,
  selectedTimeTracking,
  startDate: dateRange.startDate,
  endDate: dateRange.endDate,
});

interface BuildTableDataResultParams {
  boardData: ReturnType<typeof useTodoBoardData>;
  groupedByContext: Array<[string, Todo[]]>;
  durationByContext: Record<string, string>;
  todoDurations: Map<string, number>;
  subtaskCounts: Map<string, SubtaskCount>;
  error: DatabaseError | null;
  hasNoTodos: boolean;
  hasActiveFilters: boolean;
  dateRange: DateRange;
}

const buildTableDataResult = ({
  boardData,
  groupedByContext,
  durationByContext,
  todoDurations,
  subtaskCounts,
  error,
  hasNoTodos,
  hasActiveFilters,
  dateRange,
}: BuildTableDataResultParams): TodoTableData => ({
  ...boardData,
  groupedByContext,
  durationByContext,
  todoDurations,
  subtaskCounts,
  displayError: error || (boardData.queryError as DatabaseError | null),
  hasNoTodos,
  hasActiveFilters,
  dateRange,
});

interface TableDerivedData {
  groupedByContext: Array<[string, Todo[]]>;
  durationByContext: Record<string, string>;
  todoDurations: Map<string, number>;
  subtaskCounts: Map<string, SubtaskCount>;
  hasNoTodos: boolean;
  hasActiveFilters: boolean;
}

interface UseTableDerivedDataParams {
  boardData: ReturnType<typeof useTodoBoardData>;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeTracking: TimeTrackingStatus;
  dateRange: DateRange;
  isInitialized: boolean;
}

const useTableDerivedData = ({
  boardData,
  selectedTags,
  selectedContexts,
  selectedStatus,
  selectedTimeTracking,
  dateRange,
  isInitialized,
}: UseTableDerivedDataParams): TableDerivedData => {
  const filterParams = buildFilterParams({
    selectedTags,
    selectedContexts,
    selectedStatus,
    selectedTimeTracking,
    dateRange,
  });

  const { groupedByContext, durationByContext, todoDurations, filteredTodos } = useFilteredData(
    boardData,
    filterParams,
  );

  const visibleParentIds = useMemo(() => filteredTodos.map((todo) => todo._id), [filteredTodos]);
  const { data: subtaskCounts } = useSubtaskCountsForParents(visibleParentIds, isInitialized);

  const filters: FilterParams = {
    selectedTags,
    selectedContexts,
    selectedStatus,
    selectedTimeTracking,
  };
  const { hasNoTodos, hasActiveFilters } = useTableFlags(
    groupedByContext,
    boardData,
    isInitialized,
    filters,
  );

  return {
    groupedByContext,
    durationByContext,
    todoDurations,
    subtaskCounts: subtaskCounts ?? new Map<string, SubtaskCount>(),
    hasNoTodos,
    hasActiveFilters,
  };
};

export const useTableData = (
  props: TodoTableProps,
  isInitialized: boolean,
  error: DatabaseError | null,
): TodoTableData => {
  const {
    currentDate,
    selectedTags,
    selectedContexts,
    selectedStatus,
    selectedTimeTracking,
    selectedTimeRange,
  } = props;

  const dateRange = useMemo(
    () => calculateDateRange(currentDate, selectedTimeRange),
    [currentDate, selectedTimeRange],
  );

  const boardData = useTodoBoardData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    isInitialized,
  });

  const {
    groupedByContext,
    durationByContext,
    todoDurations,
    subtaskCounts,
    hasNoTodos,
    hasActiveFilters,
  } = useTableDerivedData({
    boardData,
    selectedTags,
    selectedContexts,
    selectedStatus,
    selectedTimeTracking,
    dateRange,
    isInitialized,
  });

  return buildTableDataResult({
    boardData,
    groupedByContext,
    durationByContext,
    todoDurations,
    subtaskCounts,
    error,
    hasNoTodos,
    hasActiveFilters,
    dateRange,
  });
};
