import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it, vi } from 'vitest';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput, deferred } from './test_helpers.js';

vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi.fn().mockResolvedValue({
    username: 'alice',
    preferences: { mcpApiKey: 'secret' },
  }),
}));

describe('durable formatted replies', () => {
  it('splits formatted text safely while preserving raw model and history content', async () => {
    const fixture = await createRuntimeFixture();
    const text = `${'a'.repeat(3999)}😀tail`;
    const answer = `**${text}**`;
    fixture.provider.setResponses([fauxAssistantMessage(answer)]);
    const input = createTestInput();
    const runtime = await openDurableRuntime(fixture.options);
    try {
      expect(await runtime.execute(input)).toBe(answer);
      expect(fixture.options.send).toHaveBeenNthCalledWith(1, 123, 'a'.repeat(3999), [
        { type: 'bold', offset: 0, length: 3999 },
      ]);
      expect(fixture.options.send).toHaveBeenNthCalledWith(2, 123, '😀tail', [
        { type: 'bold', offset: 0, length: 6 },
      ]);
      await vi.waitFor(() => expect(fixture.options.project).toHaveBeenCalledWith(input, answer));
    } finally {
      await runtime.close();
    }
  });

  it('resumes persisted text and entities without reparsing or resending committed chunks', async () => {
    const fixture = await createRuntimeFixture();
    const answer = `\`\`\`typescript\n${'x'.repeat(8100)}\n\`\`\``;
    fixture.provider.setResponses([fauxAssistantMessage(answer)]);
    const gate = deferred();
    fixture.options.send = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => gate.promise);
    const input = createTestInput();
    const first = await openDurableRuntime(fixture.options);
    const waiting = first.execute(input).catch(() => undefined);
    await vi.waitFor(() => expect(fixture.options.send).toHaveBeenCalledTimes(2));
    const closing = first.close();
    gate.resolve();
    await closing;
    await waiting;
    const options = await fixture.reopen();
    options.send = vi.fn().mockResolvedValue(undefined);
    const formatter = vi
      .spyOn(await import('./telegram_format.js'), 'formatTelegramText')
      .mockReturnValue({
        text: 'Different parser output',
        entities: [],
      });
    const second = await openDurableRuntime(options);
    try {
      expect(await second.execute(input)).toBe(answer);
      expect(formatter).not.toHaveBeenCalled();
      expect(options.send).toHaveBeenCalledTimes(2);
      expect(options.send).toHaveBeenNthCalledWith(1, 123, 'x'.repeat(4000), [
        { type: 'pre', language: 'typescript', offset: 0, length: 4000 },
      ]);
      expect(options.send).toHaveBeenNthCalledWith(2, 123, 'x'.repeat(100), [
        { type: 'pre', language: 'typescript', offset: 0, length: 100 },
      ]);
      expect(fixture.provider.state.callCount).toBe(1);
    } finally {
      formatter.mockRestore();
      await second.close();
    }
  });
});
