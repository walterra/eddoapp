/**
 * Chat sidebar component - docked chat view alongside todo list.
 * Follows AuditSidebar pattern for consistent UI.
 */

import type { ChatSession } from '@eddo/core-shared';
import { type FC, useState } from 'react';
import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineExternalLink,
  HiOutlinePlus,
  HiOutlineX,
} from 'react-icons/hi';

import { useChatSessions } from '../../hooks/use_chat_api';
import type { ReasoningPreferenceSetter } from './chat_reasoning_preference';
import { useReasoningPreference } from './chat_reasoning_preference';
import { ChatSettingsPopover } from './chat_settings_popover';
import { ChatThread } from './chat_thread';
import { DeleteSessionDialog } from './delete_session_dialog';
import { NewSessionDialog } from './new_session_dialog';

/** Width of the chat sidebar when expanded */
const SIDEBAR_WIDTH = 480;

const HEADER_ICON_BUTTON_CLASSNAME =
  'rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200';

/** Props for ChatSidebar */
export interface ChatSidebarProps {
  isOpen: boolean;
  selectedSessionId: string | null;
  onClose: () => void;
  onExpand: () => void;
  onSelectSession: (sessionId: string | null) => void;
}

/** Header button component */
const HeaderButton: FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, title, children }) => (
  <button className={HEADER_ICON_BUTTON_CLASSNAME} onClick={onClick} title={title} type="button">
    {children}
  </button>
);

/** Sidebar header with controls */
const SidebarHeader: FC<{
  sessionName: string | null;
  onClose: () => void;
  onExpand: () => void;
  onNewSession: () => void;
  showSessionList: boolean;
  onToggleSessionList: () => void;
  showReasoning: boolean;
  onToggleReasoning: ReasoningPreferenceSetter;
}> = ({
  sessionName,
  onClose,
  onExpand,
  onNewSession,
  showSessionList,
  onToggleSessionList,
  showReasoning,
  onToggleReasoning,
}) => (
  <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <HeaderButton
        onClick={onToggleSessionList}
        title={showSessionList ? 'Hide sessions' : 'Show sessions'}
      >
        {showSessionList ? (
          <HiOutlineChevronLeft className="h-4 w-4" />
        ) : (
          <HiOutlineChevronRight className="h-4 w-4" />
        )}
      </HeaderButton>
      <h2 className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {sessionName ?? 'Chat'}
      </h2>
    </div>
    <div className="flex items-center gap-1">
      <HeaderButton onClick={onNewSession} title="New session">
        <HiOutlinePlus className="h-4 w-4" />
      </HeaderButton>
      <ChatSettingsPopover
        buttonClassName={HEADER_ICON_BUTTON_CLASSNAME}
        onToggleReasoning={onToggleReasoning}
        showReasoning={showReasoning}
      />
      <HeaderButton onClick={onExpand} title="Expand to fullscreen">
        <HiOutlineExternalLink className="h-4 w-4" />
      </HeaderButton>
      <HeaderButton onClick={onClose} title="Close sidebar">
        <HiOutlineX className="h-4 w-4" />
      </HeaderButton>
    </div>
  </div>
);

/** Session item in mini list */
const SessionItem: FC<{
  session: ChatSession;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ session, isSelected, onSelect }) => {
  const sessionName = session.name || `Session ${session._id.slice(0, 8)}`;
  const className = isSelected
    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
    : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700';

  return (
    <button
      className={`w-full truncate rounded px-2 py-1.5 text-left text-xs transition-colors ${className}`}
      onClick={onSelect}
      type="button"
    >
      {sessionName}
    </button>
  );
};

/** Mini session list for sidebar */
const MiniSessionList: FC<{
  sessions: ChatSession[];
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
}> = ({ sessions, selectedSessionId, onSelectSession }) => {
  if (sessions.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-neutral-500 dark:text-neutral-400">
        No sessions yet
      </div>
    );
  }

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="flex flex-col gap-1 p-2">
      {sortedSessions.slice(0, 10).map((session) => (
        <SessionItem
          isSelected={session._id === selectedSessionId}
          key={session._id}
          onSelect={() => onSelectSession(session._id)}
          session={session}
        />
      ))}
    </div>
  );
};

/** No session selected state */
const NoSessionSelected: FC<{ onNewSession: () => void }> = ({ onNewSession }) => (
  <div className="flex h-full flex-col items-center justify-center p-4 text-center">
    <div className="mb-3 text-4xl">💬</div>
    <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
      Select a session or start a new conversation
    </p>
    <button
      className="bg-primary-600 hover:bg-primary-700 flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-white"
      onClick={onNewSession}
      type="button"
    >
      <HiOutlinePlus className="h-4 w-4" />
      New Session
    </button>
  </div>
);

/** Sidebar content area */
const SidebarContent: FC<{
  showSessionList: boolean;
  sessions: ChatSession[];
  selectedSessionId: string | null;
  onSelectSession: (id: string | null) => void;
  onNewSession: () => void;
  showReasoning: boolean;
}> = ({
  showSessionList,
  sessions,
  selectedSessionId,
  onSelectSession,
  onNewSession,
  showReasoning,
}) => (
  <div className="flex min-h-0 flex-1">
    {showSessionList && (
      <div className="w-48 flex-shrink-0 overflow-y-auto border-r border-neutral-200 dark:border-neutral-700">
        <MiniSessionList
          onSelectSession={onSelectSession}
          selectedSessionId={selectedSessionId}
          sessions={sessions}
        />
      </div>
    )}
    <div className="min-w-0 flex-1">
      {selectedSessionId ? (
        <ChatThread sessionId={selectedSessionId} showReasoning={showReasoning} />
      ) : (
        <NoSessionSelected onNewSession={onNewSession} />
      )}
    </div>
  </div>
);

/** Hook for sidebar dialog state */
function useSidebarDialogs(
  selectedSessionId: string | null,
  onSelectSession: (id: string | null) => void,
) {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);

  const handleSessionCreated = (sessionId: string) => {
    setShowNewDialog(false);
    onSelectSession(sessionId);
  };

  const handleSessionDeleted = () => {
    if (sessionToDelete && sessionToDelete._id === selectedSessionId) {
      onSelectSession(null);
    }
    setSessionToDelete(null);
  };

  return {
    showNewDialog,
    setShowNewDialog,
    sessionToDelete,
    setSessionToDelete,
    handleSessionCreated,
    handleSessionDeleted,
  };
}

/** Chat sidebar component */
export const ChatSidebar: FC<ChatSidebarProps> = (props) => {
  const { isOpen, selectedSessionId, onClose, onExpand, onSelectSession } = props;
  const { data: sessions } = useChatSessions();
  const { showReasoning, setShowReasoning } = useReasoningPreference();
  const [showSessionList, setShowSessionList] = useState(false);
  const dialogs = useSidebarDialogs(selectedSessionId, onSelectSession);

  if (!isOpen) return null;

  const selectedSession = sessions?.find((s) => s._id === selectedSessionId);
  const sessionName = selectedSession?.name ?? null;

  return (
    <>
      <aside
        className="flex h-full flex-col border-l border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
        style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}
      >
        <SidebarHeader
          onClose={onClose}
          onExpand={onExpand}
          onNewSession={() => dialogs.setShowNewDialog(true)}
          onToggleReasoning={setShowReasoning}
          onToggleSessionList={() => setShowSessionList(!showSessionList)}
          sessionName={sessionName}
          showReasoning={showReasoning}
          showSessionList={showSessionList}
        />
        <SidebarContent
          onNewSession={() => dialogs.setShowNewDialog(true)}
          onSelectSession={onSelectSession}
          selectedSessionId={selectedSessionId}
          sessions={sessions ?? []}
          showReasoning={showReasoning}
          showSessionList={showSessionList}
        />
      </aside>

      <NewSessionDialog
        isOpen={dialogs.showNewDialog}
        onClose={() => dialogs.setShowNewDialog(false)}
        onCreated={dialogs.handleSessionCreated}
      />
      <DeleteSessionDialog
        onClose={() => dialogs.setSessionToDelete(null)}
        onDeleted={dialogs.handleSessionDeleted}
        session={dialogs.sessionToDelete}
      />
    </>
  );
};
