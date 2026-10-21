import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it, vi } from 'vitest';
import { prepareReply, printDurableReport } from './report_delivery.js';
import { openDurableRuntime } from './runtime.js';
import { createRuntimeFixture, createTestInput } from './test_helpers.js';

const mocks = vi.hoisted(() => ({ print: vi.fn() }));
vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi.fn().mockResolvedValue({
    _id: 'user_alice',
    username: 'alice',
    preferences: { mcpApiKey: 'secret', printBriefing: true, printRecap: true },
  }),
}));
vi.mock('../scheduler/helpers/printer.js', () => ({ printIfEnabled: mocks.print }));

describe('manual reports', () => {
  it.each(['briefing', 'recap'] as const)('cleans and prints a manual %s once', async (type) => {
    const fixture = await createRuntimeFixture();
    const print = vi
      .fn()
      .mockImplementation((input, answer, reportType) =>
        printDurableReport('alice', input, answer, reportType),
      );
    fixture.options.print = print;
    fixture.provider.setResponses([
      fauxAssistantMessage(`Introduction\n---${type.toUpperCase()}-START---\nActual tasks`),
    ]);
    const runtime = await openDurableRuntime(fixture.options);
    const input = createTestInput({ text: `Generate my ${type} now` });
    try {
      expect(await runtime.execute(input)).toBe('Actual tasks');
      expect(await runtime.execute(input)).toBe('Actual tasks');
      expect(print).toHaveBeenCalledExactlyOnceWith(input, 'Actual tasks', type);
      expect(mocks.print).toHaveBeenCalledWith({
        userId: 'user_alice',
        username: 'alice',
        content: 'Actual tasks',
        type,
      });
    } finally {
      await runtime.close();
    }
  });

  it('does not print an empty manual report', () => {
    expect(prepareReply(createTestInput(), '---RECAP-START---')).toMatchObject({
      answer: 'The report contained no content.',
      printable: false,
    });
  });
});
