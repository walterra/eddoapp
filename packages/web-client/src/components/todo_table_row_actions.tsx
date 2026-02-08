/**
 * Row action buttons for TodoTable
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import { type FC, useCallback, useMemo, useState } from 'react';
import { BiLinkExternal } from 'react-icons/bi';
import { useActiveTimer } from '../hooks/use_active_timer';
import {
  useAuditedDeleteTodoMutation,
  useAuditedToggleCompletionMutation,
  useAuditedToggleTimeTrackingMutation,
} from '../hooks/use_audited_todo_mutations';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { ICON_BUTTON } from '../styles/interactive';
import { RowActionsMenu } from './todo_table_row_actions_menu';

/** Hook for managing row state (completion, time tracking) */
export const useRowState = (todo: Todo, todoDuration: number) => {
  const toggleCompletion = useAuditedToggleCompletionMutation();
  const toggleTimeTracking = useAuditedToggleTimeTrackingMutation();
  const deleteTodo = useAuditedDeleteTodoMutation();
  const [error, setError] = useState<DatabaseError | null>(null);

  const isUpdating =
    toggleCompletion.isPending || toggleTimeTracking.isPending || deleteTodo.isPending;
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

  const handleDelete = useCallback(async () => {
    if (isUpdating) return;
    setError(null);
    try {
      await deleteTodo.mutateAsync(todo);
    } catch (err) {
      setError(err as DatabaseError);
    }
  }, [deleteTodo, isUpdating, todo]);

  return {
    error,
    isUpdating,
    thisButtonActive,
    activeDuration,
    handleToggleCheckbox,
    handleToggleTimeTracking,
    handleDelete,
  };
};

export interface RowActionsProps {
  todo: Todo;
  todoDuration: number;
  timeTrackingActive: boolean;
  onShowDependencies?: (todoId: string) => void;
}

/** Row action buttons (time tracking, details) */
export const RowActions: FC<RowActionsProps> = ({
  todo,
  todoDuration,
  timeTrackingActive: _timeTrackingActive,
  onShowDependencies,
}) => {
  const state = useRowState(todo, todoDuration);
  const { openTodoInEdit } = useTodoFlyoutContext();

  return (
    <td className="w-28 px-2 py-1">
      <div className="flex items-center justify-end gap-0.5">
        {todo.link ? (
          <a
            aria-label="Open link"
            className={ICON_BUTTON}
            href={todo.link}
            rel="noreferrer"
            target="_blank"
            title="Open link"
          >
            <BiLinkExternal size="1.1em" />
          </a>
        ) : (
          <span aria-hidden="true" className={`${ICON_BUTTON} opacity-0`}>
            <BiLinkExternal size="1.1em" />
          </span>
        )}
        <RowActionsMenu
          onDelete={state.handleDelete}
          onOpenEdit={() => openTodoInEdit(todo)}
          onShowDependencies={onShowDependencies ? () => onShowDependencies(todo._id) : undefined}
          onToggleTimeTracking={state.handleToggleTimeTracking}
          timeTrackingLabel={state.thisButtonActive ? 'Stop time tracking' : 'Start time tracking'}
          todo={todo}
        />
      </div>
    </td>
  );
};
