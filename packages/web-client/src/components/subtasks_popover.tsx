/**
 * SubtasksPopover component for displaying child todos in a popover.
 * Uses pre-computed subtask counts to avoid N+1 queries.
 * Only fetches full children data when popover is opened.
 */
import type { Todo } from '@eddo/core-client';
import { type FC, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BiGitBranch } from 'react-icons/bi';
import { MdCheckBox, MdCheckBoxOutlineBlank } from 'react-icons/md';

import { useFloatingPosition } from '../hooks/use_floating_position';
import { type SubtaskCount, useChildTodos } from '../hooks/use_parent_child';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { TRANSITION_FAST } from '../styles/interactive';

interface SubtasksPopoverProps {
  todoId: string;
  /** Pre-computed subtask count (avoids N+1 queries) */
  subtaskCount?: SubtaskCount;
}

const POPOVER_STYLES =
  'z-50 min-w-64 max-w-md rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-600 dark:bg-neutral-800';

/**
 * Hook for popover dismiss behavior (click outside, escape key)
 */
const usePopoverDismiss = (
  menuRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
): void => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuRef, onClose]);
};

interface SubtaskItemProps {
  todo: Todo;
  onClick: () => void;
}

const SubtaskItem: FC<SubtaskItemProps> = ({ todo, onClick }) => {
  const isCompleted = todo.completed !== null;

  return (
    <button
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
        isCompleted
          ? 'text-neutral-400 dark:text-neutral-500'
          : 'text-neutral-700 dark:text-neutral-300'
      }`}
      onClick={onClick}
      type="button"
    >
      {isCompleted ? (
        <MdCheckBox className="shrink-0 text-green-600 dark:text-green-400" size="1.1em" />
      ) : (
        <MdCheckBoxOutlineBlank className="shrink-0 text-neutral-400" size="1.1em" />
      )}
      <span className={isCompleted ? 'line-through' : ''}>{todo.title}</span>
    </button>
  );
};

interface SubtasksPopoverMenuProps {
  todoId: string;
  onClose: () => void;
  onSubtaskClick: (todo: Todo) => void;
  floatingStyles: object;
  setFloatingRef: (node: HTMLDivElement | null) => void;
}

/** Menu content that fetches children only when rendered (popover is open) */
const SubtasksPopoverMenu: FC<SubtasksPopoverMenuProps> = ({
  todoId,
  onClose,
  onSubtaskClick,
  floatingStyles,
  setFloatingRef,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Only fetch children when popover is actually open
  const { data: subtasks, isLoading } = useChildTodos(todoId);

  const setRefs = (node: HTMLDivElement | null) => {
    menuRef.current = node;
    setFloatingRef(node);
  };

  usePopoverDismiss(menuRef, onClose);

  const completedCount = subtasks?.filter((c) => c.completed !== null).length ?? 0;
  const totalCount = subtasks?.length ?? 0;

  return createPortal(
    <div
      className={`${POPOVER_STYLES} ${TRANSITION_FAST}`}
      ref={setRefs}
      style={floatingStyles as React.CSSProperties}
    >
      <div className="mb-2 flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-600">
        <span className="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
          Subtasks
        </span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {completedCount}/{totalCount} completed
        </span>
      </div>
      {isLoading ? (
        <div className="py-2 text-center text-xs text-neutral-500">Loading...</div>
      ) : (
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {subtasks?.map((subtask) => (
            <SubtaskItem key={subtask._id} onClick={() => onSubtaskClick(subtask)} todo={subtask} />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
};

interface SubtasksTriggerProps {
  completedCount: number;
  totalCount: number;
  onClick: (e: React.MouseEvent) => void;
  setReferenceRef: (node: HTMLButtonElement | null) => void;
}

const SubtasksTrigger: FC<SubtasksTriggerProps> = ({
  completedCount,
  totalCount,
  onClick,
  setReferenceRef,
}) => {
  const isAllComplete = completedCount === totalCount;

  return (
    <button
      className={`inline-flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-xs transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
        isAllComplete
          ? 'text-green-600 dark:text-green-400'
          : 'text-neutral-500 dark:text-neutral-400'
      }`}
      onClick={onClick}
      ref={setReferenceRef}
      title={`${completedCount} of ${totalCount} subtasks completed`}
      type="button"
    >
      <BiGitBranch size="1em" />
      <span>
        {completedCount}/{totalCount}
      </span>
    </button>
  );
};

export const SubtasksPopover: FC<SubtasksPopoverProps> = ({ todoId, subtaskCount }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { openTodo } = useTodoFlyoutContext();
  const { refs, floatingStyles } = useFloatingPosition({
    placement: 'bottom-start',
    open: isOpen,
  });

  // Use pre-computed count - don't render anything if no subtasks
  if (!subtaskCount || subtaskCount.total === 0) {
    return null;
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSubtaskClick = (todo: Todo) => {
    setIsOpen(false);
    openTodo(todo);
  };

  return (
    <>
      <SubtasksTrigger
        completedCount={subtaskCount.completed}
        onClick={handleToggle}
        setReferenceRef={refs.setReference}
        totalCount={subtaskCount.total}
      />
      {isOpen && (
        <SubtasksPopoverMenu
          floatingStyles={floatingStyles}
          onClose={() => setIsOpen(false)}
          onSubtaskClick={handleSubtaskClick}
          setFloatingRef={refs.setFloating}
          todoId={todoId}
        />
      )}
    </>
  );
};
