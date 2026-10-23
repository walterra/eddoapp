// @vitest-environment node
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMCPClient, scopeMCPIntegration, setupMCPIntegration } from '../mcp/client.js';
import { createUserClient } from '../mcp/connection-manager-helpers.js';
import type { MCPUserContext } from '../mcp/user-context.js';
import { normalizeToolOutput } from './tool_output.js';

vi.mock('../utils/config.js', () => ({ appConfig: { MCP_SERVER_URL: 'http://localhost/mcp' } }));
vi.mock('../utils/logger.js', () => ({ logger: { info: vi.fn() } }));

interface CapturedRequest {
  method: string | null;
  authorization: string | null;
  operationId: string | null;
}

function identity(username: string, operationId?: string): MCPUserContext {
  return { username, telegramId: 123, mcpApiKey: `${username}-key`, operationId };
}

/** Exercises the real SDK over an in-memory HTTP fetch boundary. */
function mockServer(): CapturedRequest[] {
  const requests: CapturedRequest[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const authorization = request.headers.get('authorization');
    requests.push({
      method: request.headers.get('mcp-method'),
      authorization,
      operationId: request.headers.get('x-eddo-operation-id'),
    });
    if (!authorization) return new Response(null, { status: 401 });
    const handler = createMcpHandler(
      () => {
        const server = new McpServer({ name: 'test', version: '1.0.0' });
        const tool = authorization.includes('alice') ? 'aliceTool' : 'bobTool';
        server.registerTool(tool, {}, async () => ({
          content: [],
          structuredContent: { summary: tool, data: { owner: authorization } },
        }));
        return server;
      },
      { legacy: 'reject' },
    );
    try {
      return await handler.fetch(request);
    } finally {
      await handler.close();
    }
  });
  return requests;
}

afterEach(async () => {
  await getMCPClient()?.close();
  vi.unstubAllGlobals();
});

describe('authenticated stateless Telegram MCP integration', () => {
  it('initializes without an anonymous network request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await setupMCPIntegration()).tools).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(getMCPClient()).not.toBeNull();
  });

  it('keeps concurrent catalogs private and does not overwrite the dispatcher', async () => {
    const requests = mockServer();
    const dispatcher = await setupMCPIntegration();
    const [alice, bob] = await Promise.all([
      scopeMCPIntegration(dispatcher, identity('alice')),
      scopeMCPIntegration(dispatcher, identity('bob')),
    ]);
    expect(alice.tools.map((tool) => tool.name)).toEqual(['aliceTool']);
    expect(bob.tools.map((tool) => tool.name)).toEqual(['bobTool']);
    expect(dispatcher.tools).toEqual([]);
    expect(requests.every((request) => request.authorization)).toBe(true);
    expect(requests.some((request) => request.method === 'initialize')).toBe(false);
  });

  it('preserves operation IDs and reuses neither credentials nor invocation state', async () => {
    const requests = mockServer();
    const dispatcher = await setupMCPIntegration();
    const operationId = 'a'.repeat(64);
    const alice = normalizeToolOutput(
      await dispatcher.invoke('aliceTool', {}, identity('alice', operationId)),
    );
    const bob = normalizeToolOutput(await dispatcher.invoke('bobTool', {}, identity('bob')));
    expect(alice.text).toContain('alice-key');
    expect(bob.text).not.toContain('alice-key');
    const calls = requests.filter((request) => request.method === 'tools/call');
    expect(calls).toEqual([
      { method: 'tools/call', authorization: 'Bearer alice-key', operationId },
      { method: 'tools/call', authorization: 'Bearer bob-key', operationId: null },
    ]);
  });

  it('rejects missing credentials before networking', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(createUserClient({ ...identity('alice'), mcpApiKey: '' })).rejects.toThrow(
      'credentials',
    );
    await expect((await setupMCPIntegration()).invoke('getTodo', {})).rejects.toThrow(
      'User context',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed on rejected discovery without attempting legacy initialization', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    await expect(createUserClient(identity('alice'))).rejects.toThrow();
    expect(fetch).toHaveBeenCalledOnce();
  });
});
