import { type DatabaseError, DatabaseErrorType, NewTodo } from '@eddo/shared';
import { add, format, getISOWeek, sub } from 'date-fns';
import { Button, TextInput } from 'flowbite-react';
import React, { type FC, useState } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';

import { CONTEXT_DEFAULT } from '../constants';
import { useTags } from '../hooks/use_tags';
import { usePouchDb } from '../pouch_db';
import { DatabaseErrorMessage } from './database_error_message';
import { TagFilter } from './tag_filter';
import { TagInput } from './tag_input';

interface AddTodoProps {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
}

export const AddTodo: FC<AddTodoProps> = ({
  currentDate,
  setCurrentDate,
  selectedTags,
  setSelectedTags,
}) => {
  const { safeDb } = usePouchDb();
  const { allTags } = useTags();

  const [todoContext, setTodoContext] = useState(CONTEXT_DEFAULT);
  const [todoDue, setTodoDue] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [todoLink, setTodoLink] = useState('');
  const [todoTitle, setTodoTitle] = useState('');
  const [todoTags, setTodoTags] = useState<string[]>([]);
  const [error, setError] = useState<DatabaseError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    tags: string[],
  ) {
    // sanity check if due date is parsable
    const due = `${dueDate}T23:59:59.999Z`;
    try {
      format(new Date(due), 'yyyy-MM-dd');
    } catch (_e) {
      console.error('failed to parse due date', due);
      setError({
        name: 'ValidationError',
        message: 'Invalid date format. Please use YYYY-MM-DD format.',
        type: DatabaseErrorType.OPERATION_FAILED,
        retryable: false,
      } as DatabaseError);
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
      tags,
      title,
      version: 'alpha3',
    };

    setError(null);
    setIsSubmitting(true);

    try {
      await safeDb.safePut(todo);

      // Reset form on success
      setTodoTitle('');
      setTodoContext(CONTEXT_DEFAULT);
      setTodoLink('');
      setTodoTags([]);
      setTodoDue(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error('Failed to create todo:', err);
      setError(err as DatabaseError);
    } finally {
      setIsSubmitting(false);
    }
  }

  function addTodoHandler(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (todoTitle !== '') {
      addTodo(todoTitle, todoContext, todoDue, todoLink, todoTags);
    }
  }

  return (
    <form onSubmit={addTodoHandler}>
      {error && (
        <DatabaseErrorMessage error={error} onDismiss={() => setError(null)} />
      )}
      <div className="block items-center justify-between border-b border-gray-200 bg-white py-4 sm:flex lg:mt-1.5 dark:border-gray-700 dark:bg-gray-800">
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
            <TagInput
              onChange={setTodoTags}
              placeholder="tags"
              suggestions={allTags}
              tags={todoTags}
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
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Adding...' : 'Add todo'}
            </Button>
          </div>
        </div>
        <div className="hidden items-center space-x-0 space-y-3 sm:flex sm:space-x-3 sm:space-y-0">
          <TagFilter
            availableTags={allTags}
            onTagsChange={setSelectedTags}
            selectedTags={selectedTags}
          />
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
