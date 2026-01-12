/**
 * Graph renderer component for React Flow visualization.
 * Handles node highlighting, dragging, and layout state.
 */
import {
  applyNodeChanges,
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeChange,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import { Spinner } from 'flowbite-react';
import { type FC, useCallback, useEffect, useState } from 'react';

import { CurvedEdge } from './todo_graph_curved_edge';
import { FileNode } from './todo_graph_file_node';
import { GraphLegend } from './todo_graph_legend';
import { MetadataNode } from './todo_graph_metadata_node';
import { TodoNode } from './todo_graph_node';
import { UserNode } from './todo_graph_user_node';

/** Custom node types for React Flow */
const nodeTypes = {
  todoNode: TodoNode,
  metadataNode: MetadataNode,
  fileNode: FileNode,
  userNode: UserNode,
};

/** Custom edge types for React Flow */
const edgeTypes = {
  curved: CurvedEdge,
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

/** Controls styling for light/dark mode */
const CONTROLS_CLASS =
  '!border-neutral-300 !bg-white !shadow-lg dark:!border-neutral-700 dark:!bg-neutral-800 ' +
  '[&>button]:!border-neutral-200 [&>button]:!bg-neutral-50 [&>button]:!fill-neutral-600 ' +
  'dark:[&>button]:!border-neutral-600 dark:[&>button]:!bg-neutral-700 dark:[&>button]:!fill-neutral-300 ' +
  '[&>button:hover]:!bg-neutral-100 dark:[&>button:hover]:!bg-neutral-600';

export interface GraphRendererProps {
  nodes: Node[];
  edges: Edge[];
  isLayouting: boolean;
  highlightedTodoId: string | null;
}

/** Inner component that can access useReactFlow */
export const GraphRenderer: FC<GraphRendererProps> = ({
  nodes: layoutedNodes,
  edges,
  isLayouting,
  highlightedTodoId,
}) => {
  const { fitView } = useReactFlow();
  const [nodes, setNodes] = useState(() => applyHighlight(layoutedNodes, highlightedTodoId));

  useEffect(() => {
    setNodes(applyHighlight(layoutedNodes, highlightedTodoId));
  }, [layoutedNodes, highlightedTodoId]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  useEffect(() => {
    if (!isLayouting && layoutedNodes.length > 0) {
      const timer = setTimeout(() => fitView({ padding: 0.1, duration: 500 }), 50);
      return () => clearTimeout(timer);
    }
  }, [layoutedNodes, isLayouting, fitView]);

  if (isLayouting) return <LayoutingSpinner />;

  return (
    <ReactFlow
      className="h-full w-full"
      defaultEdgeOptions={{ type: 'curved' }}
      edgeTypes={edgeTypes}
      edges={edges}
      fitView
      maxZoom={4}
      minZoom={0.3}
      nodeTypes={nodeTypes}
      nodes={nodes}
      onNodesChange={onNodesChange}
      proOptions={{ hideAttribution: true }}
    >
      <Background
        className="!bg-neutral-100 dark:!bg-neutral-800"
        color="#94a3b8"
        gap={16}
        size={1}
      />
      <Controls className={CONTROLS_CLASS} />
      <GraphLegend />
    </ReactFlow>
  );
};
