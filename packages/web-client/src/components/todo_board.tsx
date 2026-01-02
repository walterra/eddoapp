import { type DatabaseError, type Todo, isLatestVersion } from '@eddo/core-client';
import { format } from 'date-fns';
import { Spinner } from 'flowbite-react';
import { uniqBy } from 'lodash-es';
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
import {
  type ActivityItem,
  calculateDateRange,
  calculateDurationByContext,
  calculateDurationByContextAndDate,
  filterActivities,
  filterTodos,
  formatActivityDurationsByDate,
  getActivityDurationForDate,
  groupByContextAndDate,
} from './todo_board_helpers';
import { TodoListElement } from './todo_list_element';

interface TodoBoardProps {
  currentDate: Date;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeRange: TimeRange;
}

export const TodoBoard: FC<TodoBoardProps> = ({
  currentDate,
  selectedTags,
  selectedContexts,
  selectedStatus,
  selectedTimeRange,
}) => {
  const { safeDb, rawDb } = usePouchDb();
  const [outdatedTodos, setOutdatedTodos] = useState<Todo[]>([]);
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
    () => (activitiesQuery.data ?? []) as ActivityItem[],
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

  const outdatedTodosMemo = useMemo(
    () => (todosQuery.data ?? []).filter((d: Todo) => !isLatestVersion(d)) as Todo[],
    [todosQuery.data],
  );

  useEffect(() => {
    setOutdatedTodos(outdatedTodosMemo);
  }, [outdatedTodosMemo]);

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

  useEffect(() => {
    if (!isInitialized) return;
    // Migration disabled for now
  }, [outdatedTodos, isInitialized, safeDb]);

  const filteredTodos = useMemo(
    () => filterTodos(todos, selectedContexts, selectedStatus, selectedTags),
    [todos, selectedTags, selectedContexts, selectedStatus],
  );

  const filteredActivities = useMemo(
    () => filterActivities(activities, selectedContexts, selectedStatus, selectedTags),
    [activities, selectedContexts, selectedStatus, selectedTags],
  );

  const groupedByContextByDate = useMemo(
    () => groupByContextAndDate(filteredTodos, filteredActivities),
    [filteredTodos, filteredActivities],
  );

  const durationByContext = useMemo(() => calculateDurationByContext(activities), [activities]);

  const durationByContextByDate = useMemo(
    () => calculateDurationByContextAndDate(activities),
    [activities],
  );

  const dataStr =
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(todos, null, 2));

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
    groupedByContextByDate.length === 0 && !isLoading && isInitialized && todosQuery.isFetched;

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
        <TodoBoardContent
          dataStr={dataStr}
          durationByContext={durationByContext}
          durationByContextByDate={durationByContextByDate}
          groupedByContextByDate={groupedByContextByDate}
          timeTrackingActive={timeTrackingActive}
        />
      )}
    </div>
  );
};

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
}) => {
  return (
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
};

interface ContextColumnProps {
  context: string;
  contextTodos: Map<string, Array<Todo | ActivityItem>>;
  durationByContext: Record<string, string>;
  durationByContextByDate: Array<[string, Map<string, ActivityItem[]>]>;
  timeTrackingActive: string[];
}

const ContextColumn: FC<ContextColumnProps> = ({
  context,
  contextTodos,
  durationByContext,
  durationByContextByDate,
  timeTrackingActive,
}) => {
  const todosByDate = Array.from(contextTodos);
  todosByDate.sort((a, b) => ('' + a[0]).localeCompare(b[0]));

  const activityDurationByDate = formatActivityDurationsByDate(durationByContextByDate, context);

  return (
    <div className="eddo-w-kanban" key={context}>
      <div className="pt-2 pb-2 text-xs font-semibold tracking-wide text-gray-700 uppercase dark:text-gray-300">
        <div className="flex items-center justify-between">
          <div>
            <FormattedMessage message={context} />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {durationByContext[context]}
          </div>
        </div>
      </div>

      <div className="eddo-w-kanban mb-2 space-y-2" id="kanban-list-1">
        {todosByDate.map(([todoDate, allTodosForDate]) => (
          <DateGroup
            activityDurationByDate={activityDurationByDate}
            allTodosForDate={allTodosForDate}
            context={context}
            key={`${context}_${todoDate}`}
            timeTrackingActive={timeTrackingActive}
            todoDate={todoDate}
          />
        ))}
      </div>
    </div>
  );
};

interface DateGroupProps {
  context: string;
  todoDate: string;
  allTodosForDate: Array<Todo | ActivityItem>;
  activityDurationByDate: Array<[string, string]>;
  timeTrackingActive: string[];
}

const DateGroup: FC<DateGroupProps> = ({
  context,
  todoDate,
  allTodosForDate,
  activityDurationByDate,
  timeTrackingActive,
}) => {
  const todosForDate = uniqBy(allTodosForDate, (d) => {
    return isLatestVersion(d) ? d._id : (d as ActivityItem).id;
  });

  todosForDate.sort((a, b) => {
    const aTitle = isLatestVersion(a) ? a.title : (a as ActivityItem).doc.title;
    const bTitle = isLatestVersion(b) ? b.title : (b as ActivityItem).doc.title;
    return ('' + aTitle).localeCompare(bTitle);
  });

  let displayDate = '';
  try {
    displayDate = format(new Date(todoDate), 'yyyy-MM-dd');
  } catch (_e) {
    displayDate = format(new Date(), 'yyyy-MM-dd');
  }

  const durationForDate = getActivityDurationForDate(activityDurationByDate, displayDate);

  return (
    <div key={`${context}_${todoDate}`}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <div className="font-medium text-gray-600 dark:text-gray-400">{displayDate}</div>
        <div className="text-xs text-gray-500 dark:text-gray-500">{durationForDate}</div>
      </div>
      {todosForDate.map((todoOrActivity) => {
        const todo = isLatestVersion(todoOrActivity)
          ? todoOrActivity
          : (todoOrActivity as ActivityItem).doc;
        return (
          <TodoListElement
            active={timeTrackingActive.some((d: string) => d === todo._id)}
            activeDate={displayDate}
            activityOnly={!isLatestVersion(todoOrActivity)}
            key={todo._id}
            timeTrackingActive={timeTrackingActive.length > 0}
            todo={todo}
          />
        );
      })}
    </div>
  );
};
