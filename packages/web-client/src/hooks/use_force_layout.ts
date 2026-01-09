/**
 * Hook for force-directed graph layout using d3-force.
 * Based on React Flow layouting documentation.
 */
import type { Edge, Node } from '@xyflow/react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
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

interface UseForceLayoutOptions {
  strength?: number;
  distance?: number;
}

interface UseForceLayoutResult {
  nodes: Node[];
  edges: Edge[];
  isLayouting: boolean;
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

interface SimulationConfig {
  simNodes: SimNode[];
  simLinks: SimLink[];
  strength: number;
  distance: number;
}

/** Run force simulation and return positioned nodes */
const runSimulation = (initialNodes: Node[], config: SimulationConfig): Node[] => {
  const { simNodes, simLinks, strength, distance } = config;
  const nodes: SimNode[] = simNodes.map((n) => ({ ...n }));
  const links: SimLink[] = simLinks.map((l) => ({ ...l }));

  const simulation = forceSimulation<SimNode>(nodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance(distance),
    )
    .force('charge', forceManyBody().strength(strength))
    .force('center', forceCenter(400, 300))
    .force('collide', forceCollide(140));

  // Run simulation synchronously for faster initial layout
  simulation.stop();
  for (let i = 0; i < 300; i++) {
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

/** Apply force-directed layout to nodes */
export function useForceLayout(
  initialNodes: Node[],
  initialEdges: Edge[],
  options: UseForceLayoutOptions = {},
): UseForceLayoutResult {
  const { strength = -400, distance = 200 } = options;
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
    const newNodes = runSimulation(initialNodes, { simNodes, simLinks, strength, distance });
    setLayoutedNodes(newNodes);
    setIsLayouting(false);
  }, [initialNodes, simNodes, simLinks, strength, distance]);

  return { nodes: layoutedNodes, edges: initialEdges, isLayouting };
}
