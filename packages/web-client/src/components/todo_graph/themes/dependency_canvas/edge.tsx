/**
 * Dependency canvas theme edge component.
 * Uses floating-edge intersection points for cleaner start/end anchors.
 */
import { getBezierPath, Position, useInternalNode } from '@xyflow/react';
import { type CSSProperties, type FC } from 'react';

import type { ThemedEdgeProps } from '../types';

type DependencyEdgeKind = 'parent' | 'blocked' | 'unblocked' | 'other';

interface EdgeStyleConfig {
  stroke: string;
  strokeWidth: number;
  strokeDasharray: string;
  opacity: number;
  label?: string;
  labelBackground?: string;
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
  labelX: number;
  labelY: number;
}

const DASH_PARENT = '1 7';
const DASH_SIGNAL = '1 6';

/** Get measured node width with fallback */
const getNodeWidth = (node: InternalNodeWithBounds): number => node.measured?.width ?? 248;

/** Get measured node height with fallback */
const getNodeHeight = (node: InternalNodeWithBounds): number => node.measured?.height ?? 124;

/** Get absolute node position with fallback */
const getNodePosition = (node: InternalNodeWithBounds): Point =>
  node.internals?.positionAbsolute ?? { x: 0, y: 0 };

/** Find intersection point between source-target center line and source node bounds */
const getNodeIntersection = (
  intersectionNode: InternalNodeWithBounds,
  targetNode: InternalNodeWithBounds,
): Point => {
  const width = getNodeWidth(intersectionNode);
  const height = getNodeHeight(intersectionNode);
  const sourcePosition = getNodePosition(intersectionNode);
  const targetPosition = getNodePosition(targetNode);

  const w = width / 2;
  const h = height / 2;
  const x2 = sourcePosition.x + w;
  const y2 = sourcePosition.y + h;
  const x1 = targetPosition.x + getNodeWidth(targetNode) / 2;
  const y1 = targetPosition.y + getNodeHeight(targetNode) / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1));
  const xx3 = a * xx1;
  const yy3 = a * yy1;

  return {
    x: w * (xx3 + yy3) + x2,
    y: h * (-xx3 + yy3) + y2,
  };
};

/** Resolve edge side from node bounds and intersection point */
const getEdgePosition = (node: InternalNodeWithBounds, point: Point): Position => {
  const position = getNodePosition(node);
  const width = getNodeWidth(node);
  const height = getNodeHeight(node);

  const nx = Math.round(position.x);
  const ny = Math.round(position.y);
  const px = Math.round(point.x);
  const py = Math.round(point.y);

  if (px <= nx + 1) {
    return Position.Left;
  }

  if (px >= nx + width - 1) {
    return Position.Right;
  }

  if (py <= ny + 1) {
    return Position.Top;
  }

  if (py >= ny + height - 1) {
    return Position.Bottom;
  }

  return Position.Right;
};

/** Build floating-edge coordinates and side positions for a source-target pair */
const getEdgeParams = (
  sourceNode: InternalNodeWithBounds,
  targetNode: InternalNodeWithBounds,
): EdgeParams => {
  const sourcePoint = getNodeIntersection(sourceNode, targetNode);
  const targetPoint = getNodeIntersection(targetNode, sourceNode);

  return {
    sx: sourcePoint.x,
    sy: sourcePoint.y,
    tx: targetPoint.x,
    ty: targetPoint.y,
    sourcePos: getEdgePosition(sourceNode, sourcePoint),
    targetPos: getEdgePosition(targetNode, targetPoint),
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

/** Resolve visual style from semantic edge kind */
const getEdgeStyle = (kind: DependencyEdgeKind): EdgeStyleConfig => {
  if (kind === 'parent') {
    return {
      stroke: '#9ca3af',
      strokeWidth: 2.1,
      strokeDasharray: DASH_PARENT,
      opacity: 0.9,
    };
  }

  if (kind === 'blocked') {
    return {
      stroke: '#ef4444',
      strokeWidth: 2.4,
      strokeDasharray: DASH_SIGNAL,
      opacity: 0.95,
      label: '- block',
      labelBackground: '#dc2626',
    };
  }

  if (kind === 'unblocked') {
    return {
      stroke: '#22c55e',
      strokeWidth: 2.4,
      strokeDasharray: DASH_SIGNAL,
      opacity: 0.95,
      label: '+ ready',
      labelBackground: '#16a34a',
    };
  }

  return {
    stroke: '#9ca3af',
    strokeWidth: 2,
    strokeDasharray: DASH_PARENT,
    opacity: 0.85,
  };
};

/** Build stable svg marker id for a per-edge arrowhead */
const buildMarkerId = (id: string, kind: DependencyEdgeKind): string =>
  `dep-arrow-${kind}-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

/** Build fallback edge params when node internals are unavailable */
const getFallbackEdgeParams = (props: ThemedEdgeProps): EdgeParams => ({
  sx: props.sourceX,
  sy: props.sourceY,
  tx: props.targetX,
  ty: props.targetY,
  sourcePos: props.sourcePosition ?? Position.Right,
  targetPos: props.targetPosition ?? Position.Left,
});

/** Resolve edge params from internal nodes or fallback geometry */
const resolveEdgeParams = (
  props: ThemedEdgeProps,
  sourceNode: InternalNodeWithBounds | null,
  targetNode: InternalNodeWithBounds | null,
): EdgeParams => {
  if (sourceNode && targetNode) {
    return getEdgeParams(sourceNode, targetNode);
  }

  return getFallbackEdgeParams(props);
};

/** Build bezier path and label anchor from edge params */
const getEdgePathData = (params: EdgeParams): EdgePathData => {
  const [path, labelX, labelY] = getBezierPath({
    sourceX: params.sx,
    sourceY: params.sy,
    targetX: params.tx,
    targetY: params.ty,
    sourcePosition: params.sourcePos,
    targetPosition: params.targetPos,
    curvature: 0.32,
  });

  return { path, labelX, labelY };
};

/** Render semantic edge badge near path midpoint */
const EdgeBadge: FC<{ x: number; y: number; label: string; background: string }> = ({
  x,
  y,
  label,
  background,
}) => {
  const width = Math.max(56, label.length * 7 + 10);
  const height = 20;

  return (
    <g transform={`translate(${x - width / 2}, ${y - height / 2})`}>
      <rect fill={background} height={height} opacity={0.96} rx={10} width={width} x={0} y={0} />
      <text
        dominantBaseline="middle"
        fill="#ffffff"
        fontSize="10"
        fontWeight="700"
        textAnchor="middle"
        x={width / 2}
        y={height / 2 + 0.5}
      >
        {label}
      </text>
    </g>
  );
};

/** Arrow marker definition for dependency edges */
const ArrowMarker: FC<{ markerId: string; color: string; opacity: number }> = ({
  markerId,
  color,
  opacity,
}) => (
  <defs>
    <marker
      id={markerId}
      markerHeight="8"
      markerUnits="strokeWidth"
      markerWidth="8"
      orient="auto-start-reverse"
      refX="7"
      refY="4"
      viewBox="0 0 8 8"
    >
      <path d="M 0 0 L 8 4 L 0 8 z" fill={color} opacity={opacity} />
    </marker>
  </defs>
);

/** Path renderer for dependency edges */
const DependencyEdgePath: FC<{
  edgeId: string;
  path: string;
  markerId: string;
  edgeStyle: EdgeStyleConfig;
}> = ({ edgeId, path, markerId, edgeStyle }) => (
  <path
    className="react-flow__edge-path"
    d={path}
    fill="none"
    id={edgeId}
    markerEnd={`url(#${markerId})`}
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

/** Dependency canvas edge with floating anchors and reference-style curves */
export const DependencyCanvasEdge: FC<ThemedEdgeProps> = (props) => {
  const sourceNode = useInternalNode(props.source ?? '');
  const targetNode = useInternalNode(props.target ?? '');
  const kind = getEdgeKind(props.id, props.style);
  const edgeStyle = getEdgeStyle(kind);
  const markerId = buildMarkerId(props.id, kind);
  const params = resolveEdgeParams(
    props,
    sourceNode as InternalNodeWithBounds | null,
    targetNode as InternalNodeWithBounds | null,
  );
  const edgePath = getEdgePathData(params);

  return (
    <g>
      <ArrowMarker color={edgeStyle.stroke} markerId={markerId} opacity={edgeStyle.opacity} />
      <DependencyEdgePath
        edgeId={props.id}
        edgeStyle={edgeStyle}
        markerId={markerId}
        path={edgePath.path}
      />
      {edgeStyle.label && edgeStyle.labelBackground ? (
        <EdgeBadge
          background={edgeStyle.labelBackground}
          label={edgeStyle.label}
          x={edgePath.labelX}
          y={edgePath.labelY}
        />
      ) : null}
    </g>
  );
};
