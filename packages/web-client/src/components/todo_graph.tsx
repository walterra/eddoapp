/**
 * Graph-based todo visualization using React Flow.
 * Displays todos as nodes with parent/child relationships and metadata groupings.
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import { type Edge, type Node, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Spinner } from 'flowbite-react';
import { type FC, useEffect, useMemo, useRef, useState } from 'react';
import './todo_graph.css';

import { useAuditForTodos } from '../hooks/use_audit_for_todos';
import {
  aggregateEntries,
  type AuditEntry,
  useAuditLogEntriesBySource,
} from '../hooks/use_audit_log_stream';
import { useForceLayout } from '../hooks/use_force_layout';
import { useHighlightContext } from '../hooks/use_highlight_context';
import { usePouchDb } from '../pouch_db';
import { DatabaseErrorFallback } from './database_error_fallback';
import { DatabaseErrorMessage } from './database_error_message';
import { EmptyState } from './empty_state';
import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';
import { calculateDateRange, filterTodosForGraph } from './todo_board_helpers';
import { useDbInitialization, useOutdatedTodos, useTodoBoardData } from './todo_board_state';
import { createAllEdges, createAllNodes } from './todo_graph_helpers';
import { GraphRenderer } from './todo_graph_renderer';

interface TodoGraphProps {
  currentDate: Date;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeRange: TimeRange;
}

interface GraphDataResult {
  nodes: Node[];
  edges: Edge[];
  displayError: DatabaseError | null;
  hasNoTodos: boolean;
  hasActiveFilters: boolean;
  showLoadingSpinner: boolean;
}

/** Merge audit entries from todo-linked and SSE stream sources */
const mergeAuditEntries = (todoLinked: AuditEntry[], sseStream: AuditEntry[]): AuditEntry[] => {
  const byId = new Map(todoLinked.map((e) => [e._id, e]));
  for (const entry of sseStream) {
    if (!byId.has(entry._id)) byId.set(entry._id, entry);
  }
  return Array.from(byId.values());
};

/** Hook to fetch and merge audit entries from multiple sources */
const useMergedAuditEntries = (todos: Todo[], isInitialized: boolean) => {
  const { entries: todoLinkedEntries } = useAuditForTodos({
    todos,
    enabled: isInitialized && todos.length > 0,
  });
  const sseStreamBuckets = useAuditLogEntriesBySource();
  const sseStreamEntries = useMemo(() => aggregateEntries(sseStreamBuckets), [sseStreamBuckets]);
  return useMemo(
    () => mergeAuditEntries(todoLinkedEntries, sseStreamEntries),
    [todoLinkedEntries, sseStreamEntries],
  );
};

interface GraphStatusParams {
  filteredTodos: Todo[];
  isLoading: boolean;
  isInitialized: boolean;
  isFetched: boolean;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
}

/** Compute derived state for empty/filter status */
const computeGraphStatus = (params: GraphStatusParams) => ({
  hasNoTodos:
    params.filteredTodos.length === 0 &&
    !params.isLoading &&
    params.isInitialized &&
    params.isFetched,
  hasActiveFilters:
    params.selectedTags.length > 0 ||
    params.selectedContexts.length > 0 ||
    params.selectedStatus !== 'all',
});

/** Hook for filtered graph data */
const useGraphData = (
  props: TodoGraphProps,
  isInitialized: boolean,
  error: DatabaseError | null,
): GraphDataResult & ReturnType<typeof useTodoBoardData> => {
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
  useOutdatedTodos(boardData.outdatedTodosMemo);

  const filteredTodos = useMemo(
    () => filterTodosForGraph(boardData.todos, selectedContexts, selectedStatus, selectedTags),
    [boardData.todos, selectedTags, selectedContexts, selectedStatus],
  );

  const auditEntries = useMergedAuditEntries(filteredTodos, isInitialized);
  const nodes = useMemo(
    () => createAllNodes(filteredTodos, auditEntries),
    [filteredTodos, auditEntries],
  );
  const edges = useMemo(
    () => createAllEdges(filteredTodos, auditEntries),
    [filteredTodos, auditEntries],
  );

  const { hasNoTodos, hasActiveFilters } = computeGraphStatus({
    filteredTodos,
    isLoading: boardData.isLoading,
    isInitialized,
    isFetched: boardData.todosQuery.isFetched,
    selectedTags,
    selectedContexts,
    selectedStatus,
  });

  return {
    ...boardData,
    nodes,
    edges,
    displayError: error || (boardData.queryError as DatabaseError | null),
    hasNoTodos,
    hasActiveFilters,
  };
};

/** Loading spinner component */
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

interface TodoGraphContentProps {
  nodes: Node[];
  edges: Edge[];
  highlightedTodoId: string | null;
}

/** Graph content with React Flow and force-directed layout */
const TodoGraphContent: FC<TodoGraphContentProps> = ({
  nodes: initialNodes,
  edges: initialEdges,
  highlightedTodoId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Measure container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    };

    // Use requestAnimationFrame to ensure layout is complete
    requestAnimationFrame(updateDimensions);
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Wait for dimensions before running layout - memoize to prevent re-layout on highlight
  const layoutOptions = useMemo(() => dimensions ?? { width: 1600, height: 800 }, [dimensions]);
  const { nodes, edges, isLayouting } = useForceLayout(initialNodes, initialEdges, layoutOptions);

  return (
    <div className="h-[calc(100vh-200px)] w-full" ref={containerRef}>
      <GraphRenderer
        edges={edges}
        highlightedTodoId={highlightedTodoId}
        isLayouting={isLayouting || !dimensions}
        nodes={nodes}
      />
    </div>
  );
};

/** Main TodoGraph component */
export const TodoGraph: FC<TodoGraphProps> = (props) => {
  const { safeDb, rawDb } = usePouchDb();
  const { error, setError, isInitialized } = useDbInitialization(safeDb, rawDb);
  const data = useGraphData(props, isInitialized, error);
  // Get highlight context here, outside ReactFlowProvider
  const { highlightedTodoId } = useHighlightContext();

  if (data.displayError && data.nodes.length === 0 && !data.isLoading) {
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
      {data.displayError && data.nodes.length > 0 && (
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
        <ReactFlowProvider>
          <TodoGraphContent
            edges={data.edges}
            highlightedTodoId={highlightedTodoId}
            nodes={data.nodes}
          />
        </ReactFlowProvider>
      )}
    </div>
  );
};
