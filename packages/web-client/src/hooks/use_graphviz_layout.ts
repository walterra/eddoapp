/**
 * Hook for Graphviz (viz-js) layouts.
 * Uses DOT constraints to spread dependency levels by blocked-by relationships.
 */
import type { Viz } from '@viz-js/viz';
import type { Edge, Node } from '@xyflow/react';
import { useCallback, useEffect, useState } from 'react';

import {
  buildGraphvizDotLayoutGraph,
  mapGraphvizPositionsToNodes,
  type GraphvizLayoutResult,
} from './graphviz_layout_helpers';

const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 800;

let vizInstancePromise: Promise<Viz> | null = null;

interface GraphvizLayoutOptions {
  width?: number;
  height?: number;
  rootNodeId?: string | null;
}

interface UseGraphvizLayoutResult {
  nodes: Node[];
  edges: Edge[];
  isLayouting: boolean;
}

interface ExecuteLayoutParams {
  initialNodes: Node[];
  initialEdges: Edge[];
  width: number;
  height: number;
  rootNodeId: string | null;
}

/** Load and cache viz-js instance. */
const getVizInstance = async (): Promise<Viz> => {
  if (!vizInstancePromise) {
    vizInstancePromise = import('@viz-js/viz').then((module) => module.instance());
  }

  return vizInstancePromise;
};

/** Execute Graphviz layout and map output to React Flow node positions. */
const executeGraphvizLayout = async (params: ExecuteLayoutParams): Promise<Node[]> => {
  const dotGraph = buildGraphvizDotLayoutGraph({
    nodes: params.initialNodes,
    edges: params.initialEdges,
    rootNodeId: params.rootNodeId,
    width: params.width,
    height: params.height,
  });
  const viz = await getVizInstance();
  const layout = viz.renderJSON(dotGraph, {
    engine: 'dot',
    yInvert: true,
  }) as GraphvizLayoutResult;

  return mapGraphvizPositionsToNodes(params.initialNodes, layout);
};

/** Hook for Graphviz-based layouts. */
export const useGraphvizLayout = (
  initialNodes: Node[],
  initialEdges: Edge[],
  options: GraphvizLayoutOptions = {},
): UseGraphvizLayoutResult => {
  const { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, rootNodeId = null } = options;
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
      const positionedNodes = await executeGraphvizLayout({
        initialNodes,
        initialEdges,
        width,
        height,
        rootNodeId,
      });
      setNodes(positionedNodes);
    } catch (error) {
      console.error('Graphviz layout failed:', error);
      setNodes(initialNodes);
    } finally {
      setIsLayouting(false);
    }
  }, [initialNodes, initialEdges, width, height, rootNodeId]);

  useEffect(() => {
    runLayout();
  }, [runLayout]);

  return { nodes, edges: initialEdges, isLayouting };
};
