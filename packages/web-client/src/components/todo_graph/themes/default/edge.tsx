/**
 * Default theme edge component.
 * Creates smooth bezier curves similar to chaiNNer/Blender style.
 */
import { type FC } from 'react';

import type { ThemedEdgeProps } from '../types';

/** Default curved edge component */
export const DefaultEdge: FC<ThemedEdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}) => {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const curvatureStrength = Math.min(distance * 0.4, 120);
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const len = distance || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const ctrlX = midX + perpX * curvatureStrength * 0.3;
  const ctrlY = midY + perpY * curvatureStrength * 0.3;
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
