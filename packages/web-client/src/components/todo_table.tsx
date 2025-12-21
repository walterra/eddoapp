import {
  type DatabaseError,
  type Todo,
  getActiveDuration,
  getFormattedDuration,
  getFormattedDurationForActivities,
  getRepeatTodo,
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
import { Checkbox } from 'flowbite-react';
import { type FC, Fragment, useEffect, useMemo, useState } from 'react';
import { BiEdit, BiPauseCircle, BiPlayCircle } from 'react-icons/bi';

import { CONTEXT_DEFAULT } from '../constants';
import { ensureDesignDocuments } from '../database_setup';
import { useActiveTimer } from '../hooks/use_active_timer';
import { useActivitiesByWeek } from '../hooks/use_activities_by_week';
import { useTimeTrackingActive } from '../hooks/use_time_tracking_active';
import { useTodosByWeek } from '../hooks/use_todos_by_week';
import { usePouchDb } from '../pouch_db';
import { DatabaseErrorFallback } from './database_error_fallback';
import { DatabaseErrorMessage } from './database_error_message';
import { FormattedMessage } from './formatted_message';
import type { CompletionStatus } from './status_filter';
import { TagDisplay } from './tag_display';
import type { TimeRange } from './time_range_filter';
import { TodoEditModal } from './todo_edit_modal';

const getColumnWidthClass = (columnId: string): string => {
  const widths: Record<string, string> = {
    title: '', // Flexible width
    context: 'w-32',
    due: 'w-32',
    tags: 'w-48',
    timeTracked: 'w-28',
    status: 'w-10',
    completed: 'w-40',
    repeat: 'w-24',
    link: 'w-20',
    description: 'max-w-md',
  };
  return widths[columnId] || '';
};

const reorderColumnsWithStatusFirst = (columns: string[]): string[] => {
  const hasStatus = columns.includes('status');
  if (!hasStatus) {
    return columns;
  }
  const otherColumns = columns.filter((col) => col !== 'status');
  return ['status', ...otherColumns];
};

interface TodoTableProps {
  currentDate: Date;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeRange: TimeRange;
  selectedColumns: string[];
}

interface TodoRowProps {
  todo: Todo;
  selectedColumns: string[];
  activeDate: string;
  timeTrackingActive: boolean;
  onUpdate: () => void;
}

const TodoRow: FC<TodoRowProps> = ({
  todo,
  selectedColumns,
  activeDate,
  timeTrackingActive,
  onUpdate,
}) => {
  const { safeDb } = usePouchDb();
  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState<DatabaseError | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const thisButtonTimeTrackingActive = Object.values(todo.active).some((d) => d === null);
  const { counter: activeCounter } = useActiveTimer(thisButtonTimeTrackingActive);

  const activeDuration = useMemo(() => {
    return getActiveDuration(todo.active, activeDate);
  }, [thisButtonTimeTrackingActive, activeDate, activeCounter]);

  async function toggleCheckbox() {
    if (isUpdating) return;

    setError(null);
    setIsUpdating(true);

    const updatedTodo = {
      ...todo,
      completed: todo.completed === null ? new Date().toISOString() : null,
    };

    try {
      await safeDb.safePut(updatedTodo);

      if (typeof updatedTodo.repeat === 'number' && updatedTodo.completed) {
        await safeDb.safePut(getRepeatTodo(updatedTodo));
      }
      onUpdate();
    } catch (err) {
      console.error('Failed to update todo:', err);
      setError(err as DatabaseError);
    } finally {
      setIsUpdating(false);
    }
  }

  async function toggleTimeTracking() {
    if (isUpdating) return;

    setError(null);
    setIsUpdating(true);

    const updatedActive = { ...todo.active };

    if (
      Object.keys(updatedActive).length === 0 ||
      Object.values(updatedActive).every((d) => d !== null)
    ) {
      updatedActive[new Date().toISOString()] = null;
    } else {
      const activeEntry = Object.entries(updatedActive).find((d) => d[1] === null);
      if (activeEntry) {
        updatedActive[activeEntry[0]] = new Date().toISOString();
      }
    }

    const updatedTodo = { ...todo, active: updatedActive };

    try {
      await safeDb.safePut(updatedTodo);
      onUpdate();
    } catch (err) {
      console.error('Failed to update time tracking:', err);
      setError(err as DatabaseError);
    } finally {
      setIsUpdating(false);
    }
  }

  const renderCell = (columnId: string) => {
    const widthClass = getColumnWidthClass(columnId);
    const baseClass = 'px-2 py-1';

    switch (columnId) {
      case 'title':
        return (
          <td className={`${baseClass} text-xs ${widthClass}`}>
            {error && (
              <div className="mb-0.5 text-xs text-red-600 dark:text-red-400">Failed to update</div>
            )}
            <span
              className={[
                todo.completed ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {todo.link !== null ? (
                <a
                  className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                  href={todo.link}
                  rel="noreferrer"
                  target="_BLANK"
                >
                  <FormattedMessage message={todo.title} />
                </a>
              ) : (
                <FormattedMessage message={todo.title} />
              )}
            </span>
          </td>
        );
      case 'context':
        return (
          <td className={`${baseClass} text-xs text-gray-700 dark:text-gray-300 ${widthClass}`}>
            <FormattedMessage message={todo.context || CONTEXT_DEFAULT} />
          </td>
        );
      case 'due':
        return (
          <td
            className={`${baseClass} text-xs whitespace-nowrap text-gray-700 dark:text-gray-300 ${widthClass}`}
          >
            {format(new Date(todo.due), 'yyyy-MM-dd')}
          </td>
        );
      case 'tags':
        return (
          <td className={`${baseClass} ${widthClass}`}>
            {todo.tags.length > 0 ? (
              <TagDisplay maxTags={3} size="xs" tags={todo.tags} />
            ) : (
              <span className="text-xs text-gray-400">-</span>
            )}
          </td>
        );
      case 'timeTracked':
        return (
          <td
            className={`${baseClass} text-xs whitespace-nowrap text-gray-700 dark:text-gray-300 ${widthClass}`}
          >
            {activeDuration > 0 ? getFormattedDuration(activeDuration) : '-'}
          </td>
        );
      case 'status':
        return (
          <td className={`${baseClass} ${widthClass}`}>
            <Checkbox
              checked={todo.completed !== null}
              disabled={isUpdating}
              key={`checkbox-${todo._id}-${todo.completed !== null}`}
              onChange={toggleCheckbox}
            />
          </td>
        );
      case 'completed':
        return (
          <td
            className={`${baseClass} text-xs whitespace-nowrap text-gray-700 dark:text-gray-300 ${widthClass}`}
          >
            {todo.completed ? format(new Date(todo.completed), 'yyyy-MM-dd HH:mm') : '-'}
          </td>
        );
      case 'repeat':
        return (
          <td
            className={`${baseClass} text-xs whitespace-nowrap text-gray-700 dark:text-gray-300 ${widthClass}`}
          >
            {todo.repeat ? `${todo.repeat} days` : '-'}
          </td>
        );
      case 'link':
        return (
          <td className={`${baseClass} text-xs ${widthClass}`}>
            {todo.link ? (
              <a
                className="text-blue-600 hover:underline dark:text-blue-500"
                href={todo.link}
                rel="noreferrer"
                target="_BLANK"
              >
                Link
              </a>
            ) : (
              '-'
            )}
          </td>
        );
      case 'description':
        return (
          <td className={`${baseClass} text-xs text-gray-700 dark:text-gray-300 ${widthClass}`}>
            {todo.description || '-'}
          </td>
        );
      default:
        return <td className={baseClass}>-</td>;
    }
  };

  const orderedColumns = reorderColumnsWithStatusFirst(selectedColumns);

  return (
    <>
      <tr className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700">
        {orderedColumns.map((columnId) => (
          <Fragment key={columnId}>{renderCell(columnId)}</Fragment>
        ))}
        <td className="w-24 px-2 py-1">
          <div className="flex items-center justify-end gap-0.5">
            {(!timeTrackingActive || thisButtonTimeTrackingActive) && (
              <button
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                disabled={isUpdating}
                onClick={toggleTimeTracking}
                title={thisButtonTimeTrackingActive ? 'Pause' : 'Start'}
                type="button"
              >
                {thisButtonTimeTrackingActive ? (
                  <BiPauseCircle size="1.1em" />
                ) : (
                  <BiPlayCircle size="1.1em" />
                )}
              </button>
            )}
            <button
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
              onClick={() => setShowEditModal(true)}
              title="Edit"
              type="button"
            >
              <BiEdit size="1.1em" />
            </button>
          </div>
        </td>
      </tr>
      <TodoEditModal onClose={() => setShowEditModal(false)} show={showEditModal} todo={todo} />
    </>
  );
};

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
  const [refreshKey, setRefreshKey] = useState(0);

  const { startDate, endDate } = useMemo(() => {
    const currentStartOfWeek = add(startOfWeek(currentDate, { weekStartsOn: 1 }), { hours: 2 });
    const currentEndOfWeek = add(endOfWeek(currentDate, { weekStartsOn: 1 }), { hours: 2 });

    switch (selectedTimeRange.type) {
      case 'current-day':
        return {
          startDate: add(startOfDay(currentDate), { hours: 2 }),
          endDate: add(endOfDay(currentDate), { hours: 2 }),
        };
      case 'current-week':
        return { startDate: currentStartOfWeek, endDate: currentEndOfWeek };
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
        return { startDate: currentStartOfWeek, endDate: currentEndOfWeek };
      case 'all-time':
        return { startDate: new Date('2000-01-01'), endDate: new Date('2099-12-31') };
      default:
        return { startDate: currentStartOfWeek, endDate: currentEndOfWeek };
    }
  }, [currentDate, selectedTimeRange]);

  const todosQuery = useTodosByWeek({ startDate, endDate, enabled: isInitialized });
  const activitiesQuery = useActivitiesByWeek({ startDate, endDate, enabled: isInitialized });
  const timeTrackingQuery = useTimeTrackingActive({ enabled: isInitialized });

  const activities = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);
  const timeTrackingActive = useMemo(
    () => timeTrackingQuery.data ?? ['hide-by-default'],
    [timeTrackingQuery.data],
  );
  const todos = useMemo(
    () => (todosQuery.data ?? []).filter((d: Todo) => isLatestVersion(d)) as Todo[],
    [todosQuery.data],
  );

  const isLoading = todosQuery.isLoading || activitiesQuery.isLoading;
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

  const filteredTodos = useMemo(() => {
    let filtered = todos;

    if (selectedContexts.length > 0) {
      filtered = filtered.filter((todo) => {
        return selectedContexts.includes(todo.context || CONTEXT_DEFAULT);
      });
    }

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

    if (selectedTags.length > 0) {
      filtered = filtered.filter((todo) => {
        return selectedTags.some((selectedTag) => todo.tags.includes(selectedTag));
      });
    }

    return filtered;
  }, [todos, selectedTags, selectedContexts, selectedStatus]);

  const groupedByContext = useMemo(() => {
    const grouped = Array.from(group(filteredTodos, (d) => d.context ?? CONTEXT_DEFAULT));
    grouped.sort((a, b) => ('' + a[0]).localeCompare(b[0]));
    return grouped;
  }, [filteredTodos]);

  const durationByContext = useMemo(() => {
    return Object.fromEntries(
      Array.from(group(activities, (d) => d.doc.context ?? CONTEXT_DEFAULT)).map((d) => [
        d[0],
        getFormattedDurationForActivities(d[1]),
      ]),
    );
  }, [activities]);

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

  const getColumnLabel = (columnId: string): string => {
    const labels: Record<string, string> = {
      title: 'Title',
      context: 'Context',
      due: 'Due Date',
      tags: 'Tags',
      timeTracked: 'Time Tracked',
      status: '',
      completed: 'Completed',
      repeat: 'Repeat',
      link: 'Link',
      description: 'Description',
    };
    return columnId in labels ? labels[columnId] : columnId;
  };

  const handleUpdate = () => {
    setRefreshKey((prev) => prev + 1);
    todosQuery.refetch();
    activitiesQuery.refetch();
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800">
      {displayError && todos.length > 0 && (
        <div className="px-4 pt-2">
          <DatabaseErrorMessage error={displayError} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="overflow-x-auto px-4 py-2">
        {groupedByContext.map(([context, contextTodos]) => (
          <div className="mb-4" key={context}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide text-gray-700 uppercase dark:text-gray-300">
                <FormattedMessage message={context} />
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {durationByContext[context]}
              </span>
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
                      key={`${todo._id}-${refreshKey}`}
                      onUpdate={handleUpdate}
                      selectedColumns={selectedColumns}
                      timeTrackingActive={timeTrackingActive.length > 0}
                      todo={todo}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
