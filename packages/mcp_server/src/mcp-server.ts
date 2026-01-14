/**
 * MCP Server with Per-Request Authentication
 * Implements proper stateless authentication following MCP best practices
 */

// Note: OTEL auto-instrumentation is loaded via --import flag in package.json dev script
// See: node --import @elastic/opentelemetry-node --import tsx src/mcp-server.ts

// Configure global HTTP timeout (2 minutes for slow operations)
import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ bodyTimeout: 120_000, headersTimeout: 120_000 }));

import {
  type AttachmentDoc,
  type TodoAlpha3,
  getCouchDbConfig,
  validateEnv,
} from '@eddo/core-server';
import { context, propagation } from '@opentelemetry/api';
import { dotenvLoad } from 'dotenv-mono';
import { FastMCP } from 'fastmcp';
import nano from 'nano';

import { validateUserContext } from './auth/user-auth.js';
import { registerTools } from './tools/register-tools.js';
import { storeTraceContext } from './tools/tool-wrapper.js';
import type { ToolContext, UserSession } from './tools/types.js';
import { logger } from './utils/logger.js';

/**
 * Extracts trace context from request headers for distributed tracing
 */
function extractTraceContext(
  headers: Record<string, string | undefined>,
): ReturnType<typeof context.active> {
  const carrier: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      carrier[key.toLowerCase()] = value;
    }
  }
  return propagation.extract(context.active(), carrier);
}

// Load environment variables
dotenvLoad();

// Validate environment
const env = validateEnv(process.env);

// Initialize nano connection
const couchDbConfig = getCouchDbConfig(env);
const couch = nano(couchDbConfig.url);

/**
 * Server instructions for LLM consumption
 */
const SERVER_INSTRUCTIONS = `Eddo Todo MCP Server with user registry authentication and GTD tag awareness. Pass X-User-ID, X-Database-Name, and X-Telegram-ID headers for user-specific database access. Each user gets an isolated database.

GTD SYSTEM:
- TAGS: gtd:next, gtd:project, gtd:waiting, gtd:someday, gtd:calendar (for actionability/type)
- CONTEXT: work, private, errands, etc. (for location/situation)
- DUE FIELD: For gtd:calendar = exact appointment time, for others = deadline/target

When creating todos, add appropriate GTD tags AND set proper context:
- tags: ["gtd:next"] + context: "work" for work actionable items
- tags: ["gtd:project"] + context: "private" for personal projects
- tags: ["gtd:waiting"] + context: "work" for work dependencies
- tags: ["gtd:calendar"] + context: "work" for appointments/meetings

APPOINTMENT CREATION RULE: For gtd:calendar items, ALWAYS prefix title with time in HH:MM format:
- "Doctor appointment at 3pm" → title: "15:00 Doctor appointment"
- "Meeting tomorrow at 10:30" → title: "10:30 Meeting"

For GTD queries like "what's next?", filter by gtd:next tags and optionally by context.`;

// Create server with authentication
const server = new FastMCP<UserSession>({
  name: 'eddo-mcp-auth',
  version: '1.0.0',
  ping: { logLevel: 'info' },
  instructions: SERVER_INSTRUCTIONS,
  authenticate: async (request) => {
    logger.debug('MCP authentication request');

    // Extract trace context from incoming request for distributed tracing
    const extractedContext = extractTraceContext(
      request.headers as Record<string, string | undefined>,
    );

    const username = request.headers['x-user-id'] || request.headers['X-User-ID'];

    if (!username) {
      logger.debug('MCP connection without user headers (connection handshake)');
      const session = {
        userId: 'anonymous',
        dbName: 'default',
        attachmentsDbName: 'default_attachments',
        username: 'anonymous',
      };
      storeTraceContext(session, extractedContext);
      return session;
    }

    const authResult = await validateUserContext(request.headers);
    logger.info(
      { userId: authResult.userId, username: authResult.username },
      'MCP user authenticated',
    );

    // Build attachments database name (parallel to user db)
    const attachmentsDbName = authResult.dbName.replace('_user_', '_attachments_');

    const session = {
      userId: authResult.userId,
      dbName: authResult.dbName,
      attachmentsDbName,
      username: authResult.username,
    };
    storeTraceContext(session, extractedContext);
    return session;
  },
});

/**
 * Gets the user's todo database from context
 */
function getUserDb(context: ToolContext): nano.DocumentScope<TodoAlpha3> {
  if (!context.session) {
    throw new Error('No user session available');
  }

  if (context.session.userId === 'anonymous') {
    throw new Error(
      'Tool calls require user authentication headers (X-User-ID, X-Database-Name, X-Telegram-ID)',
    );
  }

  return couch.db.use<TodoAlpha3>(context.session.dbName);
}

/**
 * Gets the user's attachments database from context
 */
function getAttachmentsDb(context: ToolContext): nano.DocumentScope<AttachmentDoc> {
  if (!context.session) {
    throw new Error('No user session available');
  }

  if (context.session.userId === 'anonymous') {
    throw new Error(
      'Tool calls require user authentication headers (X-User-ID, X-Database-Name, X-Telegram-ID)',
    );
  }

  return couch.db.use<AttachmentDoc>(context.session.attachmentsDbName);
}

// Register all tools with tracing
registerTools(server, getUserDb, getAttachmentsDb, couch);

// Export the server instance and control functions
export const mcpServer = server;

/**
 * Stops the MCP server
 */
export async function stopMcpServer(): Promise<void> {
  try {
    await server.stop();
    logger.info('MCP server stopped');
  } catch (error) {
    logger.error({ error }, 'Failed to stop MCP server');
    throw error;
  }
}

/**
 * Starts the MCP server on the specified port
 */
export async function startMcpServer(port: number = 3001): Promise<void> {
  try {
    logger.info({ port }, 'Initializing MCP server');

    // Verify CouchDB server connection
    const serverInfo = await couch.info();
    logger.info({ couchdbVersion: serverInfo.version }, 'Connected to CouchDB');

    await server.start({
      transportType: 'httpStream',
      httpStream: { port },
    });

    logger.info(
      {
        port,
        endpoint: `http://localhost:${port}/mcp`,
        tools: [
          'createTodo',
          'listTodos',
          'getTodo',
          'updateTodo',
          'toggleTodoCompletion',
          'deleteTodo',
          'startTimeTracking',
          'stopTimeTracking',
          'getActiveTimeTracking',
          'getServerInfo',
          'getUserInfo',
          'getBriefingData',
          'getRecapData',
        ],
      },
      'MCP server started',
    );
  } catch (error) {
    logger.error({ error }, 'Failed to start MCP server');
    throw error;
  }
}

// Auto-start the server when this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMcpServer(env.MCP_SERVER_PORT).catch((error) => {
    logger.error({ error }, 'Failed to start MCP server');
    process.exit(1);
  });
}
