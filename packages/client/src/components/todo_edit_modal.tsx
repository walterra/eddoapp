import {
  type DatabaseError,
  DatabaseErrorType,
  type Todo,
  getActiveDuration,
  getFormattedDuration,
  getRepeatTodo,
} from '@eddo/shared';
import { Button, Checkbox, Label, Modal, TextInput } from 'flowbite-react';
import React, { type FC, useEffect, useState } from 'react';

import { useTags } from '../hooks/use_tags';
import { usePouchDb } from '../pouch_db';
import { TagInput } from './tag_input';

interface TodoEditModalProps {
  onClose: () => void;
  show: boolean;
  todo: Todo;
}

export const TodoEditModal: FC<TodoEditModalProps> = ({
  onClose,
  show,
  todo,
}) => {
  const { safeDb } = usePouchDb();
  const { allTags } = useTags();

  const [editedTodo, setEditedTodo] = useState(todo);
  const [error, setError] = useState<DatabaseError | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditedTodo(todo);
  }, [todo]);

  async function deleteButtonPressed(
    event: React.FormEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    setError(null);
    setIsDeleting(true);

    try {
      await safeDb.safeRemove(todo);
      onClose();
    } catch (err) {
      console.error('Failed to delete todo:', err);
      setError(err as DatabaseError);
    } finally {
      setIsDeleting(false);
    }
  }

  async function editSaveButtonPressed(
    event: React.FormEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      await safeDb.safePut(editedTodo);

      if (
        typeof editedTodo.repeat === 'number' &&
        editedTodo.completed &&
        todo.completed !== editedTodo.completed
      ) {
        await safeDb.safePut(getRepeatTodo(editedTodo));
      }
      onClose();
    } catch (err) {
      console.error('Failed to save todo:', err);
      setError(err as DatabaseError);
    } finally {
      setIsSaving(false);
    }
  }

  const activeArray = Object.entries(editedTodo.active);

  const isActiveValid = activeArray.reduce((valid, [from, to]) => {
    try {
      getFormattedDuration(getActiveDuration({ [from]: to }));
      return valid;
    } catch (_e) {
      return false;
    }
  }, true);

  return (
    <Modal onClose={onClose} show={show}>
      <Modal.Header>Edit Todo</Modal.Header>
      <Modal.Body>
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 dark:border-red-700 dark:bg-red-900">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm text-red-700 dark:text-red-200">
                  {error.type === DatabaseErrorType.SYNC_CONFLICT
                    ? 'This todo was modified by another device. Please close and try again.'
                    : error.message}
                </p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  className="inline-flex text-red-400 hover:text-red-500"
                  onClick={() => setError(null)}
                  type="button"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M6 18L18 6M6 6l12 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        <form className="flex flex-col gap-4">
          <div>
            <div className="mb-2 block">
              <Label htmlFor="eddoTodoCreationDate" value="Creation date" />
            </div>
            {editedTodo._id}
          </div>
          <div>
            <div className="mb-2 block">
              <Label htmlFor="eddoTodoContext" value="Context" />
            </div>
            <TextInput
              aria-label="Context"
              id="eddoTodoContext"
              onChange={(e) =>
                setEditedTodo((editedTodo) => ({
                  ...editedTodo,
                  context: e.target.value,
                }))
              }
              placeholder="context"
              type="text"
              value={editedTodo.context}
            />
          </div>
          <div>
            <div className="mb-2 block">
              <Label htmlFor="eddoTodoTitle" value="Todo" />
            </div>
            <TextInput
              aria-label="Todo"
              id="eddoTodoTitle"
              onChange={(e) =>
                setEditedTodo((editedTodo) => ({
                  ...editedTodo,
                  title: e.target.value,
                }))
              }
              placeholder="todo"
              type="text"
              value={editedTodo.title}
            />
          </div>
          <div>
            <div className="mb-2 block">
              <Label htmlFor="eddoTodoLink" value="Link" />
            </div>
            <TextInput
              aria-label="Link"
              id="eddoTodoLink"
              onChange={(e) =>
                setEditedTodo((editedTodo) => ({
                  ...editedTodo,
                  link: e.target.value !== '' ? e.target.value : null,
                }))
              }
              placeholder="url"
              type="text"
              value={editedTodo.link ?? ''}
            />
          </div>
          <div>
            <div className="mb-2 block">
              <Label htmlFor="eddoTodoTags" value="Tags" />
            </div>
            <TagInput
              onChange={(tags) =>
                setEditedTodo((editedTodo) => ({
                  ...editedTodo,
                  tags,
                }))
              }
              placeholder="Add tags..."
              suggestions={allTags}
              tags={editedTodo.tags}
            />
          </div>
          <div>
            <div className="-mx-3 mb-2 flex flex-wrap items-end">
              <div className="mb-6 grow px-3 md:mb-0">
                <div className="mb-2 block">
                  <Label htmlFor="eddoTodoDue" value="Due date" />
                </div>
                <TextInput
                  aria-label="Due date"
                  id="eddoTodoDue"
                  onChange={(e) =>
                    setEditedTodo((editedTodo) => ({
                      ...editedTodo,
                      due: e.target.value,
                    }))
                  }
                  placeholder="todo"
                  type="text"
                  value={editedTodo.due}
                />
              </div>
              <div className="mb-6 flex-none px-3 md:mb-0">
                <Button
                  color="gray"
                  onClick={() =>
                    setEditedTodo((editedTodo) => ({
                      ...editedTodo,
                      due: `${new Date().toISOString().split('T')[0]}T${
                        editedTodo.due.split('T')[1]
                      }`,
                    }))
                  }
                >
                  Set to today
                </Button>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-2 block">
              <Label htmlFor="eddoTodoRepeat" value="Repeat in X days" />
            </div>
            <TextInput
              aria-label="Repeat"
              id="eddoTodoRepeat"
              onChange={(e) =>
                setEditedTodo((editedTodo) => ({
                  ...editedTodo,
                  repeat:
                    e.target.value !== '' ? parseInt(e.target.value, 10) : null,
                }))
              }
              placeholder="days"
              type="text"
              value={editedTodo.repeat ?? ''}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              className="checkbox checkbox-xs text-gray-400"
              color="gray"
              defaultChecked={editedTodo.completed !== null}
              id="eddoTodoComplete"
              // stable key based on todo ID and completion state
              key={`edit-checkbox-${editedTodo._id}-${editedTodo.completed !== null}`}
              onChange={() =>
                setEditedTodo((editedTodo) => ({
                  ...editedTodo,
                  completed:
                    editedTodo.completed === null
                      ? new Date().toISOString()
                      : null,
                }))
              }
            />
            <Label htmlFor="eddoTodoComplete">Completed</Label>
          </div>
          <div>
            <div className="mb-2 block">
              <Label htmlFor="" value="Time tracking" />
            </div>
            {activeArray.map(([from, to], index) => (
              <div className="-mx-3 mb-2 flex flex-wrap items-end" key={index}>
                <div className="mb-6 grow px-3 md:mb-0">
                  <TextInput
                    aria-label="From"
                    id={`eddoTodoFrom-${index}`}
                    onChange={(e) => {
                      activeArray[index] = [e.target.value, to];
                      setEditedTodo((editedTodo) => ({
                        ...editedTodo,
                        active: Object.fromEntries(activeArray),
                      }));
                    }}
                    placeholder="from"
                    type="text"
                    value={from ?? ''}
                  />
                </div>
                <div className="mb-6 grow px-3 md:mb-0">
                  <TextInput
                    aria-label="To"
                    id={`eddoTodoTo-${index}`}
                    onChange={(e) => {
                      activeArray[index] = [from, e.target.value];
                      setEditedTodo((editedTodo) => ({
                        ...editedTodo,
                        active: Object.fromEntries(activeArray),
                      }));
                    }}
                    placeholder="to"
                    type="text"
                    value={to ?? ''}
                  />
                </div>
                <div className="mb-6 grow px-3 md:mb-0">
                  {(function () {
                    try {
                      return getFormattedDuration(
                        getActiveDuration({ [from]: to }),
                      );
                    } catch (_e) {
                      return 'n/a';
                    }
                  })()}
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex w-full justify-between">
          <div>
            <Button
              disabled={!isActiveValid || isSaving || isDeleting}
              onClick={editSaveButtonPressed}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
          <div>
            <Button
              color="failure"
              disabled={isSaving || isDeleting}
              onClick={deleteButtonPressed}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};
