/**
 * Minimal node component for todo items in the graph view.
 * Shows as a colored dot with full details on hover.
 * Edges connect to center of node.
 */
import { type Todo } from '@eddo/core-shared';
import { Handle, Position } from '@xyflow/react';
import { type FC } from 'react';

export interface TodoNodeData {
  todo: Todo;
}

/** Check if todo has active time tracking */
const isTimeTracking = (todo: Todo): boolean => {
  if (!todo.active) return false;
  return Object.values(todo.active).some((v) => v === null);
};

/** Build tooltip text with full details */
const buildTooltip = (todo: Todo): string => {
  const parts = [todo.title];
  if (todo.context) parts.push(`Context: ${todo.context}`);
  if (todo.due) parts.push(`Due: ${new Date(todo.due).toLocaleDateString()}`);
  if (todo.tags.length > 0) parts.push(`Tags: ${todo.tags.join(', ')}`);
  if (todo.completed) parts.push('✓ Completed');
  return parts.join('\n');
};

interface TodoNodeProps {
  data: TodoNodeData;
}

/** Minimal dot node for React Flow - hover for details */
export const TodoNode: FC<TodoNodeProps> = ({ data }) => {
  const { todo } = data;
  const isCompleted = !!todo.completed;
  const isTracking = isTimeTracking(todo);

  // Determine dot color based on state
  const dotColor = isCompleted
    ? 'bg-green-500 border-green-400'
    : isTracking
      ? 'bg-primary-500 border-primary-400'
      : 'bg-neutral-100 border-neutral-400 dark:bg-neutral-700 dark:border-neutral-500';

  return (
    <div
      className={`h-5 w-5 cursor-pointer rounded-full border-2 shadow-sm transition-transform hover:scale-150 ${dotColor}`}
      title={buildTooltip(todo)}
    >
      {/* Single centered handle for all connections */}
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
