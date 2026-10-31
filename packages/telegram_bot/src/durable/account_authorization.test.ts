import type { AssistantRequest } from '@eddo/core-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMCPHeaders, validateUserContextForMCP } from '../mcp/user-context.js';
import { authorizeAssistantRequest, resolveAssistantAccount } from './account_authorization.js';

vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn() } }));

const fixture = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock('@eddo/core-server', () => ({
  createEnv: () => ({ COUCHDB_URL: 'http://unused' }),
  createUserRegistry: () => ({ findByUsername: fixture.find }),
}));

function request(): AssistantRequest {
  return {
    account: { username: 'alice' },
    requestId: 'web:alice:1',
    conversationId: 'assistant_default',
    text: 'List tasks',
    source: { channel: 'web' },
    createdAt: new Date().toISOString(),
    deadline: Date.now() + 300_000,
  };
}

beforeEach(() => {
  fixture.find.mockReset();
  fixture.find.mockResolvedValue({
    username: 'alice',
    status: 'active',
    preferences: { mcpApiKey: 'current-key' },
  });
});

describe('assistant account authorization', () => {
  it('authorizes web-only accounts and produces authenticated MCP headers', async () => {
    const user = await authorizeAssistantRequest({ username: 'alice' }, request());
    expect(user).toEqual({ username: 'alice', mcpApiKey: 'current-key' });
    expect(validateUserContextForMCP(user)).toBe(true);
    expect(createMCPHeaders(user).Authorization).toBe('Bearer current-key');
  });

  it.each([
    null,
    { username: 'alice', status: 'suspended', preferences: { mcpApiKey: 'key' } },
    { username: 'alice', status: 'active', preferences: {} },
    { username: 'bob', status: 'active', preferences: { mcpApiKey: 'key' } },
  ])('rejects missing, revoked, or mismatched accounts: %j', async (user) => {
    fixture.find.mockResolvedValue(user);
    await expect(resolveAssistantAccount({ username: 'alice' })).rejects.toThrow('account');
  });

  it('refreshes credentials and rejects revocation on resumed requests', async () => {
    const input = request();
    await authorizeAssistantRequest({ username: 'alice' }, input);
    fixture.find.mockResolvedValueOnce({
      username: 'alice',
      status: 'active',
      preferences: { mcpApiKey: 'rotated' },
    });
    expect((await authorizeAssistantRequest({ username: 'alice' }, input)).mcpApiKey).toBe(
      'rotated',
    );
    fixture.find.mockResolvedValueOnce(null);
    await expect(authorizeAssistantRequest({ username: 'alice' }, input)).rejects.toThrow();
    expect(fixture.find).toHaveBeenCalledTimes(3);
  });

  it('rejects cross-account requests before accessing the registry', async () => {
    await expect(authorizeAssistantRequest({ username: 'bob' }, request())).rejects.toThrow(
      'journal account',
    );
    expect(fixture.find).not.toHaveBeenCalled();
  });

  it('rejects changed Telegram links and non-private destinations', async () => {
    const input = request();
    input.source = { channel: 'telegram', telegram: { chatId: 123, userId: 123 } };
    await expect(authorizeAssistantRequest({ username: 'alice' }, input)).rejects.toThrow(
      'identity changed',
    );
    input.source = { channel: 'telegram', telegram: { chatId: 456, userId: 123 } };
    await expect(authorizeAssistantRequest({ username: 'alice' }, input)).rejects.toThrow(
      'private',
    );
  });

  it('requires a current Telegram link and enabled preferences for scheduled reports', async () => {
    const input = request();
    input.report = { type: 'briefing', occurrence: 'today' };
    await expect(authorizeAssistantRequest({ username: 'alice' }, input)).rejects.toThrow(
      'Scheduled',
    );
    input.source = { channel: 'telegram', telegram: { chatId: 123, userId: 123 } };
    fixture.find.mockResolvedValue({
      username: 'alice',
      status: 'active',
      telegram_id: 123,
      preferences: { mcpApiKey: 'key', dailyBriefing: true, dailyRecap: false },
    });
    await expect(authorizeAssistantRequest({ username: 'alice' }, input)).resolves.toMatchObject({
      telegramId: 123,
    });
    input.report = { type: 'recap', occurrence: 'today' };
    await expect(authorizeAssistantRequest({ username: 'alice' }, input)).rejects.toThrow(
      'Scheduled',
    );
  });
});
