import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import nano from 'nano';
import { randomBytes, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getGlobalTestUser } from '../setup/global-test-user.js';
import { MCPTestServer } from '../setup/test-server.js';

beforeAll(async () => {
  const ready = new MCPTestServer();
  try {
    await ready.waitForServer();
  } finally {
    await ready.stop();
  }
});

async function create(
  operationId: string,
  title: string,
): Promise<Awaited<ReturnType<Client['callTool']>>> {
  const user = await getGlobalTestUser();
  const url =
    process.env.MCP_TEST_URL ?? `http://localhost:${process.env.MCP_SERVER_PORT || '3003'}/mcp`;
  const client = new Client(
    { name: 'receipt-test', version: '1.0.0' },
    {
      versionNegotiation: { mode: { pin: '2026-07-28' } },
    },
  );
  await client.connect(
    new StreamableHTTPClientTransport(new URL(url), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${user.mcpApiKey}`,
          'x-eddo-operation-id': operationId,
        },
      },
    }),
  );
  try {
    return await client.callTool({ name: 'createTodo', arguments: { title } });
  } finally {
    await client.close();
  }
}

describe('authenticated receiver-side mutation receipts', () => {
  it('replays a result across new MCP sessions without creating a second todo', async () => {
    const id = randomBytes(32).toString('hex');
    const title = `Receipt ${randomUUID()}`;
    const first = await create(id, title);
    expect(first.isError).not.toBe(true);
    const second = await create(id, title);
    expect(second.isError).not.toBe(true);
    expect(second.content).toEqual(first.content);
    const user = await getGlobalTestUser();
    const result = await nano(process.env.COUCHDB_URL!)
      .db.use(user.dbName)
      .find({ selector: { title } });
    expect(result.docs).toHaveLength(1);
    const receipt = await nano(process.env.COUCHDB_URL!)
      .db.use(`${user.dbName}_mcp_operations`)
      .get(`mcp_operation_${id}`);
    expect(receipt).toMatchObject({ status: 'completed', version: 'mcp_operation_alpha1' });
  });

  it('rejects argument changes under an already completed operation ID', async () => {
    const id = randomBytes(32).toString('hex');
    expect((await create(id, `Original ${randomUUID()}`)).isError).not.toBe(true);
    const result = await create(id, `Different ${randomUUID()}`);
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.structuredContent)).toContain('inspect state before retrying');
  });
});
