/**
 * Session list component - displays all chat sessions with status and actions.
 */

import type { ChatSession } from '@eddo/core-shared';
import { type FC, useEffect } from 'react';
import { HiOutlineChat } from 'react-icons/hi';

import { useChatSessions } from '../../hooks/use_chat_api';
import { BTN_PRIMARY_SM } from '../../styles/interactive';
import { SessionCard } from './session_card';

/** Props for SessionList */
export interface SessionListProps {
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (session: ChatSession) => void;
  onNewSession: () => void;
  /** Called when sessions are loaded, with whether the selected session exists */
  onSessionsLoaded?: (selectedExists: boolean) => void;
}

/** Empty state when no sessions exist */
const EmptyState: FC<{ onNewSession: () => void }> = ({ onNewSession }) => (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <HiOutlineChat className="mb-2 h-12 w-12 text-neutral-300 dark:text-neutral-600" />
    <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">No chat sessions yet</p>
    <button className={BTN_PRIMARY_SM} onClick={onNewSession} type="button">
      Start a conversation
    </button>
  </div>
);

/** Loading state */
const LoadingState: FC = () => (
  <div className="flex items-center justify-center py-8">
    <div className="text-sm text-neutral-500 dark:text-neutral-400">Loading sessions...</div>
  </div>
);

/** Error state */
const ErrorState: FC<{ error: Error }> = ({ error }) => (
  <div className="flex items-center justify-center py-8">
    <div className="text-sm text-red-500">{error.message}</div>
  </div>
);

/** Sort sessions by updatedAt descending */
function sortSessionsByDate(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/** Session list component */
export const SessionList: FC<SessionListProps> = ({
  selectedSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  onSessionsLoaded,
}) => {
  const { data: sessions, isLoading, error } = useChatSessions();

  // Notify parent when sessions are loaded
  useEffect(() => {
    if (!isLoading && sessions && onSessionsLoaded) {
      const selectedExists = selectedSessionId
        ? sessions.some((s) => s._id === selectedSessionId)
        : false;
      onSessionsLoaded(selectedExists);
    }
  }, [sessions, isLoading, selectedSessionId, onSessionsLoaded]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!sessions || sessions.length === 0) return <EmptyState onNewSession={onNewSession} />;

  return (
    <div className="flex flex-col gap-2">
      {sortSessionsByDate(sessions).map((session) => (
        <SessionCard
          isSelected={session._id === selectedSessionId}
          key={session._id}
          onDelete={() => onDeleteSession(session)}
          onSelect={() => onSelectSession(session._id)}
          session={session}
        />
      ))}
    </div>
  );
};
