/**
 * Icon-based node component for todo items in the graph view.
 * Shows status with intuitive icons, full details on hover.
 * Click opens the todo flyout.
 */
import { type Todo } from '@eddo/core-shared';
import { Handle, Position } from '@xyflow/react';
import { type FC, useCallback } from 'react';
import { HiDocumentText } from 'react-icons/hi';

import { useTodoFlyoutContext } from '../hooks/use_todo_flyout';

export interface TodoNodeData {
  todo: Todo;
}

/** Build tooltip text with full details */
const buildTooltip = (todo: Todo): string => {
  const parts = [todo.title];
  if (todo.context) parts.push(`Context: ${todo.context}`);
  if (todo.due) parts.push(`Due: ${new Date(todo.due).toLocaleDateString()}`);
  if (todo.tags.length > 0) parts.push(`Tags: ${todo.tags.join(', ')}`);
  if (todo.completed) parts.push('✓ Completed');
  return parts.join('\n');
};

/** Get node style based on todo state */
const getNodeStyle = (isCompleted: boolean): { bgColor: string; borderColor: string } => {
  if (isCompleted) {
    return { bgColor: 'bg-green-900', borderColor: 'border-green-800' };
  }
  return {
    bgColor: 'bg-neutral-700 dark:bg-neutral-600',
    borderColor: 'border-neutral-600 dark:border-neutral-500',
  };
};

interface TodoNodeProps {
  data: TodoNodeData;
}

/** Icon-based node for React Flow */
export const TodoNode: FC<TodoNodeProps> = ({ data }) => {
  const { todo } = data;
  const { openTodo } = useTodoFlyoutContext();
  const { bgColor, borderColor } = getNodeStyle(!!todo.completed);

  const handleClick = useCallback(() => {
    openTodo(todo);
  }, [openTodo, todo]);

  return (
    <div
      className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm border-2 shadow-md transition-transform hover:scale-125 ${bgColor} ${borderColor}`}
      onClick={handleClick}
      title={buildTooltip(todo)}
    >
      <HiDocumentText className="h-4 w-4 text-white" />
      <Handle
        className="!top-1/2 !left-1/2 !h-1 !min-h-0 !w-1 !min-w-0 !-translate-x-1/2 !-translate-y-1/2 !border-0 !bg-transparent"
        id="center"
        position={Position.Top}
        type="source"
      />
      <Handle
        className="!top-1/2 !left-1/2 !h-1 !min-h-0 !w-1 !min-w-0 !-translate-x-1/2 !-translate-y-1/2 !border-0 !bg-transparent"
        id="center"
        position={Position.Top}
        type="target"
      />
    </div>
  );
};
