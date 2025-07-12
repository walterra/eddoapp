import {
  type Activity,
  type DatabaseError,
  DatabaseErrorType,
  type Todo,
  getFormattedDurationForActivities,
  isLatestVersion,
  migrateTodo,
} from '@eddo/shared';
import { group } from 'd3-array';
import { add, endOfWeek, format, getISOWeek, startOfWeek } from 'date-fns';
import { uniqBy } from 'lodash-es';
import React, {
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { CONTEXT_DEFAULT } from '../constants';
import { ensureDesignDocuments } from '../database_setup';
import { useDatabaseChanges } from '../hooks/use_database_changes';
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
  const { changeCount } = useDatabaseChanges();
  const [timeTrackingActive, setTimeTrackingActive] = useState<string[]>([
    'hide-by-default',
  ]);
  const [outdatedTodos, setOutdatedTodos] = useState<unknown[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<DatabaseError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // avoid multiple fetches
  const isFetching = useRef(false);
  const shouldFetch = useRef(true);
  // check integrity, e.g. if design docs are present
  const [isInitialized, setIsInitialized] = useState(false);

  const currentCalendarWeek = getISOWeek(currentDate);
  // TODO The 'add' is a CEST quick fix
  const currentStartOfWeek = add(
    startOfWeek(currentDate, { weekStartsOn: 1 }),
    { hours: 2 },
  );
  // TODO The 'add' is a CEST quick fix
  const currentEndOfWeek = add(endOfWeek(currentDate, { weekStartsOn: 1 }), {
    hours: 2,
  });

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

    fetchTodos();
    fetchTimeTrackingActive();
  }, [currentDate, isInitialized, changeCount]);

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

  const fetchTodos = useCallback(async () => {
    if (isFetching.current) {
      shouldFetch.current = true;
      return;
    }

    isFetching.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.time('fetchTodos');
      const newTodos = await safeDb.safeQuery<Todo>('todos', 'byDueDate', {
        descending: false,
        endkey: currentEndOfWeek.toISOString(),
        include_docs: false,
        startkey: currentStartOfWeek.toISOString(),
      });
      console.timeEnd('fetchTodos');

      console.time('fetchActivities');
      const newActivities = await safeDb.safeQuery<Activity>(
        'todos',
        'byActive',
        {
          descending: false,
          endkey: currentEndOfWeek.toISOString(),
          include_docs: false,
          startkey: currentStartOfWeek.toISOString(),
        },
      );
      console.timeEnd('fetchActivities');

      console.time('setOutdatedTodos');
      setOutdatedTodos(
        newTodos.filter((d) => !isLatestVersion(d)).map((d) => d),
      );
      console.timeEnd('setOutdatedTodos');

      console.time('setTodos');
      setTodos(newTodos.filter((d) => isLatestVersion(d)) as Todo[]);
      console.timeEnd('setTodos');

      console.time('setActivities');
      setActivities(newActivities);
      console.timeEnd('setActivities');
    } catch (err) {
      console.error('Failed to fetch todos:', err);
      setError(err as DatabaseError);

      // Show user-friendly error message
      if ((err as DatabaseError).type === DatabaseErrorType.NETWORK_ERROR) {
        // We're in offline mode, keep existing data
        console.log('Working in offline mode');
      }
    } finally {
      isFetching.current = false;
      setIsLoading(false);
      if (shouldFetch.current) {
        shouldFetch.current = false;
        fetchTodos();
      }
    }
  }, [safeDb, currentStartOfWeek, currentEndOfWeek]);

  useEffect(() => {
    if (!isInitialized) return;

    fetchTodos();
    fetchTimeTrackingActive();
  }, [currentCalendarWeek, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    // disabled for now
    return;

    (async () => {
      try {
        await safeDb.safeBulkDocs(outdatedTodos.map((d) => migrateTodo(d)));
      } catch (err) {
        console.error('Failed to migrate outdated todos:', err);
        setError(err as DatabaseError);
      }
    })();
  }, [outdatedTodos, isInitialized, safeDb]);

  const filteredActivities = activities.filter((a) => {
    // TODO The 'split' is a CEST quick fix
    return !todos.some(
      (t) => a.id === t._id && a.from.split('T')[0] === t.due.split('T')[0],
    );
  });

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

  // Show error state if there's an error and no data
  if (error && todos.length === 0 && !isLoading) {
    return (
      <div className="bg-gray-50 p-8 dark:bg-gray-800">
        <DatabaseErrorFallback
          error={error}
          onDismiss={() => setError(null)}
          onRetry={() => {
            setError(null);
            fetchTodos();
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800">
      {/* Show inline error if we have data */}
      {error && todos.length > 0 && (
        <div className="px-4 pt-2">
          <DatabaseErrorMessage
            error={error}
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
