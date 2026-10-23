import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { describe, expect, it, vi } from 'vitest';
import { invokeToolOnClient } from '../mcp/connection-manager-helpers.js';

vi.mock('../utils/config.js', () => ({
  appConfig: { MCP_SERVER_URL: 'http://localhost:3003/mcp' },
}));
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn() } }));

describe('MCP receiver error propagation', () => {
  it('retains error status for blocked or ambiguous mutation commands', async () => {
    const content = [{ type: 'text', text: 'Operation outcome is unknown' }];
    const client = {
      callTool: vi.fn().mockResolvedValue({ content, isError: true }),
    } as unknown as Client;
    expect(await invokeToolOnClient(client, 'createTodo', {})).toEqual({ content, isError: true });
  });

  it('preserves the existing successful content-array contract', async () => {
    const content = [{ type: 'text', text: 'Created' }];
    const client = { callTool: vi.fn().mockResolvedValue({ content }) } as unknown as Client;
    expect(await invokeToolOnClient(client, 'createTodo', {})).toBe(content);
  });
});
