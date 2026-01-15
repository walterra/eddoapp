/**
 * Chat thread component using assistant-ui for rendering.
 */

import type { SetupLogEntry } from '@eddo/core-shared';
import { useCallback, useMemo } from 'react';
import { HiCheckCircle, HiExclamationCircle, HiOutlineRefresh } from 'react-icons/hi';

import type { RpcEvent } from '../../hooks/use_chat_api';
import { useChatSession, useSendPrompt, useStartSession } from '../../hooks/use_chat_api';
import { Thread } from './assistant-ui';
import { ChatRuntimeProvider } from './chat_runtime_provider';
import type { PiMessage } from './pi-message-converter';
import { BashToolUI, EditToolUI, GenericToolUI, ReadToolUI, WriteToolUI } from './tool_renderers';

/** Props for ChatThread */
export interface ChatThreadProps {
  sessionId: string;
}

/** Get status icon for setup log entry */
function getStatusIcon(status: SetupLogEntry['status']) {
  switch (status) {
    case 'started':
      return <HiOutlineRefresh className="h-4 w-4 animate-spin text-blue-500" />;
    case 'completed':
      return <HiCheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <HiExclamationCircle className="h-4 w-4 text-red-500" />;
  }
}

/** Setup log item display */
function SetupLogItem({ log }: { log: SetupLogEntry }) {
  const textClass =
    log.status === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300';

  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 flex-shrink-0">{getStatusIcon(log.status)}</span>
      <div className="flex-1">
        <span className={textClass}>{log.message}</span>
        {log.error && (
          <div className="mt-1 rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {log.error}
          </div>
        )}
      </div>
    </div>
  );
}

/** Setup logs panel */
function SetupLogsPanel({ logs }: { logs: SetupLogEntry[] }) {
  return (
    <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Setup Progress</h3>
      <div className="space-y-2">
        {logs.map((log, i) => (
          <SetupLogItem key={`${log.step}-${log.status}-${i}`} log={log} />
        ))}
      </div>
    </div>
  );
}

/** Status header for session not running */
function StatusHeader({ containerState, hasError }: { containerState: string; hasError: boolean }) {
  if (hasError) {
    return (
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <HiExclamationCircle className="h-6 w-6" />
        <span className="text-lg font-medium">Setup failed</span>
      </div>
    );
  }
  return <div className="text-gray-500 dark:text-gray-400">Session is {containerState}</div>;
}

/** Start/retry button */
function StartButton({
  hasError,
  isPending,
  onStart,
}: {
  hasError: boolean;
  isPending: boolean;
  onStart: () => void;
}) {
  const label = hasError ? 'Retry' : 'Start Session';
  return (
    <button
      className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      disabled={isPending}
      onClick={onStart}
      type="button"
    >
      {isPending ? (
        <span className="flex items-center gap-2">
          <HiOutlineRefresh className="h-4 w-4 animate-spin" />
          Starting...
        </span>
      ) : (
        label
      )}
    </button>
  );
}

/** Props for SessionNotRunning */
interface SessionNotRunningProps {
  containerState: string;
  isPending: boolean;
  onStart: () => void;
  setupError?: string;
  setupLogs?: SetupLogEntry[];
}

/** Error display when no logs available */
function ErrorPanel({ error }: { error: string }) {
  return (
    <div className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30">
      <div className="flex items-start gap-2">
        <HiExclamationCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
        <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
      </div>
    </div>
  );
}

/** Session not running state component */
function SessionNotRunning(props: SessionNotRunningProps) {
  const { containerState, isPending, onStart, setupError, setupLogs } = props;
  const hasLogs = setupLogs && setupLogs.length > 0;
  const hasError = !!setupError || containerState === 'error';

  // Show error panel if we have an error but no logs (e.g., early failure)
  const showErrorPanel = hasError && !hasLogs && setupError;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="text-center">
        <StatusHeader containerState={containerState} hasError={hasError} />
      </div>
      {hasLogs && <SetupLogsPanel logs={setupLogs} />}
      {showErrorPanel && <ErrorPanel error={setupError} />}
      <StartButton hasError={hasError} isPending={isPending} onStart={onStart} />
    </div>
  );
}

/** Entry with message */
interface MessageEntry {
  type: 'message';
  message: PiMessage;
}

/** Check if entry is a message entry */
function isMessageEntry(entry: { type: string }): entry is MessageEntry {
  return entry.type === 'message';
}

/** Convert database entries to PiMessage format */
function entriesToPiMessages(entries: Array<{ type: string; message?: unknown }>): PiMessage[] {
  return entries
    .filter(isMessageEntry)
    .map((e) => e.message)
    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'toolResult');
}

/** Active chat thread with assistant-ui rendering */
function ActiveChatThread({
  initialMessages,
  sessionId,
}: {
  initialMessages: PiMessage[];
  sessionId: string;
}) {
  const { sendPrompt, abort } = useSendPrompt(sessionId);

  const handleSendMessage = useCallback(
    async (text: string, onEvent: (event: RpcEvent) => void) => {
      await sendPrompt(text, onEvent);
    },
    [sendPrompt],
  );

  const handleCancel = useCallback(async () => {
    abort();
  }, [abort]);

  return (
    <ChatRuntimeProvider
      initialMessages={initialMessages}
      onCancel={handleCancel}
      onSendMessage={handleSendMessage}
    >
      <BashToolUI />
      <ReadToolUI />
      <WriteToolUI />
      <EditToolUI />
      <GenericToolUI />
      <div className="flex h-full flex-col">
        <Thread />
      </div>
    </ChatRuntimeProvider>
  );
}

/** Chat thread component */
export function ChatThread({ sessionId }: ChatThreadProps) {
  const startSession = useStartSession();
  const isStarting = startSession.isPending;
  const {
    data: sessionData,
    isLoading,
    error,
  } = useChatSession(sessionId, {
    refetchInterval: isStarting ? 500 : undefined,
  });

  // Extract error message from mutation error (fallback when setupError not in DB)
  const mutationError = startSession.error?.message;

  const handleStartSession = () => {
    startSession.reset(); // Clear previous error
    startSession.mutateAsync(sessionId).catch(() => {
      // Error is captured in startSession.error, no need to log
    });
  };

  const initialMessages = useMemo(() => {
    if (!sessionData?.entries) return [];
    return entriesToPiMessages(sessionData.entries);
  }, [sessionData?.entries]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">Loading session...</div>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-red-500">Failed to load session</div>
      </div>
    );
  }

  const { session } = sessionData;

  if (session.containerState !== 'running') {
    // Use mutation error as fallback if setupError not persisted to DB yet
    const displayError = session.setupError ?? mutationError;
    return (
      <SessionNotRunning
        containerState={session.containerState}
        isPending={startSession.isPending}
        onStart={handleStartSession}
        setupError={displayError}
        setupLogs={session.setupLogs}
      />
    );
  }

  return (
    <ActiveChatThread initialMessages={initialMessages} key={sessionId} sessionId={sessionId} />
  );
}
