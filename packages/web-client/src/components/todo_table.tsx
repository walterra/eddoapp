/**
 * Table view for todos grouped by context
 */
import { type Activity, type DatabaseError, type Todo } from '@eddo/core-client';
import { type FC, useMemo } from 'react';

import { type SubtaskCount, useSubtaskCountsForParents } from '../hooks/use_parent_child';
import { usePouchDb } from '../pouch_db';
import { DatabaseErrorFallback } from './database_error_fallback';
import { DatabaseErrorMessage } from './database_error_message';
import { EmptyState } from './empty_state';
import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';
import { calculateDateRange, type DateRange } from './todo_board_helpers';
import { useDbInitialization, useTodoBoardData } from './todo_board_state';
import { LoadingSpinner, TodoTableContent } from './todo_table_content';
import {
  calculateDurationByContext,
  calculateTodoDurations,
  filterTodos,
  groupTodosByContext,
} from './todo_table_helpers';

interface TodoTableProps {
  currentDate: Date;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeRange: TimeRange;
  selectedColumns: string[];
}

interface TableDataResult {
  groupedByContext: Array<[string, Todo[]]>;
  durationByContext: Record<string, string>;
  todoDurations: Map<string, number>;
  subtaskCounts: Map<string, SubtaskCount>;
  displayError: DatabaseError | null;
  hasNoTodos: boolean;
  hasActiveFilters: boolean;
  dateRange: DateRange;
}

interface FilterParams {
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
}

interface FilteredDataParams extends FilterParams {
  startDate: string;
  endDate: string;
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

/** Filters and groups todos/activities based on user selection */
const useFilteredData = (
  boardData: ReturnType<typeof useTodoBoardData>,
  params: FilteredDataParams,
) => {
  const { selectedTags, selectedContexts, selectedStatus, startDate, endDate } = params;

  // Pre-calculate ALL durations once (independent of filters)
  const allTodoDurations = useAllTodoDurations(
    boardData.todos,
    boardData.activities as Activity[],
    startDate,
    endDate,
  );

  const filteredTodos = useMemo(
    () => filterTodos(boardData.todos, selectedContexts, selectedStatus, selectedTags),
    [boardData.todos, selectedTags, selectedContexts, selectedStatus],
  );

  const groupedByContext = useMemo(() => groupTodosByContext(filteredTodos), [filteredTodos]);

  // Filter the pre-calculated durations to only include visible todos
  const todoDurations = useMemo(() => {
    const filtered = new Map<string, number>();
    for (const todo of filteredTodos) {
      const duration = allTodoDurations.get(todo._id);
      if (duration !== undefined) {
        filtered.set(todo._id, duration);
      }
    }
    return filtered;
  }, [filteredTodos, allTodoDurations]);

  // Context totals = sum of visible todo durations
  const durationByContext = useMemo(
    () => calculateDurationByContext(todoDurations, filteredTodos),
    [todoDurations, filteredTodos],
  );

  return { filteredTodos, groupedByContext, durationByContext, todoDurations };
};

/** Computes derived state flags from table data */
const useTableFlags = (
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
    filters.selectedStatus !== 'all';

  return { hasNoTodos, hasActiveFilters };
};

const useTableData = (
  props: TodoTableProps,
  isInitialized: boolean,
  error: DatabaseError | null,
): TableDataResult & ReturnType<typeof useTodoBoardData> => {
  const { currentDate, selectedTags, selectedContexts, selectedStatus, selectedTimeRange } = props;

  const dateRange = useMemo(
    () => calculateDateRange(currentDate, selectedTimeRange),
    [currentDate, selectedTimeRange],
  );

  const boardData = useTodoBoardData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    isInitialized,
  });

  const { groupedByContext, durationByContext, todoDurations, filteredTodos } = useFilteredData(
    boardData,
    {
      selectedTags,
      selectedContexts,
      selectedStatus,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    },
  );

  // Get IDs of visible todos to fetch their children's counts
  const visibleParentIds = useMemo(() => filteredTodos.map((t) => t._id), [filteredTodos]);
  const { data: subtaskCounts } = useSubtaskCountsForParents(visibleParentIds, isInitialized);

  const { hasNoTodos, hasActiveFilters } = useTableFlags(
    groupedByContext,
    boardData,
    isInitialized,
    { selectedTags, selectedContexts, selectedStatus },
  );

  return {
    ...boardData,
    groupedByContext,
    durationByContext,
    todoDurations,
    subtaskCounts: subtaskCounts ?? new Map<string, SubtaskCount>(),
    displayError: error || (boardData.queryError as DatabaseError | null),
    hasNoTodos,
    hasActiveFilters,
    dateRange,
  };
};

export const TodoTable: FC<TodoTableProps> = (props) => {
  const { safeDb, rawDb } = usePouchDb();
  const { error, setError, isInitialized } = useDbInitialization(safeDb, rawDb);
  const data = useTableData(props, isInitialized, error);

  if (data.displayError && data.todos.length === 0 && !data.isLoading) {
    const handleError = () => {
      setError(null);
      data.todosQuery.refetch();
      data.activitiesQuery.refetch();
    };
    return (
      <div className="bg-neutral-50 p-8 dark:bg-neutral-800">
        <DatabaseErrorFallback
          error={data.displayError}
          onDismiss={handleError}
          onRetry={handleError}
        />
      </div>
    );
  }

  if (data.showLoadingSpinner) return <LoadingSpinner />;

  return (
    <div className="bg-neutral-50 dark:bg-neutral-800">
      {data.displayError && data.todos.length > 0 && (
        <div className="px-4 pt-2">
          <DatabaseErrorMessage error={data.displayError} onDismiss={() => setError(null)} />
        </div>
      )}
      {data.hasNoTodos ? (
        <EmptyState
          description={
            data.hasActiveFilters
              ? 'Try adjusting your filters or select a different time range.'
              : 'Get started by adding your first todo above.'
          }
          title="No todos found"
        />
      ) : (
        <TodoTableContent
          durationByContext={data.durationByContext}
          groupedByContext={data.groupedByContext}
          selectedColumns={props.selectedColumns}
          subtaskCounts={data.subtaskCounts}
          timeTrackingActive={data.timeTrackingActive}
          todoDurations={data.todoDurations}
        />
      )}
    </div>
  );
};
