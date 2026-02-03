/**
 * State management hook for the TodoFlyout component
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import { useCallback, useEffect, useState } from 'react';

import {
  useAuditedDeleteTodoMutation,
  useAuditedSaveTodoMutation,
} from './use_audited_todo_mutations';

type FlyoutMode = 'view' | 'edit';

interface TodoFlyoutState {
  mode: FlyoutMode;
  editedTodo: Todo;
  setEditedTodo: React.Dispatch<React.SetStateAction<Todo>>;
  showUnsavedDialog: boolean;
  handleDelete: (e: React.FormEvent<HTMLButtonElement>) => Promise<void>;
  handleSave: (e: React.FormEvent<HTMLButtonElement>) => Promise<void>;
  handleModeToggle: () => void;
  handleClose: () => void;
  handleDiscardChanges: () => void;
  handleKeepEditing: () => void;
  handleCancelEdit: () => void;
  clearError: () => void;
  error: DatabaseError | null;
  isSaving: boolean;
  isDeleting: boolean;
}

/** Checks if todo has been modified */
const hasChanges = (original: Todo, edited: Todo): boolean => {
  return JSON.stringify(original) !== JSON.stringify(edited);
};

interface MutationHandlerDeps {
  saveTodoMutation: ReturnType<typeof useAuditedSaveTodoMutation>;
  deleteTodoMutation: ReturnType<typeof useAuditedDeleteTodoMutation>;
  todo: Todo;
  editedTodo: Todo;
  setMode: React.Dispatch<React.SetStateAction<FlyoutMode>>;
  onClose: () => void;
}

/** Creates mutation handlers (delete and save) */
const useMutationHandlers = (deps: MutationHandlerDeps) => {
  const { deleteTodoMutation, saveTodoMutation, todo, editedTodo, setMode, onClose } = deps;

  const handleDelete = async (e: React.FormEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      await deleteTodoMutation.mutateAsync(todo);
      onClose();
    } catch (err) {
      console.error('Failed to delete todo:', err);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      await saveTodoMutation.mutateAsync({ todo: editedTodo, originalTodo: todo });
      setMode('view');
    } catch (err) {
      console.error('Failed to save todo:', err);
    }
  };

  return { handleDelete, handleSave };
};

interface DialogHandlerDeps {
  mode: FlyoutMode;
  todo: Todo;
  editedTodo: Todo;
  setMode: React.Dispatch<React.SetStateAction<FlyoutMode>>;
  setEditedTodo: React.Dispatch<React.SetStateAction<Todo>>;
  setShowUnsavedDialog: React.Dispatch<React.SetStateAction<boolean>>;
  pendingAction: 'view' | 'close' | null;
  setPendingAction: React.Dispatch<React.SetStateAction<'view' | 'close' | null>>;
  onClose: () => void;
}

/** Creates mode toggle handler */
const useModeToggleHandler = (deps: DialogHandlerDeps) => {
  const { mode, todo, editedTodo, setMode, setEditedTodo, setShowUnsavedDialog, setPendingAction } =
    deps;
  return useCallback(() => {
    if (mode === 'edit' && hasChanges(todo, editedTodo)) {
      setPendingAction('view');
      setShowUnsavedDialog(true);
    } else {
      setMode(mode === 'view' ? 'edit' : 'view');
      if (mode === 'view') setEditedTodo(todo);
    }
  }, [mode, todo, editedTodo, setMode, setEditedTodo, setPendingAction, setShowUnsavedDialog]);
};

/** Creates close and discard handlers */
const useCloseHandlers = (deps: DialogHandlerDeps) => {
  const { mode, todo, editedTodo, setMode, setEditedTodo } = deps;
  const { setShowUnsavedDialog, pendingAction, setPendingAction, onClose } = deps;

  const handleClose = useCallback(() => {
    if (mode === 'edit' && hasChanges(todo, editedTodo)) {
      setPendingAction('close');
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  }, [mode, todo, editedTodo, onClose, setPendingAction, setShowUnsavedDialog]);

  const handleDiscardChanges = useCallback(() => {
    setShowUnsavedDialog(false);
    setEditedTodo(todo);
    if (pendingAction === 'close') onClose();
    else setMode('view');
    setPendingAction(null);
  }, [
    todo,
    pendingAction,
    onClose,
    setEditedTodo,
    setMode,
    setPendingAction,
    setShowUnsavedDialog,
  ]);

  const handleKeepEditing = useCallback(() => {
    setShowUnsavedDialog(false);
    setPendingAction(null);
  }, [setShowUnsavedDialog, setPendingAction]);

  const handleCancelEdit = useCallback(() => {
    if (hasChanges(todo, editedTodo)) {
      setPendingAction('view');
      setShowUnsavedDialog(true);
    } else {
      setEditedTodo(todo);
      setMode('view');
    }
  }, [todo, editedTodo, setEditedTodo, setMode, setPendingAction, setShowUnsavedDialog]);

  return { handleClose, handleDiscardChanges, handleKeepEditing, handleCancelEdit };
};

/** Creates dialog and navigation handlers */
const useDialogHandlers = (deps: DialogHandlerDeps) => {
  const handleModeToggle = useModeToggleHandler(deps);
  const closeHandlers = useCloseHandlers(deps);
  return { handleModeToggle, ...closeHandlers };
};

/** Hook for flyout state initialization */
const useFlyoutStateInit = (todo: Todo, show: boolean, initialMode: FlyoutMode) => {
  const [mode, setMode] = useState<FlyoutMode>(initialMode);
  const [editedTodo, setEditedTodo] = useState(todo);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'view' | 'close' | null>(null);

  useEffect(() => {
    if (!show) return;
    setEditedTodo(todo);
    setMode(initialMode);
    setShowUnsavedDialog(false);
    setPendingAction(null);
  }, [show, todo._id, todo._rev, initialMode]);

  return {
    mode,
    setMode,
    editedTodo,
    setEditedTodo,
    showUnsavedDialog,
    setShowUnsavedDialog,
    pendingAction,
    setPendingAction,
  };
};

/**
 * Hook for todo flyout state and handlers
 * @param todo - The todo being viewed/edited
 * @param show - Whether the flyout is visible
 * @param onClose - Callback when flyout should close
 * @returns State and handlers for the flyout
 */
export const useTodoFlyoutState = (
  todo: Todo,
  show: boolean,
  onClose: () => void,
  initialMode: FlyoutMode = 'view',
): TodoFlyoutState => {
  const saveTodoMutation = useAuditedSaveTodoMutation();
  const deleteTodoMutation = useAuditedDeleteTodoMutation();
  const state = useFlyoutStateInit(todo, show, initialMode);

  const mutationHandlers = useMutationHandlers({
    saveTodoMutation,
    deleteTodoMutation,
    todo,
    editedTodo: state.editedTodo,
    setMode: state.setMode,
    onClose,
  });

  const dialogHandlers = useDialogHandlers({
    mode: state.mode,
    todo,
    editedTodo: state.editedTodo,
    setMode: state.setMode,
    setEditedTodo: state.setEditedTodo,
    setShowUnsavedDialog: state.setShowUnsavedDialog,
    pendingAction: state.pendingAction,
    setPendingAction: state.setPendingAction,
    onClose,
  });

  const clearError = useCallback(() => {
    saveTodoMutation.reset();
    deleteTodoMutation.reset();
  }, [saveTodoMutation, deleteTodoMutation]);

  return {
    mode: state.mode,
    editedTodo: state.editedTodo,
    setEditedTodo: state.setEditedTodo,
    showUnsavedDialog: state.showUnsavedDialog,
    ...mutationHandlers,
    ...dialogHandlers,
    clearError,
    error: (saveTodoMutation.error || deleteTodoMutation.error) as DatabaseError | null,
    isSaving: saveTodoMutation.isPending,
    isDeleting: deleteTodoMutation.isPending,
  };
};
