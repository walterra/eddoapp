import {
  type DatabaseError,
  type Todo,
  getFormattedDurationForActivities,
  isLatestVersion,
} from '@eddo/core-client';
import { group } from 'd3-array';
import {
  add,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { uniqBy } from 'lodash-es';
import { type FC, useEffect, useMemo, useState } from 'react';

import { CONTEXT_DEFAULT } from '../constants';
import { ensureDesignDocuments } from '../database_setup';
import { useActivitiesByWeek } from '../hooks/use_activities_by_week';
import { useTimeTrackingActive } from '../hooks/use_time_tracking_active';
import { useTodosByWeek } from '../hooks/use_todos_by_week';
import { usePouchDb } from '../pouch_db';
import { DatabaseErrorFallback } from './database_error_fallback';
import { DatabaseErrorMessage } from './database_error_message';
import { FormattedMessage } from './formatted_message';
import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';
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
  // check integrity, e.g. if design docs are present
  const [isInitialized, setIsInitialized] = useState(false);

  // Calculate date range based on selected time range
  const { startDate, endDate } = useMemo(() => {
    // TODO The 'add' is a CEST quick fix
    const currentStartOfWeek = add(startOfWeek(currentDate, { weekStartsOn: 1 }), { hours: 2 });
    const currentEndOfWeek = add(endOfWeek(currentDate, { weekStartsOn: 1 }), { hours: 2 });

    switch (selectedTimeRange.type) {
      case 'current-day':
        return {
          startDate: add(startOfDay(currentDate), { hours: 2 }),
          endDate: add(endOfDay(currentDate), { hours: 2 }),
        };
      case 'current-week':
        return {
          startDate: currentStartOfWeek,
          endDate: currentEndOfWeek,
        };
      case 'current-month':
        return {
          startDate: add(startOfMonth(currentDate), { hours: 2 }),
          endDate: add(endOfMonth(currentDate), { hours: 2 }),
        };
      case 'current-year':
        return {
          startDate: add(startOfYear(currentDate), { hours: 2 }),
          endDate: add(endOfYear(currentDate), { hours: 2 }),
        };
      case 'custom':
        if (selectedTimeRange.startDate && selectedTimeRange.endDate) {
          return {
            startDate: new Date(selectedTimeRange.startDate + 'T00:00:00'),
            endDate: new Date(selectedTimeRange.endDate + 'T23:59:59'),
          };
        }
        // Fallback to current week if custom dates are invalid
        return {
          startDate: currentStartOfWeek,
          endDate: currentEndOfWeek,
        };
      case 'all-time':
        // Use a very wide date range for all-time
        return {
          startDate: new Date('2000-01-01'),
          endDate: new Date('2099-12-31'),
        };
      default:
        return {
          startDate: currentStartOfWeek,
          endDate: currentEndOfWeek,
        };
    }
  }, [currentDate, selectedTimeRange]);

  // Use TanStack Query hooks for data fetching - only enable after initialization
  const todosQuery = useTodosByWeek({
    startDate,
    endDate,
    enabled: isInitialized,
  });

  const activitiesQuery = useActivitiesByWeek({
    startDate,
    endDate,
    enabled: isInitialized,
  });

  const timeTrackingQuery = useTimeTrackingActive({
    enabled: isInitialized,
  });

  // Extract data from queries with useMemo to avoid new array references on every render
  const activities = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);

  const timeTrackingActive = useMemo(
    () => timeTrackingQuery.data ?? ['hide-by-default'],
    [timeTrackingQuery.data],
  );

  // Filter to get only latest version todos - use query data directly to avoid reference issues
  const todos = useMemo(
    () => (todosQuery.data ?? []).filter((d: Todo) => isLatestVersion(d)) as Todo[],
    [todosQuery.data],
  );

  // Track outdated todos for migration (if needed) - use useMemo to avoid infinite loop
  const outdatedTodosMemo = useMemo(
    () => (todosQuery.data ?? []).filter((d: Todo) => !isLatestVersion(d)) as Todo[],
    [todosQuery.data],
  );

  // Update state only when outdated todos actually change
  useEffect(() => {
    setOutdatedTodos(outdatedTodosMemo);
  }, [outdatedTodosMemo]);

  // Combine loading and error states from both queries
  const isLoading = todosQuery.isLoading || activitiesQuery.isLoading;
  const queryError = todosQuery.error || activitiesQuery.error;

  useEffect(() => {
    if (isInitialized) return;

    // async iife
    (async () => {
      setError(null);

      try {
        // Ensure all design documents are created/updated
        await ensureDesignDocuments(safeDb, rawDb);
        setIsInitialized(true);
      } catch (err) {
        console.error('Error initializing design documents:', err);
        setError(err as DatabaseError);
        // Still try to initialize to avoid blocking the app
        setIsInitialized(true);
      }
    })();
  }, [isInitialized, safeDb, rawDb]);

  useEffect(() => {
    if (!isInitialized) return;

    // Migration disabled for now
    // TODO: Re-enable when needed
    // (async () => {
    //   try {
    //     await safeDb.safeBulkDocs(outdatedTodos.map((d) => migrateTodo(d)));
    //   } catch (err) {
    //     console.error('Failed to migrate outdated todos:', err);
    //     setError(err as DatabaseError);
    //   }
    // })();
  }, [outdatedTodos, isInitialized, safeDb]);

  const filteredTodos = useMemo(() => {
    let filtered = todos;

    // Apply client-side filtering as fallback/additional filtering
    // Context filtering (if not handled by database query)
    if (selectedContexts.length > 0) {
      filtered = filtered.filter((todo) => {
        return selectedContexts.includes(todo.context || CONTEXT_DEFAULT);
      });
    }

    // Status filtering (if not handled by database query)
    if (selectedStatus !== 'all') {
      filtered = filtered.filter((todo) => {
        if (selectedStatus === 'completed') {
          return todo.completed !== null;
        } else if (selectedStatus === 'incomplete') {
          return todo.completed === null;
        }
        return true;
      });
    }

    // Tag filtering
    if (selectedTags.length > 0) {
      filtered = filtered.filter((todo) => {
        return selectedTags.some((selectedTag) => todo.tags.includes(selectedTag));
      });
    }

    return filtered;
  }, [todos, selectedTags, selectedContexts, selectedStatus]);

  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      const todo = activity.doc;

      // Apply same filtering logic as filteredTodos
      // Context filtering
      if (selectedContexts.length > 0) {
        if (!selectedContexts.includes(todo.context || CONTEXT_DEFAULT)) {
          return false;
        }
      }

      // Status filtering
      if (selectedStatus !== 'all') {
        if (selectedStatus === 'completed' && todo.completed === null) {
          return false;
        }
        if (selectedStatus === 'incomplete' && todo.completed !== null) {
          return false;
        }
      }

      // Tag filtering
      if (selectedTags.length > 0) {
        if (!selectedTags.some((selectedTag) => todo.tags.includes(selectedTag))) {
          return false;
        }
      }

      return true;
    });
  }, [activities, selectedContexts, selectedStatus, selectedTags]);

  const groupedByContextByDate = useMemo(() => {
    const grouped = Array.from(
      group(
        [...filteredTodos, ...filteredActivities],
        (d) => {
          if (isLatestVersion(d)) {
            return d.context ?? CONTEXT_DEFAULT;
          } else {
            return d.doc.context ?? CONTEXT_DEFAULT;
          }
        },
        (d) => {
          // TODO The 'split' is a CEST quick fix
          if (isLatestVersion(d)) {
            return d.due.split('T')[0]; // format(new Date(d.due), 'yyyy-MM-dd'),
          } else {
            return d.from.split('T')[0];
          }
        },
      ),
    );
    grouped.sort((a, b) => ('' + a[0]).localeCompare(b[0]));
    return grouped;
  }, [filteredTodos, filteredActivities]);

  const durationByContext = useMemo(() => {
    return Object.fromEntries(
      Array.from(group(activities, (d) => d.doc.context ?? CONTEXT_DEFAULT)).map((d) => [
        d[0],
        getFormattedDurationForActivities(d[1]),
      ]),
    );
  }, [activities]);

  const durationByContextByDate = useMemo(() => {
    const grouped = Array.from(
      group(
        activities,
        (d) => d.doc.context ?? CONTEXT_DEFAULT,
        // TODO The 'split' is a CEST quick fix
        (d) => d.from.split('T')[0], // format(new Date(d.from), 'yyyy-MM-dd'),
      ),
    );
    grouped.sort((a, b) => ('' + a[0]).localeCompare(b[0]));
    return grouped;
  }, [activities]);

  const dataStr =
    'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(todos, null, 2));

  // Combine manual error state with query errors
  const displayError = error || (queryError as DatabaseError);

  // Show error state if there's an error and no data
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

  return (
    <div className="bg-gray-50 dark:bg-gray-800">
      {/* Show inline error if we have data */}
      {displayError && todos.length > 0 && (
        <div className="px-4 pt-2">
          <DatabaseErrorMessage error={displayError} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="mt-2 flex flex-col">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden">
              <div className="mb-4 flex items-start justify-start space-x-2 px-4">
                {groupedByContextByDate.map(([context, contextTodos]) => {
                  const todosByDate = Array.from(contextTodos);

                  todosByDate.sort((a, b) => ('' + a[0]).localeCompare(b[0]));

                  const activitiesByMapDate = durationByContextByDate.find((d) => d[0] === context);

                  const activityDurationByDate = activitiesByMapDate
                    ? Array.from(activitiesByMapDate[1]).map((d) => [
                        d[0],
                        getFormattedDurationForActivities(d[1]),
                      ])
                    : [];
                  activityDurationByDate.sort((a, b) => ('' + a[0]).localeCompare(b[0]));

                  return (
                    <div className="eddo-w-kanban" key={context}>
                      <div className="pt-2 pb-1 text-xs font-semibold tracking-wide text-gray-700 uppercase dark:text-gray-300">
                        <div className="flex items-center justify-between">
                          <div className="mx-0.5">
                            <FormattedMessage message={context} />
                          </div>
                          <div className="mx-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {durationByContext[context]}
                          </div>
                        </div>
                      </div>

                      <div className="eddo-w-kanban mb-2 space-y-2" id="kanban-list-1">
                        {todosByDate.map(([todoDate, allTodosForDate]) => {
                          const todosForDate = uniqBy(allTodosForDate, (d) => {
                            return isLatestVersion(d) ? d._id : d.id;
                          });

                          todosForDate.sort((a, b) => {
                            const aTitle = isLatestVersion(a) ? a.title : a.doc.title;
                            const bTitle = isLatestVersion(b) ? b.title : b.doc.title;

                            return ('' + aTitle).localeCompare(bTitle);
                          });

                          let displayDate = '';

                          try {
                            displayDate = format(new Date(todoDate), 'yyyy-MM-dd');
                          } catch (_e) {
                            displayDate = format(new Date(), 'yyyy-MM-dd');
                          }

                          const activityDurationItem = activityDurationByDate.find(
                            (d) => d[0] === displayDate,
                          );

                          const durationForDate = activityDurationItem
                            ? activityDurationItem[1]
                            : '';

                          return (
                            <div key={`${context}_${todoDate}`}>
                              <div className="mb-0.5 flex items-center justify-between text-xs">
                                <div className="mx-0.5 font-medium text-gray-600 dark:text-gray-400">
                                  {displayDate}
                                </div>
                                <div className="mx-0.5 text-xs text-gray-500 dark:text-gray-500">
                                  {durationForDate}
                                </div>
                              </div>
                              {todosForDate.map((todoOrActivity) => {
                                const todo = isLatestVersion(todoOrActivity)
                                  ? todoOrActivity
                                  : todoOrActivity.doc;
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
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
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
