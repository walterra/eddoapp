// @vitest-environment node
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('dotenv-mono', () => ({ dotenvLoad: vi.fn() }));
vi.mock('../auth/user-auth.js', () => ({
  validateUserContext: async () => ({
    userId: 'alice',
    username: 'alice',
    dbName: 'eddo_user_alice',
    timezone: 'UTC',
  }),
}));
vi.mock('@eddo/core-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@eddo/core-server')>()),
  validateEnv: () => ({ COUCHDB_URL: 'http://localhost:5984', MCP_SERVER_PORT: 3001 }),
  getCouchDbConfig: () => ({ url: 'http://localhost:5984' }),
}));

interface CatalogResult {
  tools: Awaited<ReturnType<Client['listTools']>>;
  unavailable?: Awaited<ReturnType<Client['callTool']>>;
}

/** Exercises the production server factory without opening sockets or querying databases. */
async function catalog(elasticsearchUrl: string): Promise<CatalogResult> {
  vi.resetModules();
  vi.stubEnv('ELASTICSEARCH_URL', elasticsearchUrl);
  vi.stubEnv('MCP_HOST', 'localhost');
  const { mcpServer } = await import('../mcp-server.js');
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
    mcpServer.fetch(new Request(input, init)),
  );
  const client = new Client(
    { name: 'catalog-test', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), {
        requestInit: { headers: { Host: 'localhost', Authorization: 'Bearer test-key' } },
      }),
    );
    const tools = await client.listTools();
    const unavailable = elasticsearchUrl
      ? undefined
      : await client.callTool({
          name: 'searchTodos',
          arguments: { query: 'test' },
        });
    return { tools, unavailable };
  } finally {
    await client.close();
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('production MCP catalog stability', () => {
  it('publishes identical schemas with or without Elasticsearch and reports unavailable search', async () => {
    const disabled = await catalog('');
    const enabled = await catalog('http://localhost:9200');
    expect(disabled.tools.tools).toEqual(enabled.tools.tools);
    expect(disabled.tools.tools.map((tool) => tool.name)).toContain('searchTodos');
    expect(disabled.unavailable?.isError).toBe(true);
    expect(disabled.unavailable?.structuredContent).toMatchObject({
      summary: 'Search unavailable',
    });
  });
});
