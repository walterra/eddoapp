/**
 * Parent todo field component for editing parent-child relationships
 */
import { type Todo } from '@eddo/core-client';
import { Label, TextInput } from 'flowbite-react';
import { type FC, useRef, useState } from 'react';
import { BiSearch, BiX } from 'react-icons/bi';

import { useParentTodo } from '../hooks/use_parent_child';
import { TodoPickerPopover } from './todo_picker_popover';

interface ParentIdFieldProps {
  todo: Todo;
  onChange: (updater: (todo: Todo) => Todo) => void;
}

interface ParentActionsProps {
  parentId: string | null | undefined;
  onChange: (value: string) => void;
  onClear: () => void;
  onOpenSearch: () => void;
  searchButtonRef: React.RefObject<HTMLButtonElement | null>;
}

interface ParentInfoProps {
  parentId: string | null | undefined;
  isLoading: boolean;
  parentTitle?: string;
}

const ParentActions: FC<ParentActionsProps> = ({
  parentId,
  onChange,
  onClear,
  onOpenSearch,
  searchButtonRef,
}) => (
  <div className="flex items-center gap-2">
    <TextInput
      aria-label="Parent ID"
      className="flex-1"
      id="eddoTodoParentId"
      onChange={(e) => onChange(e.target.value)}
      placeholder="Parent todo ID (paste from another todo)"
      type="text"
      value={parentId ?? ''}
    />
    <button
      aria-label="Search parent"
      className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
      onClick={onOpenSearch}
      ref={searchButtonRef}
      type="button"
    >
      <BiSearch size="1.2em" />
    </button>
    {parentId && (
      <button
        aria-label="Clear parent"
        className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
        onClick={onClear}
        type="button"
      >
        <BiX size="1.2em" />
      </button>
    )}
  </div>
);

const ParentInfo: FC<ParentInfoProps> = ({ parentId, isLoading, parentTitle }) => {
  if (!parentId) return null;

  return (
    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
      {isLoading ? (
        'Loading...'
      ) : parentTitle ? (
        <span>
          Parent: <span className="font-medium">{parentTitle}</span>
        </span>
      ) : (
        <span className="text-amber-600 dark:text-amber-400">Parent todo not found</span>
      )}
    </div>
  );
};

const normalizeParentId = (value: string): string | null => {
  return value !== '' ? value : null;
};

/**
 * Form field for editing the parent todo relationship
 * Shows the parent todo title when a valid parentId is set
 */
export const ParentIdField: FC<ParentIdFieldProps> = ({ todo, onChange }) => {
  const { data: parentTodo, isLoading } = useParentTodo(todo.parentId);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <div>
      <div className="mb-2 block">
        <Label htmlFor="eddoTodoParentId">Parent Todo</Label>
      </div>
      <ParentActions
        onChange={(value) => onChange((t) => ({ ...t, parentId: normalizeParentId(value) }))}
        onClear={() => onChange((t) => ({ ...t, parentId: null }))}
        onOpenSearch={() => setIsSearchOpen(true)}
        parentId={todo.parentId}
        searchButtonRef={searchButtonRef}
      />
      <ParentInfo isLoading={isLoading} parentId={todo.parentId} parentTitle={parentTodo?.title} />
      <TodoPickerPopover
        anchorRef={searchButtonRef}
        excludeIds={[todo._id]}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={(todoId) => onChange((t) => ({ ...t, parentId: normalizeParentId(todoId) }))}
      />
    </div>
  );
};
