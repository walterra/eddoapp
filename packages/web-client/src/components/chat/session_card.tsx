/**
 * Session card component for displaying a single chat session.
 */

import type { ChatSession, ContainerState } from '@eddo/core-shared';
import { type FC } from 'react';
import { HiOutlineChat, HiOutlinePause, HiOutlinePlay, HiOutlineTrash } from 'react-icons/hi';

import { useStartSession, useStopSession } from '../../hooks/use_chat_api';
import { CARD_INTERACTIVE, ICON_BUTTON, TRANSITION } from '../../styles/interactive';

/** Format date as relative time or short date */
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/** Format token count with K/M suffix */
function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

/** Format cost as currency */
function formatCost(cost: number): string {
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(2)}`;
}

/** Status badge colors by container state */
const STATUS_COLORS: Record<ContainerState, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  creating: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  running: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  paused: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  stopped: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

/** Status badge labels */
const STATUS_LABELS: Record<ContainerState, string> = {
  pending: 'Pending',
  creating: 'Starting...',
  running: 'Running',
  paused: 'Paused',
  stopped: 'Stopped',
  error: 'Error',
};

/** Status badge component */
const StatusBadge: FC<{ state: ContainerState }> = ({ state }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[state]}`}>
    {STATUS_LABELS[state]}
  </span>
);

/** Session stats display */
const SessionStats: FC<{
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
}> = ({ messageCount, inputTokens, outputTokens, totalCost }) => (
  <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
    <span>{messageCount} messages</span>
    <span>·</span>
    <span>{formatTokens(inputTokens + outputTokens)} tokens</span>
    <span>·</span>
    <span>{formatCost(totalCost)}</span>
  </div>
);

/** Stop button for running sessions */
const StopButton: FC<{ onClick: () => void; disabled: boolean }> = ({ onClick, disabled }) => (
  <button
    aria-label="Stop session"
    className={ICON_BUTTON}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title="Stop session"
    type="button"
  >
    <HiOutlinePause className="h-4 w-4" />
  </button>
);

/** Start button for non-running sessions */
const StartButton: FC<{ onClick: () => void; disabled: boolean }> = ({ onClick, disabled }) => (
  <button
    aria-label="Start session"
    className={ICON_BUTTON}
    disabled={disabled}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title="Start session"
    type="button"
  >
    <HiOutlinePlay className="h-4 w-4" />
  </button>
);

/** Delete button */
const DeleteButton: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    aria-label="Delete session"
    className={`${ICON_BUTTON} hover:text-red-600 dark:hover:text-red-400`}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    title="Delete session"
    type="button"
  >
    <HiOutlineTrash className="h-4 w-4" />
  </button>
);

/** Session action buttons */
const SessionActions: FC<{
  session: ChatSession;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  isStarting: boolean;
  isStopping: boolean;
}> = ({ session, onStart, onStop, onDelete, isStarting, isStopping }) => {
  const isRunning = session.containerState === 'running';
  const isPending = session.containerState === 'pending' || session.containerState === 'creating';

  return (
    <div className="flex items-center gap-1">
      {isRunning ? (
        <StopButton disabled={isStopping} onClick={onStop} />
      ) : (
        <StartButton disabled={isStarting || isPending} onClick={onStart} />
      )}
      <DeleteButton onClick={onDelete} />
    </div>
  );
};

/** Session card header with name and status */
const SessionCardHeader: FC<{
  sessionName: string;
  repoInfo?: string;
  containerState: ContainerState;
}> = ({ sessionName, repoInfo, containerState }) => (
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <HiOutlineChat className="h-4 w-4 flex-shrink-0 text-neutral-400" />
        <span className="truncate font-medium text-neutral-900 dark:text-white">{sessionName}</span>
      </div>
      {repoInfo && (
        <div className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
          {repoInfo}
        </div>
      )}
    </div>
    <StatusBadge state={containerState} />
  </div>
);

/** Get card class based on selection */
function getSessionCardClass(isSelected: boolean): string {
  const selectedClass = isSelected
    ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
    : '';
  return `${CARD_INTERACTIVE} group w-full cursor-pointer p-3 text-left ${selectedClass}`;
}

/** Session card footer with stats and time */
const SessionCardFooter: FC<{ session: ChatSession }> = ({ session }) => (
  <div className="mt-2 flex items-center justify-between">
    <SessionStats
      inputTokens={session.stats.inputTokens}
      messageCount={session.stats.messageCount}
      outputTokens={session.stats.outputTokens}
      totalCost={session.stats.totalCost}
    />
    <div className="text-xs text-neutral-400 dark:text-neutral-500">
      {formatRelativeTime(session.updatedAt)}
    </div>
  </div>
);

/** Props for SessionCard */
export interface SessionCardProps {
  session: ChatSession;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

/** Single session card */
export const SessionCard: FC<SessionCardProps> = ({ session, isSelected, onSelect, onDelete }) => {
  const startSession = useStartSession();
  const stopSession = useStopSession();
  const sessionName = session.name || `Session ${session._id.slice(0, 8)}`;

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-action]')) return;
    onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      aria-selected={isSelected}
      className={getSessionCardClass(isSelected)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="option"
      tabIndex={0}
    >
      <SessionCardHeader
        containerState={session.containerState}
        repoInfo={session.repository?.slug}
        sessionName={sessionName}
      />
      <SessionCardFooter session={session} />
      <div
        className={`mt-2 flex justify-end opacity-0 ${TRANSITION} group-hover:opacity-100 group-focus:opacity-100`}
        data-action="true"
      >
        <SessionActions
          isStarting={startSession.isPending}
          isStopping={stopSession.isPending}
          onDelete={onDelete}
          onStart={() => startSession.mutateAsync(session._id).catch(() => {})}
          onStop={() => stopSession.mutateAsync(session._id).catch(() => {})}
          session={session}
        />
      </div>
    </div>
  );
};
