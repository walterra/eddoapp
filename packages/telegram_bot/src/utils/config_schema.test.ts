import { describe, expect, it } from 'vitest';
import { parseTelegramConfig } from './config_schema';

describe('Telegram configuration compatibility', () => {
  const base = { TELEGRAM_BOT_TOKEN: 'token' };

  it('preserves defaults, trimming, projection, and explicit string boolean conversion', () => {
    expect(
      parseTelegramConfig({ ...base, EDDO_MODELS_FILE: ' models.json ', unrelated: true }),
    ).toEqual({
      ...base,
      EDDO_MODELS_FILE: 'models.json',
      ASSISTANT_INTERNAL_PORT: 3003,
      WEB_API_BASE_URL: 'http://localhost:3000',
      TELEGRAM_LOG_USER_DETAILS: false,
    });
    expect(
      parseTelegramConfig({ ...base, TELEGRAM_LOG_USER_DETAILS: 'TRUE' }).TELEGRAM_LOG_USER_DETAILS,
    ).toBe(true);
    expect(
      parseTelegramConfig({ ...base, TELEGRAM_LOG_USER_DETAILS: ' true ' })
        .TELEGRAM_LOG_USER_DETAILS,
    ).toBe(false);
  });

  it('accepts host-only credentials and preserves UTF-16 token limits', () => {
    const config = parseTelegramConfig({
      ASSISTANT_INTERNAL_TOKEN: '😀'.repeat(16),
      ASSISTANT_INTERNAL_PORT: '4000',
    });
    expect(config.ASSISTANT_INTERNAL_PORT).toBe(4000);
    expect(config.TELEGRAM_BOT_TOKEN).toBeUndefined();
  });

  it.each([
    {},
    { ...base, TELEGRAM_BOT_TOKEN: '' },
    { ...base, EDDO_MODELS_FILE: ' ' },
    { ...base, ASSISTANT_INTERNAL_TOKEN: 'short' },
    { ...base, ASSISTANT_INTERNAL_PORT: '' },
    { ...base, ASSISTANT_INTERNAL_PORT: '1.5' },
    { ...base, ASSISTANT_INTERNAL_PORT: '65536' },
    { ...base, WEB_API_BASE_URL: 'invalid' },
    { ...base, TELEGRAM_LOG_USER_DETAILS: true },
  ])('rejects invalid configuration', (input) => {
    expect(() => parseTelegramConfig(input)).toThrow();
  });

  it('does not mutate environment fields', () => {
    const input = Object.freeze({ ...base, EDDO_MODELS_FILE: ' file ' });
    expect(parseTelegramConfig(input).EDDO_MODELS_FILE).toBe('file');
    expect(input.EDDO_MODELS_FILE).toBe(' file ');
  });
});
