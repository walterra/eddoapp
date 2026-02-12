/**
 * Kanban-style todo board component with context columns
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import { Spinner } from 'flowbite-react';
import { type FC, useMemo } from 'react';

import { usePouchDb } from '../pouch_db';
import { DatabaseErrorFallback } from './database_error_fallback';
import { DatabaseErrorMessage } from './database_error_message';
import { EmptyState } from './empty_state';
import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';
import type { TimeTrackingStatus } from './time_tracking_filter';
import { ContextColumn } from './todo_board_columns';
import {
  type ActivityItem,
  type TodoFilterCriteria,
  calculateDateRange,
  calculateDurationByContext,
  calculateDurationByContextAndDate,
  filterActivities,
  filterTodos,
  groupByContextAndDate,
} from './todo_board_helpers';
import {
  generateTodosDownloadUrl,
  useDbInitialization,
  useOutdatedTodos,
  useTodoBoardData,
} from './todo_board_state';

interface TodoBoardProps {
  currentDate: Date;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeTracking: TimeTrackingStatus;
  selectedTimeRange: TimeRange;
}

interface BoardDataResult {
  groupedByContextByDate: Array<[string, Map<string, Array<Todo | ActivityItem>>]>;
  durationByContext: Record<string, string>;
  durationByContextByDate: Array<[string, Map<string, ActivityItem[]>]>;
  timeTrackingActive: string[];
  dataStr: string;
  displayError: DatabaseError | null;
  hasNoTodos: boolean;
  hasActiveFilters: boolean;
}

interface FilteredDataParams {
  boardData: ReturnType<typeof useTodoBoardData>;
  criteria: TodoFilterCriteria;
}

/** Compute filtered and grouped data from board state */
const useFilteredData = ({ boardData, criteria }: FilteredDataParams) => {
  const filteredTodos = useMemo(
    () => filterTodos(boardData.todos, criteria),
    [boardData.todos, criteria],
  );

  const filteredActivities = useMemo(
    () => filterActivities(boardData.activities, criteria),
    [boardData.activities, criteria],
  );

  return { filteredTodos, filteredActivities };
};

/** Compute duration aggregations */
const useDurationData = (activities: ActivityItem[]) => ({
  durationByContext: useMemo(() => calculateDurationByContext(activities), [activities]),
  durationByContextByDate: useMemo(
    () => calculateDurationByContextAndDate(activities),
    [activities],
  ),
});

interface BoardFlagsParams {
  groupedByContextByDate: Array<[string, Map<string, Array<Todo | ActivityItem>>]>;
  boardData: ReturnType<typeof useTodoBoardData>;
  isInitialized: boolean;
  criteria: TodoFilterCriteria;
}

/** Compute empty-state and active-filter flags for board view */
const getBoardFlags = ({
  groupedByContextByDate,
  boardData,
  isInitialized,
  criteria,
}: BoardFlagsParams) => ({
  hasNoTodos:
    groupedByContextByDate.length === 0 &&
    !boardData.isLoading &&
    isInitialized &&
    boardData.todosQuery.isFetched,
  hasActiveFilters:
    criteria.selectedTags.length > 0 ||
    criteria.selectedContexts.length > 0 ||
    criteria.selectedStatus !== 'all' ||
    criteria.selectedTimeTracking !== 'all',
});

interface BoardDerivedData {
  groupedByContextByDate: Array<[string, Map<string, Array<Todo | ActivityItem>>]>;
  durationByContext: Record<string, string>;
  durationByContextByDate: Array<[string, Map<string, ActivityItem[]>]>;
  hasNoTodos: boolean;
  hasActiveFilters: boolean;
}

interface UseBoardDerivedDataParams {
  boardData: ReturnType<typeof useTodoBoardData>;
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTags: string[];
  selectedTimeTracking: TimeTrackingStatus;
  isInitialized: boolean;
}

const useBoardDerivedData = ({
  boardData,
  selectedContexts,
  selectedStatus,
  selectedTags,
  selectedTimeTracking,
  isInitialized,
}: UseBoardDerivedDataParams): BoardDerivedData => {
  const criteria = useMemo<TodoFilterCriteria>(
    () => ({
      selectedContexts,
      selectedStatus,
      selectedTags,
      selectedTimeTracking,
      timeTrackingActive: boardData.timeTrackingActive,
    }),
    [
      selectedContexts,
      selectedStatus,
      selectedTags,
      selectedTimeTracking,
      boardData.timeTrackingActive,
    ],
  );

  const { filteredTodos, filteredActivities } = useFilteredData({ boardData, criteria });
  const groupedByContextByDate = useMemo(
    () => groupByContextAndDate(filteredTodos, filteredActivities),
    [filteredTodos, filteredActivities],
  );
  const { durationByContext, durationByContextByDate } = useDurationData(boardData.activities);
  const { hasNoTodos, hasActiveFilters } = getBoardFlags({
    groupedByContextByDate,
    boardData,
    isInitialized,
    criteria,
  });

  return {
    groupedByContextByDate,
    durationByContext,
    durationByContextByDate,
    hasNoTodos,
    hasActiveFilters,
  };
};

const useBoardData = (
  props: TodoBoardProps,
  isInitialized: boolean,
  error: DatabaseError | null,
): BoardDataResult & ReturnType<typeof useTodoBoardData> => {
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
  useOutdatedTodos(boardData.outdatedTodosMemo);

  const {
    groupedByContextByDate,
    durationByContext,
    durationByContextByDate,
    hasNoTodos,
    hasActiveFilters,
  } = useBoardDerivedData({
    boardData,
    selectedContexts,
    selectedStatus,
    selectedTags,
    selectedTimeTracking,
    isInitialized,
  });

  return {
    ...boardData,
    groupedByContextByDate,
    durationByContext,
    durationByContextByDate,
    dataStr: generateTodosDownloadUrl(boardData.todos),
    displayError: error || (boardData.queryError as DatabaseError | null),
    hasNoTodos,
    hasActiveFilters,
  };
};

export const TodoBoard: FC<TodoBoardProps> = (props) => {
  const { safeDb, rawDb } = usePouchDb();
  const { error, setError, isInitialized } = useDbInitialization(safeDb, rawDb);
  const data = useBoardData(props, isInitialized, error);

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
        <TodoBoardContent {...data} />
      )}
    </div>
  );
};

const LoadingSpinner: FC = () => (
  <div
    aria-label="Loading todos"
    className="flex min-h-64 items-center justify-center bg-neutral-50 dark:bg-neutral-800"
    role="status"
  >
    <Spinner aria-label="Loading" size="lg" />
    <span className="ml-3 text-neutral-600 dark:text-neutral-400">Loading todos...</span>
  </div>
);

interface TodoBoardContentProps {
  groupedByContextByDate: Array<[string, Map<string, Array<Todo | ActivityItem>>]>;
  durationByContext: Record<string, string>;
  durationByContextByDate: Array<[string, Map<string, ActivityItem[]>]>;
  timeTrackingActive: string[];
  dataStr: string;
}

const TodoBoardContent: FC<TodoBoardContentProps> = ({
  groupedByContextByDate,
  durationByContext,
  durationByContextByDate,
  timeTrackingActive,
  dataStr,
}) => (
  <div className="mt-2 flex flex-col">
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden">
          <div className="mb-4 flex items-start justify-start space-x-4">
            {groupedByContextByDate.map(([context, contextTodos]) => (
              <ContextColumn
                context={context}
                contextTodos={contextTodos}
                durationByContext={durationByContext}
                durationByContextByDate={durationByContextByDate}
                key={context}
                timeTrackingActive={timeTrackingActive}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
    <a download="todos.json" href={dataStr}>
      download json
    </a>
  </div>
);
