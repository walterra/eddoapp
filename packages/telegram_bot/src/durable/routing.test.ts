import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BotContext } from '../bot/bot.js';
import { executeAgentMessage, getAgentStatus } from './routing.js';

const durable = vi.hoisted(() => vi.fn());
vi.mock('./host.js', () => ({ executeDurableMessage: durable }));
vi.mock('../utils/config.js', () => ({ appConfig: { LLM_MODEL: 'anthropic/configured' } }));
vi.mock('../mcp/client.js', () => ({ getMCPClient: () => ({ tools: [{ name: 'getTodo' }] }) }));
vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn() },
  SpanAttributes: { USER_ID: 'user.id' },
  withSpan: async (_name: string, _attributes: unknown, action: () => Promise<string>) => action(),
}));

function context(username: string): BotContext {
  return { session: { user: { username } }, from: { id: 123 } } as unknown as BotContext;
}
afterEach(() => vi.clearAllMocks());

describe('single durable agent entry point', () => {
  it('routes every linked user through the durable runtime', async () => {
    durable.mockResolvedValue('Done');
    expect(await executeAgentMessage('hello', context('alice'))).toBe('Done');
    expect(await executeAgentMessage('hello', context('bob'))).toBe('Done');
    expect(durable).toHaveBeenCalledTimes(2);
  });
  it('propagates failures without selecting another agent implementation', async () => {
    durable.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(executeAgentMessage('create todo', context('alice'))).rejects.toThrow(
      'storage unavailable',
    );
    expect(durable).toHaveBeenCalledOnce();
  });
  it('reports the actual runtime and configured model', () => {
    expect(getAgentStatus()).toMatchObject({
      workflowType: 'Pi Durable',
      model: 'anthropic/configured',
      mcpToolsAvailable: 1,
    });
  });
});
