import { getRandomHex } from '@eddo/core-shared';
import {
  getModels,
  streamSimple,
  type AssistantMessage,
  type Context,
  type Message,
  type Model,
} from '@mariozechner/pi-ai';

import type { AgentState } from '../agent/simple-agent.js';
import { appConfig } from '../utils/config.js';
import { logger, withSpan } from '../utils/logger.js';

const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';
const MAX_TOKENS = 1000;

interface SpanWriter {
  setAttribute: (key: string, value: string | number) => void;
}

interface ClaudeRequestParams {
  requestId: string;
  modelId: string;
  conversationHistory: AgentState['history'];
  systemPrompt: string;
  span: SpanWriter;
}

interface UsageSummary {
  input: number;
  output: number;
}

export interface ClaudeService {
  generateResponse: (
    conversationHistory: AgentState['history'],
    systemPrompt: string,
  ) => Promise<string>;
}

/** Resolves Anthropic model metadata from pi-ai registry with safe fallback. */
function createAnthropicModel(modelId: string): Model<'anthropic-messages'> {
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
    maxTokens: MAX_TOKENS,
  };
}

/** Creates a user message for pi-ai context. */
function createUserMessage(content: string, timestamp: number): Message {
  return {
    role: 'user',
    content,
    timestamp,
  };
}

/** Creates a synthetic assistant message for prior conversation turns. */
function createAssistantHistoryMessage(content: string, timestamp: number): AssistantMessage {
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

/** Maps agent history entries to pi-ai context messages. */
function mapHistoryToMessages(history: AgentState['history']): Message[] {
  return history.map((message, index) => {
    const timestamp = message.timestamp || Date.now() + index;
    return message.role === 'user'
      ? createUserMessage(message.content, timestamp)
      : createAssistantHistoryMessage(message.content, timestamp);
  });
}

/** Builds pi-ai context from agent history and system prompt. */
function createContext(history: AgentState['history'], systemPrompt: string): Context {
  return {
    systemPrompt,
    messages: mapHistoryToMessages(history),
  };
}

/** Extracts plain text from assistant content blocks. */
function extractText(message: AssistantMessage): string {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();
}

/** Extracts token usage from final assistant message. */
function extractUsage(message: AssistantMessage): UsageSummary {
  return {
    input: message.usage.input,
    output: message.usage.output,
  };
}

/** Creates Claude service implementation backed by pi-ai streaming API. */
function createClaudeService(): ClaudeService {
  return {
    generateResponse: async (
      conversationHistory: AgentState['history'],
      systemPrompt: string,
    ): Promise<string> => {
      const modelId = appConfig.LLM_MODEL || DEFAULT_MODEL;

      return withSpan(
        'llm_generate',
        {
          'llm.model': modelId,
          'llm.messages_count': conversationHistory.length,
          'llm.system_prompt_length': systemPrompt.length,
        },
        async (span) => {
          const requestId = `req_${Date.now()}_${getRandomHex(9)}`;
          return executeRequest({
            requestId,
            modelId,
            conversationHistory,
            systemPrompt,
            span,
          });
        },
      );
    },
  };
}

/** Logs request metadata for the model call. */
function logLlmRequest(params: ClaudeRequestParams): void {
  const { requestId, modelId, conversationHistory, systemPrompt } = params;
  logger.info('🤖 LLM Request', {
    requestId,
    model: modelId,
    systemPrompt,
    conversationHistory,
    historyLength: conversationHistory.length,
    systemPromptLength: systemPrompt.length,
  });
}

/** Streams a response and returns the final assistant message. */
async function streamAndGetFinalMessage(
  requestId: string,
  model: Model<'anthropic-messages'>,
  context: Context,
): Promise<AssistantMessage> {
  const responseStream = streamSimple(model, context, {
    apiKey: appConfig.ANTHROPIC_API_KEY,
    maxTokens: MAX_TOKENS,
  });

  for await (const event of responseStream) {
    if (event.type === 'error') {
      logger.warn('🤖 LLM stream event error', {
        requestId,
        reason: event.reason,
        errorMessage: event.error.errorMessage,
      });
    }
  }

  return responseStream.result();
}

/** Validates final message and returns extracted response text. */
function getResponseTextFromFinalMessage(message: AssistantMessage): string {
  if (message.stopReason === 'error' || message.stopReason === 'aborted') {
    throw new Error(message.errorMessage || `LLM request failed: ${message.stopReason}`);
  }

  const responseText = extractText(message);
  if (!responseText) {
    throw new Error('Unexpected empty text response from model');
  }
  return responseText;
}

/** Writes token usage attributes to tracing span. */
function setUsageSpanAttributes(span: SpanWriter, responseText: string, usage: UsageSummary): void {
  span.setAttribute('llm.response_length', responseText.length);
  span.setAttribute('llm.input_tokens', usage.input);
  span.setAttribute('llm.output_tokens', usage.output);
}

/** Executes one model request and returns assistant text response. */
async function executeRequest(params: ClaudeRequestParams): Promise<string> {
  const { requestId, modelId, conversationHistory, systemPrompt, span } = params;

  try {
    logLlmRequest(params);

    const model = createAnthropicModel(modelId);
    const context = createContext(conversationHistory, systemPrompt);
    const finalMessage = await streamAndGetFinalMessage(requestId, model, context);
    const responseText = getResponseTextFromFinalMessage(finalMessage);
    const usage = extractUsage(finalMessage);

    setUsageSpanAttributes(span, responseText, usage);

    logger.info('🤖 LLM Response', {
      requestId,
      response: responseText,
      responseLength: responseText.length,
      usage,
      stopReason: finalMessage.stopReason,
    });

    return responseText;
  } catch (error) {
    logger.error('Failed to generate Claude response', { error });
    throw new Error(`Claude API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

let serviceInstance: ClaudeService | null = null;

export const claudeService: ClaudeService = {
  generateResponse: async (conversationHistory, systemPrompt) => {
    if (!serviceInstance) {
      serviceInstance = createClaudeService();
      logger.info('Simple Claude service initialized');
    }
    return serviceInstance.generateResponse(conversationHistory, systemPrompt);
  },
};
