import { createSchemaParser, obj, str } from '@eddo/core-shared/validation/schema_parser';
import { toStandardSchema } from '@eddo/core-shared/validation/standard_schema';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';

type TestHandler = ReturnType<typeof createMcpHandler>;

/** Creates modern MCP requests against the real SDK transport. */
function request(method: string, args?: unknown): Request {
  return new Request('http://localhost/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': method,
      ...(method === 'tools/call' ? { 'Mcp-Name': 'identity' } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: {
        ...(method === 'tools/call' ? { name: 'identity', arguments: args } : {}),
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0.0' },
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    }),
  });
}

const execute = vi.fn(async (value: string) => ({
  content: [{ type: 'text' as const, text: value }],
  structuredContent: { value },
}));

function handler(): TestHandler {
  const server = new McpServer({ name: 'pi-schema-test', version: '1.0.0' });
  const schema = toStandardSchema(createSchemaParser(obj({ value: str({ minLength: 1 }) })));
  server.registerTool(
    'identity',
    {
      description: 'Returns a validated value',
      inputSchema: schema,
      outputSchema: schema,
    },
    async (args) => execute(args.value),
  );
  return createMcpHandler(() => server, { legacy: 'reject' });
}

describe('pi-schema MCP SDK adapter', () => {
  it('publishes input and output JSON Schemas through tools/list', async () => {
    const response = await handler().fetch(request('tools/list'));
    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(body).toContain('"inputSchema"');
    expect(body).toContain('"outputSchema"');
    expect(body).toContain('"minLength":1');
    expect(body).toContain('"additionalProperties":false');
  });

  it('executes valid typed arguments through the SDK', async () => {
    execute.mockClear();
    const response = await handler().fetch(request('tools/call', { value: 'hello' }));
    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(body).toContain('hello');
    expect(execute).toHaveBeenCalledExactlyOnceWith('hello');
  });

  it.each([{ value: '' }, { value: 123 }, { value: 'hello', extra: true }, {}])(
    'rejects invalid arguments before side effects: %j',
    async (args) => {
      execute.mockClear();
      const response = await handler().fetch(request('tools/call', args));
      const body = await response.text();
      expect(body).not.toContain('"structuredContent"');
      expect(execute).not.toHaveBeenCalled();
    },
  );
});
