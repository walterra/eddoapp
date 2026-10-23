import { describe, expect, it, vi } from 'vitest';
import { sendTelegramText } from './telegram_send.js';

const entities = [{ type: 'bold' as const, offset: 0, length: 4 }];

describe('Telegram entity delivery', () => {
  it('sends explicit entities without parse_mode', async () => {
    const api = { sendMessage: vi.fn().mockResolvedValue(undefined) };
    await sendTelegramText(api, 123, 'Bold', { entities });
    expect(api.sendMessage).toHaveBeenCalledExactlyOnceWith(123, 'Bold', { entities });
  });

  it('falls back to readable text after an explicit formatting rejection', async () => {
    const api = {
      sendMessage: vi
        .fn()
        .mockRejectedValueOnce({
          error_code: 400,
          description: "Bad Request: can't parse entities",
        })
        .mockResolvedValueOnce(undefined),
    };
    await sendTelegramText(api, 123, 'Bold', { entities });
    expect(api.sendMessage).toHaveBeenNthCalledWith(1, 123, 'Bold', { entities });
    expect(api.sendMessage).toHaveBeenNthCalledWith(2, 123, 'Bold');
  });

  it.each([
    new Error('Ambiguous network failure'),
    { error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 30 } },
    { error_code: 403, description: 'Forbidden' },
    { error_code: 400, description: 'Bad Request: chat not found' },
    { error_code: 500, description: 'Server unavailable' },
  ])('does not immediately resend on transport or unrelated API failures', async (error) => {
    const api = { sendMessage: vi.fn().mockRejectedValue(error) };
    await expect(sendTelegramText(api, 123, 'Bold', { entities })).rejects.toBe(error);
    expect(api.sendMessage).toHaveBeenCalledOnce();
  });

  it('preserves the plain-text send path for unformatted messages', async () => {
    const api = { sendMessage: vi.fn().mockResolvedValue(undefined) };
    await sendTelegramText(api, 123, 'Plain');
    expect(api.sendMessage).toHaveBeenCalledExactlyOnceWith(123, 'Plain');
  });
});
