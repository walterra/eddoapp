/**
 * Content components for TodoTable - handles rendering of table structure
 */
import type { Todo } from '@eddo/core-client';
import { Spinner } from 'flowbite-react';
import { type FC } from 'react';

import { type SubtaskCount } from '../hooks/use_parent_child';
import { BulkDueDatePopover } from './bulk_due_date_popover';
import { FormattedMessage } from './formatted_message';
import {
  getColumnLabel,
  getColumnWidthClass,
  reorderColumnsWithStatusFirst,
} from './todo_table_helpers';
import { TodoRow } from './todo_table_row';

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
}

export const TodoTableContent: FC<TodoTableContentProps> = ({
  groupedByContext,
  durationByContext,
  todoDurations,
  subtaskCounts,
  selectedColumns,
  timeTrackingActive,
}) => (
  <div className="overflow-x-auto py-2">
    {groupedByContext.map(([context, contextTodos]) => (
      <ContextGroup
        context={context}
        contextTodos={contextTodos}
        durationByContext={durationByContext}
        key={context}
        selectedColumns={selectedColumns}
        subtaskCounts={subtaskCounts}
        timeTrackingActive={timeTrackingActive}
        todoDurations={todoDurations}
      />
    ))}
  </div>
);

interface ContextGroupProps {
  context: string;
  contextTodos: Todo[];
  durationByContext: Record<string, string>;
  todoDurations: Map<string, number>;
  subtaskCounts: Map<string, SubtaskCount>;
  selectedColumns: string[];
  timeTrackingActive: string[];
}

const ContextGroup: FC<ContextGroupProps> = ({
  context,
  contextTodos,
  durationByContext,
  todoDurations,
  subtaskCounts,
  selectedColumns,
  timeTrackingActive,
}) => (
  <div className="mb-4">
    <ContextHeader context={context} duration={durationByContext[context]} />
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
      <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
        <TableHeader contextTodos={contextTodos} selectedColumns={selectedColumns} />
        <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-700 dark:bg-neutral-800">
          {contextTodos.map((todo) => (
            <TodoRow
              key={`${todo._id}-${todo._rev}`}
              selectedColumns={selectedColumns}
              subtaskCount={subtaskCounts.get(todo._id)}
              timeTrackingActive={timeTrackingActive.length > 0}
              todo={todo}
              todoDuration={todoDurations.get(todo._id) ?? 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ContextHeader: FC<{ context: string; duration: string }> = ({ context, duration }) => (
  <div className="mb-1 flex items-center justify-between">
    <h3 className="text-xs font-semibold tracking-wide text-neutral-700 uppercase dark:text-neutral-300">
      <FormattedMessage message={context} />
    </h3>
    <span className="text-xs text-neutral-500 dark:text-neutral-400">{duration}</span>
  </div>
);

interface TableHeaderProps {
  selectedColumns: string[];
  contextTodos: readonly Todo[];
}

/** Render column header content, with bulk action popover for due date column */
const ColumnHeaderContent: FC<{ columnId: string; contextTodos: readonly Todo[] }> = ({
  columnId,
  contextTodos,
}) => {
  const label = getColumnLabel(columnId);

  if (columnId === 'due') {
    return <BulkDueDatePopover todos={contextTodos}>{label}</BulkDueDatePopover>;
  }

  return <>{label}</>;
};

const TableHeader: FC<TableHeaderProps> = ({ selectedColumns, contextTodos }) => (
  <thead className="bg-neutral-50 dark:bg-neutral-700">
    <tr>
      {reorderColumnsWithStatusFirst(selectedColumns).map((columnId) => (
        <th
          className={`px-2 py-1 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400 ${getColumnWidthClass(columnId)}`}
          key={columnId}
          scope="col"
        >
          <ColumnHeaderContent columnId={columnId} contextTodos={contextTodos} />
        </th>
      ))}
      <th
        className="w-24 px-2 py-1 text-right text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
        scope="col"
      >
        Actions
      </th>
    </tr>
  </thead>
);
