import { useState, type FC } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';
import { Button, TextInput } from 'flowbite-react';
import { add, format, sub, getISOWeek } from 'date-fns';

import { CONTEXT_DEFAULT } from '../constants';
import { usePouchDb } from '../pouch_db';
import { NewTodo } from '../types/todo';

interface AddTodoProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
}

export const AddTodo: FC<AddTodoProps> = ({ currentDate, setCurrentDate }) => {
  const db = usePouchDb();

  const [todoContext, setTodoContext] = useState(CONTEXT_DEFAULT);
  const [todoDue, setTodoDue] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [todoLink, setTodoLink] = useState('');
  const [todoTitle, setTodoTitle] = useState('');

  const currentCalendarWeek = getISOWeek(currentDate);

  function previousWeekClickHandler() {
    setCurrentDate(sub(currentDate, { weeks: 1 }));
  }

  function nextWeekClickHandler() {
    setCurrentDate(add(currentDate, { weeks: 1 }));
  }

  async function addTodo(
    title: string,
    context: string,
    dueDate: string,
    link: string,
  ) {
    // sanity check if due date is parsable
    const due = `${dueDate}T23:59:59.999Z`;
    try {
      format(new Date(due), 'yyyy-MM-dd');
    } catch (e) {
      console.error('failed to parse due date', due);
      return;
    }

    const _id = new Date().toISOString();
    const todo: NewTodo = {
      _id,
      active: {},
      completed: null,
      context,
      description: '',
      due,
      link: link !== '' ? link : null,
      repeat: null,
      tags: [],
      title,
      version: 'alpha3',
    };

    try {
      await db.put(todo);
    } catch (err) {
      console.error(err);
    }
  }

  function addTodoHandler(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (todoTitle !== '') {
      addTodo(todoTitle, todoContext, todoDue, todoLink);
    }
  }

  return (
    <form onSubmit={addTodoHandler}>
      <div className="block items-center justify-between border-b border-gray-200 bg-white py-4 dark:border-gray-700 dark:bg-gray-800 sm:flex lg:mt-1.5">
        <div className="flex items-center divide-x divide-gray-100 dark:divide-gray-700">
          <div className="pr-3">
            <TextInput
              aria-label="Context"
              onChange={(e) => setTodoContext(e.target.value)}
              placeholder="context"
              type="text"
              value={todoContext}
            />
          </div>
          <div className="pr-3">
            <TextInput
              aria-label="New todo"
              onChange={(e) => setTodoTitle(e.target.value)}
              placeholder="todo"
              type="text"
              value={todoTitle}
            />
          </div>
          <div className="pr-3">
            <TextInput
              aria-label="Link"
              onChange={(e) => setTodoLink(e.target.value)}
              placeholder="url"
              type="text"
              value={todoLink}
            />
          </div>
          <div className="pr-3">
            <TextInput
              aria-label="Due date"
              onChange={(e) => setTodoDue(e.target.value)}
              placeholder="..."
              type="text"
              value={todoDue}
            />
          </div>
          <div className="pr-3">
            <Button type="submit">Add todo</Button>
          </div>
        </div>
        <div className="hidden items-center space-y-3 space-x-0 sm:flex sm:space-y-0 sm:space-x-3">
          <Button className="p-0" onClick={previousWeekClickHandler} size="xs">
            <RiArrowLeftSLine size="2em" />
          </Button>{' '}
          <span className="font-semibold text-gray-900 dark:text-white">
            CW{currentCalendarWeek}
          </span>{' '}
          <Button className="p-0" onClick={nextWeekClickHandler} size="xs">
            <RiArrowRightSLine size="2em" />
          </Button>
        </div>
      </div>
      <div className="flex space-x-4"></div>
    </form>
  );
};
