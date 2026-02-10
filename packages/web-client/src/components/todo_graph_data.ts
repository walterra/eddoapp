/**
 * Data hooks for TodoGraph.
 * Handles filtering, dependency mode selection, and node/edge creation.
 */
import { type DatabaseError, type Todo } from '@eddo/core-client';
import { type Edge, type Node } from '@xyflow/react';
import { useMemo } from 'react';

import { useAuditForTodos } from '../hooks/use_audit_for_todos';
import {
  aggregateEntries,
  type AuditEntry,
  useAuditLogEntriesBySource,
} from '../hooks/use_audit_log_stream';
import type { CompletionStatus } from './status_filter';
import type { TimeRange } from './time_range_filter';
import { calculateDateRange, type DateRange, filterTodosForGraph } from './todo_board_helpers';
import { useOutdatedTodos, useTodoBoardData } from './todo_board_state';
import { selectDependencyTodos } from './todo_dependency_graph_helpers';
import {
  createAllEdges,
  createAllNodes,
  createDependencyEdges,
  todosToNodes,
} from './todo_graph_helpers';

export interface TodoGraphDataProps {
  currentDate: Date;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTimeRange: TimeRange;
  dependencyRootTodoId?: string | null;
}

export interface GraphDataResult {
  nodes: Node[];
  edges: Edge[];
  displayError: DatabaseError | null;
  hasNoTodos: boolean;
  hasActiveFilters: boolean;
  showLoadingSpinner: boolean;
}

/** Merge audit entries from todo-linked and SSE stream sources */
const mergeAuditEntries = (todoLinked: AuditEntry[], sseStream: AuditEntry[]): AuditEntry[] => {
  const byId = new Map(todoLinked.map((entry) => [entry._id, entry]));

  for (const entry of sseStream) {
    if (!byId.has(entry._id)) {
      byId.set(entry._id, entry);
    }
  }

  return Array.from(byId.values());
};

/** Fetch and merge audit entries from todo-linked and stream sources */
const useMergedAuditEntries = (todos: Todo[], isInitialized: boolean): AuditEntry[] => {
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
  displayTodos: Todo[];
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
    params.displayTodos.length === 0 &&
    !params.isLoading &&
    params.isInitialized &&
    params.isFetched,
  hasActiveFilters:
    params.selectedTags.length > 0 ||
    params.selectedContexts.length > 0 ||
    params.selectedStatus !== 'all',
});

interface DisplayTodosParams {
  todos: Todo[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
  selectedTags: string[];
  dependencyRootTodoId?: string | null;
}

/** Apply dependency focus if dependencyRootTodoId is provided, bypassing status/context/tag filters */
const useDisplayTodos = (params: DisplayTodosParams): Todo[] => {
  const { todos, selectedContexts, selectedStatus, selectedTags, dependencyRootTodoId } = params;

  const filteredTodos = useMemo(
    () => filterTodosForGraph(todos, selectedContexts, selectedStatus, selectedTags),
    [todos, selectedTags, selectedContexts, selectedStatus],
  );

  return useMemo(() => {
    if (!dependencyRootTodoId) {
      return filteredTodos;
    }

    return selectDependencyTodos(todos, dependencyRootTodoId);
  }, [filteredTodos, todos, dependencyRootTodoId]);
};

/** Build graph nodes for full or dependency-focused mode */
const createGraphNodes = (
  todos: Todo[],
  auditEntries: AuditEntry[],
  dependencyRootTodoId?: string | null,
): Node[] => {
  if (!dependencyRootTodoId) {
    return createAllNodes(todos, auditEntries);
  }

  return todosToNodes(todos).map((node) => {
    if (node.type !== 'todoNode') {
      return node;
    }

    return {
      ...node,
      data: {
        ...node.data,
        showActions: true,
      },
    };
  });
};

/** Build graph edges for full or dependency-focused mode */
const createGraphEdges = (
  todos: Todo[],
  auditEntries: AuditEntry[],
  dependencyRootTodoId?: string | null,
): Edge[] => {
  if (!dependencyRootTodoId) {
    return createAllEdges(todos, auditEntries);
  }

  return createDependencyEdges(todos);
};

interface GraphScope {
  boardData: ReturnType<typeof useTodoBoardData>;
  displayTodos: Todo[];
  dependencyRootTodoId?: string | null;
  selectedTags: string[];
  selectedContexts: string[];
  selectedStatus: CompletionStatus;
}

/** Build date range for graph data queries */
export const resolveGraphDateRange = (
  currentDate: Date,
  selectedTimeRange: TimeRange,
  dependencyRootTodoId?: string | null,
): DateRange => {
  if (dependencyRootTodoId) {
    return { startDate: '2000-01-01', endDate: '2099-12-31' };
  }

  return calculateDateRange(currentDate, selectedTimeRange);
};

/** Build graph scope from filters and board data */
const useGraphScope = (props: TodoGraphDataProps, isInitialized: boolean): GraphScope => {
  const {
    currentDate,
    selectedTags,
    selectedContexts,
    selectedStatus,
    selectedTimeRange,
    dependencyRootTodoId,
  } = props;

  const dateRange = useMemo(
    () => resolveGraphDateRange(currentDate, selectedTimeRange, dependencyRootTodoId),
    [currentDate, selectedTimeRange, dependencyRootTodoId],
  );

  const boardData = useTodoBoardData({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    isInitialized,
  });
  useOutdatedTodos(boardData.outdatedTodosMemo);

  const displayTodos = useDisplayTodos({
    todos: boardData.todos,
    selectedContexts,
    selectedStatus,
    selectedTags,
    dependencyRootTodoId,
  });

  return {
    boardData,
    displayTodos,
    dependencyRootTodoId,
    selectedTags,
    selectedContexts,
    selectedStatus,
  };
};

/** Build filtered graph data for TodoGraph */
export const useGraphData = (
  props: TodoGraphDataProps,
  isInitialized: boolean,
  error: DatabaseError | null,
): GraphDataResult & ReturnType<typeof useTodoBoardData> => {
  const scope = useGraphScope(props, isInitialized);
  const auditEntries = useMergedAuditEntries(scope.displayTodos, isInitialized);

  const nodes = useMemo(
    () => createGraphNodes(scope.displayTodos, auditEntries, scope.dependencyRootTodoId),
    [scope.displayTodos, auditEntries, scope.dependencyRootTodoId],
  );
  const edges = useMemo(
    () => createGraphEdges(scope.displayTodos, auditEntries, scope.dependencyRootTodoId),
    [scope.displayTodos, auditEntries, scope.dependencyRootTodoId],
  );

  const { hasNoTodos, hasActiveFilters } = computeGraphStatus({
    displayTodos: scope.displayTodos,
    isLoading: scope.boardData.isLoading,
    isInitialized,
    isFetched: scope.boardData.todosQuery.isFetched,
    selectedTags: scope.selectedTags,
    selectedContexts: scope.selectedContexts,
    selectedStatus: scope.selectedStatus,
  });

  return {
    ...scope.boardData,
    nodes,
    edges,
    displayError: error || (scope.boardData.queryError as DatabaseError | null),
    hasNoTodos,
    hasActiveFilters,
  };
};
