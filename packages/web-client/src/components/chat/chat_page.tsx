/**
 * Main chat page with session sidebar and chat thread area.
 */

import type { ChatSession } from '@eddo/core-shared';
import { type FC, useCallback, useEffect, useState } from 'react';
import { HiExclamation, HiOutlinePlus } from 'react-icons/hi';

import { useProfile } from '../../hooks/use_profile';
import { BTN_PRIMARY_SM } from '../../styles/interactive';
import type { ReasoningPreferenceSetter } from './chat_reasoning_preference';
import { useReasoningPreference } from './chat_reasoning_preference';
import { ChatSettingsPopover } from './chat_settings_popover';
import { ChatThread } from './chat_thread';
import { DeleteSessionDialog } from './delete_session_dialog';
import { NewSessionDialog } from './new_session_dialog';
import { SessionList } from './session_list';

const LAST_SESSION_KEY = 'eddo.chat.lastSessionId';

/** Get last selected session ID from localStorage */
function getLastSessionId(): string | null {
  try {
    return localStorage.getItem(LAST_SESSION_KEY);
  } catch {
    return null;
  }
}

/** Save last selected session ID to localStorage */
function saveLastSessionId(sessionId: string | null): void {
  try {
    if (sessionId) {
      localStorage.setItem(LAST_SESSION_KEY, sessionId);
    } else {
      localStorage.removeItem(LAST_SESSION_KEY);
    }
  } catch {
    // Ignore localStorage errors
  }
}

/** Props for ChatPageHeader */
interface ChatPageHeaderProps {
  onNewSession: () => void;
  showReasoning: boolean;
  onToggleReasoning: ReasoningPreferenceSetter;
}

/** Header for the chat page sidebar */
const ChatPageHeader: FC<ChatPageHeaderProps> = ({
  onNewSession,
  showReasoning,
  onToggleReasoning,
}) => (
  <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Chat Sessions</h2>
    <div className="flex items-center gap-2">
      <ChatSettingsPopover
        buttonClassName="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
        onToggleReasoning={onToggleReasoning}
        showReasoning={showReasoning}
      />
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
  </div>
);

/** Warning banner when no API key is configured */
const ApiKeyWarning: FC<{ onNavigateToProfile: () => void }> = ({ onNavigateToProfile }) => (
  <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-800 dark:bg-yellow-900/30">
    <div className="flex items-center gap-3">
      <HiExclamation className="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
      <div className="flex-1">
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">API Key Required</p>
        <p className="text-xs text-yellow-700 dark:text-yellow-300">
          Configure an Anthropic API key in{' '}
          <button
            className="underline hover:no-underline"
            onClick={onNavigateToProfile}
            type="button"
          >
            Profile → Integrations
          </button>{' '}
          to use the chat feature.
        </p>
      </div>
    </div>
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
  onSessionsLoaded?: (selectedExists: boolean) => void;
  showReasoning: boolean;
  onToggleReasoning: ReasoningPreferenceSetter;
}> = ({
  selectedSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  onSessionsLoaded,
  showReasoning,
  onToggleReasoning,
}) => (
  <aside className="flex w-80 flex-shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900">
    <ChatPageHeader
      onNewSession={onNewSession}
      onToggleReasoning={onToggleReasoning}
      showReasoning={showReasoning}
    />
    <div className="flex-1 overflow-y-auto p-4">
      <SessionList
        onDeleteSession={onDeleteSession}
        onNewSession={onNewSession}
        onSelectSession={onSelectSession}
        onSessionsLoaded={onSessionsLoaded}
        selectedSessionId={selectedSessionId}
      />
    </div>
  </aside>
);

/** Main chat area */
const ChatArea: FC<{
  selectedSessionId: string | null;
  onNewSession: () => void;
  showReasoning: boolean;
}> = ({ selectedSessionId, onNewSession, showReasoning }) => (
  <main className="flex flex-1 flex-col bg-neutral-50 dark:bg-neutral-800">
    {selectedSessionId ? (
      <ChatThread sessionId={selectedSessionId} showReasoning={showReasoning} />
    ) : (
      <NoSessionSelected onNewSession={onNewSession} />
    )}
  </main>
);

/** Hook for chat page session state management */
function useChatPageState(initialSessionId?: string) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessionId ?? getLastSessionId(),
  );
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);

  useEffect(() => {
    saveLastSessionId(selectedSessionId);
  }, [selectedSessionId]);

  const handleSelectSession = useCallback((id: string) => setSelectedSessionId(id), []);
  const handleSessionCreated = useCallback((id: string) => {
    setShowNewDialog(false);
    setSelectedSessionId(id);
  }, []);
  const handleSessionDeleted = useCallback(() => {
    if (sessionToDelete && sessionToDelete._id === selectedSessionId) setSelectedSessionId(null);
    setSessionToDelete(null);
  }, [sessionToDelete, selectedSessionId]);
  const handleSessionsLoaded = useCallback(
    (exists: boolean) => {
      if (selectedSessionId && !exists) setSelectedSessionId(null);
    },
    [selectedSessionId],
  );

  return {
    selectedSessionId,
    showNewDialog,
    setShowNewDialog,
    sessionToDelete,
    setSessionToDelete,
    handleSelectSession,
    handleSessionCreated,
    handleSessionDeleted,
    handleSessionsLoaded,
  };
}

/** Check if any API key is configured */
function hasApiKeyConfigured(profile: ReturnType<typeof useProfile>['profile']): boolean {
  const keys = profile?.preferences?.aiProviderKeys;
  if (!keys) return false;
  return Boolean(keys.anthropicApiKey || keys.openaiApiKey || keys.geminiApiKey);
}

/** Props for ChatPage */
export interface ChatPageProps {
  initialSessionId?: string;
  onNavigateToProfile?: () => void;
}

/** Main chat page component */
export const ChatPage: FC<ChatPageProps> = ({ initialSessionId, onNavigateToProfile }) => {
  const s = useChatPageState(initialSessionId);
  const { showReasoning, setShowReasoning } = useReasoningPreference();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const showApiKeyWarning = !isProfileLoading && !hasApiKeyConfigured(profile);

  return (
    <div className="flex h-full flex-col">
      {showApiKeyWarning && onNavigateToProfile && (
        <ApiKeyWarning onNavigateToProfile={onNavigateToProfile} />
      )}
      <div className="flex min-h-0 flex-1">
        <SessionSidebar
          onDeleteSession={s.setSessionToDelete}
          onNewSession={() => s.setShowNewDialog(true)}
          onSelectSession={s.handleSelectSession}
          onSessionsLoaded={s.handleSessionsLoaded}
          onToggleReasoning={setShowReasoning}
          selectedSessionId={s.selectedSessionId}
          showReasoning={showReasoning}
        />
        <ChatArea
          onNewSession={() => s.setShowNewDialog(true)}
          selectedSessionId={s.selectedSessionId}
          showReasoning={showReasoning}
        />
        <NewSessionDialog
          isOpen={s.showNewDialog}
          onClose={() => s.setShowNewDialog(false)}
          onCreated={s.handleSessionCreated}
        />
        <DeleteSessionDialog
          onClose={() => s.setSessionToDelete(null)}
          onDeleted={s.handleSessionDeleted}
          session={s.sessionToDelete}
        />
      </div>
    </div>
  );
};
