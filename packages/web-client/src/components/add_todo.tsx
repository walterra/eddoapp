import { type DatabaseError, DatabaseErrorType, type NewTodo } from '@eddo/core-client';
import { format } from 'date-fns';
import { Button, TextInput } from 'flowbite-react';
import { type FC, useState } from 'react';

import { CONTEXT_DEFAULT } from '../constants';
import { useTags } from '../hooks/use_tags';
import { useCreateTodoMutation } from '../hooks/use_todo_mutations';
import { DatabaseErrorMessage } from './database_error_message';
import { TagInput } from './tag_input';

interface AddTodoFormState {
  context: string;
  due: string;
  link: string;
  title: string;
  tags: string[];
}

const createInitialState = (): AddTodoFormState => ({
  context: CONTEXT_DEFAULT,
  due: new Date().toISOString().split('T')[0],
  link: '',
  title: '',
  tags: [],
});

const validateDueDate = (dueDate: string): DatabaseError | null => {
  const due = `${dueDate}T23:59:59.999Z`;
  try {
    format(new Date(due), 'yyyy-MM-dd');
    return null;
  } catch (_e) {
    console.error('failed to parse due date', due);
    return {
      name: 'ValidationError',
      message: 'Invalid date format. Please use YYYY-MM-DD format.',
      type: DatabaseErrorType.OPERATION_FAILED,
      retryable: false,
    } as DatabaseError;
  }
};

const createTodoFromState = (state: AddTodoFormState): NewTodo => ({
  _id: new Date().toISOString(),
  active: {},
  completed: null,
  context: state.context,
  description: '',
  due: `${state.due}T23:59:59.999Z`,
  link: state.link !== '' ? state.link : null,
  repeat: null,
  tags: state.tags,
  title: state.title,
  version: 'alpha3',
});

interface FormFieldsProps {
  state: AddTodoFormState;
  allTags: string[];
  setState: React.Dispatch<React.SetStateAction<AddTodoFormState>>;
}

const FormFields: FC<FormFieldsProps> = ({ state, allTags, setState }) => (
  <>
    <TextInput
      aria-label="Context"
      onChange={(e) => setState((s) => ({ ...s, context: e.target.value }))}
      placeholder="context"
      type="text"
      value={state.context}
    />
    <TextInput
      aria-label="New todo"
      onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
      placeholder="todo"
      type="text"
      value={state.title}
    />
    <TextInput
      aria-label="Link"
      onChange={(e) => setState((s) => ({ ...s, link: e.target.value }))}
      placeholder="url"
      type="text"
      value={state.link}
    />
    <TagInput
      onChange={(v) => setState((s) => ({ ...s, tags: v }))}
      placeholder="tags"
      suggestions={allTags}
      tags={state.tags}
    />
    <TextInput
      aria-label="Due date"
      onChange={(e) => setState((s) => ({ ...s, due: e.target.value }))}
      placeholder="..."
      type="text"
      value={state.due}
    />
  </>
);

interface ErrorDisplayProps {
  error: DatabaseError | null;
  onDismiss: () => void;
}

const ErrorDisplay: FC<ErrorDisplayProps> = ({ error, onDismiss }) =>
  error ? <DatabaseErrorMessage error={error} onDismiss={onDismiss} /> : null;

interface SubmitButtonProps {
  isPending: boolean;
}

const SubmitButton: FC<SubmitButtonProps> = ({ isPending }) => (
  <Button color="blue" disabled={isPending} type="submit">
    {isPending ? 'Adding...' : 'Add todo'}
  </Button>
);

export const AddTodo: FC = () => {
  const { allTags } = useTags();
  const createTodoMutation = useCreateTodoMutation();
  const [state, setState] = useState<AddTodoFormState>(createInitialState);
  const [validationError, setValidationError] = useState<DatabaseError | null>(null);

  const addTodo = async () => {
    const dateError = validateDueDate(state.due);
    if (dateError) {
      setValidationError(dateError);
      return;
    }
    setValidationError(null);
    try {
      await createTodoMutation.mutateAsync(createTodoFromState(state));
      setState(createInitialState());
    } catch (err) {
      console.error('Failed to create todo:', err);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.title !== '') addTodo();
  };

  const error = validationError || (createTodoMutation.error as DatabaseError | null);
  const clearError = () => {
    setValidationError(null);
    createTodoMutation.reset();
  };

  return (
    <form onSubmit={handleSubmit}>
      <ErrorDisplay error={error} onDismiss={clearError} />
      <div className="flex items-center space-x-3 bg-white py-4 lg:mt-1.5 dark:bg-gray-800">
        <FormFields allTags={allTags} setState={setState} state={state} />
        <SubmitButton isPending={createTodoMutation.isPending} />
      </div>
    </form>
  );
};
