/**
 * Helper functions for TodoGraph component.
 * Handles node/edge creation for todos and metadata.
 */
import type { Todo } from '@eddo/core-shared';
import type { Edge, Node } from '@xyflow/react';

/** Metadata keys to visualize as nodes */
const METADATA_KEYS_TO_VISUALIZE = ['agent:session', 'agent:branch', 'agent:name'] as const;

/** Generate unique ID for metadata node */
const getMetadataNodeId = (key: string, value: string): string =>
  `metadata:${key}:${value.replace(/[^a-zA-Z0-9-_]/g, '_')}`;

/** Convert todos to React Flow nodes */
export function todosToNodes(todos: Todo[]): Node[] {
  return todos.map((todo, index) => ({
    id: todo._id,
    type: 'todoNode',
    position: { x: (index % 5) * 280, y: Math.floor(index / 5) * 120 },
    data: { todo },
  }));
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
        style: { stroke: '#64748b', strokeWidth: 2, strokeOpacity: 0.7 },
      });
    }
  }

  return edges;
}

/** Create edges from metadata nodes to todos */
export function createMetadataEdges(todos: Todo[]): Edge[] {
  const edges: Edge[] = [];
  const metadataMap = new Map<string, Set<string>>();

  // First pass: collect todos per metadata value
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

  // Second pass: create edges only for metadata with 2+ todos
  for (const [metadataNodeId, todoIds] of metadataMap) {
    if (todoIds.size >= 2) {
      for (const todoId of todoIds) {
        edges.push({
          id: `metadata:${metadataNodeId}-${todoId}`,
          source: metadataNodeId,
          sourceHandle: 'center',
          target: todoId,
          targetHandle: 'center',
          type: 'curved',
          animated: true,
          style: {
            stroke: '#a855f7',
            strokeWidth: 1.5,
            strokeOpacity: 0.5,
            strokeDasharray: '5,5',
          },
        });
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
