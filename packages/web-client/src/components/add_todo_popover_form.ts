import { type DatabaseError, type NewTodo } from '@eddo/core-client';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';

import { useAuditedCreateTodoMutation } from '../hooks/use_audited_todo_mutations';
import {
  type AddTodoCreateContext,
  type AddTodoFormState,
  createInitialState,
  createTodoFromState,
  validateDueDate,
} from './add_todo_popover_fields';

interface SubmitHandlerOptions {
  createContext: AddTodoCreateContext;
  createTodo: (todo: NewTodo) => Promise<void>;
  onSuccess: () => void;
  resetState: () => void;
  setValidationError: Dispatch<SetStateAction<DatabaseError | null>>;
  state: AddTodoFormState;
}

interface AddTodoFormStateResult {
  clearError: () => void;
  error: DatabaseError | null;
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isPending: boolean;
  setState: Dispatch<SetStateAction<AddTodoFormState>>;
  state: AddTodoFormState;
}

export const usePopoverDismiss = (
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

const shouldSubmit = (state: AddTodoFormState): boolean => {
  return state.title !== '';
};

const createSubmitHandler = ({
  createContext,
  createTodo,
  onSuccess,
  resetState,
  setValidationError,
  state,
}: SubmitHandlerOptions): ((event: React.FormEvent<HTMLFormElement>) => Promise<void>) => {
  return async (event) => {
    event.preventDefault();
    if (!shouldSubmit(state)) return;

    const dateError = validateDueDate(state.due);
    if (dateError) {
      setValidationError(dateError);
      return;
    }
    setValidationError(null);

    try {
      await createTodo(createTodoFromState(state, createContext));
      resetState();
      onSuccess();
    } catch (err) {
      console.error('Failed to create todo:', err);
    }
  };
};

export const useAddTodoForm = (
  onSuccess: () => void,
  createContext: AddTodoCreateContext,
): AddTodoFormStateResult => {
  const createTodoMutation = useAuditedCreateTodoMutation();
  const [state, setState] = useState<AddTodoFormState>(
    createInitialState(createContext.parentTodo),
  );
  const [validationError, setValidationError] = useState<DatabaseError | null>(null);

  const resetState = () => setState(createInitialState(createContext.parentTodo));

  const handleSubmit = createSubmitHandler({
    createContext,
    createTodo: createTodoMutation.mutateAsync,
    onSuccess,
    resetState,
    setValidationError,
    state,
  });

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
};
