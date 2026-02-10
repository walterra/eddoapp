/**
 * Radial tree edge builder with dependency priority.
 * Prefers blockedBy paths over parent-child paths for radial depth.
 */
import type { Edge, Node } from '@xyflow/react';

const BLOCKED_EDGE_ID_PREFIX = 'blocked:';
const PARENT_EDGE_ID_PREFIX = 'parent:';

interface RadialNeighbor {
  nodeId: string;
  isBlocked: boolean;
}

interface TraversalState {
  nodeId: string;
  hasBlockedPath: boolean;
}

interface SelectedState {
  nodeId: string;
  hasBlockedPath: boolean;
}

interface TraversalMaps {
  distances: Map<string, number>;
  predecessors: Map<string, TraversalState>;
}

/** Build key for traversal state map lookups */
const toStateKey = (state: TraversalState): string =>
  `${state.nodeId}|${state.hasBlockedPath ? 'blocked' : 'parent'}`;

/** Check if an edge represents a blockedBy relationship */
const isBlockedEdge = (edge: Edge): boolean => edge.id.startsWith(BLOCKED_EDGE_ID_PREFIX);

/** Check if an edge represents a parent-child relationship */
const isParentEdge = (edge: Edge): boolean => edge.id.startsWith(PARENT_EDGE_ID_PREFIX);

/** Add an undirected adjacency entry */
const addAdjacencyEntry = (
  adjacency: Map<string, RadialNeighbor[]>,
  from: string,
  to: string,
  isBlocked: boolean,
): void => {
  const list = adjacency.get(from) ?? [];
  list.push({ nodeId: to, isBlocked });
  adjacency.set(from, list);
};

/** Collect nodes that have blockedBy relationships in current graph */
const getBlockedTargetIds = (edges: readonly Edge[]): Set<string> => {
  const blockedTargets = new Set<string>();

  for (const edge of edges) {
    if (!isBlockedEdge(edge)) {
      continue;
    }

    blockedTargets.add(edge.target);
  }

  return blockedTargets;
};

/** Drop parent-child edges for nodes that have blockedBy relationships */
const filterParentEdgesForBlockedTargets = (edges: readonly Edge[]): Edge[] => {
  const blockedTargets = getBlockedTargetIds(edges);
  if (blockedTargets.size === 0) {
    return [...edges];
  }

  return edges.filter((edge) => !isParentEdge(edge) || !blockedTargets.has(edge.target));
};

/** Build undirected adjacency with relationship type metadata */
const buildAdjacencyMap = (edges: readonly Edge[]): Map<string, RadialNeighbor[]> => {
  const adjacency = new Map<string, RadialNeighbor[]>();

  for (const edge of edges) {
    const blocked = isBlockedEdge(edge);
    addAdjacencyEntry(adjacency, edge.source, edge.target, blocked);
    addAdjacencyEntry(adjacency, edge.target, edge.source, blocked);
  }

  return adjacency;
};

/** Compare predecessor IDs for deterministic tie-breaking */
const isPreferredPredecessor = (
  candidate: TraversalState,
  current: TraversalState | undefined,
): boolean => {
  if (!current) {
    return true;
  }

  return candidate.nodeId.localeCompare(current.nodeId) < 0;
};

/** Decide if traversal state should be updated */
const shouldUpdateState = (
  nextDistance: number,
  existingDistance: number | undefined,
  candidatePredecessor: TraversalState,
  currentPredecessor: TraversalState | undefined,
): boolean => {
  if (existingDistance === undefined) {
    return true;
  }

  if (nextDistance < existingDistance) {
    return true;
  }

  if (nextDistance > existingDistance) {
    return false;
  }

  return isPreferredPredecessor(candidatePredecessor, currentPredecessor);
};

/** Compute shortest distances for both path states (blocked/non-blocked) */
const computeTraversalMaps = (
  rootNodeId: string,
  adjacency: Map<string, RadialNeighbor[]>,
): TraversalMaps => {
  const distances = new Map<string, number>();
  const predecessors = new Map<string, TraversalState>();
  const queue: TraversalState[] = [{ nodeId: rootNodeId, hasBlockedPath: false }];
  let index = 0;

  distances.set(toStateKey(queue[0]), 0);

  while (index < queue.length) {
    const current = queue[index];
    index += 1;

    const currentKey = toStateKey(current);
    const currentDistance = distances.get(currentKey);
    if (currentDistance === undefined) {
      continue;
    }

    const neighbors = adjacency.get(current.nodeId) ?? [];
    for (const neighbor of neighbors) {
      const nextState: TraversalState = {
        nodeId: neighbor.nodeId,
        hasBlockedPath: current.hasBlockedPath || neighbor.isBlocked,
      };
      const nextKey = toStateKey(nextState);
      const nextDistance = currentDistance + 1;
      const existingDistance = distances.get(nextKey);
      const currentPredecessor = predecessors.get(nextKey);

      if (!shouldUpdateState(nextDistance, existingDistance, current, currentPredecessor)) {
        continue;
      }

      distances.set(nextKey, nextDistance);
      predecessors.set(nextKey, current);

      if (existingDistance === undefined || nextDistance < existingDistance) {
        queue.push(nextState);
      }
    }
  }

  return { distances, predecessors };
};

/** Select preferred state for a node with strict blocked-path priority */
const selectPreferredState = (
  nodeId: string,
  rootNodeId: string,
  distances: Map<string, number>,
): SelectedState | undefined => {
  if (nodeId === rootNodeId) {
    return { nodeId, hasBlockedPath: false };
  }

  const blockedState: TraversalState = { nodeId, hasBlockedPath: true };
  if (distances.has(toStateKey(blockedState))) {
    return blockedState;
  }

  const parentState: TraversalState = { nodeId, hasBlockedPath: false };
  if (distances.has(toStateKey(parentState))) {
    return parentState;
  }

  return undefined;
};

/** Create a layout tree edge */
const createLayoutTreeEdge = (source: string, target: string): Edge => ({
  id: `layout-tree:${source}->${target}`,
  source,
  target,
});

/** Create a fallback edge for disconnected nodes */
const createOrphanEdge = (rootNodeId: string, nodeId: string): Edge => ({
  id: `layout-orphan:${rootNodeId}->${nodeId}`,
  source: rootNodeId,
  target: nodeId,
});

/**
 * Build radial tree edges from root.
 * Uses strict blockedBy priority and ignores parent edges for blocked target nodes.
 */
export const buildPrioritizedRadialTreeEdges = (
  nodes: readonly Node[],
  edges: readonly Edge[],
  rootNodeId: string,
): Edge[] => {
  const filteredEdges = filterParentEdgesForBlockedTargets(edges);
  const adjacency = buildAdjacencyMap(filteredEdges);
  const { distances, predecessors } = computeTraversalMaps(rootNodeId, adjacency);
  const connectedNodes = new Set<string>([rootNodeId]);
  const treeEdges: Edge[] = [];

  for (const node of nodes) {
    if (node.id === rootNodeId) {
      continue;
    }

    const selectedState = selectPreferredState(node.id, rootNodeId, distances);
    if (!selectedState) {
      continue;
    }

    connectedNodes.add(node.id);
    const predecessor = predecessors.get(toStateKey(selectedState));
    if (!predecessor) {
      continue;
    }

    treeEdges.push(createLayoutTreeEdge(predecessor.nodeId, node.id));
  }

  for (const node of nodes) {
    if (node.id === rootNodeId || connectedNodes.has(node.id)) {
      continue;
    }

    treeEdges.push(createOrphanEdge(rootNodeId, node.id));
  }

  return treeEdges;
};
