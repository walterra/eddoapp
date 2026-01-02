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
import { ContextColumn } from './todo_board_columns';
import {
  type ActivityItem,
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

/** Compute filtered and grouped data from board state */
const useFilteredData = (
  boardData: ReturnType<typeof useTodoBoardData>,
  selectedContexts: string[],
  selectedStatus: CompletionStatus,
  selectedTags: string[],
) => {
  const filteredTodos = useMemo(
    () => filterTodos(boardData.todos, selectedContexts, selectedStatus, selectedTags),
    [boardData.todos, selectedTags, selectedContexts, selectedStatus],
  );
  const filteredActivities = useMemo(
    () => filterActivities(boardData.activities, selectedContexts, selectedStatus, selectedTags),
    [boardData.activities, selectedContexts, selectedStatus, selectedTags],
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

const useBoardData = (
  props: TodoBoardProps,
  isInitialized: boolean,
  error: DatabaseError | null,
): BoardDataResult & ReturnType<typeof useTodoBoardData> => {
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
  useOutdatedTodos(boardData.outdatedTodosMemo);

  const { filteredTodos, filteredActivities } = useFilteredData(
    boardData,
    selectedContexts,
    selectedStatus,
    selectedTags,
  );
  const groupedByContextByDate = useMemo(
    () => groupByContextAndDate(filteredTodos, filteredActivities),
    [filteredTodos, filteredActivities],
  );
  const { durationByContext, durationByContextByDate } = useDurationData(boardData.activities);

  const hasNoTodos =
    groupedByContextByDate.length === 0 &&
    !boardData.isLoading &&
    isInitialized &&
    boardData.todosQuery.isFetched;
  const hasActiveFilters =
    selectedTags.length > 0 || selectedContexts.length > 0 || selectedStatus !== 'all';

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
      <div className="bg-gray-50 p-8 dark:bg-gray-800">
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
    <div className="bg-gray-50 dark:bg-gray-800">
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
    className="flex min-h-64 items-center justify-center bg-gray-50 dark:bg-gray-800"
    role="status"
  >
    <Spinner aria-label="Loading" size="lg" />
    <span className="ml-3 text-gray-600 dark:text-gray-400">Loading todos...</span>
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
          <div className="mb-4 flex items-start justify-start space-x-3 px-4">
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
