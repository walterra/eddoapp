import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createToolRegistry } from '../tool_registry.js';
import type { ToolContext } from './types.js';

const log = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

async function callTool(context: ToolContext, legacy = false): Promise<Response> {
  const server = new McpServer({ name: 'test', version: '1.0.0' });
  createToolRegistry(server, context).addTool({
    name: 'identity',
    description: 'Returns the request identity',
    parameters: z.object({ value: z.string() }),
    execute: async (args, request) => `${request.session?.userId}:${args.value}`,
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
