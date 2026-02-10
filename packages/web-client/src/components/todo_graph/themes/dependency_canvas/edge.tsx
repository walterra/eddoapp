/**
 * Dependency canvas theme edge component.
 * Uses side-aware border anchors to avoid underflow in dense vertical stacks.
 */
import { getSmoothStepPath, Position, useInternalNode } from '@xyflow/react';
import { type CSSProperties, type FC } from 'react';

import type { ThemedEdgeProps } from '../types';

type DependencyEdgeKind = 'parent' | 'blocked' | 'unblocked' | 'other';

interface EdgeStyleConfig {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity: number;
}

interface Point {
  x: number;
  y: number;
}

interface InternalNodeWithBounds {
  measured?: {
    width?: number;
    height?: number;
  };
  internals?: {
    positionAbsolute?: {
      x: number;
      y: number;
    };
  };
}

interface EdgeParams {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourcePos: Position;
  targetPos: Position;
}

interface EdgePathData {
  path: string;
}

type DominantAxis = 'horizontal' | 'vertical';

const DASH_BLOCKED = '4 6';
const HORIZONTAL_BIAS_DEFAULT = 0.55;
const HORIZONTAL_BIAS_BLOCKED = 0.35;
const EDGE_STEP_BORDER_RADIUS = 14;
const EDGE_STEP_OFFSET = 18;

/** Get measured node width with fallback */
const getNodeWidth = (node: InternalNodeWithBounds): number => node.measured?.width ?? 248;

/** Get measured node height with fallback */
const getNodeHeight = (node: InternalNodeWithBounds): number => node.measured?.height ?? 124;

/** Get absolute node position with fallback */
const getNodePosition = (node: InternalNodeWithBounds): Point =>
  node.internals?.positionAbsolute ?? { x: 0, y: 0 };

/** Get center point for a node from measured bounds. */
const getNodeCenter = (node: InternalNodeWithBounds): Point => {
  const position = getNodePosition(node);

  return {
    x: position.x + getNodeWidth(node) / 2,
    y: position.y + getNodeHeight(node) / 2,
  };
};

/** Resolve whether the edge should anchor primarily horizontally or vertically. */
const getDominantAxis = (
  sourceCenter: Point,
  targetCenter: Point,
  kind: DependencyEdgeKind,
): DominantAxis => {
  const horizontalDistance = Math.abs(targetCenter.x - sourceCenter.x);
  const verticalDistance = Math.abs(targetCenter.y - sourceCenter.y);
  const horizontalBias =
    kind === 'blocked' || kind === 'unblocked' ? HORIZONTAL_BIAS_BLOCKED : HORIZONTAL_BIAS_DEFAULT;

  return horizontalDistance >= verticalDistance * horizontalBias ? 'horizontal' : 'vertical';
};

/** Resolve source and target edge sides from dominant axis. */
const getPreferredEdgeSides = (
  sourceCenter: Point,
  targetCenter: Point,
  axis: DominantAxis,
): { sourcePos: Position; targetPos: Position } => {
  if (axis === 'horizontal') {
    return sourceCenter.x <= targetCenter.x
      ? { sourcePos: Position.Right, targetPos: Position.Left }
      : { sourcePos: Position.Left, targetPos: Position.Right };
  }

  return sourceCenter.y <= targetCenter.y
    ? { sourcePos: Position.Bottom, targetPos: Position.Top }
    : { sourcePos: Position.Top, targetPos: Position.Bottom };
};

/** Resolve edge anchor point at the center of a specific node side. */
const getNodeSideAnchor = (node: InternalNodeWithBounds, side: Position): Point => {
  const center = getNodeCenter(node);
  const position = getNodePosition(node);
  const width = getNodeWidth(node);
  const height = getNodeHeight(node);

  if (side === Position.Left) {
    return { x: position.x, y: center.y };
  }

  if (side === Position.Right) {
    return { x: position.x + width, y: center.y };
  }

  if (side === Position.Top) {
    return { x: center.x, y: position.y };
  }

  return { x: center.x, y: position.y + height };
};

/** Build side-aware edge coordinates and side positions for a source-target pair. */
const getEdgeParams = (
  sourceNode: InternalNodeWithBounds,
  targetNode: InternalNodeWithBounds,
  kind: DependencyEdgeKind,
): EdgeParams => {
  const sourceCenter = getNodeCenter(sourceNode);
  const targetCenter = getNodeCenter(targetNode);
  const axis = getDominantAxis(sourceCenter, targetCenter, kind);
  const edgeSides = getPreferredEdgeSides(sourceCenter, targetCenter, axis);
  const sourcePoint = getNodeSideAnchor(sourceNode, edgeSides.sourcePos);
  const targetPoint = getNodeSideAnchor(targetNode, edgeSides.targetPos);

  return {
    sx: sourcePoint.x,
    sy: sourcePoint.y,
    tx: targetPoint.x,
    ty: targetPoint.y,
    sourcePos: edgeSides.sourcePos,
    targetPos: edgeSides.targetPos,
  };
};

/** Determine semantic edge kind from edge id and incoming style */
const getEdgeKind = (id: string, style?: CSSProperties): DependencyEdgeKind => {
  if (id.startsWith('parent:')) {
    return 'parent';
  }

  if (!id.startsWith('blocked:')) {
    return 'other';
  }

  if (style?.strokeDasharray) {
    return 'blocked';
  }

  return 'unblocked';
};

/** Resolve visual style from semantic edge kind. */
const getEdgeStyle = (kind: DependencyEdgeKind): EdgeStyleConfig => {
  if (kind === 'parent') {
    return {
      stroke: '#9ca3af',
      strokeWidth: 1.8,
      opacity: 0.9,
    };
  }

  if (kind === 'blocked') {
    return {
      stroke: '#ef4444',
      strokeWidth: 2,
      strokeDasharray: DASH_BLOCKED,
      opacity: 0.95,
    };
  }

  if (kind === 'unblocked') {
    return {
      stroke: '#22c55e',
      strokeWidth: 2,
      strokeDasharray: DASH_BLOCKED,
      opacity: 0.95,
    };
  }

  return {
    stroke: '#9ca3af',
    strokeWidth: 1.6,
    opacity: 0.82,
  };
};

/** Build fallback edge params when node internals are unavailable. */
const getFallbackEdgeParams = (props: ThemedEdgeProps, kind: DependencyEdgeKind): EdgeParams => {
  const sourceCenter = { x: props.sourceX, y: props.sourceY };
  const targetCenter = { x: props.targetX, y: props.targetY };
  const axis = getDominantAxis(sourceCenter, targetCenter, kind);
  const edgeSides = getPreferredEdgeSides(sourceCenter, targetCenter, axis);

  return {
    sx: props.sourceX,
    sy: props.sourceY,
    tx: props.targetX,
    ty: props.targetY,
    sourcePos: edgeSides.sourcePos,
    targetPos: edgeSides.targetPos,
  };
};

/** Resolve edge params from internal nodes or fallback geometry. */
const resolveEdgeParams = (
  props: ThemedEdgeProps,
  sourceNode: InternalNodeWithBounds | null,
  targetNode: InternalNodeWithBounds | null,
  kind: DependencyEdgeKind,
): EdgeParams => {
  if (sourceNode && targetNode) {
    return getEdgeParams(sourceNode, targetNode, kind);
  }

  return getFallbackEdgeParams(props, kind);
};

/** Build smooth-step path from side-aware edge params. */
const getEdgePathData = (params: EdgeParams): EdgePathData => {
  const [path] = getSmoothStepPath({
    sourceX: params.sx,
    sourceY: params.sy,
    targetX: params.tx,
    targetY: params.ty,
    sourcePosition: params.sourcePos,
    targetPosition: params.targetPos,
    borderRadius: EDGE_STEP_BORDER_RADIUS,
    offset: EDGE_STEP_OFFSET,
  });

  return { path };
};

/** Path renderer for dependency edges. */
const DependencyEdgePath: FC<{
  edgeId: string;
  path: string;
  edgeStyle: EdgeStyleConfig;
}> = ({ edgeId, path, edgeStyle }) => (
  <path
    className="react-flow__edge-path"
    d={path}
    fill="none"
    id={edgeId}
    style={{
      stroke: edgeStyle.stroke,
      strokeWidth: edgeStyle.strokeWidth,
      strokeDasharray: edgeStyle.strokeDasharray,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      opacity: edgeStyle.opacity,
    }}
  />
);

/** Render endpoint cap to mimic socket-style side attachment. */
const EdgeEndpointCap: FC<{ x: number; y: number }> = ({ x, y }) => (
  <circle cx={x} cy={y} fill="#f8fafc" r={4.5} stroke="#a3a3a3" strokeWidth={1.4} />
);

/** Dependency canvas edge with center-side attachment and orthogonal routing. */
export const DependencyCanvasEdge: FC<ThemedEdgeProps> = (props) => {
  const sourceNode = useInternalNode(props.source ?? '');
  const targetNode = useInternalNode(props.target ?? '');
  const kind = getEdgeKind(props.id, props.style);
  const edgeStyle = getEdgeStyle(kind);
  const params = resolveEdgeParams(
    props,
    sourceNode as InternalNodeWithBounds | null,
    targetNode as InternalNodeWithBounds | null,
    kind,
  );
  const edgePath = getEdgePathData(params);

  return (
    <g>
      <DependencyEdgePath edgeId={props.id} edgeStyle={edgeStyle} path={edgePath.path} />
      <EdgeEndpointCap x={params.sx} y={params.sy} />
      <EdgeEndpointCap x={params.tx} y={params.ty} />
    </g>
  );
};
