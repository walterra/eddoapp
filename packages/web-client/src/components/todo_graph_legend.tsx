/**
 * Legend component for the graph view.
 * Shows colored items for each node type with icons.
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
      <span className="text-xs text-neutral-300">{label}</span>
    </div>
  );
};

/** Graph legend showing all node types */
export const GraphLegend: FC = () => (
  <div className="absolute right-4 bottom-4 z-10 rounded-lg border border-neutral-700 bg-neutral-800/90 px-3 py-2 shadow-lg backdrop-blur-sm">
    <div className="mb-1.5 text-[10px] font-medium tracking-wide text-neutral-400 uppercase">
      Legend
    </div>
    <div className="flex flex-col gap-1.5">
      {/* Split todo icon for pending/completed */}
      <div className="flex items-center gap-2">
        <SplitTodoIcon />
        <span className="text-xs text-neutral-300">Todo</span>
      </div>
      {LEGEND_ITEMS.map((item) => (
        <LegendItemRow item={item} key={item.label} />
      ))}
    </div>
  </div>
);
