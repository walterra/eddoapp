import type { Client } from '@modelcontextprotocol/client';
import { describe, expect, it, vi } from 'vitest';
import { invokeToolOnClient } from '../mcp/connection-manager-helpers.js';
import { normalizeToolOutput } from './tool_output.js';

vi.mock('../utils/config.js', () => ({
  appConfig: { MCP_SERVER_URL: 'http://localhost:3003/mcp' },
}));
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn() } }));

describe('MCP receiver error propagation', () => {
  it('retains error status for blocked or ambiguous mutations without retry', async () => {
    const structuredContent = { summary: 'Failed', error: 'Inspect state before retrying' };
    const result = { content: [], structuredContent, isError: true };
    const callTool = vi.fn().mockResolvedValue(result);
    const client = { callTool } as unknown as Client;
    const output = await invokeToolOnClient(client, 'createTodo', {});
    expect(output).toBe(result);
    expect(normalizeToolOutput(output).isError).toBe(true);
    expect(callTool).toHaveBeenCalledOnce();
  });

  it('prefers structured content over text rendering', async () => {
    const structuredContent = { summary: 'Created', data: { id: 'todo-1' } };
    const result = { content: [{ type: 'text', text: 'Not the payload' }], structuredContent };
    const client = { callTool: vi.fn().mockResolvedValue(result) } as unknown as Client;
    expect(normalizeToolOutput(await invokeToolOnClient(client, 'createTodo', {}))).toEqual({
      text: JSON.stringify(structuredContent),
      isError: false,
    });
  });

  it('rejects a missing structured result', async () => {
    const client = { callTool: vi.fn().mockResolvedValue({ content: [] }) } as unknown as Client;
    await expect(invokeToolOnClient(client, 'createTodo', {})).rejects.toThrow(
      'no structured result',
    );
  });
});
