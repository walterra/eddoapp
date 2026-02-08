/**
 * Hook for hierarchical graph layout using ELK (Eclipse Layout Kernel).
 * Optimized for dependency-focused graph mode with large card nodes.
 */
import type { Edge, Node } from '@xyflow/react';
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { useCallback, useEffect, useState } from 'react';

const elk = new ELK();

const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 800;

type ElkDirection = 'RIGHT' | 'DOWN';

interface ElkLayoutOptions {
  width?: number;
  height?: number;
}

/** Resolve ELK direction from viewport aspect ratio */
const getElkDirection = (width: number, height: number): ElkDirection =>
  width / Math.max(height, 1) >= 1.45 ? 'DOWN' : 'RIGHT';

/** Build ELK layout options based on viewport */
const getElkOptions = (width: number, height: number): Record<string, string> => {
  const direction = getElkDirection(width, height);

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

/** Build ELK graph structure from React Flow nodes and edges */
const buildElkGraph = (nodes: Node[], edges: Edge[], width: number, height: number): ElkNode => ({
  id: 'root',
  layoutOptions: getElkOptions(width, height),
  children: nodes.map((node) => {
    const dimensions = getNodeDimensions(node);

    return {
      id: node.id,
      width: dimensions.width,
      height: dimensions.height,
    };
  }),
  edges: edges.map((edge) => ({
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

/** Hook for ELK-based hierarchical layout */
export function useElkLayout(
  initialNodes: Node[],
  initialEdges: Edge[],
  options: ElkLayoutOptions = {},
): UseElkLayoutResult {
  const { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT } = options;
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
      const elkGraph = buildElkGraph(initialNodes, initialEdges, width, height);
      const layoutedGraph = await elk.layout(elkGraph);
      setNodes(applyElkPositions(initialNodes, layoutedGraph));
    } catch (error) {
      console.error('ELK layout failed:', error);
      setNodes(initialNodes);
    } finally {
      setIsLayouting(false);
    }
  }, [initialNodes, initialEdges, width, height]);

  useEffect(() => {
    runLayout();
  }, [runLayout]);

  return { nodes, edges: initialEdges, isLayouting };
}
