/**
 * Hook for force-directed graph layout using d3-force.
 * Optimized based on Mike Bostock's best practices for graph visualization.
 *
 * Key optimizations:
 * - Structure-based memoization: only re-layout when node/edge structure changes
 * - Data updates (lastMessage, todoCount) don't trigger expensive re-layout
 * - Previous positions used as seeds for incremental updates
 *
 * Key tuning parameters:
 * - alphaDecay: Lower = more iterations, better layout (default 0.0228)
 * - velocityDecay: Higher = faster settling, less drift (default 0.4)
 * - Link strength varies by node degree for better balance
 * - X position influenced by creation date (older=left, newer=right)
 */
import type { Edge, Node } from '@xyflow/react';
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { useEffect, useMemo, useRef, useState } from 'react';

interface SimNode extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
  targetX?: number; // Target X based on creation date
  targetY?: number; // Target Y based on creation date (for tall viewports)
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
}

/** Default canvas dimensions (will be overridden by actual viewport) */
const DEFAULT_WIDTH = 1600;
const DEFAULT_HEIGHT = 800;
const PADDING = 100;

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

/** Calculate target positions based on creation dates - always horizontal timeline */
const calculateTargetPositions = (
  nodes: SimNode[],
  width: number,
  height: number,
): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();

  // Get all timestamps
  const timestamps = nodes.map((n) => ({ id: n.id, time: getCreationTime(n.id) }));
  const times = timestamps.map((t) => t.time);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeRange = maxTime - minTime || 1;

  // Always use horizontal timeline (older=left, newer=right)
  // Y position centered
  for (const { id, time } of timestamps) {
    const normalized = (time - minTime) / timeRange;
    const targetX = PADDING + normalized * (width - 2 * PADDING);
    const targetY = height / 2;
    positions.set(id, { x: targetX, y: targetY });
  }

  return positions;
};

/** Create simulation nodes from React Flow nodes */
const createSimNodes = (nodes: Node[], width: number, height: number): SimNode[] => {
  // First pass: create basic nodes to calculate target positions
  const basicNodes = nodes.map((node) => ({
    id: node.id,
    x: 0,
    y: 0,
  }));

  // Calculate target positions based on creation time and aspect ratio
  const targetPositions = calculateTargetPositions(basicNodes, width, height);

  // Initialize nodes near their target positions with jitter
  return nodes.map((node) => {
    const target = targetPositions.get(node.id) ?? { x: width / 2, y: height / 2 };
    return {
      id: node.id,
      x: target.x + (Math.random() - 0.5) * 100,
      y: target.y + (Math.random() - 0.5) * 100,
      targetX: target.x,
      targetY: target.y,
    };
  });
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
    // Many-body: stronger repulsion for better separation of unconnected nodes
    .force('charge', forceManyBody().strength(-500).distanceMax(600))
    // Collision: larger radius to prevent overlap, more iterations
    .force('collide', forceCollide(35).strength(1).iterations(4));

  // X position: pull toward target X based on creation date (timeline)
  simulation.force('x', forceX<SimNode>((d) => d.targetX ?? width / 2).strength(0.2));
  // Y position: center vertically
  simulation.force('y', forceY<SimNode>((d) => d.targetY ?? height / 2).strength(0.1));

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
      // Enable smooth position transitions
      style: { ...node.style, transition: 'transform 0.3s ease-out' },
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

/**
 * Create a structural fingerprint that only changes when graph topology changes.
 * Node data changes (lastMessage, todoCount, etc.) don't affect this key.
 */
const createStructureKey = (nodes: Node[], edges: Edge[]): string => {
  const nodeIds = nodes
    .map((n) => n.id)
    .sort()
    .join(',');
  const edgeKeys = edges
    .map((e) => `${e.source}->${e.target}`)
    .sort()
    .join(',');
  return `nodes:[${nodeIds}]|edges:[${edgeKeys}]`;
};

/**
 * Merge fresh node data onto existing positions.
 * Preserves layout positions while updating node data (lastMessage, etc.)
 */
const mergeDataOntoPositions = (
  freshNodes: Node[],
  positionMap: Map<string, { x: number; y: number }>,
): Node[] =>
  freshNodes.map((node) => {
    const pos = positionMap.get(node.id);
    return pos
      ? { ...node, position: pos, style: { ...node.style, transition: 'transform 0.3s ease-out' } }
      : node;
  });

/** Create sim nodes with previous positions as seeds */
const createSimNodesWithSeeds = (
  nodes: Node[],
  width: number,
  height: number,
  positionsRef: React.RefObject<Map<string, { x: number; y: number }>>,
): SimNode[] =>
  createSimNodes(nodes, width, height).map((node) => {
    const prevPos = positionsRef.current?.get(node.id);
    return prevPos ? { ...node, x: prevPos.x, y: prevPos.y } : node;
  });

/** Store positions from layouted nodes */
const storePositions = (nodes: Node[]): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node) => positions.set(node.id, { x: node.position.x, y: node.position.y }));
  return positions;
};

/** Apply force-directed layout to nodes */
export function useForceLayout(
  initialNodes: Node[],
  initialEdges: Edge[],
  options: UseForceLayoutOptions = {},
): UseForceLayoutResult {
  const { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT } = options;
  const [isLayouting, setIsLayouting] = useState(true);
  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>(initialNodes);
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const lastLayoutKeyRef = useRef<string>('');
  const justLayoutedRef = useRef(false);

  const structureKey = useMemo(
    () => createStructureKey(initialNodes, initialEdges),
    [initialNodes, initialEdges],
  );

  // Run layout only when structure changes
  useEffect(() => {
    if (structureKey === lastLayoutKeyRef.current) return;
    if (initialNodes.length === 0) {
      setIsLayouting(false);
      lastLayoutKeyRef.current = structureKey;
      justLayoutedRef.current = true;
      return;
    }
    setIsLayouting(true);
    const simNodes = createSimNodesWithSeeds(initialNodes, width, height, positionsRef);
    const simLinks = createSimLinks(initialEdges);
    const newNodes = runSimulation({ initialNodes, simNodes, simLinks, width, height });
    positionsRef.current = storePositions(newNodes);
    lastLayoutKeyRef.current = structureKey;
    justLayoutedRef.current = true;
    setLayoutedNodes(newNodes);
    setIsLayouting(false);
  }, [structureKey, initialNodes, initialEdges, width, height]);

  // Merge data updates without re-layout (skip if we just ran layout)
  useEffect(() => {
    // Skip if we just ran the full layout in this render cycle
    if (justLayoutedRef.current) {
      justLayoutedRef.current = false;
      return;
    }
    if (positionsRef.current.size === 0 || structureKey !== lastLayoutKeyRef.current) return;
    setLayoutedNodes(mergeDataOntoPositions(initialNodes, positionsRef.current));
  }, [initialNodes, structureKey]);

  return { nodes: layoutedNodes, edges: initialEdges, isLayouting };
}
