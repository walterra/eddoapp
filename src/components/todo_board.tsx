import { useEffect, useMemo, useState, type FC } from 'react';
import { group } from 'd3-array';
import { add, format, getISOWeek, startOfWeek, endOfWeek } from 'date-fns';

import { CONTEXT_DEFAULT } from '../constants';
import { usePouchDb } from '../pouch_db';

import { isLatestVersion, migrateTodo } from '../api/versions/migrate';
import { type Todo } from '../types/todo';
import { getFormattedDurationForTodos } from '../utils/get_formatted_duration';

import { FormattedMessage } from './formatted_message';
import { TodoListElement } from './todo_list_element';

interface TodoBoardProps {
  currentDate: Date;
}

export const TodoBoard: FC<TodoBoardProps> = ({ currentDate }) => {
  const db = usePouchDb();
  const [timeTrackingActive, setTimeTrackingActive] = useState<string[]>([
    'hide-by-default',
  ]);
  const [outdatedTodos, setOutdatedTodos] = useState<unknown[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);

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
  }, [currentDate]);

  async function fetchTimeTrackingActive() {
    try {
      // TODO query via design doc
      const resp = await db.query(
        (doc, emit) => {
          if (emit) {
            Object.entries((doc as Todo).active).forEach((d) => {
              emit(d[1], {});
            });
          }
        },
        { key: null },
      );
      setTimeTrackingActive(resp.rows.map((d) => d.id));
    } catch (e) {
      console.error('not able to fetch active todos', e);
    }
  }

  async function fetchTodos() {
    try {
      // TODO query via design doc
      const newTodos = await db.query(
        (doc, emit) => {
          if (emit) {
            emit((doc as Todo).due, doc);
          }
        },
        {
          descending: false,
          endkey: currentEndOfWeek.toISOString(),
          include_docs: false,
          startkey: currentStartOfWeek.toISOString(),
        },
      );

      setOutdatedTodos(
        newTodos?.rows
          .filter((d) => !isLatestVersion(d.value))
          .map((d) => d.value),
      );

      setTodos(
        (newTodos?.rows
          .filter((d) => isLatestVersion(d.value))
          .map((d) => d.value) ?? []) as Todo[],
      );
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchTodos();
    fetchTimeTrackingActive();
  }, [currentCalendarWeek]);

  useEffect(() => {
    db.bulkDocs(outdatedTodos.map((d) => migrateTodo(d)));
  }, [outdatedTodos]);

  const groupedByContextByDate = useMemo(() => {
    const grouped = Array.from(
      group(
        todos,
        (d) => d.context ?? CONTEXT_DEFAULT,
        // TODO The 'split' is a CEST quick fix
        (d) => d.due.split('T')[0], // format(new Date(d.due), 'yyyy-MM-dd'),
      ),
    );
    grouped.sort((a, b) => ('' + a[0]).localeCompare(b[0]));
    return grouped;
  }, [todos]);

  const durationByContext = useMemo(
    () =>
      Object.fromEntries(
        Array.from(group(todos, (d) => d.context ?? CONTEXT_DEFAULT)).map(
          (d) => {
            const context = d[0];
            const entries = d[1];

            return [context, getFormattedDurationForTodos(entries)];
          },
        ),
      ),
    [todos],
  );

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
                        {todosByDate.map(([todoDate, todosForDate]) => {
                          todosForDate.sort((a, b) =>
                            ('' + a.title).localeCompare(b.title),
                          );

                          return (
                            <div key={`${context}_${todoDate}`}>
                              <div className="flex items-center justify-between">
                                <div className="mx-1">
                                  {format(new Date(todoDate), 'yyyy-MM-dd')}
                                </div>
                                <div className="mx-1 text-xs text-gray-400">
                                  {getFormattedDurationForTodos(todosForDate)}
                                </div>
                              </div>
                              {todosForDate.map((todo) => (
                                <TodoListElement
                                  active={timeTrackingActive.some(
                                    (d) => d === todo._id,
                                  )}
                                  key={todo._id}
                                  timeTrackingActive={
                                    timeTrackingActive.length > 0
                                  }
                                  todo={todo}
                                />
                              ))}
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
