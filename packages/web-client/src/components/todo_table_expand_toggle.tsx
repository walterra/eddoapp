/**
 * Expand/collapse toggle button for table rows with children
 */
import { type FC } from 'react';
import { BiChevronDown, BiChevronRight } from 'react-icons/bi';

import { ICON_BUTTON } from '../styles/interactive';

/** Pixels per depth level for indentation */
const INDENT_PER_LEVEL = 24;
/** Width of the expand button itself */
const BUTTON_WIDTH = 20;

export interface ExpandToggleProps {
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  depth: number;
}

/** Expand/collapse toggle for rows with subtasks */
export const ExpandToggle: FC<ExpandToggleProps> = ({
  hasChildren,
  isExpanded,
  onToggle,
  depth,
}) => {
  const indentPx = depth * INDENT_PER_LEVEL;

  if (!hasChildren) {
    // Spacer to maintain alignment - indent + button width
    return (
      <span className="inline-block shrink-0" style={{ width: `${indentPx + BUTTON_WIDTH}px` }} />
    );
  }

  return (
    <button
      className={`${ICON_BUTTON} shrink-0`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      style={{ marginLeft: `${indentPx}px`, width: `${BUTTON_WIDTH}px` }}
      title={isExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
      type="button"
    >
      {isExpanded ? <BiChevronDown size="1.1em" /> : <BiChevronRight size="1.1em" />}
    </button>
  );
};
