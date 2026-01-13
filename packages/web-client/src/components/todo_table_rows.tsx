/**
 * Row rendering components for TodoTable
 * Provides both standard and virtualized row rendering
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import { flexRender, type Row } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { type FC, useCallback, useMemo, useState } from 'react';
import { BiInfoCircle, BiPauseCircle, BiPlayCircle } from 'react-icons/bi';

import { useActiveTimer } from '../hooks/use_active_timer';
import {
  useAuditedToggleCompletionMutation,
  useAuditedToggleTimeTrackingMutation,
} from '../hooks/use_audited_todo_mutations';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { ICON_BUTTON } from '../styles/interactive';
import { type TodoRowData } from './todo_table_columns';

/** Estimated row height for virtualization */
const ROW_HEIGHT = 36;

/** Hook for managing row state (completion, time tracking) */
export const useRowState = (todo: Todo, todoDuration: number) => {
  const toggleCompletion = useAuditedToggleCompletionMutation();
  const toggleTimeTracking = useAuditedToggleTimeTrackingMutation();
  const [error, setError] = useState<DatabaseError | null>(null);

  const isUpdating = toggleCompletion.isPending || toggleTimeTracking.isPending;
  const thisButtonActive = Object.values(todo.active).some((d) => d === null);
  const { counter: activeCounter } = useActiveTimer(thisButtonActive);

  const activeDuration = useMemo(() => {
    void activeCounter;
    return todoDuration;
  }, [todoDuration, activeCounter]);

  const handleToggleCheckbox = useCallback(async () => {
    if (isUpdating) return;
    setError(null);
    try {
      await toggleCompletion.mutateAsync(todo);
    } catch (err) {
      setError(err as DatabaseError);
    }
  }, [isUpdating, todo, toggleCompletion]);

  const handleToggleTimeTracking = useCallback(async () => {
    if (isUpdating) return;
    setError(null);
    try {
      await toggleTimeTracking.mutateAsync(todo);
    } catch (err) {
      setError(err as DatabaseError);
    }
  }, [isUpdating, todo, toggleTimeTracking]);

  return {
    error,
    isUpdating,
    thisButtonActive,
    activeDuration,
    handleToggleCheckbox,
    handleToggleTimeTracking,
  };
};

interface RowActionsProps {
  todo: Todo;
  todoDuration: number;
  timeTrackingActive: boolean;
}

/** Row action buttons (time tracking, details) */
export const RowActions: FC<RowActionsProps> = ({ todo, todoDuration, timeTrackingActive }) => {
  const state = useRowState(todo, todoDuration);
  const { openTodo } = useTodoFlyoutContext();

  return (
    <td className="w-24 px-2 py-1">
      <div className="flex items-center justify-end gap-0.5">
        {(!timeTrackingActive || state.thisButtonActive) && (
          <button
            className={ICON_BUTTON}
            disabled={state.isUpdating}
            onClick={state.handleToggleTimeTracking}
            title={state.thisButtonActive ? 'Pause' : 'Start'}
            type="button"
          >
            {state.thisButtonActive ? (
              <BiPauseCircle size="1.1em" />
            ) : (
              <BiPlayCircle size="1.1em" />
            )}
          </button>
        )}
        <button
          className={ICON_BUTTON}
          onClick={() => openTodo(todo)}
          title="View details"
          type="button"
        >
          <BiInfoCircle size="1.1em" />
        </button>
      </div>
    </td>
  );
};

export interface StandardRowsProps {
  rows: Row<TodoRowData>[];
  todoDurations: Map<string, number>;
  timeTrackingActive: boolean;
}

/** Standard (non-virtualized) row rendering for small lists */
export const StandardRows: FC<StandardRowsProps> = ({
  rows,
  todoDurations,
  timeTrackingActive,
}) => (
  <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-700 dark:bg-neutral-800">
    {rows.map((row) => {
      const todo = row.original.todo;
      const duration = todoDurations.get(todo._id) ?? 0;

      return (
        <tr
          className="border-b border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-700"
          key={row.id}
        >
          {row.getVisibleCells().map((cell) => (
            <td className="px-2 py-1" key={cell.id}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          ))}
          <RowActions timeTrackingActive={timeTrackingActive} todo={todo} todoDuration={duration} />
        </tr>
      );
    })}
  </tbody>
);

export interface VirtualizedRowsProps {
  rows: Row<TodoRowData>[];
  todoDurations: Map<string, number>;
  timeTrackingActive: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}

/** Virtualized row rendering for large lists */
export const VirtualizedRows: FC<VirtualizedRowsProps> = ({
  rows,
  todoDurations,
  timeTrackingActive,
  containerRef,
}) => {
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  return (
    <tbody className="relative bg-white dark:bg-neutral-800" style={{ height: `${totalHeight}px` }}>
      {virtualRows.map((virtualRow) => {
        const row = rows[virtualRow.index];
        const todo = row.original.todo;
        const duration = todoDurations.get(todo._id) ?? 0;

        return (
          <tr
            className="absolute right-0 left-0 flex border-b border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-700"
            key={row.id}
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {row.getVisibleCells().map((cell) => (
              <td className="px-2 py-1" key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
            <RowActions
              timeTrackingActive={timeTrackingActive}
              todo={todo}
              todoDuration={duration}
            />
          </tr>
        );
      })}
    </tbody>
  );
};
