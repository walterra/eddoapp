/**
 * SubtasksPopover component for displaying child todos in a popover
 */
import type { Todo } from '@eddo/core-client';
import { type FC, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BiGitBranch } from 'react-icons/bi';
import { MdCheckBox, MdCheckBoxOutlineBlank } from 'react-icons/md';

import { useChildTodos } from '../hooks/use_parent_child';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { TRANSITION_FAST } from '../styles/interactive';

interface SubtasksPopoverProps {
  todoId: string;
}

interface PopoverPosition {
  top: number;
  left: number;
}

const POPOVER_STYLES =
  'fixed z-50 min-w-64 max-w-md rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-600 dark:bg-neutral-800';

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
  position: PopoverPosition;
  subtasks: Todo[];
  onClose: () => void;
  onSubtaskClick: (todo: Todo) => void;
}

const SubtasksPopoverMenu: FC<SubtasksPopoverMenuProps> = ({
  position,
  subtasks,
  onClose,
  onSubtaskClick,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  usePopoverDismiss(menuRef, onClose);

  const completedCount = subtasks.filter((c) => c.completed !== null).length;
  const totalCount = subtasks.length;

  return createPortal(
    <div
      className={`${POPOVER_STYLES} ${TRANSITION_FAST}`}
      ref={menuRef}
      style={{ top: position.top, left: position.left }}
    >
      <div className="mb-2 flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-600">
        <span className="text-xs font-medium text-neutral-500 uppercase dark:text-neutral-400">
          Subtasks
        </span>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {completedCount}/{totalCount} completed
        </span>
      </div>
      <div className="max-h-64 space-y-0.5 overflow-y-auto">
        {subtasks.map((subtask) => (
          <SubtaskItem key={subtask._id} onClick={() => onSubtaskClick(subtask)} todo={subtask} />
        ))}
      </div>
    </div>,
    document.body,
  );
};

interface SubtasksTriggerProps {
  completedCount: number;
  totalCount: number;
  onClick: (e: React.MouseEvent) => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

const SubtasksTrigger: FC<SubtasksTriggerProps> = ({
  completedCount,
  totalCount,
  onClick,
  buttonRef,
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
      ref={buttonRef}
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

export const SubtasksPopover: FC<SubtasksPopoverProps> = ({ todoId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { data: children, isLoading } = useChildTodos(todoId);
  const { openTodo } = useTodoFlyoutContext();

  if (isLoading || !children || children.length === 0) {
    return null;
  }

  const completedCount = children.filter((c) => c.completed !== null).length;
  const totalCount = children.length;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }

    setIsOpen(!isOpen);
  };

  const handleSubtaskClick = (todo: Todo) => {
    setIsOpen(false);
    openTodo(todo);
  };

  return (
    <>
      <SubtasksTrigger
        buttonRef={buttonRef}
        completedCount={completedCount}
        onClick={handleToggle}
        totalCount={totalCount}
      />
      {isOpen && (
        <SubtasksPopoverMenu
          onClose={() => setIsOpen(false)}
          onSubtaskClick={handleSubtaskClick}
          position={position}
          subtasks={children}
        />
      )}
    </>
  );
};
