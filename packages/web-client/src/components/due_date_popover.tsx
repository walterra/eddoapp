/**
 * DueDatePopover component for quick due date actions
 */
import type { Todo } from '@eddo/core-client';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, format, nextMonday, startOfDay } from 'date-fns';
import { type FC, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BiCalendar, BiCalendarEvent, BiCalendarWeek } from 'react-icons/bi';

import { useTodoMutation } from '../hooks/use_todo_mutations';
import { DROPDOWN_ITEM, TRANSITION_FAST } from '../styles/interactive';

interface DueDatePopoverProps {
  todo: Todo;
  children: React.ReactNode;
}

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  getDate: () => Date;
}

const getQuickActions = (): QuickAction[] => {
  const today = startOfDay(new Date());

  return [
    {
      label: 'Today',
      icon: <BiCalendar size="1em" />,
      getDate: () => today,
    },
    {
      label: 'Tomorrow',
      icon: <BiCalendarEvent size="1em" />,
      getDate: () => addDays(today, 1),
    },
    {
      label: 'Next Monday',
      icon: <BiCalendarWeek size="1em" />,
      getDate: () => nextMonday(today),
    },
  ];
};

const formatDueDate = (date: Date): string => {
  return `${format(date, 'yyyy-MM-dd')}T23:59:59.999Z`;
};

interface PopoverMenuProps {
  actions: QuickAction[];
  position: { top: number; left: number };
  onSelect: (date: Date) => void;
  onClose: () => void;
}

const POPOVER_MENU_STYLES =
  'fixed z-50 min-w-36 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-800';

const PopoverMenu: FC<PopoverMenuProps> = ({ actions, position, onSelect, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return createPortal(
    <div
      className={POPOVER_MENU_STYLES}
      ref={menuRef}
      style={{ top: position.top, left: position.left }}
    >
      {actions.map((action) => (
        <button
          className={`${DROPDOWN_ITEM} ${TRANSITION_FAST} flex items-center gap-2`}
          key={action.label}
          onClick={() => onSelect(action.getDate())}
          type="button"
        >
          {action.icon}
          <span>{action.label}</span>
          <span className="ml-auto text-xs text-neutral-400">
            {format(action.getDate(), 'MMM d')}
          </span>
        </button>
      ))}
    </div>,
    document.body,
  );
};

export const DueDatePopover: FC<DueDatePopoverProps> = ({ todo, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const updateTodo = useTodoMutation();
  const queryClient = useQueryClient();
  const actions = getQuickActions();

  const handleSelect = async (date: Date) => {
    setIsOpen(false);
    const newDue = formatDueDate(date);

    if (newDue !== todo.due) {
      await updateTodo.mutateAsync({ ...todo, due: newDue });
      // Invalidate to refetch with correct date filtering
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    }
  };

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

  return (
    <>
      <button
        className="text-primary-600 hover:bg-primary-100 hover:text-primary-700 dark:text-primary-400 dark:hover:bg-primary-900 dark:hover:text-primary-300 cursor-pointer rounded px-1.5 py-0.5"
        onClick={handleToggle}
        ref={buttonRef}
        title="Change due date"
        type="button"
      >
        {children}
      </button>
      {isOpen && (
        <PopoverMenu
          actions={actions}
          onClose={() => setIsOpen(false)}
          onSelect={handleSelect}
          position={position}
        />
      )}
    </>
  );
};
