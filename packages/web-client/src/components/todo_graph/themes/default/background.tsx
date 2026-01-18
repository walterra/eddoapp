/**
 * Default theme background component.
 * Uses React Flow's Background with dot pattern.
 */
import { Background } from '@xyflow/react';
import { type FC } from 'react';

import type { ThemedBackgroundProps } from '../types';

/** Default background with dot pattern */
export const DefaultBackground: FC<ThemedBackgroundProps> = () => (
  <Background className="!bg-neutral-100 dark:!bg-neutral-800" color="#94a3b8" gap={16} size={1} />
);
