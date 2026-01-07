/**
 * Subtask count indicator for todo list items
 * Wraps SubtasksPopover to show children on click
 */
import { type FC } from 'react';

import { SubtasksPopover } from './subtasks_popover';

interface SubtaskIndicatorProps {
  todoId: string;
}

/**
 * Displays a compact indicator showing subtask count and completion status
 * Only renders if the todo has children. Clicking opens a popover with subtask list.
 */
export const SubtaskIndicator: FC<SubtaskIndicatorProps> = ({ todoId }) => {
  return <SubtasksPopover todoId={todoId} />;
};
