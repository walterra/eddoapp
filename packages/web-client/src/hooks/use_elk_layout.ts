/**
 * Hook for ELK layouts.
 * Supports layered and radial modes for dependency-focused graphs.
 */
import type { Edge, Node } from '@xyflow/react';
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { useCallback, useEffect, useState } from 'react';

const elk = new ELK();

const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 800;

type ElkDirection = 'RIGHT' | 'DOWN';
export type ElkLayoutAlgorithm = 'layered' | 'radial';

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

interface NodeDimensions {
  width: number;
  height: number;
}

interface TodoLayoutData {
  showActions?: boolean;
}

/** Resolve layered direction from viewport aspect ratio */
const getLayeredDirection = (width: number, height: number): ElkDirection =>
  width / Math.max(height, 1) >= 1.45 ? 'DOWN' : 'RIGHT';

/** Build ELK layered options */
const getLayeredOptions = (width: number, height: number): Record<string, string> => {
  const direction = getLayeredDirection(width, height);

  if (direction === 'DOWN') {
    return {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.spacing.edgeNodeBetweenLayers': '36',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.spacing.nodeNode': '56',
    };
  }

  return {
    'elk.algorithm': 'layered',
    'elk.direction': direction,
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.spacing.edgeNodeBetweenLayers': '42',
    'elk.layered.spacing.nodeNodeBetweenLayers': '136',
    'elk.spacing.nodeNode': '44',
  };
};

/** Build ELK radial options */
const getRadialOptions = (): Record<string, string> => ({
  'elk.algorithm': 'org.eclipse.elk.radial',
  'org.eclipse.elk.radial.centerOnRoot': 'true',
  'org.eclipse.elk.radial.radius': '220',
  'org.eclipse.elk.radial.compactor': 'RADIAL_COMPACTION',
});

/** Build ELK options by algorithm */
const getElkOptions = (
  width: number,
  height: number,
  algorithm: ElkLayoutAlgorithm,
): Record<string, string> =>
  algorithm === 'radial' ? getRadialOptions() : getLayeredOptions(width, height);

/** Identify dependency-mode todo nodes that render large cards */
const isDependencyTodoNode = (node: Node): boolean => {
  if (node.type !== 'todoNode') {
    return false;
  }

  const data = node.data as TodoLayoutData | undefined;
  return Boolean(data?.showActions);
};

/** Get layout dimensions for each node type */
const getNodeDimensions = (node: Node): NodeDimensions => {
  if (isDependencyTodoNode(node)) {
    return { width: 248, height: 124 };
  }

  if (node.type === 'todoNode') {
    return { width: 72, height: 72 };
  }

  if (node.type === 'metadataNode') {
    return { width: 120, height: 52 };
  }

  if (node.type === 'userNode') {
    return { width: 64, height: 64 };
  }

  if (node.type === 'fileNode') {
    return { width: 56, height: 56 };
  }

  return { width: 80, height: 80 };
};

/** Resolve radial root node id */
const resolveRootNodeId = (nodes: Node[], rootNodeId: string | null | undefined): string => {
  if (rootNodeId && nodes.some((node) => node.id === rootNodeId)) {
    return rootNodeId;
  }

  return nodes[0]?.id ?? '';
};

/** Build undirected adjacency map from edges */
const buildAdjacencyMap = (edges: Edge[]): Map<string, Set<string>> => {
  const adjacencyMap = new Map<string, Set<string>>();

  for (const edge of edges) {
    const sourceNeighbors = adjacencyMap.get(edge.source) ?? new Set<string>();
    sourceNeighbors.add(edge.target);
    adjacencyMap.set(edge.source, sourceNeighbors);

    const targetNeighbors = adjacencyMap.get(edge.target) ?? new Set<string>();
    targetNeighbors.add(edge.source);
    adjacencyMap.set(edge.target, targetNeighbors);
  }

  return adjacencyMap;
};

/** Build radial tree edges from root using BFS */
const buildRadialTreeEdges = (nodes: Node[], edges: Edge[], rootNodeId: string): Edge[] => {
  const adjacencyMap = buildAdjacencyMap(edges);
  const visited = new Set<string>([rootNodeId]);
  const queue = [rootNodeId];
  const treeEdges: Edge[] = [];

  while (queue.length > 0) {
    const currentNodeId = queue.shift();
    if (!currentNodeId) {
      continue;
    }

    const neighbors = adjacencyMap.get(currentNodeId) ?? new Set<string>();
    for (const neighborId of neighbors) {
      if (visited.has(neighborId)) {
        continue;
      }

      visited.add(neighborId);
      queue.push(neighborId);
      treeEdges.push({
        id: `layout-tree:${currentNodeId}->${neighborId}`,
        source: currentNodeId,
        target: neighborId,
      });
    }
  }

  for (const node of nodes) {
    if (visited.has(node.id) || node.id === rootNodeId) {
      continue;
    }

    treeEdges.push({
      id: `layout-orphan:${rootNodeId}->${node.id}`,
      source: rootNodeId,
      target: node.id,
    });
  }

  return treeEdges;
};

/** Select edges for chosen ELK algorithm */
const selectLayoutEdges = (
  nodes: Node[],
  edges: Edge[],
  algorithm: ElkLayoutAlgorithm,
  rootNodeId: string | null | undefined,
): Edge[] => {
  if (algorithm !== 'radial') {
    return edges;
  }

  const resolvedRoot = resolveRootNodeId(nodes, rootNodeId);
  if (!resolvedRoot) {
    return edges;
  }

  return buildRadialTreeEdges(nodes, edges, resolvedRoot);
};

interface BuildElkGraphParams {
  nodes: Node[];
  edges: Edge[];
  width: number;
  height: number;
  algorithm: ElkLayoutAlgorithm;
}

/** Build ELK graph structure from React Flow nodes and edges */
const buildElkGraph = (params: BuildElkGraphParams): ElkNode => ({
  id: 'root',
  layoutOptions: getElkOptions(params.width, params.height, params.algorithm),
  children: params.nodes.map((node) => {
    const dimensions = getNodeDimensions(node);

    return {
      id: node.id,
      width: dimensions.width,
      height: dimensions.height,
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
      const layoutEdges = selectLayoutEdges(initialNodes, initialEdges, algorithm, rootNodeId);
      const elkGraph = buildElkGraph({
        nodes: initialNodes,
        edges: layoutEdges,
        width,
        height,
        algorithm,
      });
      const layoutedGraph = await elk.layout(elkGraph);
      setNodes(applyElkPositions(initialNodes, layoutedGraph));
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
