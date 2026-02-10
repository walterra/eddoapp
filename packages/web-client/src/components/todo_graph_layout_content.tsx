/**
 * Theme-driven graph layout content components.
 */
import { type Edge, type Node } from '@xyflow/react';
import { type FC } from 'react';

import { useElkLayout } from '../hooks/use_elk_layout';
import { useForceLayout } from '../hooks/use_force_layout';
import { useGraphvizLayout } from '../hooks/use_graphviz_layout';
import { useIsometricLayout } from '../hooks/use_isometric_layout';

import { GraphRenderer } from './todo_graph_renderer';

export interface LayoutOptions {
  width: number;
  height: number;
}

type ThemeLayout = 'force' | 'isometric' | 'elk' | 'elk_radial' | 'graphviz' | undefined;

interface BaseLayoutProps {
  nodes: Node[];
  edges: Edge[];
  options: LayoutOptions;
  highlightedTodoId: string | null;
  showThemeSelector: boolean;
}

interface ElkLayoutContentProps extends BaseLayoutProps {
  rootNodeId?: string | null;
  algorithm?: 'layered' | 'radial';
}

interface ThemedLayoutContentProps extends BaseLayoutProps {
  layout: ThemeLayout;
  dependencyRootTodoId?: string | null;
}

/** Force layout content */
const ForceLayoutContent: FC<BaseLayoutProps> = ({
  nodes,
  edges,
  options,
  highlightedTodoId,
  showThemeSelector,
}) => {
  const result = useForceLayout(nodes, edges, options);

  return (
    <GraphRenderer
      edges={result.edges}
      highlightedTodoId={highlightedTodoId}
      isLayouting={result.isLayouting}
      nodes={result.nodes}
      showThemeSelector={showThemeSelector}
    />
  );
};

/** Isometric layout content */
const IsometricLayoutContent: FC<BaseLayoutProps> = ({
  nodes,
  edges,
  options,
  highlightedTodoId,
  showThemeSelector,
}) => {
  const result = useIsometricLayout(nodes, edges, options);

  return (
    <GraphRenderer
      edges={result.edges}
      highlightedTodoId={highlightedTodoId}
      isLayouting={result.isLayouting}
      nodes={result.nodes}
      originalNodes={nodes}
      roadNetwork={result.roadNetwork}
      showThemeSelector={showThemeSelector}
    />
  );
};

/** ELK layout content */
const ElkLayoutContent: FC<ElkLayoutContentProps> = ({
  nodes,
  edges,
  options,
  highlightedTodoId,
  showThemeSelector,
  rootNodeId,
  algorithm = 'layered',
}) => {
  const result = useElkLayout(nodes, edges, {
    ...options,
    algorithm,
    rootNodeId,
  });

  return (
    <GraphRenderer
      edges={result.edges}
      highlightedTodoId={highlightedTodoId}
      isLayouting={result.isLayouting}
      nodes={result.nodes}
      showThemeSelector={showThemeSelector}
    />
  );
};

/** Graphviz layout content */
const GraphvizLayoutContent: FC<ElkLayoutContentProps> = ({
  nodes,
  edges,
  options,
  highlightedTodoId,
  showThemeSelector,
  rootNodeId,
}) => {
  const result = useGraphvizLayout(nodes, edges, {
    ...options,
    rootNodeId,
  });

  return (
    <GraphRenderer
      edges={result.edges}
      highlightedTodoId={highlightedTodoId}
      isLayouting={result.isLayouting}
      nodes={result.nodes}
      showThemeSelector={showThemeSelector}
    />
  );
};

/** Render graph layout component for current theme layout mode */
export const ThemedLayoutContent: FC<ThemedLayoutContentProps> = ({
  layout,
  nodes,
  edges,
  options,
  highlightedTodoId,
  showThemeSelector,
  dependencyRootTodoId,
}) => {
  const baseProps = { nodes, edges, options, highlightedTodoId, showThemeSelector };

  if (layout === 'isometric') {
    return <IsometricLayoutContent {...baseProps} />;
  }

  if (layout === 'elk_radial') {
    return <ElkLayoutContent {...baseProps} algorithm="radial" rootNodeId={dependencyRootTodoId} />;
  }

  if (layout === 'elk') {
    return <ElkLayoutContent {...baseProps} rootNodeId={dependencyRootTodoId} />;
  }

  if (layout === 'graphviz') {
    return <GraphvizLayoutContent {...baseProps} rootNodeId={dependencyRootTodoId} />;
  }

  return <ForceLayoutContent {...baseProps} />;
};
