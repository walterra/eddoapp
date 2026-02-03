import { type DatabaseError, DatabaseErrorType, type NewTodo, type Todo } from '@eddo/core-client';
import { format } from 'date-fns';
import { Button, Textarea, TextInput } from 'flowbite-react';
import { type FC } from 'react';

import { CONTEXT_DEFAULT } from '../constants';
import { TagInput } from './tag_input';

export interface AddTodoFormState {
  context: string;
  description: string;
  due: string;
  link: string;
  parentId: string;
  title: string;
  tags: string[];
}

export interface AddTodoCreateContext {
  parentTodo?: Todo;
}

export const createInitialState = (parentTodo?: Todo): AddTodoFormState => ({
  context: parentTodo?.context ?? CONTEXT_DEFAULT,
  description: '',
  due: new Date().toISOString().split('T')[0],
  link: '',
  parentId: '',
  title: '',
  tags: [],
});

export const validateDueDate = (dueDate: string): DatabaseError | null => {
  const due = `${dueDate}T23:59:59.999Z`;
  try {
    format(new Date(due), 'yyyy-MM-dd');
    return null;
  } catch (_e) {
    return {
      name: 'ValidationError',
      message: 'Invalid date format. Please use YYYY-MM-DD format.',
      type: DatabaseErrorType.OPERATION_FAILED,
      retryable: false,
    } as DatabaseError;
  }
};

export const createTodoFromState = (
  state: AddTodoFormState,
  createContext: AddTodoCreateContext,
): NewTodo => ({
  _id: new Date().toISOString(),
  active: {},
  completed: null,
  context: state.context,
  description: state.description,
  due: `${state.due}T23:59:59.999Z`,
  link: state.link !== '' ? state.link : null,
  parentId: createContext.parentTodo?._id ?? (state.parentId !== '' ? state.parentId : null),
  repeat: null,
  tags: state.tags,
  title: state.title,
  version: 'alpha3',
});

interface AdvancedToggleProps {
  expanded: boolean;
  onToggle: () => void;
}

interface FormFieldsProps {
  state: AddTodoFormState;
  allTags: string[];
  parentTodo?: Todo;
  setState: React.Dispatch<React.SetStateAction<AddTodoFormState>>;
  showAdvanced: boolean;
}

interface FormActionsProps {
  isPending: boolean;
  isDisabled: boolean;
  onClose: () => void;
}

interface BaseFieldsProps {
  state: AddTodoFormState;
  allTags: string[];
  setState: React.Dispatch<React.SetStateAction<AddTodoFormState>>;
}

interface AdvancedFieldsProps {
  state: AddTodoFormState;
  parentTodo?: Todo;
  setState: React.Dispatch<React.SetStateAction<AddTodoFormState>>;
}

export const AdvancedToggle: FC<AdvancedToggleProps> = ({ expanded, onToggle }) => (
  <button
    className="text-xs text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
    onClick={onToggle}
    type="button"
  >
    {expanded ? 'Hide options' : 'More options'}
  </button>
);

const BaseFields: FC<BaseFieldsProps> = ({ state, allTags, setState }) => (
  <>
    <TextInput
      aria-label="Title"
      autoFocus
      onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
      placeholder="What needs to be done?"
      sizing="sm"
      type="text"
      value={state.title}
    />

    <div className="flex gap-2">
      <TextInput
        aria-label="Context"
        className="flex-1"
        onChange={(e) => setState((s) => ({ ...s, context: e.target.value }))}
        placeholder="context"
        sizing="sm"
        type="text"
        value={state.context}
      />
      <TextInput
        aria-label="Due date"
        className="w-28"
        onChange={(e) => setState((s) => ({ ...s, due: e.target.value }))}
        sizing="sm"
        type="text"
        value={state.due}
      />
    </div>

    <TagInput
      onChange={(v) => setState((s) => ({ ...s, tags: v }))}
      placeholder="tags"
      size="sm"
      suggestions={allTags}
      tags={state.tags}
    />
  </>
);

const AdvancedFields: FC<AdvancedFieldsProps> = ({ state, parentTodo, setState }) => (
  <div className="flex flex-col gap-2">
    <Textarea
      aria-label="Description"
      onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
      placeholder="description (optional)"
      rows={3}
      value={state.description}
    />

    {!parentTodo && (
      <TextInput
        aria-label="Parent ID"
        onChange={(e) => setState((s) => ({ ...s, parentId: e.target.value }))}
        placeholder="parent id (optional)"
        sizing="sm"
        type="text"
        value={state.parentId}
      />
    )}

    <TextInput
      aria-label="Link"
      onChange={(e) => setState((s) => ({ ...s, link: e.target.value }))}
      placeholder="url (optional)"
      sizing="sm"
      type="text"
      value={state.link}
    />
  </div>
);

export const FormFields: FC<FormFieldsProps> = ({
  state,
  allTags,
  parentTodo,
  setState,
  showAdvanced,
}) => (
  <>
    <BaseFields allTags={allTags} setState={setState} state={state} />
    {showAdvanced && <AdvancedFields parentTodo={parentTodo} setState={setState} state={state} />}
  </>
);

export const FormActions: FC<FormActionsProps> = ({ isPending, isDisabled, onClose }) => (
  <div className="mt-1 flex justify-end gap-2">
    <Button color="gray" onClick={onClose} size="xs" type="button">
      Cancel
    </Button>
    <Button color="blue" disabled={isDisabled} size="xs" type="submit">
      {isPending ? 'Adding...' : 'Add'}
    </Button>
  </div>
);
