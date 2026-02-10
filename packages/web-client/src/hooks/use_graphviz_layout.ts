/**
 * Hook for Graphviz layouts.
 * Sends DOT to web-api for server-side Graphviz rendering and maps returned positions.
 */
import type { Edge, Node } from '@xyflow/react';
import { useCallback, useEffect, useState } from 'react';

import {
  buildGraphvizDotLayoutGraph,
  mapGraphvizPositionsToNodes,
  type GraphvizLayoutResult,
} from './graphviz_layout_helpers';
import { applyGraphvizColumnStaggering } from './graphviz_stagger';

const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 800;
const GRAPHVIZ_LAYOUT_API_URL = '/api/graphviz/layout';

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

interface GraphvizLayoutApiResponse {
  layout: GraphvizLayoutResult;
}

/** Read auth token from localStorage. */
const getAuthToken = (): string | null => {
  const stored = localStorage.getItem('authToken');
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as { token?: string };
    return parsed.token ?? null;
  } catch {
    return null;
  }
};

/** Request Graphviz layout from web-api. */
const executeGraphvizLayoutRequest = async (dot: string): Promise<GraphvizLayoutResult> => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(GRAPHVIZ_LAYOUT_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dot }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}) as { error?: string });
    throw new Error(errorData.error ?? `Graphviz layout failed: ${response.status}`);
  }

  const data = (await response.json()) as GraphvizLayoutApiResponse;
  return data.layout;
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
  const layout = await executeGraphvizLayoutRequest(dotGraph);

  const positionedNodes = mapGraphvizPositionsToNodes(params.initialNodes, layout);
  return applyGraphvizColumnStaggering(positionedNodes);
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
