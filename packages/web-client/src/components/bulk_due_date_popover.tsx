/**
 * BulkDueDatePopover component for bulk due date actions on multiple todos
 */
import type { Todo } from '@eddo/core-client';
import { type FC, useRef, useState } from 'react';

import { useBulkTodoMutation } from '../hooks/use_bulk_todo_mutation';
import { getQuickActions } from './due_date_popover';
import { formatDueDate, PopoverMenu, type PopoverPosition } from './due_date_popover_shared';

interface BulkDueDatePopoverProps {
  todos: readonly Todo[];
  children: React.ReactNode;
}

/** Filter to only incomplete todos */
const getIncompleteTodos = (todos: readonly Todo[]): Todo[] =>
  todos.filter((todo) => todo.completed === null);

/** Get button title based on incomplete todo count */
const getButtonTitle = (count: number): string =>
  count > 0
    ? `Change due date for ${count} incomplete todo${count !== 1 ? 's' : ''}`
    : 'No incomplete todos to update';

/** Get button class based on whether there are incomplete todos */
const getButtonClass = (hasIncompleteTodos: boolean): string =>
  `cursor-pointer rounded px-1 py-0.5 ${
    hasIncompleteTodos
      ? 'hover:bg-primary-100 hover:text-primary-700 dark:hover:bg-primary-900 dark:hover:text-primary-300'
      : 'cursor-default opacity-50'
  }`;

const BulkUpdateHeader: FC<{ count: number }> = ({ count }) => (
  <div className="mb-1 border-b border-neutral-200 px-2 pb-1 text-xs text-neutral-500 dark:border-neutral-600 dark:text-neutral-400">
    Update {count} todo{count !== 1 ? 's' : ''}
  </div>
);

/**
 * Popover for bulk updating due dates on multiple todos.
 * Only applies to incomplete (not completed) todos.
 */
export const BulkDueDatePopover: FC<BulkDueDatePopoverProps> = ({ todos, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bulkUpdateTodo = useBulkTodoMutation();

  const incompleteTodos = getIncompleteTodos(todos);
  const hasIncompleteTodos = incompleteTodos.length > 0;

  const handleSelect = async (date: Date) => {
    setIsOpen(false);
    if (!hasIncompleteTodos) return;
    const newDue = formatDueDate(date);
    const todosToUpdate = incompleteTodos
      .filter((todo) => todo.due !== newDue)
      .map((todo) => ({ ...todo, due: newDue }));
    if (todosToUpdate.length > 0) await bulkUpdateTodo.mutateAsync(todosToUpdate);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasIncompleteTodos) return;
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: rect.left });
    }
    setIsOpen(!isOpen);
  };

  return (
    <>
      <button
        className={getButtonClass(hasIncompleteTodos)}
        disabled={!hasIncompleteTodos}
        onClick={handleToggle}
        ref={buttonRef}
        title={getButtonTitle(incompleteTodos.length)}
        type="button"
      >
        {children}
      </button>
      {isOpen && (
        <PopoverMenu
          actions={getQuickActions()}
          header={<BulkUpdateHeader count={incompleteTodos.length} />}
          onClose={() => setIsOpen(false)}
          onSelect={handleSelect}
          position={position}
        />
      )}
    </>
  );
};
