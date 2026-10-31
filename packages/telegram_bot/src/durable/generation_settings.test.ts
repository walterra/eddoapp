import type { SimpleStreamOptions } from '@earendil-works/pi-ai';
import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import type { DurableRuntime } from '@eddo/assistant-server/runtime';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput } from './test_helpers.js';

vi.mock('../utils/user-lookup.js', () => ({ lookupUserByTelegramId: vi.fn() }));
const runtimes: DurableRuntime[] = [];
beforeEach(() => {
  vi.stubEnv('LLM_MAX_TOKENS', undefined);
  vi.stubEnv('LLM_REASONING_EFFORT', undefined);
});
afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
  vi.unstubAllEnvs();
});
async function open(options: Parameters<typeof openDurableRuntime>[0]): Promise<DurableRuntime> {
  const runtime = await openDurableRuntime(options);
  runtimes.push(runtime);
  return runtime;
}

describe('generation settings through the real Harness', () => {
  it('sends 4096 tokens and low reasoning for new reasoning-capable conversations', async () => {
    const fixture = await createRuntimeFixture({ reasoning: true, maxTokens: 8192 });
    fixture.provider.setResponses([
      (_context, options) => {
        expect(options).toMatchObject({ maxTokens: 4096, reasoning: 'low' });
        return fauxAssistantMessage('Default settings');
      },
    ]);
    const runtime = await open(fixture.options);
    expect(await runtime.execute(createTestInput())).toBe('Default settings');
  });

  it('honors environment overrides and caps them at the selected model limit', async () => {
    vi.stubEnv('LLM_MAX_TOKENS', '8192');
    vi.stubEnv('LLM_REASONING_EFFORT', 'HIGH');
    const fixture = await createRuntimeFixture({ reasoning: true, maxTokens: 2048 });
    fixture.provider.setResponses([
      (_context, options) => {
        expect(options).toMatchObject({ maxTokens: 2048, reasoning: 'high' });
        return fauxAssistantMessage('Configured settings');
      },
    ]);
    const runtime = await open(fixture.options);
    expect(await runtime.execute(createTestInput())).toBe('Configured settings');
  });

  it('keeps reasoning disabled for non-reasoning models', async () => {
    vi.stubEnv('LLM_REASONING_EFFORT', 'max');
    const fixture = await createRuntimeFixture({ reasoning: false, maxTokens: 1024 });
    fixture.provider.setResponses([
      (_context, options) => {
        expect(options?.maxTokens).toBe(1024);
        expect(options?.reasoning).toBeUndefined();
        return fauxAssistantMessage('No thinking');
      },
    ]);
    const runtime = await open(fixture.options);
    expect(await runtime.execute(createTestInput())).toBe('No thinking');
  });

  it('applies changed reasoning and limits to existing conversations after reopen', async () => {
    const fixture = await createRuntimeFixture({ reasoning: true, maxTokens: 8192 });
    const seen: Array<SimpleStreamOptions | undefined> = [];
    fixture.provider.setResponses([
      (_context, options) => {
        seen.push(options);
        return fauxAssistantMessage('First answer');
      },
      (context, options) => {
        expect(JSON.stringify(context.messages)).toContain('First answer');
        seen.push(options);
        return fauxAssistantMessage('Second answer');
      },
    ]);
    const first = await open(fixture.options);
    await first.execute(createTestInput());
    await first.close();
    vi.stubEnv('LLM_MAX_TOKENS', '1000');
    vi.stubEnv('LLM_REASONING_EFFORT', 'high');
    const second = await open(await fixture.reopen());
    expect(await second.execute(createTestInput({ requestId: 'telegram:new-settings' }))).toBe(
      'Second answer',
    );
    expect(seen[0]).toMatchObject({ maxTokens: 4096, reasoning: 'low' });
    expect(seen[1]).toMatchObject({ maxTokens: 1000, reasoning: 'high' });
  });

  it('does not re-enable explicit off on an existing reasoning-capable conversation', async () => {
    const fixture = await createRuntimeFixture({ reasoning: true, maxTokens: 8192 });
    fixture.provider.setResponses([
      fauxAssistantMessage('First'),
      (_context, options) => {
        expect(options?.reasoning).toBeUndefined();
        return fauxAssistantMessage('Off');
      },
    ]);
    const first = await open(fixture.options);
    await first.execute(createTestInput());
    await first.close();
    vi.stubEnv('LLM_REASONING_EFFORT', 'off');
    const second = await open(await fixture.reopen());
    expect(await second.execute(createTestInput({ requestId: 'telegram:thinking-off' }))).toBe(
      'Off',
    );
  });
});
