/**
 * TodoCell component for rendering individual table cells
 */
import { type DatabaseError, type Todo, getFormattedDuration } from '@eddo/core-client';
import { format } from 'date-fns';
import { Checkbox } from 'flowbite-react';
import { type FC } from 'react';

import { CONTEXT_DEFAULT } from '../constants';
import { FormattedMessage } from './formatted_message';
import { TagDisplay } from './tag_display';
import { getColumnWidthClass } from './todo_table_helpers';

interface TodoCellProps {
  columnId: string;
  todo: Todo;
  error: DatabaseError | null;
  isUpdating: boolean;
  activeDuration: number;
  onToggleCheckbox: () => void;
}

const TitleCell: FC<{ todo: Todo; error: DatabaseError | null; widthClass: string }> = ({
  todo,
  error,
  widthClass,
}) => (
  <td className={`px-2 py-1 text-xs ${widthClass}`}>
    {error && <div className="mb-0.5 text-xs text-red-600 dark:text-red-400">Failed to update</div>}
    <span
      className={todo.completed ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}
    >
      {todo.link !== null ? (
        <a
          className="font-medium text-blue-600 hover:underline dark:text-blue-500"
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
  <td className={`px-2 py-1 text-xs text-gray-700 dark:text-gray-300 ${widthClass}`}>
    <FormattedMessage message={todo.context || CONTEXT_DEFAULT} />
  </td>
);

const DueCell: FC<{ todo: Todo; widthClass: string }> = ({ todo, widthClass }) => (
  <td
    className={`px-2 py-1 text-xs whitespace-nowrap text-gray-700 dark:text-gray-300 ${widthClass}`}
  >
    {todo.due.split('T')[0]}
  </td>
);

const TagsCell: FC<{ todo: Todo; widthClass: string }> = ({ todo, widthClass }) => (
  <td className={`px-2 py-1 ${widthClass}`}>
    {todo.tags.length > 0 ? (
      <TagDisplay maxTags={3} size="xs" tags={todo.tags} />
    ) : (
      <span className="text-xs text-gray-400">-</span>
    )}
  </td>
);

const TimeTrackedCell: FC<{ activeDuration: number; widthClass: string }> = ({
  activeDuration,
  widthClass,
}) => (
  <td
    className={`px-2 py-1 text-xs whitespace-nowrap text-gray-700 dark:text-gray-300 ${widthClass}`}
  >
    {activeDuration > 0 ? getFormattedDuration(activeDuration) : '-'}
  </td>
);

const StatusCell: FC<{
  todo: Todo;
  isUpdating: boolean;
  onToggleCheckbox: () => void;
  widthClass: string;
}> = ({ todo, isUpdating, onToggleCheckbox, widthClass }) => (
  <td className={`px-2 py-1 ${widthClass}`}>
    <Checkbox
      checked={todo.completed !== null}
      disabled={isUpdating}
      key={`checkbox-${todo._id}-${todo.completed !== null}`}
      onChange={onToggleCheckbox}
    />
  </td>
);

const CompletedCell: FC<{ todo: Todo; widthClass: string }> = ({ todo, widthClass }) => (
  <td
    className={`px-2 py-1 text-xs whitespace-nowrap text-gray-700 dark:text-gray-300 ${widthClass}`}
  >
    {todo.completed ? format(new Date(todo.completed), 'yyyy-MM-dd HH:mm') : '-'}
  </td>
);

const RepeatCell: FC<{ todo: Todo; widthClass: string }> = ({ todo, widthClass }) => (
  <td
    className={`px-2 py-1 text-xs whitespace-nowrap text-gray-700 dark:text-gray-300 ${widthClass}`}
  >
    {todo.repeat ? `${todo.repeat} days` : '-'}
  </td>
);

const LinkCell: FC<{ todo: Todo; widthClass: string }> = ({ todo, widthClass }) => (
  <td className={`px-2 py-1 text-xs ${widthClass}`}>
    {todo.link ? (
      <a
        className="text-blue-600 hover:underline dark:text-blue-500"
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
  <td className={`px-2 py-1 text-xs text-gray-700 dark:text-gray-300 ${widthClass}`}>
    {todo.description || '-'}
  </td>
);

export const TodoCell: FC<TodoCellProps> = ({
  columnId,
  todo,
  error,
  isUpdating,
  activeDuration,
  onToggleCheckbox,
}) => {
  const widthClass = getColumnWidthClass(columnId);

  switch (columnId) {
    case 'title':
      return <TitleCell error={error} todo={todo} widthClass={widthClass} />;
    case 'context':
      return <ContextCell todo={todo} widthClass={widthClass} />;
    case 'due':
      return <DueCell todo={todo} widthClass={widthClass} />;
    case 'tags':
      return <TagsCell todo={todo} widthClass={widthClass} />;
    case 'timeTracked':
      return <TimeTrackedCell activeDuration={activeDuration} widthClass={widthClass} />;
    case 'status':
      return (
        <StatusCell
          isUpdating={isUpdating}
          onToggleCheckbox={onToggleCheckbox}
          todo={todo}
          widthClass={widthClass}
        />
      );
    case 'completed':
      return <CompletedCell todo={todo} widthClass={widthClass} />;
    case 'repeat':
      return <RepeatCell todo={todo} widthClass={widthClass} />;
    case 'link':
      return <LinkCell todo={todo} widthClass={widthClass} />;
    case 'description':
      return <DescriptionCell todo={todo} widthClass={widthClass} />;
    default:
      return <td className="px-2 py-1">-</td>;
  }
};
