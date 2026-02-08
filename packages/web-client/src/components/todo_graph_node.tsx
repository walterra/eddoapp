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
  isHighlighted?: boolean;
  showActions?: boolean;
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

interface NodeStyle {
  bgColor: string;
  borderColor: string;
  extraClasses: string;
}

/** Get node style based on todo state and highlight */
const getNodeStyle = (isCompleted: boolean, isHighlighted: boolean): NodeStyle => {
  if (isHighlighted) {
    // Bright yellow/gold for highlighted - very prominent
    return {
      bgColor: 'bg-yellow-400',
      borderColor: 'border-yellow-300',
      extraClasses:
        'ring-4 ring-yellow-300 shadow-[0_0_30px_10px_rgba(250,204,21,0.7)] animate-pulse',
    };
  }

  if (isCompleted) {
    // Muted teal for completed - subtle but distinct
    return { bgColor: 'bg-teal-700', borderColor: 'border-teal-600', extraClasses: '' };
  }
  // Warm slate for pending - neutral but inviting
  return {
    bgColor: 'bg-slate-600',
    borderColor: 'border-slate-500',
    extraClasses: '',
  };
};

interface TodoNodeProps {
  data: TodoNodeData;
}

/** Truncate title for display */
const truncateTitle = (title: string, maxLen = 30): string =>
  title.length > maxLen ? `${title.slice(0, maxLen)}...` : title;

/** Icon-based node for React Flow */
export const TodoNode: FC<TodoNodeProps> = ({ data }) => {
  const { todo, size, isHighlighted = false } = data;
  const { openTodo } = useTodoFlyoutContext();
  const { bgColor, borderColor, extraClasses } = getNodeStyle(!!todo.completed, isHighlighted);

  const handleClick = useCallback(() => {
    openTodo(todo);
  }, [openTodo, todo]);

  // Scale icon size proportionally
  const iconSize = Math.round(size * 0.6);

  // Scale up highlighted nodes for visibility (very subtle - color change is primary indicator)
  const scale = isHighlighted ? 1.05 : 1;
  const iconColor = isHighlighted ? 'text-yellow-900' : 'text-white';

  return (
    <div className="group relative">
      {/* Title label - only visible on hover */}
      <div
        className="absolute bottom-full left-1/2 z-10 mb-1 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ transform: 'translateX(-50%)' }}
      >
        <div className="max-w-48 truncate rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200 shadow">
          {truncateTitle(todo.title)}
        </div>
      </div>

      {/* Node icon */}
      <div
        className={`flex cursor-pointer items-center justify-center rounded-sm border-2 shadow-md transition-all duration-150 hover:scale-105 ${bgColor} ${borderColor} ${extraClasses}`}
        onClick={handleClick}
        style={{
          width: size,
          height: size,
          transform: `scale(${scale})`,
          zIndex: isHighlighted ? 1000 : 1,
        }}
        title={buildTooltip(todo)}
      >
        <HiDocumentText className={iconColor} style={{ width: iconSize, height: iconSize }} />
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
    </div>
  );
};
