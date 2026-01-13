/**
 * Child row component for expanded subtasks
 * Supports recursive (fractal) expansion to any depth
 */
import type { Todo } from '@eddo/core-client';
import { flexRender, type ColumnDef } from '@tanstack/react-table';
import { type FC } from 'react';

import { type SubtaskCount } from '../hooks/use_parent_child';
import { type TodoRowData } from './todo_table_columns';
import { ExpandToggle } from './todo_table_expand_toggle';
import { RowActions } from './todo_table_row_actions';

export interface ChildRowProps {
  todo: Todo;
  todoDurations: Map<string, number>;
  subtaskCounts: Map<string, SubtaskCount>;
  timeTrackingActive: boolean;
  expandedIds: Set<string>;
  toggleExpanded: (todoId: string) => void;
  childrenByParent: Map<string, Todo[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TodoRowData, any>[];
  depth: number;
}

/** Build row data for child todo */
const buildRowData = (
  todo: Todo,
  duration: number,
  subtaskCount: SubtaskCount | undefined,
): TodoRowData => ({
  todo,
  duration,
  subtaskCount,
  isUpdating: false,
  error: null,
  onToggleCheckbox: () => {},
});

/** Maximum nesting depth to prevent infinite recursion */
const MAX_DEPTH = 10;

/** Child row - renders a todo with recursive expansion support */
export const ChildRow: FC<ChildRowProps> = (props) => {
  const { todo, todoDurations, subtaskCounts, expandedIds, childrenByParent, columns, depth } =
    props;
  const { timeTrackingActive, toggleExpanded } = props;

  const duration = todoDurations.get(todo._id) ?? 0;
  const subtaskCount = subtaskCounts.get(todo._id);
  const isExpanded = expandedIds.has(todo._id) && depth < MAX_DEPTH;
  const children = childrenByParent.get(todo._id) ?? [];
  // Show expand icon if we have children loaded OR if subtask count indicates children exist
  const hasChildren =
    (children.length > 0 || (subtaskCount && subtaskCount.total > 0)) && depth < MAX_DEPTH;
  const rowData = buildRowData(todo, duration, subtaskCount);

  return (
    <>
      <ChildRowCells
        columns={columns}
        depth={depth}
        duration={duration}
        hasChildren={!!hasChildren}
        isExpanded={isExpanded}
        rowData={rowData}
        timeTrackingActive={timeTrackingActive}
        todo={todo}
        toggleExpanded={toggleExpanded}
      />
      {isExpanded &&
        children.map((child) => (
          <ChildRow {...props} depth={depth + 1} key={child._id} todo={child} />
        ))}
    </>
  );
};

/** Returns Tailwind classes for row depth-based styling */
const getDepthClasses = (depth: number): string => {
  const base = 'border-b border-neutral-200 dark:border-neutral-700';
  const depthStyles: Record<number, string> = {
    1: 'bg-black/[0.02] hover:bg-neutral-100 dark:bg-white/[0.02] dark:hover:bg-neutral-700',
    2: 'bg-black/[0.04] hover:bg-neutral-100 dark:bg-white/[0.04] dark:hover:bg-neutral-700',
    3: 'bg-black/[0.06] hover:bg-neutral-100 dark:bg-white/[0.06] dark:hover:bg-neutral-700',
  };
  return `${base} ${depthStyles[Math.min(depth, 3)] ?? 'hover:bg-neutral-50 dark:hover:bg-neutral-700'}`;
};

/** Creates cell context for rendering column cells */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createCellContext = (
  rowData: TodoRowData,
  column: ColumnDef<TodoRowData, any>,
  index: number,
) => ({
  row: { original: rowData },
  getValue: () =>
    'accessorFn' in column && column.accessorFn ? column.accessorFn(rowData, index) : undefined,
});

interface ChildRowCellsProps {
  rowData: TodoRowData;
  todo: Todo;
  duration: number;
  hasChildren: boolean;
  isExpanded: boolean;
  timeTrackingActive: boolean;
  toggleExpanded: (todoId: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TodoRowData, any>[];
  depth: number;
}

/** Render cells for a child row */
const ChildRowCells: FC<ChildRowCellsProps> = (props) => {
  const { rowData, todo, duration, hasChildren, isExpanded, timeTrackingActive } = props;
  const { toggleExpanded, columns, depth } = props;

  return (
    <tr className={getDepthClasses(depth)}>
      {columns.map((column, index) => (
        <td className="px-2 py-1" key={column.id}>
          {index === 1 ? (
            <div className="flex items-center">
              <ExpandToggle
                depth={depth}
                hasChildren={hasChildren}
                isExpanded={isExpanded}
                onToggle={() => toggleExpanded(todo._id)}
              />
              {column.cell
                ? flexRender(column.cell, createCellContext(rowData, column, index) as never)
                : null}
            </div>
          ) : column.cell ? (
            flexRender(column.cell, createCellContext(rowData, column, index) as never)
          ) : null}
        </td>
      ))}
      <RowActions timeTrackingActive={timeTrackingActive} todo={todo} todoDuration={duration} />
    </tr>
  );
};
