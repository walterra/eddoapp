import {
  areTodosEqual,
  type DatabaseError,
  getActiveDuration,
  getFormattedDuration,
  type Todo,
} from '@eddo/core-client';
import { Checkbox } from 'flowbite-react';
import { type FC, memo, useMemo, useState } from 'react';
import { BiInfoCircle, BiPauseCircle, BiPlayCircle } from 'react-icons/bi';

import { useActiveTimer } from '../hooks/use_active_timer';
import { useTodoFlyout } from '../hooks/use_todo_flyout';
import {
  useToggleCompletionMutation,
  useToggleTimeTrackingMutation,
} from '../hooks/use_todo_mutations';
import {
  CARD_INTERACTIVE,
  FOCUS_RING,
  ICON_BUTTON,
  TEXT_LINK,
  TRANSITION,
} from '../styles/interactive';
import { FormattedMessage } from './formatted_message';
import { SubtaskIndicator } from './subtask_indicator';
import { TagDisplay } from './tag_display';
import { TodoFlyout } from './todo_flyout';

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
    <div className="border-error-200 bg-error-50 dark:border-error-700 dark:bg-error-900 mb-1 rounded-lg border px-2 py-1 text-xs">
      <span className="text-error-700 dark:text-error-200">Failed to update todo</span>
      <button
        className={`ml-2 ${TRANSITION} text-error-600 hover:text-error-500 rounded-lg ${FOCUS_RING}`}
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
          className={`rounded-lg font-medium ${TEXT_LINK}`}
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

/** Local alias for icon button base styles */
const ICON_BUTTON_BASE = ICON_BUTTON;
/** Local alias for reveal-on-hover behavior */
const ICON_BUTTON_REVEAL_CLASS = 'opacity-0 group-hover:opacity-100 focus:opacity-100';

interface TimeTrackingButtonProps {
  isActive: boolean;
  isUpdating: boolean;
  onClick: (e: React.FormEvent<HTMLButtonElement>) => void;
}

const TimeTrackingButton: FC<TimeTrackingButtonProps> = ({ isActive, isUpdating, onClick }) => (
  <button
    className={`${ICON_BUTTON_BASE} disabled:cursor-not-allowed disabled:opacity-50 ${isActive ? 'opacity-100' : ICON_BUTTON_REVEAL_CLASS}`}
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
            className={`${ICON_BUTTON_BASE} ${ICON_BUTTON_REVEAL_CLASS}`}
            data-testid="view-button"
            onClick={onEditClick}
            type="button"
          >
            <BiInfoCircle size="1.3em" />
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
  const flyout = useTodoFlyout(todo);
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
    showFlyout: flyout.isOpen,
    openFlyout: flyout.open,
    closeFlyout: flyout.close,
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
        <div className="flex items-center gap-2">
          <TitleDisplay activityOnly={activityOnly} todo={todo} />
          {!activityOnly && <SubtaskIndicator todoId={todo._id} />}
        </div>
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
  const activeClass = active ? 'ring-2 ring-sky-600 ' : '';
  const cardClass = `${activeClass}mb-1 flex max-w-md transform flex-col px-3 py-2 ${CARD_INTERACTIVE}`;

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
            state.openFlyout();
          }}
          onTimeTrackingClick={state.handleTimeTrackingClick}
          timeTrackingActive={timeTrackingActive}
          todo={todo}
        />
      </div>
      <TodoFlyout onClose={state.closeFlyout} show={state.showFlyout} todo={todo} />
    </div>
  );
};

export const TodoListElement = memo(TodoListElementInner, (prevProps, nextProps) => {
  return (
    prevProps.active === nextProps.active &&
    prevProps.activeDate === nextProps.activeDate &&
    prevProps.activityOnly === nextProps.activityOnly &&
    prevProps.timeTrackingActive === nextProps.timeTrackingActive &&
    areTodosEqual(prevProps.todo, nextProps.todo)
  );
});
