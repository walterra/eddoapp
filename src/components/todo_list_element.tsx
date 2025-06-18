import { Checkbox } from 'flowbite-react';
import { type FC, useEffect, useState } from 'react';
import { BiEdit, BiPauseCircle, BiPlayCircle } from 'react-icons/bi';

import { usePouchDb } from '../pouch_db';
import { type Todo } from '../types/todo';
import { getActiveDuration } from '../utils/get_active_duration';
import { getFormattedDuration } from '../utils/get_formatted_duration';
import { getRepeatTodo } from '../utils/get_repeat_todo';
import { FormattedMessage } from './formatted_message';
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
  const db = usePouchDb();

  const [activeCounter, setActiveCounter] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);

  function toggleCheckbox(todo: Todo) {
    todo.completed = todo.completed === null ? new Date().toISOString() : null;
    db.put(todo);

    // check if we need to create a new todo based on repeat setting
    if (typeof todo.repeat === 'number' && todo.completed) {
      db.put(getRepeatTodo(todo));
    }
  }

  function showEditModalButtonPressed(
    event: React.FormEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    setShowEditModal(true);
  }

  function timeTrackingButtonPressed(
    event: React.FormEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    if (
      Object.keys(todo.active).length === 0 ||
      Object.values(todo.active).every((d) => d !== null)
    ) {
      todo.active[new Date().toISOString()] = null;
    } else {
      const activeEntry = Object.entries(todo.active).find(
        (d) => d[1] === null,
      );
      if (activeEntry) {
        todo.active[activeEntry[0]] = new Date().toISOString();
      }
    }
    db.put(todo);
  }

  const thisButtonTimeTrackingActive = Object.values(todo.active).some(
    (d) => d === null,
  );

  const activeDuration = getActiveDuration(todo.active, activeDate);

  function updateActiveCounter() {
    setTimeout(() => {
      if (active) {
        setActiveCounter((state) => state + 1);
        updateActiveCounter();
      } else {
        setActiveCounter(0);
      }
    }, 1000);
  }

  useEffect(() => {
    if (active) {
      updateActiveCounter();
    }
  }, [active]);

  return (
    <div
      className={`${
        active ? 'border-2 border-sky-600' : ''
      }mb-2 flex max-w-md transform flex-col rounded-lg bg-white px-1 py-1 shadow dark:bg-gray-800`}
    >
      <div className="flex items-center justify-between">
        <div className="text-base text-gray-900 dark:text-white">
          <div className="flex space-x-1">
            <div className="mx-1">
              {!activityOnly && (
                <Checkbox
                  className="checkbox checkbox-xs text-gray-400"
                  color="gray"
                  defaultChecked={todo.completed !== null}
                  // random key to fix updating checkbox after editing
                  key={Math.random()}
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
              {(!timeTrackingActive || active) && (
                <button
                  className="rounded-lg py-0 pl-1 text-sm text-gray-400 hover:bg-gray-100 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-300"
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
