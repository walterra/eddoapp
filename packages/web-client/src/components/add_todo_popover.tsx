/**
 * AddTodoPopover - Plus icon button that opens a popover with the add todo form
 */
import { type DatabaseError, DatabaseErrorType, type NewTodo } from '@eddo/core-client';
import { format } from 'date-fns';
import { Button, TextInput } from 'flowbite-react';
import { type FC, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiPlus } from 'react-icons/hi';

import { CONTEXT_DEFAULT } from '../constants';
import { useAuditedCreateTodoMutation } from '../hooks/use_audited_todo_mutations';
import { useFloatingPosition } from '../hooks/use_floating_position';
import { useTags } from '../hooks/use_tags';
import { TRANSITION_FAST } from '../styles/interactive';
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

const POPOVER_STYLES =
  'z-50 w-80 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-600 dark:bg-neutral-800';

/** Hook for popover dismiss behavior (click outside, escape key) */
const usePopoverDismiss = (
  menuRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
): void => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuRef, onClose]);
};

interface FormFieldsProps {
  state: AddTodoFormState;
  allTags: string[];
  setState: React.Dispatch<React.SetStateAction<AddTodoFormState>>;
}

const FormFields: FC<FormFieldsProps> = ({ state, allTags, setState }) => (
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

    <TextInput
      aria-label="Link"
      onChange={(e) => setState((s) => ({ ...s, link: e.target.value }))}
      placeholder="url (optional)"
      sizing="sm"
      type="text"
      value={state.link}
    />

    <TagInput
      onChange={(v) => setState((s) => ({ ...s, tags: v }))}
      placeholder="tags"
      suggestions={allTags}
      tags={state.tags}
    />
  </>
);

interface FormActionsProps {
  isPending: boolean;
  isDisabled: boolean;
  onClose: () => void;
}

const FormActions: FC<FormActionsProps> = ({ isPending, isDisabled, onClose }) => (
  <div className="mt-1 flex justify-end gap-2">
    <Button color="gray" onClick={onClose} size="xs" type="button">
      Cancel
    </Button>
    <Button color="blue" disabled={isDisabled} size="xs" type="submit">
      {isPending ? 'Adding...' : 'Add'}
    </Button>
  </div>
);

interface PopoverFormProps {
  floatingStyles: object;
  setFloatingRef: (node: HTMLDivElement | null) => void;
  onClose: () => void;
  onSuccess: () => void;
}

/** Hook for form submission logic */
function useAddTodoForm(onSuccess: () => void) {
  const createTodoMutation = useAuditedCreateTodoMutation();
  const [state, setState] = useState<AddTodoFormState>(createInitialState);
  const [validationError, setValidationError] = useState<DatabaseError | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.title === '') return;

    const dateError = validateDueDate(state.due);
    if (dateError) {
      setValidationError(dateError);
      return;
    }
    setValidationError(null);

    try {
      await createTodoMutation.mutateAsync(createTodoFromState(state));
      setState(createInitialState());
      onSuccess();
    } catch (err) {
      console.error('Failed to create todo:', err);
    }
  };

  const clearError = () => {
    setValidationError(null);
    createTodoMutation.reset();
  };

  return {
    state,
    setState,
    error: validationError || (createTodoMutation.error as DatabaseError | null),
    isPending: createTodoMutation.isPending,
    handleSubmit,
    clearError,
  };
}

const PopoverForm: FC<PopoverFormProps> = ({
  floatingStyles,
  setFloatingRef,
  onClose,
  onSuccess,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { allTags } = useTags();
  const { state, setState, error, isPending, handleSubmit, clearError } = useAddTodoForm(onSuccess);

  const setRefs = (node: HTMLDivElement | null) => {
    menuRef.current = node;
    setFloatingRef(node);
  };

  usePopoverDismiss(menuRef, onClose);

  return createPortal(
    <div
      className={`${POPOVER_STYLES} ${TRANSITION_FAST}`}
      ref={setRefs}
      style={floatingStyles as React.CSSProperties}
    >
      <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
        <div className="mb-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Add Todo
        </div>
        {error && <DatabaseErrorMessage error={error} onDismiss={clearError} />}
        <FormFields allTags={allTags} setState={setState} state={state} />
        <FormActions
          isDisabled={isPending || state.title === ''}
          isPending={isPending}
          onClose={onClose}
        />
      </form>
    </div>,
    document.body,
  );
};

interface AddTodoTriggerProps {
  onClick: () => void;
  setReferenceRef: (node: HTMLButtonElement | null) => void;
}

const AddTodoTrigger: FC<AddTodoTriggerProps> = ({ onClick, setReferenceRef }) => (
  <button
    aria-label="Add todo (n)"
    className="bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 flex h-8 items-center gap-1.5 rounded-lg px-2 text-white md:px-3"
    onClick={onClick}
    ref={setReferenceRef}
    title="Add todo (n)"
    type="button"
  >
    <HiPlus className="h-4 w-4" />
    <span className="hidden text-sm font-medium md:inline">Add todo</span>
  </button>
);

/** Hook for keyboard shortcut to open popover */
const useKeyboardShortcut = (key: string, onTrigger: () => void): void => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isTyping) return;

      // Ignore if modifier keys are pressed
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key.toLowerCase() === key.toLowerCase()) {
        event.preventDefault();
        onTrigger();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [key, onTrigger]);
};

export const AddTodoPopover: FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { refs, floatingStyles } = useFloatingPosition({
    placement: 'bottom-end',
    open: isOpen,
  });

  useKeyboardShortcut('n', () => setIsOpen(true));

  return (
    <>
      <AddTodoTrigger onClick={() => setIsOpen(true)} setReferenceRef={refs.setReference} />
      {isOpen && (
        <PopoverForm
          floatingStyles={floatingStyles}
          onClose={() => setIsOpen(false)}
          onSuccess={() => setIsOpen(false)}
          setFloatingRef={refs.setFloating}
        />
      )}
    </>
  );
};
