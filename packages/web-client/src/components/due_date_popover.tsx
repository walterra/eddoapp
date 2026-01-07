/**
 * DueDatePopover component for quick due date actions
 */
import type { Todo } from '@eddo/core-client';
import { useQueryClient } from '@tanstack/react-query';
import { addDays, nextMonday, startOfDay } from 'date-fns';
import { type FC, useState } from 'react';
import { BiCalendar, BiCalendarEvent, BiCalendarWeek } from 'react-icons/bi';

import { useFloatingPosition } from '../hooks/use_floating_position';
import { useTodoMutation } from '../hooks/use_todo_mutations';
import { formatDueDate, PopoverMenu, type QuickAction } from './due_date_popover_shared';

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
  const updateTodo = useTodoMutation();
  const queryClient = useQueryClient();
  const actions = getQuickActions();
  const { refs, floatingStyles } = useFloatingPosition({
    placement: 'bottom-start',
    open: isOpen,
  });

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
    setIsOpen(!isOpen);
  };

  return (
    <>
      <button
        className="text-primary-600 hover:bg-primary-100 hover:text-primary-700 dark:text-primary-400 dark:hover:bg-primary-900 dark:hover:text-primary-300 cursor-pointer rounded px-1.5 py-0.5"
        onClick={handleToggle}
        ref={refs.setReference}
        title="Change due date"
        type="button"
      >
        {children}
      </button>
      {isOpen && (
        <PopoverMenu
          actions={actions}
          floatingStyles={floatingStyles}
          onClose={() => setIsOpen(false)}
          onSelect={handleSelect}
          setFloatingRef={refs.setFloating}
        />
      )}
    </>
  );
};
