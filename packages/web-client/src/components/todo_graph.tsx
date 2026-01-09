/**
 * Graph-based todo visualization using React Flow.
 * Displays todos as nodes with parent/child relationships as edges.
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import {
  Background,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Spinner } from 'flowbite-react';
import { type FC, useMemo } from 'react';

import { useForceLayout } from '../hooks/use_force_layout';
import { usePouchDb } from '../pouch_db';
import { DatabaseErrorFallback } from './database_error_fallback';
import { DatabaseErrorMessage } from './database_error_message';
import { EmptyState } from './empty_state';
import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';
import { calculateDateRange, filterTodosForGraph } from './todo_board_helpers';
import { useDbInitialization, useOutdatedTodos, useTodoBoardData } from './todo_board_state';
import { TodoNode } from './todo_graph_node';

interface TodoGraphProps {
  currentDate: Date;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeRange: TimeRange;
}

/** Convert todos to React Flow nodes */
function todosToNodes(todos: Todo[]): Node[] {
  return todos.map((todo, index) => ({
    id: todo._id,
    type: 'todoNode',
    position: { x: (index % 5) * 280, y: Math.floor(index / 5) * 120 },
    data: { todo },
  }));
}

/** Create edges from parent/child relationships */
function createEdges(todos: Todo[]): Edge[] {
  const edges: Edge[] = [];
  const todoMap = new Map(todos.map((t) => [t._id, t]));

  for (const todo of todos) {
    if (todo.parentId && todoMap.has(todo.parentId)) {
      edges.push({
        id: `${todo.parentId}-${todo._id}`,
        source: todo.parentId,
        target: todo._id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#64748b', strokeWidth: 2 },
      });
    }
  }

  return edges;
}

/** Custom node types for React Flow */
const nodeTypes = {
  todoNode: TodoNode,
};

interface GraphDataResult {
  nodes: Node[];
  edges: Edge[];
  displayError: DatabaseError | null;
  hasNoTodos: boolean;
  hasActiveFilters: boolean;
  showLoadingSpinner: boolean;
}

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

  const nodes = useMemo(() => todosToNodes(filteredTodos), [filteredTodos]);
  const edges = useMemo(() => createEdges(filteredTodos), [filteredTodos]);

  const hasNoTodos =
    filteredTodos.length === 0 &&
    !boardData.isLoading &&
    isInitialized &&
    boardData.todosQuery.isFetched;

  const hasActiveFilters =
    selectedTags.length > 0 || selectedContexts.length > 0 || selectedStatus !== 'all';

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

/** Graph content with React Flow and force-directed layout */
const TodoGraphContent: FC<{ nodes: Node[]; edges: Edge[] }> = ({
  nodes: initialNodes,
  edges: initialEdges,
}) => {
  const { nodes, edges, isLayouting } = useForceLayout(initialNodes, initialEdges);

  if (isLayouting) {
    return (
      <div className="flex h-[calc(100vh-200px)] w-full items-center justify-center">
        <Spinner aria-label="Calculating layout" size="lg" />
        <span className="ml-3 text-neutral-600 dark:text-neutral-400">Arranging nodes...</span>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] w-full">
      <ReactFlow
        defaultEdgeOptions={{ type: 'smoothstep' }}
        edges={edges}
        fitView
        nodeTypes={nodeTypes}
        nodes={nodes}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#94a3b8" gap={16} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

/** Main TodoGraph component */
export const TodoGraph: FC<TodoGraphProps> = (props) => {
  const { safeDb, rawDb } = usePouchDb();
  const { error, setError, isInitialized } = useDbInitialization(safeDb, rawDb);
  const data = useGraphData(props, isInitialized, error);

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
          <TodoGraphContent edges={data.edges} nodes={data.nodes} />
        </ReactFlowProvider>
      )}
    </div>
  );
};
