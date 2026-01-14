/**
 * Chat thread component - main chat interface.
 */

import type { SessionMessageEntry } from '@eddo/core-shared';
import { useState } from 'react';

import type { RpcEvent } from '../../hooks/use_chat_api';
import { useChatSession, useSendPrompt, useStartSession } from '../../hooks/use_chat_api';
import { ChatInput } from './chat_input';
import { ChatMessages } from './chat_messages';

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

/** Handle streaming events and update text */
function createStreamingHandler(setStreamingText: (fn: (prev: string) => string) => void) {
  return (event: RpcEvent) => {
    if (event.type === 'message_update') {
      const assistantEvent = event.assistantMessageEvent as
        | { type: string; delta?: string }
        | undefined;
      if (assistantEvent?.type === 'text_delta' && assistantEvent.delta) {
        setStreamingText((prev) => prev + assistantEvent.delta);
      }
    } else if (event.type === 'agent_end') {
      setStreamingText(() => '');
    }
  };
}

/** Chat thread component */
export function ChatThread({ sessionId }: ChatThreadProps) {
  const { data: sessionData, isLoading, error } = useChatSession(sessionId);
  const { sendPrompt, abort, isStreaming } = useSendPrompt(sessionId);
  const startSession = useStartSession();
  const [streamingText, setStreamingText] = useState('');

  const handleStartSession = () => startSession.mutateAsync(sessionId).catch(console.error);

  const handleSend = async (message: string) => {
    setStreamingText('');
    await sendPrompt(message, createStreamingHandler(setStreamingText));
  };

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

  const { session, entries } = sessionData;

  if (session.containerState !== 'running') {
    return (
      <SessionNotRunning
        containerState={session.containerState}
        isPending={startSession.isPending}
        onStart={handleStartSession}
      />
    );
  }

  const messageEntries = entries.filter((e): e is SessionMessageEntry => e.type === 'message');

  return (
    <div className="flex h-full flex-col">
      <ChatMessages entries={messageEntries} streamingText={streamingText} />
      <ChatInput isStreaming={isStreaming} onAbort={abort} onSend={handleSend} />
    </div>
  );
}
