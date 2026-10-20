import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../bot/bot.js';
import { routeAgentMessage } from './routing.js';

const durable = vi.hoisted(() => vi.fn());
vi.mock('./host.js', () => ({ executeDurableMessage: durable }));

function context(username?: string): BotContext {
  return { session: { user: username ? { username } : undefined } } as BotContext;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('durable runtime routing', () => {
  it('keeps legacy behavior when enrollment is disabled', async () => {
    vi.stubEnv('TELEGRAM_DURABLE_USERS', '');
    const legacy = vi.fn().mockResolvedValue({ success: true });
    await routeAgentMessage('hello', context('alice'), legacy);
    expect(legacy).toHaveBeenCalledOnce();
    expect(durable).not.toHaveBeenCalled();
  });

  it('routes only enrolled users to Durable', async () => {
    vi.stubEnv('TELEGRAM_DURABLE_USERS', 'alice');
    const legacy = vi.fn().mockResolvedValue({ success: true });
    durable.mockResolvedValue('Done');
    expect(await routeAgentMessage('hello', context('alice'), legacy)).toEqual({
      success: true,
      finalResponse: 'Done',
    });
    await routeAgentMessage('hello', context('bob'), legacy);
    await routeAgentMessage('hello', context(), legacy);
    expect(durable).toHaveBeenCalledOnce();
    expect(legacy).toHaveBeenCalledTimes(2);
  });

  it('never retries an admitted durable request through the legacy runtime', async () => {
    vi.stubEnv('TELEGRAM_DURABLE_USERS', 'alice');
    durable.mockRejectedValue(new Error('storage unavailable'));
    const legacy = vi.fn();
    await expect(routeAgentMessage('create todo', context('alice'), legacy)).rejects.toThrow(
      'storage unavailable',
    );
    expect(legacy).not.toHaveBeenCalled();
  });
});
