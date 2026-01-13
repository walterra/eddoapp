/**
 * TodoCell component for rendering individual table cells
 */
import { type DatabaseError, type Todo, getFormattedDuration } from '@eddo/core-client';
import { format } from 'date-fns';
import { type FC, type ReactElement } from 'react';
import { BiCheckbox, BiCheckboxChecked } from 'react-icons/bi';

import { CONTEXT_DEFAULT } from '../constants';
import { type SubtaskCount } from '../hooks/use_parent_child';
import { CopyIdButton } from './copy_id_button';
import { DueDatePopover } from './due_date_popover';
import { FormattedMessage } from './formatted_message';
import { SubtasksPopover } from './subtasks_popover';
import { TagsPopover } from './tags_popover';
import { getColumnWidthClass } from './todo_table_helpers';

interface TodoCellProps {
  columnId: string;
  todo: Todo;
  error: DatabaseError | null;
  isUpdating: boolean;
  activeDuration: number;
  onToggleCheckbox: () => void;
  /** Pre-computed subtask count (avoids N+1 queries) */
  subtaskCount?: SubtaskCount;
}

const TitleCell: FC<{ todo: Todo; error: DatabaseError | null; widthClass: string }> = ({
  todo,
  error,
  widthClass,
}) => (
  <td className={`px-2 py-1 text-xs ${widthClass}`}>
    {error && (
      <div className="text-error-600 dark:text-error-400 mb-0.5 text-xs">Failed to update</div>
    )}
    <span
      className={
        todo.completed ? 'text-neutral-400 line-through' : 'text-neutral-900 dark:text-white'
      }
    >
      {todo.link !== null ? (
        <a
          className="text-primary-600 dark:text-primary-500 font-medium hover:underline"
          href={todo.link}
          rel="noreferrer"
          target="_BLANK"
        >
          <FormattedMessage message={todo.title} />
        </a>
      ) : (
        <FormattedMessage message={todo.title} />
      )}
    </span>
  </td>
);

const ContextCell: FC<{ todo: Todo; widthClass: string }> = ({ todo, widthClass }) => (
  <td className={`px-2 py-1 text-xs text-neutral-700 dark:text-neutral-300 ${widthClass}`}>
    <FormattedMessage message={todo.context || CONTEXT_DEFAULT} />
  </td>
);

const DueCell: FC<{ todo: Todo; widthClass: string }> = ({ todo, widthClass }) => (
  <td
    className={`px-2 py-1 text-xs whitespace-nowrap text-neutral-700 dark:text-neutral-300 ${widthClass}`}
  >
    <DueDatePopover todo={todo}>{todo.due.split('T')[0]}</DueDatePopover>
  </td>
);

const TagsCell: FC<{ todo: Todo; widthClass: string }> = ({ todo, widthClass }) => (
  <td className={`px-2 py-1 ${widthClass}`}>
    <TagsPopover todo={todo} />
  </td>
);

const TimeTrackedCell: FC<{ activeDuration: number; widthClass: string }> = ({
  activeDuration,
  widthClass,
}) => (
  <td
    className={`px-2 py-1 text-xs whitespace-nowrap text-neutral-700 dark:text-neutral-300 ${widthClass}`}
  >
    {activeDuration > 0 ? getFormattedDuration(activeDuration) : '-'}
  </td>
);

interface StatusCellProps {
  todo: Todo;
  isUpdating: boolean;
  onToggleCheckbox: () => void;
  widthClass: string;
}
const StatusCell: FC<StatusCellProps> = ({ todo, isUpdating, onToggleCheckbox, widthClass }) => {
  const isCompleted = todo.completed !== null;

  return (
    <td className={`px-2 py-1 ${widthClass}`}>
      <div className="flex items-center gap-1">
        <button
          className={`${isUpdating ? 'opacity-50' : 'cursor-pointer'} ${
            isCompleted
              ? 'text-primary-600 dark:text-primary-500'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
          }`}
          disabled={isUpdating}
          onClick={onToggleCheckbox}
          title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
          type="button"
        >
          {isCompleted ? <BiCheckboxChecked size="1.4em" /> : <BiCheckbox size="1.4em" />}
        </button>
        <CopyIdButton todoId={todo._id} />
      </div>
    </td>
  );
};

const CompletedCell: FC<{ todo: Todo; widthClass: string }> = ({ todo, widthClass }) => (
  <td
    className={`px-2 py-1 text-xs whitespace-nowrap text-neutral-700 dark:text-neutral-300 ${widthClass}`}
  >
    {todo.completed ? format(new Date(todo.completed), 'yyyy-MM-dd HH:mm') : '-'}
  </td>
);

const RepeatCell: FC<{ todo: Todo; widthClass: string }> = ({ todo, widthClass }) => (
  <td
    className={`px-2 py-1 text-xs whitespace-nowrap text-neutral-700 dark:text-neutral-300 ${widthClass}`}
  >
    {todo.repeat ? `${todo.repeat} days` : '-'}
  </td>
);

const LinkCell: FC<{ todo: Todo; widthClass: string }> = ({ todo, widthClass }) => (
  <td className={`px-2 py-1 text-xs ${widthClass}`}>
    {todo.link ? (
      <a
        className="text-primary-600 dark:text-primary-500 hover:underline"
        href={todo.link}
        rel="noreferrer"
        target="_BLANK"
      >
        Link
      </a>
    ) : (
      '-'
    )}
  </td>
);

const DescriptionCell: FC<{ todo: Todo; widthClass: string }> = ({ todo, widthClass }) => (
  <td className={`px-2 py-1 text-xs text-neutral-700 dark:text-neutral-300 ${widthClass}`}>
    {todo.description || '-'}
  </td>
);

interface SubtasksCellProps {
  todo: Todo;
  widthClass: string;
  subtaskCount?: SubtaskCount;
}

const SubtasksCell: FC<SubtasksCellProps> = ({ todo, widthClass, subtaskCount }) => (
  <td className={`px-2 py-1 text-xs ${widthClass}`}>
    {subtaskCount && subtaskCount.total > 0 ? (
      <SubtasksPopover subtaskCount={subtaskCount} todoId={todo._id} />
    ) : (
      <span className="text-neutral-400">-</span>
    )}
  </td>
);

interface CellRenderContext {
  todo: Todo;
  error: DatabaseError | null;
  isUpdating: boolean;
  activeDuration: number;
  onToggleCheckbox: () => void;
  widthClass: string;
  subtaskCount?: SubtaskCount;
}

type CellRenderer = (ctx: CellRenderContext) => ReactElement;

const CELL_RENDERERS: Record<string, CellRenderer> = {
  title: (ctx) => <TitleCell error={ctx.error} todo={ctx.todo} widthClass={ctx.widthClass} />,
  subtasks: (ctx) => (
    <SubtasksCell subtaskCount={ctx.subtaskCount} todo={ctx.todo} widthClass={ctx.widthClass} />
  ),
  context: (ctx) => <ContextCell todo={ctx.todo} widthClass={ctx.widthClass} />,
  due: (ctx) => <DueCell todo={ctx.todo} widthClass={ctx.widthClass} />,
  tags: (ctx) => <TagsCell todo={ctx.todo} widthClass={ctx.widthClass} />,
  timeTracked: (ctx) => (
    <TimeTrackedCell activeDuration={ctx.activeDuration} widthClass={ctx.widthClass} />
  ),
  status: (ctx) => (
    <StatusCell
      isUpdating={ctx.isUpdating}
      onToggleCheckbox={ctx.onToggleCheckbox}
      todo={ctx.todo}
      widthClass={ctx.widthClass}
    />
  ),
  completed: (ctx) => <CompletedCell todo={ctx.todo} widthClass={ctx.widthClass} />,
  repeat: (ctx) => <RepeatCell todo={ctx.todo} widthClass={ctx.widthClass} />,
  link: (ctx) => <LinkCell todo={ctx.todo} widthClass={ctx.widthClass} />,
  description: (ctx) => <DescriptionCell todo={ctx.todo} widthClass={ctx.widthClass} />,
};

const DefaultCell = () => <td className="px-2 py-1">-</td>;

export const TodoCell: FC<TodoCellProps> = ({
  columnId,
  todo,
  error,
  isUpdating,
  activeDuration,
  onToggleCheckbox,
  subtaskCount,
}) => {
  const widthClass = getColumnWidthClass(columnId);
  const ctx: CellRenderContext = {
    todo,
    error,
    isUpdating,
    activeDuration,
    onToggleCheckbox,
    widthClass,
    subtaskCount,
  };
  const renderer = CELL_RENDERERS[columnId];
  return renderer ? renderer(ctx) : <DefaultCell />;
};
