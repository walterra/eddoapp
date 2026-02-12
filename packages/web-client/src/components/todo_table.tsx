/**
 * Table view for todos grouped by context
 */
import { type DatabaseError } from '@eddo/core-client';
import { type FC, useCallback, useState } from 'react';

import { usePouchDb } from '../pouch_db';
import { DatabaseErrorFallback } from './database_error_fallback';
import { DatabaseErrorMessage } from './database_error_message';
import { EmptyState } from './empty_state';
import { useDbInitialization } from './todo_board_state';
import { TodoGraph } from './todo_graph';
import { LoadingSpinner, TodoTableContent } from './todo_table_content';
import { type TodoTableData, type TodoTableProps, useTableData } from './todo_table_data';

const TableErrorFallback: FC<{
  error: DatabaseError;
  onRetry: () => void;
}> = ({ error, onRetry }) => (
  <div className="bg-neutral-50 p-8 dark:bg-neutral-800">
    <DatabaseErrorFallback error={error} onDismiss={onRetry} onRetry={onRetry} />
  </div>
);

const DependencyGraphView: FC<{
  rootTodoId: string;
  onBackToTable: () => void;
  props: TodoTableProps;
}> = ({ rootTodoId, onBackToTable, props }) => (
  <TodoGraph
    currentDate={props.currentDate}
    dependencyRootTodoId={rootTodoId}
    onBackToTable={onBackToTable}
    selectedContexts={props.selectedContexts}
    selectedStatus={props.selectedStatus}
    selectedTags={props.selectedTags}
    selectedTimeRange={props.selectedTimeRange}
    selectedTimeTracking={props.selectedTimeTracking}
  />
);

const TableMainContent: FC<{
  data: TodoTableData;
  selectedColumns: string[];
  onDismissError: () => void;
  onShowDependencies: (todoId: string) => void;
}> = ({ data, selectedColumns, onDismissError, onShowDependencies }) => (
  <div className="bg-neutral-50 dark:bg-neutral-800">
    {data.displayError && data.todos.length > 0 ? (
      <div className="px-4 pt-2">
        <DatabaseErrorMessage error={data.displayError} onDismiss={onDismissError} />
      </div>
    ) : null}
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
        onShowDependencies={onShowDependencies}
        selectedColumns={selectedColumns}
        subtaskCounts={data.subtaskCounts}
        timeTrackingActive={data.timeTrackingActive}
        todoDurations={data.todoDurations}
      />
    )}
  </div>
);

export const TodoTable: FC<TodoTableProps> = (props) => {
  const { safeDb, rawDb } = usePouchDb();
  const { error, setError, isInitialized } = useDbInitialization(safeDb, rawDb);
  const data = useTableData(props, isInitialized, error);
  const [dependencyRootTodoId, setDependencyRootTodoId] = useState<string | null>(null);

  const handleShowDependencies = useCallback(
    (todoId: string) => setDependencyRootTodoId(todoId),
    [],
  );
  const handleBackToTable = useCallback(() => setDependencyRootTodoId(null), []);
  const handleRetry = useCallback(() => {
    setError(null);
    data.todosQuery.refetch();
    data.activitiesQuery.refetch();
  }, [setError, data.todosQuery, data.activitiesQuery]);

  if (data.displayError && data.todos.length === 0 && !data.isLoading) {
    return <TableErrorFallback error={data.displayError} onRetry={handleRetry} />;
  }

  if (data.showLoadingSpinner) {
    return <LoadingSpinner />;
  }

  if (dependencyRootTodoId) {
    return (
      <DependencyGraphView
        onBackToTable={handleBackToTable}
        props={props}
        rootTodoId={dependencyRootTodoId}
      />
    );
  }

  return (
    <TableMainContent
      data={data}
      onDismissError={() => setError(null)}
      onShowDependencies={handleShowDependencies}
      selectedColumns={props.selectedColumns}
    />
  );
};
