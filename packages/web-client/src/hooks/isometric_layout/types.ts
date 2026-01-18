/**
 * Type definitions for isometric layout.
 */
import type { Edge, Node } from '@xyflow/react';

/** Isometric grid configuration */
export interface IsometricConfig {
  cellWidth: number;
  cellHeight: number;
  originX: number;
  originY: number;
  gridSize: number;
}

/** Node with grid position for sorting */
export interface NodeWithGrid {
  node: Node;
  col: number;
  row: number;
  zIndex: number;
}

/** Todo node data type */
export interface TodoNodeData {
  todo?: { parentId?: string | null };
}

/** Road tile variant types */
export type RoadVariant =
  | 'cross'
  | 'corner-nw'
  | 'corner-ne'
  | 'corner-sw'
  | 'corner-se'
  | 'straight';

/** Grid position for walking character navigation */
export interface GridPosition {
  col: number;
  row: number;
}

/** Road network data for walking character animation */
export interface RoadNetworkData {
  /** Set of road tile positions as "col,row" strings */
  roadTiles: Set<string>;
  /** Map of todo IDs to their grid positions */
  todoPositions: Map<string, GridPosition>;
  /** Map of metadata (signpost) IDs to their grid positions */
  metadataPositions: Map<string, GridPosition>;
  /** Isometric config for coordinate conversion */
  config: IsometricConfig;
}

/** Extended result from assignPositions that includes road network data */
export interface AssignPositionsResult {
  nodes: NodeWithGrid[];
  roadTiles: Set<string>;
  todoPositions: Map<string, GridPosition>;
  metadataPositions: Map<string, GridPosition>;
}

/** Layout options */
export interface LayoutOptions {
  width?: number;
  height?: number;
}

/** Layout result */
export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
  isLayouting: boolean;
  /** Road network data for walking character - only available when not layouting */
  roadNetwork: RoadNetworkData | null;
}

/** Node groups by type */
export interface NodeGroups {
  todos: Node[];
  metadata: Node[];
  files: Node[];
  users: Node[];
}

/** Build map types for metadata relationships */
export type MetadataEdgeMap = Map<string, string[]>;
