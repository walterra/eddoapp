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
  size: number;
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
    // Muted teal for completed - subtle but distinct
    return { bgColor: 'bg-teal-700', borderColor: 'border-teal-600' };
  }
  // Warm slate for pending - neutral but inviting
  return {
    bgColor: 'bg-slate-600',
    borderColor: 'border-slate-500',
  };
};

interface TodoNodeProps {
  data: TodoNodeData;
}

/** Icon-based node for React Flow */
export const TodoNode: FC<TodoNodeProps> = ({ data }) => {
  const { todo, size } = data;
  const { openTodo } = useTodoFlyoutContext();
  const { bgColor, borderColor } = getNodeStyle(!!todo.completed);

  const handleClick = useCallback(() => {
    openTodo(todo);
  }, [openTodo, todo]);

  // Scale icon size proportionally
  const iconSize = Math.round(size * 0.6);

  return (
    <div
      className={`flex cursor-pointer items-center justify-center rounded-sm border-2 shadow-md transition-transform hover:scale-125 ${bgColor} ${borderColor}`}
      onClick={handleClick}
      style={{ width: size, height: size }}
      title={buildTooltip(todo)}
    >
      <HiDocumentText className="text-white" style={{ width: iconSize, height: iconSize }} />
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
