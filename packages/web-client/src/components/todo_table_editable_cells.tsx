/**
 * Editable cells for Todo table columns.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, type FC, type MouseEvent } from 'react';

import { useAuditedTodoMutation } from '../hooks/use_audited_todo_mutations';
import { DueDatePopover } from './due_date_popover';
import { formatDueDate } from './due_date_popover_shared';
import { useEditableField } from './todo_table_edit_hooks';
import { TitleCell } from './todo_table_title_cell';
import { type TodoRowData } from './todo_table_types';

export { TitleCell };

interface DueDateSaveParams {
  due: string;
  updateDueDate: (value: string) => Promise<void>;
}

const useDueDateSave = ({ due, updateDueDate }: DueDateSaveParams) =>
  useCallback(
    async (value: string) => {
      if (value.trim() === '') {
        return false;
      }
      const newDue = formatDueDate(new Date(value));
      if (newDue === due) {
        return false;
      }
      await updateDueDate(newDue);
      return true;
    },
    [due, updateDueDate],
  );

interface DueDateCellProps {
  row: TodoRowData;
}

export const DueDateCell: FC<DueDateCellProps> = ({ row }) => {
  const { todo } = row;
  const updateTodo = useAuditedTodoMutation();
  const queryClient = useQueryClient();

  const updateDueDate = useCallback(
    async (value: string) => {
      await updateTodo.mutateAsync({ todo: { ...todo, due: value }, originalTodo: todo });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
    [queryClient, todo, updateTodo],
  );

  const saveDueDate = useDueDateSave({ due: todo.due, updateDueDate });
  const { draft, handleBlur, handleChange, handleKeyDown, isEditing, startEdit } = useEditableField(
    { initialValue: todo.due.split('T')[0], onSave: saveDueDate },
  );

  if (isEditing) {
    return (
      <input
        className="focus:border-primary-500 focus:ring-primary-500 w-28 rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 focus:ring-1 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        type="date"
        value={draft}
      />
    );
  }

  const handleDoubleClick = (event: MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    startEdit();
  };

  return (
    <span
      className="text-xs whitespace-nowrap text-neutral-700 dark:text-neutral-300"
      onDoubleClick={handleDoubleClick}
    >
      <DueDatePopover todo={todo}>{todo.due.split('T')[0]}</DueDatePopover>
    </span>
  );
};
