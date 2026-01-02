/**
 * TodoRow component for rendering individual table rows
 */
import { type DatabaseError, type Todo, getActiveDuration } from '@eddo/core-client';
import { type FC, Fragment, memo, useMemo, useState } from 'react';
import { BiEdit, BiPauseCircle, BiPlayCircle } from 'react-icons/bi';

import { useActiveTimer } from '../hooks/use_active_timer';
import {
  useToggleCompletionMutation,
  useToggleTimeTrackingMutation,
} from '../hooks/use_todo_mutations';
import { TodoEditModal } from './todo_edit_modal';
import { TodoCell } from './todo_table_cell';
import { reorderColumnsWithStatusFirst } from './todo_table_helpers';

interface TodoRowProps {
  todo: Todo;
  selectedColumns: string[];
  activeDate: string;
  timeTrackingActive: boolean;
}

interface TodoRowActionsProps {
  timeTrackingActive: boolean;
  thisButtonTimeTrackingActive: boolean;
  isUpdating: boolean;
  onToggleTimeTracking: () => void;
  onEdit: () => void;
}

const TodoRowActions: FC<TodoRowActionsProps> = ({
  timeTrackingActive,
  thisButtonTimeTrackingActive,
  isUpdating,
  onToggleTimeTracking,
  onEdit,
}) => (
  <td className="w-24 px-2 py-1">
    <div className="flex items-center justify-end gap-0.5">
      {(!timeTrackingActive || thisButtonTimeTrackingActive) && (
        <button
          className="rounded p-0.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
          disabled={isUpdating}
          onClick={onToggleTimeTracking}
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
        onClick={onEdit}
        title="Edit"
        type="button"
      >
        <BiEdit size="1.1em" />
      </button>
    </div>
  </td>
);

const TodoRowInner: FC<TodoRowProps> = ({
  todo,
  selectedColumns,
  activeDate,
  timeTrackingActive,
}) => {
  const toggleCompletion = useToggleCompletionMutation();
  const toggleTimeTracking = useToggleTimeTrackingMutation();

  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState<DatabaseError | null>(null);

  const isUpdating = toggleCompletion.isPending || toggleTimeTracking.isPending;
  const thisButtonTimeTrackingActive = Object.values(todo.active).some((d) => d === null);
  const { counter: activeCounter } = useActiveTimer(thisButtonTimeTrackingActive);

  const activeDuration = useMemo(() => {
    return getActiveDuration(todo.active, activeDate);
  }, [thisButtonTimeTrackingActive, activeDate, activeCounter]);

  async function handleToggleCheckbox() {
    if (isUpdating) return;
    setError(null);
    try {
      await toggleCompletion.mutateAsync(todo);
    } catch (err) {
      console.error('Failed to update todo:', err);
      setError(err as DatabaseError);
    }
  }

  async function handleToggleTimeTracking() {
    if (isUpdating) return;
    setError(null);
    try {
      await toggleTimeTracking.mutateAsync(todo);
    } catch (err) {
      console.error('Failed to update time tracking:', err);
      setError(err as DatabaseError);
    }
  }

  const orderedColumns = reorderColumnsWithStatusFirst(selectedColumns);

  return (
    <>
      <tr className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700">
        {orderedColumns.map((columnId) => (
          <Fragment key={columnId}>
            <TodoCell
              activeDuration={activeDuration}
              columnId={columnId}
              error={error}
              isUpdating={isUpdating}
              onToggleCheckbox={handleToggleCheckbox}
              todo={todo}
            />
          </Fragment>
        ))}
        <TodoRowActions
          isUpdating={isUpdating}
          onEdit={() => setShowEditModal(true)}
          onToggleTimeTracking={handleToggleTimeTracking}
          thisButtonTimeTrackingActive={thisButtonTimeTrackingActive}
          timeTrackingActive={timeTrackingActive}
        />
      </tr>
      <TodoEditModal onClose={() => setShowEditModal(false)} show={showEditModal} todo={todo} />
    </>
  );
};

export const TodoRow = memo(TodoRowInner, (prevProps, nextProps) => {
  return (
    prevProps.activeDate === nextProps.activeDate &&
    prevProps.timeTrackingActive === nextProps.timeTrackingActive &&
    prevProps.todo._id === nextProps.todo._id &&
    prevProps.todo._rev === nextProps.todo._rev &&
    prevProps.todo.completed === nextProps.todo.completed &&
    prevProps.todo.title === nextProps.todo.title &&
    JSON.stringify(prevProps.todo.active) === JSON.stringify(nextProps.todo.active) &&
    JSON.stringify(prevProps.todo.tags) === JSON.stringify(nextProps.todo.tags) &&
    JSON.stringify(prevProps.selectedColumns) === JSON.stringify(nextProps.selectedColumns)
  );
});
