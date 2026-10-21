import type { AssistantMessage, AssistantMessageEventStream, Models } from '@earendil-works/pi-ai';
import { getTracer } from '@eddo/core-instrumentation';
import { SpanStatusCode, type Attributes, type Span } from '@opentelemetry/api';

type StreamRecorder = (span: Span, message: AssistantMessage) => void;

/** Records provider outcome without exporting response content or diagnostics. */
function recordStatus(span: Span, message: AssistantMessage): void {
  if (message.stopReason === 'error' || message.stopReason === 'aborted') {
    span.recordException(new Error(`Model response ended with ${message.stopReason}`));
    span.setStatus({ code: SpanStatusCode.ERROR });
  } else span.setStatus({ code: SpanStatusCode.OK });
}

/** Records response accounting without exporting model content or provider diagnostics. */
function recordResponse(span: Span, message: AssistantMessage): void {
  span.setAttributes({
    'llm.stop_reason': message.stopReason,
    'llm.input_tokens': message.usage.input,
    'llm.output_tokens': message.usage.output,
    'llm.cache_read_tokens': message.usage.cacheRead,
    'llm.cache_write_tokens': message.usage.cacheWrite,
    'llm.total_tokens': message.usage.totalTokens,
    'llm.estimated_cost_usd': message.usage.cost.total,
    'llm.response_length': message.content.reduce(
      (length, block) => length + (block.type === 'text' ? block.text.length : 0),
      0,
    ),
    'agent.tool_calls': message.content.filter((block) => block.type === 'toolCall').length,
  });
  recordStatus(span, message);
}

/** Ends tracing with the original response promise; telemetry failures never reject the caller's stream. */
function observeResult(
  stream: AssistantMessageEventStream,
  span: Span,
  record: StreamRecorder,
): void {
  void stream
    .result()
    .then(
      (message) => {
        try {
          record(span, message);
        } finally {
          span.end();
        }
      },
      () => {
        try {
          span.recordException(new Error('Model stream failed'));
          span.setStatus({ code: SpanStatusCode.ERROR });
        } finally {
          span.end();
        }
      },
    )
    .catch(() => undefined);
}

/** Observes the original stream without replacing events, buffering content, or altering cancellation. */
function traceStream(
  name: string,
  attributes: Attributes,
  start: () => AssistantMessageEventStream,
  record: StreamRecorder = recordStatus,
): AssistantMessageEventStream {
  return getTracer('eddo-telegram-bot').startActiveSpan(name, { attributes }, (span) => {
    try {
      const stream = start();
      observeResult(stream, span, record);
      return stream;
    } catch (error) {
      span.recordException(new Error('Model request setup failed'));
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      throw error;
    }
  });
}

/** Counts model rounds since the most recent user input; provider retries share their round number. */
function iteration(context: Parameters<Models['streamSimple']>[1]): number {
  let result = 1;
  for (let index = context.messages.length - 1; index >= 0; index -= 1) {
    const message = context.messages[index];
    if (message.role === 'user') break;
    if (message.role === 'assistant') result += 1;
  }
  return result;
}

/** Adds response-lifetime model spans to generation, compaction, and deferred response retrieval. */
export function modelsWithTelemetry(models: Models, attributes: Attributes = {}): Models {
  const streamSimple: Models['streamSimple'] = (model, context, options) =>
    traceStream(
      'agent_iteration',
      {
        ...attributes,
        'agent.iteration': iteration(context),
        'agent.iteration.kind': 'model_request',
      },
      () =>
        traceStream(
          'llm_generate',
          {
            ...attributes,
            'llm.provider': model.provider,
            'llm.model': model.id,
            'llm.operation': 'generate',
            'llm.messages_count': context.messages.length,
          },
          () => models.streamSimple(model, context, options),
          recordResponse,
        ),
    );
  const streamDeferred: Models['streamDeferred'] = (model, handle, options) =>
    traceStream(
      'llm_generate',
      {
        ...attributes,
        'llm.provider': model.provider,
        'llm.model': model.id,
        'llm.operation': 'deferred_fetch',
      },
      () => models.streamDeferred(model, handle, options),
      recordResponse,
    );
  const completeSimple: Models['completeSimple'] = (model, context, options) =>
    streamSimple(model, context, options).result();
  const fetchDeferred: Models['fetchDeferred'] = (model, handle, options) =>
    streamDeferred(model, handle, options).result();
  const methods = { streamSimple, completeSimple, streamDeferred, fetchDeferred };
  return new Proxy(models, {
    get(target, property): unknown {
      if (typeof property === 'string' && Object.hasOwn(methods, property))
        return methods[property as keyof typeof methods];
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
