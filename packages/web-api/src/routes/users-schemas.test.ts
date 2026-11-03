import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  linkTelegramSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from './users-schemas';

describe('user schema compatibility', () => {
  it('preserves password minimums in UTF-16 units', () => {
    expect(
      changePasswordSchema.parse({ currentPassword: 'current', newPassword: '😀'.repeat(4) })
        .newPassword.length,
    ).toBe(8);
    expect(updateProfileSchema.safeParse({ newPassword: 'short' }).success).toBe(false);
    expect(updateProfileSchema.parse({ email: 'user@example.com', ignored: true })).toEqual({
      email: 'user@example.com',
    });
  });

  it.each([0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1, '123'])(
    'rejects invalid Telegram identifiers: %j',
    (telegramId) => {
      expect(linkTelegramSchema.safeParse({ telegramId }).success).toBe(false);
    },
  );

  it('projects nested preferences without discarding supported nullable credentials', () => {
    expect(
      updatePreferencesSchema.parse({
        ignored: true,
        githubToken: null,
        mcpApiKey: null,
        aiProviderKeys: { openaiApiKey: 'key', ignored: true },
        selectedTimeRange: { type: 'custom', startDate: 'date', ignored: true },
        rssFeeds: [{ url: 'url', feedUrl: 'feed', enabled: true, addedAt: 'date', ignored: true }],
      }),
    ).toEqual({
      githubToken: null,
      mcpApiKey: null,
      aiProviderKeys: { openaiApiKey: 'key' },
      selectedTimeRange: { type: 'custom', startDate: 'date' },
      rssFeeds: [{ url: 'url', feedUrl: 'feed', enabled: true, addedAt: 'date' }],
    });
  });

  it('validates timezones and retains one-digit briefing hours', () => {
    expect(
      updatePreferencesSchema.parse({ timezone: 'Europe/Vienna', briefingTime: '7:00' }),
    ).toEqual({ timezone: 'Europe/Vienna', briefingTime: '7:00' });
    expect(updatePreferencesSchema.safeParse({ timezone: 'not/a/timezone' }).success).toBe(false);
    expect(updatePreferencesSchema.safeParse({ recapTime: '24:00' }).success).toBe(false);
  });

  it.each([{ githubSyncInterval: '60' }, { rssSyncInterval: 0 }, { rssSyncInterval: 1.5 }])(
    'does not coerce preference intervals',
    (value) => {
      expect(updatePreferencesSchema.safeParse(value).success).toBe(false);
    },
  );
});
