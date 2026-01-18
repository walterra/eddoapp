/**
 * Default theme legend configuration.
 */
import { type FC } from 'react';
import { HiDocumentText, HiUser } from 'react-icons/hi';
import { RiRobot2Fill } from 'react-icons/ri';
import { VscFile } from 'react-icons/vsc';

import type { LegendEdgeItem, LegendNodeItem } from '../types';

/** Legend node items for default theme */
export const defaultLegendNodes: LegendNodeItem[] = [
  {
    label: 'Agent',
    bgColor: 'bg-violet-600',
    borderColor: 'border-violet-500',
    Icon: RiRobot2Fill,
  },
  {
    label: 'File',
    bgColor: 'bg-sky-600/70',
    borderColor: 'border-sky-500/70',
    Icon: VscFile,
  },
  {
    label: 'User',
    bgColor: 'bg-sky-500',
    borderColor: 'border-sky-400',
    Icon: HiUser,
    rounded: true,
  },
];

/** Legend edge items for default theme */
export const defaultLegendEdges: LegendEdgeItem[] = [
  { label: 'Parent → Child', color: '#64748b' },
  { label: 'Blocker', color: '#7f1d3d', dashed: true },
  { label: 'Agent Session', color: '#7c3aed', dashed: true },
];

/** Split icon showing pending (slate) and completed (teal) states */
export const DefaultSplitTodoIcon: FC = () => (
  <div className="relative h-5 w-5 overflow-hidden rounded-sm border border-slate-500">
    <div
      className="absolute inset-0 flex items-center justify-center bg-slate-600"
      style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
    >
      <HiDocumentText className="h-3 w-3 text-white" />
    </div>
    <div
      className="absolute inset-0 flex items-center justify-center bg-teal-700"
      style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
    >
      <HiDocumentText className="h-3 w-3 text-white" />
    </div>
  </div>
);
