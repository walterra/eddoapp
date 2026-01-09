/**
 * Hook for force-directed graph layout using d3-force.
 * Optimized based on Mike Bostock's best practices for graph visualization.
 *
 * Key tuning parameters:
 * - alphaDecay: Lower = more iterations, better layout (default 0.0228)
 * - velocityDecay: Higher = faster settling, less drift (default 0.4)
 * - Link strength varies by node degree for better balance
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
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
}

/** Create simulation nodes from React Flow nodes */
const createSimNodes = (nodes: Node[]): SimNode[] =>
  nodes.map((node) => ({
    id: node.id,
    x: node.position.x,
    y: node.position.y,
  }));

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

/** Run force simulation with optimized parameters */
const runSimulation = (initialNodes: Node[], simNodes: SimNode[], simLinks: SimLink[]): Node[] => {
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
        .distance(50)
        .strength((link) => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          const sourceDegree = degrees.get(sourceId) || 1;
          const targetDegree = degrees.get(targetId) || 1;
          return 1 / Math.min(sourceDegree, targetDegree);
        }),
    )
    // Many-body: moderate repulsion with distance limit
    .force('charge', forceManyBody().strength(-250).distanceMax(400))
    // Center: pull toward canvas center
    .force('center', forceCenter(500, 350))
    // Collision: smaller radius for dot nodes
    .force('collide', forceCollide(20).strength(0.8).iterations(2))
    // Gentle centering forces to prevent drift
    .force('x', forceX(500).strength(0.03))
    .force('y', forceY(350).strength(0.03));

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

interface UseForceLayoutResult {
  nodes: Node[];
  edges: Edge[];
  isLayouting: boolean;
}

/** Apply force-directed layout to nodes */
export function useForceLayout(initialNodes: Node[], initialEdges: Edge[]): UseForceLayoutResult {
  const [isLayouting, setIsLayouting] = useState(true);
  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>(initialNodes);

  const simNodes = useMemo(() => createSimNodes(initialNodes), [initialNodes]);
  const simLinks = useMemo(() => createSimLinks(initialEdges), [initialEdges]);

  useEffect(() => {
    if (initialNodes.length === 0) {
      setIsLayouting(false);
      return;
    }
    setIsLayouting(true);
    const newNodes = runSimulation(initialNodes, simNodes, simLinks);
    setLayoutedNodes(newNodes);
    setIsLayouting(false);
  }, [initialNodes, simNodes, simLinks]);

  return { nodes: layoutedNodes, edges: initialEdges, isLayouting };
}
