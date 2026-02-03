/**
 * Editable cells for Todo table columns.
 */
import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FC,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

import { useAuditedTodoMutation } from '../hooks/use_audited_todo_mutations';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { DueDatePopover } from './due_date_popover';
import { formatDueDate } from './due_date_popover_shared';
import { FormattedMessage } from './formatted_message';
import { type TodoRowData } from './todo_table_types';

interface EditableFieldParams {
  initialValue: string;
  onSave: (value: string) => Promise<boolean>;
}

interface EditableFieldState {
  draft: string;
  isEditing: boolean;
  handleBlur: () => void;
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => Promise<void>;
  startEdit: () => void;
}

const useEditableField = ({ initialValue, onSave }: EditableFieldParams): EditableFieldState => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue);

  const resetState = useCallback(() => {
    setDraft(initialValue);
    setIsEditing(false);
  }, [initialValue]);

  const startEdit = useCallback(() => {
    setDraft(initialValue);
    setIsEditing(true);
  }, [initialValue]);

  const handleSave = useCallback(async () => {
    const didSave = await onSave(draft);
    if (didSave) {
      setIsEditing(false);
      return;
    }
    resetState();
  }, [draft, onSave, resetState]);

  const handleKeyDown = useCallback(
    async (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        await handleSave();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        resetState();
      }
    },
    [handleSave, resetState],
  );

  const handleBlur = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
  }, []);

  return { draft, isEditing, handleBlur, handleChange, handleKeyDown, startEdit };
};

interface ClickHandlers {
  handleClick: () => void;
  handleDoubleClick: (event: MouseEvent) => void;
}

interface ClickHandlerParams {
  delay?: number;
  onDoubleClick: () => void;
  onSingleClick: () => void;
}

const useSingleDoubleClick = ({
  delay = 200,
  onDoubleClick,
  onSingleClick,
}: ClickHandlerParams): ClickHandlers => {
  const timeoutRef = useRef<number | null>(null);

  const handleClick = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(onSingleClick, delay);
  }, [delay, onSingleClick]);

  const handleDoubleClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      onDoubleClick();
    },
    [onDoubleClick],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return { handleClick, handleDoubleClick };
};

interface TitleSaveParams {
  title: string;
  updateTitle: (value: string) => Promise<void>;
}

const useTitleSave = ({ title, updateTitle }: TitleSaveParams) =>
  useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === title) {
        return false;
      }
      await updateTitle(trimmed);
      return true;
    },
    [title, updateTitle],
  );

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

interface TitleCellProps {
  row: TodoRowData;
}

export const TitleCell: FC<TitleCellProps> = ({ row }) => {
  const { todo } = row;
  const { openTodo } = useTodoFlyoutContext();
  const updateTodo = useAuditedTodoMutation();
  const queryClient = useQueryClient();
  const titleClassName = todo.completed
    ? 'text-neutral-400 line-through'
    : 'text-neutral-900 dark:text-white';

  const updateTitle = useCallback(
    async (value: string) => {
      await updateTodo.mutateAsync({ todo: { ...todo, title: value }, originalTodo: todo });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
    [queryClient, todo, updateTodo],
  );

  const saveTitle = useTitleSave({ title: todo.title, updateTitle });
  const { draft, handleBlur, handleChange, handleKeyDown, isEditing, startEdit } = useEditableField(
    { initialValue: todo.title, onSave: saveTitle },
  );
  const { handleClick, handleDoubleClick } = useSingleDoubleClick({
    onDoubleClick: startEdit,
    onSingleClick: () => openTodo(todo),
  });

  if (isEditing) {
    return (
      <input
        className="focus:border-primary-500 focus:ring-primary-500 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 focus:ring-1 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        type="text"
        value={draft}
      />
    );
  }

  return (
    <div className="text-xs">
      <button
        className={`cursor-pointer text-left font-medium hover:underline ${titleClassName}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        type="button"
      >
        <FormattedMessage message={todo.title} />
      </button>
    </div>
  );
};

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
