/**
 * Themed edge wrapper for React Flow.
 */
import { type EdgeProps } from '@xyflow/react';
import { type CSSProperties, type FC } from 'react';

import { useCurrentTheme } from './todo_graph/themes/context';

/** Themed edge - wraps theme's Edge component */
export const ThemedEdge: FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}) => {
  const theme = useCurrentTheme();

  return (
    <theme.Edge
      id={id}
      markerEnd={markerEnd}
      sourceX={sourceX}
      sourceY={sourceY}
      style={style as CSSProperties}
      targetX={targetX}
      targetY={targetY}
    />
  );
};
