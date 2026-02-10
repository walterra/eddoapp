/**
 * Post-layout stagger pass for Graphviz-positioned nodes.
 * Reduces rigid vertical stacking by applying deterministic per-column offsets.
 */
import type { Node } from '@xyflow/react';

import { getNodeDimensions } from './elk_layout_config';

const COLUMN_X_GROUP_TOLERANCE_PX = 52;
const MIN_COLUMN_SIZE_FOR_STAGGER = 4;
const STAGGER_STEP_PX = 8;
const STAGGER_MAX_OFFSET_PX = 24;

interface ColumnNode {
  nodeId: string;
  centerX: number;
  centerY: number;
}

interface ColumnBucket {
  anchorX: number;
  nodes: ColumnNode[];
}

/** Clamp numeric value to a closed interval. */
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

/** Build center coordinates for a node. */
const toColumnNode = (node: Node): ColumnNode => {
  const dimensions = getNodeDimensions(node);

  return {
    nodeId: node.id,
    centerX: node.position.x + dimensions.width / 2,
    centerY: node.position.y + dimensions.height / 2,
  };
};

/** Resolve closest matching column bucket for a node center x-coordinate. */
const findColumnBucketIndex = (buckets: ColumnBucket[], centerX: number): number => {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < buckets.length; index += 1) {
    const distance = Math.abs(centerX - buckets[index].anchorX);
    if (distance > COLUMN_X_GROUP_TOLERANCE_PX || distance >= bestDistance) {
      continue;
    }

    bestIndex = index;
    bestDistance = distance;
  }

  return bestIndex;
};

/** Group nodes into x-columns based on center coordinate proximity. */
const buildColumnBuckets = (nodes: Node[]): ColumnBucket[] => {
  const buckets: ColumnBucket[] = [];
  const sortedNodes = nodes
    .map(toColumnNode)
    .sort(
      (a, b) => a.centerX - b.centerX || a.centerY - b.centerY || a.nodeId.localeCompare(b.nodeId),
    );

  for (const node of sortedNodes) {
    const bucketIndex = findColumnBucketIndex(buckets, node.centerX);

    if (bucketIndex === -1) {
      buckets.push({
        anchorX: node.centerX,
        nodes: [node],
      });
      continue;
    }

    const bucket = buckets[bucketIndex];
    bucket.nodes.push(node);
    bucket.anchorX =
      bucket.nodes.reduce((sum, item) => sum + item.centerX, 0) / bucket.nodes.length;
  }

  return buckets;
};

/** Build deterministic alternating offset pattern around zero. */
const getAlternatingOffset = (index: number): number => {
  if (index === 0) {
    return 0;
  }

  const level = Math.floor((index + 1) / 2);
  const sign = index % 2 === 1 ? 1 : -1;
  const rawOffset = sign * level * STAGGER_STEP_PX;

  return clamp(rawOffset, -STAGGER_MAX_OFFSET_PX, STAGGER_MAX_OFFSET_PX);
};

/** Build x-offset map for all nodes that belong to dense vertical columns. */
const buildOffsetMap = (buckets: ColumnBucket[]): Map<string, number> => {
  const offsets = new Map<string, number>();

  for (const bucket of buckets) {
    if (bucket.nodes.length < MIN_COLUMN_SIZE_FOR_STAGGER) {
      continue;
    }

    const sortedNodes = [...bucket.nodes].sort(
      (a, b) => a.centerY - b.centerY || a.nodeId.localeCompare(b.nodeId),
    );

    for (let index = 0; index < sortedNodes.length; index += 1) {
      const offset = getAlternatingOffset(index);
      if (offset === 0) {
        continue;
      }

      offsets.set(sortedNodes[index].nodeId, offset);
    }
  }

  return offsets;
};

/**
 * Apply deterministic column staggering to Graphviz positioned nodes.
 * Offsets x-coordinates slightly for dense vertical columns.
 */
export const applyGraphvizColumnStaggering = (nodes: Node[]): Node[] => {
  const buckets = buildColumnBuckets(nodes);
  const offsets = buildOffsetMap(buckets);

  if (offsets.size === 0) {
    return nodes;
  }

  return nodes.map((node) => {
    const offset = offsets.get(node.id);
    if (!offset) {
      return node;
    }

    return {
      ...node,
      position: {
        x: node.position.x + offset,
        y: node.position.y,
      },
    };
  });
};
