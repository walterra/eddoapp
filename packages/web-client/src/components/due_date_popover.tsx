/**
 * DueDatePopover component for quick due date actions
 */
import type { Todo } from '@eddo/core-client';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, nextMonday, startOfDay } from 'date-fns';
import { type FC, useRef, useState } from 'react';
import { BiCalendar, BiCalendarEvent, BiCalendarWeek } from 'react-icons/bi';

import { useTodoMutation } from '../hooks/use_todo_mutations';
import {
  formatDueDate,
  PopoverMenu,
  type PopoverPosition,
  type QuickAction,
} from './due_date_popover_shared';

interface DueDatePopoverProps {
  todo: Todo;
  children: React.ReactNode;
}

/**
 * Get quick actions for date selection
 */
export const getQuickActions = (): QuickAction[] => {
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

export const DueDatePopover: FC<DueDatePopoverProps> = ({ todo, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0 });
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
