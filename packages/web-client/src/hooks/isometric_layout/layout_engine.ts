/**
 * Layout engine for isometric layout.
 */
import type { Edge, Node } from '@xyflow/react';

import { gridToIso } from './grid_utils';
import { generateGroundTiles } from './ground_tiles';
import {
  buildHierarchy,
  buildMetadataFileMap,
  buildMetadataTodoMap,
  groupByType,
} from './node_grouping';
import { placeFiles, placeMetadata, placeTodoVillages, placeUsers } from './node_placement';
import { buildRoadNetwork } from './road_network';
import type { AssignPositionsResult, GridPosition, IsometricConfig, NodeWithGrid } from './types';

/** Apply isometric positions to nodes and sort by z-index for proper rendering order */
export const applyLayout = (nodesWithGrid: NodeWithGrid[], config: IsometricConfig): Node[] => {
  // Sort by z-index so ReactFlow renders in correct order (back to front)
  const sorted = [...nodesWithGrid].sort((a, b) => a.zIndex - b.zIndex);

  return sorted.map(({ node, col, row, zIndex }) => {
    const { x, y } = gridToIso(col, row, config);
    return {
      ...node,
      position: { x, y },
      zIndex,
      style: { ...node.style, zIndex },
    };
  });
};

/** Create structural fingerprint for memoization */
export const createKey = (nodes: Node[], edges: Edge[]): string => {
  const nIds = nodes
    .map((n) => n.id)
    .sort()
    .join(',');
  const eIds = edges
    .map((e) => `${e.source}->${e.target}`)
    .sort()
    .join(',');
  return `n:[${nIds}]|e:[${eIds}]`;
};

/** Assign grid positions to all nodes - extended to return road network */
export const assignPositionsExtended = (
  nodes: Node[],
  edges: Edge[],
  config: IsometricConfig,
): AssignPositionsResult => {
  const { todos, metadata, files, users } = groupByType(nodes);
  const hierarchy = buildHierarchy(todos);
  const occupied = new Set<string>();
  const gridSize = config.gridSize;

  // Place todos first (villages)
  const todoNodes = placeTodoVillages(hierarchy, gridSize, occupied);

  // Build map of todo positions
  const todoPositions = new Map<string, GridPosition>();
  for (const tn of todoNodes) {
    todoPositions.set(tn.node.id, { col: tn.col, row: tn.row });
  }

  // Place files next (forest around villages)
  const fileNodes = placeFiles(files, gridSize, occupied);

  // Build map of file positions
  const filePositions = new Map<string, GridPosition>();
  for (const fn of fileNodes) {
    filePositions.set(fn.node.id, { col: fn.col, row: fn.row });
  }

  // Build edge maps
  const metadataTodoMap = buildMetadataTodoMap(edges);
  const metadataFileMap = buildMetadataFileMap(edges);

  // Place metadata among their files (agents in the forest)
  const metaNodes = placeMetadata({
    metadata,
    filePositions,
    todoPositions,
    metadataFileMap,
    metadataTodoMap,
    occupied,
  });

  // Build map of metadata positions
  const metadataPositions = new Map<string, GridPosition>();
  for (const mn of metaNodes) {
    metadataPositions.set(mn.node.id, { col: mn.col, row: mn.row });
  }

  // Place users
  const userNodes = placeUsers(users, gridSize);

  // Build road network connecting metadata to their todos (roads from forest to villages)
  const roadTiles = buildRoadNetwork(metaNodes, todoPositions, metadataTodoMap);

  // Generate ground tiles to cover ALL content with roads
  const allContent = [...todoNodes, ...metaNodes, ...fileNodes, ...userNodes];
  const groundTiles = generateGroundTiles(allContent, roadTiles, todoPositions);

  return {
    nodes: [...groundTiles, ...allContent],
    roadTiles,
    todoPositions,
    metadataPositions,
  };
};
