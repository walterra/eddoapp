/**
 * Assistant-UI runtime provider for pi-coding-agent chat sessions.
 * Uses ExternalStoreRuntime - we manage state, assistant-ui renders.
 */

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import type { RpcEvent } from '../../hooks/use_chat_api';
import { convertPiMessages, type PiMessage } from './pi-message-converter';

/** Props for ChatRuntimeProvider */
export interface ChatRuntimeProviderProps {
  children: ReactNode;
  initialMessages: PiMessage[];
  onSendMessage: (text: string, onEvent: (event: RpcEvent) => void) => Promise<void>;
  onCancel?: () => Promise<void>;
}

/** Extract text from assistant-ui message content */
function extractMessageText(content: ThreadMessageLike['content']): string {
  if (typeof content === 'string') return content;
  return content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
}

/** Handle message_start event */
function handleMessageStart(
  event: RpcEvent,
  setMessages: React.Dispatch<React.SetStateAction<PiMessage[]>>,
): void {
  const msg = (event as { message?: PiMessage }).message;
  if (msg?.role === 'user') {
    setMessages((prev) => [...prev, msg]);
  }
}

/** Handle message_update event */
function handleMessageUpdate(
  event: RpcEvent,
  setStreamingContent: React.Dispatch<React.SetStateAction<string>>,
): void {
  const assistantEvent = (event as { assistantMessageEvent?: { type: string; delta?: string } })
    .assistantMessageEvent;
  if (assistantEvent?.type === 'text_delta' && assistantEvent.delta) {
    setStreamingContent((prev) => prev + assistantEvent.delta);
  }
}

/** Handle message_end event */
function handleMessageEnd(
  event: RpcEvent,
  setMessages: React.Dispatch<React.SetStateAction<PiMessage[]>>,
  setStreamingContent: React.Dispatch<React.SetStateAction<string>>,
): void {
  const msg = (event as { message?: PiMessage }).message;
  if (msg && msg.role !== 'user') {
    setMessages((prev) => [...prev, msg]);
    setStreamingContent('');
  }
}

/** Hook to manage pi messages state and convert for assistant-ui */
function usePiMessagesState(initialMessages: PiMessage[]) {
  const [messages, setMessages] = useState<PiMessage[]>(initialMessages);
  const [isRunning, setIsRunning] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>('');

  // Convert pi messages to assistant-ui format
  const convertedMessages = useMemo(() => {
    const converted = convertPiMessages(messages);
    if (isRunning && streamingContent) {
      converted.push({
        id: 'streaming',
        role: 'assistant',
        content: [{ type: 'text', text: streamingContent }],
        createdAt: new Date(),
      });
    }
    return converted;
  }, [messages, isRunning, streamingContent]);

  const handleRpcEvent = useCallback((event: RpcEvent) => {
    if (event.type === 'message_start') handleMessageStart(event, setMessages);
    else if (event.type === 'message_update') handleMessageUpdate(event, setStreamingContent);
    else if (event.type === 'message_end')
      handleMessageEnd(event, setMessages, setStreamingContent);
    else if (event.type === 'agent_end') {
      setIsRunning(false);
      setStreamingContent('');
    }
  }, []);

  const startRun = useCallback(() => {
    setIsRunning(true);
    setStreamingContent('');
  }, []);

  return { convertedMessages, isRunning, handleRpcEvent, startRun, setIsRunning };
}

/** Chat runtime provider component */
export function ChatRuntimeProvider({
  children,
  initialMessages,
  onSendMessage,
  onCancel,
}: ChatRuntimeProviderProps) {
  const { convertedMessages, isRunning, handleRpcEvent, startRun, setIsRunning } =
    usePiMessagesState(initialMessages);

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const text = extractMessageText(message.content as ThreadMessageLike['content']);
      if (!text.trim()) return;

      startRun();
      try {
        await onSendMessage(text, handleRpcEvent);
      } finally {
        setIsRunning(false);
      }
    },
    [onSendMessage, handleRpcEvent, startRun, setIsRunning],
  );

  const handleCancel = useCallback(async () => {
    if (onCancel) {
      await onCancel();
    }
    setIsRunning(false);
  }, [onCancel, setIsRunning]);

  const runtime = useExternalStoreRuntime({
    messages: convertedMessages,
    isRunning,
    onNew,
    onCancel: onCancel ? handleCancel : undefined,
    convertMessage: (msg) => msg, // Messages are already in ThreadMessageLike format
  });

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
