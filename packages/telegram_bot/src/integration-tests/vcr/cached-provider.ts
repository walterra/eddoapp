import {
  createAssistantMessageEventStream,
  fauxAssistantMessage,
  fauxProvider,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Model,
  type Models,
  type Provider,
  type SimpleStreamOptions,
  type TranscriptContext,
} from '@earendil-works/pi-ai';
import { z } from 'zod';
import type { CassetteManager } from './cassette-manager.js';

export interface LlmRequestSnapshot {
  messages: Array<{ role: string; content: string }>;
  sessionId?: string;
}
export interface CachedProviderOptions {
  source: Models;
  provider: Provider;
  cassetteManager: CassetteManager;
  onRequest?: (request: LlmRequestSnapshot) => void;
}
interface ProviderRequest {
  model: Model<string>;
  context: TranscriptContext;
  options?: SimpleStreamOptions;
}

const VOLATILE_FIELDS = new Set(['timestamp', 'durationMs', 'usage', 'responseId']);
const responseSchema = z.object({
  format: z.literal('pi-durable-assistant-v1'),
  message: z.custom<AssistantMessage>((value) => {
    if (!value || typeof value !== 'object') return false;
    const message = value as Partial<AssistantMessage>;
    return (
      message.role === 'assistant' &&
      Array.isArray(message.content) &&
      typeof message.stopReason === 'string' &&
      typeof message.model === 'string' &&
      typeof message.provider === 'string' &&
      typeof message.api === 'string' &&
      typeof message.timestamp === 'number' &&
      Boolean(message.usage)
    );
  }),
});

/** Hashes native message/tool schemas without provider accounting or wall-clock noise. */
function requestMessages(context: TranscriptContext): LlmRequestSnapshot['messages'] {
  return context.messages.map((message) => ({
    role: message.role,
    content: JSON.stringify(message, (key, value: unknown) =>
      VOLATILE_FIELDS.has(key) ? undefined : value,
    ),
  }));
}

/** Records complete native assistant messages, including tool calls and structured arguments. */
async function recordedResponse(
  config: CachedProviderOptions,
  request: ProviderRequest,
): Promise<AssistantMessage> {
  const messages = requestMessages(request.context);
  config.onRequest?.({ messages, sessionId: request.options?.sessionId });
  const serialized = await config.cassetteManager.handleInteraction(
    `${request.model.provider}/${request.model.id}`,
    `Pi Durable native transcript v1; system messages include tool schemas.\nGeneration options: ${JSON.stringify({ maxTokens: request.options?.maxTokens ?? null, reasoning: request.options?.reasoning ?? 'off' })}`,
    messages,
    async () => {
      // The source collection resolves real credentials only on a record/missing-auto interaction.
      const message = await config.source
        .streamSimple(request.model, request.context, request.options)
        .result();
      if (
        message.stopReason === 'error' ||
        message.stopReason === 'aborted' ||
        message.stopReason === 'pending'
      )
        throw new Error(message.errorMessage || `Model request ${message.stopReason}`);
      return JSON.stringify({ format: 'pi-durable-assistant-v1', message });
    },
  );
  return decodeResponse(serialized);
}

function decodeResponse(serialized: string): AssistantMessage {
  try {
    return responseSchema.parse(JSON.parse(serialized)).message;
  } catch {
    throw new Error(
      'Cassette is not a native Durable assistant response; re-record it with the Durable VCR harness.',
    );
  }
}

function publishMessage(stream: AssistantMessageEventStream, message: AssistantMessage): void {
  if (message.stopReason === 'pending')
    throw new Error('VCR requires a terminal assistant response');
  if (message.stopReason === 'error' || message.stopReason === 'aborted') {
    stream.push({ type: 'error', reason: message.stopReason, error: message });
  } else {
    stream.push({ type: 'start', partial: message });
    stream.push({ type: 'done', reason: message.stopReason, message });
  }
  stream.end();
}

/** Uses a terminal stream for both record and replay; partial streaming remains covered by Harness tests. */
function cachedStream(
  config: CachedProviderOptions,
  request: ProviderRequest,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  void recordedResponse(config, request)
    .then((message) => {
      request.options?.signal?.throwIfAborted();
      publishMessage(stream, message);
    })
    .catch((error: unknown) => {
      const aborted = request.options?.signal?.aborted;
      const message = fauxAssistantMessage('', {
        stopReason: aborted ? 'aborted' : 'error',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      publishMessage(stream, {
        ...message,
        api: request.model.api,
        provider: request.model.provider,
        model: request.model.id,
      });
    });
  return stream;
}

/** Wraps the provider boundary without altering production model access or the Durable agent loop. */
export function createCachedProvider(config: CachedProviderOptions): Provider {
  return {
    ...config.provider,
    // Playback must reach the cassette even without credentials. Real calls use the original collection.
    auth: fauxProvider().provider.auth,
    stream: () => {
      throw new Error('Durable VCR supports streamSimple, not provider-specific stream options');
    },
    fetchDeferred: undefined,
    cancelDeferred: undefined,
    generateImages: undefined,
    classify: undefined,
    streamSimple: (model, context, options) => cachedStream(config, { model, context, options }),
  };
}
