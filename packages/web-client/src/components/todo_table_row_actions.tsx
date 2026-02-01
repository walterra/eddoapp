/**
 * Row action buttons for TodoTable
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import { type FC, useCallback, useMemo, useState } from 'react';
import { BiInfoCircle, BiPauseCircle, BiPlayCircle } from 'react-icons/bi';

import { AddTodoPopover } from './add_todo_popover';

import { useActiveTimer } from '../hooks/use_active_timer';
import {
  useAuditedToggleCompletionMutation,
  useAuditedToggleTimeTrackingMutation,
} from '../hooks/use_audited_todo_mutations';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { ICON_BUTTON } from '../styles/interactive';

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

export interface RowActionsProps {
  todo: Todo;
  todoDuration: number;
  timeTrackingActive: boolean;
}

/** Row action buttons (time tracking, details) */
export const RowActions: FC<RowActionsProps> = ({ todo, todoDuration, timeTrackingActive }) => {
  const state = useRowState(todo, todoDuration);
  const { openTodo } = useTodoFlyoutContext();

  return (
    <td className="w-28 px-2 py-1">
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
        <AddTodoPopover
          enableKeyboardShortcut={false}
          parentTodo={todo}
          triggerClassName={ICON_BUTTON}
          triggerTitle="Create subtask"
          triggerVariant="icon"
        />
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
