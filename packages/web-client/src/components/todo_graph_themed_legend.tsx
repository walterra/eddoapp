/**
 * Themed legend component for the graph view.
 */
import { type FC } from 'react';

import { useCurrentTheme } from './todo_graph/themes/context';
import type { LegendEdgeItem, LegendNodeItem } from './todo_graph/themes/types';

/** Single legend item with icon and label */
const LegendItemRow: FC<{ item: LegendNodeItem }> = ({ item }) => {
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
const EdgeLegendRow: FC<{ item: LegendEdgeItem }> = ({ item }) => {
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

/** Themed graph legend */
export const ThemedGraphLegend: FC = () => {
  const theme = useCurrentTheme();
  const { nodes, edges, SplitTodoIcon } = theme.legend;

  return (
    <div className="absolute right-4 bottom-4 z-10 rounded-lg border border-neutral-300 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/90">
      {/* Nodes section */}
      <div className="mb-1.5 text-[10px] font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
        Nodes
      </div>
      <div className="flex flex-col gap-1.5">
        {SplitTodoIcon && (
          <div className="flex items-center gap-2">
            <SplitTodoIcon />
            <span className="text-xs text-neutral-700 dark:text-neutral-300">Todo</span>
          </div>
        )}
        {nodes.map((item) => (
          <LegendItemRow item={item} key={item.label} />
        ))}
      </div>

      {/* Edges section */}
      <div className="mt-2.5 mb-1.5 border-t border-neutral-300 pt-2 text-[10px] font-medium tracking-wide text-neutral-500 uppercase dark:border-neutral-700 dark:text-neutral-400">
        Edges
      </div>
      <div className="flex flex-col gap-1.5">
        {edges.map((item) => (
          <EdgeLegendRow item={item} key={item.label} />
        ))}
      </div>
    </div>
  );
};
