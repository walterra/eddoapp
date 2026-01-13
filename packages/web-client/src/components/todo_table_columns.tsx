/**
 * TanStack Table column definitions for TodoTable
 */
import { getFormattedDuration, type DatabaseError, type Todo } from '@eddo/core-client';
import { createColumnHelper, type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { type FC, type ReactNode } from 'react';
import { BiCheckbox, BiCheckboxChecked } from 'react-icons/bi';

import { CONTEXT_DEFAULT } from '../constants';
import { type SubtaskCount } from '../hooks/use_parent_child';
import { CopyIdButton } from './copy_id_button';
import { DueDatePopover } from './due_date_popover';
import { FormattedMessage } from './formatted_message';
import { SubtasksPopover } from './subtasks_popover';
import { TagsPopover } from './tags_popover';

/** Row data passed to table - todo plus computed values */
export interface TodoRowData {
  todo: Todo;
  duration: number;
  subtaskCount?: SubtaskCount;
  isUpdating: boolean;
  error: DatabaseError | null;
  onToggleCheckbox: () => void;
}

const columnHelper = createColumnHelper<TodoRowData>();

/** Status cell with checkbox and copy ID button */
const StatusCell: FC<{
  row: TodoRowData;
}> = ({ row }) => {
  const isCompleted = row.todo.completed !== null;

  return (
    <div className="flex items-center gap-1">
      <button
        className={`${row.isUpdating ? 'opacity-50' : 'cursor-pointer'} ${
          isCompleted
            ? 'text-primary-600 dark:text-primary-500'
            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
        }`}
        disabled={row.isUpdating}
        onClick={row.onToggleCheckbox}
        title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        type="button"
      >
        {isCompleted ? <BiCheckboxChecked size="1.4em" /> : <BiCheckbox size="1.4em" />}
      </button>
      <CopyIdButton todoId={row.todo._id} />
    </div>
  );
};

/** Title cell with link support */
const TitleCell: FC<{ row: TodoRowData }> = ({ row }) => {
  const { todo, error } = row;
  return (
    <div className="text-xs">
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
    </div>
  );
};

/** All column definitions - uses any for mixed accessor types */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const allColumns: Record<string, ColumnDef<TodoRowData, any>> = {
  status: columnHelper.display({
    id: 'status',
    header: '',
    cell: ({ row }) => <StatusCell row={row.original} />,
    size: 52,
    enableResizing: false,
  }),

  title: columnHelper.accessor((row) => row.todo.title, {
    id: 'title',
    header: 'Title',
    cell: ({ row }) => <TitleCell row={row.original} />,
    size: 300,
  }),

  subtasks: columnHelper.display({
    id: 'subtasks',
    header: 'Subtasks',
    cell: ({ row }) => {
      const { todo, subtaskCount } = row.original;
      if (!subtaskCount || subtaskCount.total === 0) {
        return <span className="text-neutral-400">-</span>;
      }
      return <SubtasksPopover subtaskCount={subtaskCount} todoId={todo._id} />;
    },
    size: 80,
  }),

  context: columnHelper.accessor((row) => row.todo.context || CONTEXT_DEFAULT, {
    id: 'context',
    header: 'Context',
    cell: ({ getValue }) => (
      <span className="text-xs text-neutral-700 dark:text-neutral-300">
        <FormattedMessage message={getValue()} />
      </span>
    ),
    size: 128,
  }),

  due: columnHelper.accessor((row) => row.todo.due, {
    id: 'due',
    header: 'Due Date',
    cell: ({ row }) => (
      <span className="text-xs whitespace-nowrap text-neutral-700 dark:text-neutral-300">
        <DueDatePopover todo={row.original.todo}>
          {row.original.todo.due.split('T')[0]}
        </DueDatePopover>
      </span>
    ),
    size: 128,
  }),

  tags: columnHelper.display({
    id: 'tags',
    header: 'Tags',
    cell: ({ row }) => <TagsPopover todo={row.original.todo} />,
    size: 192,
  }),

  timeTracked: columnHelper.accessor((row) => row.duration, {
    id: 'timeTracked',
    header: 'Time Tracked',
    cell: ({ getValue }) => {
      const duration = getValue();
      return (
        <span className="text-xs whitespace-nowrap text-neutral-700 dark:text-neutral-300">
          {duration > 0 ? getFormattedDuration(duration) : '-'}
        </span>
      );
    },
    size: 112,
  }),

  completed: columnHelper.accessor((row) => row.todo.completed, {
    id: 'completed',
    header: 'Completed',
    cell: ({ getValue }) => {
      const completed = getValue();
      return (
        <span className="text-xs whitespace-nowrap text-neutral-700 dark:text-neutral-300">
          {completed ? format(new Date(completed), 'yyyy-MM-dd HH:mm') : '-'}
        </span>
      );
    },
    size: 160,
  }),

  repeat: columnHelper.accessor((row) => row.todo.repeat, {
    id: 'repeat',
    header: 'Repeat',
    cell: ({ getValue }) => {
      const repeat = getValue();
      return (
        <span className="text-xs whitespace-nowrap text-neutral-700 dark:text-neutral-300">
          {repeat ? `${repeat} days` : '-'}
        </span>
      );
    },
    size: 96,
  }),

  link: columnHelper.accessor((row) => row.todo.link, {
    id: 'link',
    header: 'Link',
    cell: ({ getValue }) => {
      const link = getValue();
      return link ? (
        <a
          className="text-primary-600 dark:text-primary-500 text-xs hover:underline"
          href={link}
          rel="noreferrer"
          target="_BLANK"
        >
          Link
        </a>
      ) : (
        <span className="text-xs">-</span>
      );
    },
    size: 80,
  }),

  description: columnHelper.accessor((row) => row.todo.description, {
    id: 'description',
    header: 'Description',
    cell: ({ getValue }) => (
      <span className="text-xs text-neutral-700 dark:text-neutral-300">{getValue() || '-'}</span>
    ),
    size: 320,
  }),
};

/**
 * Build column definitions from selected column IDs
 * @param selectedColumns - Array of column IDs to include
 * @returns Array of column definitions in order
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildColumns(selectedColumns: string[]): ColumnDef<TodoRowData, any>[] {
  // Always put status first if present
  const orderedIds = selectedColumns.includes('status')
    ? ['status', ...selectedColumns.filter((id) => id !== 'status')]
    : selectedColumns;

  return orderedIds.map((id) => allColumns[id]).filter(Boolean);
}

/** Header component that can render custom content (e.g., bulk actions) */
export interface TableHeaderProps {
  children: ReactNode;
  columnId: string;
  todos?: readonly Todo[];
}
