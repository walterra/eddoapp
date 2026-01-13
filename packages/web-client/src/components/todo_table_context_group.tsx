/**
 * Context group component for TodoTable
 * Renders a single context section with its todos and expandable subtask trees
 */
import type { Todo } from '@eddo/core-client';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { type FC, useCallback, useMemo, useRef, useState } from 'react';

import { useExpandedChildren } from '../hooks/use_expanded_children';
import { type SubtaskCount } from '../hooks/use_parent_child';
import { BulkDueDatePopover } from './bulk_due_date_popover';
import { FormattedMessage } from './formatted_message';
import { buildColumns, type TodoRowData } from './todo_table_columns';
import { ExpandableRows } from './todo_table_rows';

/** Minimum rows before virtualization kicks in */
const VIRTUALIZATION_THRESHOLD = 50;

export interface ContextGroupProps {
  context: string;
  contextTodos: Todo[];
  durationByContext: Record<string, string>;
  todoDurations: Map<string, number>;
  subtaskCounts: Map<string, SubtaskCount>;
  selectedColumns: string[];
  timeTrackingActive: string[];
}

/** Build row data from todos with computed values */
const useRowData = (
  contextTodos: Todo[],
  todoDurations: Map<string, number>,
  subtaskCounts: Map<string, SubtaskCount>,
): TodoRowData[] =>
  useMemo<TodoRowData[]>(
    () =>
      contextTodos.map((todo) => ({
        todo,
        duration: todoDurations.get(todo._id) ?? 0,
        subtaskCount: subtaskCounts.get(todo._id),
        isUpdating: false,
        error: null,
        onToggleCheckbox: () => {},
      })),
    [contextTodos, todoDurations, subtaskCounts],
  );

/** Hook for expansion state management */
const useExpansion = () => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { childrenByParent, childSubtaskCounts } = useExpandedChildren(expandedIds);

  const toggleExpanded = useCallback((todoId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(todoId)) {
        next.delete(todoId);
      } else {
        next.add(todoId);
      }
      return next;
    });
  }, []);

  return { expandedIds, childrenByParent, childSubtaskCounts, toggleExpanded };
};

export const ContextGroup: FC<ContextGroupProps> = (props) => {
  const { context, contextTodos, durationByContext, todoDurations, subtaskCounts } = props;
  const { selectedColumns, timeTrackingActive } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const { expandedIds, childrenByParent, childSubtaskCounts, toggleExpanded } = useExpansion();

  // Merge subtask counts: parent counts + counts for expanded children
  const allSubtaskCounts = useMemo(() => {
    const merged = new Map(subtaskCounts);
    for (const [id, count] of childSubtaskCounts) {
      merged.set(id, count);
    }
    return merged;
  }, [subtaskCounts, childSubtaskCounts]);

  const data = useRowData(contextTodos, todoDurations, allSubtaskCounts);
  const columns = useMemo(() => buildColumns(selectedColumns), [selectedColumns]);

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const rows = table.getRowModel().rows;

  return (
    <div className="mb-4">
      <ContextHeader context={context} duration={durationByContext[context]} />
      <TableContainer
        containerRef={containerRef}
        useVirtualization={rows.length > VIRTUALIZATION_THRESHOLD}
      >
        <table className="w-full table-fixed divide-y divide-neutral-200 dark:divide-neutral-700">
          <TableHead contextTodos={contextTodos} table={table} />
          <ExpandableRows
            childrenByParent={childrenByParent}
            columns={columns}
            containerRef={containerRef as React.RefObject<HTMLDivElement>}
            expandedIds={expandedIds}
            rows={rows}
            subtaskCounts={allSubtaskCounts}
            timeTrackingActive={timeTrackingActive.length > 0}
            todoDurations={todoDurations}
            toggleExpanded={toggleExpanded}
            useVirtualization={rows.length > VIRTUALIZATION_THRESHOLD}
          />
        </table>
      </TableContainer>
    </div>
  );
};

const ContextHeader: FC<{ context: string; duration: string }> = ({ context, duration }) => (
  <div className="mb-1 flex items-center justify-between">
    <h3 className="text-xs font-semibold tracking-wide text-neutral-700 uppercase dark:text-neutral-300">
      <FormattedMessage message={context} />
    </h3>
    <span className="text-xs text-neutral-500 dark:text-neutral-400">{duration}</span>
  </div>
);

interface TableContainerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  useVirtualization: boolean;
  children: React.ReactNode;
}

const TableContainer: FC<TableContainerProps> = ({ containerRef, useVirtualization, children }) => (
  <div
    className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
    ref={containerRef}
    style={{ maxHeight: useVirtualization ? '600px' : undefined, overflow: 'auto' }}
  >
    {children}
  </div>
);

interface TableHeadProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: ReturnType<typeof useReactTable<any>>;
  contextTodos: readonly Todo[];
}

const ACTIONS_WIDTH = 96;

const TableColGroup: FC<{ headers: { id: string; getSize: () => number }[] }> = ({ headers }) => (
  <colgroup>
    {headers.map((header) => {
      const width = header.id === 'title' ? undefined : header.getSize();
      return <col key={header.id} style={{ width: width ? `${width}px` : undefined }} />;
    })}
    <col style={{ width: `${ACTIONS_WIDTH}px` }} />
  </colgroup>
);

const TableHead: FC<TableHeadProps> = ({ table, contextTodos }) => {
  const headers = table.getHeaderGroups().flatMap((hg) => hg.headers);
  return (
    <>
      <TableColGroup headers={headers} />
      <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-700">
        <tr>
          {headers.map((header) => (
            <th
              className="px-2 py-1 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
              key={header.id}
            >
              <TableHeaderCell columnId={header.column.id} todos={contextTodos}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </TableHeaderCell>
            </th>
          ))}
          <th className="px-2 py-1 text-right text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
            Actions
          </th>
        </tr>
      </thead>
    </>
  );
};

interface TableHeaderCellProps {
  columnId: string;
  children: React.ReactNode;
  todos: readonly Todo[];
}

const TableHeaderCell: FC<TableHeaderCellProps> = ({ columnId, children, todos }) => {
  if (columnId === 'due') {
    return <BulkDueDatePopover todos={todos}>{children}</BulkDueDatePopover>;
  }
  return <>{children}</>;
};
