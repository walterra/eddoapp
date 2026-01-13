/**
 * Context group component for TodoTable
 * Renders a single context section with its todos
 */
import type { Todo } from '@eddo/core-client';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { type FC, useMemo, useRef } from 'react';

import { type SubtaskCount } from '../hooks/use_parent_child';
import { BulkDueDatePopover } from './bulk_due_date_popover';
import { FormattedMessage } from './formatted_message';
import { buildColumns, type TodoRowData } from './todo_table_columns';
import { StandardRows, VirtualizedRows } from './todo_table_rows';

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
): TodoRowData[] => {
  return useMemo<TodoRowData[]>(() => {
    return contextTodos.map((todo) => ({
      todo,
      duration: todoDurations.get(todo._id) ?? 0,
      subtaskCount: subtaskCounts.get(todo._id),
      isUpdating: false,
      error: null,
      onToggleCheckbox: () => {},
    }));
  }, [contextTodos, todoDurations, subtaskCounts]);
};

export const ContextGroup: FC<ContextGroupProps> = ({
  context,
  contextTodos,
  durationByContext,
  todoDurations,
  subtaskCounts,
  selectedColumns,
  timeTrackingActive,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasActiveTimeTracking = timeTrackingActive.length > 0;

  const data = useRowData(contextTodos, todoDurations, subtaskCounts);
  const columns = useMemo(() => buildColumns(selectedColumns), [selectedColumns]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const useVirtualization = rows.length > VIRTUALIZATION_THRESHOLD;

  return (
    <div className="mb-4">
      <ContextHeader context={context} duration={durationByContext[context]} />
      <TableContainer containerRef={containerRef} useVirtualization={useVirtualization}>
        <table className="w-full table-fixed divide-y divide-neutral-200 dark:divide-neutral-700">
          <TableHead contextTodos={contextTodos} table={table} />
          {useVirtualization ? (
            <VirtualizedRows
              containerRef={containerRef as React.RefObject<HTMLDivElement>}
              rows={rows}
              timeTrackingActive={hasActiveTimeTracking}
              todoDurations={todoDurations}
            />
          ) : (
            <StandardRows
              rows={rows}
              timeTrackingActive={hasActiveTimeTracking}
              todoDurations={todoDurations}
            />
          )}
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

/** Column width in pixels, or undefined for flexible (title column) */
const ACTIONS_WIDTH = 96;

const TableColGroup: FC<{ headers: { id: string; getSize: () => number }[] }> = ({ headers }) => (
  <colgroup>
    {headers.map((header) => {
      // Title column is flexible - no explicit width
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

/** Header cell with optional bulk actions */
const TableHeaderCell: FC<TableHeaderCellProps> = ({ columnId, children, todos }) => {
  if (columnId === 'due') {
    return <BulkDueDatePopover todos={todos}>{children}</BulkDueDatePopover>;
  }
  return <>{children}</>;
};
