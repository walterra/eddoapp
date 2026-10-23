import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestInput } from './test_helpers.js';
import { authorizeDurableRequest } from './tools.js';

const lookup = vi.hoisted(() => vi.fn());
vi.mock('../utils/user-lookup.js', () => ({ lookupUserByTelegramId: lookup }));

beforeEach(() => {
  lookup.mockReset();
  lookup.mockResolvedValue({
    username: 'alice',
    preferences: { mcpApiKey: 'current-key', dailyBriefing: true, dailyRecap: true },
  });
});

describe('scheduled report authorization', () => {
  it.each(['briefing', 'recap'] as const)('rejects a disabled %s on recovery', async (type) => {
    lookup.mockResolvedValue({
      username: 'alice',
      preferences: { mcpApiKey: 'current-key', dailyBriefing: false, dailyRecap: false },
    });
    await expect(
      authorizeDurableRequest(
        'alice',
        123,
        createTestInput({ report: { type, occurrence: 'today' } }),
      ),
    ).rejects.toThrow('disabled');
  });

  it('does not apply scheduled preferences to interactive requests', async () => {
    lookup.mockResolvedValue({ username: 'alice', preferences: { mcpApiKey: 'current-key' } });
    expect(await authorizeDurableRequest('alice', 123, createTestInput())).toEqual({
      username: 'alice',
      telegramId: 123,
      mcpApiKey: 'current-key',
    });
  });

  it('resolves current credentials instead of persisting them in a report input', async () => {
    const input = createTestInput({ report: { type: 'briefing', occurrence: 'today' } });
    expect(await authorizeDurableRequest('alice', 123, input)).toHaveProperty(
      'mcpApiKey',
      'current-key',
    );
    expect(JSON.stringify(input)).not.toContain('current-key');
    expect(lookup).toHaveBeenCalledWith(123);
  });
});
