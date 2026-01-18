/**
 * Main chat page with session sidebar and chat thread area.
 */

import type { ChatSession } from '@eddo/core-shared';
import { type FC, useState } from 'react';
import { HiOutlinePlus } from 'react-icons/hi';

import { BTN_PRIMARY_SM } from '../../styles/interactive';
import { ChatThread } from './chat_thread';
import { DeleteSessionDialog } from './delete_session_dialog';
import { NewSessionDialog } from './new_session_dialog';
import { SessionList } from './session_list';

/** Props for ChatPageHeader */
interface ChatPageHeaderProps {
  onNewSession: () => void;
}

/** Header for the chat page sidebar */
const ChatPageHeader: FC<ChatPageHeaderProps> = ({ onNewSession }) => (
  <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Chat Sessions</h2>
    <button
      aria-label="New session"
      className={BTN_PRIMARY_SM}
      onClick={onNewSession}
      title="New session"
      type="button"
    >
      <HiOutlinePlus className="h-4 w-4" />
    </button>
  </div>
);

/** Empty state when no session is selected */
const NoSessionSelected: FC<{ onNewSession: () => void }> = ({ onNewSession }) => (
  <div className="flex h-full flex-col items-center justify-center text-center">
    <div className="mb-4 text-6xl">💬</div>
    <h3 className="mb-2 text-lg font-medium text-neutral-900 dark:text-white">
      No session selected
    </h3>
    <p className="mb-4 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
      Select an existing session from the sidebar or start a new conversation.
    </p>
    <button className={BTN_PRIMARY_SM} onClick={onNewSession} type="button">
      <HiOutlinePlus className="mr-1 h-4 w-4" />
      New Session
    </button>
  </div>
);

/** Session sidebar component */
const SessionSidebar: FC<{
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (session: ChatSession) => void;
  onNewSession: () => void;
}> = ({ selectedSessionId, onSelectSession, onDeleteSession, onNewSession }) => (
  <aside className="flex w-80 flex-shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900">
    <ChatPageHeader onNewSession={onNewSession} />
    <div className="flex-1 overflow-y-auto p-4">
      <SessionList
        onDeleteSession={onDeleteSession}
        onNewSession={onNewSession}
        onSelectSession={onSelectSession}
        selectedSessionId={selectedSessionId}
      />
    </div>
  </aside>
);

/** Main chat area */
const ChatArea: FC<{
  selectedSessionId: string | null;
  onNewSession: () => void;
}> = ({ selectedSessionId, onNewSession }) => (
  <main className="flex flex-1 flex-col bg-white dark:bg-neutral-800">
    {selectedSessionId ? (
      <ChatThread sessionId={selectedSessionId} />
    ) : (
      <NoSessionSelected onNewSession={onNewSession} />
    )}
  </main>
);

/** Props for ChatPage */
export interface ChatPageProps {
  /** Optional initial session ID to select */
  initialSessionId?: string;
}

/** Main chat page component */
export const ChatPage: FC<ChatPageProps> = ({ initialSessionId }) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessionId ?? null,
  );
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);

  const handleSessionCreated = (sessionId: string) => {
    setShowNewDialog(false);
    setSelectedSessionId(sessionId);
  };

  const handleSessionDeleted = () => {
    if (sessionToDelete && sessionToDelete._id === selectedSessionId) {
      setSelectedSessionId(null);
    }
    setSessionToDelete(null);
  };

  return (
    <div className="flex h-full">
      <SessionSidebar
        onDeleteSession={setSessionToDelete}
        onNewSession={() => setShowNewDialog(true)}
        onSelectSession={setSelectedSessionId}
        selectedSessionId={selectedSessionId}
      />
      <ChatArea onNewSession={() => setShowNewDialog(true)} selectedSessionId={selectedSessionId} />
      <NewSessionDialog
        isOpen={showNewDialog}
        onClose={() => setShowNewDialog(false)}
        onCreated={handleSessionCreated}
      />
      <DeleteSessionDialog
        onClose={() => setSessionToDelete(null)}
        onDeleted={handleSessionDeleted}
        session={sessionToDelete}
      />
    </div>
  );
};
