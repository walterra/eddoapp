/**
 * Dependency canvas theme background component.
 * Uses a light dotted canvas inspired by the reference graph style.
 */
import { type FC } from 'react';

import type { ThemedBackgroundProps } from '../types';

/** Dependency canvas dotted background */
export const DependencyCanvasBackground: FC<ThemedBackgroundProps> = () => (
  <div
    className="react-flow__background pointer-events-none absolute inset-0 bg-[#eef3f7] dark:bg-slate-900"
    style={{
      backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.55) 1.25px, transparent 1.25px)',
      backgroundSize: '16px 16px',
    }}
  />
);
