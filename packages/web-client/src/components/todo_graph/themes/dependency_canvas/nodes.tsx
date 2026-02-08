/**
 * Dependency canvas theme node components.
 * Renders focused dependency todos as compact cards.
 */
import { type FC } from 'react';
import { HiCheckCircle, HiDocumentText, HiExclamationCircle } from 'react-icons/hi';

import { DefaultFileNode, DefaultMetadataNode, DefaultUserNode } from '../default/nodes';
import type {
  ThemedFileNodeProps,
  ThemedMetadataNodeProps,
  ThemedTodoNodeProps,
  ThemedUserNodeProps,
} from '../types';

type DependencyTodoNodeData = ThemedTodoNodeProps['data'] & {
  childCount?: number;
  blockedByCount?: number;
};

interface StatusBadge {
  label: string;
  className: string;
  Icon: FC<{ className?: string }>;
}

/** Truncate long titles for compact card display */
const truncateTitle = (title: string, maxLen = 56): string =>
  title.length > maxLen ? `${title.slice(0, maxLen)}...` : title;

/** Format due date for compact metadata row */
const formatDueDate = (due: string | null): string => {
  if (!due) {
    return 'No due date';
  }

  return new Date(due).toLocaleDateString();
};

/** Select status badge configuration for todo state */
const getStatusBadge = (todoData: DependencyTodoNodeData): StatusBadge => {
  if (todoData.todo.completed) {
    return {
      label: 'Completed',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
      Icon: HiCheckCircle,
    };
  }

  if ((todoData.blockedByCount ?? 0) > 0) {
    return {
      label: 'Blocked',
      className: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
      Icon: HiExclamationCircle,
    };
  }

  return {
    label: 'Active',
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    Icon: HiDocumentText,
  };
};

/** Build compact tag label list */
const getTagSummary = (tags: string[]): string[] => {
  if (tags.length <= 2) {
    return tags;
  }

  return [...tags.slice(0, 2), `+${tags.length - 2}`];
};

const TODO_CARD_BASE_CLASS =
  'w-[240px] min-w-[240px] cursor-pointer rounded-[10px] border bg-white p-3 text-left ' +
  'shadow-[0_2px_8px_rgba(15,23,42,0.10)] transition-all duration-200 hover:border-sky-300 ' +
  'hover:shadow-[0_6px_16px_rgba(15,23,42,0.14)] dark:bg-slate-900 ' +
  'dark:shadow-[0_4px_12px_rgba(0,0,0,0.35)]';

/** Build card classes for highlighted/non-highlighted states */
const getTodoCardClassName = (isHighlighted: boolean): string =>
  `${TODO_CARD_BASE_CLASS} ${
    isHighlighted
      ? 'border-sky-400 ring-2 ring-sky-400/80 dark:border-sky-300'
      : 'border-slate-200 dark:border-slate-700'
  }`;

/** Small status badge displayed in card header */
const TodoStatusBadge: FC<{ badge: StatusBadge }> = ({ badge }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}
  >
    <badge.Icon className="h-3 w-3" />
    {badge.label}
  </span>
);

/** Render compact tag pills */
const TodoTagSummary: FC<{ tags: string[] }> = ({ tags }) => {
  const tagSummary = getTagSummary(tags);

  if (tagSummary.length === 0) {
    return <span className="text-[10px] text-slate-400 dark:text-slate-500">No tags</span>;
  }

  return (
    <>
      {tagSummary.map((tag) => (
        <span
          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          key={tag}
        >
          {tag}
        </span>
      ))}
    </>
  );
};

/** Dependency canvas todo card node */
export const DependencyCanvasTodoNode: FC<ThemedTodoNodeProps> = ({ data, onClick }) => {
  const todoData = data as DependencyTodoNodeData;
  const { todo, isHighlighted = false } = todoData;
  const blockedByCount = todoData.blockedByCount ?? todo.blockedBy?.length ?? 0;
  const childCount = todoData.childCount ?? 0;
  const badge = getStatusBadge(todoData);

  return (
    <div className="group relative">
      <button
        className={getTodoCardClassName(isHighlighted)}
        onClick={onClick}
        title={todo.title}
        type="button"
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
            {truncateTitle(todo.title)}
          </h4>
          <TodoStatusBadge badge={badge} />
        </div>

        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="truncate">{todo.context}</span>
          <span>•</span>
          <span>{formatDueDate(todo.due)}</span>
        </div>

        <div className="mb-2 flex flex-wrap gap-1">
          <TodoTagSummary tags={todo.tags} />
        </div>

        <div className="text-[10px] text-slate-500 dark:text-slate-400">
          <span className="font-medium">Dependencies:</span> blocked by {blockedByCount} • children{' '}
          {childCount}
        </div>
      </button>
    </div>
  );
};

/** Reuse default file node in this theme */
export const DependencyCanvasFileNode: FC<ThemedFileNodeProps> = DefaultFileNode;

/** Reuse default metadata node in this theme */
export const DependencyCanvasMetadataNode: FC<ThemedMetadataNodeProps> = DefaultMetadataNode;

/** Reuse default user node in this theme */
export const DependencyCanvasUserNode: FC<ThemedUserNodeProps> = DefaultUserNode;
