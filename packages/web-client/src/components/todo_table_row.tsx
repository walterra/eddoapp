/**
 * TodoRow component for rendering individual table rows
 */
import {
  areTodosEqual,
  type DatabaseError,
  getActiveDurationInRange,
  type Todo,
} from '@eddo/core-client';
import { format } from 'date-fns';
import { type FC, Fragment, memo, useMemo, useState } from 'react';
import { BiInfoCircle, BiPauseCircle, BiPlayCircle } from 'react-icons/bi';

import { useActiveTimer } from '../hooks/use_active_timer';
import {
  useAuditedToggleCompletionMutation,
  useAuditedToggleTimeTrackingMutation,
} from '../hooks/use_audited_todo_mutations';
import { useTodoFlyout } from '../hooks/use_todo_flyout';
import { ICON_BUTTON } from '../styles/interactive';
import { TodoFlyout } from './todo_flyout';
import { TodoCell } from './todo_table_cell';
import { reorderColumnsWithStatusFirst } from './todo_table_helpers';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface TodoRowProps {
  todo: Todo;
  selectedColumns: string[];
  dateRange: DateRange;
  timeTrackingActive: boolean;
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

/** Formats a Date to yyyy-MM-dd string for duration calculation */
const formatDateForRange = (date: Date): string => format(date, 'yyyy-MM-dd');

/** Hook for todo row state and handlers */
const useTodoRowState = (todo: Todo, dateRange: DateRange) => {
  const toggleCompletion = useAuditedToggleCompletionMutation();
  const toggleTimeTracking = useAuditedToggleTimeTrackingMutation();
  const flyout = useTodoFlyout(todo);
  const [error, setError] = useState<DatabaseError | null>(null);

  const isUpdating = toggleCompletion.isPending || toggleTimeTracking.isPending;
  const thisButtonActive = Object.values(todo.active).some((d) => d === null);
  const { counter: activeCounter } = useActiveTimer(thisButtonActive);
  const activeDuration = useMemo(() => {
    const startStr = formatDateForRange(dateRange.startDate);
    const endStr = formatDateForRange(dateRange.endDate);
    return getActiveDurationInRange(todo.active, startStr, endStr);
  }, [thisButtonActive, dateRange.startDate, dateRange.endDate, activeCounter, todo.active]);

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
  dateRange,
  timeTrackingActive,
}) => {
  const state = useTodoRowState(todo, dateRange);

  return (
    <>
      <tr className="border-b border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-700">
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
  return (
    prevProps.dateRange.startDate === nextProps.dateRange.startDate &&
    prevProps.dateRange.endDate === nextProps.dateRange.endDate &&
    prevProps.timeTrackingActive === nextProps.timeTrackingActive &&
    areTodosEqual(prevProps.todo, nextProps.todo) &&
    JSON.stringify(prevProps.selectedColumns) === JSON.stringify(nextProps.selectedColumns)
  );
});
