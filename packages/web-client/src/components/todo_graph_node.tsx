/**
 * Custom node component for todo items in the graph view.
 */
import { type Todo } from '@eddo/core-shared';
import { Handle, Position } from '@xyflow/react';
import { type FC } from 'react';
import { HiCheck, HiOutlineClock } from 'react-icons/hi';

export interface TodoNodeData {
  todo: Todo;
}

/** Format due date for display */
const formatDueDate = (due: string | null): string | null => {
  if (!due) return null;
  const date = new Date(due);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** Check if todo has active time tracking */
const isTimeTracking = (todo: Todo): boolean => {
  if (!todo.active) return false;
  return Object.values(todo.active).some((v) => v === null);
};

/** Get container class based on todo state */
const getContainerClass = (isCompleted: boolean, isTracking: boolean): string => {
  const base = 'min-w-[200px] max-w-[250px] rounded-lg border-2 px-3 py-2 shadow-md transition-all';
  if (isCompleted)
    return `${base} border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/30`;
  if (isTracking)
    return `${base} border-primary-400 bg-primary-50 dark:border-primary-600 dark:bg-primary-900/30`;
  return `${base} border-neutral-200 bg-white dark:border-neutral-600 dark:bg-neutral-800`;
};

/** Status indicator icon */
const StatusIcon: FC<{ isCompleted: boolean; isTracking: boolean }> = ({
  isCompleted,
  isTracking,
}) => {
  const baseClass = 'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded';
  if (isCompleted) {
    return (
      <div className={`${baseClass} bg-green-500 text-white`}>
        <HiCheck className="h-3 w-3" />
      </div>
    );
  }
  if (isTracking) {
    return (
      <div className={`${baseClass} bg-primary-500 text-white`}>
        <HiOutlineClock className="h-3 w-3" />
      </div>
    );
  }
  return <div className={`${baseClass} border border-neutral-300 dark:border-neutral-500`} />;
};

/** Title text with completion styling */
const TitleText: FC<{ title: string; isCompleted: boolean }> = ({ title, isCompleted }) => (
  <span
    className={`text-sm leading-tight font-medium ${
      isCompleted
        ? 'text-neutral-500 line-through dark:text-neutral-400'
        : 'text-neutral-800 dark:text-neutral-100'
    }`}
  >
    {title}
  </span>
);

/** Metadata row with context, due date, and tags */
const MetadataRow: FC<{ context: string; dueDate: string | null; tags: string[] }> = ({
  context,
  dueDate,
  tags,
}) => (
  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
      {context}
    </span>
    {dueDate && <span className="text-neutral-500 dark:text-neutral-400">📅 {dueDate}</span>}
    {tags.slice(0, 2).map((tag: string) => (
      <span
        className="bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 rounded px-1.5 py-0.5"
        key={tag}
      >
        {tag}
      </span>
    ))}
    {tags.length > 2 && <span className="text-neutral-400">+{tags.length - 2}</span>}
  </div>
);

interface TodoNodeProps {
  data: TodoNodeData;
}

/** Todo node component for React Flow */
export const TodoNode: FC<TodoNodeProps> = ({ data }) => {
  const { todo } = data;
  const isCompleted = !!todo.completed;
  const isTracking = isTimeTracking(todo);
  const dueDate = formatDueDate(todo.due);
  const hasParent = !!todo.parentId;

  return (
    <div className={getContainerClass(isCompleted, isTracking)}>
      {hasParent && (
        <Handle
          className="!bg-neutral-400 dark:!bg-neutral-500"
          position={Position.Top}
          type="target"
        />
      )}
      <div className="flex items-start gap-2">
        <StatusIcon isCompleted={isCompleted} isTracking={isTracking} />
        <TitleText isCompleted={isCompleted} title={todo.title} />
      </div>
      <MetadataRow context={todo.context} dueDate={dueDate} tags={todo.tags} />
      <Handle
        className="!bg-neutral-400 dark:!bg-neutral-500"
        position={Position.Bottom}
        type="source"
      />
    </div>
  );
};
