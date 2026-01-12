/**
 * BlockedBy field component for editing task dependencies
 */
import { type Todo } from '@eddo/core-client';
import { Label, TextInput } from 'flowbite-react';
import { type FC, useState } from 'react';
import { BiPlus, BiX } from 'react-icons/bi';

import { useTodoById } from '../hooks/use_parent_child';

interface BlockedByFieldProps {
  todo: Todo;
  onChange: (updater: (todo: Todo) => Todo) => void;
}

interface BlockerItemProps {
  blockerId: string;
  onRemove: () => void;
}

/** Displays a single blocker with its title and remove button */
const BlockerItem: FC<BlockerItemProps> = ({ blockerId, onRemove }) => {
  const { data: blockerTodo, isLoading } = useTodoById(blockerId);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-900/50">
      <div className="min-w-0 flex-1">
        {isLoading ? (
          <span className="text-sm text-neutral-500">Loading...</span>
        ) : blockerTodo ? (
          <div>
            <span className="text-sm text-neutral-900 dark:text-white">{blockerTodo.title}</span>
            {blockerTodo.completed && (
              <span className="ml-2 text-xs text-green-600 dark:text-green-400">✓ completed</span>
            )}
          </div>
        ) : (
          <span className="text-sm text-amber-600 dark:text-amber-400">Todo not found</span>
        )}
        <div className="truncate font-mono text-xs text-neutral-400 dark:text-neutral-500">
          {blockerId}
        </div>
      </div>
      <button
        aria-label="Remove blocker"
        className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
        onClick={onRemove}
        type="button"
      >
        <BiX size="1.2em" />
      </button>
    </div>
  );
};

/** Hook for blockedBy field state management */
function useBlockedByState(todo: Todo, onChange: (updater: (todo: Todo) => Todo) => void) {
  const [newBlockerId, setNewBlockerId] = useState('');
  const blockedBy = todo.blockedBy ?? [];

  const handleAdd = () => {
    const trimmed = newBlockerId.trim();
    if (!trimmed || blockedBy.includes(trimmed)) return;
    onChange((t) => ({ ...t, blockedBy: [...(t.blockedBy ?? []), trimmed] }));
    setNewBlockerId('');
  };

  const handleRemove = (blockerId: string) => {
    onChange((t) => ({
      ...t,
      blockedBy: (t.blockedBy ?? []).filter((id) => id !== blockerId),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return { newBlockerId, setNewBlockerId, blockedBy, handleAdd, handleRemove, handleKeyDown };
}

/**
 * Form field for editing blockedBy relationships.
 * Allows adding/removing todo IDs that block this task.
 */
export const BlockedByField: FC<BlockedByFieldProps> = ({ todo, onChange }) => {
  const state = useBlockedByState(todo, onChange);

  return (
    <div>
      <div className="mb-2 block">
        <Label htmlFor="eddoTodoBlockedBy">Blocked By</Label>
      </div>

      {state.blockedBy.length > 0 && (
        <div className="mb-2 space-y-2">
          {state.blockedBy.map((blockerId) => (
            <BlockerItem
              blockerId={blockerId}
              key={blockerId}
              onRemove={() => state.handleRemove(blockerId)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <TextInput
          aria-label="Add blocker ID"
          className="flex-1"
          id="eddoTodoBlockedBy"
          onChange={(e) => state.setNewBlockerId(e.target.value)}
          onKeyDown={state.handleKeyDown}
          placeholder="Paste todo ID that blocks this task"
          type="text"
          value={state.newBlockerId}
        />
        <button
          aria-label="Add blocker"
          className="rounded-lg bg-neutral-100 p-2 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-800 dark:bg-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-600 dark:hover:text-neutral-200"
          disabled={!state.newBlockerId.trim()}
          onClick={state.handleAdd}
          type="button"
        >
          <BiPlus size="1.2em" />
        </button>
      </div>

      {state.blockedBy.length === 0 && (
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Add todo IDs that must complete before this task becomes actionable.
        </p>
      )}
    </div>
  );
};
