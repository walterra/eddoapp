/**
 * Node grouping utilities for isometric layout.
 */
import type { Edge, Node } from '@xyflow/react';

import type { MetadataEdgeMap, NodeGroups, TodoNodeData } from './types';

/** Group nodes by type */
export const groupByType = (nodes: Node[]): NodeGroups => {
  const groups: NodeGroups = {
    todos: [],
    metadata: [],
    files: [],
    users: [],
  };
  for (const node of nodes) {
    if (node.type === 'todoNode') groups.todos.push(node);
    else if (node.type === 'metadataNode') groups.metadata.push(node);
    else if (node.type === 'fileNode') groups.files.push(node);
    else if (node.type === 'userNode') groups.users.push(node);
  }
  return groups;
};

/** Build parent-child hierarchy map */
export const buildHierarchy = (nodes: Node[]): Map<string | null, Node[]> => {
  const hierarchy = new Map<string | null, Node[]>();
  for (const node of nodes) {
    const data = node.data as TodoNodeData | undefined;
    const parentId = data?.todo?.parentId ?? null;
    const list = hierarchy.get(parentId) ?? [];
    list.push(node);
    hierarchy.set(parentId, list);
  }
  return hierarchy;
};

/** Build map of metadata node ID -> connected todo IDs from edges */
export const buildMetadataTodoMap = (edges: Edge[]): MetadataEdgeMap => {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    if (!edge.id.startsWith('metadata:')) continue;
    const source = edge.source; // metadata node ID
    const target = edge.target; // todo ID
    const existing = map.get(source) ?? [];
    existing.push(target);
    map.set(source, existing);
  }
  return map;
};

/** Build map of metadata node ID -> connected file IDs from file-session edges */
export const buildMetadataFileMap = (edges: Edge[]): MetadataEdgeMap => {
  const map = new Map<string, string[]>();
  for (const edge of edges) {
    if (!edge.id.startsWith('file-session:')) continue;
    // Edge: file -> agent session, so source=file, target=metadata
    const fileId = edge.source;
    const metadataId = edge.target;
    const existing = map.get(metadataId) ?? [];
    existing.push(fileId);
    map.set(metadataId, existing);
  }
  return map;
};
