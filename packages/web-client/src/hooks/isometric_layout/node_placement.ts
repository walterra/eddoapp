/**
 * Node placement functions for isometric layout.
 */
import type { Node } from '@xyflow/react';

import { calcZIndex, findNearby, gridDistance, posKey } from './grid_utils';
import type { GridPosition, MetadataEdgeMap, NodeWithGrid } from './types';

/** Minimum distance between signpost and any house */
const MIN_SIGNPOST_HOUSE_DISTANCE = 5;

/** Minimum distance between signposts */
const MIN_SIGNPOST_SIGNPOST_DISTANCE = 3;

/** Check if position is far enough from all houses */
const isFarEnoughFromHouses = (
  col: number,
  row: number,
  housePositions: Array<{ col: number; row: number }>,
  minDist: number,
): boolean => {
  for (const house of housePositions) {
    if (gridDistance(col, row, house.col, house.row) < minDist) {
      return false;
    }
  }
  return true;
};

/** Check if position is far enough from all signposts */
const isFarEnoughFromSignposts = (
  col: number,
  row: number,
  signposts: Array<{ col: number; row: number }>,
  minDist: number,
): boolean => {
  for (const signpost of signposts) {
    if (gridDistance(col, row, signpost.col, signpost.row) < minDist) {
      return false;
    }
  }
  return true;
};

interface FindPositionOptions {
  startCol: number;
  startRow: number;
  occupied: Set<string>;
  todoPositions: Map<string, { col: number; row: number }>;
  existingSignposts: Array<{ col: number; row: number }>;
  minHouseDist: number;
  minSignpostDist: number;
}

/** Check if position is valid for signpost placement */
const isValidSignpostPosition = (col: number, row: number, opts: FindPositionOptions): boolean => {
  const { occupied, todoPositions, existingSignposts, minHouseDist, minSignpostDist } = opts;
  const key = posKey(col, row);
  if (occupied.has(key)) return false;
  const housePositions = Array.from(todoPositions.values());
  if (!isFarEnoughFromHouses(col, row, housePositions, minHouseDist)) return false;
  if (!isFarEnoughFromSignposts(col, row, existingSignposts, minSignpostDist)) return false;
  return true;
};

/** Search a ring at given radius for valid signpost position */
const searchSignpostRing = (radius: number, opts: FindPositionOptions): GridPosition | null => {
  const { startCol, startRow } = opts;
  for (let dc = -radius; dc <= radius; dc++) {
    for (let dr = -radius; dr <= radius; dr++) {
      if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue;
      const col = startCol + dc;
      const row = startRow + dr;
      if (isValidSignpostPosition(col, row, opts)) {
        return { col, row };
      }
    }
  }
  return null;
};

/** Find nearby position away from houses and signposts */
const findNearbyAwayFromHousesAndSignposts = (opts: FindPositionOptions): GridPosition => {
  // Spiral outward to find valid position
  for (let radius = 0; radius < 30; radius++) {
    const found = searchSignpostRing(radius, opts);
    if (found) return found;
  }
  // Fallback if nothing found
  return findNearby(opts.startCol, opts.startRow, opts.occupied);
};

/** Place todos in village clusters - roots spread out, children nearby */
export const placeTodoVillages = (
  hierarchy: Map<string | null, Node[]>,
  gridSize: number,
  occupied: Set<string>,
): NodeWithGrid[] => {
  const result: NodeWithGrid[] = [];
  const roots = [...(hierarchy.get(null) ?? [])].sort((a, b) => a.id.localeCompare(b.id));

  // Calculate village spacing based on number of root todos
  const numRoots = roots.length;
  const villagesPerRow = Math.ceil(Math.sqrt(numRoots));
  const spacing = Math.max(4, Math.floor(gridSize / (villagesPerRow + 1)));

  roots.forEach((node, idx) => {
    const positions = placeRootAndChildren({
      rootNode: node,
      rootIdx: idx,
      hierarchy,
      gridSize,
      villagesPerRow,
      spacing,
    });
    for (const pos of positions) {
      occupied.add(posKey(pos.col, pos.row));
      result.push(pos);
    }
  });

  return result;
};

interface PlaceRootParams {
  rootNode: Node;
  rootIdx: number;
  hierarchy: Map<string | null, Node[]>;
  gridSize: number;
  villagesPerRow: number;
  spacing: number;
}

/** Place a root todo and its children */
const placeRootAndChildren = (params: PlaceRootParams): NodeWithGrid[] => {
  const { rootNode, rootIdx, hierarchy, gridSize, villagesPerRow, spacing } = params;
  const result: NodeWithGrid[] = [];
  const localOccupied = new Set<string>();
  const numRoots = hierarchy.get(null)?.length ?? 1;

  // Spread root todos across the grid like villages
  const villageRow = Math.floor(rootIdx / villagesPerRow);
  const villageCol = rootIdx % villagesPerRow;
  const baseCol = Math.floor(gridSize / 2) + (villageCol - villagesPerRow / 2) * spacing;
  const baseRow =
    Math.floor(gridSize / 2) + (villageRow - Math.ceil(numRoots / villagesPerRow) / 2) * spacing;

  const pos = findNearby(Math.round(baseCol), Math.round(baseRow), localOccupied);
  localOccupied.add(posKey(pos.col, pos.row));
  result.push({ node: rootNode, col: pos.col, row: pos.row, zIndex: calcZIndex(pos.col, pos.row) });

  // Place children in a tight cluster around parent
  const children = hierarchy.get(rootNode.id) ?? [];
  const childOffsets = [
    { dc: 1, dr: 0 },
    { dc: 0, dr: 1 },
    { dc: 1, dr: 1 },
    { dc: -1, dr: 0 },
    { dc: 0, dr: -1 },
    { dc: 2, dr: 0 },
    { dc: 0, dr: 2 },
    { dc: 1, dr: -1 },
    { dc: -1, dr: 1 },
  ];

  children.forEach((child, childIdx) => {
    const offset = childOffsets[childIdx % childOffsets.length];
    const childPos = findNearby(pos.col + offset.dc, pos.row + offset.dr, localOccupied);
    localOccupied.add(posKey(childPos.col, childPos.row));
    result.push({ node: child, ...childPos, zIndex: calcZIndex(childPos.col, childPos.row) });
  });

  return result;
};

interface PlaceMetadataOptions {
  metadata: Node[];
  filePositions: Map<string, GridPosition>;
  todoPositions: Map<string, GridPosition>;
  metadataFileMap: MetadataEdgeMap;
  metadataTodoMap: MetadataEdgeMap;
  occupied: Set<string>;
}

/** Place metadata nodes among their connected files (agents in the forest) */
export const placeMetadata = (opts: PlaceMetadataOptions): NodeWithGrid[] => {
  const { metadata, filePositions, todoPositions, metadataFileMap, metadataTodoMap, occupied } =
    opts;
  const result: NodeWithGrid[] = [];
  const placedSignposts: Array<{ col: number; row: number }> = [];

  for (const node of metadata) {
    const pos = findMetadataPosition({
      node,
      filePositions,
      todoPositions,
      metadataFileMap,
      metadataTodoMap,
      occupied,
      placedSignposts,
      fallbackIdx: result.length,
    });
    occupied.add(posKey(pos.col, pos.row));
    placedSignposts.push(pos);
    result.push({ node, ...pos, zIndex: calcZIndex(pos.col, pos.row) + 50 });
  }

  return result;
};

interface FindMetadataPositionParams {
  node: Node;
  filePositions: Map<string, GridPosition>;
  todoPositions: Map<string, GridPosition>;
  metadataFileMap: MetadataEdgeMap;
  metadataTodoMap: MetadataEdgeMap;
  occupied: Set<string>;
  placedSignposts: Array<{ col: number; row: number }>;
  fallbackIdx: number;
}

/** Find position for a metadata node */
const findMetadataPosition = (params: FindMetadataPositionParams): GridPosition => {
  const {
    node,
    filePositions,
    todoPositions,
    metadataFileMap,
    metadataTodoMap,
    occupied,
    placedSignposts,
    fallbackIdx,
  } = params;
  // Get files this agent connects to
  const connectedFileIds = metadataFileMap.get(node.id) ?? [];

  // Try to place at centroid of connected files
  const filePos = calculateCentroid(connectedFileIds, filePositions);
  if (filePos) {
    return findNearbyAwayFromHousesAndSignposts({
      startCol: filePos.col,
      startRow: filePos.row,
      occupied,
      todoPositions,
      existingSignposts: placedSignposts,
      minHouseDist: MIN_SIGNPOST_HOUSE_DISTANCE,
      minSignpostDist: MIN_SIGNPOST_SIGNPOST_DISTANCE,
    });
  }

  // Fallback: place near todos if no files
  const connectedTodoIds = metadataTodoMap.get(node.id) ?? [];
  const todoPos = calculateCentroid(connectedTodoIds, todoPositions);
  if (todoPos) {
    return findNearbyAwayFromHousesAndSignposts({
      startCol: todoPos.col - MIN_SIGNPOST_HOUSE_DISTANCE,
      startRow: todoPos.row - MIN_SIGNPOST_HOUSE_DISTANCE,
      occupied,
      todoPositions,
      existingSignposts: placedSignposts,
      minHouseDist: MIN_SIGNPOST_HOUSE_DISTANCE,
      minSignpostDist: MIN_SIGNPOST_SIGNPOST_DISTANCE,
    });
  }

  // Final fallback
  return findNearbyAwayFromHousesAndSignposts({
    startCol: 5 + fallbackIdx * 2,
    startRow: 1,
    occupied,
    todoPositions,
    existingSignposts: placedSignposts,
    minHouseDist: MIN_SIGNPOST_HOUSE_DISTANCE,
    minSignpostDist: MIN_SIGNPOST_SIGNPOST_DISTANCE,
  });
};

/** Calculate centroid of positions */
const calculateCentroid = (
  ids: string[],
  positions: Map<string, GridPosition>,
): GridPosition | null => {
  let sumCol = 0,
    sumRow = 0,
    count = 0;
  for (const id of ids) {
    const pos = positions.get(id);
    if (pos) {
      sumCol += pos.col;
      sumRow += pos.row;
      count++;
    }
  }
  if (count === 0) return null;
  return { col: Math.round(sumCol / count), row: Math.round(sumRow / count) };
};

/** Place file nodes scattered in forest areas */
export const placeFiles = (
  files: Node[],
  gridSize: number,
  occupied: Set<string>,
): NodeWithGrid[] => {
  const result: NodeWithGrid[] = [];

  // Scatter files around the edges and gaps
  files.forEach((node, idx) => {
    const angle = (idx / files.length) * Math.PI * 2;
    const radius = gridSize * 0.35 + (idx % 3) * 2;
    const col = Math.floor(gridSize / 2 + Math.cos(angle) * radius);
    const row = Math.floor(gridSize / 2 + Math.sin(angle) * radius);
    const pos = findNearby(col, row, occupied);
    occupied.add(posKey(pos.col, pos.row));
    result.push({ node, ...pos, zIndex: calcZIndex(pos.col, pos.row) });
  });

  return result;
};

/** Place user nodes in a corner */
export const placeUsers = (users: Node[], gridSize: number): NodeWithGrid[] => {
  return users.map((node, idx) => {
    const col = gridSize - 3 - idx;
    const row = 2;
    return { node, col, row, zIndex: calcZIndex(col, row) };
  });
};
