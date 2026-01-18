/**
 * Pathfinding utilities for walking characters.
 */
import type { GridPosition } from '../isometric_layout';

const toKey = (pos: GridPosition): string => `${pos.col},${pos.row}`;

const getNeighbors = (pos: GridPosition, roadTiles: Set<string>): GridPosition[] => {
  const directions = [
    { dc: 0, dr: -1 },
    { dc: 0, dr: 1 },
    { dc: 1, dr: 0 },
    { dc: -1, dr: 0 },
    { dc: 1, dr: -1 },
    { dc: 1, dr: 1 },
    { dc: -1, dr: -1 },
    { dc: -1, dr: 1 },
  ];
  return directions
    .map(({ dc, dr }) => ({ col: pos.col + dc, row: pos.row + dr }))
    .filter((p) => roadTiles.has(toKey(p)));
};

/** Find path between two grid positions using BFS */
export const findPath = (
  start: GridPosition,
  end: GridPosition,
  roadTiles: Set<string>,
): GridPosition[] | null => {
  if (!roadTiles.has(toKey(start)) || !roadTiles.has(toKey(end))) return null;
  const queue: Array<{ pos: GridPosition; path: GridPosition[] }> = [{ pos: start, path: [start] }];
  const visited = new Set<string>([toKey(start)]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (toKey(current.pos) === toKey(end)) return current.path;
    for (const neighbor of getNeighbors(current.pos, roadTiles)) {
      const key = toKey(neighbor);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ pos: neighbor, path: [...current.path, neighbor] });
      }
    }
  }
  return null;
};

const searchRingForRoad = (
  pos: GridPosition,
  r: number,
  roadTiles: Set<string>,
): GridPosition | null => {
  for (let dc = -r; dc <= r; dc++) {
    for (let dr = -r; dr <= r; dr++) {
      if (Math.abs(dc) !== r && Math.abs(dr) !== r) continue;
      const candidate = { col: pos.col + dc, row: pos.row + dr };
      if (roadTiles.has(toKey(candidate))) return candidate;
    }
  }
  return null;
};

/** Find nearest road tile to a position */
export const findNearestRoad = (pos: GridPosition, roadTiles: Set<string>): GridPosition | null => {
  if (roadTiles.has(toKey(pos))) return pos;
  for (let r = 1; r < 20; r++) {
    const found = searchRingForRoad(pos, r, roadTiles);
    if (found) return found;
  }
  return null;
};

/** Pick a random destination from todo positions */
export const pickDestination = (
  current: GridPosition,
  todos: Map<string, GridPosition>,
  roads: Set<string>,
): GridPosition | null => {
  const dests = Array.from(todos.values())
    .map((pos) => findNearestRoad(pos, roads))
    .filter((pos): pos is GridPosition => pos !== null && toKey(pos) !== toKey(current));
  return dests.length > 0 ? dests[Math.floor(Math.random() * dests.length)] : null;
};

/** Check if a grid position is on a todo (house) tile */
export const isOnTodoTile = (
  pos: GridPosition,
  todoPositions: Map<string, GridPosition>,
): boolean => {
  const posKey = toKey(pos);
  for (const todoPos of todoPositions.values()) {
    if (toKey(todoPos) === posKey) return true;
  }
  return false;
};

/** Check if character can hold bubble for at least N more steps without hitting a house or end */
export const canHoldBubbleForSteps = (
  gridPath: GridPosition[],
  currentIndex: number,
  todoPositions: Map<string, GridPosition>,
  minSteps: number,
): boolean => {
  const remainingSteps = gridPath.length - currentIndex;
  if (remainingSteps < minSteps) return false;

  // Check next N steps don't land on a house
  for (let i = 0; i < minSteps; i++) {
    const stepIndex = currentIndex + i;
    if (stepIndex >= gridPath.length) return false;
    if (isOnTodoTile(gridPath[stepIndex], todoPositions)) return false;
  }
  return true;
};
