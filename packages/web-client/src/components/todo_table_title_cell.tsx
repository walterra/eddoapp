import { useQueryClient } from '@tanstack/react-query';
import { useCallback, type FC, type MouseEvent } from 'react';

import { useAuditedTodoMutation } from '../hooks/use_audited_todo_mutations';
import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';
import { FormattedMessage } from './formatted_message';
import {
  useEditableField,
  useSingleDoubleClick,
  type EditableFieldState,
} from './todo_table_edit_hooks';
import { type TodoRowData } from './todo_table_types';

type TodoTableTodo = TodoRowData['todo'];

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

interface ScheduledTimeSaveParams {
  scheduledTime?: string | null;
  updateScheduledTime: (value: string | null) => Promise<void>;
}

const useScheduledTimeSave = ({ scheduledTime, updateScheduledTime }: ScheduledTimeSaveParams) =>
  useCallback(
    async (value: string) => {
      const normalizedValue = value.trim() === '' ? null : value;
      if (normalizedValue === (scheduledTime ?? null)) {
        return false;
      }
      await updateScheduledTime(normalizedValue);
      return true;
    },
    [scheduledTime, updateScheduledTime],
  );

interface TitleCellUpdates {
  updateScheduledTime: (value: string | null) => Promise<void>;
  updateTitle: (value: string) => Promise<void>;
}

const useTitleCellUpdates = (todo: TodoTableTodo): TitleCellUpdates => {
  const updateTodo = useAuditedTodoMutation();
  const queryClient = useQueryClient();

  const updateTitle = useCallback(
    async (value: string) => {
      await updateTodo.mutateAsync({ todo: { ...todo, title: value }, originalTodo: todo });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
    [queryClient, todo, updateTodo],
  );

  const updateScheduledTime = useCallback(
    async (value: string | null) => {
      await updateTodo.mutateAsync({
        todo: { ...todo, scheduledTime: value },
        originalTodo: todo,
      });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
    [queryClient, todo, updateTodo],
  );

  return { updateScheduledTime, updateTitle };
};

interface TitleCellEdits {
  timeEdit: EditableFieldState;
  titleEdit: EditableFieldState;
}

const useTitleCellEdits = (todo: TodoTableTodo, updates: TitleCellUpdates): TitleCellEdits => {
  const saveTitle = useTitleSave({ title: todo.title, updateTitle: updates.updateTitle });
  const saveScheduledTime = useScheduledTimeSave({
    scheduledTime: todo.scheduledTime,
    updateScheduledTime: updates.updateScheduledTime,
  });

  return {
    timeEdit: useEditableField({
      initialValue: todo.scheduledTime ?? '',
      onSave: saveScheduledTime,
    }),
    titleEdit: useEditableField({ initialValue: todo.title, onSave: saveTitle }),
  };
};

interface ScheduledTimeInputProps {
  timeEdit: EditableFieldState;
}

const ScheduledTimeInput: FC<ScheduledTimeInputProps> = ({ timeEdit }) => (
  <input
    aria-label="Scheduled time"
    className="focus:border-primary-500 focus:ring-primary-500 w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 focus:ring-1 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
    onBlur={timeEdit.handleBlur}
    onChange={timeEdit.handleChange}
    onKeyDown={timeEdit.handleKeyDown}
    type="time"
    value={timeEdit.draft}
  />
);

interface TitleInputProps {
  titleEdit: EditableFieldState;
}

const TitleInput: FC<TitleInputProps> = ({ titleEdit }) => (
  <input
    className="focus:border-primary-500 focus:ring-primary-500 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 focus:ring-1 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
    onBlur={titleEdit.handleBlur}
    onChange={titleEdit.handleChange}
    onKeyDown={titleEdit.handleKeyDown}
    type="text"
    value={titleEdit.draft}
  />
);

interface ScheduledTimePrefixProps {
  handleClick: (event: MouseEvent<HTMLSpanElement>) => void;
  handleDoubleClick: (event: MouseEvent<HTMLSpanElement>) => void;
  scheduledTime?: string | null;
}

const ScheduledTimePrefix: FC<ScheduledTimePrefixProps> = ({
  handleClick,
  handleDoubleClick,
  scheduledTime,
}) => {
  if (!scheduledTime) {
    return null;
  }

  return (
    <>
      <span
        className="text-neutral-500 dark:text-neutral-400"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {scheduledTime}
      </span>{' '}
    </>
  );
};

interface TitleButtonProps {
  handleScheduledTimeClick: (event: MouseEvent<HTMLSpanElement>) => void;
  handleScheduledTimeDoubleClick: (event: MouseEvent<HTMLSpanElement>) => void;
  handleTitleClick: () => void;
  handleTitleDoubleClick: (event: MouseEvent) => void;
  titleClassName: string;
  todo: TodoTableTodo;
}

const TitleButton: FC<TitleButtonProps> = ({
  handleScheduledTimeClick,
  handleScheduledTimeDoubleClick,
  handleTitleClick,
  handleTitleDoubleClick,
  titleClassName,
  todo,
}) => (
  <div className="text-xs">
    <button
      className={`cursor-pointer text-left font-medium hover:underline ${titleClassName}`}
      onClick={handleTitleClick}
      onDoubleClick={handleTitleDoubleClick}
      type="button"
    >
      <ScheduledTimePrefix
        handleClick={handleScheduledTimeClick}
        handleDoubleClick={handleScheduledTimeDoubleClick}
        scheduledTime={todo.scheduledTime}
      />
      <FormattedMessage message={todo.title} />
    </button>
  </div>
);

interface TitleCellProps {
  row: TodoRowData;
}

export const TitleCell: FC<TitleCellProps> = ({ row }) => {
  const { todo } = row;
  const { openTodo } = useTodoFlyoutContext();
  const updates = useTitleCellUpdates(todo);
  const { timeEdit, titleEdit } = useTitleCellEdits(todo, updates);
  const titleClickHandlers = useSingleDoubleClick({
    onDoubleClick: titleEdit.startEdit,
    onSingleClick: () => openTodo(todo),
  });
  const timeClickHandlers = useSingleDoubleClick({
    onDoubleClick: timeEdit.startEdit,
    onSingleClick: () => openTodo(todo),
  });
  const titleClassName = todo.completed
    ? 'text-neutral-400 line-through'
    : 'text-neutral-900 dark:text-white';

  const handleScheduledTimeClick = (event: MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    timeClickHandlers.handleClick();
  };

  if (timeEdit.isEditing) {
    return <ScheduledTimeInput timeEdit={timeEdit} />;
  }

  if (titleEdit.isEditing) {
    return <TitleInput titleEdit={titleEdit} />;
  }

  return (
    <TitleButton
      handleScheduledTimeClick={handleScheduledTimeClick}
      handleScheduledTimeDoubleClick={timeClickHandlers.handleDoubleClick}
      handleTitleClick={titleClickHandlers.handleClick}
      handleTitleDoubleClick={titleClickHandlers.handleDoubleClick}
      titleClassName={titleClassName}
      todo={todo}
    />
  );
};
