import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import type { AssistantConversationMessageDoc } from '@eddo/core-shared';
import { useCallback, useMemo, type ReactNode } from 'react';
import { isTerminalAssistantRequest } from './assistant_state';
import type {
  AssistantPendingRequest,
  AssistantSession,
  AssistantSnapshot,
} from './assistant_types';

interface TextPart {
  type: 'text';
  text: string;
}
export interface AssistantRuntimeProviderProps {
  state: AssistantSnapshot;
  session: AssistantSession;
  children: ReactNode;
}

function projectedMessage(message: AssistantConversationMessageDoc): ThreadMessageLike {
  return {
    id: message._id,
    role: message.role,
    content: [{ type: 'text', text: message.content }],
  };
}

/** Suppresses optimistic text once its stable server projection arrives or the active conversation changes. */
export function assistantThreadMessages(
  messages: readonly AssistantConversationMessageDoc[],
  pending: AssistantPendingRequest | null,
  conversationId?: string,
): ThreadMessageLike[] {
  const result = messages.map(projectedMessage);
  if (!pending || messages.some((message) => message._id === pending.projectionIds.user))
    return result;
  if (pending.conversationId && conversationId && pending.conversationId !== conversationId)
    return result;
  result.push({
    id: pending.projectionIds.user,
    role: 'user',
    content: [{ type: 'text', text: pending.text }],
  });
  return result;
}

/** Adapts server projections to assistant-ui without sandbox RPC, provider keys, or direct execution access. */
function sharedRunning(state: AssistantSnapshot): boolean {
  return (state.sharedRequests ?? []).some(
    (request) =>
      request.conversationId === state.conversation?._id &&
      !isTerminalAssistantRequest(request.status),
  );
}

function isRunning(state: AssistantSnapshot): boolean {
  return (
    sharedRunning(state) ||
    state.submitting ||
    Boolean(state.cancelling) ||
    Boolean(state.pending && !isTerminalAssistantRequest(state.pending.receipt?.status))
  );
}
function isSendDisabled(state: AssistantSnapshot): boolean {
  return (
    state.loading ||
    state.connection !== 'connected' ||
    Boolean(state.pending) ||
    Boolean(state.cancelling) ||
    state.error === 'storage' ||
    state.error === 'unsupported'
  );
}

export function AssistantThreadRuntime({
  state,
  session,
  children,
}: AssistantRuntimeProviderProps) {
  const messages = useMemo(
    () => assistantThreadMessages(state.messages, state.pending, state.conversation?._id),
    [state.messages, state.pending, state.conversation?._id],
  );
  const onNew = useCallback(
    async (message: AppendMessage) => {
      const content = message.content as ThreadMessageLike['content'];
      const text =
        typeof content === 'string'
          ? content
          : content
              .filter((part): part is TextPart => part.type === 'text')
              .map((part) => part.text)
              .join('\n');
      await session.send(text);
    },
    [session],
  );
  const runtime = useExternalStoreRuntime({
    messages,
    onNew,
    convertMessage: (message) => message,
    isRunning: isRunning(state),
    isSendDisabled: isSendDisabled(state),
    isDisabled: state.connection === 'blocked',
  });
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
