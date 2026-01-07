/**
 * Parent todo field component for editing parent-child relationships
 */
import { type Todo } from '@eddo/core-client';
import { Label, TextInput } from 'flowbite-react';
import { type FC } from 'react';
import { BiX } from 'react-icons/bi';

import { useParentTodo } from '../hooks/use_parent_child';

interface ParentIdFieldProps {
  todo: Todo;
  onChange: (updater: (todo: Todo) => Todo) => void;
}

/**
 * Form field for editing the parent todo relationship
 * Shows the parent todo title when a valid parentId is set
 */
export const ParentIdField: FC<ParentIdFieldProps> = ({ todo, onChange }) => {
  const { data: parentTodo, isLoading } = useParentTodo(todo.parentId);

  const handleClear = () => {
    onChange((t) => ({ ...t, parentId: null }));
  };

  return (
    <div>
      <div className="mb-2 block">
        <Label htmlFor="eddoTodoParentId">Parent Todo</Label>
      </div>
      <div className="flex items-center gap-2">
        <TextInput
          aria-label="Parent ID"
          className="flex-1"
          id="eddoTodoParentId"
          onChange={(e) =>
            onChange((t) => ({ ...t, parentId: e.target.value !== '' ? e.target.value : null }))
          }
          placeholder="Parent todo ID (paste from another todo)"
          type="text"
          value={todo.parentId ?? ''}
        />
        {todo.parentId && (
          <button
            aria-label="Clear parent"
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
            onClick={handleClear}
            type="button"
          >
            <BiX size="1.2em" />
          </button>
        )}
      </div>
      {todo.parentId && (
        <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {isLoading ? (
            'Loading...'
          ) : parentTodo ? (
            <span>
              Parent: <span className="font-medium">{parentTodo.title}</span>
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">Parent todo not found</span>
          )}
        </div>
      )}
    </div>
  );
};
