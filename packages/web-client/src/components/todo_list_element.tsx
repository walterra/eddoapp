import {
  type DatabaseError,
  type Todo,
  getActiveDuration,
  getFormattedDuration,
} from '@eddo/core-client';
import { Checkbox } from 'flowbite-react';
import { type FC, memo, useMemo, useState } from 'react';
import { BiEdit, BiPauseCircle, BiPlayCircle } from 'react-icons/bi';

import { useActiveTimer } from '../hooks/use_active_timer';
import {
  useToggleCompletionMutation,
  useToggleTimeTrackingMutation,
} from '../hooks/use_todo_mutations';
import { FOCUS_RING, TRANSITION } from '../styles/interactive';
import { FormattedMessage } from './formatted_message';
import { TagDisplay } from './tag_display';
import { TodoEditModal } from './todo_edit_modal';

interface TodoListElementProps {
  active: boolean;
  activeDate: string;
  activityOnly: boolean;
  timeTrackingActive: boolean;
  todo: Todo;
}

interface ErrorDisplayProps {
  error: DatabaseError | null;
  onDismiss: () => void;
}

const ErrorDisplay: FC<ErrorDisplayProps> = ({ error, onDismiss }) =>
  error ? (
    <div className="border-error-200 bg-error-50 dark:border-error-700 dark:bg-error-900 mb-1 rounded border px-2 py-1 text-xs">
      <span className="text-error-700 dark:text-error-200">Failed to update todo</span>
      <button
        className={`ml-2 ${TRANSITION} text-error-600 hover:text-error-500 rounded ${FOCUS_RING}`}
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  ) : null;

interface TitleDisplayProps {
  todo: Todo;
  activityOnly: boolean;
}

const TitleDisplay: FC<TitleDisplayProps> = ({ todo, activityOnly }) => {
  const className = [
    'text-xs',
    todo.completed || activityOnly ? 'text-neutral-400' : '',
    todo.completed ? 'line-through' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={className}>
      {todo.link !== null && !activityOnly ? (
        <a
          className={`text-primary-600 font-medium ${TRANSITION} hover:text-primary-800 dark:text-primary-500 dark:hover:text-primary-300 rounded hover:underline ${FOCUS_RING}`}
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
  );
};

const ICON_BUTTON_BASE = `rounded p-1 ${TRANSITION} text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-700 ${FOCUS_RING}`;
const ICON_BUTTON_REVEAL = 'opacity-0 group-hover:opacity-100 focus:opacity-100';

interface TimeTrackingButtonProps {
  isActive: boolean;
  isUpdating: boolean;
  onClick: (e: React.FormEvent<HTMLButtonElement>) => void;
}

const TimeTrackingButton: FC<TimeTrackingButtonProps> = ({ isActive, isUpdating, onClick }) => (
  <button
    className={`${ICON_BUTTON_BASE} disabled:cursor-not-allowed disabled:opacity-50 ${isActive ? 'opacity-100' : ICON_BUTTON_REVEAL}`}
    data-testid={isActive ? 'pause-button' : 'play-button'}
    disabled={isUpdating}
    onClick={onClick}
    type="button"
  >
    {isActive ? <BiPauseCircle size="1.3em" /> : <BiPlayCircle size="1.3em" />}
  </button>
);

interface ActionButtonsProps {
  todo: Todo;
  isUpdating: boolean;
  activityOnly: boolean;
  timeTrackingActive: boolean;
  onTimeTrackingClick: (e: React.FormEvent<HTMLButtonElement>) => void;
  onEditClick: (e: React.FormEvent<HTMLButtonElement>) => void;
  activeDuration: number;
  activeCounter: number;
}

const ActionButtons: FC<ActionButtonsProps> = (props) => {
  const {
    todo,
    isUpdating,
    activityOnly,
    timeTrackingActive,
    onTimeTrackingClick,
    onEditClick,
    activeDuration,
    activeCounter,
  } = props;
  const isTrackingThis = Object.values(todo.active).some((d) => d === null);
  const showTimeTracking = !timeTrackingActive || isTrackingThis;

  return (
    <div className="-mt-0.5 -mr-0.5 flex items-start space-x-0.5">
      {activeDuration > 0 && (
        <span className="text-xs text-neutral-400" data-counter={activeCounter}>
          {getFormattedDuration(activeDuration)}
        </span>
      )}
      {!activityOnly && (
        <>
          {showTimeTracking && (
            <TimeTrackingButton
              isActive={isTrackingThis}
              isUpdating={isUpdating}
              onClick={onTimeTrackingClick}
            />
          )}
          <button
            className={`${ICON_BUTTON_BASE} ${ICON_BUTTON_REVEAL}`}
            data-testid="edit-button"
            onClick={onEditClick}
            type="button"
          >
            <BiEdit size="1.3em" />
          </button>
        </>
      )}
    </div>
  );
};

/** Hook for todo list element state */
const useTodoListState = (todo: Todo, active: boolean, activeDate: string) => {
  const toggleCompletion = useToggleCompletionMutation();
  const toggleTimeTracking = useToggleTimeTrackingMutation();
  const { counter: activeCounter } = useActiveTimer(active);
  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState<DatabaseError | null>(null);

  const isUpdating = toggleCompletion.isPending || toggleTimeTracking.isPending;
  const activeDuration = useMemo(
    () => getActiveDuration(todo.active, activeDate),
    [active, activeDate, activeCounter],
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

  const handleTimeTrackingClick = async (e: React.FormEvent<HTMLButtonElement>) => {
    e.preventDefault();
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
    setError,
    isUpdating,
    activeDuration,
    activeCounter,
    handleToggleCheckbox,
    handleTimeTrackingClick,
  };
};

interface TodoContentProps {
  todo: Todo;
  activityOnly: boolean;
  isUpdating: boolean;
  onToggle: () => void;
}

const TodoContent: FC<TodoContentProps> = ({ todo, activityOnly, isUpdating, onToggle }) => (
  <div className="text-xs text-neutral-900 dark:text-white">
    <div className="flex space-x-1">
      <div className="mr-0.5 -ml-1">
        {!activityOnly && (
          <Checkbox
            className="checkbox checkbox-xs text-neutral-400"
            color="gray"
            defaultChecked={todo.completed !== null}
            disabled={isUpdating}
            key={`checkbox-${todo._id}-${todo.completed !== null}`}
            onChange={onToggle}
          />
        )}
      </div>
      <div>
        <TitleDisplay activityOnly={activityOnly} todo={todo} />
        {todo.tags.length > 0 && (
          <div className="mt-1">
            <TagDisplay maxTags={3} size="xs" tags={todo.tags} />
          </div>
        )}
      </div>
    </div>
  </div>
);

const TodoListElementInner: FC<TodoListElementProps> = ({
  active,
  activeDate,
  activityOnly,
  timeTrackingActive,
  todo,
}) => {
  const state = useTodoListState(todo, active, activeDate);
  const activeClass = active ? 'border-2 border-sky-600 ' : '';
  const cardClass = `${activeClass}mb-1 flex max-w-md transform flex-col rounded border border-neutral-200 bg-white px-2 py-1 ${TRANSITION} hover:shadow-md hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600`;

  return (
    <div className={cardClass}>
      <ErrorDisplay error={state.error} onDismiss={() => state.setError(null)} />
      <div className="group flex items-start justify-between">
        <TodoContent
          activityOnly={activityOnly}
          isUpdating={state.isUpdating}
          onToggle={state.handleToggleCheckbox}
          todo={todo}
        />
        <ActionButtons
          activeCounter={state.activeCounter}
          activeDuration={state.activeDuration}
          activityOnly={activityOnly}
          isUpdating={state.isUpdating}
          onEditClick={(e) => {
            e.preventDefault();
            state.setShowEditModal(true);
          }}
          onTimeTrackingClick={state.handleTimeTrackingClick}
          timeTrackingActive={timeTrackingActive}
          todo={todo}
        />
      </div>
      <TodoEditModal
        onClose={() => state.setShowEditModal(false)}
        show={state.showEditModal}
        todo={todo}
      />
    </div>
  );
};

export const TodoListElement = memo(TodoListElementInner, (prevProps, nextProps) => {
  return (
    prevProps.active === nextProps.active &&
    prevProps.activeDate === nextProps.activeDate &&
    prevProps.activityOnly === nextProps.activityOnly &&
    prevProps.timeTrackingActive === nextProps.timeTrackingActive &&
    prevProps.todo._id === nextProps.todo._id &&
    prevProps.todo._rev === nextProps.todo._rev &&
    prevProps.todo.completed === nextProps.todo.completed &&
    prevProps.todo.title === nextProps.todo.title &&
    JSON.stringify(prevProps.todo.active) === JSON.stringify(nextProps.todo.active) &&
    JSON.stringify(prevProps.todo.tags) === JSON.stringify(nextProps.todo.tags)
  );
});
