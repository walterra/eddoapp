/**
 * Modal for editing todo items
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import { Button, Label, Modal, ModalBody, ModalFooter, ModalHeader } from 'flowbite-react';
import { type FC, useEffect, useState } from 'react';

import { useTags } from '../hooks/use_tags';
import { useDeleteTodoMutation, useSaveTodoMutation } from '../hooks/use_todo_mutations';
import { ErrorDisplay } from './todo_edit_modal_error';
import {
  CompletedField,
  ContextField,
  DueDateField,
  ExternalIdField,
  LinkField,
  RepeatField,
  TagsField,
  TimeTrackingField,
  TitleField,
  validateTimeTracking,
} from './todo_edit_modal_fields';

interface TodoEditModalProps {
  onClose: () => void;
  show: boolean;
  todo: Todo;
}

const CreationDateDisplay: FC<{ id: string }> = ({ id }) => (
  <div>
    <div className="mb-2 block">
      <Label htmlFor="eddoTodoCreationDate">Creation date</Label>
    </div>
    {id}
  </div>
);

interface EditFormFieldsProps {
  todo: Todo;
  allTags: string[];
  activeArray: Array<[string, string | null]>;
  onChange: (updater: (todo: Todo) => Todo) => void;
}

const EditFormFields: FC<EditFormFieldsProps> = ({ todo, allTags, activeArray, onChange }) => (
  <div className="flex flex-col gap-4">
    <CreationDateDisplay id={todo._id} />
    <ContextField onChange={onChange} todo={todo} />
    <TitleField onChange={onChange} todo={todo} />
    <LinkField onChange={onChange} todo={todo} />
    <ExternalIdField onChange={onChange} todo={todo} />
    <TagsField allTags={allTags} onChange={onChange} todo={todo} />
    <DueDateField onChange={onChange} todo={todo} />
    <RepeatField onChange={onChange} todo={todo} />
    <CompletedField onChange={onChange} todo={todo} />
    <TimeTrackingField activeArray={activeArray} onChange={onChange} todo={todo} />
  </div>
);

interface ModalActionsProps {
  onSave: (e: React.FormEvent<HTMLButtonElement>) => void;
  onDelete: (e: React.FormEvent<HTMLButtonElement>) => void;
  isActiveValid: boolean;
  isSaving: boolean;
  isDeleting: boolean;
}

const ModalActions: FC<ModalActionsProps> = ({
  onSave,
  onDelete,
  isActiveValid,
  isSaving,
  isDeleting,
}) => (
  <div className="flex w-full justify-between">
    <div>
      <Button color="blue" disabled={!isActiveValid || isSaving || isDeleting} onClick={onSave}>
        {isSaving ? 'Saving...' : 'Save'}
      </Button>
    </div>
    <div>
      <Button color="red" disabled={isSaving || isDeleting} onClick={onDelete}>
        {isDeleting ? 'Deleting...' : 'Delete'}
      </Button>
    </div>
  </div>
);

/** Hook for todo edit modal state and handlers */
const useTodoEditState = (todo: Todo, onClose: () => void) => {
  const saveTodoMutation = useSaveTodoMutation();
  const deleteTodoMutation = useDeleteTodoMutation();
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

export const TodoEditModal: FC<TodoEditModalProps> = ({ onClose, show, todo }) => {
  const { allTags } = useTags();
  const state = useTodoEditState(todo, onClose);
  const activeArray = Object.entries(state.editedTodo.active);

  return (
    <Modal onClose={onClose} show={show} size="2xl">
      <ModalHeader>Edit Todo</ModalHeader>
      <ModalBody>
        {state.error && <ErrorDisplay error={state.error} onClear={state.clearError} />}
        <EditFormFields
          activeArray={activeArray}
          allTags={allTags}
          onChange={state.setEditedTodo}
          todo={state.editedTodo}
        />
      </ModalBody>
      <ModalFooter>
        <ModalActions
          isActiveValid={validateTimeTracking(activeArray)}
          isDeleting={state.isDeleting}
          isSaving={state.isSaving}
          onDelete={state.handleDelete}
          onSave={state.handleSave}
        />
      </ModalFooter>
    </Modal>
  );
};
