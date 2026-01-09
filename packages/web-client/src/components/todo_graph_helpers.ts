/**
 * Helper functions for TodoGraph component.
 * Handles node/edge creation for todos and metadata.
 */
import type { Todo } from '@eddo/core-shared';
import type { Edge, Node } from '@xyflow/react';

/** Metadata keys to visualize as nodes */
const METADATA_KEYS_TO_VISUALIZE = ['agent:session', 'agent:name'] as const;

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

/** Extract unique metadata values and create nodes */
export function createMetadataNodes(todos: Todo[]): Node[] {
  const metadataMap = new Map<string, { key: string; value: string; todoIds: Set<string> }>();

  for (const todo of todos) {
    if (!todo.metadata) continue;

    for (const key of METADATA_KEYS_TO_VISUALIZE) {
      const value = todo.metadata[key];
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
      nodes.push({
        id: nodeId,
        type: 'metadataNode',
        position: { x: -200 + (index % 3) * 220, y: -150 + Math.floor(index / 3) * 100 },
        data: { metadataKey: key, metadataValue: value, todoCount: todoIds.size },
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
      const value = todo.metadata[key];
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
export function createAllNodes(todos: Todo[]): Node[] {
  const todoNodes = todosToNodes(todos);
  const metadataNodes = createMetadataNodes(todos);
  return [...metadataNodes, ...todoNodes];
}

/** Combine all edges (parent/child + metadata) */
export function createAllEdges(todos: Todo[]): Edge[] {
  const parentChildEdges = createParentChildEdges(todos);
  const metadataEdges = createMetadataEdges(todos);
  return [...parentChildEdges, ...metadataEdges];
}
