/**
 * Internal data helpers for TodoTable filtering and aggregation.
 */
import { type Activity, type Todo } from '@eddo/core-client';
import { useMemo } from 'react';

import type { CompletionStatus } from './status_filter';
import type { TimeTrackingStatus } from './time_tracking_filter';
import { useTodoBoardData } from './todo_board_state';
import {
  calculateDurationByContext,
  calculateTodoDurations,
  filterTodos,
  groupTodosByContext,
  type TodoFilterCriteria,
} from './todo_table_helpers';

export interface FilterParams {
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeTracking: TimeTrackingStatus;
}

export interface FilteredDataParams extends FilterParams {
  startDate: string;
  endDate: string;
}

export interface FilteredTableData {
  filteredTodos: Todo[];
  groupedByContext: Array<[string, Todo[]]>;
  durationByContext: Record<string, string>;
  todoDurations: Map<string, number>;
}

/**
 * Pre-calculate durations for ALL todos once when source data changes.
 * This avoids recalculating when only filters change.
 */
const useAllTodoDurations = (
  todos: readonly Todo[],
  activities: readonly Activity[],
  startDate: string,
  endDate: string,
): Map<string, number> => {
  return useMemo(
    () => calculateTodoDurations(todos, activities, startDate, endDate),
    [todos, activities, startDate, endDate],
  );
};

const useTodoFilterCriteria = (
  params: Pick<
    FilteredDataParams,
    'selectedContexts' | 'selectedStatus' | 'selectedTags' | 'selectedTimeTracking'
  >,
  timeTrackingActive: readonly string[],
): TodoFilterCriteria => {
  const { selectedContexts, selectedStatus, selectedTags, selectedTimeTracking } = params;

  return useMemo(
    () => ({
      selectedContexts,
      selectedStatus,
      selectedTags,
      selectedTimeTracking,
      timeTrackingActive,
    }),
    [selectedContexts, selectedStatus, selectedTags, selectedTimeTracking, timeTrackingActive],
  );
};

const useVisibleTodoDurations = (
  filteredTodos: readonly Todo[],
  allTodoDurations: ReadonlyMap<string, number>,
): Map<string, number> => {
  return useMemo(() => {
    const filtered = new Map<string, number>();

    for (const todo of filteredTodos) {
      const duration = allTodoDurations.get(todo._id);
      if (duration !== undefined) {
        filtered.set(todo._id, duration);
      }
    }

    return filtered;
  }, [filteredTodos, allTodoDurations]);
};

/** Filters and groups todos based on user selection */
export const useFilteredData = (
  boardData: ReturnType<typeof useTodoBoardData>,
  params: FilteredDataParams,
): FilteredTableData => {
  const { startDate, endDate } = params;

  const allTodoDurations = useAllTodoDurations(
    boardData.todos,
    boardData.activities as Activity[],
    startDate,
    endDate,
  );
  const criteria = useTodoFilterCriteria(params, boardData.timeTrackingActive);
  const filteredTodos = useMemo(
    () => filterTodos(boardData.todos, criteria),
    [boardData.todos, criteria],
  );
  const groupedByContext = useMemo(() => groupTodosByContext(filteredTodos), [filteredTodos]);
  const todoDurations = useVisibleTodoDurations(filteredTodos, allTodoDurations);
  const durationByContext = useMemo(
    () => calculateDurationByContext(todoDurations, filteredTodos),
    [todoDurations, filteredTodos],
  );

  return { filteredTodos, groupedByContext, durationByContext, todoDurations };
};

/** Computes derived state flags from table data */
export const useTableFlags = (
  groupedByContext: Array<[string, Todo[]]>,
  boardData: ReturnType<typeof useTodoBoardData>,
  isInitialized: boolean,
  filters: FilterParams,
) => {
  const hasNoTodos =
    groupedByContext.length === 0 &&
    !boardData.isLoading &&
    isInitialized &&
    boardData.todosQuery.isFetched;

  const hasActiveFilters =
    filters.selectedTags.length > 0 ||
    filters.selectedContexts.length > 0 ||
    filters.selectedStatus !== 'all' ||
    filters.selectedTimeTracking !== 'all';

  return { hasNoTodos, hasActiveFilters };
};
