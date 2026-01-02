import { type DatabaseError, DatabaseErrorType, type NewTodo } from '@eddo/core-client';
import { format } from 'date-fns';
import { Button, TextInput } from 'flowbite-react';
import { type FC, useState } from 'react';

import { CONTEXT_DEFAULT } from '../constants';
import { useTags } from '../hooks/use_tags';
import { useCreateTodoMutation } from '../hooks/use_todo_mutations';
import { DatabaseErrorMessage } from './database_error_message';
import { TagInput } from './tag_input';

export const AddTodo: FC = () => {
  const { allTags } = useTags();
  const createTodoMutation = useCreateTodoMutation();

  const [todoContext, setTodoContext] = useState(CONTEXT_DEFAULT);
  const [todoDue, setTodoDue] = useState(new Date().toISOString().split('T')[0]);
  const [todoLink, setTodoLink] = useState('');
  const [todoTitle, setTodoTitle] = useState('');
  const [todoTags, setTodoTags] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<DatabaseError | null>(null);

  interface AddTodoParams {
    title: string;
    context: string;
    dueDate: string;
    link: string;
    tags: string[];
  }

  async function addTodo(params: AddTodoParams) {
    const { title, context, dueDate, link, tags } = params;
    // sanity check if due date is parsable
    const due = `${dueDate}T23:59:59.999Z`;
    try {
      format(new Date(due), 'yyyy-MM-dd');
    } catch (_e) {
      console.error('failed to parse due date', due);
      setValidationError({
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

    setValidationError(null);

    try {
      await createTodoMutation.mutateAsync(todo);

      // Reset form on success
      setTodoTitle('');
      setTodoContext(CONTEXT_DEFAULT);
      setTodoLink('');
      setTodoTags([]);
      setTodoDue(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error('Failed to create todo:', err);
      // Error is available via createTodoMutation.error
    }
  }

  function addTodoHandler(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (todoTitle !== '') {
      addTodo({
        title: todoTitle,
        context: todoContext,
        dueDate: todoDue,
        link: todoLink,
        tags: todoTags,
      });
    }
  }

  const error = validationError || (createTodoMutation.error as DatabaseError | null);
  const isSubmitting = createTodoMutation.isPending;

  return (
    <form onSubmit={addTodoHandler}>
      {error && (
        <DatabaseErrorMessage
          error={error}
          onDismiss={() => {
            setValidationError(null);
            createTodoMutation.reset();
          }}
        />
      )}
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
