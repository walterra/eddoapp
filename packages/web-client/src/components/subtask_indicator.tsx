/**
 * Subtask count indicator for todo list items
 */
import { type FC } from 'react';
import { BiGitBranch } from 'react-icons/bi';

import { useChildTodos } from '../hooks/use_parent_child';

interface SubtaskIndicatorProps {
  todoId: string;
}

/**
 * Displays a compact indicator showing subtask count and completion status
 * Only renders if the todo has children
 */
export const SubtaskIndicator: FC<SubtaskIndicatorProps> = ({ todoId }) => {
  const { data: children, isLoading } = useChildTodos(todoId);

  if (isLoading || !children || children.length === 0) {
    return null;
  }

  const completedCount = children.filter((c) => c.completed !== null).length;
  const totalCount = children.length;
  const isAllComplete = completedCount === totalCount;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs ${
        isAllComplete
          ? 'text-green-600 dark:text-green-400'
          : 'text-neutral-500 dark:text-neutral-400'
      }`}
      title={`${completedCount} of ${totalCount} subtasks completed`}
    >
      <BiGitBranch size="1em" />
      <span>
        {completedCount}/{totalCount}
      </span>
    </span>
  );
};
