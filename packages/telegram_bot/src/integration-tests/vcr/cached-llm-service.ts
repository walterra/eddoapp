/**
 * Cached LLM Service for VCR-style Testing
 *
 * Wraps the LLM service to enable recording/replaying responses.
 */
import {
  completeSimple,
  getModels,
  type Context,
  type Message,
  type Model,
} from '@mariozechner/pi-ai';

import type { AgentState } from '../../agent/simple-agent.js';
import type { LlmService } from '../../ai/llm-service.js';
import { appConfig } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import type { CassetteManager } from './cassette-manager.js';

export interface CachedLlmServiceConfig {
  cassetteManager: CassetteManager;
  /** Model to use for real API calls */
  model?: string;
}

interface PiAiMessageRole {
  role: 'user' | 'assistant';
  content: string;
}

/** Resolve Anthropic model from registry with safe fallback. */
function resolveAnthropicModel(modelId: string): Model<'anthropic-messages'> {
  const configuredModel = getModels('anthropic').find((model) => model.id === modelId);
  if (configuredModel) {
    return configuredModel;
  }

  return {
    id: modelId,
    name: modelId,
    api: 'anthropic-messages',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    reasoning: true,
    input: ['text', 'image'],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 200_000,
    maxTokens: 1000,
  };
}

/** Creates user message for pi-ai context. */
function createUserMessage(content: string, timestamp: number): Message {
  return {
    role: 'user',
    content,
    timestamp,
  };
}

/** Creates synthetic assistant message for prior conversation history. */
function createAssistantHistoryMessage(content: string, timestamp: number): Message {
  return {
    role: 'assistant',
    content: [{ type: 'text', text: content }],
    api: 'anthropic-messages',
    provider: 'anthropic',
    model: 'history',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'stop',
    timestamp,
  };
}

/** Maps string-only conversation history to pi-ai messages. */
function toPiAiMessages(messages: PiAiMessageRole[]): Message[] {
  return messages.map((message, index) => {
    const timestamp = Date.now() + index;
    return message.role === 'user'
      ? createUserMessage(message.content, timestamp)
      : createAssistantHistoryMessage(message.content, timestamp);
  });
}

/** Extract plain text content from assistant response blocks. */
function extractAssistantText(message: {
  content: Array<{ type: string; text?: string }>;
}): string {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text || '')
    .join('')
    .trim();
}

/** Make real model API call through pi-ai. */
async function makeModelApiCall(
  modelId: string,
  systemPrompt: string,
  messages: PiAiMessageRole[],
): Promise<string> {
  if (!appConfig.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY required for recording. Set VCR_MODE=playback to use cached responses.',
    );
  }

  logger.debug('Making real model API call', { model: modelId, messagesCount: messages.length });

  const model = resolveAnthropicModel(modelId);
  const context: Context = {
    systemPrompt,
    messages: toPiAiMessages(messages),
  };

  const response = await completeSimple(model, context, {
    apiKey: appConfig.ANTHROPIC_API_KEY,
    maxTokens: 1000,
  });

  if (response.stopReason === 'error' || response.stopReason === 'aborted') {
    throw new Error(response.errorMessage || `LLM request failed: ${response.stopReason}`);
  }

  const text = extractAssistantText(response);
  if (!text) {
    throw new Error('Unexpected response type from model');
  }

  return text;
}

/** Creates an LLM service that records/replays responses via cassette manager */
export function createCachedLlmService(config: CachedLlmServiceConfig): LlmService {
  const { cassetteManager, model = 'claude-3-5-haiku-20241022' } = config;

  async function generateResponse(
    conversationHistory: AgentState['history'],
    systemPrompt: string,
  ): Promise<string> {
    const messages = conversationHistory.map((msg) => ({ role: msg.role, content: msg.content }));
    return cassetteManager.handleInteraction(model, systemPrompt, messages, () =>
      makeModelApiCall(model, systemPrompt, messages),
    );
  }

  return { generateResponse };
}
