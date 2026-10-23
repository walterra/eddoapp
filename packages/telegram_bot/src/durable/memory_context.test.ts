import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it, vi } from 'vitest';
import { loadMemoryContext } from './memory_context.js';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput } from './test_helpers.js';

const user = { username: 'alice', telegramId: 7, mcpApiKey: 'secret' };

describe('automatic memory context', () => {
  it('fetches only memories with the current user credentials and bounds the result', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValue([{ type: 'text', text: 'Planning rule '.repeat(3000) }]);
    const result = await loadMemoryContext({ invoke }, user);
    expect(invoke).toHaveBeenCalledExactlyOnceWith('getServerInfo', { section: 'memories' }, user);
    expect(result).toContain('Planning rule');
    expect(result.length).toBeLessThan(6500);
  });

  it('uses an explicit unavailable message without exposing transport errors', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('private credentials'));
    expect(await loadMemoryContext({ invoke }, user)).toBe('Stored user memories are unavailable.');
  });

  it('refreshes memory context between requests without requiring a model tool call', async () => {
    const fixture = await createRuntimeFixture();
    let memory = 'Prefer mornings for planning.';
    const memoryContext = vi.fn(async () => memory);
    fixture.provider.setResponses([
      (context) => {
        expect(JSON.stringify(context)).toContain(memory);
        return fauxAssistantMessage('Morning planning noted.');
      },
      (context) => {
        expect(JSON.stringify(context)).toContain(memory);
        return fauxAssistantMessage('Evening planning noted.');
      },
    ]);
    const runtime = await openDurableRuntime({ ...fixture.options, memoryContext });
    try {
      await runtime.execute(createTestInput());
      memory = 'Prefer evenings for planning.';
      await runtime.execute(createTestInput({ requestId: 'telegram:second' }));
      expect(memoryContext).toHaveBeenCalledTimes(2);
    } finally {
      await runtime.close();
    }
  });
});
