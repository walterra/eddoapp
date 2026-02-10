/**
 * Content components for TodoTable - handles rendering of table structure
 * Uses TanStack Table for column management and optional virtualization
 */
import type { Todo } from '@eddo/core-client';
import { Spinner } from 'flowbite-react';
import { type FC } from 'react';

import { type SubtaskCount } from '../hooks/use_parent_child';
import { ContextGroup } from './todo_table_context_group';

export const LoadingSpinner: FC = () => (
  <div
    aria-label="Loading todos"
    className="flex min-h-64 items-center justify-center bg-neutral-50 dark:bg-neutral-800"
    role="status"
  >
    <Spinner aria-label="Loading" size="lg" />
    <span className="ml-3 text-neutral-600 dark:text-neutral-400">Loading todos...</span>
  </div>
);

export interface TodoTableContentProps {
  groupedByContext: Array<[string, Todo[]]>;
  durationByContext: Record<string, string>;
  todoDurations: Map<string, number>;
  subtaskCounts: Map<string, SubtaskCount>;
  selectedColumns: string[];
  timeTrackingActive: string[];
  onShowDependencies?: (todoId: string) => void;
}

export const TodoTableContent: FC<TodoTableContentProps> = ({
  groupedByContext,
  durationByContext,
  todoDurations,
  subtaskCounts,
  selectedColumns,
  timeTrackingActive,
  onShowDependencies,
}) => (
  <div className="overflow-x-auto py-2">
    {groupedByContext.map(([context, contextTodos]) => (
      <ContextGroup
        context={context}
        contextTodos={contextTodos}
        durationByContext={durationByContext}
        key={context}
        onShowDependencies={onShowDependencies}
        selectedColumns={selectedColumns}
        subtaskCounts={subtaskCounts}
        timeTrackingActive={timeTrackingActive}
        todoDurations={todoDurations}
      />
    ))}
  </div>
);
