import { type DatabaseError, DatabaseErrorType, NewTodo } from '@eddo/core-client';
import { format } from 'date-fns';
import { Button, TextInput } from 'flowbite-react';
import { type FC, useState } from 'react';

import { CONTEXT_DEFAULT } from '../constants';
import { useTags } from '../hooks/use_tags';
import { usePouchDb } from '../pouch_db';
import { DatabaseErrorMessage } from './database_error_message';
import { TagInput } from './tag_input';

export const AddTodo: FC = () => {
  const { safeDb } = usePouchDb();
  const { allTags } = useTags();

  const [todoContext, setTodoContext] = useState(CONTEXT_DEFAULT);
  const [todoDue, setTodoDue] = useState(new Date().toISOString().split('T')[0]);
  const [todoLink, setTodoLink] = useState('');
  const [todoTitle, setTodoTitle] = useState('');
  const [todoTags, setTodoTags] = useState<string[]>([]);
  const [error, setError] = useState<DatabaseError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      {error && <DatabaseErrorMessage error={error} onDismiss={() => setError(null)} />}
      <div className="flex items-center space-x-3 bg-white py-4 lg:mt-1.5 dark:bg-gray-800">
        <TextInput
          aria-label="Context"
          onChange={(e) => setTodoContext(e.target.value)}
          placeholder="context"
          type="text"
          value={todoContext}
        />
        <TextInput
          aria-label="New todo"
          onChange={(e) => setTodoTitle(e.target.value)}
          placeholder="todo"
          type="text"
          value={todoTitle}
        />
        <TextInput
          aria-label="Link"
          onChange={(e) => setTodoLink(e.target.value)}
          placeholder="url"
          type="text"
          value={todoLink}
        />
        <TagInput onChange={setTodoTags} placeholder="tags" suggestions={allTags} tags={todoTags} />
        <TextInput
          aria-label="Due date"
          onChange={(e) => setTodoDue(e.target.value)}
          placeholder="..."
          type="text"
          value={todoDue}
        />
        <Button color="blue" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Adding...' : 'Add todo'}
        </Button>
      </div>
    </form>
  );
};
