/**
 * Icon-based node component for todo items in the graph view.
 * Shows status with intuitive icons, full details on hover.
 */
import { type Todo } from '@eddo/core-shared';
import { Handle, Position } from '@xyflow/react';
import { type FC } from 'react';
import { HiCheck, HiClock, HiDocumentText } from 'react-icons/hi';
import { MdFolder } from 'react-icons/md';

export interface TodoNodeData {
  todo: Todo;
}

/** Check if todo has active time tracking */
const isTimeTracking = (todo: Todo): boolean => {
  if (!todo.active) return false;
  return Object.values(todo.active).some((v) => v === null);
};

/** Check if todo is a project (has gtd:project tag) */
const isProject = (todo: Todo): boolean => todo.tags.includes('gtd:project');

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
const getNodeStyle = (
  isCompleted: boolean,
  isTracking: boolean,
  project: boolean,
): { bgColor: string; borderColor: string; Icon: typeof HiCheck } => {
  if (isCompleted) {
    return { bgColor: 'bg-green-500', borderColor: 'border-green-400', Icon: HiCheck };
  }
  if (isTracking) {
    return { bgColor: 'bg-primary-500', borderColor: 'border-primary-400', Icon: HiClock };
  }
  if (project) {
    return { bgColor: 'bg-amber-500', borderColor: 'border-amber-400', Icon: MdFolder };
  }
  return {
    bgColor: 'bg-neutral-600 dark:bg-neutral-500',
    borderColor: 'border-neutral-500 dark:border-neutral-400',
    Icon: HiDocumentText,
  };
};

interface TodoNodeProps {
  data: TodoNodeData;
}

/** Icon-based node for React Flow */
export const TodoNode: FC<TodoNodeProps> = ({ data }) => {
  const { todo } = data;
  const { bgColor, borderColor, Icon } = getNodeStyle(
    !!todo.completed,
    isTimeTracking(todo),
    isProject(todo),
  );

  return (
    <div
      className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 shadow-md transition-transform hover:scale-125 ${bgColor} ${borderColor}`}
      title={buildTooltip(todo)}
    >
      <Icon className="h-4 w-4 text-white" />
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
