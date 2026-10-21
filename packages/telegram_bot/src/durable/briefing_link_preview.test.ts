import { fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it, vi } from 'vitest';
import { openDurableRuntime } from './runtime.js';
import { sendTelegramText } from './telegram_send.js';
import { createRuntimeFixture, createTestInput, deferred } from './test_helpers.js';

vi.mock('../utils/user-lookup.js', () => ({
  lookupUserByTelegramId: vi.fn().mockResolvedValue({
    username: 'alice',
    preferences: { mcpApiKey: 'secret' },
  }),
}));

describe('scheduled briefing link previews', () => {
  it('disables previews on every formatted chunk through the Telegram API adapter', async () => {
    const fixture = await createRuntimeFixture();
    const api = { sendMessage: vi.fn().mockResolvedValue(undefined) };
    fixture.options.send = (chat, text, options) => sendTelegramText(api, chat, text, options);
    fixture.provider.setResponses([
      fauxAssistantMessage(`**${'a'.repeat(4001)}** [Details](https://example.com)`),
    ]);
    const runtime = await openDurableRuntime(fixture.options);
    try {
      await runtime.execute(createTestInput({ report: { type: 'briefing', occurrence: 'today' } }));
      expect(api.sendMessage).toHaveBeenCalledTimes(2);
      for (const [chat, , options] of api.sendMessage.mock.calls) {
        expect(chat).toBe(123);
        expect(options).toMatchObject({ link_preview_options: { is_disabled: true } });
        expect(options.entities.length).toBeGreaterThan(0);
      }
    } finally {
      await runtime.close();
    }
  });

  it('preserves disabled previews when formatting falls back to plain text', async () => {
    const api = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce({
          error_code: 400,
          description: "Bad Request: can't parse entities",
        })
        .mockResolvedValueOnce(undefined),
    };
    const entities = [{ type: 'bold' as const, offset: 0, length: 4 }];
    await sendTelegramText(api, 123, 'Bold https://example.com', {
      entities,
      disableLinkPreview: true,
    });
    expect(api.sendMessage).toHaveBeenNthCalledWith(1, 123, 'Bold https://example.com', {
      entities,
      link_preview_options: { is_disabled: true },
    });
    expect(api.sendMessage).toHaveBeenNthCalledWith(2, 123, 'Bold https://example.com', {
      link_preview_options: { is_disabled: true },
    });
  });

  it.each(['interactive', 'manual briefing', 'scheduled recap'] as const)(
    'preserves default previews for %s',
    async (kind) => {
      const fixture = await createRuntimeFixture();
      const api = { sendMessage: vi.fn().mockResolvedValue(undefined) };
      fixture.options.send = (chat, text, options) => sendTelegramText(api, chat, text, options);
      const text = 'See https://example.com';
      const answer = kind === 'manual briefing' ? `---BRIEFING-START---\n${text}` : text;
      fixture.provider.setResponses([fauxAssistantMessage(answer)]);
      const input =
        kind === 'scheduled recap'
          ? createTestInput({ report: { type: 'recap', occurrence: 'today' } })
          : createTestInput();
      const runtime = await openDurableRuntime(fixture.options);
      try {
        await runtime.execute(input);
        expect(api.sendMessage).toHaveBeenCalledExactlyOnceWith(123, text);
      } finally {
        await runtime.close();
      }
    },
  );

  it('retains preview suppression when an interrupted send resumes after restart', async () => {
    const fixture = await createRuntimeFixture();
    const gate = deferred();
    const api = { sendMessage: vi.fn().mockImplementation(() => gate.promise) };
    fixture.options.send = (chat, text, options) => sendTelegramText(api, chat, text, options);
    fixture.provider.setResponses([fauxAssistantMessage('See https://example.com')]);
    const input = createTestInput({ report: { type: 'briefing', occurrence: 'today' } });
    const first = await openDurableRuntime(fixture.options);
    const pending = first.execute(input).catch(() => undefined);
    await vi.waitFor(() => expect(api.sendMessage).toHaveBeenCalledOnce());
    const closing = first.close();
    gate.resolve();
    await closing;
    await pending;
    api.sendMessage.mockResolvedValue(undefined);
    const second = await openDurableRuntime(await fixture.reopen());
    try {
      await second.execute(input);
      expect(api.sendMessage).toHaveBeenCalledTimes(2);
      for (const [, , options] of api.sendMessage.mock.calls)
        expect(options).toEqual({ link_preview_options: { is_disabled: true } });
      expect(fixture.provider.state.callCount).toBe(1);
    } finally {
      await second.close();
    }
  });
});
