/**
 * RPG2 theme edge component.
 * Subtle dirt path style for parent-child relationships.
 */
import { type FC } from 'react';

import type { ThemedEdgeProps } from '../types';

/** Edge types based on ID prefix */
type EdgeType = 'parent' | 'blocked' | 'hidden';

/** Determine edge type from ID */
const getEdgeType = (id: string): EdgeType => {
  if (id.startsWith('parent:')) return 'parent';
  if (id.startsWith('blocked:')) return 'blocked';
  return 'hidden';
};

/** RPG2 path edge - subtle dirt roads */
export const Rpg2Edge: FC<ThemedEdgeProps> = ({ id, sourceX, sourceY, targetX, targetY }) => {
  const edgeType = getEdgeType(id);
  if (edgeType === 'hidden') return null;

  const isBlocker = edgeType === 'blocked';

  // Gentle curve for natural path feel
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  const len = distance || 1;
  const perpX = -dy / len;
  const perpY = dx / len;
  const curveAmount = Math.min(distance * 0.05, 10);
  const ctrlX = midX + perpX * curveAmount;
  const ctrlY = midY + perpY * curveAmount;

  const path = `M ${sourceX} ${sourceY} Q ${ctrlX} ${ctrlY} ${targetX} ${targetY}`;

  return (
    <path
      className="react-flow__edge-path"
      d={path}
      fill="none"
      id={id}
      style={{
        stroke: isBlocker ? '#b91c1c' : '#a3a095',
        strokeWidth: isBlocker ? 6 : 14,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeDasharray: isBlocker ? '6 10' : undefined,
        opacity: isBlocker ? 0.5 : 0.35,
      }}
    />
  );
};
