import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import type { DurableRuntime } from '@eddo/assistant-server/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getUrlHandlingSection } from './prompt_sections.js';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput } from './test_helpers.js';

vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi.fn().mockResolvedValue({
    username: 'alice',
    preferences: { mcpApiKey: 'secret' },
  }),
}));

const runtimes: DurableRuntime[] = [];
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
});

describe('Durable URL capture tool policy', () => {
  it('bridges fetch then create while retaining mutation protection', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.instructions = getUrlHandlingSection();
    fixture.options.client.tools = ['fetchUrl', 'createTodo'].map((name) => ({
      name,
      description: name,
      inputSchema: { type: 'object', additionalProperties: true },
    }));
    fixture.options.client.invoke = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({ data: { urlCaptureRef: 'reference', title: 'Page' } }),
      )
      .mockResolvedValueOnce(JSON.stringify({ summary: 'Created' }));
    fixture.provider.setResponses([
      fauxAssistantMessage(fauxToolCall('fetchUrl', { url: 'https://example.com' }), {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage(
        fauxToolCall('createTodo', { title: 'Page', urlCaptureRef: 'reference' }),
        { stopReason: 'toolUse' },
      ),
      fauxAssistantMessage('Saved Page.'),
    ]);
    const runtime = await openDurableRuntime(fixture.options);
    runtimes.push(runtime);
    expect(await runtime.execute(createTestInput({ text: 'https://example.com' }))).toBe(
      'Saved Page.',
    );
    expect(fixture.options.client.invoke).toHaveBeenNthCalledWith(
      1,
      'fetchUrl',
      { url: 'https://example.com' },
      expect.not.objectContaining({ operationId: expect.any(String) }),
    );
    expect(fixture.options.client.invoke).toHaveBeenNthCalledWith(
      2,
      'createTodo',
      { title: 'Page', urlCaptureRef: 'reference' },
      expect.objectContaining({ operationId: expect.any(String) }),
    );
  });

  it('denies external URL fetching from scheduled reports', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.client.tools = [
      {
        name: 'fetchUrl',
        description: 'Fetch',
        inputSchema: { type: 'object', properties: {} },
      },
    ];
    fixture.provider.setResponses([
      fauxAssistantMessage(fauxToolCall('fetchUrl', {}), { stopReason: 'toolUse' }),
    ]);
    const runtime = await openDurableRuntime(fixture.options);
    runtimes.push(runtime);
    await runtime
      .execute(
        createTestInput({
          report: { type: 'briefing', occurrence: 'url-policy-test' },
        }),
      )
      .catch(() => undefined);
    expect(fixture.provider.state.callCount).toBe(1);
    expect(fixture.options.client.invoke).not.toHaveBeenCalled();
  });
});
