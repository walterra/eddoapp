/**
 * Table view for todos grouped by context
 */
import { type Activity, type DatabaseError, type Todo } from '@eddo/core-client';
import { format } from 'date-fns';
import { Spinner } from 'flowbite-react';
import { type FC, useMemo } from 'react';

import { usePouchDb } from '../pouch_db';
import { DatabaseErrorFallback } from './database_error_fallback';
import { DatabaseErrorMessage } from './database_error_message';
import { EmptyState } from './empty_state';
import { FormattedMessage } from './formatted_message';
import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';
import { calculateDateRange } from './todo_board_helpers';
import { useDbInitialization, useTodoBoardData } from './todo_board_state';
import {
  calculateDurationByContext,
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
  displayError: DatabaseError | null;
  hasNoTodos: boolean;
  hasActiveFilters: boolean;
}

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

  const filteredTodos = useMemo(
    () => filterTodos(boardData.todos, selectedContexts, selectedStatus, selectedTags),
    [boardData.todos, selectedTags, selectedContexts, selectedStatus],
  );

  const groupedByContext = useMemo(() => groupTodosByContext(filteredTodos), [filteredTodos]);
  const durationByContext = useMemo(
    () => calculateDurationByContext(boardData.activities as Activity[]),
    [boardData.activities],
  );

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
    displayError: error || (boardData.queryError as DatabaseError | null),
    hasNoTodos,
    hasActiveFilters,
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
          currentDate={props.currentDate}
          durationByContext={data.durationByContext}
          groupedByContext={data.groupedByContext}
          selectedColumns={props.selectedColumns}
          timeTrackingActive={data.timeTrackingActive}
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
  selectedColumns: string[];
  timeTrackingActive: string[];
  currentDate: Date;
}

const TodoTableContent: FC<TodoTableContentProps> = ({
  groupedByContext,
  durationByContext,
  selectedColumns,
  timeTrackingActive,
  currentDate,
}) => (
  <div className="overflow-x-auto px-4 py-2">
    {groupedByContext.map(([context, contextTodos]) => (
      <ContextGroup
        context={context}
        contextTodos={contextTodos}
        currentDate={currentDate}
        durationByContext={durationByContext}
        key={context}
        selectedColumns={selectedColumns}
        timeTrackingActive={timeTrackingActive}
      />
    ))}
  </div>
);

interface ContextGroupProps {
  context: string;
  contextTodos: Todo[];
  durationByContext: Record<string, string>;
  selectedColumns: string[];
  timeTrackingActive: string[];
  currentDate: Date;
}

const ContextGroup: FC<ContextGroupProps> = ({
  context,
  contextTodos,
  durationByContext,
  selectedColumns,
  timeTrackingActive,
  currentDate,
}) => (
  <div className="mb-4">
    <ContextHeader context={context} duration={durationByContext[context]} />
    <div className="overflow-hidden rounded border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800">
      <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
        <TableHeader selectedColumns={selectedColumns} />
        <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-700 dark:bg-neutral-800">
          {contextTodos.map((todo) => (
            <TodoRow
              activeDate={format(currentDate, 'yyyy-MM-dd')}
              key={`${todo._id}-${todo._rev}`}
              selectedColumns={selectedColumns}
              timeTrackingActive={timeTrackingActive.length > 0}
              todo={todo}
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

const TableHeader: FC<{ selectedColumns: string[] }> = ({ selectedColumns }) => (
  <thead className="bg-neutral-50 dark:bg-neutral-700">
    <tr>
      {reorderColumnsWithStatusFirst(selectedColumns).map((columnId) => (
        <th
          className={`px-2 py-1 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400 ${getColumnWidthClass(columnId)}`}
          key={columnId}
          scope="col"
        >
          {getColumnLabel(columnId)}
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
