/**
 * Chat thread component using assistant-ui for rendering.
 */

import { useCallback, useMemo } from 'react';

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

/** Session not running state component */
function SessionNotRunning({
  containerState,
  isPending,
  onStart,
}: {
  containerState: string;
  isPending: boolean;
  onStart: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="text-gray-500 dark:text-gray-400">Session is {containerState}</div>
      <button
        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        disabled={isPending}
        onClick={onStart}
      >
        {isPending ? 'Starting...' : 'Start Session'}
      </button>
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
  sessionId,
  initialMessages,
}: {
  sessionId: string;
  initialMessages: PiMessage[];
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
      {/* Register tool UI renderers */}
      <BashToolUI />
      <ReadToolUI />
      <WriteToolUI />
      <EditToolUI />
      <GenericToolUI />

      {/* Main thread UI */}
      <div className="flex h-full flex-col">
        <Thread />
      </div>
    </ChatRuntimeProvider>
  );
}

/** Chat thread component */
export function ChatThread({ sessionId }: ChatThreadProps) {
  const { data: sessionData, isLoading, error } = useChatSession(sessionId);
  const startSession = useStartSession();

  const handleStartSession = () => startSession.mutateAsync(sessionId).catch(console.error);

  // Convert entries to PiMessages
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
    return (
      <SessionNotRunning
        containerState={session.containerState}
        isPending={startSession.isPending}
        onStart={handleStartSession}
      />
    );
  }

  // Key by sessionId to force remount when switching sessions
  return (
    <ActiveChatThread initialMessages={initialMessages} key={sessionId} sessionId={sessionId} />
  );
}
