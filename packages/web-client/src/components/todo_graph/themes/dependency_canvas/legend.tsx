/**
 * Dependency canvas legend configuration.
 */
import { HiCheckCircle, HiDocumentText, HiExclamationCircle } from 'react-icons/hi';

import type { LegendEdgeItem, LegendNodeItem } from '../types';

/** Legend node items for dependency canvas theme */
export const dependencyCanvasLegendNodes: LegendNodeItem[] = [
  {
    label: 'Active Todo',
    bgColor: 'bg-sky-500',
    borderColor: 'border-sky-400',
    Icon: HiDocumentText,
  },
  {
    label: 'Blocked Todo',
    bgColor: 'bg-rose-500',
    borderColor: 'border-rose-400',
    Icon: HiExclamationCircle,
  },
  {
    label: 'Completed Todo',
    bgColor: 'bg-emerald-600',
    borderColor: 'border-emerald-500',
    Icon: HiCheckCircle,
  },
];

/** Legend edge items for dependency canvas theme */
export const dependencyCanvasLegendEdges: LegendEdgeItem[] = [
  { label: 'Parent', color: '#9ca3af', dashed: true },
  { label: 'Blocks', color: '#ef4444', dashed: true },
  { label: 'Ready', color: '#22c55e', dashed: true },
];
