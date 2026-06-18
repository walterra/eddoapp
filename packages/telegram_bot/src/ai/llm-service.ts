import { getRandomHex } from '@eddo/core-shared';
import {
  getEnvApiKey,
  streamSimple,
  type Api,
  type AssistantMessage,
  type Context,
  type Message,
  type Model,
  type Provider,
} from '@mariozechner/pi-ai';

import type { AgentState } from '../agent/simple-agent.js';
import { appConfig } from '../utils/config.js';
import { logger, withSpan } from '../utils/logger.js';
import { resolveConfiguredModel } from './llm-model-resolution.js';
import { createLlmOptions } from './llm-options.js';

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';

interface SpanWriter {
  setAttribute: (key: string, value: string | number) => void;
}

interface LlmRequestParams {
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

export interface LlmService {
  generateResponse: (
    conversationHistory: AgentState['history'],
    systemPrompt: string,
  ) => Promise<string>;
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
function createAssistantHistoryMessage(
  content: string,
  timestamp: number,
  targetModel: Model<Api>,
): AssistantMessage {
  return {
    role: 'assistant',
    content: [{ type: 'text', text: content }],
    api: targetModel.api,
    provider: targetModel.provider,
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
function mapHistoryToMessages(history: AgentState['history'], targetModel: Model<Api>): Message[] {
  return history.map((message, index) => {
    const timestamp = message.timestamp || Date.now() + index;
    return message.role === 'user'
      ? createUserMessage(message.content, timestamp)
      : createAssistantHistoryMessage(message.content, timestamp, targetModel);
  });
}

/** Builds pi-ai context from agent history and system prompt. */
function createContext(
  history: AgentState['history'],
  systemPrompt: string,
  targetModel: Model<Api>,
): Context {
  return {
    systemPrompt,
    messages: mapHistoryToMessages(history, targetModel),
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

/** Creates LLM service implementation backed by pi-ai streaming API. */
function createLlmService(): LlmService {
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
function logLlmRequest(params: LlmRequestParams): void {
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
  model: Model<Api>,
  context: Context,
): Promise<AssistantMessage> {
  const apiKey = getEnvApiKey(model.provider as Provider);
  if (!apiKey) {
    throw new Error(`No API key for provider: ${model.provider}`);
  }

  const responseStream = streamSimple(model, context, createLlmOptions(model, apiKey));

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
async function executeRequest(params: LlmRequestParams): Promise<string> {
  const { requestId, modelId, conversationHistory, systemPrompt, span } = params;

  try {
    logLlmRequest(params);

    const resolved = resolveConfiguredModel(modelId);
    const context = createContext(conversationHistory, systemPrompt, resolved.model);
    const finalMessage = await streamAndGetFinalMessage(requestId, resolved.model, context);
    const responseText = getResponseTextFromFinalMessage(finalMessage);
    const usage = extractUsage(finalMessage);

    setUsageSpanAttributes(span, responseText, usage);

    logger.info('🤖 LLM Response', {
      requestId,
      provider: resolved.provider,
      response: responseText,
      responseLength: responseText.length,
      usage,
      stopReason: finalMessage.stopReason,
    });

    return responseText;
  } catch (error) {
    logger.error('Failed to generate LLM response', { error });
    throw new Error(`LLM API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

let serviceInstance: LlmService | null = null;

export const llmService: LlmService = {
  generateResponse: async (conversationHistory, systemPrompt) => {
    if (!serviceInstance) {
      serviceInstance = createLlmService();
      logger.info('Simple LLM service initialized');
    }
    return serviceInstance.generateResponse(conversationHistory, systemPrompt);
  },
};
