import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it, vi } from 'vitest';
import type { MCPUserContext } from '../mcp/user-context.js';
import { createMCPHeaders } from '../mcp/user-context.js';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput } from './test_helpers.js';

vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi
    .fn()
    .mockResolvedValue({ username: 'alice', preferences: { mcpApiKey: 'secret' } }),
}));

describe('durable MCP command identity', () => {
  it('derives unique command IDs from persisted tool tasks rather than model arguments', async () => {
    const fixture = await createRuntimeFixture();
    fixture.options.client.tools = [
      {
        name: 'createTodo',
        description: 'Create',
        inputSchema: { type: 'object', properties: { operationId: { type: 'string' } } },
      },
    ];
    const contexts: MCPUserContext[] = [];
    fixture.options.client.invoke = vi.fn(
      async (_tool: string, _args: Record<string, unknown>, user?: MCPUserContext) => {
        if (!user) throw new Error('No user');
        contexts.push(user);
        return 'Created';
      },
    );
    fixture.provider.setResponses([
      fauxAssistantMessage(fauxToolCall('createTodo', { operationId: 'model-selected' }), {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage('Done'),
      fauxAssistantMessage(fauxToolCall('createTodo', { operationId: 'model-selected' }), {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage('Done again'),
    ]);
    const runtime = await openDurableRuntime(fixture.options);
    try {
      await runtime.execute(createTestInput());
      await runtime.execute(createTestInput());
      await runtime.execute(createTestInput({ requestId: 'telegram:second' }));
      expect(contexts).toHaveLength(2);
      expect(contexts[0].operationId).toMatch(/^[a-f0-9]{64}$/);
      expect(contexts[1].operationId).not.toBe(contexts[0].operationId);
      expect(createMCPHeaders(contexts[0])['x-eddo-operation-id']).toBe(contexts[0].operationId);
    } finally {
      await runtime.close();
    }
  });

  it('does not collide when two independent journals reuse the same numeric task IDs', async () => {
    const identifiers: string[] = [];
    for (let index = 0; index < 2; index += 1) {
      const fixture = await createRuntimeFixture();
      fixture.options.client.tools = [
        {
          name: 'createTodo',
          description: 'Create',
          inputSchema: { type: 'object', properties: {} },
        },
      ];
      fixture.options.client.invoke = vi.fn(
        async (_name: string, _args: Record<string, unknown>, user?: MCPUserContext) => {
          if (!user?.operationId) throw new Error('Missing operation ID');
          identifiers.push(user.operationId);
          return 'Created';
        },
      );
      fixture.provider.setResponses([
        fauxAssistantMessage(fauxToolCall('createTodo', {}), { stopReason: 'toolUse' }),
        fauxAssistantMessage('Done'),
      ]);
      const runtime = await openDurableRuntime(fixture.options);
      try {
        await runtime.execute(createTestInput());
      } finally {
        await runtime.close();
      }
    }
    expect(new Set(identifiers).size).toBe(2);
  });

  it('does not add a command header to ordinary read/authentication contexts', () => {
    expect(
      createMCPHeaders({ username: 'alice', telegramId: 123, mcpApiKey: 'secret' }),
    ).not.toHaveProperty('x-eddo-operation-id');
  });
});
