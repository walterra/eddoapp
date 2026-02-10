/**
 * Hook for ELK layouts.
 * Supports layered and radial modes for dependency-focused graphs.
 */
import type { Edge, Node } from '@xyflow/react';
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { useCallback, useEffect, useState } from 'react';

import { getElkOptions, getNodeDimensions, type ElkLayoutAlgorithm } from './elk_layout_config';
import { buildPrioritizedRadialTreeEdges } from './elk_radial_tree';

const elk = new ELK();

const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 800;

interface ElkLayoutOptions {
  width?: number;
  height?: number;
  algorithm?: ElkLayoutAlgorithm;
  rootNodeId?: string | null;
}

interface UseElkLayoutResult {
  nodes: Node[];
  edges: Edge[];
  isLayouting: boolean;
}

/** Resolve explicit dependency root node id without fallback */
const resolveDependencyRootNodeId = (
  nodes: Node[],
  rootNodeId: string | null | undefined,
): string | null => {
  if (!rootNodeId) {
    return null;
  }

  return nodes.some((node) => node.id === rootNodeId) ? rootNodeId : null;
};

const PARENT_EDGE_ID_PREFIX = 'parent:';

/** Check if edge is a parent-child relationship */
const isParentEdge = (edge: Edge): boolean => edge.id.startsWith(PARENT_EDGE_ID_PREFIX);

/** Build parent adjacency map */
const buildParentAdjacencyMap = (edges: readonly Edge[]): Map<string, string[]> => {
  const adjacencyMap = new Map<string, string[]>();

  for (const edge of edges) {
    if (!isParentEdge(edge)) {
      continue;
    }

    const targets = adjacencyMap.get(edge.source) ?? [];
    targets.push(edge.target);
    adjacencyMap.set(edge.source, targets);
  }

  return adjacencyMap;
};

/** Count descendants in parent-child hierarchy */
const countDescendants = (rootNodeId: string, adjacencyMap: Map<string, string[]>): number => {
  const visited = new Set<string>([rootNodeId]);
  const queue = [rootNodeId];
  let index = 0;

  while (index < queue.length) {
    const nodeId = queue[index];
    index += 1;

    const children = adjacencyMap.get(nodeId) ?? [];
    for (const childId of children) {
      if (visited.has(childId)) {
        continue;
      }

      visited.add(childId);
      queue.push(childId);
    }
  }

  return Math.max(visited.size - 1, 0);
};

/** Select best root from candidates by descendant coverage, then id */
const selectBestRootCandidate = (
  candidates: string[],
  adjacencyMap: Map<string, string[]>,
): string => {
  const ranked = candidates.map((candidate) => ({
    candidate,
    descendants: countDescendants(candidate, adjacencyMap),
  }));

  ranked.sort((a, b) => {
    if (b.descendants !== a.descendants) {
      return b.descendants - a.descendants;
    }

    return a.candidate.localeCompare(b.candidate);
  });

  return ranked[0].candidate;
};

/** Resolve hierarchy root candidate from parent-child edges */
const resolveHierarchyRootNodeId = (nodes: Node[], edges: Edge[]): string | null => {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const incomingParentCount = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  let hasParentEdge = false;

  for (const edge of edges) {
    if (!isParentEdge(edge) || !nodeIds.has(edge.target) || !nodeIds.has(edge.source)) {
      continue;
    }

    hasParentEdge = true;
    incomingParentCount.set(edge.target, (incomingParentCount.get(edge.target) ?? 0) + 1);
  }

  if (!hasParentEdge) {
    return null;
  }

  const candidates = nodes
    .map((node) => node.id)
    .filter((nodeId) => (incomingParentCount.get(nodeId) ?? 0) === 0);

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  return selectBestRootCandidate(candidates, buildParentAdjacencyMap(edges));
};

/** Resolve layout root node id for tree construction */
const resolveLayoutRootNodeId = (
  nodes: Node[],
  edges: Edge[],
  algorithm: ElkLayoutAlgorithm,
  dependencyRootNodeId: string | null,
): string | null => {
  if (dependencyRootNodeId && algorithm === 'layered') {
    return resolveHierarchyRootNodeId(nodes, edges) ?? dependencyRootNodeId;
  }

  if (dependencyRootNodeId) {
    return dependencyRootNodeId;
  }

  if (algorithm === 'radial') {
    return nodes[0]?.id ?? null;
  }

  return null;
};

/** Select layout edges for chosen ELK algorithm */
const selectLayoutEdges = (
  nodes: Node[],
  edges: Edge[],
  layoutRootNodeId: string | null,
): Edge[] => {
  if (!layoutRootNodeId) {
    return edges;
  }

  return buildPrioritizedRadialTreeEdges(nodes, edges, layoutRootNodeId);
};

interface BuildElkGraphParams {
  nodes: Node[];
  edges: Edge[];
  width: number;
  height: number;
  algorithm: ElkLayoutAlgorithm;
  isDependencyLayout: boolean;
  layoutRootNodeId: string | null;
}

/** Get node-level ELK layout options for dependency layouts */
const getNodeLayoutOptions = (
  nodeId: string,
  params: BuildElkGraphParams,
): Record<string, string> | undefined => {
  if (params.algorithm !== 'layered' || !params.isDependencyLayout) {
    return undefined;
  }

  if (!params.layoutRootNodeId || nodeId !== params.layoutRootNodeId) {
    return undefined;
  }

  return {
    'org.eclipse.elk.layered.layering.layerConstraint': 'FIRST',
  };
};

/** Build ELK graph structure from React Flow nodes and edges */
const buildElkGraph = (params: BuildElkGraphParams): ElkNode => ({
  id: 'root',
  layoutOptions: getElkOptions(
    params.width,
    params.height,
    params.algorithm,
    params.isDependencyLayout,
  ),
  children: params.nodes.map((node) => {
    const dimensions = getNodeDimensions(node);
    const layoutOptions = getNodeLayoutOptions(node.id, params);

    return {
      id: node.id,
      width: dimensions.width,
      height: dimensions.height,
      layoutOptions,
    };
  }),
  edges: params.edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  })),
});

/** Apply ELK positions to React Flow nodes */
const applyElkPositions = (nodes: Node[], elkGraph: ElkNode): Node[] => {
  const elkNodeMap = new Map(elkGraph.children?.map((child) => [child.id, child]) ?? []);

  return nodes.map((node) => {
    const elkNode = elkNodeMap.get(node.id);

    return {
      ...node,
      position: {
        x: elkNode?.x ?? node.position.x,
        y: elkNode?.y ?? node.position.y,
      },
    };
  });
};

interface ExecuteElkLayoutParams {
  initialNodes: Node[];
  initialEdges: Edge[];
  width: number;
  height: number;
  algorithm: ElkLayoutAlgorithm;
  rootNodeId: string | null;
}

/** Execute ELK layout */
const executeElkLayout = async (params: ExecuteElkLayoutParams): Promise<Node[]> => {
  const dependencyRootNodeId = resolveDependencyRootNodeId(params.initialNodes, params.rootNodeId);
  const layoutRootNodeId = resolveLayoutRootNodeId(
    params.initialNodes,
    params.initialEdges,
    params.algorithm,
    dependencyRootNodeId,
  );

  if (params.rootNodeId && !dependencyRootNodeId) {
    console.warn('Dependency root node not found in graph nodes:', params.rootNodeId);
  }
  const layoutEdges = selectLayoutEdges(params.initialNodes, params.initialEdges, layoutRootNodeId);
  const elkGraph = buildElkGraph({
    nodes: params.initialNodes,
    edges: layoutEdges,
    width: params.width,
    height: params.height,
    algorithm: params.algorithm,
    isDependencyLayout: Boolean(params.rootNodeId),
    layoutRootNodeId,
  });
  const layoutedGraph = await elk.layout(elkGraph);
  return applyElkPositions(params.initialNodes, layoutedGraph);
};

/** Hook for ELK-based layouts */
export function useElkLayout(
  initialNodes: Node[],
  initialEdges: Edge[],
  options: ElkLayoutOptions = {},
): UseElkLayoutResult {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    algorithm = 'layered',
    rootNodeId = null,
  } = options;
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [isLayouting, setIsLayouting] = useState(true);

  const runLayout = useCallback(async () => {
    if (initialNodes.length === 0) {
      setNodes([]);
      setIsLayouting(false);
      return;
    }

    setIsLayouting(true);

    try {
      const positionedNodes = await executeElkLayout({
        initialNodes,
        initialEdges,
        width,
        height,
        algorithm,
        rootNodeId,
      });
      setNodes(positionedNodes);
    } catch (error) {
      console.error('ELK layout failed:', error);
      setNodes(initialNodes);
    } finally {
      setIsLayouting(false);
    }
  }, [initialNodes, initialEdges, width, height, algorithm, rootNodeId]);

  useEffect(() => {
    runLayout();
  }, [runLayout]);

  return { nodes, edges: initialEdges, isLayouting };
}
