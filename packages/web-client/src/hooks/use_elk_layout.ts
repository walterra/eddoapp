/**
 * Hook for hierarchical graph layout using ELK (Eclipse Layout Kernel).
 * Better for parent/child relationships and avoiding edge crossings.
 */
import type { Edge, Node } from '@xyflow/react';
import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import { useCallback, useEffect, useState } from 'react';

const elk = new ELK();

/** ELK layout options for hierarchical todo graphs */
const ELK_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '80',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.edgeRouting': 'ORTHOGONAL',
};

interface UseElkLayoutResult {
  nodes: Node[];
  edges: Edge[];
  isLayouting: boolean;
}

/** Build ELK graph structure from React Flow nodes/edges */
const buildElkGraph = (nodes: Node[], edges: Edge[]): ElkNode => ({
  id: 'root',
  layoutOptions: ELK_OPTIONS,
  children: nodes.map((node) => ({
    id: node.id,
    width: node.type === 'metadataNode' ? 120 : 160,
    height: node.type === 'metadataNode' ? 50 : 45,
  })),
  edges: edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  })),
});

/** Apply ELK positions to React Flow nodes */
const applyElkPositions = (nodes: Node[], elkGraph: ElkNode): Node[] => {
  const elkNodeMap = new Map(elkGraph.children?.map((n) => [n.id, n]) ?? []);

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
export function useElkLayout(initialNodes: Node[], initialEdges: Edge[]): UseElkLayoutResult {
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
      const elkGraph = buildElkGraph(initialNodes, initialEdges);
      const layoutedGraph = await elk.layout(elkGraph);
      const layoutedNodes = applyElkPositions(initialNodes, layoutedGraph);
      setNodes(layoutedNodes);
    } catch (error) {
      console.error('ELK layout failed:', error);
      setNodes(initialNodes);
    } finally {
      setIsLayouting(false);
    }
  }, [initialNodes, initialEdges]);

  useEffect(() => {
    runLayout();
  }, [runLayout]);

  return { nodes, edges: initialEdges, isLayouting };
}
