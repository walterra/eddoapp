/**
 * Kanban-style todo board component with context columns
 */
import { type DatabaseError, type Todo, isLatestVersion } from '@eddo/core-client';
import { format } from 'date-fns';
import { Spinner } from 'flowbite-react';
import { uniqBy } from 'lodash-es';
import { type FC, useMemo } from 'react';

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
import {
  generateTodosDownloadUrl,
  useDbInitialization,
  useOutdatedTodos,
  useTodoBoardData,
} from './todo_board_state';
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
  const { error, setError, isInitialized } = useDbInitialization(safeDb, rawDb);

  const dateRange = useMemo(
    () => calculateDateRange(currentDate, selectedTimeRange),
    [currentDate, selectedTimeRange],
  );

  const {
    todos,
    activities,
    timeTrackingActive,
    outdatedTodosMemo,
    isLoading,
    showLoadingSpinner,
    queryError,
    todosQuery,
    activitiesQuery,
  } = useTodoBoardData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    isInitialized,
  });

  useOutdatedTodos(outdatedTodosMemo);

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

  const dataStr = generateTodosDownloadUrl(todos);
  const displayError = error || (queryError as DatabaseError | null);

  const handleDismissError = () => {
    setError(null);
    todosQuery.refetch();
    activitiesQuery.refetch();
  };

  if (displayError && todos.length === 0 && !isLoading) {
    return (
      <div className="bg-gray-50 p-8 dark:bg-gray-800">
        <DatabaseErrorFallback
          error={displayError}
          onDismiss={handleDismissError}
          onRetry={handleDismissError}
        />
      </div>
    );
  }

  if (showLoadingSpinner) {
    return <LoadingSpinner />;
  }

  const hasNoTodos =
    groupedByContextByDate.length === 0 && !isLoading && isInitialized && todosQuery.isFetched;

  const hasActiveFilters =
    selectedTags.length > 0 || selectedContexts.length > 0 || selectedStatus !== 'all';

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
            hasActiveFilters
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

function LoadingSpinner() {
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
      <ContextHeader context={context} duration={durationByContext[context]} />
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

function ContextHeader({ context, duration }: { context: string; duration: string }) {
  return (
    <div className="pt-2 pb-2 text-xs font-semibold tracking-wide text-gray-700 uppercase dark:text-gray-300">
      <div className="flex items-center justify-between">
        <div>
          <FormattedMessage message={context} />
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{duration}</div>
      </div>
    </div>
  );
}

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
  const todosForDate = useMemo(() => {
    const unique = uniqBy(allTodosForDate, (d) =>
      isLatestVersion(d) ? d._id : (d as ActivityItem).id,
    );
    return unique.sort((a, b) => {
      const aTitle = isLatestVersion(a) ? a.title : (a as ActivityItem).doc.title;
      const bTitle = isLatestVersion(b) ? b.title : (b as ActivityItem).doc.title;
      return ('' + aTitle).localeCompare(bTitle);
    });
  }, [allTodosForDate]);

  const displayDate = useMemo(() => {
    try {
      return format(new Date(todoDate), 'yyyy-MM-dd');
    } catch (_e) {
      return format(new Date(), 'yyyy-MM-dd');
    }
  }, [todoDate]);

  const durationForDate = getActivityDurationForDate(activityDurationByDate, displayDate);

  return (
    <div key={`${context}_${todoDate}`}>
      <DateHeader date={displayDate} duration={durationForDate} />
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

function DateHeader({ date, duration }: { date: string; duration: string }) {
  return (
    <div className="mb-1 flex items-center justify-between text-xs">
      <div className="font-medium text-gray-600 dark:text-gray-400">{date}</div>
      <div className="text-xs text-gray-500 dark:text-gray-500">{duration}</div>
    </div>
  );
}
