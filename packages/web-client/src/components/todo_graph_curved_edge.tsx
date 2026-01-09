/**
 * Custom curved edge component inspired by node-based editors.
 * Creates smooth bezier curves similar to chaiNNer/Blender style.
 */
import { type EdgeProps } from '@xyflow/react';
import { type FC } from 'react';

/** Custom curved edge for graph visualization */
export const CurvedEdge: FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}) => {
  // Calculate distance and direction
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Curvature scales with distance, capped for very long edges
  const curvatureStrength = Math.min(distance * 0.4, 120);

  // Control points for smooth cubic bezier
  // Offset perpendicular to the line for a nice arc
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  // Normalize direction
  const len = distance || 1;
  const perpX = -dy / len;
  const perpY = dx / len;

  // Single control point for quadratic curve (smoother, simpler)
  const ctrlX = midX + perpX * curvatureStrength * 0.3;
  const ctrlY = midY + perpY * curvatureStrength * 0.3;

  // Quadratic bezier for smooth curve
  const path = `M ${sourceX} ${sourceY} Q ${ctrlX} ${ctrlY} ${targetX} ${targetY}`;

  return (
    <path
      className="react-flow__edge-path"
      d={path}
      fill="none"
      id={id}
      markerEnd={markerEnd}
      style={style as React.CSSProperties}
    />
  );
};
