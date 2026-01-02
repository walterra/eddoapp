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
import { FOCUS_RING, TRANSITION } from '../styles/interactive';
import { TodoEditModal } from './todo_edit_modal';
import { TodoCell } from './todo_table_cell';
import { reorderColumnsWithStatusFirst } from './todo_table_helpers';

interface TodoRowProps {
  todo: Todo;
  selectedColumns: string[];
  activeDate: string;
  timeTrackingActive: boolean;
}

interface TimeTrackingButtonProps {
  isActive: boolean;
  isUpdating: boolean;
  onClick: () => void;
}

const TimeTrackingButton: FC<TimeTrackingButtonProps> = ({ isActive, isUpdating, onClick }) => (
  <button
    className={`rounded p-0.5 ${TRANSITION} text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-200 ${FOCUS_RING}`}
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
      <button
        className={`rounded p-0.5 ${TRANSITION} text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-200 ${FOCUS_RING}`}
        onClick={onEdit}
        title="Edit"
        type="button"
      >
        <BiEdit size="1.1em" />
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
}

const RowCells: FC<RowCellsProps> = ({
  todo,
  columns,
  activeDuration,
  isUpdating,
  error,
  onToggleCheckbox,
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
          todo={todo}
        />
      </Fragment>
    ))}
  </>
);

/** Hook for todo row state and handlers */
const useTodoRowState = (todo: Todo, activeDate: string) => {
  const toggleCompletion = useToggleCompletionMutation();
  const toggleTimeTracking = useToggleTimeTrackingMutation();
  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState<DatabaseError | null>(null);

  const isUpdating = toggleCompletion.isPending || toggleTimeTracking.isPending;
  const thisButtonActive = Object.values(todo.active).some((d) => d === null);
  const { counter: activeCounter } = useActiveTimer(thisButtonActive);
  const activeDuration = useMemo(
    () => getActiveDuration(todo.active, activeDate),
    [thisButtonActive, activeDate, activeCounter],
  );

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
    showEditModal,
    setShowEditModal,
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
  activeDate,
  timeTrackingActive,
}) => {
  const state = useTodoRowState(todo, activeDate);

  return (
    <>
      <tr className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700">
        <RowCells
          activeDuration={state.activeDuration}
          columns={reorderColumnsWithStatusFirst(selectedColumns)}
          error={state.error}
          isUpdating={state.isUpdating}
          onToggleCheckbox={state.handleToggleCheckbox}
          todo={todo}
        />
        <TodoRowActions
          isUpdating={state.isUpdating}
          onEdit={() => state.setShowEditModal(true)}
          onToggleTimeTracking={state.handleToggleTimeTracking}
          thisButtonActive={state.thisButtonActive}
          timeTrackingActive={timeTrackingActive}
        />
      </tr>
      <TodoEditModal
        onClose={() => state.setShowEditModal(false)}
        show={state.showEditModal}
        todo={todo}
      />
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
