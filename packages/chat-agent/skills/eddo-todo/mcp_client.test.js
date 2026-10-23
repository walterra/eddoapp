// @vitest-environment node
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { callTool, createClient } from './mcp_client.js';

const output = {
  summary: 'Todos',
  data: [],
  metadata: { operation: 'list', timestamp: '2026-10-23T12:00:00Z' },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('skill MCP client', () => {
  it('requires credentials before connecting', async () => {
    vi.stubEnv('EDDO_MCP_API_KEY', '');
    await expect(createClient()).rejects.toThrow('EDDO_MCP_API_KEY is required');
  });

  it('consumes structured results rather than text', async () => {
    const client = { callTool: vi.fn(async () => ({ structuredContent: output, content: [] })) };
    expect(JSON.parse(await callTool(client, 'listTodos', { limit: 20 }))).toEqual(output);
    expect(client.callTool).toHaveBeenCalledWith({ name: 'listTodos', arguments: { limit: 20 } });
  });

  it('rejects failed mutations without retrying', async () => {
    const client = { callTool: vi.fn(async () => ({ isError: true, structuredContent: output })) };
    await expect(callTool(client, 'createTodo')).rejects.toThrow('inspect state before retrying');
    expect(client.callTool).toHaveBeenCalledOnce();
  });

  it.each([undefined, [], { summary: 'missing metadata' }, { ...output, error: 'failure' }])(
    'rejects invalid structured results: %j',
    async (structuredContent) => {
      const client = { callTool: async () => ({ structuredContent }) };
      await expect(callTool(client, 'listTodos')).rejects.toThrow();
    },
  );

  it('connects and calls the real current-protocol server with credentials', async () => {
    vi.stubEnv('EDDO_MCP_API_KEY', 'test-key');
    vi.stubEnv('EDDO_MCP_URL', 'http://localhost/mcp');
    const methods = [];
    const handler = createMcpHandler(
      () => {
        const server = new McpServer({ name: 'test', version: '1.0.0' });
        server.registerTool('listTodos', {}, async () => ({
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        }));
        return server;
      },
      { legacy: 'reject' },
    );
    vi.stubGlobal('fetch', async (input, init) => {
      const request = new Request(input, init);
      expect(request.headers.get('authorization')).toBe('Bearer test-key');
      methods.push(request.headers.get('mcp-method'));
      return handler.fetch(request);
    });
    const client = await createClient();
    try {
      expect(JSON.parse(await callTool(client, 'listTodos'))).toEqual(output);
      expect(methods).toContain('server/discover');
      expect(methods).toContain('tools/call');
      expect(methods).not.toContain('initialize');
    } finally {
      await client.close();
      await handler.close();
    }
  });
});
