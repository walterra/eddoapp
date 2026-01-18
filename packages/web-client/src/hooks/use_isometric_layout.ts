/**
 * Hook for isometric grid layout.
 * Places nodes on a diamond grid pattern with village-like clustering.
 * Root todos are spread out as individual villages, subtasks cluster nearby.
 */
import type { Edge, Node } from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  applyLayout,
  assignPositionsExtended,
  createKey,
  type GridPosition,
  type IsometricConfig,
  type LayoutOptions,
  type LayoutResult,
  type RoadNetworkData,
} from './isometric_layout';

// Re-export types for external use
export { gridToScreen } from './isometric_layout';
export type { GridPosition, RoadNetworkData };

/** Calculate grid size based on todo count */
const calculateGridSize = (nodes: Node[]): number => {
  const todoCount = nodes.filter((n) => n.type === 'todoNode').length;
  const minSize = Math.max(12, Math.ceil(Math.sqrt(todoCount) * 3));
  return Math.min(minSize, 30); // Cap at 30x30
};

/** Create isometric config */
const createConfig = (width: number, gridSize: number): IsometricConfig => ({
  cellWidth: 80,
  cellHeight: 50,
  originX: width / 3,
  originY: 80,
  gridSize,
});

/** Process layout and update state */
const processLayout = (
  nodes: Node[],
  edges: Edge[],
  config: IsometricConfig,
): { layoutedNodes: Node[]; roadNetwork: RoadNetworkData } => {
  const result = assignPositionsExtended(nodes, edges, config);
  const layoutedNodes = applyLayout(result.nodes, config);
  const roadNetwork: RoadNetworkData = {
    roadTiles: result.roadTiles,
    todoPositions: result.todoPositions,
    metadataPositions: result.metadataPositions,
    config,
  };
  return { layoutedNodes, roadNetwork };
};

/** Hook that applies isometric grid layout to nodes */
export function useIsometricLayout(
  initialNodes: Node[],
  initialEdges: Edge[],
  options: LayoutOptions = {},
): LayoutResult {
  const { width = 1600 } = options;
  const [isLayouting, setIsLayouting] = useState(true);
  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>(initialNodes);
  const [roadNetwork, setRoadNetwork] = useState<RoadNetworkData | null>(null);
  const lastKeyRef = useRef<string>('');

  const gridSize = useMemo(() => calculateGridSize(initialNodes), [initialNodes]);
  const config = useMemo(() => createConfig(width, gridSize), [width, gridSize]);
  const structureKey = useMemo(
    () => createKey(initialNodes, initialEdges),
    [initialNodes, initialEdges],
  );

  useEffect(() => {
    if (structureKey === lastKeyRef.current) return;
    lastKeyRef.current = structureKey;

    if (initialNodes.length === 0) {
      setIsLayouting(false);
      setLayoutedNodes([]);
      setRoadNetwork(null);
      return;
    }

    setIsLayouting(true);
    const { layoutedNodes: nodes, roadNetwork: network } = processLayout(
      initialNodes,
      initialEdges,
      config,
    );
    setLayoutedNodes(nodes);
    setRoadNetwork(network);
    setIsLayouting(false);
  }, [structureKey, initialNodes, initialEdges, config]);

  return { nodes: layoutedNodes, edges: initialEdges, isLayouting, roadNetwork };
}
