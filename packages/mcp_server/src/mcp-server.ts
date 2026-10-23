import {
  createUserRegistry,
  getCouchDbConfig,
  validateEnv,
  type AttachmentDoc,
  type TodoAlpha4,
} from '@eddo/core-server';
import { Client } from '@elastic/elasticsearch';
import { serve, type ServerType } from '@hono/node-server';
import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { context, propagation } from '@opentelemetry/api';
import { dotenvLoad } from 'dotenv-mono';
import nano from 'nano';
import { Agent, setGlobalDispatcher } from 'undici';

import { createMutationStoreFactory, parseMcpOperationId } from './auth/mutation_store.js';
import { validateUserContext } from './auth/user-auth.js';
import { SERVER_INSTRUCTIONS } from './server_instructions.js';
import { createToolRegistry } from './tool_registry.js';
import { attachMutationStore } from './tools/mutation_receipts.js';
import { registerTools } from './tools/register-tools.js';
import { storeTraceContext } from './tools/tool-wrapper.js';
import type { ToolContext, UserSession } from './tools/types.js';
import { logger } from './utils/logger.js';

setGlobalDispatcher(new Agent({ bodyTimeout: 120_000, headersTimeout: 120_000 }));
dotenvLoad();
const env = validateEnv(process.env);
const couch = nano(getCouchDbConfig(env).url);
const getMutationStore = createMutationStoreFactory(couch);
const esUrl = process.env.ELASTICSEARCH_URL;
const esClient = esUrl
  ? new Client({
      node: esUrl,
      tls: esUrl.startsWith('https')
        ? { rejectUnauthorized: process.env.ELASTICSEARCH_TLS_VERIFY !== 'false' }
        : undefined,
    })
  : null;

/** Creates isolated authentication and delivery metadata for one HTTP request. */
async function authenticateRequest(request: Request): Promise<UserSession> {
  const headers = Object.fromEntries(request.headers.entries());
  const identity = await validateUserContext(headers);
  const operationId = parseMcpOperationId(headers['x-eddo-operation-id']);
  const session: UserSession = {
    ...identity,
    attachmentsDbName: identity.dbName.replace('_user_', '_attachments_'),
    ...(operationId ? { operationId } : {}),
  };
  if (operationId) attachMutationStore(session, await getMutationStore(session.dbName));
  storeTraceContext(session, propagation.extract(context.active(), headers));
  return session;
}

/** Creates transport-independent logging for domain handlers. */
function createToolContext(session: UserSession): ToolContext {
  return {
    session,
    log: {
      debug: (message, data) => logger.debug({ data }, message),
      info: (message, data) => logger.info({ data }, message),
      warn: (message, data) => logger.warn({ data }, message),
      error: (message, data) => logger.error({ data }, message),
    },
  };
}

/** Creates a protocol server owned by one request, with shared database clients. */
function createRequestServer(session: UserSession): McpServer {
  const server = new McpServer(
    { name: 'eddo-mcp-auth', version: '0.10.1' },
    { instructions: SERVER_INSTRUCTIONS },
  );
  registerTools({
    couch,
    server: createToolRegistry(server, createToolContext(session)),
    getUserDb: () => couch.db.use<TodoAlpha4>(session.dbName),
    getAttachmentsDb: () => couch.db.use<AttachmentDoc>(session.attachmentsDbName),
    ...(esClient ? { getEsClient: () => esClient } : {}),
  });
  return server;
}

export const mcpServer = createMcpHonoApp();

mcpServer.all('/mcp', async (c) => {
  try {
    const session = await authenticateRequest(c.req.raw);
    const handler = createMcpHandler(() => createRequestServer(session), { legacy: 'reject' });
    return await handler.fetch(c.req.raw);
  } catch (error) {
    if (error instanceof Response) return error;
    logger.error({ error }, 'MCP request failed');
    return c.json({ error: 'MCP request failed' }, 500);
  }
});

let httpServer: ServerType | undefined;

/** Stops accepting HTTP requests and waits for active requests to finish. */
export async function stopMcpServer(): Promise<void> {
  const server = httpServer;
  if (!server) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  httpServer = undefined;
  logger.info('MCP server stopped');
}

/** Starts the standalone Hono MCP service after database setup. */
export async function startMcpServer(port: number = 3001): Promise<void> {
  if (httpServer) throw new Error('MCP server is already running');
  const host = process.env.MCP_HOST || 'localhost';
  await couch.info();
  const registry = createUserRegistry(env.COUCHDB_URL, env);
  await registry.ensureDatabase();
  await registry.setupDesignDocuments();
  await new Promise<void>((resolve, reject) => {
    httpServer = serve({ fetch: mcpServer.fetch, port, hostname: host }, () => resolve());
    httpServer.once('error', reject);
  });
  logger.info({ port, host, searchEnabled: !!esClient }, 'MCP server started');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServer(env.MCP_SERVER_PORT).catch((error) => {
    logger.error({ error }, 'Failed to start MCP server');
    process.exit(1);
  });
}
