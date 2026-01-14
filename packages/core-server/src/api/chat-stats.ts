import type { AssistantMessage, SessionMessageEntry, SessionStats } from '@eddo/core-shared';

/** Calculate stats delta for a message */
export function calculateMessageStatsDelta(entry: SessionMessageEntry): Partial<SessionStats> {
  const message = entry.message;
  const delta: Partial<SessionStats> = { messageCount: 1 };

  if (message.role === 'user') {
    delta.userMessageCount = 1;
    return delta;
  }

  if (message.role === 'assistant') {
    delta.assistantMessageCount = 1;
    const assistantMsg = message as AssistantMessage;
    if (assistantMsg.usage) {
      delta.inputTokens = assistantMsg.usage.input;
      delta.outputTokens = assistantMsg.usage.output;
      delta.totalCost = assistantMsg.usage.cost?.total ?? 0;
    }
    if (Array.isArray(assistantMsg.content)) {
      delta.toolCallCount = assistantMsg.content.filter((c) => c.type === 'toolCall').length;
    }
  }

  return delta;
}

/** Apply stats delta to session stats */
export function applyStatsDelta(current: SessionStats, delta: Partial<SessionStats>): SessionStats {
  return {
    messageCount: current.messageCount + (delta.messageCount ?? 0),
    userMessageCount: current.userMessageCount + (delta.userMessageCount ?? 0),
    assistantMessageCount: current.assistantMessageCount + (delta.assistantMessageCount ?? 0),
    toolCallCount: current.toolCallCount + (delta.toolCallCount ?? 0),
    inputTokens: current.inputTokens + (delta.inputTokens ?? 0),
    outputTokens: current.outputTokens + (delta.outputTokens ?? 0),
    totalCost: current.totalCost + (delta.totalCost ?? 0),
  };
}
