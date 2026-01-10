/**
 * Helper functions for file nodes in TodoGraph.
 * Handles extraction of agent:files metadata and node/edge creation.
 * File nodes connect to agent session nodes (not directly to todos).
 */
import type { Todo } from '@eddo/core-shared';
import type { Edge, Node } from '@xyflow/react';

/**
 * Extract an array value from metadata.
 * Handles both array values and comma-separated strings.
 */
const getMetadataArrayValue = (
  metadata: Record<string, string | string[]> | undefined,
  key: string,
): string[] | undefined => {
  const value = metadata?.[key];
  if (Array.isArray(value)) return value;
  // Handle comma-separated string (for compatibility)
  if (typeof value === 'string' && value.length > 0) {
    return value.split(',').map((s) => s.trim());
  }
  return undefined;
};

/**
 * Extract a string value from metadata.
 */
const getMetadataStringValue = (
  metadata: Record<string, string | string[]> | undefined,
  key: string,
): string | undefined => {
  const value = metadata?.[key];
  if (typeof value === 'string') return value;
  return undefined;
};

/** Generate unique ID for file node */
const getFileNodeId = (filePath: string): string =>
  `file:${filePath.replace(/[^a-zA-Z0-9-_./]/g, '_')}`;

/** Generate metadata node ID (must match todo_graph_helpers.ts) */
const getMetadataNodeId = (key: string, value: string): string =>
  `metadata:${key}:${value.replace(/[^a-zA-Z0-9-_]/g, '_')}`;

/** Extract filename from path */
const getFileName = (filePath: string): string => {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
};

interface FileInfo {
  filePath: string;
  sessionIds: Set<string>;
}

/** Build file-to-sessions map from todos */
const buildFileToSessionsMap = (todos: Todo[]): Map<string, FileInfo> => {
  const fileData = new Map<string, FileInfo>();

  for (const todo of todos) {
    const files = getMetadataArrayValue(todo.metadata, 'agent:files');
    const sessionId = getMetadataStringValue(todo.metadata, 'agent:session');

    if (!files || !sessionId) continue;

    for (const filePath of files) {
      const nodeId = getFileNodeId(filePath);
      const existing = fileData.get(nodeId);

      if (existing) {
        existing.sessionIds.add(sessionId);
      } else {
        fileData.set(nodeId, { filePath, sessionIds: new Set([sessionId]) });
      }
    }
  }

  return fileData;
};

/**
 * Create file nodes from todos' agent:files metadata.
 * Session nodes are created for any session with files, so all file nodes will have connections.
 */
export function createFileNodes(todos: Todo[]): Node[] {
  const fileData = buildFileToSessionsMap(todos);
  const nodes: Node[] = [];
  let index = 0;

  for (const [nodeId, { filePath, sessionIds }] of fileData) {
    nodes.push({
      id: nodeId,
      type: 'fileNode',
      position: { x: 400 + (index % 4) * 100, y: -200 + Math.floor(index / 4) * 80 },
      data: {
        filePath,
        fileName: getFileName(filePath),
        todoCount: sessionIds.size, // Represents session count
      },
    });
    index++;
  }

  return nodes;
}

/** Create a single file-to-session edge */
const createFileToSessionEdge = (fileNodeId: string, sessionNodeId: string): Edge => ({
  id: `file-session:${fileNodeId}-${sessionNodeId}`,
  source: fileNodeId,
  sourceHandle: 'center',
  target: sessionNodeId,
  targetHandle: 'center',
  type: 'curved',
  animated: false,
  style: {
    stroke: '#7c3aed', // violet-600 to match agent/session color
    strokeWidth: 1.5,
  },
});

/**
 * Create edges from file nodes to agent session metadata nodes.
 * Session nodes are created for any session with files.
 */
export function createFileEdges(todos: Todo[]): Edge[] {
  const fileToSessions = buildFileToSessionsMap(todos);
  const edges: Edge[] = [];

  for (const [fileNodeId, { sessionIds }] of fileToSessions) {
    for (const sessionId of sessionIds) {
      const sessionNodeId = getMetadataNodeId('agent:session', sessionId);
      edges.push(createFileToSessionEdge(fileNodeId, sessionNodeId));
    }
  }

  return edges;
}
