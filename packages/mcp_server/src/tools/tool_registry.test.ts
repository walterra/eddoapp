import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createToolRegistry } from '../tool_registry.js';
import type { ToolContext } from './types.js';

const log = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

type TestExecution = () => Promise<string>;

async function callTool(
  context: ToolContext,
  legacy = false,
  execute?: TestExecution,
): Promise<Response> {
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  createToolRegistry(server, context).addTool({
    name: 'identity',
    description: 'Returns the request identity',
    parameters: z.object({ value: z.string() }),
    execute:
      execute ??
      (async (args, request) =>
        JSON.stringify({
          summary: 'Identity',
          data: `${request.session?.userId}:${args.value}`,
          metadata: { operation: 'identity', timestamp: new Date().toISOString() },
        })),
  });
  const handler = createMcpHandler(() => server, { legacy: 'reject' });
  return handler.fetch(
    new Request('http://localhost/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'MCP-Protocol-Version': legacy ? '2025-11-25' : '2026-07-28',
        'Mcp-Method': 'tools/call',
        'Mcp-Name': 'identity',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'identity',
          arguments: { value: 'hello' },
          _meta: legacy
            ? undefined
            : {
                'io.modelcontextprotocol/protocolVersion': '2026-07-28',
                'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0.0' },
                'io.modelcontextprotocol/clientCapabilities': {},
              },
        },
      }),
    }),
  );
}

describe('SDK v2 tool registry', () => {
  it('handles a tool call without a legacy initialization handshake', async () => {
    const response = await callTool({ log });
    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(body).toContain('undefined:hello');
  });

  it('publishes output schemas and read-only annotations', () => {
    const server = new McpServer({ name: 'test', version: '1.0.0' });
    const register = vi.spyOn(server, 'registerTool');
    createToolRegistry(server, { log }).addTool({
      name: 'getTodo',
      description: 'Gets a todo',
      parameters: z.object({}),
      execute: async () => '{}',
    });
    expect(register).toHaveBeenCalledWith(
      'getTodo',
      expect.objectContaining({
        outputSchema: expect.any(Object),
        annotations: expect.objectContaining({ readOnlyHint: true, idempotentHint: true }),
      }),
      expect.any(Function),
    );
  });

  it('returns a safe tool error when execution throws', async () => {
    const response = await callTool({ log }, false, async () => {
      throw new Error('secret');
    });
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('"isError":true');
    expect(body).not.toContain('secret');
  });

  it('returns a tool error when output violates its schema', async () => {
    const response = await callTool({ log }, false, async () => 'not JSON');
    expect(await response.text()).toContain('"isError":true');
  });

  it('rejects legacy requests', async () => {
    const response = await callTool({ log }, true);
    expect(response.status).toBe(400);
  });

  it('isolates concurrent request identities', async () => {
    const responses = await Promise.all(
      ['alice', 'bob'].map((userId) =>
        callTool({
          log,
          session: {
            userId,
            username: userId,
            dbName: userId,
            attachmentsDbName: `${userId}_attachments`,
          },
        }),
      ),
    );
    const bodies = await Promise.all(responses.map((response) => response.text()));
    expect(bodies[0]).toContain('alice:hello');
    expect(bodies[0]).not.toContain('bob:hello');
    expect(bodies[1]).toContain('bob:hello');
    expect(bodies[1]).not.toContain('alice:hello');
  });
});
