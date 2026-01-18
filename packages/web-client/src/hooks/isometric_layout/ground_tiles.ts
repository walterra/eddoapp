/**
 * Ground tile generation for isometric layout.
 */
import { coordHash, getRoadVariant, posKey } from './grid_utils';
import type { GridPosition, NodeWithGrid } from './types';

interface ShouldKeepTileParams {
  col: number;
  row: number;
  centerCol: number;
  centerRow: number;
  maxDist: number;
  contentPositions: Set<string>;
  roadTiles: Set<string>;
}

/** Check if tile should be kept based on distance from center and hash */
const shouldKeepTile = (params: ShouldKeepTileParams): boolean => {
  const { col, row, centerCol, centerRow, maxDist, contentPositions, roadTiles } = params;
  const tileKey = posKey(col, row);

  // Always keep tiles that have content on them
  if (contentPositions.has(tileKey)) return true;

  // Always keep road tiles
  if (roadTiles.has(tileKey)) return true;

  // Calculate distance from center (using diamond/manhattan distance for isometric feel)
  const distFromCenter = Math.abs(col - centerCol) + Math.abs(row - centerRow);
  const normalizedDist = distFromCenter / maxDist;

  // Inner area: always keep
  if (normalizedDist < 0.6) return true;

  // Middle area: keep most, remove some
  if (normalizedDist < 0.8) {
    return coordHash(col, row) > 0.15;
  }

  // Outer edge: scattered removal for organic look
  const keepChance = 1 - (normalizedDist - 0.8) * 4; // 0.8->1.0, 1.0->0.2
  return coordHash(col, row) < Math.max(0.2, keepChance);
};

/** Calculate grid bounds with padding */
const calculateBounds = (
  allNodes: NodeWithGrid[],
): { minCol: number; maxCol: number; minRow: number; maxRow: number } => {
  const cols = allNodes.map((n) => n.col);
  const rows = allNodes.map((n) => n.row);
  return {
    minCol: Math.min(...cols) - 3,
    maxCol: Math.max(...cols) + 3,
    minRow: Math.min(...rows) - 3,
    maxRow: Math.max(...rows) + 3,
  };
};

/** Determine tile type based on position */
const determineTileType = (
  col: number,
  row: number,
  housePositions: Set<string>,
  roadTiles: Set<string>,
): { tileType: string; roadVariant?: string } => {
  const key = posKey(col, row);
  const hasHouse = housePositions.has(key);
  const isRoad = roadTiles.has(key);

  if (hasHouse) {
    return { tileType: 'grass-desaturated' };
  }
  if (isRoad) {
    return { tileType: 'road', roadVariant: getRoadVariant(col, row, roadTiles) };
  }
  return { tileType: 'grass' };
};

/** Generate ground tiles with organic scattered edges and road network */
export const generateGroundTiles = (
  allNodes: NodeWithGrid[],
  roadTiles: Set<string>,
  todoPositions: Map<string, GridPosition>,
): NodeWithGrid[] => {
  const { minCol, maxCol, minRow, maxRow } = calculateBounds(allNodes);

  const centerCol = (minCol + maxCol) / 2;
  const centerRow = (minRow + maxRow) / 2;
  const maxDist = Math.max(maxCol - minCol, maxRow - minRow) / 2 + 2;

  // Build set of positions that have content
  const contentPositions = new Set(allNodes.map((n) => posKey(n.col, n.row)));

  // Build set of positions that have houses (todos)
  const housePositions = new Set<string>();
  for (const pos of todoPositions.values()) {
    housePositions.add(posKey(pos.col, pos.row));
  }

  const tiles: NodeWithGrid[] = [];
  for (let col = minCol; col <= maxCol; col++) {
    for (let row = minRow; row <= maxRow; row++) {
      if (
        !shouldKeepTile({
          col,
          row,
          centerCol,
          centerRow,
          maxDist,
          contentPositions,
          roadTiles,
        })
      ) {
        continue;
      }

      const { tileType, roadVariant } = determineTileType(col, row, housePositions, roadTiles);

      tiles.push({
        node: {
          id: `ground:${col},${row}`,
          type: 'groundTileNode',
          position: { x: 0, y: 0 },
          data: { tileType, col, row, roadVariant },
          draggable: false,
          selectable: false,
        },
        col,
        row,
        zIndex: -1000,
      });
    }
  }
  return tiles;
};
