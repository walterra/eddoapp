/**
 * TodoRow component for rendering individual table rows
 */
import { areTodosEqual, type DatabaseError, type Todo } from '@eddo/core-client';
import { type FC, Fragment, memo, useMemo, useState } from 'react';
import { BiInfoCircle, BiPauseCircle, BiPlayCircle } from 'react-icons/bi';

import { useActiveTimer } from '../hooks/use_active_timer';
import {
  useAuditedToggleCompletionMutation,
  useAuditedToggleTimeTrackingMutation,
} from '../hooks/use_audited_todo_mutations';
import { type SubtaskCount } from '../hooks/use_parent_child';
import { useTodoFlyout } from '../hooks/use_todo_flyout';
import { ICON_BUTTON } from '../styles/interactive';
import { TodoFlyout } from './todo_flyout';
import { TodoCell } from './todo_table_cell';
import { reorderColumnsWithStatusFirst } from './todo_table_helpers';

interface TodoRowProps {
  todo: Todo;
  selectedColumns: string[];
  timeTrackingActive: boolean;
  /** Pre-computed total duration (own + child time) in milliseconds */
  todoDuration: number;
  /** Pre-computed subtask count (avoids N+1 queries) */
  subtaskCount?: SubtaskCount;
}

interface TimeTrackingButtonProps {
  isActive: boolean;
  isUpdating: boolean;
  onClick: () => void;
}

const TimeTrackingButton: FC<TimeTrackingButtonProps> = ({ isActive, isUpdating, onClick }) => (
  <button
    className={ICON_BUTTON}
    disabled={isUpdating}
    onClick={onClick}
    title={isActive ? 'Pause' : 'Start'}
    type="button"
  >
    {isActive ? <BiPauseCircle size="1.1em" /> : <BiPlayCircle size="1.1em" />}
  </button>
);

interface TodoRowActionsProps {
  timeTrackingActive: boolean;
  thisButtonActive: boolean;
  isUpdating: boolean;
  onToggleTimeTracking: () => void;
  onEdit: () => void;
}

const TodoRowActions: FC<TodoRowActionsProps> = ({
  timeTrackingActive,
  thisButtonActive,
  isUpdating,
  onToggleTimeTracking,
  onEdit,
}) => (
  <td className="w-24 px-2 py-1">
    <div className="flex items-center justify-end gap-0.5">
      {(!timeTrackingActive || thisButtonActive) && (
        <TimeTrackingButton
          isActive={thisButtonActive}
          isUpdating={isUpdating}
          onClick={onToggleTimeTracking}
        />
      )}
      <button className={ICON_BUTTON} onClick={onEdit} title="View details" type="button">
        <BiInfoCircle size="1.1em" />
      </button>
    </div>
  </td>
);

interface RowCellsProps {
  todo: Todo;
  columns: string[];
  activeDuration: number;
  isUpdating: boolean;
  error: DatabaseError | null;
  onToggleCheckbox: () => void;
  subtaskCount?: SubtaskCount;
}

const RowCells: FC<RowCellsProps> = ({
  todo,
  columns,
  activeDuration,
  isUpdating,
  error,
  onToggleCheckbox,
  subtaskCount,
}) => (
  <>
    {columns.map((columnId) => (
      <Fragment key={columnId}>
        <TodoCell
          activeDuration={activeDuration}
          columnId={columnId}
          error={error}
          isUpdating={isUpdating}
          onToggleCheckbox={onToggleCheckbox}
          subtaskCount={subtaskCount}
          todo={todo}
        />
      </Fragment>
    ))}
  </>
);

/** Hook for todo row state and handlers */
const useTodoRowState = (todo: Todo, todoDuration: number) => {
  const toggleCompletion = useAuditedToggleCompletionMutation();
  const toggleTimeTracking = useAuditedToggleTimeTrackingMutation();
  const flyout = useTodoFlyout(todo);
  const [error, setError] = useState<DatabaseError | null>(null);

  const isUpdating = toggleCompletion.isPending || toggleTimeTracking.isPending;
  const thisButtonActive = Object.values(todo.active).some((d) => d === null);
  // useActiveTimer triggers re-renders every second when timer is active
  const { counter: activeCounter } = useActiveTimer(thisButtonActive);
  // Pre-computed duration already includes child time, just use it directly
  // activeCounter dependency ensures live updates for active timers
  const activeDuration = useMemo(() => {
    void activeCounter; // Trigger recalc on timer tick
    return todoDuration;
  }, [todoDuration, activeCounter]);

  const handleToggleCheckbox = async () => {
    if (isUpdating) return;
    setError(null);
    try {
      await toggleCompletion.mutateAsync(todo);
    } catch (err) {
      setError(err as DatabaseError);
    }
  };

  const handleToggleTimeTracking = async () => {
    if (isUpdating) return;
    setError(null);
    try {
      await toggleTimeTracking.mutateAsync(todo);
    } catch (err) {
      setError(err as DatabaseError);
    }
  };

  return {
    showFlyout: flyout.isOpen,
    openFlyout: flyout.open,
    closeFlyout: flyout.close,
    error,
    isUpdating,
    thisButtonActive,
    activeDuration,
    handleToggleCheckbox,
    handleToggleTimeTracking,
  };
};

const TodoRowInner: FC<TodoRowProps> = ({
  todo,
  selectedColumns,
  timeTrackingActive,
  todoDuration,
  subtaskCount,
}) => {
  const state = useTodoRowState(todo, todoDuration);

  return (
    <>
      <tr className="border-b border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-700">
        <RowCells
          activeDuration={state.activeDuration}
          columns={reorderColumnsWithStatusFirst(selectedColumns)}
          error={state.error}
          isUpdating={state.isUpdating}
          onToggleCheckbox={state.handleToggleCheckbox}
          subtaskCount={subtaskCount}
          todo={todo}
        />
        <TodoRowActions
          isUpdating={state.isUpdating}
          onEdit={state.openFlyout}
          onToggleTimeTracking={state.handleToggleTimeTracking}
          thisButtonActive={state.thisButtonActive}
          timeTrackingActive={timeTrackingActive}
        />
      </tr>
      <TodoFlyout onClose={state.closeFlyout} show={state.showFlyout} todo={todo} />
    </>
  );
};

export const TodoRow = memo(TodoRowInner, (prevProps, nextProps) => {
  const subtaskCountEqual =
    prevProps.subtaskCount?.total === nextProps.subtaskCount?.total &&
    prevProps.subtaskCount?.completed === nextProps.subtaskCount?.completed;

  return (
    prevProps.timeTrackingActive === nextProps.timeTrackingActive &&
    prevProps.todoDuration === nextProps.todoDuration &&
    subtaskCountEqual &&
    areTodosEqual(prevProps.todo, nextProps.todo) &&
    JSON.stringify(prevProps.selectedColumns) === JSON.stringify(nextProps.selectedColumns)
  );
});
