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

/** Resolve root node id for radial tree construction */
const resolveRootNodeId = (nodes: Node[], rootNodeId: string | null | undefined): string => {
  if (rootNodeId && nodes.some((node) => node.id === rootNodeId)) {
    return rootNodeId;
  }

  return nodes[0]?.id ?? '';
};

/** Select edges used by ELK layout */
const selectLayoutEdges = (
  nodes: Node[],
  edges: Edge[],
  algorithm: ElkLayoutAlgorithm,
  rootNodeId: string | null | undefined,
): Edge[] => {
  if (algorithm !== 'radial') {
    return edges;
  }

  const resolvedRootNodeId = resolveRootNodeId(nodes, rootNodeId);
  if (!resolvedRootNodeId) {
    return edges;
  }

  return buildPrioritizedRadialTreeEdges(nodes, edges, resolvedRootNodeId);
};

interface BuildElkGraphParams {
  nodes: Node[];
  edges: Edge[];
  width: number;
  height: number;
  algorithm: ElkLayoutAlgorithm;
  isDependencyLayout: boolean;
}

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

interface ExecuteElkLayoutParams {
  initialNodes: Node[];
  initialEdges: Edge[];
  width: number;
  height: number;
  algorithm: ElkLayoutAlgorithm;
  rootNodeId: string | null;
}

/** Execute ELK layout for current graph */
const executeElkLayout = async (params: ExecuteElkLayoutParams): Promise<Node[]> => {
  const layoutEdges = selectLayoutEdges(
    params.initialNodes,
    params.initialEdges,
    params.algorithm,
    params.rootNodeId,
  );
  const elkGraph = buildElkGraph({
    nodes: params.initialNodes,
    edges: layoutEdges,
    width: params.width,
    height: params.height,
    algorithm: params.algorithm,
    isDependencyLayout: Boolean(params.rootNodeId),
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
