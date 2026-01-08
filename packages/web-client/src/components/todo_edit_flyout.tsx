/**
 * Flyout panel for editing todo items
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import { Button, Drawer, DrawerHeader, DrawerItems, Label } from 'flowbite-react';
import { type FC, useEffect, useState } from 'react';

import {
  useAuditedDeleteTodoMutation,
  useAuditedSaveTodoMutation,
} from '../hooks/use_audited_todo_mutations';
import { useTags } from '../hooks/use_tags';
import { ErrorDisplay } from './todo_edit_error';
import {
  CompletedField,
  ContextField,
  DescriptionField,
  DueDateField,
  ExternalIdField,
  LinkField,
  RepeatField,
  TagsField,
  TimeTrackingField,
  TitleField,
  validateTimeTracking,
} from './todo_edit_fields';

interface TodoEditFlyoutProps {
  onClose: () => void;
  show: boolean;
  todo: Todo;
}

const CreationDateDisplay: FC<{ id: string }> = ({ id }) => (
  <div>
    <div className="mb-2 block">
      <Label htmlFor="eddoTodoCreationDate">Creation date</Label>
    </div>
    <span className="text-sm text-neutral-600 dark:text-neutral-400">{id}</span>
  </div>
);

interface EditFormFieldsProps {
  todo: Todo;
  allTags: string[];
  activeArray: Array<[string, string | null]>;
  onChange: (updater: (todo: Todo) => Todo) => void;
}

const EditFormFields: FC<EditFormFieldsProps> = ({ todo, allTags, activeArray, onChange }) => (
  <div className="flex flex-col gap-6">
    <TitleField onChange={onChange} todo={todo} />
    <DescriptionField onChange={onChange} todo={todo} />
    <ContextField onChange={onChange} todo={todo} />
    <TagsField allTags={allTags} onChange={onChange} todo={todo} />
    <DueDateField onChange={onChange} todo={todo} />
    <LinkField onChange={onChange} todo={todo} />
    <ExternalIdField onChange={onChange} todo={todo} />
    <RepeatField onChange={onChange} todo={todo} />
    <CompletedField onChange={onChange} todo={todo} />
    <TimeTrackingField activeArray={activeArray} onChange={onChange} todo={todo} />
    <CreationDateDisplay id={todo._id} />
  </div>
);

interface FlyoutActionsProps {
  onSave: (e: React.FormEvent<HTMLButtonElement>) => void;
  onDelete: (e: React.FormEvent<HTMLButtonElement>) => void;
  isActiveValid: boolean;
  isSaving: boolean;
  isDeleting: boolean;
}

const FlyoutActions: FC<FlyoutActionsProps> = ({
  onSave,
  onDelete,
  isActiveValid,
  isSaving,
  isDeleting,
}) => (
  <div className="flex w-full justify-between border-t border-neutral-200 bg-white px-4 py-4 dark:border-neutral-700 dark:bg-neutral-800">
    <Button color="blue" disabled={!isActiveValid || isSaving || isDeleting} onClick={onSave}>
      {isSaving ? 'Saving...' : 'Save'}
    </Button>
    <Button color="red" disabled={isSaving || isDeleting} onClick={onDelete}>
      {isDeleting ? 'Deleting...' : 'Delete'}
    </Button>
  </div>
);

/** Hook for todo edit flyout state and handlers */
const useTodoEditState = (todo: Todo, onClose: () => void) => {
  const saveTodoMutation = useAuditedSaveTodoMutation();
  const deleteTodoMutation = useAuditedDeleteTodoMutation();
  const [editedTodo, setEditedTodo] = useState(todo);
  useEffect(() => setEditedTodo(todo), [todo]);

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
      onClose();
    } catch (err) {
      console.error('Failed to save todo:', err);
    }
  };

  const clearError = () => {
    saveTodoMutation.reset();
    deleteTodoMutation.reset();
  };
  const error = (saveTodoMutation.error || deleteTodoMutation.error) as DatabaseError | null;

  return {
    editedTodo,
    setEditedTodo,
    handleDelete,
    handleSave,
    clearError,
    error,
    isSaving: saveTodoMutation.isPending,
    isDeleting: deleteTodoMutation.isPending,
  };
};

export const TodoEditFlyout: FC<TodoEditFlyoutProps> = ({ onClose, show, todo }) => {
  const { allTags } = useTags();
  const state = useTodoEditState(todo, onClose);
  const activeArray = Object.entries(state.editedTodo.active);

  if (!show) {
    return null;
  }

  return (
    <Drawer className="!w-[640px]" onClose={onClose} open={show} position="right">
      <DrawerHeader title="Edit Todo" titleIcon={() => null} />
      <DrawerItems>
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            {state.error && <ErrorDisplay error={state.error} onClear={state.clearError} />}
            <EditFormFields
              activeArray={activeArray}
              allTags={allTags}
              onChange={state.setEditedTodo}
              todo={state.editedTodo}
            />
          </div>
          <FlyoutActions
            isActiveValid={validateTimeTracking(activeArray)}
            isDeleting={state.isDeleting}
            isSaving={state.isSaving}
            onDelete={state.handleDelete}
            onSave={state.handleSave}
          />
        </div>
      </DrawerItems>
    </Drawer>
  );
};
