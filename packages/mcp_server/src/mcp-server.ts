/**
 * MCP Server with Per-Request Authentication
 * Implements proper stateless authentication following MCP best practices
 */

// Note: OTEL auto-instrumentation is loaded via --import flag in package.json dev script
// See: node --import @elastic/opentelemetry-node --import tsx src/mcp-server.ts

// Configure global HTTP timeout (2 minutes for slow operations)
import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(new Agent({ bodyTimeout: 120_000, headersTimeout: 120_000 }));

import { type TodoAlpha3, getCouchDbConfig, validateEnv } from '@eddo/core-server';
import { context, propagation, trace } from '@opentelemetry/api';
import { dotenvLoad } from 'dotenv-mono';
import { FastMCP } from 'fastmcp';
import nano from 'nano';

import { validateUserContext } from './auth/user-auth.js';
import {
  createTodoDescription,
  createTodoParameters,
  deleteTodoDescription,
  deleteTodoParameters,
  executeCreateTodo,
  executeDeleteTodo,
  executeGetActiveTimeTracking,
  executeGetBriefingData,
  executeGetRecapData,
  executeGetServerInfo,
  executeGetTodo,
  executeGetUserInfo,
  executeListTodos,
  executeStartTimeTracking,
  executeStopTimeTracking,
  executeToggleCompletion,
  executeUpdateTodo,
  getActiveTimeTrackingDescription,
  getActiveTimeTrackingParameters,
  getBriefingDataDescription,
  getBriefingDataParameters,
  getRecapDataDescription,
  getRecapDataParameters,
  getServerInfoDescription,
  getServerInfoParameters,
  getTodoDescription,
  getTodoParameters,
  getUserInfoDescription,
  getUserInfoParameters,
  listTodosDescription,
  listTodosParameters,
  startTimeTrackingDescription,
  startTimeTrackingParameters,
  stopTimeTrackingDescription,
  stopTimeTrackingParameters,
  toggleCompletionDescription,
  toggleCompletionParameters,
  updateTodoDescription,
  updateTodoParameters,
} from './tools/index.js';
import type { ToolContext, UserSession } from './tools/types.js';
import { logger } from './utils/logger.js';

/**
 * Extracts trace context from request headers and stores it for later use.
 * Returns the extracted context for use in tool executions.
 */
function extractTraceContext(
  headers: Record<string, string | undefined>,
): ReturnType<typeof context.active> {
  // Normalize headers to lowercase for propagation API
  const carrier: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      carrier[key.toLowerCase()] = value;
    }
  }
  return propagation.extract(context.active(), carrier);
}

// Store extracted context per request (keyed by session)
const requestContexts = new WeakMap<object, ReturnType<typeof context.active>>();

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
      const session = { userId: 'anonymous', dbName: 'default', username: 'anonymous' };
      requestContexts.set(session, extractedContext);
      return session;
    }

    const authResult = await validateUserContext(request.headers);
    logger.info(
      { userId: authResult.userId, username: authResult.username },
      'MCP user authenticated',
    );

    const session = {
      userId: authResult.userId,
      dbName: authResult.dbName,
      username: authResult.username,
    };
    requestContexts.set(session, extractedContext);
    return session;
  },
});

/**
 * Gets the user's database from context
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
 * Wraps a tool execution with tracing span, preserving distributed trace context
 */
function wrapToolExecution<TArgs, TResult>(
  toolName: string,
  executeFn: (args: TArgs, toolContext: ToolContext) => TResult | Promise<TResult>,
): (args: TArgs, toolContext: ToolContext) => Promise<TResult> {
  return async (args: TArgs, toolContext: ToolContext) => {
    // Get the extracted trace context from the request (if available)
    const extractedContext = toolContext.session
      ? requestContexts.get(toolContext.session)
      : undefined;
    const parentContext = extractedContext ?? context.active();

    // Create span within the parent context (from telegram-bot if available)
    const tracer = trace.getTracer('eddo-mcp-server');
    const span = tracer.startSpan(
      `mcp_tool_${toolName}`,
      {
        attributes: {
          'mcp.tool': toolName,
          'user.id': toolContext.session?.userId ?? 'anonymous',
          'user.name': toolContext.session?.username ?? 'anonymous',
        },
      },
      parentContext,
    );

    return context.with(trace.setSpan(parentContext, span), async () => {
      try {
        const result = await Promise.resolve(executeFn(args, toolContext));
        span.setAttribute('mcp.result', 'success');
        logger.info({ toolName, userId: toolContext.session?.userId }, 'MCP tool executed');
        span.end();
        return result;
      } catch (error) {
        span.setAttribute('mcp.result', 'error');
        span.setAttribute('error.message', error instanceof Error ? error.message : String(error));
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        logger.error({ toolName, error }, 'MCP tool execution failed');
        span.end();
        throw error;
      }
    });
  };
}

// Register all tools with tracing
server.addTool({
  name: 'createTodo',
  description: createTodoDescription,
  parameters: createTodoParameters,
  execute: wrapToolExecution('createTodo', (args, ctx) =>
    executeCreateTodo(args, ctx, getUserDb, couch),
  ),
});

server.addTool({
  name: 'listTodos',
  description: listTodosDescription,
  parameters: listTodosParameters,
  execute: wrapToolExecution('listTodos', (args, ctx) => executeListTodos(args, ctx, getUserDb)),
});

server.addTool({
  name: 'getTodo',
  description: getTodoDescription,
  parameters: getTodoParameters,
  execute: wrapToolExecution('getTodo', (args, ctx) => executeGetTodo(args, ctx, getUserDb)),
});

server.addTool({
  name: 'getUserInfo',
  description: getUserInfoDescription,
  parameters: getUserInfoParameters,
  execute: wrapToolExecution('getUserInfo', (_, ctx) => executeGetUserInfo({}, ctx)),
});

server.addTool({
  name: 'updateTodo',
  description: updateTodoDescription,
  parameters: updateTodoParameters,
  execute: wrapToolExecution('updateTodo', (args, ctx) => executeUpdateTodo(args, ctx, getUserDb)),
});

server.addTool({
  name: 'toggleTodoCompletion',
  description: toggleCompletionDescription,
  parameters: toggleCompletionParameters,
  execute: wrapToolExecution('toggleTodoCompletion', (args, ctx) =>
    executeToggleCompletion(args, ctx, getUserDb),
  ),
});

server.addTool({
  name: 'deleteTodo',
  description: deleteTodoDescription,
  parameters: deleteTodoParameters,
  execute: wrapToolExecution('deleteTodo', (args, ctx) => executeDeleteTodo(args, ctx, getUserDb)),
});

server.addTool({
  name: 'startTimeTracking',
  description: startTimeTrackingDescription,
  parameters: startTimeTrackingParameters,
  execute: wrapToolExecution('startTimeTracking', (args, ctx) =>
    executeStartTimeTracking(args, ctx, getUserDb),
  ),
});

server.addTool({
  name: 'stopTimeTracking',
  description: stopTimeTrackingDescription,
  parameters: stopTimeTrackingParameters,
  execute: wrapToolExecution('stopTimeTracking', (args, ctx) =>
    executeStopTimeTracking(args, ctx, getUserDb),
  ),
});

server.addTool({
  name: 'getActiveTimeTracking',
  description: getActiveTimeTrackingDescription,
  parameters: getActiveTimeTrackingParameters,
  execute: wrapToolExecution('getActiveTimeTracking', (_args, ctx) =>
    executeGetActiveTimeTracking({}, ctx, getUserDb),
  ),
});

server.addTool({
  name: 'getServerInfo',
  description: getServerInfoDescription,
  parameters: getServerInfoParameters,
  execute: wrapToolExecution('getServerInfo', (args, ctx) =>
    executeGetServerInfo(args, ctx, getUserDb),
  ),
});

server.addTool({
  name: 'getBriefingData',
  description: getBriefingDataDescription,
  parameters: getBriefingDataParameters,
  execute: wrapToolExecution('getBriefingData', (_args, ctx) =>
    executeGetBriefingData({}, ctx, getUserDb),
  ),
});

server.addTool({
  name: 'getRecapData',
  description: getRecapDataDescription,
  parameters: getRecapDataParameters,
  execute: wrapToolExecution('getRecapData', (_args, ctx) =>
    executeGetRecapData({}, ctx, getUserDb),
  ),
});

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
