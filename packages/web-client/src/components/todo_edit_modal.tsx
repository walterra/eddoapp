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

export const TodoEditModal: FC<TodoEditModalProps> = ({ onClose, show, todo }) => {
  const { allTags } = useTags();
  const saveTodoMutation = useSaveTodoMutation();
  const deleteTodoMutation = useDeleteTodoMutation();

  const [editedTodo, setEditedTodo] = useState(todo);

  useEffect(() => {
    setEditedTodo(todo);
  }, [todo]);

  const handleDelete = async (event: React.FormEvent<HTMLButtonElement>) => {
    event.preventDefault();
    try {
      await deleteTodoMutation.mutateAsync(todo);
      onClose();
    } catch (err) {
      console.error('Failed to delete todo:', err);
    }
  };

  const handleSave = async (event: React.FormEvent<HTMLButtonElement>) => {
    event.preventDefault();
    try {
      await saveTodoMutation.mutateAsync({ todo: editedTodo, originalTodo: todo });
      onClose();
    } catch (err) {
      console.error('Failed to save todo:', err);
    }
  };

  const handleChange = (updater: (todo: Todo) => Todo) => {
    setEditedTodo(updater);
  };

  const activeArray = Object.entries(editedTodo.active);
  const isActiveValid = validateTimeTracking(activeArray);
  const error = (saveTodoMutation.error || deleteTodoMutation.error) as DatabaseError | null;
  const isSaving = saveTodoMutation.isPending;
  const isDeleting = deleteTodoMutation.isPending;

  const clearError = () => {
    saveTodoMutation.reset();
    deleteTodoMutation.reset();
  };

  return (
    <Modal onClose={onClose} show={show} size="2xl">
      <ModalHeader>Edit Todo</ModalHeader>
      <ModalBody>
        {error && <ErrorDisplay error={error} onClear={clearError} />}
        <div className="flex flex-col gap-4">
          <CreationDateDisplay id={editedTodo._id} />
          <ContextField onChange={handleChange} todo={editedTodo} />
          <TitleField onChange={handleChange} todo={editedTodo} />
          <LinkField onChange={handleChange} todo={editedTodo} />
          <ExternalIdField onChange={handleChange} todo={editedTodo} />
          <TagsField allTags={allTags} onChange={handleChange} todo={editedTodo} />
          <DueDateField onChange={handleChange} todo={editedTodo} />
          <RepeatField onChange={handleChange} todo={editedTodo} />
          <CompletedField onChange={handleChange} todo={editedTodo} />
          <TimeTrackingField activeArray={activeArray} onChange={handleChange} todo={editedTodo} />
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex w-full justify-between">
          <div>
            <Button
              color="blue"
              disabled={!isActiveValid || isSaving || isDeleting}
              onClick={handleSave}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
          <div>
            <Button color="red" disabled={isSaving || isDeleting} onClick={handleDelete}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
};

function CreationDateDisplay({ id }: { id: string }) {
  return (
    <div>
      <div className="mb-2 block">
        <Label htmlFor="eddoTodoCreationDate">Creation date</Label>
      </div>
      {id}
    </div>
  );
}
