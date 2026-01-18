/**
 * RPG2 theme background component.
 * Teal/indigo water color - ground tiles are rendered as nodes by the layout.
 */
import { type FC } from 'react';

import type { ThemedBackgroundProps } from '../types';

/** RPG2 water background - matches reference image */
export const Rpg2Background: FC<ThemedBackgroundProps> = () => (
  <div className="react-flow__background absolute inset-0" style={{ backgroundColor: '#4a9b9b' }} />
);
