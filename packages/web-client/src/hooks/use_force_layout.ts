/**
 * Hook for force-directed graph layout using d3-force.
 * Optimized based on Mike Bostock's best practices for graph visualization.
 *
 * Key tuning parameters:
 * - alphaDecay: Lower = more iterations, better layout (default 0.0228)
 * - velocityDecay: Higher = faster settling, less drift (default 0.4)
 * - Link strength varies by node degree for better balance
 * - X position influenced by creation date (older=left, newer=right)
 */
import type { Edge, Node } from '@xyflow/react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { useEffect, useMemo, useState } from 'react';

interface SimNode extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
  targetX?: number; // Target X based on creation date
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
}

/** Default canvas dimensions (will be overridden by actual viewport) */
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 600;
const PADDING = 50;

/** Extract creation timestamp from node ID (ISO timestamp format) */
const getCreationTime = (nodeId: string): number => {
  // Node IDs are ISO timestamps like "2026-01-09T22:15:49.221Z"
  // Metadata nodes start with "metadata:"
  if (nodeId.startsWith('metadata:')) {
    return Date.now(); // Place metadata nodes in the middle/recent
  }
  const timestamp = Date.parse(nodeId);
  return isNaN(timestamp) ? Date.now() : timestamp;
};

/** Calculate target X positions based on creation dates */
const calculateTargetPositions = (nodes: SimNode[], width: number): Map<string, number> => {
  const positions = new Map<string, number>();

  // Get all timestamps
  const timestamps = nodes.map((n) => ({ id: n.id, time: getCreationTime(n.id) }));
  const times = timestamps.map((t) => t.time);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeRange = maxTime - minTime || 1;

  // Normalize to X positions (older=left, newer=right)
  for (const { id, time } of timestamps) {
    const normalized = (time - minTime) / timeRange;
    const targetX = PADDING + normalized * (width - 2 * PADDING);
    positions.set(id, targetX);
  }

  return positions;
};

/** Create simulation nodes from React Flow nodes */
const createSimNodes = (nodes: Node[], width: number): SimNode[] => {
  const simNodes = nodes.map((node) => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
  }));

  // Calculate target X positions based on creation time
  const targetPositions = calculateTargetPositions(simNodes, width);

  return simNodes.map((node) => ({
    ...node,
    targetX: targetPositions.get(node.id) ?? width / 2,
  }));
};

/** Create simulation links from React Flow edges */
const createSimLinks = (edges: Edge[]): SimLink[] =>
  edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

/** Calculate node degrees (connection count) for link strength weighting */
const calculateDegrees = (nodes: SimNode[], links: SimLink[]): Map<string, number> => {
  const degrees = new Map<string, number>();
  nodes.forEach((n) => degrees.set(n.id, 0));
  links.forEach((l) => {
    const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
    const targetId = typeof l.target === 'string' ? l.target : l.target.id;
    degrees.set(sourceId, (degrees.get(sourceId) || 0) + 1);
    degrees.set(targetId, (degrees.get(targetId) || 0) + 1);
  });
  return degrees;
};

interface SimulationParams {
  initialNodes: Node[];
  simNodes: SimNode[];
  simLinks: SimLink[];
  width: number;
  height: number;
}

/** Run force simulation with optimized parameters */
const runSimulation = (params: SimulationParams): Node[] => {
  const { initialNodes, simNodes, simLinks, width, height } = params;
  const nodes: SimNode[] = simNodes.map((n) => ({ ...n }));
  const links: SimLink[] = simLinks.map((l) => ({ ...l }));
  const degrees = calculateDegrees(nodes, links);

  const simulation = forceSimulation<SimNode>(nodes)
    // Alpha decay: lower = more iterations for better layout
    .alphaDecay(0.01)
    // Velocity decay: moderate damping
    .velocityDecay(0.3)
    // Link force: strength inversely proportional to degree (Bostock's recommendation)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance(70)
        .strength((link) => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          const sourceDegree = degrees.get(sourceId) || 1;
          const targetDegree = degrees.get(targetId) || 1;
          return 1 / Math.min(sourceDegree, targetDegree);
        }),
    )
    // Many-body: stronger repulsion for better separation
    .force('charge', forceManyBody().strength(-400).distanceMax(500))
    // Center: pull toward canvas center
    .force('center', forceCenter(width / 2, height / 2))
    // Collision: larger radius to prevent overlap, more iterations
    .force('collide', forceCollide(35).strength(1).iterations(4))
    // X position: pull toward target X based on creation date (moderate strength)
    .force('x', forceX<SimNode>((d) => d.targetX ?? width / 2).strength(0.15))
    // Y position: gentle centering
    .force('y', forceY(height / 2).strength(0.05));

  // Run more iterations for better convergence
  simulation.stop();
  for (let i = 0; i < 400; i++) {
    simulation.tick();
  }
  simulation.stop();

  return initialNodes.map((node) => {
    const simNode = nodes.find((n) => n.id === node.id);
    return {
      ...node,
      position: { x: simNode?.x ?? node.position.x, y: simNode?.y ?? node.position.y },
    };
  });
};

interface UseForceLayoutOptions {
  width?: number;
  height?: number;
}

interface UseForceLayoutResult {
  nodes: Node[];
  edges: Edge[];
  isLayouting: boolean;
}

/** Apply force-directed layout to nodes */
export function useForceLayout(
  initialNodes: Node[],
  initialEdges: Edge[],
  options: UseForceLayoutOptions = {},
): UseForceLayoutResult {
  const { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT } = options;
  const [isLayouting, setIsLayouting] = useState(true);
  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>(initialNodes);

  const simNodes = useMemo(() => createSimNodes(initialNodes, width), [initialNodes, width]);
  const simLinks = useMemo(() => createSimLinks(initialEdges), [initialEdges]);

  useEffect(() => {
    if (initialNodes.length === 0) {
      setIsLayouting(false);
      return;
    }
    setIsLayouting(true);
    const newNodes = runSimulation({ initialNodes, simNodes, simLinks, width, height });
    setLayoutedNodes(newNodes);
    setIsLayouting(false);
  }, [initialNodes, simNodes, simLinks, width, height]);

  return { nodes: layoutedNodes, edges: initialEdges, isLayouting };
}
