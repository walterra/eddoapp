/**
 * Type definitions for the graph theming system.
 * Themes affect visual appearance only, not data or layout.
 */
import { type Position } from '@xyflow/react';
import { type CSSProperties, type FC, type ReactNode } from 'react';

import type { FileNodeData } from '../../todo_graph_file_node';
import type { MetadataNodeData } from '../../todo_graph_metadata_node';
import type { TodoNodeData } from '../../todo_graph_node';
import type { UserNodeData } from '../../todo_graph_user_node';

/** Icon specification - can be a React component or URL to image */
export type ThemeIcon = FC<{ className?: string; style?: CSSProperties }> | string;

/** Node style configuration */
export interface NodeStyle {
  bgColor: string;
  borderColor: string;
  extraClasses?: string;
}

/** Props for themed node components */
export interface ThemedTodoNodeProps {
  data: TodoNodeData;
  onClick: () => void;
}

export interface ThemedFileNodeProps {
  data: FileNodeData;
}

export interface ThemedMetadataNodeProps {
  data: MetadataNodeData;
}

export interface ThemedUserNodeProps {
  data: UserNodeData;
}

/** Props for themed edge component */
export interface ThemedEdgeProps {
  id: string;
  source?: string;
  target?: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
  style?: CSSProperties;
  markerEnd?: string;
}

/** Props for themed background component */
export interface ThemedBackgroundProps {
  children?: ReactNode;
}

/** Legend item configuration */
export interface LegendNodeItem {
  label: string;
  bgColor: string;
  borderColor: string;
  Icon: FC<{ className?: string }>;
  rounded?: boolean;
}

export interface LegendEdgeItem {
  label: string;
  color: string;
  dashed?: boolean;
  animated?: boolean;
}

/** Layout algorithm type */
export type LayoutAlgorithm = 'force' | 'isometric' | 'graphviz';

/** Whether nodes can be dragged */
export type DraggableMode = boolean;

/** Complete theme definition */
export interface GraphTheme {
  /** Unique theme identifier */
  id: string;
  /** Display name for UI */
  name: string;
  /** Theme description */
  description: string;

  /** Node components */
  nodes: {
    TodoNode: FC<ThemedTodoNodeProps>;
    FileNode: FC<ThemedFileNodeProps>;
    MetadataNode: FC<ThemedMetadataNodeProps>;
    UserNode: FC<ThemedUserNodeProps>;
  };

  /** Edge component */
  Edge: FC<ThemedEdgeProps>;

  /** Background component */
  Background: FC<ThemedBackgroundProps>;

  /** Legend configuration */
  legend: {
    nodes: LegendNodeItem[];
    edges: LegendEdgeItem[];
    /** Optional custom split todo icon for legend */
    SplitTodoIcon?: FC;
  };

  /** Controls styling class */
  controlsClassName: string;

  /** CSS class prefix for scoped styling */
  classPrefix: string;

  /** Layout algorithm to use (default: 'force') */
  layout?: LayoutAlgorithm;

  /** Whether nodes can be dragged (default: true) */
  nodesDraggable?: boolean;
}
