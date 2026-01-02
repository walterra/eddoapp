import { type Activity, type DatabaseError, type Todo, isLatestVersion } from '@eddo/core-client';
import { format } from 'date-fns';
import { Spinner } from 'flowbite-react';
import { type FC, useEffect, useMemo, useState } from 'react';

import { ensureDesignDocuments } from '../database_setup';
import { useActivitiesByWeek } from '../hooks/use_activities_by_week';
import { useDelayedLoading } from '../hooks/use_delayed_loading';
import { useTimeTrackingActive } from '../hooks/use_time_tracking_active';
import { useTodosByWeek } from '../hooks/use_todos_by_week';
import { usePouchDb } from '../pouch_db';
import { DatabaseErrorFallback } from './database_error_fallback';
import { DatabaseErrorMessage } from './database_error_message';
import { EmptyState } from './empty_state';
import { FormattedMessage } from './formatted_message';
import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';
import { calculateDateRange } from './todo_board_helpers';
import {
  calculateDurationByContext,
  filterTodos,
  getColumnLabel,
  getColumnWidthClass,
  groupTodosByContext,
  reorderColumnsWithStatusFirst,
} from './todo_table_helpers';
import { TodoRow } from './todo_table_row';

interface TodoTableProps {
  currentDate: Date;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeRange: TimeRange;
  selectedColumns: string[];
}

export const TodoTable: FC<TodoTableProps> = ({
  currentDate,
  selectedTags,
  selectedContexts,
  selectedStatus,
  selectedTimeRange,
  selectedColumns,
}) => {
  const { safeDb, rawDb } = usePouchDb();
  const [error, setError] = useState<DatabaseError | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const { startDate, endDate } = useMemo(
    () => calculateDateRange(currentDate, selectedTimeRange),
    [currentDate, selectedTimeRange],
  );

  const todosQuery = useTodosByWeek({ startDate, endDate, enabled: isInitialized });
  const activitiesQuery = useActivitiesByWeek({ startDate, endDate, enabled: isInitialized });
  const timeTrackingQuery = useTimeTrackingActive({ enabled: isInitialized });

  const activities = useMemo(
    () => (activitiesQuery.data ?? []) as Activity[],
    [activitiesQuery.data],
  );
  const timeTrackingActive = useMemo(
    () => timeTrackingQuery.data ?? ['hide-by-default'],
    [timeTrackingQuery.data],
  );
  const todos = useMemo(
    () => (todosQuery.data ?? []).filter((d: Todo) => isLatestVersion(d)) as Todo[],
    [todosQuery.data],
  );

  const isLoading = todosQuery.isLoading || activitiesQuery.isLoading;
  const showLoadingSpinner = useDelayedLoading(isLoading && !todosQuery.data);
  const queryError = todosQuery.error || activitiesQuery.error;

  useEffect(() => {
    if (isInitialized) return;
    (async () => {
      setError(null);
      try {
        await ensureDesignDocuments(safeDb, rawDb);
        setIsInitialized(true);
      } catch (err) {
        console.error('Error initializing design documents:', err);
        setError(err as DatabaseError);
        setIsInitialized(true);
      }
    })();
  }, [isInitialized, safeDb, rawDb]);

  const filteredTodos = useMemo(
    () => filterTodos(todos, selectedContexts, selectedStatus, selectedTags),
    [todos, selectedTags, selectedContexts, selectedStatus],
  );

  const groupedByContext = useMemo(() => groupTodosByContext(filteredTodos), [filteredTodos]);
  const durationByContext = useMemo(() => calculateDurationByContext(activities), [activities]);

  const displayError = error || (queryError as DatabaseError);

  if (displayError && todos.length === 0 && !isLoading) {
    return (
      <div className="bg-gray-50 p-8 dark:bg-gray-800">
        <DatabaseErrorFallback
          error={displayError}
          onDismiss={() => {
            setError(null);
            todosQuery.refetch();
            activitiesQuery.refetch();
          }}
          onRetry={() => {
            setError(null);
            todosQuery.refetch();
            activitiesQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (showLoadingSpinner) {
    return (
      <div
        aria-label="Loading todos"
        className="flex min-h-64 items-center justify-center bg-gray-50 dark:bg-gray-800"
        role="status"
      >
        <Spinner aria-label="Loading" size="lg" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading todos...</span>
      </div>
    );
  }

  const hasNoTodos =
    groupedByContext.length === 0 && !isLoading && isInitialized && todosQuery.isFetched;

  return (
    <div className="bg-gray-50 dark:bg-gray-800">
      {displayError && todos.length > 0 && (
        <div className="px-4 pt-2">
          <DatabaseErrorMessage error={displayError} onDismiss={() => setError(null)} />
        </div>
      )}

      {hasNoTodos ? (
        <EmptyState
          description={
            selectedTags.length > 0 || selectedContexts.length > 0 || selectedStatus !== 'all'
              ? 'Try adjusting your filters or select a different time range.'
              : 'Get started by adding your first todo above.'
          }
          title="No todos found"
        />
      ) : (
        <TodoTableContent
          currentDate={currentDate}
          durationByContext={durationByContext}
          groupedByContext={groupedByContext}
          selectedColumns={selectedColumns}
          timeTrackingActive={timeTrackingActive}
        />
      )}
    </div>
  );
};

interface TodoTableContentProps {
  groupedByContext: Array<[string, Todo[]]>;
  durationByContext: Record<string, string>;
  selectedColumns: string[];
  timeTrackingActive: string[];
  currentDate: Date;
}

const TodoTableContent: FC<TodoTableContentProps> = ({
  groupedByContext,
  durationByContext,
  selectedColumns,
  timeTrackingActive,
  currentDate,
}) => (
  <div className="overflow-x-auto px-4 py-2">
    {groupedByContext.map(([context, contextTodos]) => (
      <ContextGroup
        context={context}
        contextTodos={contextTodos}
        currentDate={currentDate}
        durationByContext={durationByContext}
        key={context}
        selectedColumns={selectedColumns}
        timeTrackingActive={timeTrackingActive}
      />
    ))}
  </div>
);

interface ContextGroupProps {
  context: string;
  contextTodos: Todo[];
  durationByContext: Record<string, string>;
  selectedColumns: string[];
  timeTrackingActive: string[];
  currentDate: Date;
}

const ContextGroup: FC<ContextGroupProps> = ({
  context,
  contextTodos,
  durationByContext,
  selectedColumns,
  timeTrackingActive,
  currentDate,
}) => (
  <div className="mb-4">
    <div className="mb-1 flex items-center justify-between">
      <h3 className="text-xs font-semibold tracking-wide text-gray-700 uppercase dark:text-gray-300">
        <FormattedMessage message={context} />
      </h3>
      <span className="text-xs text-gray-500 dark:text-gray-400">{durationByContext[context]}</span>
    </div>

    <div className="overflow-hidden rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {reorderColumnsWithStatusFirst(selectedColumns).map((columnId) => (
              <th
                className={`px-2 py-1 text-left text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400 ${getColumnWidthClass(columnId)}`}
                key={columnId}
                scope="col"
              >
                {getColumnLabel(columnId)}
              </th>
            ))}
            <th
              className="w-24 px-2 py-1 text-right text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
              scope="col"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          {contextTodos.map((todo) => (
            <TodoRow
              activeDate={format(currentDate, 'yyyy-MM-dd')}
              key={`${todo._id}-${todo._rev}`}
              selectedColumns={selectedColumns}
              timeTrackingActive={timeTrackingActive.length > 0}
              todo={todo}
            />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
