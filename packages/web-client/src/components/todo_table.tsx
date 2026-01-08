/**
 * Table view for todos grouped by context
 */
import { type Activity, type DatabaseError, type Todo } from '@eddo/core-client';
import { Spinner } from 'flowbite-react';
import { type FC, useMemo } from 'react';

import { usePouchDb } from '../pouch_db';
import { BulkDueDatePopover } from './bulk_due_date_popover';
import { DatabaseErrorFallback } from './database_error_fallback';
import { DatabaseErrorMessage } from './database_error_message';
import { EmptyState } from './empty_state';
import { FormattedMessage } from './formatted_message';
import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';
import { calculateDateRange, type DateRange } from './todo_board_helpers';
import { useDbInitialization, useTodoBoardData } from './todo_board_state';
import {
  calculateDurationByContext,
  calculateTodoDurations,
  filterActivities,
  filterTodos,
  getColumnLabel,
  getColumnWidthClass,
  groupTodosByContext,
  reorderColumnsWithStatusFirst,
} from './todo_table_helpers';
import { TodoRow } from './todo_table_row';

interface TodoTableProps {
  currentDate: Date;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeRange: TimeRange;
  selectedColumns: string[];
}

interface TableDataResult {
  groupedByContext: Array<[string, Todo[]]>;
  durationByContext: Record<string, string>;
  todoDurations: Map<string, number>;
  displayError: DatabaseError | null;
  hasNoTodos: boolean;
  hasActiveFilters: boolean;
  dateRange: DateRange;
}

interface FilterParams {
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
}

interface FilteredDataParams extends FilterParams {
  startDate: string;
  endDate: string;
}

/** Filters and groups todos/activities based on user selection */
const useFilteredData = (
  boardData: ReturnType<typeof useTodoBoardData>,
  params: FilteredDataParams,
) => {
  const { selectedTags, selectedContexts, selectedStatus, startDate, endDate } = params;

  const filteredTodos = useMemo(
    () => filterTodos(boardData.todos, selectedContexts, selectedStatus, selectedTags),
    [boardData.todos, selectedTags, selectedContexts, selectedStatus],
  );

  const filteredActivities = useMemo(
    () =>
      filterActivities(
        boardData.activities as Activity[],
        selectedContexts,
        selectedStatus,
        selectedTags,
      ),
    [boardData.activities, selectedContexts, selectedStatus, selectedTags],
  );

  const groupedByContext = useMemo(() => groupTodosByContext(filteredTodos), [filteredTodos]);

  // Calculate duration per todo (own + child time)
  const todoDurations = useMemo(
    () => calculateTodoDurations(filteredTodos, filteredActivities, startDate, endDate),
    [filteredTodos, filteredActivities, startDate, endDate],
  );

  // Context totals = sum of visible todo durations
  const durationByContext = useMemo(
    () => calculateDurationByContext(todoDurations, filteredTodos),
    [todoDurations, filteredTodos],
  );

  return { filteredTodos, groupedByContext, durationByContext, todoDurations };
};

const useTableData = (
  props: TodoTableProps,
  isInitialized: boolean,
  error: DatabaseError | null,
): TableDataResult & ReturnType<typeof useTodoBoardData> => {
  const { currentDate, selectedTags, selectedContexts, selectedStatus, selectedTimeRange } = props;

  const dateRange = useMemo(
    () => calculateDateRange(currentDate, selectedTimeRange),
    [currentDate, selectedTimeRange],
  );

  const boardData = useTodoBoardData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    isInitialized,
  });

  const startDateStr = dateRange.startDate.toISOString().split('T')[0];
  const endDateStr = dateRange.endDate.toISOString().split('T')[0];

  const { groupedByContext, durationByContext, todoDurations } = useFilteredData(boardData, {
    selectedTags,
    selectedContexts,
    selectedStatus,
    startDate: startDateStr,
    endDate: endDateStr,
  });

  const hasNoTodos =
    groupedByContext.length === 0 &&
    !boardData.isLoading &&
    isInitialized &&
    boardData.todosQuery.isFetched;

  const hasActiveFilters =
    selectedTags.length > 0 || selectedContexts.length > 0 || selectedStatus !== 'all';

  return {
    ...boardData,
    groupedByContext,
    durationByContext,
    todoDurations,
    displayError: error || (boardData.queryError as DatabaseError | null),
    hasNoTodos,
    hasActiveFilters,
    dateRange,
  };
};

export const TodoTable: FC<TodoTableProps> = (props) => {
  const { safeDb, rawDb } = usePouchDb();
  const { error, setError, isInitialized } = useDbInitialization(safeDb, rawDb);
  const data = useTableData(props, isInitialized, error);

  if (data.displayError && data.todos.length === 0 && !data.isLoading) {
    const handleError = () => {
      setError(null);
      data.todosQuery.refetch();
      data.activitiesQuery.refetch();
    };
    return (
      <div className="bg-neutral-50 p-8 dark:bg-neutral-800">
        <DatabaseErrorFallback
          error={data.displayError}
          onDismiss={handleError}
          onRetry={handleError}
        />
      </div>
    );
  }

  if (data.showLoadingSpinner) return <LoadingSpinner />;

  return (
    <div className="bg-neutral-50 dark:bg-neutral-800">
      {data.displayError && data.todos.length > 0 && (
        <div className="px-4 pt-2">
          <DatabaseErrorMessage error={data.displayError} onDismiss={() => setError(null)} />
        </div>
      )}
      {data.hasNoTodos ? (
        <EmptyState
          description={
            data.hasActiveFilters
              ? 'Try adjusting your filters or select a different time range.'
              : 'Get started by adding your first todo above.'
          }
          title="No todos found"
        />
      ) : (
        <TodoTableContent
          durationByContext={data.durationByContext}
          groupedByContext={data.groupedByContext}
          selectedColumns={props.selectedColumns}
          timeTrackingActive={data.timeTrackingActive}
          todoDurations={data.todoDurations}
        />
      )}
    </div>
  );
};

const LoadingSpinner: FC = () => (
  <div
    aria-label="Loading todos"
    className="flex min-h-64 items-center justify-center bg-neutral-50 dark:bg-neutral-800"
    role="status"
  >
    <Spinner aria-label="Loading" size="lg" />
    <span className="ml-3 text-neutral-600 dark:text-neutral-400">Loading todos...</span>
  </div>
);

interface TodoTableContentProps {
  groupedByContext: Array<[string, Todo[]]>;
  durationByContext: Record<string, string>;
  todoDurations: Map<string, number>;
  selectedColumns: string[];
  timeTrackingActive: string[];
}

const TodoTableContent: FC<TodoTableContentProps> = ({
  groupedByContext,
  durationByContext,
  todoDurations,
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
  selectedColumns: string[];
  timeTrackingActive: string[];
}

const ContextGroup: FC<ContextGroupProps> = ({
  context,
  contextTodos,
  durationByContext,
  todoDurations,
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

/**
 * Render column header content, with bulk action popover for due date column
 */
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
