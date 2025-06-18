import { usePouchDb } from '../pouch_db';
import { type Todo } from '../types/todo';
import { getActiveDuration } from '../utils/get_active_duration';
import { getFormattedDuration } from '../utils/get_formatted_duration';
import { getRepeatTodo } from '../utils/get_repeat_todo';
import { Button, Checkbox, Label, Modal, TextInput } from 'flowbite-react';
import { useEffect, useState, type FC } from 'react';

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
  const db = usePouchDb();

  const [editedTodo, setEditedTodo] = useState(todo);

  useEffect(() => {
    setEditedTodo(todo);
  }, [todo]);

  function deleteButtonPressed(event: React.FormEvent<HTMLButtonElement>) {
    event.preventDefault();
    db.remove(todo);
  }

  function editSaveButtonPressed(event: React.FormEvent<HTMLButtonElement>) {
    event.preventDefault();
    db.put(editedTodo);

    if (
      typeof editedTodo.repeat === 'number' &&
      editedTodo.completed &&
      todo.completed !== editedTodo.completed
    ) {
      db.put(getRepeatTodo(editedTodo));
    }
    onClose();
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
              // random key to fix updating checkbox after editing
              key={Math.random()}
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
            <Button disabled={!isActiveValid} onClick={editSaveButtonPressed}>
              Save
            </Button>
          </div>
          <div>
            <Button color="failure" onClick={deleteButtonPressed}>
              Delete
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};
