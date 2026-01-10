/**
 * Helper functions for TodoGraph component.
 * Handles node/edge creation for todos and metadata.
 */
import type { AuditLogAlpha1, Todo } from '@eddo/core-shared';
import type { Edge, Node } from '@xyflow/react';

/** Metadata keys to visualize as nodes */
const METADATA_KEYS_TO_VISUALIZE = ['agent:session', 'agent:name'] as const;

/**
 * Extract a string value from metadata.
 * Returns undefined if the value is an array (arrays are not visualized as nodes).
 */
const getMetadataStringValue = (
  metadata: Record<string, string | string[]> | undefined,
  key: string,
): string | undefined => {
  const value = metadata?.[key];
  if (typeof value === 'string') return value;
  return undefined;
};

/** Generate unique ID for metadata node */
const getMetadataNodeId = (key: string, value: string): string =>
  `metadata:${key}:${value.replace(/[^a-zA-Z0-9-_]/g, '_')}`;

/** Node size range in pixels */
const MIN_NODE_SIZE = 24;
const MAX_NODE_SIZE = 56;

/** Get content length (description + title) */
const getContentLength = (todo: Todo): number => {
  const descLen = todo.description?.length ?? 0;
  const titleLen = todo.title?.length ?? 0;
  return descLen + titleLen;
};

/** Count children for each todo */
const countChildren = (todos: Todo[]): Map<string, number> => {
  const childCount = new Map<string, number>();
  for (const todo of todos) {
    if (todo.parentId) {
      childCount.set(todo.parentId, (childCount.get(todo.parentId) ?? 0) + 1);
    }
  }
  return childCount;
};

/** Calculate normalized size for a todo based on content length and child count */
const calculateNodeSize = (
  contentLen: number,
  childCount: number,
  minLen: number,
  maxLen: number,
): number => {
  if (maxLen === minLen) return (MIN_NODE_SIZE + MAX_NODE_SIZE) / 2;
  // Normalize content length
  const contentNorm = (contentLen - minLen) / (maxLen - minLen);
  // Boost for having children (each child adds 0.1, max 0.5 boost)
  const childBoost = Math.min(childCount * 0.1, 0.5);
  // Combine factors (content weight 0.7, child weight 0.3 when present)
  const combined = Math.min(contentNorm + childBoost, 1);
  return Math.round(MIN_NODE_SIZE + combined * (MAX_NODE_SIZE - MIN_NODE_SIZE));
};

/** Convert todos to React Flow nodes */
export function todosToNodes(todos: Todo[]): Node[] {
  // Calculate min/max content lengths
  const lengths = todos.map(getContentLength);
  const minLen = Math.min(...lengths);
  const maxLen = Math.max(...lengths);
  const childCounts = countChildren(todos);

  return todos.map((todo, index) => {
    const contentLen = getContentLength(todo);
    const children = childCounts.get(todo._id) ?? 0;
    const size = calculateNodeSize(contentLen, children, minLen, maxLen);

    return {
      id: todo._id,
      type: 'todoNode',
      position: { x: (index % 5) * 280, y: Math.floor(index / 5) * 120 },
      data: { todo, size },
    };
  });
}

/** Format audit action as readable text */
const formatAuditAction = (entry: AuditLogAlpha1): string => {
  const actionLabels: Record<string, string> = {
    create: 'Created task',
    update: 'Updated task',
    delete: 'Deleted task',
    complete: 'Completed task',
    uncomplete: 'Reopened task',
    time_tracking_start: 'Started tracking',
    time_tracking_stop: 'Stopped tracking',
  };
  const action = actionLabels[entry.action] || entry.action;
  const title = entry.after?.title || entry.before?.title;
  return title ? `${action}: ${title}` : action;
};

/**
 * Find the last audit activity for a session using the auditLog array on todos.
 * Uses direct audit ID lookup for reliability.
 */
const findLastMessageForSession = (
  sessionId: string,
  todos: Todo[],
  auditEntries: AuditLogAlpha1[],
): string | undefined => {
  // Find todos that belong to this session
  const sessionTodos = todos.filter(
    (todo) => getMetadataStringValue(todo.metadata, 'agent:session') === sessionId,
  );

  if (sessionTodos.length === 0) return undefined;

  // Collect all audit IDs from session todos (using the new auditLog field)
  const sessionAuditIds = new Set<string>();
  for (const todo of sessionTodos) {
    if (todo.auditLog) {
      for (const auditId of todo.auditLog) {
        sessionAuditIds.add(auditId);
      }
    }
  }

  // Find matching audit entries using direct ID lookup
  // Fall back to entityId matching if auditLog is empty (backward compatibility)
  let relevantEntries: AuditLogAlpha1[];

  if (sessionAuditIds.size > 0) {
    // New approach: direct audit ID lookup
    relevantEntries = auditEntries.filter((entry) => sessionAuditIds.has(entry._id));
  } else {
    // Fallback: match by entityId (for older data without auditLog)
    const sessionTodoIds = new Set(sessionTodos.map((t) => t._id));
    relevantEntries = auditEntries.filter((entry) => sessionTodoIds.has(entry.entityId));
  }

  if (relevantEntries.length === 0) return undefined;

  // Sort by timestamp descending and get the most recent
  const sorted = relevantEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const latest = sorted[0];

  // Return message if available, otherwise format the action
  return latest.message || formatAuditAction(latest);
};

/**
 * Find the last audit message for an agent name across ALL sessions.
 * Collects all audit IDs from all agent todos and finds the most recent.
 */
const findLastMessageForAgentName = (
  agentName: string,
  todos: Todo[],
  auditEntries: AuditLogAlpha1[],
): string | undefined => {
  // Find all todos for this agent
  const agentTodos = todos.filter(
    (t) => getMetadataStringValue(t.metadata, 'agent:name') === agentName,
  );

  if (agentTodos.length === 0) return undefined;

  // Collect ALL audit IDs from all agent todos
  const allAuditIds = new Set<string>();
  for (const todo of agentTodos) {
    if (todo.auditLog) {
      for (const auditId of todo.auditLog) {
        allAuditIds.add(auditId);
      }
    }
  }

  // Find matching audit entries
  let relevantEntries: AuditLogAlpha1[];

  if (allAuditIds.size > 0) {
    relevantEntries = auditEntries.filter((entry) => allAuditIds.has(entry._id));
  } else {
    // Fallback for older data
    const agentTodoIds = new Set(agentTodos.map((t) => t._id));
    relevantEntries = auditEntries.filter((entry) => agentTodoIds.has(entry.entityId));
  }

  if (relevantEntries.length === 0) return undefined;

  // Sort by timestamp descending and get the most recent
  const sorted = relevantEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const latest = sorted[0];

  return latest.message || formatAuditAction(latest);
};

/** Get last message for a metadata node */
const getLastMessageForMetadata = (
  key: string,
  value: string,
  todos: Todo[],
  auditEntries: AuditLogAlpha1[],
): string | undefined => {
  if (key === 'agent:session') {
    return findLastMessageForSession(value, todos, auditEntries);
  }
  if (key === 'agent:name') {
    return findLastMessageForAgentName(value, todos, auditEntries);
  }
  return undefined;
};

/** Extract unique metadata values and create nodes */
export function createMetadataNodes(todos: Todo[], auditEntries: AuditLogAlpha1[] = []): Node[] {
  const metadataMap = new Map<string, { key: string; value: string; todoIds: Set<string> }>();

  for (const todo of todos) {
    if (!todo.metadata) continue;

    for (const key of METADATA_KEYS_TO_VISUALIZE) {
      const value = getMetadataStringValue(todo.metadata, key);
      if (!value) continue;

      const nodeId = getMetadataNodeId(key, value);
      const existing = metadataMap.get(nodeId);

      if (existing) {
        existing.todoIds.add(todo._id);
      } else {
        metadataMap.set(nodeId, { key, value, todoIds: new Set([todo._id]) });
      }
    }
  }

  // Only create nodes for metadata shared by 2+ todos (more interesting groupings)
  const nodes: Node[] = [];
  let index = 0;

  for (const [nodeId, { key, value, todoIds }] of metadataMap) {
    if (todoIds.size >= 2) {
      // Find last message for agent-related nodes
      const lastMessage = getLastMessageForMetadata(key, value, todos, auditEntries);

      nodes.push({
        id: nodeId,
        type: 'metadataNode',
        position: { x: -200 + (index % 3) * 220, y: -150 + Math.floor(index / 3) * 100 },
        data: { metadataKey: key, metadataValue: value, todoCount: todoIds.size, lastMessage },
      });
      index++;
    }
  }

  return nodes;
}

/** Create edges from parent/child relationships */
export function createParentChildEdges(todos: Todo[]): Edge[] {
  const edges: Edge[] = [];
  const todoMap = new Map(todos.map((t) => [t._id, t]));

  for (const todo of todos) {
    if (todo.parentId && todoMap.has(todo.parentId)) {
      edges.push({
        id: `parent:${todo.parentId}-${todo._id}`,
        source: todo.parentId,
        sourceHandle: 'center',
        target: todo._id,
        targetHandle: 'center',
        type: 'curved',
        animated: false,
        style: { stroke: '#78716c', strokeWidth: 2 },
      });
    }
  }

  return edges;
}

/** Build metadata map from todos */
const buildMetadataMap = (todos: Todo[]): Map<string, Set<string>> => {
  const metadataMap = new Map<string, Set<string>>();

  for (const todo of todos) {
    if (!todo.metadata) continue;

    for (const key of METADATA_KEYS_TO_VISUALIZE) {
      const value = getMetadataStringValue(todo.metadata, key);
      if (!value) continue;

      const nodeId = getMetadataNodeId(key, value);
      const existing = metadataMap.get(nodeId);

      if (existing) {
        existing.add(todo._id);
      } else {
        metadataMap.set(nodeId, new Set([todo._id]));
      }
    }
  }

  return metadataMap;
};

/** Create a single metadata edge */
const createMetadataEdge = (
  metadataNodeId: string,
  todoId: string,
  isCompleted: boolean,
): Edge => ({
  id: `metadata:${metadataNodeId}-${todoId}`,
  source: metadataNodeId,
  sourceHandle: 'center',
  target: todoId,
  targetHandle: 'center',
  type: 'curved',
  animated: !isCompleted,
  style: {
    stroke: '#7c3aed',
    strokeWidth: 2,
    strokeDasharray: isCompleted ? undefined : '2,3',
  },
});

/** Create edges from metadata nodes to todos */
export function createMetadataEdges(todos: Todo[]): Edge[] {
  const edges: Edge[] = [];
  const todoMap = new Map(todos.map((t) => [t._id, t]));
  const metadataMap = buildMetadataMap(todos);

  for (const [metadataNodeId, todoIds] of metadataMap) {
    if (todoIds.size >= 2) {
      for (const todoId of todoIds) {
        const todo = todoMap.get(todoId);
        edges.push(createMetadataEdge(metadataNodeId, todoId, !!todo?.completed));
      }
    }
  }

  return edges;
}

/** Combine all nodes (todos + metadata) */
export function createAllNodes(todos: Todo[], auditEntries: AuditLogAlpha1[] = []): Node[] {
  const todoNodes = todosToNodes(todos);
  const metadataNodes = createMetadataNodes(todos, auditEntries);
  return [...metadataNodes, ...todoNodes];
}

/** Combine all edges (parent/child + metadata) */
export function createAllEdges(todos: Todo[]): Edge[] {
  const parentChildEdges = createParentChildEdges(todos);
  const metadataEdges = createMetadataEdges(todos);
  return [...parentChildEdges, ...metadataEdges];
}
