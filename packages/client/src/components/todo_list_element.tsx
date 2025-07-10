import {
  type DatabaseError,
  type Todo,
  getActiveDuration,
  getFormattedDuration,
  getRepeatTodo,
} from '@eddo/shared';
import { Checkbox } from 'flowbite-react';
import { type FC, useMemo, useState } from 'react';
import { BiEdit, BiPauseCircle, BiPlayCircle } from 'react-icons/bi';

import { useActiveTimer } from '../hooks/use_active_timer';
import { usePouchDb } from '../pouch_db';
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

export const TodoListElement: FC<TodoListElementProps> = ({
  active,
  activeDate,
  activityOnly,
  timeTrackingActive,
  todo,
}) => {
  const { safeDb } = usePouchDb();

  const { counter: activeCounter } = useActiveTimer(active);
  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState<DatabaseError | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  async function toggleCheckbox(todo: Todo) {
    if (isUpdating) return;

    setError(null);
    setIsUpdating(true);

    const updatedTodo = {
      ...todo,
      completed: todo.completed === null ? new Date().toISOString() : null,
    };

    try {
      await safeDb.safePut(updatedTodo);

      // check if we need to create a new todo based on repeat setting
      if (typeof updatedTodo.repeat === 'number' && updatedTodo.completed) {
        await safeDb.safePut(getRepeatTodo(updatedTodo));
      }
    } catch (err) {
      console.error('Failed to update todo:', err);
      setError(err as DatabaseError);
    } finally {
      setIsUpdating(false);
    }
  }

  function showEditModalButtonPressed(
    event: React.FormEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    setShowEditModal(true);
  }

  async function timeTrackingButtonPressed(
    event: React.FormEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
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
      const activeEntry = Object.entries(updatedActive).find(
        (d) => d[1] === null,
      );
      if (activeEntry) {
        updatedActive[activeEntry[0]] = new Date().toISOString();
      }
    }

    const updatedTodo = { ...todo, active: updatedActive };

    try {
      await safeDb.safePut(updatedTodo);
    } catch (err) {
      console.error('Failed to update time tracking:', err);
      setError(err as DatabaseError);
    } finally {
      setIsUpdating(false);
    }
  }

  const thisButtonTimeTrackingActive = Object.values(todo.active).some(
    (d) => d === null,
  );

  const activeDuration = useMemo(() => {
    // Force recalculation when activeCounter changes
    const duration = getActiveDuration(todo.active, activeDate);
    return duration;
  }, [active, activeDate, activeCounter]);

  return (
    <div
      className={`${
        active ? 'border-2 border-sky-600' : ''
      }mb-2 flex max-w-md transform flex-col rounded-lg bg-white px-1 py-1 shadow dark:bg-gray-800`}
    >
      {error && (
        <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs dark:border-red-700 dark:bg-red-900">
          <span className="text-red-700 dark:text-red-200">
            Failed to update todo
          </span>
          <button
            className="ml-2 text-red-600 hover:text-red-500"
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="text-base text-gray-900 dark:text-white">
          <div className="flex space-x-1">
            <div className="mx-1">
              {!activityOnly && (
                <Checkbox
                  className="checkbox checkbox-xs text-gray-400"
                  color="gray"
                  defaultChecked={todo.completed !== null}
                  disabled={isUpdating}
                  // stable key based on todo ID and completion state
                  key={`checkbox-${todo._id}-${todo.completed !== null}`}
                  onChange={() => toggleCheckbox(todo)}
                />
              )}
            </div>
            <div>
              <span
                className={[
                  'text-sm',
                  todo.completed || activityOnly ? 'text-gray-400' : '',
                  todo.completed ? 'line-through' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {todo.link !== null && !activityOnly ? (
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
              {todo.tags.length > 0 && (
                <div className="mt-1">
                  <TagDisplay maxTags={3} size="xs" tags={todo.tags} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex space-x-1">
          {activeDuration > 0 && (
            <span
              className="text-xs text-gray-400"
              data-counter={activeCounter}
            >
              {getFormattedDuration(activeDuration)}
            </span>
          )}
          {!activityOnly && (
            <>
              {(!timeTrackingActive || thisButtonTimeTrackingActive) && (
                <button
                  className="rounded-lg py-0 pl-1 text-sm text-gray-400 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-300"
                  disabled={isUpdating}
                  onClick={timeTrackingButtonPressed}
                  type="button"
                >
                  {thisButtonTimeTrackingActive ? (
                    <BiPauseCircle size="1.3em" />
                  ) : (
                    <BiPlayCircle size="1.3em" />
                  )}
                </button>
              )}
              <button
                className="rounded-lg py-0 pr-1 text-sm text-gray-400 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-300"
                onClick={showEditModalButtonPressed}
                type="button"
              >
                <BiEdit size="1.3em" />
              </button>
            </>
          )}
        </div>
      </div>
      <TodoEditModal
        onClose={() => setShowEditModal(false)}
        show={showEditModal}
        todo={todo}
      />
    </div>
  );
};
