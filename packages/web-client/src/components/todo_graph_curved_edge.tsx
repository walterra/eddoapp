/**
 * Custom curved edge component inspired by Gephi's edge rendering.
 * Creates smooth curved lines with curvature based on edge position.
 */
import { type EdgeProps } from '@xyflow/react';
import { type FC } from 'react';

/** Calculate curvature offset based on source/target positions */
const calculateCurvature = (
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): number => {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // More curvature for longer edges, slight randomization based on position
  const baseCurvature = Math.min(distance * 0.3, 80);
  const variation = ((sourceX + sourceY + targetX + targetY) % 50) - 25;

  return baseCurvature + variation;
};

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
  const curvature = calculateCurvature(sourceX, sourceY, targetX, targetY);

  // Create a custom curved path
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  // Calculate perpendicular offset for the curve
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  // Perpendicular direction
  const perpX = -dy / len;
  const perpY = dx / len;

  // Control point offset
  const controlX = midX + perpX * curvature * 0.5;
  const controlY = midY + perpY * curvature * 0.5;

  // Quadratic bezier path
  const path = `M ${sourceX} ${sourceY} Q ${controlX} ${controlY} ${targetX} ${targetY}`;

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
