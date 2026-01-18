/**
 * Graph renderer component for React Flow visualization.
 * Handles node highlighting, dragging, and layout state.
 * Uses theme system for customizable visual appearance.
 */
import {
  applyNodeChanges,
  Controls,
  type Edge,
  type Node,
  type NodeChange,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import { Spinner } from 'flowbite-react';
import { type FC, useCallback, useEffect, useMemo, useState } from 'react';

import { type RoadNetworkData } from '../hooks/use_isometric_layout';

import { useCurrentTheme } from './todo_graph/themes/context';
import { GroundTileNode } from './todo_graph_ground_tile_node';
import { ThemeSelector } from './todo_graph_theme_selector';
import { ThemedEdge } from './todo_graph_themed_edge';
import { ThemedGraphLegend } from './todo_graph_themed_legend';
import {
  ThemedFileNode,
  ThemedMetadataNode,
  ThemedTodoNode,
  ThemedUserNode,
} from './todo_graph_themed_nodes';
import { WalkingCharacter } from './walking_character';

/** Custom node types for React Flow - using themed wrappers */
const nodeTypes = {
  todoNode: ThemedTodoNode,
  metadataNode: ThemedMetadataNode,
  fileNode: ThemedFileNode,
  userNode: ThemedUserNode,
  groundTileNode: GroundTileNode,
};

/** Custom edge types for React Flow */
const edgeTypes = {
  curved: ThemedEdge,
};

/** Apply highlight state to nodes */
const applyHighlight = (nodes: Node[], highlightedId: string | null): Node[] =>
  nodes.map((node) => {
    if (node.type !== 'todoNode') return node;
    return { ...node, data: { ...node.data, isHighlighted: node.id === highlightedId } };
  });

/** Loading spinner shown during layout calculation */
const LayoutingSpinner: FC = () => (
  <div className="flex h-[calc(100vh-200px)] w-full items-center justify-center">
    <Spinner aria-label="Calculating layout" size="lg" />
    <span className="ml-3 text-neutral-600 dark:text-neutral-400">Arranging nodes...</span>
  </div>
);

export interface GraphRendererProps {
  nodes: Node[];
  edges: Edge[];
  isLayouting: boolean;
  highlightedTodoId: string | null;
  /** Road network data for walking character animation (Village theme only) */
  roadNetwork?: RoadNetworkData | null;
  /** Original nodes with fresh data (for walking character messages) */
  originalNodes?: Node[];
}

/** Custom hook for managing node state and highlighting */
const useNodeState = (layoutedNodes: Node[], highlightedTodoId: string | null) => {
  const [nodes, setNodes] = useState(() => applyHighlight(layoutedNodes, highlightedTodoId));

  useEffect(() => {
    setNodes(applyHighlight(layoutedNodes, highlightedTodoId));
  }, [layoutedNodes, highlightedTodoId]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  return { nodes, onNodesChange };
};

/** Custom hook for auto-fitting view after layout */
const useFitViewEffect = (layoutedNodes: Node[], isLayouting: boolean) => {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!isLayouting && layoutedNodes.length > 0) {
      const timer = setTimeout(() => fitView({ padding: 0.1, duration: 500 }), 50);
      return () => clearTimeout(timer);
    }
  }, [layoutedNodes, isLayouting, fitView]);
};

/** Inner component that can access useReactFlow and theme */
export const GraphRenderer: FC<GraphRendererProps> = ({
  nodes: layoutedNodes,
  edges,
  isLayouting,
  highlightedTodoId,
  roadNetwork,
  originalNodes,
}) => {
  const theme = useCurrentTheme();
  const { nodes, onNodesChange } = useNodeState(layoutedNodes, highlightedTodoId);

  useFitViewEffect(layoutedNodes, isLayouting);

  // Memoize background component to avoid re-renders
  const BackgroundComponent = useMemo(() => theme.Background, [theme]);

  if (isLayouting) return <LayoutingSpinner />;

  // Check if nodes should be draggable (default true, but Village theme locks them)
  const nodesDraggable = theme.nodesDraggable ?? true;

  // Only show walking character for Village theme (isometric layout)
  const showWalkingCharacter = theme.id === 'rpg2' && roadNetwork;

  return (
    <ReactFlow
      className={`h-full w-full ${theme.classPrefix}`}
      defaultEdgeOptions={{ type: 'curved' }}
      edgeTypes={edgeTypes}
      edges={edges}
      fitView
      key={theme.id}
      maxZoom={4}
      minZoom={0.3}
      nodeTypes={nodeTypes}
      nodes={nodes}
      nodesDraggable={nodesDraggable}
      onNodesChange={onNodesChange}
      proOptions={{ hideAttribution: true }}
    >
      <BackgroundComponent />
      {showWalkingCharacter && (
        <WalkingCharacter nodes={originalNodes ?? layoutedNodes} roadNetwork={roadNetwork} />
      )}
      <Controls className={theme.controlsClassName} />
      <ThemedGraphLegend />
      <ThemeSelector />
    </ReactFlow>
  );
};
