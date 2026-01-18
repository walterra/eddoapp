/**
 * Grid utility functions for isometric layout.
 */
import type { GridPosition, IsometricConfig, RoadVariant } from './types';

/** Convert grid coordinates to isometric screen coordinates */
export const gridToIso = (col: number, row: number, config: IsometricConfig) => ({
  x: config.originX + (col - row) * (config.cellWidth / 2),
  y: config.originY + (col + row) * (config.cellHeight / 2),
});

/** Convert grid position to screen coordinates */
export const gridToScreen = (
  pos: GridPosition,
  config: IsometricConfig,
): { x: number; y: number } => gridToIso(pos.col, pos.row, config);

/** Calculate z-index for proper isometric depth sorting */
export const calcZIndex = (col: number, row: number): number => (col + row) * 10;

/** Position key generator */
export const posKey = (c: number, r: number): string => `${c},${r}`;

/** Deterministic hash for a coordinate - always returns same value for same input */
export const coordHash = (col: number, row: number): number => {
  const n = col * 374761393 + row * 668265263;
  const h = (n ^ (n >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296; // Returns 0-1
};

/** Calculate Manhattan distance between two grid positions */
export const gridDistance = (col1: number, row1: number, col2: number, row2: number): number => {
  return Math.abs(col1 - col2) + Math.abs(row1 - row2);
};

/** Manhattan distance between two points */
export const manhattanDist = (c1: number, r1: number, c2: number, r2: number): number =>
  Math.abs(c1 - c2) + Math.abs(r1 - r2);

/** Check if a ring position is valid and unoccupied */
const isValidRingPosition = (c: number, ro: number, occupied: Set<string>): boolean =>
  c >= 0 && ro >= 0 && !occupied.has(posKey(c, ro));

/** Search a single ring at radius r for an unoccupied position */
const searchRing = (
  targetCol: number,
  targetRow: number,
  r: number,
  occupied: Set<string>,
): { col: number; row: number } | null => {
  for (let dc = -r; dc <= r; dc++) {
    for (let dr = -r; dr <= r; dr++) {
      if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
      const c = targetCol + dc;
      const ro = targetRow + dr;
      if (isValidRingPosition(c, ro, occupied)) {
        return { col: c, row: ro };
      }
    }
  }
  return null;
};

/** Find available position near target using spiral search */
export const findNearby = (
  targetCol: number,
  targetRow: number,
  occupied: Set<string>,
): { col: number; row: number } => {
  if (!occupied.has(posKey(targetCol, targetRow))) return { col: targetCol, row: targetRow };

  for (let r = 1; r < 15; r++) {
    const found = searchRing(targetCol, targetRow, r, occupied);
    if (found) return found;
  }
  return { col: targetCol, row: targetRow };
};

/** Check 4-directional neighbors */
const getNeighborFlags = (
  col: number,
  row: number,
  roads: Set<string>,
): { hasN: boolean; hasS: boolean; hasE: boolean; hasW: boolean } => ({
  hasN: roads.has(posKey(col, row - 1)),
  hasS: roads.has(posKey(col, row + 1)),
  hasE: roads.has(posKey(col + 1, row)),
  hasW: roads.has(posKey(col - 1, row)),
});

/** Get corner variant based on neighbor flags */
const getCornerVariant = (n: boolean, s: boolean, e: boolean, w: boolean): RoadVariant => {
  if (n && e) return 'corner-ne';
  if (n && w) return 'corner-nw';
  if (s && e) return 'corner-se';
  if (s && w) return 'corner-sw';
  return 'straight';
};

/** Determine road tile variant based on neighbor connectivity */
export const getRoadVariant = (col: number, row: number, roads: Set<string>): RoadVariant => {
  const { hasN, hasS, hasE, hasW } = getNeighborFlags(col, row, roads);
  const count = [hasN, hasS, hasE, hasW].filter(Boolean).length;

  // 3-4 neighbors = intersection
  if (count >= 3) return 'cross';

  // 2 neighbors = straight or corner
  if (count === 2) {
    if (hasN && hasS) return 'straight'; // vertical
    if (hasE && hasW) return 'straight'; // horizontal
    return getCornerVariant(hasN, hasS, hasE, hasW);
  }

  return 'straight';
};
