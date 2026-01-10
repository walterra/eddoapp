/**
 * Helper functions for creating user nodes in the graph.
 * Shows the current user as a node connected to todos they modified via web UI.
 */
import type { AuditLogAlpha1, Todo } from '@eddo/core-shared';
import type { Edge, Node } from '@xyflow/react';

/** User node ID constant */
const USER_NODE_ID = 'user:you';

/** Find all todo IDs that were modified by the user via web UI */
const findUserModifiedTodoIds = (todos: Todo[], auditEntries: AuditLogAlpha1[]): Set<string> => {
  const todoIds = new Set(todos.map((t) => t._id));
  const userModifiedIds = new Set<string>();

  for (const entry of auditEntries) {
    // Only consider web source (user actions in browser)
    if (entry.source === 'web' && todoIds.has(entry.entityId)) {
      userModifiedIds.add(entry.entityId);
    }
  }

  return userModifiedIds;
};

/** Get the last message from user's web actions */
const findLastUserMessage = (auditEntries: AuditLogAlpha1[]): string | undefined => {
  // Find most recent web action with a message
  const webEntries = auditEntries
    .filter((e) => e.source === 'web' && e.message)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return webEntries[0]?.message;
};

/**
 * Create user node if user has modified any todos via web UI.
 * Returns empty array if no web modifications found.
 */
export function createUserNodes(todos: Todo[], auditEntries: AuditLogAlpha1[]): Node[] {
  const userModifiedIds = findUserModifiedTodoIds(todos, auditEntries);

  // Only create node if user has modified at least one todo
  if (userModifiedIds.size === 0) {
    return [];
  }

  const lastMessage = findLastUserMessage(auditEntries);

  return [
    {
      id: USER_NODE_ID,
      type: 'userNode',
      position: { x: -300, y: 0 }, // Will be repositioned by force layout
      data: {
        label: 'You',
        todoCount: userModifiedIds.size,
        lastMessage,
      },
    },
  ];
}

/** Create edge from user node to a todo */
const createUserEdge = (todoId: string, isCompleted: boolean): Edge => ({
  id: `user:${USER_NODE_ID}-${todoId}`,
  source: USER_NODE_ID,
  sourceHandle: 'center',
  target: todoId,
  targetHandle: 'center',
  type: 'curved',
  animated: false,
  style: {
    stroke: '#0ea5e9', // sky-500 for user connections
    strokeWidth: 1.5,
    opacity: isCompleted ? 0.4 : 0.8,
  },
});

/**
 * Create edges from user node to todos they modified.
 */
export function createUserEdges(todos: Todo[], auditEntries: AuditLogAlpha1[]): Edge[] {
  const userModifiedIds = findUserModifiedTodoIds(todos, auditEntries);

  if (userModifiedIds.size === 0) {
    return [];
  }

  const todoMap = new Map(todos.map((t) => [t._id, t]));
  const edges: Edge[] = [];

  for (const todoId of userModifiedIds) {
    const todo = todoMap.get(todoId);
    if (todo) {
      edges.push(createUserEdge(todoId, !!todo.completed));
    }
  }

  return edges;
}
