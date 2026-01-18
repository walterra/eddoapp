/**
 * Road network generation for isometric layout.
 */
import { manhattanDist, posKey } from './grid_utils';
import type { GridPosition, MetadataEdgeMap, NodeWithGrid } from './types';

/** Generate road tiles between two points using Bresenham line */
const generateDirectPath = (
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
): GridPosition[] => {
  const path: GridPosition[] = [];

  const dc = Math.abs(endCol - startCol);
  const dr = Math.abs(endRow - startRow);
  const sc = startCol < endCol ? 1 : -1;
  const sr = startRow < endRow ? 1 : -1;
  let err = dc - dr;
  let col = startCol;
  let row = startRow;

  while (true) {
    path.push({ col, row });
    if (col === endCol && row === endRow) break;

    const e2 = 2 * err;
    if (e2 > -dr) {
      err -= dr;
      col += sc;
    }
    if (e2 < dc) {
      err += dc;
      row += sr;
    }
  }

  return path;
};

/** Find shortest edge from tree to non-tree node */
const findShortestEdge = (
  points: GridPosition[],
  inTree: Set<number>,
): { from: number; to: number } | null => {
  let bestDist = Infinity;
  let bestFrom = -1;
  let bestTo = -1;

  for (const from of inTree) {
    for (let to = 0; to < points.length; to++) {
      if (inTree.has(to)) continue;
      const dist = manhattanDist(
        points[from].col,
        points[from].row,
        points[to].col,
        points[to].row,
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestFrom = from;
        bestTo = to;
      }
    }
  }

  return bestTo !== -1 ? { from: bestFrom, to: bestTo } : null;
};

/**
 * Build minimum spanning tree connecting all points using Prim's algorithm.
 * Returns edges as pairs of point indices.
 */
const buildMST = (points: GridPosition[]): Array<[number, number]> => {
  if (points.length <= 1) return [];

  const n = points.length;
  const inTree = new Set<number>([0]);
  const edges: Array<[number, number]> = [];

  while (inTree.size < n) {
    const edge = findShortestEdge(points, inTree);
    if (edge) {
      inTree.add(edge.to);
      edges.push([edge.from, edge.to]);
    } else {
      break;
    }
  }

  return edges;
};

/** Collect all points that need to be connected */
const collectPoints = (
  metaNodes: NodeWithGrid[],
  todoPositions: Map<string, GridPosition>,
  metadataTodoMap: MetadataEdgeMap,
): { points: GridPosition[]; pointIndex: Map<string, number> } => {
  const allPoints: GridPosition[] = [];
  const pointIndex = new Map<string, number>();

  // Add agent positions
  for (const metaNode of metaNodes) {
    const id = metaNode.node.id;
    if (!pointIndex.has(id)) {
      pointIndex.set(id, allPoints.length);
      allPoints.push({ col: metaNode.col, row: metaNode.row });
    }
  }

  // Add todo positions that are connected to agents
  for (const metaNode of metaNodes) {
    const connectedTodoIds = metadataTodoMap.get(metaNode.node.id) ?? [];
    for (const todoId of connectedTodoIds) {
      const todoPos = todoPositions.get(todoId);
      if (todoPos && !pointIndex.has(todoId)) {
        pointIndex.set(todoId, allPoints.length);
        allPoints.push({ col: todoPos.col, row: todoPos.row });
      }
    }
  }

  return { points: allPoints, pointIndex };
};

/** Build road network using MST to avoid parallel paths */
export const buildRoadNetwork = (
  metaNodes: NodeWithGrid[],
  todoPositions: Map<string, GridPosition>,
  metadataTodoMap: MetadataEdgeMap,
): Set<string> => {
  const roadTiles = new Set<string>();

  const { points } = collectPoints(metaNodes, todoPositions, metadataTodoMap);

  if (points.length <= 1) return roadTiles;

  // Build MST connecting all points
  const mstEdges = buildMST(points);

  // Draw roads along MST edges only
  for (const [fromIdx, toIdx] of mstEdges) {
    const from = points[fromIdx];
    const to = points[toIdx];
    const path = generateDirectPath(from.col, from.row, to.col, to.row);
    for (const { col, row } of path) {
      roadTiles.add(posKey(col, row));
    }
  }

  return roadTiles;
};
