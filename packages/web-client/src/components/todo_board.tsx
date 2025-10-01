import {
  type DatabaseError,
  type Todo,
  getFormattedDurationForActivities,
  isLatestVersion,
  migrateTodo,
} from '@eddo/core-client';
import { group } from 'd3-array';
import { add, endOfWeek, format, startOfWeek } from 'date-fns';
import { uniqBy } from 'lodash-es';
import { type FC, useCallback, useEffect, useMemo, useState } from 'react';

import { CONTEXT_DEFAULT } from '../constants';
import { ensureDesignDocuments } from '../database_setup';
import { useActivitiesByWeek } from '../hooks/use_activities_by_week';
import { useTodosByWeek } from '../hooks/use_todos_by_week';
import { usePouchDb } from '../pouch_db';
import { DatabaseErrorFallback } from './database_error_fallback';
import { DatabaseErrorMessage } from './database_error_message';
import { FormattedMessage } from './formatted_message';
import { TodoListElement } from './todo_list_element';

interface TodoBoardProps {
  currentDate: Date;
  selectedTags: string[];
}

export const TodoBoard: FC<TodoBoardProps> = ({
  currentDate,
  selectedTags,
}) => {
  const { safeDb, rawDb } = usePouchDb();
  const [timeTrackingActive, setTimeTrackingActive] = useState<string[]>([
    'hide-by-default',
  ]);
  const [outdatedTodos, setOutdatedTodos] = useState<Todo[]>([]);
  const [error, setError] = useState<DatabaseError | null>(null);
  // check integrity, e.g. if design docs are present
  const [isInitialized, setIsInitialized] = useState(false);
  // TODO The 'add' is a CEST quick fix
  const currentStartOfWeek = add(
    startOfWeek(currentDate, { weekStartsOn: 1 }),
    { hours: 2 },
  );
  // TODO The 'add' is a CEST quick fix
  const currentEndOfWeek = add(endOfWeek(currentDate, { weekStartsOn: 1 }), {
    hours: 2,
  });

  // Use TanStack Query hooks for data fetching
  const todosQuery = useTodosByWeek({
    startDate: currentStartOfWeek,
    endDate: currentEndOfWeek,
  });

  const activitiesQuery = useActivitiesByWeek({
    startDate: currentStartOfWeek,
    endDate: currentEndOfWeek,
  });

  // Extract data from queries with useMemo to avoid new array references on every render
  const activities = useMemo(
    () => activitiesQuery.data ?? [],
    [activitiesQuery.data],
  );

  // Filter to get only latest version todos - use query data directly to avoid reference issues
  const todos = useMemo(
    () =>
      (todosQuery.data ?? []).filter((d: Todo) => isLatestVersion(d)) as Todo[],
    [todosQuery.data],
  );

  // Track outdated todos for migration (if needed) - use useMemo to avoid infinite loop
  const outdatedTodosMemo = useMemo(
    () =>
      (todosQuery.data ?? []).filter(
        (d: Todo) => !isLatestVersion(d),
      ) as Todo[],
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
  }, [isInitialized, safeDb]);

  useEffect(() => {
    if (!isInitialized) return;
    fetchTimeTrackingActive();
  }, [isInitialized]);

  const fetchTimeTrackingActive = useCallback(async () => {
    try {
      const resp = await safeDb.safeQuery<{ id: string }>(
        'todos',
        'byTimeTrackingActive',
        {
          key: null,
        },
      );
      setTimeTrackingActive(resp.map((d) => d.id));
    } catch (e) {
      console.error('Not able to fetch active todos:', e);
      setError(e as DatabaseError);
    }
  }, [safeDb]);

  useEffect(() => {
    if (!isInitialized || outdatedTodos.length === 0) return;

    (async () => {
      try {
        await safeDb.safeBulkDocs(outdatedTodos.map((d) => migrateTodo(d)));
      } catch (err) {
        console.error('Failed to migrate outdated todos:', err);
        setError(err as DatabaseError);
      }
    })();
  }, [outdatedTodos, isInitialized, safeDb]);

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      // TODO The 'split' is a CEST quick fix
      return !todos.some(
        (t) => a.id === t._id && a.from.split('T')[0] === t.due.split('T')[0],
      );
    });
  }, [activities, todos]);

  const filteredTodos = useMemo(() => {
    if (selectedTags.length === 0) {
      return todos;
    }

    return todos.filter((todo) => {
      return selectedTags.some((selectedTag) =>
        todo.tags.includes(selectedTag),
      );
    });
  }, [todos, selectedTags]);

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
      Array.from(
        group(activities, (d) => d.doc.context ?? CONTEXT_DEFAULT),
      ).map((d) => [d[0], getFormattedDurationForActivities(d[1])]),
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
    'data:text/json;charset=utf-8,' +
    encodeURIComponent(JSON.stringify(todos, null, 2));

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
          <DatabaseErrorMessage
            error={displayError}
            onDismiss={() => setError(null)}
          />
        </div>
      )}

      <div className="mt-2 flex flex-col">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden shadow">
              <div className="mb-6 flex items-start justify-start space-x-4 px-4">
                {groupedByContextByDate.map(([context, contextTodos]) => {
                  const todosByDate = Array.from(contextTodos);

                  todosByDate.sort((a, b) => ('' + a[0]).localeCompare(b[0]));

                  const activitiesByMapDate = durationByContextByDate.find(
                    (d) => d[0] === context,
                  );

                  const activityDurationByDate = activitiesByMapDate
                    ? Array.from(activitiesByMapDate[1]).map((d) => [
                        d[0],
                        getFormattedDurationForActivities(d[1]),
                      ])
                    : [];
                  activityDurationByDate.sort((a, b) =>
                    ('' + a[0]).localeCompare(b[0]),
                  );

                  return (
                    <div className="eddo-w-kanban" key={context}>
                      <div className="py-4 text-base font-semibold text-gray-900 dark:text-gray-300">
                        <div className="flex items-center justify-between">
                          <div className="mx-1">
                            <FormattedMessage message={context} />
                          </div>
                          <div className="mx-1 text-xs text-gray-400">
                            {durationByContext[context]}
                          </div>
                        </div>
                      </div>

                      <div
                        className="eddo-w-kanban mb-4 space-y-4"
                        id="kanban-list-1"
                      >
                        {todosByDate.map(([todoDate, allTodosForDate]) => {
                          const todosForDate = uniqBy(allTodosForDate, (d) => {
                            return isLatestVersion(d) ? d._id : d.id;
                          });

                          todosForDate.sort((a, b) => {
                            const aTitle = isLatestVersion(a)
                              ? a.title
                              : a.doc.title;
                            const bTitle = isLatestVersion(b)
                              ? b.title
                              : b.doc.title;

                            return ('' + aTitle).localeCompare(bTitle);
                          });

                          let displayDate = '';

                          try {
                            displayDate = format(
                              new Date(todoDate),
                              'yyyy-MM-dd',
                            );
                          } catch (_e) {
                            displayDate = format(new Date(), 'yyyy-MM-dd');
                          }

                          const activityDurationItem =
                            activityDurationByDate.find(
                              (d) => d[0] === displayDate,
                            );

                          const durationForDate = activityDurationItem
                            ? activityDurationItem[1]
                            : '';

                          return (
                            <div key={`${context}_${todoDate}`}>
                              <div className="flex items-center justify-between">
                                <div className="mx-1">{displayDate}</div>
                                <div className="mx-1 text-xs text-gray-400">
                                  {durationForDate}
                                </div>
                              </div>
                              {todosForDate.map((todoOrActivity) => {
                                const todo = isLatestVersion(todoOrActivity)
                                  ? todoOrActivity
                                  : todoOrActivity.doc;
                                return (
                                  <TodoListElement
                                    active={timeTrackingActive.some(
                                      (d) => d === todo._id,
                                    )}
                                    activeDate={displayDate}
                                    activityOnly={
                                      !isLatestVersion(todoOrActivity)
                                    }
                                    key={todo._id}
                                    timeTrackingActive={
                                      timeTrackingActive.length > 0
                                    }
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
