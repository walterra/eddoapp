/**
 * Graphviz DOT generation and position mapping helpers.
 */
import type { Edge, Node } from '@xyflow/react';

import { getNodeDimensions } from './elk_layout_config';

const POINTS_PER_INCH = 72;
const PARENT_EDGE_ID_PREFIX = 'parent:';
const BLOCKED_EDGE_ID_PREFIX = 'blocked:';
const HORIZONTAL_LAYOUT_ASPECT_RATIO_THRESHOLD = 1.45;
const BLOCKED_EDGE_LAYOUT_WEIGHT = 3;
const BLOCKED_EDGE_LAYOUT_MINLEN = 3;
const SIBLING_FANOUT_COLUMN_SIZE = 6;
const SIBLING_FANOUT_MIN_CHILDREN = 10;

interface BuildDotParams {
  nodes: Node[];
  edges: Edge[];
  rootNodeId: string | null;
  width: number;
  height: number;
}

interface GraphvizObject {
  name?: string;
  pos?: string;
  width?: string | number;
  height?: string | number;
}

export interface GraphvizLayoutResult {
  objects?: GraphvizObject[];
}

interface NodeCenter {
  x: number;
  y: number;
}

interface NodeSize {
  width: number;
  height: number;
}

interface PositionedNode {
  center: NodeCenter;
  size: NodeSize;
}

/** Convert pixel size to inches for DOT node dimensions. */
const toInches = (pixels: number): number => pixels / POINTS_PER_INCH;

/** Escape DOT node IDs for quoted usage. */
const quoteId = (value: string): string => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Resolve default root node ID when dependency root is unavailable. */
const resolveRootNodeId = (nodes: Node[], rootNodeId: string | null): string | null => {
  if (!rootNodeId) {
    return nodes[0]?.id ?? null;
  }

  return nodes.some((node) => node.id === rootNodeId) ? rootNodeId : (nodes[0]?.id ?? null);
};

/** Resolve Graphviz rank direction from viewport dimensions. */
const getRankDirection = (width: number, height: number): 'LR' | 'TB' =>
  width / Math.max(height, 1) >= HORIZONTAL_LAYOUT_ASPECT_RATIO_THRESHOLD ? 'LR' : 'TB';

/** Build Graphviz edge layout attributes for relationship type. */
const getEdgeLayoutAttributes = (edge: Edge): string => {
  if (edge.id.startsWith(PARENT_EDGE_ID_PREFIX)) {
    return 'weight=8 minlen=1 constraint=true';
  }

  if (edge.id.startsWith(BLOCKED_EDGE_ID_PREFIX)) {
    return `weight=${BLOCKED_EDGE_LAYOUT_WEIGHT} minlen=${BLOCKED_EDGE_LAYOUT_MINLEN} constraint=true style=dashed`;
  }

  return 'weight=1 minlen=1 constraint=false';
};

/** Collect first-level children of the root from parent edges. */
const collectTopLevelIds = (edges: Edge[], rootNodeId: string | null): string[] => {
  if (!rootNodeId) {
    return [];
  }

  const ids = new Set<string>();
  for (const edge of edges) {
    if (!edge.id.startsWith(PARENT_EDGE_ID_PREFIX)) {
      continue;
    }

    if (edge.source === rootNodeId) {
      ids.add(edge.target);
    }
  }

  return [...ids];
};

/** Collect parent-child mapping from parent edges. */
const collectChildrenByParent = (edges: Edge[]): Map<string, string[]> => {
  const map = new Map<string, string[]>();

  for (const edge of edges) {
    if (!edge.id.startsWith(PARENT_EDGE_ID_PREFIX)) {
      continue;
    }

    const children = map.get(edge.source) ?? [];
    children.push(edge.target);
    map.set(edge.source, children);
  }

  for (const [parentId, children] of map) {
    map.set(
      parentId,
      [...new Set(children)].sort((a, b) => a.localeCompare(b)),
    );
  }

  return map;
};

/** Add invisible sibling fanout edges to spread dense child columns. */
const appendSiblingFanoutEdges = (
  lines: string[],
  childrenByParent: Map<string, string[]>,
  direction: 'LR' | 'TB',
): void => {
  if (direction !== 'LR') {
    return;
  }

  for (const children of childrenByParent.values()) {
    if (children.length < SIBLING_FANOUT_MIN_CHILDREN) {
      continue;
    }

    for (let start = 0; start < SIBLING_FANOUT_COLUMN_SIZE; start += 1) {
      for (
        let index = start;
        index + SIBLING_FANOUT_COLUMN_SIZE < children.length;
        index += SIBLING_FANOUT_COLUMN_SIZE
      ) {
        const source = children[index];
        const target = children[index + SIBLING_FANOUT_COLUMN_SIZE];
        lines.push(
          `  ${quoteId(source)} -> ${quoteId(target)} [style=invis constraint=true weight=1 minlen=1];`,
        );
      }
    }
  }
};

/** Build DOT graph used only for Graphviz layout position calculation. */
export const buildGraphvizDotLayoutGraph = (params: BuildDotParams): string => {
  const direction = getRankDirection(params.width, params.height);
  const resolvedRootNodeId = resolveRootNodeId(params.nodes, params.rootNodeId);
  const topLevelIds = collectTopLevelIds(params.edges, resolvedRootNodeId);
  const childrenByParent = collectChildrenByParent(params.edges);
  const lines: string[] = [];

  lines.push('digraph G {');
  lines.push(`  rankdir=${direction};`);
  lines.push('  splines=true;');
  lines.push('  overlap=false;');
  lines.push('  newrank=true;');
  lines.push('  nodesep=0.1;');
  lines.push('  ranksep=0.95;');
  lines.push(
    '  node [shape=box label="" fixedsize=true margin=0 style="rounded,filled" penwidth=0 color="#00000000" fillcolor="#00000000"];',
  );

  for (const node of params.nodes) {
    const dimensions = getNodeDimensions(node);
    lines.push(
      `  ${quoteId(node.id)} [width=${toInches(dimensions.width).toFixed(4)} height=${toInches(dimensions.height).toFixed(4)}];`,
    );
  }

  if (resolvedRootNodeId) {
    lines.push(`  { rank=same; ${quoteId(resolvedRootNodeId)}; }`);
  }

  if (topLevelIds.length > 0) {
    lines.push(`  { rank=same; ${topLevelIds.map(quoteId).join('; ')}; }`);
  }

  appendSiblingFanoutEdges(lines, childrenByParent, direction);

  for (const edge of params.edges) {
    lines.push(
      `  ${quoteId(edge.source)} -> ${quoteId(edge.target)} [${getEdgeLayoutAttributes(edge)}];`,
    );
  }

  lines.push('}');
  return lines.join('\n');
};

/** Parse Graphviz node center position from "x,y" string. */
const parseNodeCenter = (position: string | undefined): NodeCenter | null => {
  if (!position) {
    return null;
  }

  const parts = position.split(',');
  if (parts.length !== 2) {
    return null;
  }

  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
};

/** Parse node size in pixels from Graphviz inches output. */
const parseNodeSize = (object: GraphvizObject, fallback: NodeSize): NodeSize => {
  const widthInches = Number(object.width);
  const heightInches = Number(object.height);

  if (!Number.isFinite(widthInches) || !Number.isFinite(heightInches)) {
    return fallback;
  }

  return {
    width: widthInches * POINTS_PER_INCH,
    height: heightInches * POINTS_PER_INCH,
  };
};

/** Build positioned node map from Graphviz JSON output. */
const buildPositionMap = (layout: GraphvizLayoutResult): Map<string, PositionedNode> => {
  const map = new Map<string, PositionedNode>();

  for (const object of layout.objects ?? []) {
    if (!object.name) {
      continue;
    }

    const center = parseNodeCenter(object.pos);
    if (!center) {
      continue;
    }

    const fallback = { width: 80, height: 80 };
    map.set(object.name, {
      center,
      size: parseNodeSize(object, fallback),
    });
  }

  return map;
};

/** Map Graphviz center positions back to React Flow top-left node positions. */
export const mapGraphvizPositionsToNodes = (
  nodes: Node[],
  layout: GraphvizLayoutResult,
): Node[] => {
  const positionedNodes = buildPositionMap(layout);

  return nodes.map((node) => {
    const positionedNode = positionedNodes.get(node.id);
    if (!positionedNode) {
      return node;
    }

    const fallbackSize = getNodeDimensions(node);
    const size =
      positionedNode.size.width <= 0 || positionedNode.size.height <= 0
        ? fallbackSize
        : positionedNode.size;

    return {
      ...node,
      position: {
        x: positionedNode.center.x - size.width / 2,
        y: positionedNode.center.y - size.height / 2,
      },
    };
  });
};
