/**
 * Read-only view component for blockedBy relationships
 */
import { type FC } from 'react';
import { BiCheckCircle, BiCircle } from 'react-icons/bi';

import { useTodoById } from '../hooks/use_parent_child';

/** Label styling for field headers */
const LABEL_CLASS =
  'text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide';

/** Single blocker item in the view */
const BlockerViewItem: FC<{ blockerId: string }> = ({ blockerId }) => {
  const { data: blockerTodo, isLoading } = useTodoById(blockerId);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-600 dark:bg-neutral-900/50">
      {blockerTodo?.completed ? (
        <BiCheckCircle className="flex-shrink-0 text-green-500" size="1.2em" />
      ) : (
        <BiCircle className="flex-shrink-0 text-red-500" size="1.2em" />
      )}
      <div className="min-w-0 flex-1">
        {isLoading ? (
          <span className="text-sm text-neutral-500">Loading...</span>
        ) : blockerTodo ? (
          <span
            className={`text-sm ${blockerTodo.completed ? 'text-neutral-500 line-through' : 'text-neutral-900 dark:text-white'}`}
          >
            {blockerTodo.title}
          </span>
        ) : (
          <span className="text-sm text-amber-600 dark:text-amber-400">Todo not found</span>
        )}
      </div>
    </div>
  );
};

interface BlockedByViewProps {
  blockedBy: string[] | undefined;
}

/**
 * Read-only view of blockedBy relationships.
 * Shows each blocker with completion status indicator.
 */
export const BlockedByView: FC<BlockedByViewProps> = ({ blockedBy }) => {
  if (!blockedBy || blockedBy.length === 0) {
    return null;
  }

  const label =
    blockedBy.length === 1 ? 'Blocked By (1 task)' : `Blocked By (${blockedBy.length} tasks)`;

  return (
    <div>
      <div className={LABEL_CLASS}>{label}</div>
      <div className="mt-2 space-y-2">
        {blockedBy.map((blockerId) => (
          <BlockerViewItem blockerId={blockerId} key={blockerId} />
        ))}
      </div>
    </div>
  );
};
