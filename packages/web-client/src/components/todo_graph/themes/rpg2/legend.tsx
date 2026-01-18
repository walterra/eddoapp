/**
 * RPG2 theme legend configuration.
 */
import { type FC } from 'react';

import type { LegendEdgeItem, LegendNodeItem } from '../types';

/** Base path for RPG2 theme assets */
const ASSET_PATH = '/theme-assets/rpg2';

/** Icon component using image source */
const ImageIcon: FC<{ src: string; alt: string; className?: string }> = ({
  src,
  alt,
  className = 'h-4 w-4',
}) => <img alt={alt} className={`${className} object-contain`} src={src} />;

/** Legend node items for RPG2 theme */
export const rpg2LegendNodes: LegendNodeItem[] = [
  {
    label: 'Worker',
    bgColor: 'bg-transparent',
    borderColor: 'border-transparent',
    Icon: () => <ImageIcon alt="Signpost" src={`${ASSET_PATH}/signpost.png`} />,
  },
  {
    label: 'Resource',
    bgColor: 'bg-transparent',
    borderColor: 'border-transparent',
    Icon: () => <ImageIcon alt="Tree" src={`${ASSET_PATH}/tree.png`} />,
  },
  {
    label: 'Villager',
    bgColor: 'bg-transparent',
    borderColor: 'border-transparent',
    Icon: () => <ImageIcon alt="Cart" className="h-4 w-6" src={`${ASSET_PATH}/cart.png`} />,
  },
];

/** Legend edge items for RPG2 theme */
export const rpg2LegendEdges: LegendEdgeItem[] = [
  { label: 'Path (Parent → Child)', color: '#a3a095' },
  { label: 'Blocked', color: '#b91c1c', dashed: true },
];

/** Split icon showing pending and completed tasks */
export const Rpg2SplitTodoIcon: FC = () => (
  <div className="flex h-5 w-5 items-center justify-center">
    <img alt="Task" className="h-5 w-5 object-contain" src={`${ASSET_PATH}/todo-pending.png`} />
  </div>
);
