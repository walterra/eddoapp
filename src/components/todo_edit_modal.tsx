import { useEffect, useState, type FC } from 'react';
import { Button, Checkbox, Label, Modal, TextInput } from 'flowbite-react';

import { usePouchDb } from '../pouch_db';
import { type Todo } from '../types/todo';

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
    onClose();
  }

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
        </form>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex w-full justify-between">
          <div>
            <Button onClick={editSaveButtonPressed}>Save</Button>
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
