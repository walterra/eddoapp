/**
 * Legend component for the graph view.
 * Shows colored items for each node type with icons and edge explanations.
 */
import { type FC } from 'react';
import { HiDocumentText, HiUser } from 'react-icons/hi';
import { RiRobot2Fill } from 'react-icons/ri';
import { VscFile } from 'react-icons/vsc';

interface LegendItem {
  label: string;
  bgColor: string;
  borderColor: string;
  Icon: typeof HiDocumentText;
  rounded?: boolean;
}

interface EdgeLegendItem {
  label: string;
  color: string;
  dashed?: boolean;
  animated?: boolean;
}

const LEGEND_ITEMS: LegendItem[] = [
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

const EDGE_LEGEND_ITEMS: EdgeLegendItem[] = [
  {
    label: 'Parent → Child',
    color: '#64748b', // slate-500 (matches pending todo)
  },
  {
    label: 'Blocker',
    color: '#7f1d3d', // desaturated rose
    dashed: true,
  },
  {
    label: 'Agent Session',
    color: '#7c3aed', // violet-600
    dashed: true,
  },
];

/** Split icon showing pending (slate) and completed (teal) states with diagonal cut */
const SplitTodoIcon: FC = () => (
  <div className="relative h-5 w-5 overflow-hidden rounded-sm border border-slate-500">
    {/* Top-left triangle - pending (slate) */}
    <div
      className="absolute inset-0 flex items-center justify-center bg-slate-600"
      style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
    >
      <HiDocumentText className="h-3 w-3 text-white" />
    </div>
    {/* Bottom-right triangle - completed (teal) */}
    <div
      className="absolute inset-0 flex items-center justify-center bg-teal-700"
      style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
    >
      <HiDocumentText className="h-3 w-3 text-white" />
    </div>
  </div>
);

/** Single legend item with icon and label */
const LegendItemRow: FC<{ item: LegendItem }> = ({ item }) => {
  const { label, bgColor, borderColor, Icon, rounded } = item;
  const shapeClass = rounded ? 'rounded-full' : 'rounded-sm';

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-5 w-5 items-center justify-center border ${bgColor} ${borderColor} ${shapeClass}`}
      >
        <Icon className="h-3 w-3 text-white" />
      </div>
      <span className="text-xs text-neutral-700 dark:text-neutral-300">{label}</span>
    </div>
  );
};

/** Single edge legend item with line sample and label */
const EdgeLegendRow: FC<{ item: EdgeLegendItem }> = ({ item }) => {
  const { label, color, dashed, animated } = item;

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-5 w-5 items-center justify-center">
        <svg className="h-4 w-5" viewBox="0 0 20 16">
          <line
            stroke={color}
            strokeDasharray={dashed ? '4,3' : undefined}
            strokeWidth="2"
            x1="0"
            x2="20"
            y1="8"
            y2="8"
          >
            {animated && (
              <animate
                attributeName="stroke-dashoffset"
                dur="0.5s"
                from="0"
                repeatCount="indefinite"
                to="7"
              />
            )}
          </line>
        </svg>
      </div>
      <span className="text-xs text-neutral-700 dark:text-neutral-300">{label}</span>
    </div>
  );
};

/** Graph legend showing all node and edge types */
export const GraphLegend: FC = () => (
  <div className="absolute right-4 bottom-4 z-10 rounded-lg border border-neutral-300 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/90">
    {/* Nodes section */}
    <div className="mb-1.5 text-[10px] font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
      Nodes
    </div>
    <div className="flex flex-col gap-1.5">
      {/* Split todo icon for pending/completed */}
      <div className="flex items-center gap-2">
        <SplitTodoIcon />
        <span className="text-xs text-neutral-700 dark:text-neutral-300">Todo</span>
      </div>
      {LEGEND_ITEMS.map((item) => (
        <LegendItemRow item={item} key={item.label} />
      ))}
    </div>

    {/* Edges section */}
    <div className="mt-2.5 mb-1.5 border-t border-neutral-300 pt-2 text-[10px] font-medium tracking-wide text-neutral-500 uppercase dark:border-neutral-700 dark:text-neutral-400">
      Edges
    </div>
    <div className="flex flex-col gap-1.5">
      {EDGE_LEGEND_ITEMS.map((item) => (
        <EdgeLegendRow item={item} key={item.label} />
      ))}
    </div>
  </div>
);
