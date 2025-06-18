import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { group } from 'd3-array';
import { add, format, getISOWeek, startOfWeek, endOfWeek } from 'date-fns';
import { uniqBy, isEqual } from 'lodash-es';

import { CONTEXT_DEFAULT } from '../constants';
import { usePouchDb } from '../pouch_db';

import { isLatestVersion, migrateTodo } from '../api/versions/migrate';
import { type Activity } from '../types/activity';
import { type Todo } from '../types/todo';
import { getFormattedDurationForActivities } from '../utils/get_formatted_duration';

import { FormattedMessage } from './formatted_message';
import { TodoListElement } from './todo_list_element';

interface TodoBoardProps {
  currentDate: Date;
}

const designDocId = '_design/todos';
const designDocByActiveView = 'todos/byActive';
const designDocByDueDateView = 'todos/byDueDate';
const designDocByTimeTrackingActiveView = 'todos/byTimeTrackingActive';
const designDocViews = {
  byActive: {
    map: `function (doc) {
      if (doc.active) {
        Object.entries(doc.active).forEach(([from, to]) => {
          emit(from, { doc, from, id: doc._id, to });
        });
      }
    }`,
  },
  byDueDate: {
    map: `function (doc) {
      if (doc.due) {
        emit(doc.due, doc);
      }
    }`,
  },
  byTimeTrackingActive: {
    map: `function (doc) {
      Object.entries(doc.active).forEach((d) => {
        emit(d[1], {});
      });
    }`,
  },
};

export const TodoBoard: FC<TodoBoardProps> = ({ currentDate }) => {
  const db = usePouchDb();
  const [timeTrackingActive, setTimeTrackingActive] = useState<string[]>([
    'hide-by-default',
  ]);
  const [outdatedTodos, setOutdatedTodos] = useState<unknown[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

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
      let designDoc;

      try {
        // Attempt to get the design document from the database
        designDoc = await db.get(designDocId);

        // Check if design doc has all views
        if (
          !isEqual(
            (
              designDoc as PouchDB.Core.GetMeta & {
                views?: typeof designDocViews;
              }
            ).views,
            designDocViews,
          )
        ) {
          throw new Error('Design document is missing views.');
        }

        // You can then proceed with your logic, e.g., update or query it
        setIsInitialized(true);
      } catch (err) {
        // If an error occurs, it means the design document does not exist
        if (
          err instanceof Error &&
          'status' in err &&
          (err as PouchDB.Core.Error).status === 404
        ) {
          // Save the design document to your database
          await db.put({
            _id: '_design/todos',
            views: designDocViews,
          });

          setIsInitialized(true);
        } else if (
          err instanceof Error &&
          err.message === 'Design document is missing views.'
        ) {
          // Save the design document to your database
          await db.put({
            ...designDoc,
            views: designDocViews,
          });

          setIsInitialized(true);
        } else {
          // Handle other errors
          console.error('Error retrieving design document:', err);
        }
      }
    })();
  }, [isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    const listener = db
      .changes({
        live: true,
        since: 'now',
      })
      .on('change', () => {
        fetchTodos();
        fetchTimeTrackingActive();
      });

    fetchTimeTrackingActive();

    return () => {
      listener.cancel();
    };
  }, [currentDate, isInitialized]);

  async function fetchTimeTrackingActive() {
    try {
      const resp = await db.query(designDocByTimeTrackingActiveView, {
        key: null,
      });
      setTimeTrackingActive(resp.rows.map((d) => d.id));
    } catch (e) {
      console.error('not able to fetch active todos', e);
    }
  }

  async function fetchTodos() {
    if (isFetching.current) {
      shouldFetch.current = true;
      return;
    }

    isFetching.current = true;

    try {
      console.time('fetchTodos');
      const newTodos = await db.query(designDocByDueDateView, {
        descending: false,
        endkey: currentEndOfWeek.toISOString(),
        include_docs: false,
        startkey: currentStartOfWeek.toISOString(),
      });
      console.timeEnd('fetchTodos');

      console.time('fetchActivities');
      const newActivities = await db.query(designDocByActiveView, {
        descending: false,
        endkey: currentEndOfWeek.toISOString(),
        include_docs: false,
        startkey: currentStartOfWeek.toISOString(),
      });
      console.timeEnd('fetchActivities');

      console.time('setOutdatedTodos');
      setOutdatedTodos(
        newTodos?.rows
          .filter((d) => !isLatestVersion(d.value))
          .map((d) => d.value),
      );
      console.timeEnd('setOutdatedTodos');

      console.time('setTodos');
      setTodos(
        (newTodos?.rows
          .filter((d) => isLatestVersion(d.value))
          .map((d) => d.value) ?? []) as Todo[],
      );
      console.timeEnd('setTodos');

      console.time('setActivities');
      setActivities(newActivities.rows.map((d) => d.value));
      console.timeEnd('setActivities');
    } catch (err) {
      console.error(err);
    } finally {
      isFetching.current = false;
      if (shouldFetch.current) {
        shouldFetch.current = false;
        fetchTodos();
      }
    }
  }

  useEffect(() => {
    if (!isInitialized) return;

    fetchTodos();
    fetchTimeTrackingActive();
  }, [currentCalendarWeek, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    // disabled for now
    return;

    db.bulkDocs(outdatedTodos.map((d) => migrateTodo(d)));
  }, [outdatedTodos, isInitialized]);

  const filteredActivities = activities.filter((a) => {
    // TODO The 'split' is a CEST quick fix
    return !todos.some(
      (t) => a.id === t._id && a.from.split('T')[0] === t.due.split('T')[0],
    );
  });

  const groupedByContextByDate = useMemo(() => {
    const grouped = Array.from(
      group(
        [...todos, ...filteredActivities],
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
  }, [todos]);

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

  return (
    <div className="bg-gray-50 dark:bg-gray-800">
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
                          } catch (e) {
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
