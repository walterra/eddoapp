import { createModels } from '@earendil-works/pi-ai/models';
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';
import { modelsWithTelemetry } from '@eddo/assistant-server/models_with_telemetry';
import type { Attributes, Span } from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openDurableRuntime } from '../durable/runtime.js';
import { createRuntimeFixture, createTestInput, deferred } from '../durable/test_helpers.js';
import { invokeMcpTool } from '../durable/tool_execution.js';

interface RecordedSpan {
  name: string;
  attributes: Attributes;
  parent?: string;
  span: {
    setAttribute: ReturnType<typeof vi.fn>;
    setAttributes: ReturnType<typeof vi.fn>;
    setStatus: ReturnType<typeof vi.fn>;
    recordException: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
}
const records = vi.hoisted(() => ({
  spans: [] as RecordedSpan[],
  active: undefined as string | undefined,
}));
vi.mock('@eddo/core-instrumentation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@eddo/core-instrumentation')>()),
  getTracer: () => ({
    startActiveSpan: (
      name: string,
      options: { attributes: Attributes },
      action: (span: Span) => unknown,
    ) => {
      const span = {
        setAttribute: vi.fn(),
        setAttributes: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      };
      const parent = records.active;
      records.spans.push({ name, attributes: options.attributes, parent, span });
      records.active = name;
      try {
        return action(span as unknown as Span);
      } finally {
        records.active = parent;
      }
    },
  }),
}));

vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi.fn().mockResolvedValue({
    username: 'alice',
    preferences: { mcpApiKey: 'secret' },
  }),
}));

beforeEach(() => {
  records.spans.length = 0;
});

function source() {
  const provider = fauxProvider({ models: [{ id: 'test' }] });
  const models = createModels();
  models.setProvider(provider.provider);
  return { provider, models, model: provider.getModel() };
}

function span(name: string): RecordedSpan {
  const result = records.spans.find((record) => record.name === name);
  if (!result) throw new Error(`Missing span ${name}`);
  return result;
}

describe('Durable model and tool telemetry', () => {
  it('observes the original live stream and records usage without changing events or cancellation', async () => {
    const test = source();
    const gate = deferred();
    const signal = new AbortController().signal;
    test.provider.setResponses([
      async (_context, options) => {
        expect(options?.signal).toBe(signal);
        await gate.promise;
        const result = fauxAssistantMessage('private response');
        result.usage = {
          ...result.usage,
          input: 11,
          output: 7,
          cacheRead: 3,
          cacheWrite: 2,
          totalTokens: 23,
        };
        return result;
      },
    ]);
    const original = vi.spyOn(test.models, 'streamSimple');
    const models = modelsWithTelemetry(test.models, { 'user.id': '123' });
    const stream = models.streamSimple(
      test.model,
      { messages: [{ role: 'user', content: 'private prompt', timestamp: 1 }] },
      { signal },
    );
    expect(stream).toBe(original.mock.results[0].value);
    expect(span('llm_generate').span.end).not.toHaveBeenCalled();
    const events: string[] = [];
    const consuming = (async () => {
      for await (const event of stream) events.push(event.type);
    })();
    gate.resolve();
    const response = await stream.result();
    expect(response.stopReason).toBe('stop');
    await consuming;
    expect(events).toContain('done');
    expect(span('llm_generate').parent).toBe('agent_iteration');
    expect(span('llm_generate').span.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        'llm.input_tokens': response.usage.input,
        'llm.output_tokens': response.usage.output,
        'llm.cache_read_tokens': response.usage.cacheRead,
        'llm.total_tokens': response.usage.totalTokens,
      }),
    );
    expect(span('llm_generate').span.end).toHaveBeenCalledOnce();
    expect(JSON.stringify(records.spans.map((record) => record.attributes))).not.toContain(
      'private',
    );
  });

  it.each(['error', 'aborted'] as const)(
    'records %s status without exporting provider diagnostics',
    async (stopReason) => {
      const test = source();
      test.provider.setResponses([
        fauxAssistantMessage('', { stopReason, errorMessage: 'private provider credentials' }),
      ]);
      const result = await modelsWithTelemetry(test.models).completeSimple(test.model, {
        messages: [],
      });
      await Promise.resolve();
      expect(result.stopReason).toBe(stopReason);
      expect(span('llm_generate').span.setStatus).toHaveBeenLastCalledWith({
        code: SpanStatusCode.ERROR,
      });
      expect(span('agent_iteration').span.end).toHaveBeenCalledOnce();
      expect(String(span('llm_generate').span.recordException.mock.calls[0][0])).not.toContain(
        'private',
      );
    },
  );

  it('retains synchronous provider failures and closes both spans', () => {
    const test = source();
    const failure = new Error('private setup credentials');
    vi.spyOn(test.models, 'streamSimple').mockImplementation(() => {
      throw failure;
    });
    expect(() =>
      modelsWithTelemetry(test.models).streamSimple(test.model, { messages: [] }),
    ).toThrow(failure);
    expect(records.spans).toHaveLength(2);
    for (const record of records.spans) expect(record.span.end).toHaveBeenCalledOnce();
    expect(String(span('llm_generate').span.recordException.mock.calls[0][0])).not.toContain(
      'private',
    );
  });

  it('traces deferred retrieval without wrapping completion twice', async () => {
    const test = source();
    test.provider.setResponses([fauxAssistantMessage('Deferred result')]);
    const models = modelsWithTelemetry(test.models);
    const pending = await models.completeSimple(test.model, { messages: [] }, { deferred: true });
    expect(pending.stopReason).toBe('deferred');
    if (!pending.deferred) throw new Error('Missing deferred handle');
    expect((await models.fetchDeferred(test.model, pending.deferred)).stopReason).toBe('stop');
    const generations = records.spans.filter((record) => record.name === 'llm_generate');
    expect(generations.map((record) => record.attributes['llm.operation'])).toEqual([
      'generate',
      'deferred_fetch',
    ]);
    for (const record of records.spans) expect(record.span.end).toHaveBeenCalledOnce();
  });

  it('does not fail model execution when response accounting throws', async () => {
    const test = source();
    const gate = deferred();
    test.provider.setResponses([
      async () => {
        await gate.promise;
        return fauxAssistantMessage('Done');
      },
    ]);
    const stream = modelsWithTelemetry(test.models).streamSimple(test.model, { messages: [] });
    span('llm_generate').span.setAttributes.mockImplementationOnce(() => {
      throw new Error('Telemetry unavailable');
    });
    gate.resolve();
    expect((await stream.result()).stopReason).toBe('stop');
    expect(span('llm_generate').span.end).toHaveBeenCalledOnce();
    await Promise.resolve();
  });

  it('instruments actual Durable generation through its configured model wrapper', async () => {
    const fixture = await createRuntimeFixture();
    fixture.provider.setResponses([fauxAssistantMessage('Done')]);
    const runtime = await openDurableRuntime(fixture.options);
    try {
      await runtime.execute(createTestInput());
      expect(span('llm_generate').attributes).toMatchObject({
        'user.id': '123',
        'llm.operation': 'generate',
      });
      expect(span('agent_iteration').span.end).toHaveBeenCalledOnce();
    } finally {
      await runtime.close();
    }
  });

  it('traces actual bridged tools and advances model-round accounting', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.client.tools = [
      {
        name: 'getTodo',
        description: 'Fetch task',
        inputSchema: { type: 'object', properties: {} },
      },
    ];
    fixture.options.client.invoke = vi.fn().mockResolvedValue('Task');
    fixture.provider.setResponses([
      fauxAssistantMessage(fauxToolCall('getTodo', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage('Done'),
    ]);
    const runtime = await openDurableRuntime(fixture.options);
    try {
      await runtime.execute(createTestInput());
      expect(span('mcp_tool_execute').attributes).toMatchObject({
        'mcp.tool': 'getTodo',
        'user.id': '123',
      });
      expect(span('mcp_tool_execute').span.end).toHaveBeenCalledOnce();
      expect(
        records.spans
          .filter((record) => record.name === 'agent_iteration')
          .map((record) => record.attributes['agent.iteration']),
      ).toEqual([1, 2]);
    } finally {
      await runtime.close();
    }
  });

  it.each([false, true])(
    'records MCP protocol error=%s without exporting arguments or returned data',
    async (isError) => {
      const invoke = vi
        .fn()
        .mockResolvedValue({ content: [{ type: 'text', text: 'private task data' }], isError });
      const user = { username: 'alice', telegramId: 123, mcpApiKey: 'private key' };
      const args = { title: 'private title' };
      const result = await invokeMcpTool({ invoke }, 'getTodo', args, user);
      expect(result.isError).toBe(isError);
      expect(invoke).toHaveBeenCalledExactlyOnceWith('getTodo', args, user);
      expect(span('mcp_tool_execute').span.setStatus).toHaveBeenLastCalledWith({
        code: isError ? SpanStatusCode.ERROR : SpanStatusCode.OK,
      });
      expect(span('mcp_tool_execute').span.end).toHaveBeenCalledOnce();
      expect(JSON.stringify(span('mcp_tool_execute').attributes)).not.toContain('private');
    },
  );

  it('retains MCP transport exceptions while exporting a sanitized failure', async () => {
    const failure = new Error('private transport credentials');
    await expect(
      invokeMcpTool(
        { invoke: vi.fn().mockRejectedValue(failure) },
        'getTodo',
        {},
        { username: 'alice', telegramId: 123, mcpApiKey: 'secret' },
      ),
    ).rejects.toBe(failure);
    expect(span('mcp_tool_execute').span.end).toHaveBeenCalledOnce();
    expect(String(span('mcp_tool_execute').span.recordException.mock.calls[0][0])).not.toContain(
      'private',
    );
  });
});
