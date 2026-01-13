/**
 * Row rendering components for TodoTable
 * Provides expandable rows with nested children support
 */
import type { Todo } from '@eddo/core-client';
import { flexRender, type Row } from '@tanstack/react-table';
import { type FC } from 'react';

import { type SubtaskCount } from '../hooks/use_parent_child';
import { ChildRow } from './todo_table_child_row';
import { type TodoColumnDef, type TodoRowData } from './todo_table_columns';
import { ExpandToggle } from './todo_table_expand_toggle';
import { RowActions } from './todo_table_row_actions';

export interface ExpandableRowsProps {
  rows: Row<TodoRowData>[];
  todoDurations: Map<string, number>;
  subtaskCounts: Map<string, SubtaskCount>;
  timeTrackingActive: boolean;
  expandedIds: Set<string>;
  toggleExpanded: (todoId: string) => void;
  childrenByParent: Map<string, Todo[]>;
  columns: TodoColumnDef[];
  containerRef: React.RefObject<HTMLDivElement>;
  useVirtualization: boolean;
}

/** Expandable rows with nested children support */
export const ExpandableRows: FC<ExpandableRowsProps> = ({
  rows,
  todoDurations,
  subtaskCounts,
  timeTrackingActive,
  expandedIds,
  toggleExpanded,
  childrenByParent,
  columns,
}) => (
  <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-700 dark:bg-neutral-800">
    {rows.map((row) => (
      <ExpandableRow
        childrenByParent={childrenByParent}
        columns={columns}
        depth={0}
        expandedIds={expandedIds}
        key={row.id}
        row={row}
        subtaskCounts={subtaskCounts}
        timeTrackingActive={timeTrackingActive}
        todoDurations={todoDurations}
        toggleExpanded={toggleExpanded}
      />
    ))}
  </tbody>
);

interface ExpandableRowProps {
  row: Row<TodoRowData>;
  todoDurations: Map<string, number>;
  subtaskCounts: Map<string, SubtaskCount>;
  timeTrackingActive: boolean;
  expandedIds: Set<string>;
  toggleExpanded: (todoId: string) => void;
  childrenByParent: Map<string, Todo[]>;
  columns: TodoColumnDef[];
  depth: number;
}

/** Single expandable row with its children */
const ExpandableRow: FC<ExpandableRowProps> = ({
  row,
  todoDurations,
  subtaskCounts,
  timeTrackingActive,
  expandedIds,
  toggleExpanded,
  childrenByParent,
  columns,
  depth,
}) => {
  const todo = row.original.todo;
  const duration = todoDurations.get(todo._id) ?? 0;
  const subtaskCount = subtaskCounts.get(todo._id);
  const hasChildren = subtaskCount && subtaskCount.total > 0;
  const isExpanded = expandedIds.has(todo._id);
  const children = childrenByParent.get(todo._id) ?? [];

  return (
    <>
      <ParentRowCells
        depth={depth}
        duration={duration}
        hasChildren={!!hasChildren}
        isExpanded={isExpanded}
        row={row}
        timeTrackingActive={timeTrackingActive}
        todo={todo}
        toggleExpanded={toggleExpanded}
      />
      {isExpanded &&
        children.map((child) => (
          <ChildRow
            childrenByParent={childrenByParent}
            columns={columns}
            depth={depth + 1}
            expandedIds={expandedIds}
            key={child._id}
            subtaskCounts={subtaskCounts}
            timeTrackingActive={timeTrackingActive}
            todo={child}
            todoDurations={todoDurations}
            toggleExpanded={toggleExpanded}
          />
        ))}
    </>
  );
};

interface ParentRowCellsProps {
  row: Row<TodoRowData>;
  todo: Todo;
  duration: number;
  hasChildren: boolean;
  isExpanded: boolean;
  timeTrackingActive: boolean;
  toggleExpanded: (todoId: string) => void;
  depth: number;
}

/** Render cells for a parent row */
const ParentRowCells: FC<ParentRowCellsProps> = ({
  row,
  todo,
  duration,
  hasChildren,
  isExpanded,
  timeTrackingActive,
  toggleExpanded,
  depth,
}) => (
  <tr
    className={`border-b border-neutral-200 dark:border-neutral-700 ${
      depth === 1
        ? 'bg-black/[0.02] hover:bg-neutral-100 dark:bg-white/[0.02] dark:hover:bg-neutral-700'
        : depth === 2
          ? 'bg-black/[0.04] hover:bg-neutral-100 dark:bg-white/[0.04] dark:hover:bg-neutral-700'
          : depth >= 3
            ? 'bg-black/[0.06] hover:bg-neutral-100 dark:bg-white/[0.06] dark:hover:bg-neutral-700'
            : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
    }`}
  >
    {row.getVisibleCells().map((cell, index) => (
      <td className="px-2 py-1" key={cell.id}>
        {index === 1 ? (
          // Title column - add expand toggle and indentation here
          <div className="flex items-center">
            <ExpandToggle
              depth={depth}
              hasChildren={hasChildren}
              isExpanded={isExpanded}
              onToggle={() => toggleExpanded(todo._id)}
            />
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        ) : (
          flexRender(cell.column.columnDef.cell, cell.getContext())
        )}
      </td>
    ))}
    <RowActions timeTrackingActive={timeTrackingActive} todo={todo} todoDuration={duration} />
  </tr>
);

// Keep exports for backward compatibility
export { ExpandableRows as StandardRows, ExpandableRows as VirtualizedRows };
