/**
 * Graph-based todo visualization using React Flow.
 * Displays todos as nodes with parent/child relationships and metadata groupings.
 */
import { type DatabaseError } from '@eddo/core-client';
import {
  applyNodeChanges,
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Spinner } from 'flowbite-react';
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './todo_graph.css';

import { useAuditForTodos } from '../hooks/use_audit_for_todos';
import { useAuditLogEntries } from '../hooks/use_audit_log_stream';
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
import { CurvedEdge } from './todo_graph_curved_edge';
import { FileNode } from './todo_graph_file_node';
import { createAllEdges, createAllNodes } from './todo_graph_helpers';
import { MetadataNode } from './todo_graph_metadata_node';
import { TodoNode } from './todo_graph_node';
import { UserNode } from './todo_graph_user_node';

interface TodoGraphProps {
  currentDate: Date;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeRange: TimeRange;
}

/** Custom node types for React Flow */
const nodeTypes = {
  todoNode: TodoNode,
  metadataNode: MetadataNode,
  fileNode: FileNode,
  userNode: UserNode,
};

/** Custom edge types for React Flow */
const edgeTypes = {
  curved: CurvedEdge,
};

interface GraphDataResult {
  nodes: Node[];
  edges: Edge[];
  displayError: DatabaseError | null;
  hasNoTodos: boolean;
  hasActiveFilters: boolean;
  showLoadingSpinner: boolean;
}

/** Merge audit entries from todo-linked and SSE stream sources */
const mergeAuditEntries = (
  todoLinked: ReturnType<typeof useAuditLogEntries>,
  sseStream: ReturnType<typeof useAuditLogEntries>,
): ReturnType<typeof useAuditLogEntries> => {
  const byId = new Map(todoLinked.map((e) => [e._id, e]));
  for (const entry of sseStream) {
    if (!byId.has(entry._id)) byId.set(entry._id, entry);
  }
  return Array.from(byId.values());
};

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

  // Fetch and merge audit entries from todo-linked and SSE sources
  const { entries: todoLinkedEntries } = useAuditForTodos({
    todos: filteredTodos,
    enabled: isInitialized && filteredTodos.length > 0,
  });
  const auditEntries = useMemo(
    () => mergeAuditEntries(todoLinkedEntries, useAuditLogEntries()),
    [todoLinkedEntries],
  );

  const nodes = useMemo(
    () => createAllNodes(filteredTodos, auditEntries),
    [filteredTodos, auditEntries],
  );
  const edges = useMemo(
    () => createAllEdges(filteredTodos, auditEntries),
    [filteredTodos, auditEntries],
  );
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

/** Apply highlight state to nodes */
const applyHighlight = (nodes: Node[], highlightedId: string | null): Node[] => {
  return nodes.map((node) => {
    if (node.type !== 'todoNode') return node;
    const isHighlighted = node.id === highlightedId;
    return {
      ...node,
      data: { ...node.data, isHighlighted },
    };
  });
};

interface GraphRendererProps {
  nodes: Node[];
  edges: Edge[];
  isLayouting: boolean;
  highlightedTodoId: string | null;
}

/** Inner component that can access useReactFlow */
const GraphRenderer: FC<GraphRendererProps> = ({
  nodes: layoutedNodes,
  edges,
  isLayouting,
  highlightedTodoId,
}) => {
  const { fitView } = useReactFlow();
  const [nodes, setNodes] = useState(() => applyHighlight(layoutedNodes, highlightedTodoId));

  // Update nodes when layout changes OR highlight changes
  useEffect(() => {
    setNodes(applyHighlight(layoutedNodes, highlightedTodoId));
  }, [layoutedNodes, highlightedTodoId]);

  // Handle node dragging
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Fit view whenever layouted nodes change (after layout completes)
  useEffect(() => {
    if (!isLayouting && layoutedNodes.length > 0) {
      const timer = setTimeout(() => fitView({ padding: 0.1, duration: 500 }), 50);
      return () => clearTimeout(timer);
    }
  }, [layoutedNodes, isLayouting, fitView]);

  if (isLayouting) {
    return (
      <div className="flex h-[calc(100vh-200px)] w-full items-center justify-center">
        <Spinner aria-label="Calculating layout" size="lg" />
        <span className="ml-3 text-neutral-600 dark:text-neutral-400">Arranging nodes...</span>
      </div>
    );
  }

  return (
    <ReactFlow
      className="h-full w-full"
      defaultEdgeOptions={{ type: 'curved' }}
      edgeTypes={edgeTypes}
      edges={edges}
      fitView
      maxZoom={4}
      minZoom={0.3}
      nodeTypes={nodeTypes}
      nodes={nodes}
      onNodesChange={onNodesChange}
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#94a3b8" gap={16} size={1} />
      <Controls className="!border-neutral-700 !bg-neutral-800 !shadow-lg [&>button]:!border-neutral-600 [&>button]:!bg-neutral-700 [&>button]:!fill-neutral-300 [&>button:hover]:!bg-neutral-600" />
    </ReactFlow>
  );
};

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
