import type { Bot } from 'grammy';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../bot/bot.js';

const fixture = vi.hoisted(() => ({
  open: vi.fn(),
  close: vi.fn(),
  execute: vi.fn(),
  authorize: vi.fn(),
  getOrCreateActive: vi.fn(),
  provision: vi.fn(),
}));
vi.mock('@eddo/core-server', () => ({
  createEnv: () => ({ COUCHDB_URL: 'http://unused' }),
  createUserRegistry: () => ({
    findByUsername: async () => ({ username: 'alice', telegram_id: 123, status: 'active' }),
  }),
  createAssistantConversationDatabase: () => ({
    ensureDatabase: async () => {},
    setupDesignDocuments: async () => {},
    getOrCreateActive: fixture.getOrCreateActive,
  }),
}));
vi.mock('pi-durable-couchdb', () => ({ openCouchDbStorage: async () => ({ close: vi.fn() }) }));
vi.mock('pi-ai-durable/providers/all', () => ({
  builtinModels: () => ({ getModel: () => true, getAuth: async () => true }),
}));
vi.mock('../mcp/client.js', () => ({ getMCPClient: () => ({ tools: [] }) }));
vi.mock('../utils/config.js', () => ({ appConfig: { BOT_PERSONA_ID: 'gtd_coach' } }));
vi.mock('../utils/logger.js', () => ({ logger: { error: vi.fn() } }));
vi.mock('./couch.js', () => ({ provisionDurableDatabase: fixture.provision }));
vi.mock('./projection.js', () => ({ projectDurableExchange: vi.fn() }));
vi.mock('./runtime.js', () => ({ openDurableRuntime: fixture.open }));
vi.mock('./tools.js', () => ({ resolveDurableUser: fixture.authorize }));

import { executeDurableMessage, startDurableHost, stopDurableHost } from './host.js';

let finish: () => void;
const bot = { botInfo: { id: 77 }, api: { sendMessage: vi.fn() } } as unknown as Bot<BotContext>;

function context(): BotContext {
  return {
    session: { user: { username: 'alice' } },
    from: { id: 123 },
    chat: { id: 123, type: 'private' },
    message: { message_id: 4, date: 1_000_000 },
    update: { update_id: 19 },
  } as unknown as BotContext;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.stubEnv('TELEGRAM_DURABLE_USERS', 'alice');
  fixture.getOrCreateActive.mockResolvedValue({ _id: 'active_chat' });
  fixture.provision.mockResolvedValue({ url: 'http://unused/runtime' });
  fixture.authorize.mockResolvedValue({ username: 'alice' });
  fixture.execute.mockResolvedValue('Done');
  const closed = new Promise<void>((resolve) => {
    finish = resolve;
  });
  fixture.close.mockImplementation(async () => {
    finish();
  });
  fixture.open.mockResolvedValue({ execute: fixture.execute, close: fixture.close, closed });
});
afterEach(async () => {
  await stopDurableHost();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('durable host ownership and supervision', () => {
  it('shares one runtime and uses stable bot/update identities', async () => {
    await startDurableHost(bot);
    expect(await executeDurableMessage('hello', context())).toBe('Done');
    await executeDurableMessage('hello', context());
    expect(fixture.open).toHaveBeenCalledOnce();
    expect(fixture.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requestId: 'telegram:77:19',
        conversationId: 'active_chat',
        telegramId: 123,
        chatId: 123,
      }),
    );
  });

  it('reopens failed sessions without waiting for another Telegram update', async () => {
    await startDurableHost(bot);
    finish();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fixture.open).toHaveBeenCalledTimes(2);
  });

  it('rejects non-private chats before opening or admitting work', async () => {
    await startDurableHost(bot);
    const ctx = context();
    Object.assign(ctx.chat!, { type: 'group' });
    await expect(executeDurableMessage('hello', ctx)).rejects.toThrow('private Telegram chat');
    expect(fixture.execute).not.toHaveBeenCalled();
  });

  it('rechecks authorization at admission instead of trusting cached sessions', async () => {
    await startDurableHost(bot);
    fixture.authorize.mockRejectedValue(new Error('revoked'));
    await expect(executeDurableMessage('hello', context())).rejects.toThrow('revoked');
    expect(fixture.execute).not.toHaveBeenCalled();
  });
});
